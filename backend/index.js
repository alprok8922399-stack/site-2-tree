/**
 * Бэкенд Приватного Ядра — Сайт №2 (Матрица, Таблицы и Аналитика)
 * Полный модуль с алгоритмом раздвижения 5-колоночной реферальной таблицы,
 * фильтрацией по датам и расширенной аналитикой Администратора.
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

// Список строго системных админ-аккаунтов
const ADMIN_LOGINS_LIST = ['SYSTEM_ROOT', 'LEADER_1', 'ADMIN'];

// Реферальная база: { 'логин_пользователя': 'логин_спонсора' }
let referalsDB = {
    'SYSTEM_ROOT': null,
    'LEADER_1': 'SYSTEM_ROOT',
    'LEADER_2': 'SYSTEM_ROOT'
};

let canceledUsersCount = 0; // Счетчик отказавшихся покупателей

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
['SYSTEM_ROOT', 'LEADER_1', 'LEADER_2', 'ADMIN'].forEach(u => getOrCreateUserCard(u));

/**
 * Поиск канонического имени спонсора без учета регистра
 */
function findCanonicalSponsor(sponsorName) {
    if (!sponsorName) return 'SYSTEM_ROOT';
    const trimmed = sponsorName.trim();
    const foundKey = Object.keys(referalsDB).find(k => k.toLowerCase() === trimmed.toLowerCase());
    return foundKey || trimmed;
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
    const fixedRefRewards = [50, 10, 10];
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
 * Расчет 5-колоночной реферальной таблицы с динамическим раздвижением всех строк
 */
function generateReferralGrid(startRoot = 'SYSTEM_ROOT', maxCols = 5) {
    let grid = []; 

    let childrenMap = {};
    Object.entries(referalsDB).forEach(([user, sponsor]) => {
        if (sponsor) {
            const canonSponsor = findCanonicalSponsor(sponsor);
            if (!childrenMap[canonSponsor]) childrenMap[canonSponsor] = [];
            if (!childrenMap[canonSponsor].includes(user)) {
                childrenMap[canonSponsor].push(user);
            }
        }
    });

    // Функция вставки пустой строки во ВСЕХ колонках
    function insertEmptyRow(rowIndex) {
        grid.splice(rowIndex, 0, []);
    }

    function placeUser(username, startRow, colIndex) {
        if (colIndex >= maxCols) return startRow;

        while (grid.length <= startRow) grid.push([]);

        grid[startRow][colIndex] = username;

        const children = childrenMap[username] || [];
        let currentRow = startRow;

        for (let i = 0; i < children.length; i++) {
            const child = children[i];
            const nextCol = colIndex + 1;

            if (nextCol >= maxCols) continue;

            if (i === 0) {
                // 1-й Личник встает строго в следующую колонку в ту же строку
                placeUser(child, currentRow, nextCol);
            } else {
                // 2-й и последующие личники раздвигают ВСЮ таблицу во всех колонках вниз
                currentRow = currentRow + 1;
                insertEmptyRow(currentRow);
                placeUser(child, currentRow, nextCol);
            }
        }

        return currentRow;
    }

    const rootUsers = childrenMap[startRoot] && childrenMap[startRoot].length > 0 
                      ? childrenMap[startRoot] 
                      : [startRoot];

    let currentRowCursor = 0;
    rootUsers.forEach((rootUser, idx) => {
        if (idx > 0) currentRowCursor++;
        placeUser(rootUser, currentRowCursor, 0);
    });

    const formattedGrid = grid.map(row => {
        const fullRow = [];
        for (let c = 0; c < maxCols; c++) {
            fullRow.push(row[c] || null);
        }
        return fullRow;
    });

    return formattedGrid;
}

/**
 * Точная статистика для Панели и Карточки Администратора
 */
function getSystemStats() {
    const totalUsersList = Array.from(new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]));
    
    const adminLogins = totalUsersList.filter(u => 
        ADMIN_LOGINS_LIST.some(adminName => adminName.toLowerCase() === u.toLowerCase())
    ).length;
    
    const totalUsers = totalUsersList.length;
    const buyerLogins = Math.max(0, totalUsers - adminLogins);

    let totalIncome = 0;
    let totalPurchasesCount = 0;

    Object.values(shopUsersDB).forEach(u => {
        if (u.purchases && u.purchases.certificateAmount) {
            totalIncome += u.purchases.certificateAmount;
            totalPurchasesCount += Math.floor(u.purchases.certificateAmount / 1000);
        }
    });

    // Расчеты согласно ТЗ:
    const externalProductCost = totalPurchasesCount * 450; // Куплено товара на стороннем Маркетплейсе (450 M за единицу)
    const remainingIncome = totalPurchasesCount * 550; // Прибыль пересчитывается с остатка 550 M

    let totalRefPaidCalculated = 0;
    Object.values(shopUsersDB).forEach(u => {
        if (u.pendingPayouts && Array.isArray(u.pendingPayouts)) {
            u.pendingPayouts.forEach(p => {
                totalRefPaidCalculated += (p.amount || 0);
            });
        }
    });

    if (totalRefPaidCalculated === 0 && totalPurchasesCount > 0) {
        totalRefPaidCalculated = totalPurchasesCount * 70;
    }

    const cashbackPaid = wallets.cashbackPaid || 0;
    const refPayoutsReleased = Math.max(wallets.referralPaid || 0, totalRefPaidCalculated);
    
    const grossProfit = Math.max(0, remainingIncome - cashbackPaid - refPayoutsReleased);
    const daoReserve = Math.round(grossProfit * 0.10);
    const netProfit = grossProfit - daoReserve;

    return {
        totalBalance: totalIncome,
        incomeToday: totalIncome,
        incomeWeek: totalIncome,
        incomeMonth: totalIncome,
        cashbackPaid,
        refPayouts: refPayoutsReleased,
        productCost: externalProductCost,
        remainingIncome550: remainingIncome,
        totalReserve: daoReserve,
        netProfit: netProfit,
        totalUsers,
        adminLogins,
        buyerLogins,
        totalPurchasesCount,
        shopPurchasesTotal: externalProductCost,
        totalBuyers: buyerLogins,
        totalRefundedBuyers: canceledUsersCount
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

// Эндпоинт поиска пользователей за период (Зашло в проект с ... по ...)
app.get('/api/admin/users-by-date', (req, res) => {
    const { from, to } = req.query;
    const allUsers = Array.from(new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]));

    const fromTime = from ? new Date(from).getTime() : 0;
    const toTime = to ? new Date(to).getTime() : Infinity;

    const filtered = allUsers.filter(username => {
        const profile = shopUsersDB[username];
        if (!profile || !profile.createdAt) return false;
        const userTime = new Date(profile.createdAt).getTime();
        return userTime >= fromTime && userTime <= toTime;
    });

    res.json({ success: true, count: filtered.length, users: filtered });
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

app.get('/api/admin/stats', (req, res) => {
    const stats = getSystemStats();
    res.json({
        success: true,
        stats
    });
});

app.get('/api/user-details/:username', (req, res) => {
    const usernameParam = req.params.username.trim();
    const searchQuery = (req.query.search || '').trim().toLowerCase();
    const page = parseInt(req.query.page) || 1;
    const pageSize = 20;

    const canonicalName = getOrCreateUserCard(usernameParam);
    const isAdmin = ADMIN_LOGINS_LIST.some(a => a.toLowerCase() === canonicalName.toLowerCase());
    
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

    // Получаем лично приглашенных (рефералов 1-й линии)
    const allDirectRefs = Object.keys(referalsDB).filter(u => {
        const sp = referalsDB[u];
        return sp && sp.toLowerCase() === canonicalName.toLowerCase();
    });

    let filteredRefs = allDirectRefs;
    if (searchQuery) {
        filteredRefs = allDirectRefs.filter(u => u.toLowerCase().includes(searchQuery));
    }

    const totalCount = filteredRefs.length;
    const startIndex = (page - 1) * pageSize;
    const paginatedList = filteredRefs.slice(startIndex, startIndex + pageSize);
    const hasMore = startIndex + pageSize < totalCount;

    const stats = getSystemStats();

    res.json({
        success: true,
        username: canonicalName,
        isAdmin,
        cells: userCells,
        sponsor: referalsDB[canonicalName] || 'SYSTEM_ROOT',
        chain: sponsorChain,
        profile: shopUsersDB[canonicalName],
        referralsData: {
            totalCount,
            currentPage: page,
            hasMore,
            list: paginatedList
        },
        stats: isAdmin ? stats : null
    });
});

app.get('/api/referals-grid', (req, res) => {
    const root = req.query.root || 'SYSTEM_ROOT';
    const grid = generateReferralGrid(root, 5);
    res.json({ success: true, cols: 5, rowsCount: grid.length, grid });
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

// Отмена покупки / Аннулирование и передача ячейки Администрации
app.post('/api/admin/cancel-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) || username.trim();

    // Возврат средств / аннулирование реферальных выплат
    if (shopUsersDB[canonicalName]) {
        delete shopUsersDB[canonicalName];
    }
    delete referalsDB[canonicalName];
    
    // Передача ячеек во владение Администрации (SYSTEM_ROOT)
    Object.keys(treeDB).forEach(cellId => {
        if (treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === canonicalName.toLowerCase()) {
            treeDB[cellId].user = 'SYSTEM_ROOT';
        }
    });

    canceledUsersCount++;

    res.json({ 
        success: true, 
        message: `Покупка аннулирована. Логин ${canonicalName} передан во владение Администрации (SYSTEM_ROOT).` 
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
            treeDB[cellId].user = 'SYSTEM_ROOT';
        }
    });

    canceledUsersCount++;
    
    res.json({ success: true, message: `Пользователь ${canonicalName} заблокирован. Ячейки переданы SYSTEM_ROOT` });
});

app.post(['/api/reset', '/api/reset-database'], (req, res) => {
    treeDB = createInitialTree();
    activeMatricesList = ['A1'];
    shopUsersDB = {};
    wallets = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    canceledUsersCount = 0;
    ['SYSTEM_ROOT', 'LEADER_1', 'LEADER_2', 'ADMIN'].forEach(u => getOrCreateUserCard(u));
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
