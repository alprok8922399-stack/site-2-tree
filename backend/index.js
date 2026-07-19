const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// Импортируем константы, утилиты и структуры данных из модуля статики
const {
    getLevelLetter,
    cellIdToGlobalIndex,
    mitronsToUsd,
    createNewUserCard,
    createInitialWallets
} = require('./static');

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('../frontend'));

// Инициализация операционных баз данных (в памяти)
let shopUsersDB = {};
let wallets = createInitialWallets();

// База данных реферальных связей: { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};

// Хранилище имени последнего зарегистрированного бота для выстраивания автоцепочки
let lastRegisteredBot = null;

// Стартовое состояние корневой матрицы проекта
function createInitialTree() {
    return {
        'A1': { id: 'A1', level: 'A', user: 'SYSTEM_ROOT' },
        'B1': { id: 'B1', level: 'B', user: 'LEADER_1' },
        'B2': { id: 'B2', level: 'B', user: 'LEADER_2' },
        'C1': { id: 'C1', level: 'C', user: null },
        'C2': { id: 'C2', level: 'C', user: null },
        'C3': { id: 'C3', level: 'C', user: null },
        'C4': { id: 'C4', level: 'C', user: null }
    };
}

let treeDB = createInitialTree();

/**
 * Уникальный алгоритм заполнения «Гребёнка» по порциям из 32 матриц (128 ячеек)
 * Идеально балансирует нагрузку по веткам, поставляя данные для веерного почкования.
 */
function findNextEmptyCell(tree) {
    // Первоочередное заполнение базовой семерки лидера
    const orderABC = ['A1', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'];
    for (const key of orderABC) {
        if (tree[key] && !tree[key].user) return key;
    }

    let levelIndex = 3; // Начинаем перебор с уровня D (индекс 3)
    while (true) {
        const letter = getLevelLetter(levelIndex);
        const countInLevel = 1 << levelIndex; 
        const totalQuadsInLevel = countInLevel / 4; 

        const CHUNK_SIZE = 32;

        for (let chunkStart = 0; chunkStart < totalQuadsInLevel; chunkStart += CHUNK_SIZE) {
            const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalQuadsInLevel);
            
            for (let position = 0; position < 4; position++) {
                for (let quad = chunkStart; quad < chunkEnd; quad++) {
                    const num = (quad * 4) + position + 1;
                    const id = `${letter}${num}`;
                    
                    if (!tree[id]) {
                        tree[id] = { id, level: letter, user: null };
                    }
                    
                    if (!tree[id].user) {
                        return id; 
                    }
                }
            }
        }
        levelIndex++; 
    }
}

/**
 * Генерация пустых дочерних элементов для сохранения целостности бинарного дерева
 */
function checkAndGenerateChildren(tree, currentCellId) {
    if (!currentCellId) return;
    const globalIdx = cellIdToGlobalIndex(currentCellId);
    
    const leftChildGlobal = globalIdx * 2 + 1;
    const rightChildGlobal = globalIdx * 2 + 2;
    
    function createCellByGlobalIndex(gIdx) {
        let levelIndex = 0;
        while ((1 << (levelIndex + 1)) - 1 <= gIdx) {
            levelIndex++;
        }
        const levelStart = (1 << levelIndex) - 1;
        const num = (gIdx - levelStart) + 1;
        const letter = getLevelLetter(levelIndex);
        const id = `${letter}${num}`;
        if (!tree[id]) {
            tree[id] = { id, level: letter, user: null };
        }
    }
    
    createCellByGlobalIndex(leftChildGlobal);
    createCellByGlobalIndex(rightChildGlobal);
}

// ================= API МАТРИЦЫ И ДЕРЕВА =================

// Получение текущего состояния глобального дерева ячеек
app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

// Прямая регистрация пользователя в свободную ячейку матрицы
app.post('/api/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === username.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Этот пользователь уже занял место в матрице' });

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = username;
    
    referalsDB[username] = sponsor ? sponsor : 'SYSTEM_ROOT';
    
    checkAndGenerateChildren(treeDB, cellId);
    res.json({ success: true, cellId, user: username });
});

// Сброс всей экосистемы в исходное состояние (для тестов)
app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    shopUsersDB = {};
    wallets = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;
    res.json({ success: true });
});

