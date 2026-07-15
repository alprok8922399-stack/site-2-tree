const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// Импортируем утилиты, константы и структуры данных из static.js
const {
    getLevelLetter,
    cellIdToGlobalIndex,
    distributeLinearBonus,
    distributeSilverBonus,
    createNewUserCard,
    createInitialWallets
} = require('./static');

// Настраиваем CORS, чтобы разрешить запросы со всех доменов (включая Сайт №1) без блокировок
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());
app.use(express.static('../frontend'));

// === ИНИЦИАЛИЗАЦИЯ БАЗ ДАННЫХ ===

// Наша карточка покупателей (хранит балансы, статусы и счетчики)
let shopUsersDB = {};

// Инициализируем наш трехконтурный сейф кошельков
let walletsDB = createInitialWallets();

// База данных реферальных связей (интерактивная таблица): { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};

// Храним имя последнего зарегистрированного бота для создания автоматической цепочки
let lastRegisteredBot = null;

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

function findNextEmptyCell(tree) {
    // 1. Сначала жестко проверяем базовые уровни A, B, C
    const orderABC = ['A1', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'];
    for (const key of orderABC) {
        if (tree[key] && !tree[key].user) return key;
    }

    let levelIndex = 3; // Начинаем с уровня D
    
    while (true) {
        const letter = getLevelLetter(levelIndex);
        const countInLevel = 1 << levelIndex; // Количество ячеек на уровне (8, 16, 32...)
        
        const levelOrderIDs = [];
        const cellsPerChunk = 32 * 4; // 32 матрицы по 4 ячейки
        
        for (let chunkStart = 0; chunkStart < countInLevel; chunkStart += cellsPerChunk) {
            const currentChunkLimit = Math.min(chunkStart + cellsPerChunk, countInLevel);
            const totalQuadsInChunk = (currentChunkLimit - chunkStart) / 4;
            
            // Собираем правильный веерный порядок ID для уровня
            for (let position = 0; position < 4; position++) {
                for (let quad = 0; quad < totalQuadsInChunk; quad++) {
                    const num = chunkStart + (quad * 4) + position + 1;
                    levelOrderIDs.push(`${letter}${num}`);
                }
            }
        }
        
        // Перебираем собранные ID в веерном порядке
        for (const id of levelOrderIDs) {
            if (!tree[id]) {
                tree[id] = { id, level: letter, user: null };
            }
            if (!tree[id].user) {
                return id;
            }
        }
        levelIndex++; 
    }
}

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

// === API МАТРИЦЫ ===
app.get('/api/tree', (req, res) => res.json(treeDB));

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

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    shopUsersDB = {};
    walletsDB = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;
    res.json({ success: true });
});

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
    
    while (currentSponsor) {
        sponsorChain.push(currentSponsor);
        currentSponsor = referalsDB[currentSponsor];
    }
    
    res.json({
        success: true,
        username: username,
        cells: userCells,
        sponsor: referalsDB[username] || 'SYSTEM_ROOT',
        chain: sponsorChain
    });
});

app.get('/api/referals-tree', (req, res) => {
    let structure = {};
    
    function getCalculatedLevel(user) {
        if (user === 'SYSTEM_ROOT') return 1;
        let sponsor = referalsDB[user];
        if (!sponsor) return 2;
        return getCalculatedLevel(sponsor) + 1;
    }

    Object.keys(referalsDB).forEach(username => {
        structure[username] = {
            username: username,
            sponsor: referalsDB[username],
            calculatedColumn: getCalculatedLevel(username)
        };
    });

    res.json({ success: true, tree: structure });
});

// === API МАРКЕТПЛЕЙСА (ИНТЕРАКТИВНАЯ ТАБЛИЦА) ===
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

app.post('/api/shop/pay', (req, res) => {
    const { username, amount } = req.body; // amount ожидается в размере 1000 Митронов
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Покупатель не найден' });
    
    const payAmount = amount || 1000;
    const cellId = findNextEmptyCell(treeDB);

    // Обновляем карточку покупателя
    shopUsersDB[username].isPaid = true;
    shopUsersDB[username].paymentDate = new Date();
    shopUsersDB[username].matrixPosition.currentCellId = cellId;
    shopUsersDB[username].matrixPosition.status = 'active';

    // Расщепление входящего платежа: 450 Создателю, 550 в Резерв
    const creatorShare = 450;
    const payoutShare = 550;

    walletsDB.myWallet.balanceMitrons += creatorShare;
    walletsDB.payoutReserveWallet.balanceMitrons += payoutShare;

    // Начисляем линейные бонусы (50, 10, 10) вверх по интерактивной таблице
    const bonusLogs = distributeLinearBonus(username, referalsDB, shopUsersDB);

    treeDB[cellId].user = username;
    checkAndGenerateChildren(treeDB, cellId);

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[username],
        cellId,
        wallets: walletsDB,
        split: {
            total: payAmount,
            creatorShare: creatorShare,
            payoutReserveShare: payoutShare
        },
        referralLog: bonusLogs
    });
});

// Эндпоинт для подтверждения статуса "Реального покупателя" (имитация доставки товара / прошествия 31 дня)
app.post('/api/shop/confirm-real', (req, res) => {
    const { username } = req.body;
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Покупатель не найден' });
    
    const userCard = shopUsersDB[username];
    if (userCard.isRealBuyer) {
        return res.status(400).json({ error: 'Пользователь уже является Реальным покупателем' });
    }

    // 1. Активируем статус "Реального" у самого покупателя
    userCard.isRealBuyer = true;

    let silverBonusLog = "Серебряный бонус не начислялся.";
    const sponsor = referalsDB[username];

    if (sponsor && shopUsersDB[sponsor]) {
        const sponsorCard = shopUsersDB[sponsor];
        
        // 2. Увеличиваем счетчик Реальных лично приглашенных у спонсора
        sponsorCard.silverStatus.realDirectReferralsCount += 1;

        // 3. Если счетчик достиг 10 — автоматически открываем Серебряное место спонсору
        if (sponsorCard.silverStatus.realDirectReferralsCount >= 10 && !sponsorCard.silverStatus.isActive) {
            sponsorCard.silverStatus.isActive = true;
            sponsorCard.silverStatus.activatedAt = new Date();
        }

        // 4. Начисляем глубинный Серебряный бонус (10 Митронов) первому активному Серебру по цепочке выше
        silverBonusLog = distributeSilverBonus(username, referalsDB, shopUsersDB);
    }

    res.json({
        success: true,
        userStatus: userCard,
        sponsorStatus: sponsor ? shopUsersDB[sponsor] : null,
        silverBonusLog
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
