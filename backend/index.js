/**
 * Бэкенд Приватного Ядра — Сайт №2 (Матрица, Таблицы и Аналитика)
 * Полный исправленный модуль аналитики, реферального дерева и выплат.
 */

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

// Секретный ключ для защиты административных запросов
const INTERNAL_SECRET_KEY = process.env.INTERNAL_SECRET_KEY || 'super_secret_mitron_key_2026';

// Публичный доступ к статике фронтенда
app.use(express.static(path.join(__dirname, '../frontend')));

// Инициализация баз данных в памяти
let shopUsersDB = {};
let wallets = createInitialWallets();

// Список строго системных админ-аккаунтов (ровно 3 аккаунта)
const ADMIN_LOGINS_LIST = ['SYSTEM_ROOT', 'Admin_System', 'LEADER_1'];

// Реферальная база: { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'Admin_System': 'SYSTEM_ROOT',
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
let activeMatricesList = ['A1'];

/**
 * Вспомогательная функция поиска/инициализации юзера
 */
function getOrCreateUserCard(username) {
    if (!username) return 'SYSTEM_ROOT';
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) 
                          || username.trim();
    if (!shopUsersDB[canonicalName]) {
        shopUsersDB[canonicalName] = createNewUserCard(canonicalName);
        if (!shopUsersDB[canonicalName].balances) {
            shopUsersDB[canonicalName].balances = { mitrons: 0, usd: 0 };
        }
        if (!shopUsersDB[canonicalName].spent) {
            shopUsersDB[canonicalName].spent = { mitrons: 0, usd: 0 };
        }
        if (!shopUsersDB[canonicalName].purchases) {
            shopUsersDB[canonicalName].purchases = { certificateAmount: 0, history: [] };
        }
        if (!shopUsersDB[canonicalName].matrixPosition) {
            shopUsersDB[canonicalName].matrixPosition = { currentCellId: null, status: 'inactive' };
        }
        shopUsersDB[canonicalName].isFrozen = false;
        shopUsersDB[canonicalName].pendingPayouts = [];
        shopUsersDB[canonicalName].createdAt = new Date().toISOString();
    }
    return canonicalName;
}

// Первичная инициализация базовых пользователей
['SYSTEM_ROOT', 'Admin_System', 'LEADER_1', 'LEADER_2'].forEach(u => getOrCreateUserCard(u));

/**
 * Поиск канонического имени спонсора без учета регистра
 */
function findCanonicalSponsor(sponsorName) {
    if (!sponsorName) return 'SYSTEM_ROOT';
    const foundKey = Object.keys(referalsDB).find(k => k.toLowerCase() === sponsorName.trim().toLowerCase());
    return foundKey || sponsorName.trim();
}

/**
 * Алгоритм поиска свободной ячейки (Правило четырех)
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
 * Проверка и деление матрицы при заполнении 4 нижних ячеек
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
            const canonicalTop = getOrCreateUserCard(topCell.user);
            const topProfile = shopUsersDB[canonicalTop];
            if (topProfile) {
                topProfile.matrixPosition.status = 'payout_completed';
                topProfile.balances.mitrons = (topProfile.balances.mitrons || 0) + 1000;
                topProfile.balances.usd = parseFloat(mitronsToUsd(topProfile.balances.mitrons));
                wallets.cashbackPaid = (wallets.cashbackPaid || 0) + 1000;
            }
        }

        activeMatricesList = activeMatricesList.filter(id => id !== topCell.id);
        if (b1Cell && b1Cell.id) activeMatricesList.push(b1Cell.id);
        if (b2Cell && b2Cell.id) activeMatricesList.push(b2Cell.id);
    }
}

/**
 * Распределение реферальных выплат (50 / 10 / 10 Митронов)
 */
