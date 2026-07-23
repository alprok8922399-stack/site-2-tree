const express = require('express');
const cors = require('cors');
const path = require('path');
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

// Исправленный универсальный путь к фронтенду
const frontendPath = path.join(__dirname, '../frontend');
app.use(express.static(frontendPath));

// Инициализация баз данных в памяти
let shopUsersDB = {};
let wallets = createInitialWallets();

// Состояние и логи генератора (робота)
let robotRunning = false;
let robotLogs = ["Ожидание запуска робота..."];
let robotTimer = null;

// Реферальная база: { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};

let lastRegisteredBot = null;

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ РЕГИСТРОНЕЗАВИСИМОГО ПОИСКА ===

function getCanonicalRefKey(username) {
    if (!username) return null;
    const trimmed = username.trim();
    return Object.keys(referalsDB).find(k => k.toLowerCase() === trimmed.toLowerCase()) || trimmed;
}

function getSponsorOf(username) {
    const canonical = getCanonicalRefKey(username);
    if (!canonical || !referalsDB[canonical]) return null;
    return referalsDB[canonical];
}

function resolveSponsor(inputSponsor) {
    if (!inputSponsor || !inputSponsor.trim()) {
        const l1 = Object.keys(referalsDB).find(k => k.toLowerCase() === 'leader_1');
        const l2 = Object.keys(referalsDB).find(k => k.toLowerCase() === 'leader_2');
        
        const l1Count = Object.values(referalsDB).filter(s => s && s.toLowerCase() === (l1 || 'leader_1').toLowerCase()).length;
        const l2Count = Object.values(referalsDB).filter(s => s && s.toLowerCase() === (l2 || 'leader_2').toLowerCase()).length;

        if (l1Count <= l2Count) return l1 || 'LEADER_1';
        return l2 || 'LEADER_2';
    }

    const trimmed = inputSponsor.trim();
    const exist = Object.keys(referalsDB).find(k => k.toLowerCase() === trimmed.toLowerCase());
    return exist || trimmed;
}

function getCalculatedLevel(username) {
    let level = 1;
    let current = username;
    let visited = new Set();
    
    while (current && current.toUpperCase() !== 'SYSTEM_ROOT' && !visited.has(current.toLowerCase())) {
        visited.add(current.toLowerCase());
        let sponsor = getSponsorOf(current);
        if (!sponsor) break;
        current = sponsor;
        level++;
    }
    return level;
}

// Стартовое состояние активных матриц
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
let activeMatricesList = ['A1']; // Список верхушек активных матриц

/**
 * Алгоритм поиска свободной ячейки и деления матриц
 */
