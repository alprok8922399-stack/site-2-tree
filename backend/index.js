/**
 * Бэкенд Приватного Ядра — Сайт №2 (Матрица и Реферальная Таблица)
 * Управляет деревом ячеек, реферальными связями, логикой деления,
 * заморозкой/блокировкой, 5 поколениями связей, реферальными выплатами (50/10/10)
 * и финансовой статистикой Администратора.
 */

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

// Секретный ключ для защиты API
const INTERNAL_SECRET_KEY = process.env.INTERNAL_SECRET_KEY || 'super_secret_mitron_key_2026';

// Проверка секретного ключа для защищенных запросов (POST, PUT, DELETE)
app.use('/api/', (req, res, next) => {
    if (req.method === 'GET') return next();

    const clientKey = req.headers['x-internal-key'];
    if (clientKey !== INTERNAL_SECRET_KEY) {
        return res.status(403).json({ error: 'Доступ запрещен: Неверный системный ключ!' });
    }
    next();
});

app.use(express.static('../frontend'));

// Инициализация баз данных в памяти
let shopUsersDB = {};
let wallets = createInitialWallets();

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
let activeMatricesList = ['A1']; // Список верхушек активных матриц

/**
 * Вспомогательная функция поиска/инициализации юзера
 */
function getOrCreateUserCard(username) {
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
            shopUsersDB[canonicalName].purchases = { certificateAmount: 0 };
        }
        shopUsersDB[canonicalName].isFrozen = false;
        shopUsersDB[canonicalName].pendingPayouts = [];
    }
    return canonicalName;
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
            if (shopUsersDB[canonicalTop]) {
                shopUsersDB[canonicalTop].matrixPosition.status = 'payout_pending';
            }
        }

        activeMatricesList = activeMatricesList.filter(id => id !== topCell.id);
        if (b1Cell && b1Cell.id) activeMatricesList.push(b1Cell.id);
        if (b2Cell && b2Cell.id) activeMatricesList.push(b2Cell.id);
    }
}

/**
 * Логика выплат 50 / 10 / 10 с удержанием 31 день
 */
function processReferralPayouts(buyerUser) {
    let current = buyerUser;
    const rewards = [50, 10, 10]; // 1-я линия 50, 2-я линия 10, 3-я линия 10

    for (let level = 0; level < 3; level++) {
        const sponsorName = referalsDB[current];
        if (!sponsorName || sponsorName === 'SYSTEM_ROOT') break;

        const canonicalSponsor = getOrCreateUserCard(sponsorName);
        const sponsorProfile = shopUsersDB[canonicalSponsor];

        if (sponsorProfile && !sponsorProfile.isFrozen) {
            const releaseDate = new Date();
            releaseDate.setDate(releaseDate.getDate() + 31); // 31 день отказного периода

            sponsorProfile.pendingPayouts.push({
                fromUser: buyerUser,
                amount: rewards[level],
                releaseDate: releaseDate.toISOString(),
                status: 'pending'
            });
        }
        current = canonicalSponsor;
    }
}

// ================= API ЭНДПОИНТЫ =================

app.get('/api/tree', (req, res) => {
    res.json({
        ...treeDB,
        activeMatrices: activeMatricesList
    });
});

// Единый эндпоинт регистрации пользователя в Матрице и Таблице
app.post(['/api/register', '/api/register-matrix'], (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    
    const trimmedUser = username.trim();
    const canonicalUser = getOrCreateUserCard(trimmedUser);
    
    let canonicalSponsor = sponsor ? sponsor.trim() : null;
    if (!canonicalSponsor) {
        const allUsers = Object.keys(referalsDB);
        canonicalSponsor = allUsers[Math.floor(Math.random() * allUsers.length)] || 'SYSTEM_ROOT';
    }
    
    referalsDB[canonicalUser] = canonicalSponsor;

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalUser;
    
    shopUsersDB[canonicalUser].isPaid = true;
    shopUsersDB[canonicalUser].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalUser].matrixPosition.status = 'active';
    
    checkAndSplitMatrix(cellId);
    res.json({ success: true, cellId, user: canonicalUser, sponsor: canonicalSponsor });
});

// Регистрация через Сайт 1 (Магазин/Робот)
app.post(['/api/shop/register', '/api/register-shop'], (req, res) => {
    const { username, sponsor } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const canonicalUser = getOrCreateUserCard(username.trim());
    
    let chosenSponsor = sponsor ? sponsor.trim() : null;
    if (!chosenSponsor) {
        const availableSponsors = Object.keys(referalsDB);
        chosenSponsor = availableSponsors[Math.floor(Math.random() * availableSponsors.length)] || 'SYSTEM_ROOT';
    }

    referalsDB[canonicalUser] = chosenSponsor;
    lastRegisteredBot = canonicalUser; 

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = canonicalUser;
    
    shopUsersDB[canonicalUser].isPaid = true;
    shopUsersDB[canonicalUser].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalUser].matrixPosition.status = 'active';
    
    checkAndSplitMatrix(cellId);
    res.json({ success: true, shopUserStatus: shopUsersDB[canonicalUser], cellId });
});

