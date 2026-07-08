const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static('../frontend'));

let shopUsersDB = {};
// База данных реферальных связей (кто кого пригласил): { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};
// Храним имя последнего зарегистрированного бота для создания автоматической цепочки
let lastRegisteredBot = null;

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
        const countOfQuads = countInLevel / 4;

        for (let position = 0; position < 4; position++) {
            for (let quad = 0; quad < countOfQuads; quad++) {
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
    
    // Привязываем спонсора. Если не указан — привязываем к SYSTEM_ROOT
    referalsDB[username] = sponsor ? sponsor : 'SYSTEM_ROOT';
    
    checkAndGenerateChildren(treeDB, cellId);
    res.json({ success: true, cellId, user: username });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    shopUsersDB = {};
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;
    res.json({ success: true });
});

// Новый API эндпоинт для получения полных данных реферальной цепочки вверх («Кто-за-кем»)
app.get('/api/user-details/:username', (req, res) => {
    const username = req.params.username;
    
    // Находим все ячейки, которые занимает данный пользователь
    const userCells = Object.values(treeDB)
        .filter(cell => cell.user && cell.user.toLowerCase() === username.toLowerCase())
        .map(cell => cell.id);
        
    if (userCells.length === 0 && !referalsDB[username]) {
        return res.status(404).json({ error: 'Пользователь не найден' });
    }
    
    // Выстраиваем спонсорскую линию вверх до SYSTEM_ROOT
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

// === API МАРКЕТПЛЕЙСА (ДЛЯ САЙТА №1) ===
app.post('/api/shop/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    if (shopUsersDB[username]) return res.status(400).json({ error: 'Такой покупатель уже зарегистрирован' });
    
    shopUsersDB[username] = { username, isPaid: false, balance: 0 };
    
    // Запоминаем спонсора. Если робот регистрирует пачку ботов, связываем их цепочкой друг за другом
    if (sponsor) {
        referalsDB[username] = sponsor;
    } else {
        referalsDB[username] = lastRegisteredBot ? lastRegisteredBot : 'SYSTEM_ROOT';
    }
    lastRegisteredBot = username; // Текущий бот становится спонсором для следующего
    
    res.json({ success: true, shopUserStatus: shopUsersDB[username] });
});

app.post('/api/shop/pay', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Покупатель не найден' });
    
    // ОШИБКА УБРАНА! Больше нет проверки "if (isPaid)" — разрешаем повторные покупки!

    const cellId = findNextEmptyCell(treeDB);

    shopUsersDB[username].isPaid = true;
    shopUsersDB[username].balance += 3000;

    treeDB[cellId].user = username;
    checkAndGenerateChildren(treeDB, cellId);

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
