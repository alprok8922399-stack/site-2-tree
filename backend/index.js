/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/backend/index.js
 * Назначение: Ядро сервера (Структура, Таблица, Лидерские бонусы, Финансы и Статистика)
 * =========================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const { verifyInternalRequest } = require('./middleware');

const app = express();
const PORT = process.env.PORT || 5000;

// Адрес Сайта 1 на Render
const SITE1_URL = process.env.SITE1_URL || 'https://site-1-registrar.onrender.com';

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
    getLevelLetter = (idx) => String.fromCharCode(65 + idx);
    cellIdToGlobalIndex = (id) => 0;
    mitronsToUsd = (m) => m * 0.13;
    createNewUserCard = (username) => ({
        username,
        isPaid: false,
        paymentDate: null,
        matrixPosition: { status: 'none', currentCellId: null, occupiedCells: [] },
        pendingReferralRewards: [],
        isLeaderFrozen: false,
        isLeaderRemoved: false,
        isBlocked: false,
        ownedByAdmin: false
    });
    createInitialWallets = () => ({
        bufferWallet: { balanceMitrons: 0 },
        payoutReserveWallet: { balanceMitrons: 0 },
        adminProfitWallet: { balanceMitrons: 0 },
        daoWallet: { balanceMitrons: 0 }
    });
}

// Импортируем модуль работы с Лидерами
let leadersModule;
try {
    leadersModule = require('./leaders');
} catch (e) {
    leadersModule = null;
}

app.use(cors({ origin: '*' }));
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// Подключаем проверку секретного ключа для защиты сервера
app.use(verifyInternalRequest);

// Инициализация баз данных в памяти
let shopUsersDB = {};
let wallets = createInitialWallets();
let refundRecords = [];

// Флаг ускорения времени (симуляция 33 дней)
let is33DaysExpired = false;

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
let activeMatricesList = ['A1'];
let splitMatrixCount = 0; // Счетчик поделившихся матриц

/**
 * =========================================================
 * ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ЛИДЕРСКОЙ И РЕФЕРАЛЬНОЙ ЛОГИКИ
 * =========================================================
 */

// Получение количества реально действующих (без отказников и банов) лично-приглашенных
function getDirectActiveInvitesCount(username) {
    if (leadersModule && leadersModule.getActiveDirectReferrals) {
        return leadersModule.getActiveDirectReferrals(username, referalsDB, shopUsersDB).length;
    }
    if (!username) return 0;
    const canonicalName = username.trim().toLowerCase();
    let count = 0;
    Object.entries(referalsDB).forEach(([user, sponsor]) => {
        if (sponsor && sponsor.trim().toLowerCase() === canonicalName) {
            const profile = shopUsersDB[user];
            if (profile && profile.isPaid && profile.matrixPosition && profile.matrixPosition.status !== 'refunded' && !profile.isBlocked) {
                count++;
            }
        }
    });
    return count;
}

// Поиск Лидера ветки с выполненной квалификацией (>= 10 лично-приглашенных)
function findBranchLeader(username) {
    if (leadersModule && leadersModule.findBranchLeader) {
        return leadersModule.findBranchLeader(username, referalsDB, shopUsersDB);
    }
    if (!username) return null;
    let current = referalsDB[username];
    let visited = new Set();
    while (current && !visited.has(current)) {
        visited.add(current);
        const profile = shopUsersDB[current] || {};
        if (!profile.isLeaderRemoved && !profile.isLeaderFrozen && getDirectActiveInvitesCount(current) >= 10) {
            return current;
        }
        current = referalsDB[current];
    }
    return null;
}

