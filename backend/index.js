const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('../frontend'));

// Логин основателя, куда летят средства с пустых/замороженных ячеек
const FOUNDER_USERNAME = 'FOUNDER';

let shopUsersDB = {
    // Инициализируем основателя в базе маркетплейса, чтобы ему капал баланс
    [FOUNDER_USERNAME]: { username: FOUNDER_USERNAME, isPaid: true, balance: 0 }
};

// База данных реферальных связей (кто кого пригласил): { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};
// Храним имя последнего зарегистрированного бота для создания автоматической цепочки
let lastRegisteredBot = null;

// === БАЗА ДАННЫХ ПРЕМИАЛЬНЫХ ЗОЛОТЫХ ЯЧЕЕК ===
let premiumCellsDB = {
    'GOLD-1': { id: 'GOLD-1', user: null, isFrozen: false, reward: 150 },
    'GOLD-2': { id: 'GOLD-2', user: null, isFrozen: false, reward: 50 },
    'GOLD-3': { id: 'GOLD-3', user: null, isFrozen: false, reward: 50 },
    'GOLD-4': { id: 'GOLD-4', user: null, isFrozen: false, reward: 25 },
    'GOLD-5': { id: 'GOLD-5', user: null, isFrozen: false, reward: 25 }
};

function getLevelLetter(levelIndex) {
    let letter = '';
    let temp = levelIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

function cellIdToGlobalIndex(id) {
    const match = id.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;
    const letter = match[1];
    const num = parseInt(match[2], 10);
    
    let levelIndex = 0;
    let temp = 0;
    for (let i = 0; i < letter.length; i++) {
        levelIndex = levelIndex * 26 + (letter.charCodeAt(i) - 64);
    }
    levelIndex -= 1;
    
    const levelStartGlobalIndex = (1 << levelIndex) - 1;
    return levelStartGlobalIndex + (num - 1);
}

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
    const orderABC = ['A1', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'];
    for (const key of orderABC) {
        if (tree[key] && !tree[key].user) return key;
    }

    let levelIndex = 3; 
    while (true) {
        const letter = getLevelLetter(levelIndex);
        const countInLevel = 1 << levelIndex; 
        const totalQuadsInLevel = countInLevel / 4; 

        const CHUNK_SIZE = 32;

        for (let chunkStart = 0; chunkStart < totalQuadsInLevel; chunkStart += CHUNK_SIZE) {
            const chunkEnd = Math.min(chunkStart + CHUNK_SIZE, totalQuadsInLevel);
            let isChunkFull = true;

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

// Вспомогательная функция распределения 300 золотых единиц
function distributePremiumRewards() {
    Object.keys(premiumCellsDB).forEach(cellId => {
        const cell = premiumCellsDB[cellId];
        const amount = cell.reward;

        // Если в золотой ячейке есть пользователь и выплаты не заморожены
        if (cell.user && !cell.isFrozen) {
            if (shopUsersDB[cell.user]) {
                shopUsersDB[cell.user].balance += amount;
            }
        } else {
            // Иначе начисления улетают ОСНОВАТЕЛЮ
            if (!shopUsersDB[FOUNDER_USERNAME]) {
                shopUsersDB[FOUNDER_USERNAME] = { username: FOUNDER_USERNAME, isPaid: true, balance: 0 };
            }
            shopUsersDB[FOUNDER_USERNAME].balance += amount;
        }
    });
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
    shopUsersDB = {
        [FOUNDER_USERNAME]: { username: FOUNDER_USERNAME, isPaid: true, balance: 0 }
    };
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    Object.keys(premiumCellsDB).forEach(id => {
        premiumCellsDB[id].user = null;
        premiumCellsDB[id].isFrozen = false;
    });
    lastRegisteredBot = null;
    res.json({ success: true });
});

// Получение данных пользователя (включая проверку на Премиум-статус для ЛК сайта №1)
app.get('/api/user-details/:username', (req, res) => {
    const username = req.params.username;
    
    const userCells = Object.values(treeDB)
        .filter(cell => cell.user && cell.user.toLowerCase() === username.toLowerCase())
        .map(cell => cell.id);
        
    if (userCells.length === 0 && !referalsDB[username] && !shopUsersDB[username]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    let sponsorChain = [];
    let currentSponsor = referalsDB[username] || 'SYSTEM_ROOT';
    
    while (currentSponsor) {
        sponsorChain.push(currentSponsor);
        currentSponsor = referalsDB[currentSponsor];
    }

    // Проверяем, владеет ли этот пользователь какой-либо золотой ячейкой
    const isPremiumUser = Object.values(premiumCellsDB).some(
        cell => cell.user && cell.user.toLowerCase() === username.toLowerCase()
    );
    
    res.json({
        success: true,
        username: username,
        cells: userCells,
        sponsor: referalsDB[username] || 'SYSTEM_ROOT',
        chain: sponsorChain,
        isPremium: isPremiumUser // Передаём флаг на фронтенд для подсветки
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

// === API ДЛЯ РАБОТЫ С ЗОЛОТЫМИ МЕСТАМИ (ДЛЯ ПАНЕЛИ АДМИНИСТРАТОРА / САЙТА №2) ===

// Получить состояние всех 5 золотых ячеек
app.get('/api/premium-cells', (req, res) => {
    // Обогащаем данными пользователей из shopUsersDB для отображения полной карточки
    let detailedCells = {};
    Object.keys(premiumCellsDB).forEach(id => {
        const cell = premiumCellsDB[id];
        let userData = null;
        if (cell.user && shopUsersDB[cell.user]) {
            userData = shopUsersDB[cell.user];
        }
        detailedCells[id] = {
            ...cell,
            fullUserData: userData
        };
    });
    res.json({ success: true, cells: detailedCells });
});

// Посадить пользователя в золотую ячейку по ID (регистрация в премиум месте)
app.post('/api/premium/occupy', (req, res) => {
    const { cellId, username } = req.body;
    if (!premiumCellsDB[cellId]) return res.status(400).json({ error: 'Неверный ID золотой ячейки' });
    if (!username) return res.status(400).json({ error: 'Логин пользователя обязателен' });

    // Проверим, зарегистрирован ли вообще этот пользователь на сайте маркетплейса
    if (!shopUsersDB[username]) {
        // Создаем пользователя в системе, если его не было
        shopUsersDB[username] = { username, isPaid: false, balance: 0 };
    }

    premiumCellsDB[cellId].user = username;
    res.json({ success: true, cell: premiumCellsDB[cellId] });
});

// Заморозить / Разморозить выплаты премиальной ячейке
app.post('/api/premium/toggle-freeze', (req, res) => {
    const { cellId } = req.body;
    if (!premiumCellsDB[cellId]) return res.status(400).json({ error: 'Ячейка не найдена' });

    premiumCellsDB[cellId].isFrozen = !premiumCellsDB[cellId].isFrozen;
    res.json({ success: true, cell: premiumCellsDB[cellId] });
});

// Удалить пользователя из премиальной ячейки
app.post('/api/premium/remove-user', (req, res) => {
    const { cellId } = req.body;
    if (!premiumCellsDB[cellId]) return res.status(400).json({ error: 'Ячейка не найдена' });

    premiumCellsDB[cellId].user = null;
    premiumCellsDB[cellId].isFrozen = false; // сбрасываем заморозку при очистке
    res.json({ success: true, cell: premiumCellsDB[cellId] });
});


// === API МАРКЕТПЛЕЙСА (ДЛЯ САЙТА №1) ===
app.post('/api/shop/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    if (shopUsersDB[username]) return res.status(400).json({ error: 'Такой покупатель уже зарегистрирован' });
    
    shopUsersDB[username] = { username, isPaid: false, balance: 0 };
    
    if (sponsor) {
        referalsDB[username] = sponsor;
    } else {
        referalsDB[username] = lastRegisteredBot ? lastRegisteredBot : 'SYSTEM_ROOT';
    }
    lastRegisteredBot = username; 
    
    res.json({ success: true, shopUserStatus: shopUsersDB[username] });
});

app.post('/api/shop/pay', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Покупатель не найден' });
    
    const cellId = findNextEmptyCell(treeDB);

    shopUsersDB[username].isPaid = true;
    shopUsersDB[username].balance += 3000;

    treeDB[cellId].user = username;
    checkAndGenerateChildren(treeDB, cellId);

    // === ЛОГИКА ЗОЛОТЫХ ЯЧЕЕК ===
    // При каждой оплате (начислении) запускаем распределение 300 единиц по золотым местам
    distributePremiumRewards();

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[username],
        cellId,
        split: {
            total: amount,
            marketplace: 7000,
            myWallet: 3000
        }
    });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