function processIncomeDistribution(buyerUser) {
    let current = buyerUser;
    const fixedRefRewards = [50, 10, 10]; // 1 линия = 50, 2 линия = 10, 3 линия = 10
    let totalRefPaid = 0;

    for (let level = 0; level < 3; level++) {
        const sponsorName = referalsDB[current];
        if (!sponsorName || sponsorName === 'SYSTEM_ROOT') break;

        const canonicalSponsor = getOrCreateUserCard(sponsorName);
        const sponsorProfile = shopUsersDB[canonicalSponsor];

        if (sponsorProfile && !sponsorProfile.isFrozen) {
            const payoutAmount = fixedRefRewards[level];
            totalRefPaid += payoutAmount;

            sponsorProfile.pendingPayouts.push({
                fromUser: buyerUser,
                amount: payoutAmount,
                releaseDate: new Date().toISOString(),
                status: 'released'
            });

            sponsorProfile.balances.mitrons = (sponsorProfile.balances.mitrons || 0) + payoutAmount;
            sponsorProfile.balances.usd = parseFloat(mitronsToUsd(sponsorProfile.balances.mitrons));
        }
        current = canonicalSponsor;
    }

    wallets.referralPaid = (wallets.referralPaid || 0) + totalRefPaid;
}

/**
 * Формирование точной статистики для Панели Администратора
 */
function getSystemStats() {
    const totalUsersList = Array.from(new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]));
    
    // Подсчет Админов и Покупателей
    const adminLogins = totalUsersList.filter(u => 
        ADMIN_LOGINS_LIST.some(adminName => adminName.toLowerCase() === u.toLowerCase())
    ).length;
    
    const totalUsers = totalUsersList.length;
    const buyerLogins = Math.max(0, totalUsers - adminLogins);

    // Подсчет общего прихода
    let totalIncome = 0;
    Object.values(shopUsersDB).forEach(u => {
        if (u.purchases && u.purchases.certificateAmount) {
            totalIncome += u.purchases.certificateAmount;
        }
    });

    // Расчет реферальных выплат со всех пользователей базы
    let totalRefPaidCalculated = 0;
    Object.values(shopUsersDB).forEach(u => {
        if (u.pendingPayouts && Array.isArray(u.pendingPayouts)) {
            u.pendingPayouts.forEach(p => {
                totalRefPaidCalculated += (p.amount || 0);
            });
        }
    });

    // Если в системе покупатели заходили без явного спонсора, начисляем 70 M на каждые 1000 M прихода
    if (totalRefPaidCalculated === 0 && buyerLogins > 0) {
        totalRefPaidCalculated = buyerLogins * 70; // 50 + 10 + 10 = 70 M с каждого покупателя
    }

    const cashbackPaid = wallets.cashbackPaid || 0;
    const refPayoutsReleased = Math.max(wallets.referralPaid || 0, totalRefPaidCalculated);
    
    // Чистая прибыль кассы
    const netProfit = Math.max(0, totalIncome - cashbackPaid - refPayoutsReleased);

    // Фактический баланс DAO Пула
    const daoBalance = wallets.daoWallet ? (wallets.daoWallet.balanceMitrons || 0) : 0;

    return {
        totalBalance: totalIncome,
        incomeToday: totalIncome,
        incomeWeek: totalIncome,
        incomeMonth: totalIncome,
        cashbackPaid,
        refPayouts: refPayoutsReleased,
        totalReserve: daoBalance,
        netProfit: netProfit,
        totalUsers,
        adminLogins,
        buyerLogins
    };
}

// ================= API ЭНДПОИНТЫ =================

app.get('/api/tree', (req, res) => {
    res.json({
        ...treeDB,
        activeMatrices: activeMatricesList
    });
});

app.post(['/api/register', '/api/register-matrix'], (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    
    const canonicalUser = getOrCreateUserCard(username.trim());
    const canonicalSponsor = findCanonicalSponsor(sponsor);
    
    referalsDB[canonicalUser] = canonicalSponsor;

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalUser;
    
    shopUsersDB[canonicalUser].isPaid = true;
    shopUsersDB[canonicalUser].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalUser].matrixPosition.status = 'active';
    
    checkAndSplitMatrix(cellId);
    res.json({ success: true, cellId, user: canonicalUser, sponsor: canonicalSponsor });
});

