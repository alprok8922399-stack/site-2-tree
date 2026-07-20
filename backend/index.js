const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

// Импортируем утилиты из модуля статики
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

// Инициализация баз данных в памяти
let shopUsersDB = {};
let wallets = createInitialWallets();

// Реферальная база: { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};

let lastRegisteredBot = null;

// Стартовое состояние корневой матрицы
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
 * Алгоритм веерного заполнения ячеек матрицы по ТЗ
 */
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

// ================= API =================

app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

app.post('/api/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    
    const trimmedUser = username.trim();
    const canonicalSponsor = sponsor ? sponsor.trim() : 'SYSTEM_ROOT';
    
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === trimmedUser.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Пользователь уже занял место' });

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = trimmedUser;
    
    referalsDB[trimmedUser] = canonicalSponsor;
    
    if (!shopUsersDB[trimmedUser]) {
        shopUsersDB[trimmedUser] = createNewUserCard(trimmedUser);
        shopUsersDB[trimmedUser].isPaid = true;
        shopUsersDB[trimmedUser].matrixPosition.currentCellId = cellId;
        shopUsersDB[trimmedUser].matrixPosition.status = 'active';
    }
    
    checkAndGenerateChildren(treeDB, cellId);
    res.json({ success: true, cellId, user: trimmedUser });
});

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

app.get('/api/user-details/:username', (req, res) => {
    const usernameParam = req.params.username.trim();
    const canonicalName = Object.keys(referalsDB).find(k => k.toLowerCase() === usernameParam.toLowerCase())
                        || Object.keys(shopUsersDB).find(k => k.toLowerCase() === usernameParam.toLowerCase())
                        || usernameParam;
    
    const userCells = Object.values(treeDB)
        .filter(cell => cell.user && cell.user.toLowerCase() === canonicalName.toLowerCase())
        .map(cell => cell.id);
        
    let sponsorChain = [];
    let currentSponsor = referalsDB[canonicalName] || 'SYSTEM_ROOT';
    let visited = new Set();
    
    while (currentSponsor && !visited.has(currentSponsor)) {
        visited.add(currentSponsor);
        sponsorChain.push(currentSponsor);
        const nextSponsorKey = Object.keys(referalsDB).find(k => k.toLowerCase() === currentSponsor.toLowerCase());
        currentSponsor = nextSponsorKey ? referalsDB[nextSponsorKey] : null;
    }
    
    if (!shopUsersDB[canonicalName]) {
        shopUsersDB[canonicalName] = createNewUserCard(canonicalName);
        if (userCells.length > 0) {
            shopUsersDB[canonicalName].isPaid = true;
            shopUsersDB[canonicalName].matrixPosition.currentCellId = userCells[0];
            shopUsersDB[canonicalName].matrixPosition.status = 'active';
        }
    }
    
    res.json({
        success: true,
        username: canonicalName,
        cells: userCells,
        sponsor: referalsDB[canonicalName] || 'SYSTEM_ROOT',
        chain: sponsorChain,
        profile: shopUsersDB[canonicalName]
    });
});

app.get('/api/referals-tree', (req, res) => {
    let structure = {};
    let childrenMap = {};
    
    Object.keys(referalsDB).forEach(user => {
        childrenMap[user] = [];
    });
    
    Object.entries(referalsDB).forEach(([user, sponsor]) => {
        if (sponsor) {
            const canonicalSponsor = Object.keys(referalsDB).find(k => k.toLowerCase() === sponsor.toLowerCase()) || sponsor;
            if (!childrenMap[canonicalSponsor]) {
                childrenMap[canonicalSponsor] = [];
            }
            childrenMap[canonicalSponsor].push(user);
        }
    });
    
    function getCalculatedLevel(user) {
        let level = 1;
        let current = user;
        let visited = new Set();
        while (current && current !== 'SYSTEM_ROOT' && !visited.has(current)) {
            visited.add(current);
            let sponsor = referalsDB[current];
            if (!sponsor) { level++; break; }
            current = Object.keys(referalsDB).find(k => k.toLowerCase() === sponsor.toLowerCase()) || sponsor;
            level++;
        }
        return level;
    }

    Object.keys(referalsDB).forEach(username => {
        structure[username] = {
            id: username,
            login: username,
            parentId: referalsDB[username],
            level: getCalculatedLevel(username),
            isExpanded: false,
            children: childrenMap[username] || []
        };
    });

    res.json({ success: true, tree: structure });
});