// Получение детальной информации о пользователе и его спонсорской цепочке (вверх)
app.get('/api/user-details/:username', (req, res) => {
    const username = req.params.username;
    
    const userCells = Object.values(treeDB)
        .filter(cell => cell.user && cell.user.toLowerCase() === username.toLowerCase())
        .map(cell => cell.id);
        
    if (userCells.length === 0 && !referalsDB[username]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    let sponsorChain = [];
    let currentSponsor = referalsDB[username] || 'SYSTEM_ROOT';
    let visited = new Set(); // Защита от бесконечных циклов в реферальной структуре
    
    while (currentSponsor && !visited.has(currentSponsor)) {
        visited.add(currentSponsor);
        sponsorChain.push(currentSponsor);
        currentSponsor = referalsDB[currentSponsor];
    }
    
    // Если карточки пользователя в БД магазина нет — генерируем дефолтную структуру
    const userCard = shopUsersDB[username] || createNewUserCard(username);
    
    res.json({
        success: true,
        username: username,
        cells: userCells,
        sponsor: referalsDB[username] || 'SYSTEM_ROOT',
        chain: sponsorChain,
        profile: userCard
    });
});

/**
 * Архитектурный эндпоинт: Построение дерева связей для Активной Реферальной Сетки.
 * Возвращает структурированные ноды с parentId, children и уровнем колонки (level).
 */
app.get('/api/referals-tree', (req, res) => {
    let structure = {};
    
    // 1. Карта прямых личников (детей) для каждого спонсора
    let childrenMap = {};
    Object.keys(referalsDB).forEach(user => {
        childrenMap[user] = [];
    });
    
    Object.entries(referalsDB).forEach(([user, sponsor]) => {
        if (sponsor && childrenMap[sponsor]) {
            childrenMap[sponsor].push(user);
        }
    });
    
    // 2. Функция безопасного вычисления номера колонки (глубины от SYSTEM_ROOT)
    function getCalculatedLevel(user) {
        let level = 1;
        let current = user;
        let visited = new Set();
        
        while (current && current !== 'SYSTEM_ROOT' && !visited.has(current)) {
            visited.add(current);
            let sponsor = referalsDB[current];
            if (!sponsor) {
                level++;
                break;
            }
            current = sponsor;
            level++;
        }
        return level;
    }

    // 3. Сборка финальных объектов по стандарту ТЗ дерева связей
    Object.keys(referalsDB).forEach(username => {
        structure[username] = {
            id: username,
            login: username,
            parentId: referalsDB[username],
            level: getCalculatedLevel(username),
            isExpanded: false, // Исходное состояние для фронтенда
            children: childrenMap[username] || []
        };
    });

    res.json({ success: true, tree: structure });
});

/**
 * Метод Smart Path: Возвращает точную цепочку от корня до искомого пользователя.
 * Фронтенд использует этот массив, чтобы точечно открыть (isExpanded = true) нужные ячейки.
 */
app.get('/api/get-referral-chain', (req, res) => {
    const { login } = req.query;
    if (!login) return res.status(400).json({ error: 'Параметр login обязателен' });

    // Приведение к регистру, если в БД ключ хранится в исходном виде
    const targetUser = Object.keys(referalsDB).find(k => k.toLowerCase() === login.trim().toLowerCase());
    if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден в реферальной сети' });

    let chain = [];
    let current = targetUser;
    let visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);
        chain.push(current);
        current = referalsDB[current];
    }

    // Разворачиваем, чтобы путь шел сверху вниз: Root ➔ ... ➔ Целевой пользователь
    chain.reverse();

    res.json({ success: true, chain });
});

// ================= API МАРКЕТПЛЕЙСА (ФИНАНСЫ И АКТИВАЦИЯ) =================

// Регистрация нового покупателя в магазине
app.post('/api/shop/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    if (shopUsersDB[username]) return res.status(400).json({ error: 'Такой покупатель уже зарегистрирован' });
    
    shopUsersDB[username] = createNewUserCard(username);
    
    if (sponsor) {
        referalsDB[username] = sponsor;
    } else {
        referalsDB[username] = lastRegisteredBot ? lastRegisteredBot : 'SYSTEM_ROOT';
    }
    lastRegisteredBot = username; 
    
    res.json({ success: true, shopUserStatus: shopUsersDB[username] });
});

// Оплата бизнес-места: Списание 1000 Митронов ($130) и автоматическая посадка в матрицу
app.post('/api/shop/pay', (req, res) => {
    const { username } = req.body;
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Покупатель не найден' });
    
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === username.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Этот пользователь уже занял место в матрице' });

    // Финансовая математика ТЗ: 1000 Митронов ($130) за место
    const TOTAL_MITRONS = 1000;
    const MARKETPLACE_RESERVE = 700; // 70% в резерв ликвидности системы
    const CREATOR_COLD = 300;        // 30% на холодный сейф создателя

    // Обновление балансов и статуса плательщика
    shopUsersDB[username].isPaid = true;
    shopUsersDB[username].paymentDate = new Date().toISOString();
    shopUsersDB[username].balances.mitrons += TOTAL_MITRONS;
    shopUsersDB[username].balances.usd = parseFloat(mitronsToUsd(shopUsersDB[username].balances.mitrons));

    // Распределение средств по системным сейфам-кошелькам
    wallets.payoutReserveWallet.balanceMitrons += MARKETPLACE_RESERVE;
    wallets.myWallet.balanceMitrons += CREATOR_COLD;

    // Поиск свободной ячейки по Гребёнке и посадка пользователя в глобальное дерево
    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = username;
    
    // Привязка ID полученной ячейки к профилю в маркетплейсе
    shopUsersDB[username].matrixPosition.currentCellId = cellId;
    shopUsersDB[username].matrixPosition.status = 'active';

    checkAndGenerateChildren(treeDB, cellId);

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[username],
        cellId,
        split: {
            totalMitrons: TOTAL_MITRONS,
            totalUsd: parseFloat(mitronsToUsd(TOTAL_MITRONS)),
            marketplaceMitrons: MARKETPLACE_RESERVE,
            myWalletMitrons: CREATOR_COLD
        }
    });
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