// Покупка сертификата
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
        checkAndSplitMatrix(cellId);
    }

    shopUsersDB[canonicalName].isPaid = true;
    shopUsersDB[canonicalName].paymentDate = new Date().toISOString();
    shopUsersDB[canonicalName].purchases.certificateAmount += TOTAL_MITRONS;
    shopUsersDB[canonicalName].balances.mitrons += TOTAL_MITRONS;
    shopUsersDB[canonicalName].balances.usd = parseFloat(mitronsToUsd(shopUsersDB[canonicalName].balances.mitrons));
    shopUsersDB[canonicalName].matrixPosition.currentCellId = cellId;
    shopUsersDB[canonicalName].matrixPosition.status = 'active';

    wallets.adminWallet.balanceMitrons += TOTAL_MITRONS;

    // Запуск реферальных начислений (50 / 10 / 10)
    processReferralPayouts(canonicalName);

    res.json({
        success: true,
        shopUserStatus: shopUsersDB[canonicalName],
        cellId,
        amount: TOTAL_MITRONS
    });
});

// Данные карточки Администратора
app.get('/api/admin/stats', (req, res) => {
    const totalUsersList = Object.keys(referalsDB);
    const totalUsers = totalUsersList.length;
    
    const adminLogins = totalUsersList.filter(u => 
        u.toLowerCase().includes('admin') || 
        u === 'SYSTEM_ROOT' || 
        u === 'Admin_System'
    ).length;
    
    const buyerLogins = Math.max(0, totalUsers - adminLogins);

    let totalIncome = 0;
    let refPayoutsReleased = 0;
    let refPayoutsPending = 0;

    Object.values(shopUsersDB).forEach(u => {
        if (u.purchases && u.purchases.certificateAmount) {
            totalIncome += u.purchases.certificateAmount;
        }
        if (u.pendingPayouts && Array.isArray(u.pendingPayouts)) {
            u.pendingPayouts.forEach(p => {
                if (p.status === 'released') {
                    refPayoutsReleased += p.amount;
                } else {
                    refPayoutsPending += p.amount;
                }
            });
        }
    });

    const cashbackPaid = 0; // По умолчанию
    const totalReserve = refPayoutsPending; 
    const netProfit = totalIncome - refPayoutsReleased - cashbackPaid - totalReserve;

    res.json({
        success: true,
        stats: {
            totalBalance: wallets.adminWallet ? wallets.adminWallet.balanceMitrons : totalIncome,
            incomeToday: totalIncome,
            incomeWeek: totalIncome,
            incomeMonth: totalIncome,
            cashbackPaid,
            refPayouts: refPayoutsReleased,
            totalReserve,
            netProfit,
            totalUsers,
            adminLogins,
            buyerLogins
        }
    });
});

// Карточка пользователя
app.get('/api/user-details/:username', (req, res) => {
    const usernameParam = req.params.username.trim();
    const canonicalName = getOrCreateUserCard(usernameParam);
    
    // Все ячейки пользователя
    const userCells = Object.values(treeDB)
        .filter(cell => cell.user && cell.user.toLowerCase() === canonicalName.toLowerCase())
        .map(cell => cell.id);
        
    // Цепочка спонсоров вверх (ограничена 5 поколениями)
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

// Интерактивная Реферальная структура (до 5 уровней)
app.get('/api/referals-tree', (req, res) => {
    let structure = {};
    let childrenMap = {};
    
    Object.keys(referalsDB).forEach(user => { childrenMap[user] = []; });
    
    Object.entries(referalsDB).forEach(([user, sponsor]) => {
        if (sponsor) {
            const canonicalSponsor = Object.keys(referalsDB).find(k => k.toLowerCase() === sponsor.toLowerCase()) || sponsor;
            if (!childrenMap[canonicalSponsor]) childrenMap[canonicalSponsor] = [];
            childrenMap[canonicalSponsor].push(user);
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

// Заморозка выплат
app.post('/api/admin/freeze-user', (req, res) => {
    const { username, freeze } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    const canonicalName = getOrCreateUserCard(username);
    shopUsersDB[canonicalName].isFrozen = freeze !== undefined ? Boolean(freeze) : true;

    res.json({
        success: true,
        message: `Статус заморозки пользователя ${canonicalName}: ${shopUsersDB[canonicalName].isFrozen}`
    });
});

// Блокировка и удаление аккаунта (с передачей ячеек Admin_System)
app.post('/api/admin/delete-user', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    const canonicalName = Object.keys(shopUsersDB).find(k => k.toLowerCase() === username.trim().toLowerCase()) || username.trim();

    delete shopUsersDB[canonicalName];
    delete referalsDB[canonicalName];
    
    // Передаем все ячейки Администрации
    Object.keys(treeDB).forEach(cellId => {
        if (treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === canonicalName.toLowerCase()) {
            treeDB[cellId].user = 'Admin_System';
        }
    });
    
    res.json({ success: true, message: `Пользователь ${canonicalName} заблокирован. Ячейки переданы Admin_System` });
});

// Сброс базы данных
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
    res.json({ success: true });
});

app.get(['/api/sys-wallets', '/api/system-wallets'], (req, res) => {
    res.json({ 
        success: true, 
        wallets,
        adminWallet: wallets.adminWallet ? wallets.adminWallet.balanceMitrons : 0,
        daoWallet: wallets.daoWallet ? wallets.daoWallet.balanceMitrons : 0
    });
});

app.listen(PORT, () => console.log(`Backend server running on port ${PORT}`));
