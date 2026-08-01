/**
 * Ядро сервера (Сайт 2 — Структура и Таблица)
 * Проект: MITRON
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Системный логин Администратора для приема отказных единиц
const ADMIN_OWNER_LOGIN = 'ADMIN_REFUND_OWNER';

// Импортируем утилиты из модуля статики
let getLevelLetter, cellIdToGlobalIndex, mitronsToUsd, createNewUserCard, createInitialWallets;

try {
    const staticUtils = require('./static');
    getLevelLetter = staticUtils.getLevelLetter;
    cellIdToGlobalIndex = staticUtils.cellIdToGlobalIndex;
    mitronsToUsd = staticUtils.mitronsToUsd;
    createNewUserCard = staticUtils.createNewUserCard;
    createInitialWallets = staticUtils.createInitialWallets;
} catch (e) {
    // Резервные утилиты при запуске без внешних зависимостей
    getLevelLetter = (idx) => String.fromCharCode(65 + idx);
    cellIdToGlobalIndex = (id) => 0;
    mitronsToUsd = (m) => m * 0.1;
    createNewUserCard = (username) => ({
        username,
        isPaid: false,
        paymentDate: null,
        matrixPosition: { status: 'none', currentCellId: null, occupiedCells: [] },
        pendingReferralRewards: []
    });
    createInitialWallets = () => ({
        bufferWallet: { balanceMitrons: 0 },
        payoutReserveWallet: { balanceMitrons: 0 },
        adminProfitWallet: { balanceMitrons: 0 }
    });
}

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

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

// Стартовое состояние активных структурных узлов
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
let activeMatricesList = ['A1']; // Список верхушек активных структурных уровней

/**
 * Расчет 31-дневного реферального резерва в Таблице (50, 10, 10 M)
 */
function processTableReferrals(username) {
    let current = referalsDB[username];
    const referralRates = [50, 10, 10]; // 1-й лидер: 50M, 2-й: 10M, 3-й: 10M
    const unlockDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();

    for (let i = 0; i < referralRates.length; i++) {
        if (!current) break;
        
        if (!shopUsersDB[current]) {
            shopUsersDB[current] = createNewUserCard(current);
        }

        if (!shopUsersDB[current].pendingReferralRewards) {
            shopUsersDB[current].pendingReferralRewards = [];
        }

        // Записываем резерв со сроком выдержки 31 день
        shopUsersDB[current].pendingReferralRewards.push({
            fromUser: username,
            amount: referralRates[i],
            level: i + 1,
            unlockDate: unlockDate,
            status: 'reserved' // reserved -> ready -> paid
        });

        current = referalsDB[current];
    }
}