app.get('/api/get-referral-chain', (req, res) => {
    const { login } = req.query;
    if (!login) return res.status(400).json({ error: 'Параметр login обязателен' });

    const targetUser = Object.keys(referalsDB).find(k => k.toLowerCase() === login.trim().toLowerCase());
    if (!targetUser) return res.status(404).json({ error: 'Пользователь не найден' });

    let chain = [];
    let current = targetUser;
    let visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);
        chain.push(current);
        const nextSponsorKey = Object.keys(referalsDB).find(k => k.toLowerCase() === referalsDB[current]?.toLowerCase());
        current = nextSponsorKey ? nextSponsorKey : referalsDB[current];
    }

    chain.reverse();
    res.json({ success: true, chain });
});

app.post('/api/shop/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const trimmedUser = username.trim();
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === trimmedUser.toLowerCase());
    if (isExist) {
        return res.json({ success: true, shopUserStatus: shopUsersDB[trimmedUser] || createNewUserCard(trimmedUser) });
    }
    
    shopUsersDB[trimmedUser] = createNewUserCard(trimmedUser);
    
    if (sponsor) {
        referalsDB[trimmedUser] = sponsor.trim();
    } else {
        referalsDB[trimmedUser] = lastRegisteredBot ? lastRegisteredBot : 'SYSTEM_ROOT';
    }
    lastRegisteredBot = trimmedUser; 

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = trimmedUser;
    
    shopUsersDB[trimmedUser].isPaid = true;
    shopUsersDB[trimmedUser].matrixPosition.currentCellId = cellId;
    shopUsersDB[trimmedUser].matrixPosition.status = 'active';
    
    checkAndGenerateChildren(treeDB, cellId);
    res.json({ success: true, shopUserStatus: shopUsersDB[trimmedUser], cellId });
});

app.post('/api/shop/pay', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) || username.trim();
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === canonicalName.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Пользователь уже занял место' });

    const TOTAL_MITRONS = 1000;
    const ADMIN_LOGISTICS = 450; 
    const DAO_POOL = 550;        

    if (!shopUsersDB[canonicalName]) {
        shopUsersDB[canonicalName] = createNewUserCard(canonicalName);
    }

    shopUsersDB[canonicalName].isPaid = true;
    shopUsersDB[canonicalName].paymentDate = new Date().toISOString();
    shopUsersDB[canonicalName].balances.mitrons += TOTAL_MITRONS;
    shopUsersDB[canonicalName].balances.usd = parseFloat(mitronsToUsd(shopUsersDB[canonicalName].balances.mitrons));

    wallets.adminWallet.balanceMitrons += ADMIN_LOGISTICS;
    wallets.daoWallet.balanceMitrons += DAO_POOL;

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalName;
    
    shopUsersDB[canonicalName].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalName].matrixPosition.status = 'active';

    checkAndGenerateChildren(treeDB, cellId);

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[canonicalName],
        cellId,
        split: {
            totalMitrons: TOTAL_MITRONS,
            adminLogistics: ADMIN_LOGISTICS,
            daoPool: DAO_POOL
        }
    });
});

// Админ-действия: Переключение VIP, Блокировка, Удаление
app.post('/api/admin/toggle-vip', (req, res) => {
    const { username } = req.body;
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Пользователь не найден' });
    shopUsersDB[username].isVip = !shopUsersDB[username].isVip;
    res.json({ success: true, isVip: shopUsersDB[username].isVip });
});

app.post('/api/admin/toggle-block', (req, res) => {
    const { username } = req.body;
    if (!username || !shopUsersDB[username]) return res.status(400).json({ error: 'Пользователь не найден' });
    shopUsersDB[username].isBlocked = !shopUsersDB[username].isBlocked;
    res.json({ success: true, isBlocked: shopUsersDB[username].isBlocked });
});

app.post('/api/admin/delete-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    delete shopUsersDB[username];
    delete referalsDB[username];
    
    Object.keys(treeDB).forEach(cellId => {
        if (treeDB[cellId].user === username) {
            treeDB[cellId].user = null;
        }
    });
    
    res.json({ success: true });
});

app.get('/api/sys-wallets', (req, res) => {
    res.json({ success: true, wallets });
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