// Расчет реферальных резервов (50 + 10 + 10) + 7 M Лидеру ветки с 11-го человека
function processTableReferrals(username) {
    let current = referalsDB[username];
    const referralRates = [50, 10, 10];
    const unlockDate = new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString();

    // 1. Базовые реферальные на 3 уровня
    for (let i = 0; i < referralRates.length; i++) {
        if (!current) break;
        
        if (!shopUsersDB[current]) {
            shopUsersDB[current] = createNewUserCard(current);
        }

        if (!shopUsersDB[current].pendingReferralRewards) {
            shopUsersDB[current].pendingReferralRewards = [];
        }

        shopUsersDB[current].pendingReferralRewards.push({
            fromUser: username,
            amount: referralRates[i],
            level: i + 1,
            unlockDate: unlockDate,
            status: 'reserved'
        });

        current = referalsDB[current];
    }

    // 2. Лидерский бонус 7 M (начиная с 11-го личника у квалифицированного Лидера)
    const branchLeader = findBranchLeader(username);
    if (branchLeader) {
        const activeCount = getDirectActiveInvitesCount(branchLeader);
        // Выплачивается начиная с 11-го лично приглашенного
        if (activeCount >= 11) {
            if (!shopUsersDB[branchLeader]) {
                shopUsersDB[branchLeader] = createNewUserCard(branchLeader);
            }
            if (!shopUsersDB[branchLeader].pendingReferralRewards) {
                shopUsersDB[branchLeader].pendingReferralRewards = [];
            }
            shopUsersDB[branchLeader].pendingReferralRewards.push({
                fromUser: username,
                amount: 7,
                type: 'leader_bonus',
                unlockDate: unlockDate,
                status: 'reserved'
            });
        }
    }
}

// Поиск свободной ячейки в нижнем ряду слева направо
function findNextEmptyCell(tree) {
    const keys = Object.keys(tree);
    for (let key of keys) {
        if (!tree[key].user) return key;
    }
    return 'C1';
}

// Проверка и деление матрицы при заполнении 4-й ячейки
function checkAndSplitMatrix(cellId) {
    if (cellId === 'C4' || cellId.endsWith('4')) {
        splitMatrixCount++; // Увеличиваем счетчик делений
    }
}

/**
 * =========================================================
 * API ЭНДПОИНТЫ
 * =========================================================
 */

// Покупка / Регистрация с идеальным распределением по ТЗ (на 1000 M)
app.post('/api/shop/register', (req, res) => {
    const { username, hashId, uplineUser, unitsCount, cellsCount = 1, itemCost = 450 } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const trimmedUser = username.trim();
    const countValue = unitsCount || cellsCount;
    const count = Math.min(Math.max(parseInt(countValue) || 1, 1), 5); // Ограничение корзины до 5 ячеек (5000 M)
    const totalAmount = count * 1000;

    // Шлюз 3. Буферный кошелек принимае средства (всегда очищается за секунду)
    wallets.bufferWallet.balanceMitrons += totalAmount;

    // Динамический расчет финансов согласно формуле ТЗ:
    // Базовый остаток = 1000 - X - 250 - 70 - (7 если 11+ личник)
    const X = Math.min(Math.max(parseFloat(itemCost) || 450, 0), 450); // Реальная цена выкупа
    
    for (let i = 0; i < count; i++) {
        const branchLeader = findBranchLeader(trimmedUser);
        const hasLeaderBonus = branchLeader && getDirectActiveInvitesCount(branchLeader) >= 11;
        const leaderBonus = hasLeaderBonus ? 7 : 0;

        const baseBalance = 1000 - X - 250 - 70 - leaderBonus; // Базовый остаток
        const daoShare = baseBalance * 0.10;                   // 10% DAO
        const adminProfit = baseBalance * 0.90;                // 90% Чистая прибыль Админа

        // Распределение по кошелькам:
        // Выплатной кошелек аккумулирует обязательства: X (выкуп) + 250 (матрица) + 70 (реф) + 7 (лидер) + DAO
        const payoutReserve = X + 250 + 70 + leaderBonus + daoShare;
        
        wallets.payoutReserveWallet.balanceMitrons += payoutReserve;
        wallets.adminProfitWallet.balanceMitrons += adminProfit;
        wallets.daoWallet.balanceMitrons += daoShare;
    }

    // Очистка Буферного кошелька
    wallets.bufferWallet.balanceMitrons = 0;

    if (!shopUsersDB[trimmedUser]) {
        shopUsersDB[trimmedUser] = createNewUserCard(trimmedUser);
    }
    
    if (hashId) shopUsersDB[trimmedUser].hashId = hashId;
    
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
        if (treeDB[cellId]) {
            treeDB[cellId].user = trimmedUser;
        }
        occupiedCells.push(cellId);
        checkAndSplitMatrix(cellId);
        processTableReferrals(trimmedUser);
    }

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

// Кнопка «Разморозить 33 дня» (Ускорение времени на 33 дня)
app.post('/api/admin/expire-33days', async (req, res) => {
    is33DaysExpired = true;

    // Синхронизация с Сайтом 1 (блокировка кнопки «Отказаться от покупки»)
    try {
        await fetch(`${SITE1_URL}/api/shop/expire-33days`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-key': process.env.INTERNAL_SECRET || "alprok8922399_mitron_secret_key"
            },
            body: JSON.stringify({ forceExpire: true })
        });
    } catch (e) {
        console.log("Сайт 1 недоступен для синхронизации флага 33 дней");
    }

    res.json({ success: true, message: '33 дня разморожены. Все резервы переведены в выплаты!' });
});