function findNextEmptyCell(tree) {
    const orderABC = ['C1', 'C2', 'C3', 'C4'];
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

/**
 * Проверка и вызов деления при заполнении нижнего ряда из 4 ячеек.
 */
function checkAndSplitMatrix(cellId) {
    const gIdx = cellIdToGlobalIndex(cellId);
    const parentGIdx = Math.floor((gIdx - 1) / 2);
    const topGIdx = Math.floor((parentGIdx - 1) / 2);

    const b1G = topGIdx * 2 + 1;
    const b2G = topGIdx * 2 + 2;
    const c1G = b1G * 2 + 1;
    const c2G = b1G * 2 + 2;
    const c3G = b2G * 2 + 1;
    const c4G = b2G * 2 + 2;

    const getCellByGIdx = (g) => {
        let levelIndex = 0;
        while ((1 << (levelIndex + 1)) - 1 <= g) levelIndex++;
        const levelStart = (1 << levelIndex) - 1;
        const num = (g - levelStart) + 1;
        const letter = getLevelLetter(levelIndex);
        return treeDB[`${letter}${num}`];
    };

    const c1 = getCellByGIdx(c1G);
    const c2 = getCellByGIdx(c2G);
    const c3 = getCellByGIdx(c3G);
    const c4 = getCellByGIdx(c4G);

    if (c1 && c1.user && c2 && c2.user && c3 && c3.user && c4 && c4.user) {
        const topCell = getCellByGIdx(topGIdx);
        const b1Cell = getCellByGIdx(b1G);
        const b2Cell = getCellByGIdx(b2G);

        if (topCell && topCell.user) {
            const topUserKey = Object.keys(shopUsersDB).find(k => k.toLowerCase() === topCell.user.toLowerCase()) || topCell.user;
            if (!shopUsersDB[topUserKey]) {
                shopUsersDB[topUserKey] = createNewUserCard(topUserKey);
            }
            shopUsersDB[topUserKey].matrixPosition.status = 'payout_pending';
            shopUsersDB[topUserKey].cashbackAvailable = true;
            shopUsersDB[topUserKey].cashbackAmount = 1000;
        }

        if (topCell && topCell.id) {
            activeMatricesList = activeMatricesList.filter(id => id !== topCell.id);
        }
        if (b1Cell && b1Cell.id) activeMatricesList.push(b1Cell.id);
        if (b2Cell && b2Cell.id) activeMatricesList.push(b2Cell.id);
    }
}

// Вспомогательная логика автогенерации робота
function addRobotLog(text) {
    robotLogs.push(text);
    if (robotLogs.length > 200) robotLogs.shift();
}

function processAutoBotStep() {
    if (!robotRunning) return;
    const randId = Math.floor(1000 + Math.random() * 9000);
    const botName = `Bot_${randId}`;
    
    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = botName;
    referalsDB[botName] = resolveSponsor(null);
    
    shopUsersDB[botName] = createNewUserCard(botName);
    shopUsersDB[botName].isPaid = true;
    shopUsersDB[botName].matrixPosition.currentCellId = cellId;
    shopUsersDB[botName].matrixPosition.status = 'active';

    checkAndSplitMatrix(cellId);
    addRobotLog(`🤖 Автобот ${botName} активирован и встал в ячейку ${cellId}`);
}

// ================= API =================

// Управление роботом
app.get('/api/robot/status', (req, res) => {
    res.json({ running: robotRunning });
});

app.get('/api/robot/logs', (req, res) => {
    res.json({ logs: robotLogs });
});

app.post('/api/robot/start', (req, res) => {
    if (!robotRunning) {
        robotRunning = true;
        addRobotLog("🟢 Робот успешно запущен сервером.");
        if (!robotTimer) {
            robotTimer = setInterval(processAutoBotStep, 2500);
        }
    }
    res.json({ success: true, running: robotRunning });
});

app.post('/api/robot/stop', (req, res) => {
    if (robotRunning) {
        robotRunning = false;
        if (robotTimer) {
            clearInterval(robotTimer);
            robotTimer = null;
        }
        addRobotLog("🔴 Робот остановлен по команде.");
    }
    res.json({ success: true, running: robotRunning });
});

app.get('/api/tree', (req, res) => {
    res.json({
        ...treeDB,
        activeMatrices: activeMatricesList
    });
});

app.post('/api/register', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    
    const trimmedUser = username.trim();
    const canonicalSponsor = resolveSponsor(sponsor);
    
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === trimmedUser.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Пользователь уже занял место' });

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = trimmedUser;
    
    referalsDB[trimmedUser] = canonicalSponsor;
    
    const shopKey = Object.keys(shopUsersDB).find(k => k.toLowerCase() === trimmedUser.toLowerCase()) || trimmedUser;
    if (!shopUsersDB[shopKey]) {
        shopUsersDB[shopKey] = createNewUserCard(trimmedUser);
    }
    shopUsersDB[shopKey].isPaid = true;
    shopUsersDB[shopKey].matrixPosition.currentCellId = cellId;
    shopUsersDB[shopKey].matrixPosition.status = 'active';
    
    checkAndSplitMatrix(cellId);
    res.json({ success: true, cellId, user: trimmedUser });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    activeMatricesList = ['A1'];
    shopUsersDB = {};
    wallets = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;
    robotRunning = false;
    if (robotTimer) {
        clearInterval(robotTimer);
        robotTimer = null;
    }
    robotLogs = ["Логи очищены сервером."];
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
    let currentSponsor = getSponsorOf(canonicalName) || 'SYSTEM_ROOT';
    let visited = new Set();
    
    while (currentSponsor && !visited.has(currentSponsor.toLowerCase())) {
        visited.add(currentSponsor.toLowerCase());
        sponsorChain.push(currentSponsor);
        currentSponsor = getSponsorOf(currentSponsor);
    }
    
    let shopKey = Object.keys(shopUsersDB).find(k => k.toLowerCase() === canonicalName.toLowerCase());
    if (!shopKey) {
        shopUsersDB[canonicalName] = createNewUserCard(canonicalName);
        shopKey = canonicalName;
    }
    if (userCells.length > 0) {
        shopUsersDB[shopKey].isPaid = true;
        shopUsersDB[shopKey].matrixPosition.currentCellId = userCells[0];
        shopUsersDB[shopKey].matrixPosition.status = 'active';
    }

    const searchQuery = (req.query.search || '').trim().toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 30;

    const allReferrals = Object.keys(referalsDB).filter(user => {
        const parent = referalsDB[user];
        return parent && parent.toLowerCase() === canonicalName.toLowerCase();
    });

    const filteredReferrals = searchQuery
        ? allReferrals.filter(ref => ref.toLowerCase().includes(searchQuery))
        : allReferrals;

    const startIndex = (page - 1) * limit;
    const paginatedReferrals = filteredReferrals.slice(startIndex, startIndex + limit);

    res.json({
        success: true,
        username: canonicalName,
        cells: userCells,
        sponsor: getSponsorOf(canonicalName) || 'SYSTEM_ROOT',
        chain: sponsorChain,
        profile: shopUsersDB[shopKey],
        referralsData: {
            totalCount: allReferrals.length,
            filteredCount: filteredReferrals.length,
            currentPage: page,
            hasMore: startIndex + limit < filteredReferrals.length,
            list: paginatedReferrals
        }
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
            if (!childrenMap[canonicalSponsor].includes(user)) {
                childrenMap[canonicalSponsor].push(user);
            }
        }
    });

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

    // Обязательно гарантируем наличие записи SYSTEM_ROOT
    if (!structure['SYSTEM_ROOT']) {
        structure['SYSTEM_ROOT'] = {
            id: 'SYSTEM_ROOT',
            login: 'SYSTEM_ROOT',
            parentId: null,
            level: 1,
            isExpanded: true,
            children: childrenMap['SYSTEM_ROOT'] || []
        };
    }

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

    while (current && !visited.has(current.toLowerCase())) {
        visited.add(current.toLowerCase());
        chain.push(current);
        current = getSponsorOf(current);
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
        const shopKey = Object.keys(shopUsersDB).find(k => k.toLowerCase() === trimmedUser.toLowerCase()) || trimmedUser;
        return res.json({ success: true, shopUserStatus: shopUsersDB[shopKey] || createNewUserCard(trimmedUser) });
    }
    
    const shopKey = Object.keys(shopUsersDB).find(k => k.toLowerCase() === trimmedUser.toLowerCase()) || trimmedUser;
    if (!shopUsersDB[shopKey]) {
        shopUsersDB[shopKey] = createNewUserCard(trimmedUser);
    }
    
    const chosenSponsor = resolveSponsor(sponsor);

    referalsDB[trimmedUser] = chosenSponsor;
    lastRegisteredBot = trimmedUser; 

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = trimmedUser;
    
    shopUsersDB[shopKey].isPaid = true;
    shopUsersDB[shopKey].matrixPosition.currentCellId = cellId;
    shopUsersDB[shopKey].matrixPosition.status = 'active';
    
    checkAndSplitMatrix(cellId);
    addRobotLog(`Регистрация: ${trimmedUser} (спонсор: ${chosenSponsor}) -> ячейка ${cellId}`);
    res.json({ success: true, shopUserStatus: shopUsersDB[shopKey], cellId });
});