/**
 * Алгоритм поиска свободной позиции и деления уровней структуры
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

// Проверка и вызов деления при заполнении 4 нижних позиций
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

    // Заполнение 4 нижних мест
    if (c1 && c1.user && c2 && c2.user && c3 && c3.user && c4 && c4.user) {
        const topCell = getCellByGIdx(topGIdx);
        const b1Cell = getCellByGIdx(b1G);
        const b2Cell = getCellByGIdx(b2G);

        if (topCell && topCell.user) {
            if (shopUsersDB[topCell.user]) {
                shopUsersDB[topCell.user].matrixPosition.status = 'payout_pending';
                shopUsersDB[topCell.user].matrixPosition.payoutEligibleDate = new Date(Date.now() + 31 * 24 * 60 * 60 * 1000).toISOString();
                shopUsersDB[topCell.user].matrixPosition.reservedMatrixM = 1000;
            }
        }

        activeMatricesList = activeMatricesList.filter(id => id !== topCell.id);
        if (b1Cell && b1Cell.id) activeMatricesList.push(b1Cell.id);
        if (b2Cell && b2Cell.id) activeMatricesList.push(b2Cell.id);
    }
}

// ================= API =================

// === ПЕРЕДАЧА ОФОРМЛЕННОГО ОТКАЗА АДМИНИСТРАЦИИ (ТОЧЕЧНО) ===
app.post('/api/admin/refund-user', (req, res) => {
    const { username, amount, cellsCount, unitsCount } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    const cleanUser = username.trim();
    const targetCount = unitsCount || cellsCount;
    const countToRefund = Math.max(1, parseInt(targetCount) || (amount ? Math.round(amount / 1000) : 1));

    // 1. Создаем аккаунт Администратора, если его нет
    if (!shopUsersDB[ADMIN_OWNER_LOGIN]) {
        shopUsersDB[ADMIN_OWNER_LOGIN] = createNewUserCard(ADMIN_OWNER_LOGIN);
        shopUsersDB[ADMIN_OWNER_LOGIN].isPaid = true;
        shopUsersDB[ADMIN_OWNER_LOGIN].ownedByAdmin = true;
    }

    // 2. Находим и передаем Администратору точное количество позиций пользователя
    let transferredCount = 0;
    const userCells = Object.keys(treeDB).filter(cellId => 
        treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === cleanUser.toLowerCase()
    );

    // Берем последние купленные единицы и переводим Администратору
    const cellsToTransfer = userCells.slice(-countToRefund);
    cellsToTransfer.forEach(cellId => {
        treeDB[cellId].user = ADMIN_OWNER_LOGIN;
        transferredCount++;
    });

    // 3. Обновляем статус карточки пользователя (БАН НЕ СТАВИМ)
    if (shopUsersDB[cleanUser]) {
        const remainingCells = Object.keys(treeDB).filter(cellId => 
            treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === cleanUser.toLowerCase()
        );

        if (remainingCells.length === 0) {
            shopUsersDB[cleanUser].isPaid = false;
            shopUsersDB[cleanUser].matrixPosition = { status: 'refunded', currentCellId: null, occupiedCells: [] };
        } else {
            shopUsersDB[cleanUser].matrixPosition.occupiedCells = remainingCells;
            shopUsersDB[cleanUser].matrixPosition.currentCellId = remainingCells[0];
        }
    }

    res.json({
        success: true,
        message: `Точечный откат выполнен: ${transferredCount} единиц передано Администратору (${ADMIN_OWNER_LOGIN}).`,
        transferredUnitsCount: transferredCount,
        transferredCellsCount: transferredCount // Для обратной совместимости
    });
});

// === АНАЛИТИКА КАРТОЧКИ АДМИНИСТРАТОРА ===
app.get('/api/admin/stats', (req, res) => {
    const users = Object.values(shopUsersDB);
    const paidUsers = users.filter(u => u.isPaid);

    const paidCells = Object.values(treeDB).filter(cell => {
        return cell.user && cell.user !== 'SYSTEM_ROOT' && !cell.user.startsWith('LEADER_');
    });

    const purchasesCount = paidCells.length;
    const totalIncomeM = purchasesCount * 1000;

    const now = new Date();
    const oneDay = 24 * 60 * 60 * 1000;
    const oneWeek = 7 * oneDay;
    const oneMonth = 30 * oneDay;

    let incomeToday = 0;
    let incomeWeek = 0;
    let incomeMonth = 0;

    paidCells.forEach(cell => {
        const user = shopUsersDB[cell.user];
        const pDate = (user && user.paymentDate) ? new Date(user.paymentDate) : now;
        const diff = now - pDate;
        
        if (diff <= oneDay) incomeToday += 1000;
        if (diff <= oneWeek) incomeWeek += 1000;
        if (diff <= oneMonth) incomeMonth += 1000;
    });

    const buyersCount = paidUsers.filter(u => u.username !== 'SYSTEM_ROOT' && !u.username.startsWith('LEADER_')).length;
    const goodsBoughtM = purchasesCount * 450;

    const matrixReserve = purchasesCount * 250;
    const referralsPaid = purchasesCount * 70;
    const daoFund = purchasesCount * 23;
    const netProfit = purchasesCount * 207;

    const cashbackPaid = paidUsers.filter(u => u.matrixPosition && u.matrixPosition.status === 'payout_pending').length * 1000;
    const inReserve = matrixReserve + referralsPaid;

    const allLogins = Object.keys(referalsDB);
    const adminLogins = allLogins.filter(l => l.toUpperCase().includes('ADMIN') || l === 'SYSTEM_ROOT' || (shopUsersDB[l] && shopUsersDB[l].ownedByAdmin));
    const userLogins = allLogins.length - adminLogins.length;

    const refusedCount = users.filter(u => {
        const isSystem = u.username === 'SYSTEM_ROOT' || u.username.startsWith('LEADER_');
        return !u.isPaid && !isSystem && !u.ownedByAdmin;
    }).length;

    res.json({
        success: true,
        stats: {
            totalBalance: totalIncomeM,
            incomeToday,
            incomeWeek,
            incomeMonth,
            goodsBoughtM,
            goodsTotalM: goodsBoughtM,
            buyersCount,
            refusedCount,
            cashbackPaid,
            referralsPaid,
            inReserve,
            netProfit,
            daoFund,
            totalLogins: allLogins.length,
            adminLogins: adminLogins.length,
            userLogins
        }
    });
});

app.get('/api/admin/logins-by-date', (req, res) => {
    const { from, to } = req.query;
    if (!from || !to) return res.status(400).json({ error: 'Параметры from и to обязательны' });

    const dateFrom = new Date(from);
    const dateTo = new Date(to);
    dateTo.setHours(23, 59, 59, 999);

    const foundLogins = [];

    Object.entries(shopUsersDB).forEach(([username, profile]) => {
        const pDate = profile.paymentDate ? new Date(profile.paymentDate) : null;
        if (pDate && pDate >= dateFrom && pDate <= dateTo) {
            foundLogins.push(username);
        }
    });

    res.json({
        success: true,
        count: foundLogins.length,
        logins: foundLogins
    });
});

// === АДМИН-ФУНКЦИИ БЛОКИРОВКИ И ВЫПЛАТ ===

app.post('/api/admin/toggle-suspend', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    if (!shopUsersDB[username]) {
        shopUsersDB[username] = createNewUserCard(username);
    }
    
    shopUsersDB[username].payoutsSuspended = !shopUsersDB[username].payoutsSuspended;
    
    res.json({ 
        success: true, 
        suspended: shopUsersDB[username].payoutsSuspended,
        message: shopUsersDB[username].payoutsSuspended ? 'Выплаты приостановлены' : 'Выплаты возобновлены' 
    });
});

app.post('/api/admin/block-and-transfer', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    if (!shopUsersDB[username]) {
        shopUsersDB[username] = createNewUserCard(username);
    }

    shopUsersDB[username].isBlocked = true;
    shopUsersDB[username].ownedByAdmin = true;
    shopUsersDB[username].payoutsSuspended = false;

    res.json({ 
        success: true, 
        message: `Логин ${username} заблокирован и передан Администратору!` 
    });
});

app.get('/api/admin/owned-logins', (req, res) => {
    const adminLogins = [];
    const allLogins = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allLogins.forEach(login => {
        const profile = shopUsersDB[login] || {};
        if (profile.ownedByAdmin || login === 'SYSTEM_ROOT' || login === ADMIN_OWNER_LOGIN) {
            adminLogins.push({
                login: login,
                isBlocked: profile.isBlocked || false,
                paymentDate: profile.paymentDate || null
            });
        }
    });

    res.json({ success: true, logins: adminLogins });
});

app.get('/api/tree', (req, res) => {
    res.json({
        ...treeDB,
        activeMatrices: activeMatricesList
    });
});

// Регистрация с поддержкой мультипокупки (1-5 единиц) и транзитной обработкой через 3 кошелька
app.post('/api/shop/register', (req, res) => {
    const { username, hashId, uplineUser, unitsCount, cellsCount = 1, amountMitrons = 1000 } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const trimmedUser = username.trim();
    const countValue = unitsCount || cellsCount;
    const count = Math.min(Math.max(parseInt(countValue) || 1, 1), 5);
    const totalAmount = count * 1000;

    // --- ТРАНЗИТНАЯ ЛОГИКА 3-Х КОШЕЛЬКОВ ---
    wallets.bufferWallet.balanceMitrons += totalAmount;

    const reserveForPayouts = count * (250 + 70);
    const adminProfit = totalAmount - reserveForPayouts;

    wallets.payoutReserveWallet.balanceMitrons += reserveForPayouts;
    wallets.adminProfitWallet.balanceMitrons += adminProfit;

    wallets.bufferWallet.balanceMitrons = 0;

    if (!shopUsersDB[trimmedUser]) {
        shopUsersDB[trimmedUser] = createNewUserCard(trimmedUser);
    }
    
    if (hashId) {
        shopUsersDB[trimmedUser].hashId = hashId;
    }
    
    let chosenSponsor = uplineUser ? uplineUser.trim() : null;
    if (!chosenSponsor) {
        const availableSponsors = Object.keys(referalsDB);
        chosenSponsor = availableSponsors[Math.floor(Math.random() * availableSponsors.length)] || 'SYSTEM_ROOT';
    }

    if (!referalsDB[trimmedUser]) {
        referalsDB[trimmedUser] = chosenSponsor;
    }
    
    lastRegisteredBot = trimmedUser; 

    const occupiedCells = [];
    for (let i = 0; i < count; i++) {
        const cellId = findNextEmptyCell(treeDB);
        treeDB[cellId].user = trimmedUser;
        occupiedCells.push(cellId);
        checkAndSplitMatrix(cellId);
    }

    processTableReferrals(trimmedUser);
    
    shopUsersDB[trimmedUser].isPaid = true;
    shopUsersDB[trimmedUser].paymentDate = new Date().toISOString();
    shopUsersDB[trimmedUser].matrixPosition.currentCellId = occupiedCells[0];
    shopUsersDB[trimmedUser].matrixPosition.occupiedCells = occupiedCells;
    shopUsersDB[trimmedUser].matrixPosition.status = 'active';
    shopUsersDB[trimmedUser].matrixPosition.reservedPerCell = 250;
    
    res.json({ 
        success: true, 
        shopUserStatus: shopUsersDB[trimmedUser], 
        cellId: occupiedCells[0],
        occupiedCells,
        walletsState: wallets
    });
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