// ГЛАВНЫЙ ЭНДПОИНТ: Расчет точной статистики Карточки Администратора
app.get('/api/admin/stats', (req, res) => {
    let totalIncome = 0;
    let totalPurchasesCount = 0;
    let buyersCount = 0;
    let adminLoginsCount = 0;

    const allLogins = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allLogins.forEach(login => {
        const profile = shopUsersDB[login] || {};
        if (profile.ownedByAdmin || login === 'SYSTEM_ROOT' || login === ADMIN_OWNER_LOGIN) {
            adminLoginsCount++;
        } else {
            buyersCount++;
        }

        if (profile.isPaid) {
            const cells = (profile.matrixPosition && profile.matrixPosition.occupiedCells) ? profile.matrixPosition.occupiedCells.length : 1;
            totalPurchasesCount += cells;
            totalIncome += cells * 1000;
        }
    });

    const totalPurchasedOnExternalMP = totalPurchasesCount * 450; // Покупка товара на стороннем МП (макс. 450 M)

    // 1. Выплаты по акции (Кешбэк 100%)
    // С каждой поделившейся матрицы выходит 1 логин на 1000 M (включая SYSTEM_ROOT)
    let cashbackPaid = 0;
    let matrixReserveTotal = 0;

    if (is33DaysExpired) {
        cashbackPaid = splitMatrixCount * 1000;
        // После 33 дней в резерве матрицы остается только неподелившийся остаток
        const totalMatrixReservePool = totalPurchasesCount * 250;
        matrixReserveTotal = Math.max(totalMatrixReservePool - cashbackPaid, 0);
    } else {
        cashbackPaid = 0;
        // До прошествия 33 дней: за каждую поделившуюся матрицу пишется ровно 1000 M резерва
        matrixReserveTotal = splitMatrixCount * 1000;
    }

    // 2. Расчет Реферальных выплат и Резерва
    let reservedReferrals = 0;
    let paidReferrals = 0;

    Object.values(shopUsersDB).forEach(profile => {
        if (profile.pendingReferralRewards && Array.isArray(profile.pendingReferralRewards)) {
            profile.pendingReferralRewards.forEach(reward => {
                if (reward.amount === 7) {
                    // Лидерский бонус 7 M с 11-го человека
                    if (is33DaysExpired) {
                        paidReferrals += 7;
                    } else {
                        reservedReferrals += 7;
                    }
                } else if (reward.amount === 50 || reward.amount === 10) {
                    // Базовые реферальные (50, 10, 10)
                    if (is33DaysExpired) {
                        paidReferrals += reward.amount;
                    } else {
                        reservedReferrals += reward.amount;
                    }
                }
            });
        }
    });

    // 3. Отказы
    const todayRefundsCount = refundRecords.filter(r => (Date.now() - new Date(r.date).getTime()) <= 24 * 60 * 60 * 1000).length;
    const totalRefundsCount = refundRecords.length;

    // 4. Расчет лидеров
    let activeLeadersList = [];
    Object.keys(referalsDB).forEach(login => {
        if (getDirectActiveInvitesCount(login) >= 10) {
            activeLeadersList.push(login);
        }
    });

    // 5. Итоговые фонды
    const daoFund = totalPurchasesCount * 23;
    const netAdminProfit = totalPurchasesCount * 200;

    res.json({
        success: true,
        stats: {
            totalBalance: totalIncome,
            incomeToday: totalIncome,
            incomeWeek: totalIncome,
            incomeMonth: totalIncome,
            externalMPPurchases: totalPurchasedOnExternalMP,
            totalBuyersCount: buyersCount,
            refundsTodayCount: todayRefundsCount,
            refundsTotalCount: totalRefundsCount,
            cashbackPaidTotal: cashbackPaid,
            referralsPaidTotal: paidReferrals,
            referralsInReserve: is33DaysExpired ? 0 : reservedReferrals,
            payoutsInReserveTotal: matrixReserveTotal,
            qualifyingLeadersCount: activeLeadersList.length,
            qualifyingLeadersList: activeLeadersList,
            daoFund: daoFund,
            netAdminProfit: netAdminProfit,
            totalLoginsCount: allLogins.size,
            adminLoginsCount: adminLoginsCount,
            buyerLoginsCount: buyersCount,
            is33DaysExpired: is33DaysExpired
        }
    });
});