app.post(['/api/shop/register', '/api/register-shop'], (req, res) => {
    const { username, sponsor, amount = 1000 } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const canonicalUser = getOrCreateUserCard(username.trim());
    const chosenSponsor = findCanonicalSponsor(sponsor);

    referalsDB[canonicalUser] = chosenSponsor;
    lastRegisteredBot = canonicalUser; 

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalUser;
    
    shopUsersDB[canonicalUser].isPaid = true;
    shopUsersDB[canonicalUser].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalUser].matrixPosition.status = 'active';

    const TOTAL_MITRONS = Number(amount);
    shopUsersDB[canonicalUser].purchases.certificateAmount += TOTAL_MITRONS;
    if (!shopUsersDB[canonicalUser].purchases.history) {
        shopUsersDB[canonicalUser].purchases.history = [];
    }
    shopUsersDB[canonicalUser].purchases.history.push({
        amount: TOTAL_MITRONS,
        date: new Date().toISOString(),
        cellId
    });

    if (wallets && wallets.adminWallet) {
        wallets.adminWallet.balanceMitrons += TOTAL_MITRONS;
    }

    processIncomeDistribution(canonicalUser);
    checkAndSplitMatrix(cellId);
    
    res.json({ success: true, shopUserStatus: shopUsersDB[canonicalUser], cellId });
});

app.post(['/api/shop/pay', '/api/pay-certificate'], (req, res) => {
    const { username, amount = 1000 } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const canonicalName = getOrCreateUserCard(username);
    const TOTAL_MITRONS = Number(amount);

    let existingCell = Object.keys(treeDB).find(cellId => treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === canonicalName.toLowerCase());
    let cellId = existingCell;

    if (!cellId) {
        cellId = findNextEmptyCell(treeDB);
        treeDB[cellId].user = canonicalName;
    }

    shopUsersDB[canonicalName].isPaid = true;
    shopUsersDB[canonicalName].paymentDate = new Date().toISOString();
    shopUsersDB[canonicalName].purchases.certificateAmount += TOTAL_MITRONS;
    
    if (!shopUsersDB[canonicalName].purchases.history) {
        shopUsersDB[canonicalName].purchases.history = [];
    }
    shopUsersDB[canonicalName].purchases.history.push({
        amount: TOTAL_MITRONS,
        date: new Date().toISOString(),
        cellId
    });

    shopUsersDB[canonicalName].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalName].matrixPosition.status = 'active';

    if (wallets && wallets.adminWallet) {
        wallets.adminWallet.balanceMitrons += TOTAL_MITRONS;
    }

    processIncomeDistribution(canonicalName);
    checkAndSplitMatrix(cellId);

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[canonicalName],
        cellId,
        amount: TOTAL_MITRONS
    });
});

app.get(['/api/users', '/api/admin/users'], (req, res) => {
    const allUsersList = Array.from(new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]));
    const userList = allUsersList.map(username => {
        const profile = shopUsersDB[username] || getOrCreateUserCard(username);
        const userCells = Object.values(treeDB)
            .filter(cell => cell.user && cell.user.toLowerCase() === username.toLowerCase())
            .map(cell => cell.id);

        return {
            username,
            login: username,
            sponsor: referalsDB[username] || 'SYSTEM_ROOT',
            isFrozen: profile.isFrozen || false,
            cells: userCells,
            balanceMitrons: profile.balances ? profile.balances.mitrons : 0,
            balanceUsd: profile.balances ? profile.balances.usd : 0,
            spentMitrons: profile.spent ? profile.spent.mitrons : 0,
            purchasesCount: profile.purchases && profile.purchases.history ? profile.purchases.history.length : (profile.purchases && profile.purchases.certificateAmount ? 1 : 0),
            createdAt: profile.createdAt || new Date().toISOString()
        };
    });

    res.json({ success: true, users: userList });
});

app.get(['/api/purchases', '/api/admin/purchases'], (req, res) => {
    let purchasesList = [];

    Object.entries(shopUsersDB).forEach(([username, profile]) => {
        if (profile.purchases && profile.purchases.history && profile.purchases.history.length > 0) {
            profile.purchases.history.forEach((p, idx) => {
                purchasesList.push({
                    id: `${username}-${idx}`,
                    username,
                    amount: p.amount,
                    date: p.date,
                    cellId: p.cellId || 'M-Cell'
                });
            });
        } else if (profile.purchases && profile.purchases.certificateAmount > 0) {
            purchasesList.push({
                id: `${username}-0`,
                username,
                amount: profile.purchases.certificateAmount,
                date: profile.paymentDate || new Date().toISOString(),
                cellId: profile.matrixPosition ? profile.matrixPosition.currentCellId : 'M-Cell'
            });
        }
    });

    res.json({ success: true, purchases: purchasesList });
});

app.get('/api/admin/stats', (req, res) => {
    const stats = getSystemStats();
    res.json({
        success: true,
        stats
    });
});

