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
 * При делении матрицы верхний логин получает право на 100% Кешбэк (1000 M).
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
            if (!shopUsersDB[topCell.user]) {
                shopUsersDB[topCell.user] = createNewUserCard(topCell.user);
            }
            // Включение индикатора кешбэка при делении
            shopUsersDB[topCell.user].matrixPosition.status = 'payout_pending';
            shopUsersDB[topCell.user].cashbackAvailable = true;
            shopUsersDB[topCell.user].cashbackAmount = 1000;
        }

        activeMatricesList = activeMatricesList.filter(id => id !== topCell.id);
        if (b1Cell && b1Cell.id) activeMatricesList.push(b1Cell.id);
        if (b2Cell && b2Cell.id) activeMatricesList.push(b2Cell.id);
    }
}

// ================= API =================

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
    
    let canonicalSponsor = sponsor ? sponsor.trim() : null;
    if (!canonicalSponsor) {
        const allUsers = Object.keys(referalsDB);
        canonicalSponsor = allUsers[Math.floor(Math.random() * allUsers.length)] || 'SYSTEM_ROOT';
    }
    
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
        sponsor: referalsDB[canonicalName] || 'SYSTEM_ROOT',
        chain: sponsorChain,
        profile: shopUsersDB[canonicalName],
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
    
    let chosenSponsor = sponsor ? sponsor.trim() : null;
    if (!chosenSponsor) {
        const availableSponsors = Object.keys(referalsDB);
        chosenSponsor = availableSponsors[Math.floor(Math.random() * availableSponsors.length)] || 'SYSTEM_ROOT';
    }

    referalsDB[trimmedUser] = chosenSponsor;
    lastRegisteredBot = trimmedUser; 

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = trimmedUser;
    
    shopUsersDB[trimmedUser].isPaid = true;
    shopUsersDB[trimmedUser].matrixPosition.currentCellId = cellId;
    shopUsersDB[trimmedUser].matrixPosition.status = 'active';
    
    checkAndSplitMatrix(cellId);
    res.json({ success: true, shopUserStatus: shopUsersDB[trimmedUser], cellId });
});

/**
 * Оплата заказа на 1000 M с финансовым сплитом и 31-дневным таймером
 */
app.post('/api/shop/pay', (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) || username.trim();
    const isExist = Object.values(treeDB).some(cell => cell.user && cell.user.toLowerCase() === canonicalName.toLowerCase());
    if (isExist) return res.status(400).json({ error: 'Пользователь уже занял место' });

    // Точная финансовая математика
    const TOTAL_MITRONS = 1000;
    const SUPPLIER_COST = 450;     // Поставщик (45%)
    const MATRIX_RESERVE = 250;    // Матрица (25%)
    const REFERRAL_RESERVE = 70;   // Резерв 50/10/10 M на 31 день
    const ADMIN_PROFIT = 230;      // Чистый доход админа (23%)

    if (!shopUsersDB[canonicalName]) {
        shopUsersDB[canonicalName] = createNewUserCard(canonicalName);
    }

    let chosenSponsor = sponsor ? sponsor.trim() : (referalsDB[canonicalName] || 'SYSTEM_ROOT');
    referalsDB[canonicalName] = chosenSponsor;

    const now = new Date();
    const releaseDate = new Date(now.getTime() + (31 * 24 * 60 * 60 * 1000)); // +31 день

    shopUsersDB[canonicalName].isPaid = true;
    shopUsersDB[canonicalName].paymentDate = now.toISOString();
    shopUsersDB[canonicalName].balances.mitrons += TOTAL_MITRONS;
    shopUsersDB[canonicalName].balances.usd = parseFloat(mitronsToUsd(shopUsersDB[canonicalName].balances.mitrons));

    // Начисление средств на системные кошельки
    wallets.adminWallet.balanceMitrons += ADMIN_PROFIT;
    wallets.daoWallet.balanceMitrons += MATRIX_RESERVE;

    // Резервация реферальных выплат на 31 день
    if (!wallets.referralHold) wallets.referralHold = [];
    wallets.referralHold.push({
        buyer: canonicalName,
        sponsor: chosenSponsor,
        totalHold: REFERRAL_RESERVE, // 70 M (50M, 10M, 10M)
        createdAt: now.toISOString(),
        unlockAt: releaseDate.toISOString(),
        status: 'pending_31_days'
    });

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalName;
    
    shopUsersDB[canonicalName].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalName].matrixPosition.status = 'active';

    checkAndSplitMatrix(cellId);

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