app.post('/api/shop/pay', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) 
                        || Object.keys(referalsDB).find(k => k.toLowerCase() === username.trim().toLowerCase())
                        || username.trim();
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === canonicalName.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Пользователь уже занял место' });

    const TOTAL_MITRONS = 1000;
    const SUPPLIER_COST = 450;
    const MATRIX_RESERVE = 250;
    const REFERRAL_RESERVE = 70;
    const ADMIN_PROFIT = 230;

    if (!shopUsersDB[canonicalName]) {
        shopUsersDB[canonicalName] = createNewUserCard(canonicalName);
    }

    const chosenSponsor = resolveSponsor(sponsor);

    referalsDB[canonicalName] = chosenSponsor;

    const now = new Date();
    const releaseDate = new Date(now.getTime() + (31 * 24 * 60 * 60 * 1000));

    shopUsersDB[canonicalName].isPaid = true;
    shopUsersDB[canonicalName].paymentDate = now.toISOString();
    shopUsersDB[canonicalName].balances.mitrons += TOTAL_MITRONS;
    shopUsersDB[canonicalName].balances.usd = parseFloat(mitronsToUsd(shopUsersDB[canonicalName].balances.mitrons));

    wallets.adminWallet.balanceMitrons += ADMIN_PROFIT;
    wallets.daoWallet.balanceMitrons += MATRIX_RESERVE;

    if (!wallets.referralHold) wallets.referralHold = [];
    wallets.referralHold.push({
        buyer: canonicalName,
        sponsor: chosenSponsor,
        totalHold: REFERRAL_RESERVE,
        createdAt: now.toISOString(),
        unlockAt: releaseDate.toISOString(),
        status: 'pending_31_days'
    });

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalName;
    
    shopUsersDB[canonicalName].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalName].matrixPosition.status = 'active';

    checkAndSplitMatrix(cellId);
    addRobotLog(`💰 Оплата: ${canonicalName} -> место ${cellId}`);

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[canonicalName],
        cellId,
        split: {
            totalMitrons: TOTAL_MITRONS,
            supplierCost: SUPPLIER_COST,
            matrixReserve: MATRIX_RESERVE,
            referralReserve: REFERRAL_RESERVE,
            adminProfit: ADMIN_PROFIT,
            holdDays: 31,
            unlockAt: releaseDate.toISOString()
        }
    });
});

app.post('/api/admin/delete-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    const targetKey = Object.keys(referalsDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) || username.trim();

    delete shopUsersDB[targetKey];
    delete referalsDB[targetKey];
    
    Object.keys(treeDB).forEach(cellId => {
        if (treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === targetKey.toLowerCase()) {
            treeDB[cellId].user = null;
        }
    });
    
    res.json({ success: true });
});

app.get('/api/sys-wallets', (req, res) => {
    res.json({ success: true, wallets });
});

// Возврат HTML страниц для любых остальных маршрутов
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