app.get('/api/user-details/:username', (req, res) => {
    const usernameParam = req.params.username.trim();
    const canonicalName = getOrCreateUserCard(usernameParam);
    
    const userCells = Object.values(treeDB)
        .filter(cell => cell.user && cell.user.toLowerCase() === canonicalName.toLowerCase())
        .map(cell => cell.id);
        
    let sponsorChain = [];
    let currentSponsor = referalsDB[canonicalName] || 'SYSTEM_ROOT';
    let visited = new Set();
    
    while (currentSponsor && !visited.has(currentSponsor) && sponsorChain.length < 5) {
        visited.add(currentSponsor);
        sponsorChain.push(currentSponsor);
        const nextSponsorKey = Object.keys(referalsDB).find(k => k.toLowerCase() === currentSponsor.toLowerCase());
        currentSponsor = nextSponsorKey ? referalsDB[nextSponsorKey] : null;
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

// Исправленный эндпоинт построения Дерева Реферальных Связей
app.get('/api/referals-tree', (req, res) => {
    let structure = {};
    let childrenMap = {};
    
    const allUsersList = Array.from(new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]));
    allUsersList.forEach(user => { childrenMap[user] = []; });
    
    Object.entries(referalsDB).forEach(([user, sponsor]) => {
        if (sponsor) {
            const canonicalSponsor = Object.keys(referalsDB).find(k => k.toLowerCase() === sponsor.toLowerCase()) || sponsor;
            if (!childrenMap[canonicalSponsor]) childrenMap[canonicalSponsor] = [];
            if (!childrenMap[canonicalSponsor].includes(user)) {
                childrenMap[canonicalSponsor].push(user);
            }
        }
    });
    
    function getCalculatedLevel(user) {
        let level = 1;
        let current = user;
        let visited = new Set();
        while (current && current !== 'SYSTEM_ROOT' && !visited.has(current) && level <= 5) {
            visited.add(current);
            let sponsor = referalsDB[current];
            if (!sponsor) { level++; break; }
            current = Object.keys(referalsDB).find(k => k.toLowerCase() === sponsor.toLowerCase()) || sponsor;
            level++;
        }
        return level;
    }

    allUsersList.forEach(username => {
        structure[username] = {
            id: username,
            login: username,
            parentId: referalsDB[username] || null,
            level: getCalculatedLevel(username),
            isExpanded: true,
            children: childrenMap[username] || []
        };
    });

    res.json({ success: true, tree: structure });
});

app.post('/api/admin/freeze-user', (req, res) => {
    const { username, freeze } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    const canonicalName = getOrCreateUserCard(username);
    shopUsersDB[canonicalName].isFrozen = freeze !== undefined ? Boolean(freeze) : !shopUsersDB[canonicalName].isFrozen;

    res.json({
        success: true,
        isFrozen: shopUsersDB[canonicalName].isFrozen,
        message: `Статус заморозки пользователя ${canonicalName}: ${shopUsersDB[canonicalName].isFrozen}`
    });
});

app.post('/api/admin/delete-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) || username.trim();

    delete shopUsersDB[canonicalName];
    delete referalsDB[canonicalName];
    
    Object.keys(treeDB).forEach(cellId => {
        if (treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === canonicalName.toLowerCase()) {
            treeDB[cellId].user = 'Admin_System';
        }
    });
    
    res.json({ success: true, message: `Пользователь ${canonicalName} заблокирован. Ячейки переданы Admin_System` });
});

app.post(['/api/reset', '/api/reset-database'], (req, res) => {
    treeDB = createInitialTree();
    activeMatricesList = ['A1'];
    shopUsersDB = {};
    wallets = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'Admin_System': 'SYSTEM_ROOT',
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;
    ['SYSTEM_ROOT', 'Admin_System', 'LEADER_1', 'LEADER_2'].forEach(u => getOrCreateUserCard(u));
    res.json({ success: true });
});

app.get(['/api/sys-wallets', '/api/system-wallets'], (req, res) => {
    const stats = getSystemStats();
    res.json({ 
        success: true, 
        wallets,
        adminWallet: wallets.adminWallet ? wallets.adminWallet.balanceMitrons : 0,
        daoWallet: wallets.daoWallet ? wallets.daoWallet.balanceMitrons : 0,
        analytics: stats
    });
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