// Отказ от покупки (до 33 дней)
app.post('/api/shop/refund', (req, res) => {
    const { username, cellsToRefundCount = 1 } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    if (is33DaysExpired) {
        return res.status(400).json({ error: 'Срок 33 дня истек. Отказ невозможен!' });
    }

    const profile = shopUsersDB[username];
    if (!profile || !profile.isPaid) {
        return res.status(400).json({ error: 'У пользователя нет активных покупок' });
    }

    // Запись отказа
    refundRecords.push({ username, date: new Date().toISOString() });

    // Передача ячеек Администратору
    profile.ownedByAdmin = true;
    profile.matrixPosition.status = 'refunded';

    res.json({
        success: true,
        message: `Возврат 100% выполнен. Позиции пользователя ${username} перешли Администратору.`
    });
});

// Блокировка и передача логина Администратору
app.post('/api/admin/block-and-transfer', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    if (!shopUsersDB[username]) {
        shopUsersDB[username] = createNewUserCard(username);
    }

    shopUsersDB[username].isBlocked = true;
    shopUsersDB[username].ownedByAdmin = true;

    res.json({ 
        success: true, 
        message: `Логин ${username} заблокирован и передан Администратору!` 
    });
});

// Получение списка логинов Администратора
app.get('/api/admin/owned-logins', (req, res) => {
    const adminLogins = [];
    const allLogins = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allLogins.forEach(login => {
        if (!login || login === 'undefined') return;
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

// Полный сброс системы
app.post('/api/reset', async (req, res) => {
    treeDB = createInitialTree();
    activeMatricesList = ['A1'];
    splitMatrixCount = 0;
    shopUsersDB = {};
    refundRecords = [];
    is33DaysExpired = false;
    wallets = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;

    try {
        await fetch(`${SITE1_URL}/api/shop/expire-33days`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-key': process.env.INTERNAL_SECRET || "alprok8922399_mitron_secret_key"
            },
            body: JSON.stringify({ forceExpire: false })
        });
    } catch (e) {}

    res.json({ success: true });
});

app.get('/api/tree', (req, res) => {
    res.json({
        ...treeDB,
        activeMatrices: activeMatricesList
    });
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

    const targetUser = Object.keys(referalsDB).find(k => k.toLowerCase() === login.trim().toLowerCase()) || login.trim();
    
    let chain = [];
    let current = referalsDB[targetUser];
    let visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);
        chain.push(current);
        const nextKey = Object.keys(referalsDB).find(k => k.toLowerCase() === current.toLowerCase());
        current = nextKey ? referalsDB[nextKey] : null;
    }

    res.json({
        success: true,
        login: targetUser,
        chain: chain
    });
});

app.listen(PORT, () => {
    console.log(`[САЙТ 2] Защищенный сервер успешно запущен на порту ${PORT}`);
});
