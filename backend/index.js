/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/backend/index.js
 * Назначение: Ядро сервера (Структура, Таблица, Лидерские бонусы и Статистика)
 * Соответствует новому окончательному ТЗ проекта «MITRON»
 * =========================================================
 */

const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;

// Адрес Сайта 1 на Render
const SITE1_URL = 'https://site-1-registrar.onrender.com';

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
        isLeaderRemoved: false
    });
    createInitialWallets = () => ({
        bufferWallet: { balanceMitrons: 0 },
        payoutReserveWallet: { balanceMitrons: 0 },
        adminProfitWallet: { balanceMitrons: 0 }
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

// Инициализация баз данных в памяти
let shopUsersDB = {};
let wallets = createInitialWallets();
let refundRecords = []; // Хранилище отказов

// Хранилище выплат разморозки (для статистики)
let simulatedPayouts = {
    cashbackPaid: 0,
    referralsPaid: 0
};

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
 * Вспомогательные функции лидерской логики
 */
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
        if (!profile.isLeaderRemoved && getDirectActiveInvitesCount(current) >= 10) {
            return current;
        }
        current = referalsDB[current];
    }
    return null;
}

function checkBranchLeaderExists(username) {
    return findBranchLeader(username) !== null;
}

/**
 * Расчет 33-дневного реферального резерва в Таблице (50, 10, 10 M)
 */
function processTableReferrals(username) {
    let current = referalsDB[username];
    const referralRates = [50, 10, 10]; // 1-й уровень: 50M, 2-й: 10M, 3-й: 10M
    const unlockDate = new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString();

    for (let i = 0; i < referralRates.length; i++) {
        if (!current) break;
        
        if (!shopUsersDB[current]) {
            shopUsersDB[current] = createNewUserCard(current);
        }

        if (!shopUsersDB[current].pendingReferralRewards) {
            shopUsersDB[current].pendingReferralRewards = [];
        }

        // Записываем резерв со сроком выдержки 33 дня
        shopUsersDB[current].pendingReferralRewards.push({
            fromUser: username,
            amount: referralRates[i],
            level: i + 1,
            unlockDate: unlockDate,
            status: 'reserved'
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

    // Заполнение ВСЕХ 4 нижних мест
    if (c1 && c1.user && c2 && c2.user && c3 && c3.user && c4 && c4.user) {
        const topCell = getCellByGIdx(topGIdx);
        const b1Cell = getCellByGIdx(b1G);
        const b2Cell = getCellByGIdx(b2G);

        if (topCell && topCell.user) {
            if (shopUsersDB[topCell.user]) {
                shopUsersDB[topCell.user].matrixPosition.status = 'payout_pending';
                shopUsersDB[topCell.user].matrixPosition.payoutEligibleDate = new Date(Date.now() + 33 * 24 * 60 * 60 * 1000).toISOString();
                shopUsersDB[topCell.user].matrixPosition.reservedMatrixM = 1000;
            }
        }

        activeMatricesList = activeMatricesList.filter(id => id !== topCell.id);
        if (b1Cell && b1Cell.id) activeMatricesList.push(b1Cell.id);
        if (b2Cell && b2Cell.id) activeMatricesList.push(b2Cell.id);
    }
}

// ================= API =================

// === ПОЛУЧЕНИЕ СПИСКА ЛИДЕРОВ (10+ личников) ===
app.get('/api/admin/leaders', (req, res) => {
    if (leadersModule && leadersModule.getQualifiedLeaders) {
        const qualified = leadersModule.getQualifiedLeaders(referalsDB, shopUsersDB);
        return res.json({ success: true, leaders: qualified });
    }

    const leadersList = [];

    Object.keys(referalsDB).forEach(user => {
        if (!user || user === 'undefined') return;
        const profile = shopUsersDB[user] || {};
        if (!profile.isLeaderRemoved) {
            const count = getDirectActiveInvitesCount(user);
            if (count >= 10) {
                leadersList.push({
                    username: user,
                    login: user,
                    activeDirectCount: count,
                    directCount: count,
                    invitesCount: count,
                    isPayoutFrozen: profile.isLeaderFrozen || false,
                    isFrozen: profile.isLeaderFrozen || false
                });
            }
        }
    });

    res.json({ success: true, leaders: leadersList });
});

// === ЗАМОРОЗКА ВЫПЛАТЫ ЛИДЕРА ===
app.post('/api/admin/toggle-freeze-leader', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    if (leadersModule && leadersModule.toggleLeaderPayoutFreeze) {
        const status = leadersModule.toggleLeaderPayoutFreeze(username);
        if (shopUsersDB[username]) {
            shopUsersDB[username].isLeaderFrozen = status.isPayoutFrozen;
        }
        return res.json({
            success: true,
            isFrozen: status.isPayoutFrozen,
            message: status.isPayoutFrozen ? 'Лидерские выплаты заморожены' : 'Лидерские выплаты разморожены'
        });
    }

    if (!shopUsersDB[username]) {
        shopUsersDB[username] = createNewUserCard(username);
    }

    shopUsersDB[username].isLeaderFrozen = !shopUsersDB[username].isLeaderFrozen;

    res.json({
        success: true,
        isFrozen: shopUsersDB[username].isLeaderFrozen,
        message: shopUsersDB[username].isLeaderFrozen ? 'Лидерские выплаты заморожены' : 'Лидерские выплаты разморожены'
    });
});

// === УДАЛЕНИЕ ИЗ ЛИДЕРОВ ===
app.post('/api/admin/remove-leader', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    if (leadersModule && leadersModule.removeLeaderStatus) {
        leadersModule.removeLeaderStatus(username);
    }

    if (!shopUsersDB[username]) {
        shopUsersDB[username] = createNewUserCard(username);
    }

    shopUsersDB[username].isLeaderRemoved = true;

    res.json({
        success: true,
        message: `Пользователь ${username} удален из состава Лидеров!`
    });
});

// === СИМУЛЯЦИЯ РАЗМОРОЗКИ 33 ДНЕЙ ===
app.post('/api/admin/simulate-33days', async (req, res) => {
    let unlockedReferrals = 0;
    let unlockedCashback = 0;

    // 1. Размораживаем реферальные резервы в карточках пользователей
    Object.values(shopUsersDB).forEach(user => {
        if (user.pendingReferralRewards && Array.isArray(user.pendingReferralRewards)) {
            user.pendingReferralRewards.forEach(reward => {
                if (reward.status === 'reserved') {
                    reward.status = 'unlocked';
                    unlockedReferrals += (reward.amount || 0);
                }
            });
        }

        // 2. Размораживаем матричные выплаты (кэшбэк 1000 M), включая SYSTEM_ROOT
        if (user.matrixPosition && user.matrixPosition.reservedMatrixM === 1000 && user.matrixPosition.status === 'payout_pending') {
            unlockedCashback += 1000;
            user.matrixPosition.status = 'payout_completed';
            user.matrixPosition.reservedMatrixM = 0;
        }
    });

    simulatedPayouts.referralsPaid += unlockedReferrals;
    simulatedPayouts.cashbackPaid += unlockedCashback;

    // 3. Отправляем сигнал на Сайт 1, что 33 дня «истекли», и теперь кнопка возврата блокируется!
    try {
        await fetch(`${SITE1_URL}/api/shop/expire-33days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceExpire: true })
        });
    } catch (err) {
        console.error('Ошибка уведомления Сайта 1 про разморозку 33 дней:', err);
    }

    res.json({
        success: true,
        message: 'Симуляция 33 дней выполнена! Средства созревших выплат разморожены, возвраты на Сайте 1 заблокированы.',
        cashbackPaid: simulatedPayouts.cashbackPaid,
        referralsPaid: simulatedPayouts.referralsPaid
    });
});

// === ПЕРЕДАЧА ОФОРМЛЕННОГО ОТКАЗА АДМИНИСТРАЦИИ ===
app.post('/api/admin/refund-user', (req, res) => {
    const { username, amount, cellsCount, unitsCount } = req.body || {};
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });

    const cleanUser = username.trim();
    
    let countToRefund = 1;
    if (unitsCount) countToRefund = parseInt(unitsCount);
    else if (cellsCount) countToRefund = parseInt(cellsCount);
    else if (amount) countToRefund = Math.max(1, Math.round(parseInt(amount) / 1000));

    // 1. Создаем аккаунт Администратора, если его нет
    if (!shopUsersDB[ADMIN_OWNER_LOGIN]) {
        shopUsersDB[ADMIN_OWNER_LOGIN] = createNewUserCard(ADMIN_OWNER_LOGIN);
        shopUsersDB[ADMIN_OWNER_LOGIN].isPaid = true;
        shopUsersDB[ADMIN_OWNER_LOGIN].ownedByAdmin = true;
    }

    // 2. Находим ВСЕ ячейки пользователя в матрице
    const userCells = Object.keys(treeDB).filter(cellId => 
        treeDB[cellId].user && treeDB[cellId].user.toLowerCase() === cleanUser.toLowerCase()
    );

    const cellsToTransfer = userCells.slice(-countToRefund);
    let transferredCount = 0;

    cellsToTransfer.forEach(cellId => {
        treeDB[cellId].user = ADMIN_OWNER_LOGIN;
        transferredCount++;
    });

    // 3. Фиксируем лог отказа
    refundRecords.push({
        username: cleanUser,
        unitsCount: transferredCount,
        amount: transferredCount * 1000,
        timestamp: Date.now()
    });

    // 4. Обновляем статус карточки пользователя
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
        transferredCellsCount: transferredCount
    });
});

// === АНАЛИТИКА КАРТОЧКИ АДМИНИСТРАТОРА ===
app.get('/api/admin/stats', (req, res) => {
    const now = Date.now();
    const oneDayAgo = now - (24 * 60 * 60 * 1000);
    const oneWeekAgo = now - (7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = now - (30 * 24 * 60 * 60 * 1000);

    const allOccupiedCells = Object.values(treeDB).filter(cell => cell.user !== null && cell.user !== '');
    const systemLogins = ['SYSTEM_ROOT', 'LEADER_1', 'LEADER_2', ADMIN_OWNER_LOGIN];

    const activeBuyerCells = allOccupiedCells.filter(cell => {
        if (!cell.user) return false;
        return !systemLogins.includes(cell.user.trim());
    });

    const adminRefundCells = allOccupiedCells.filter(cell => cell.user === ADMIN_OWNER_LOGIN);

    const activeBuyerUnits = activeBuyerCells.length;
    const totalIncomeM = activeBuyerUnits * 1000;

    let incomeToday = 0;
    let incomeWeek = 0;
    let incomeMonth = 0;

    activeBuyerCells.forEach(cell => {
        const user = shopUsersDB[cell.user];
        const pDate = (user && user.paymentDate) ? new Date(user.paymentDate).getTime() : now;
        
        if (pDate >= oneDayAgo) incomeToday += 1000;
        if (pDate >= oneWeekAgo) incomeWeek += 1000;
        if (pDate >= oneMonthAgo) incomeMonth += 1000;
    });

    if (activeBuyerUnits > 0 && incomeToday === 0) {
        incomeToday = totalIncomeM;
        incomeWeek = totalIncomeM;
        incomeMonth = totalIncomeM;
    }

    const activeBuyerUsernames = new Set(activeBuyerCells.map(c => c.user));
    const buyersCount = activeBuyerUsernames.size;

    const goodsBoughtM = activeBuyerUnits * 450;
    
    // Подсчет зарезервированного кэшбэка
    let reservedCashbackTotal = 0;
    Object.values(shopUsersDB).forEach(u => {
        if (u.matrixPosition && u.matrixPosition.status === 'payout_pending') {
            reservedCashbackTotal += (u.matrixPosition.reservedMatrixM || 1000);
        }
    });

    // Резерв матричных выплат: строго 250M с каждого активного купленного места (плюс незавершенные 1000M)
    const systemReserveTotal = Math.max(0, (activeBuyerUnits * 250) + reservedCashbackTotal - simulatedPayouts.cashbackPaid); 
    
    // Точный расчет Лидерских бонусов (по 7 M с участников начиная с 11-го личника)
    let totalLeaderBonus = 0;
    let totalLeaderBonusPaid = 0;
    let totalLeaderBonusReserve = 0;

    if (leadersModule && leadersModule.calculateLeaderBranchBonuses) {
        const branchBonuses = leadersModule.calculateLeaderBranchBonuses(referalsDB, shopUsersDB);
        totalLeaderBonusPaid = branchBonuses.totalLeaderBonusPaid;
        totalLeaderBonusReserve = branchBonuses.totalLeaderBonusReserve;
        totalLeaderBonus = totalLeaderBonusPaid + totalLeaderBonusReserve;
    } else {
        activeBuyerCells.forEach(cell => {
            if (findBranchLeader(cell.user)) {
                totalLeaderBonusReserve += 7;
                totalLeaderBonus += 7;
            }
        });
    }

    // Базовый резерв реферальных выплат 70M с каждой активации
    const baseRefReserve = activeBuyerUnits * 70;
    const refReserveTotal = Math.max(0, baseRefReserve + totalLeaderBonusReserve - simulatedPayouts.referralsPaid);
    const refPaidTotal = simulatedPayouts.referralsPaid + totalLeaderBonusPaid;

    // Расчет согласно формуле ТЗ при выкупе товара по 450 M:
    // Обязательства = 450 + 250 + 70 + 7 (лидеру если есть) = 777 M (или 770 M без лидера)
    // Базовый остаток = 1000 - Обязательства = 223 M (или 230 M)
    const totalObligations = (activeBuyerUnits * 770) + totalLeaderBonus;
    const baseRemainder = Math.max(0, totalIncomeM - (activeBuyerUnits * 450) - totalObligations + (activeBuyerUnits * 450));

    // DAO (10% от базового остатка): 23 M с 1000 M
    const daoFund = Math.round(baseRemainder * 0.10); 
    
    // Чистая прибыль Администратора (90% от базового остатка): 200 M с 1000 M
    const netProfit = Math.round(baseRemainder * 0.90);        

    const todayRefunds = refundRecords.filter(r => r.timestamp >= oneDayAgo);
    const todayRefusedUnits = todayRefunds.reduce((sum, r) => sum + r.unitsCount, 0);
    const todayRefusedUsers = new Set(todayRefunds.map(r => r.username)).size;

    const totalRefusedUnits = refundRecords.reduce((sum, r) => sum + r.unitsCount, 0);
    const totalRefusedUsers = new Set(refundRecords.map(r => r.username)).size;

    // Подсчет активных лидеров (10+ личников)
    let activeLeadersCount = 0;
    if (leadersModule && leadersModule.getQualifiedLeaders) {
        activeLeadersCount = leadersModule.getQualifiedLeaders(referalsDB, shopUsersDB).length;
    } else {
        activeLeadersCount = Object.keys(referalsDB).filter(u => {
            if (!u || u === 'undefined') return false;
            const profile = shopUsersDB[u] || {};
            return !profile.isLeaderRemoved && getDirectActiveInvitesCount(u) >= 10;
        }).length;
    }

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
            refusedTodayCount: todayRefusedUnits,
            refusedCount: totalRefusedUnits,
            refusedTodayText: `${todayRefusedUsers} чел. (${todayRefusedUnits} яч.)`,
            refusedTotalText: `${totalRefusedUsers} чел. (${totalRefusedUnits} яч.)`,
            cashbackPaid: simulatedPayouts.cashbackPaid,
            referralsPaid: refPaidTotal, 
            referralsReserve: refReserveTotal,
            inReserve: systemReserveTotal,
            netProfit,
            daoFund,
            leadersCount: activeLeadersCount,
            totalLogins: activeBuyerUnits + adminRefundCells.length,
            adminLogins: 1,
            userLogins: buyersCount
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

app.get('/api/tree', (req, res) => {
    res.json({
        ...treeDB,
        activeMatrices: activeMatricesList
    });
});

// Регистрация с поддержкой мультипокупки и проверкой Лидера ветки
app.post('/api/shop/register', (req, res) => {
    const { username, hashId, uplineUser, unitsCount, cellsCount = 1, amountMitrons = 1000 } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин обязателен' });
    
    const trimmedUser = username.trim();
    const countValue = unitsCount || cellsCount;
    const count = Math.min(Math.max(parseInt(countValue) || 1, 1), 5);
    const totalAmount = count * 1000;

    // --- ТРАНЗИТНАЯ ЛОГИКА 3-Х КОШЕЛЬКОВ ---
    wallets.bufferWallet.balanceMitrons += totalAmount;

    const leaderBonus = checkBranchLeaderExists(trimmedUser) ? 7 : 0;
    const reserveForPayouts = count * (250 + 70 + leaderBonus);
    const adminProfit = totalAmount - (count * 450) - reserveForPayouts;

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
    
    const hasBranchLeader = checkBranchLeaderExists(trimmedUser);

    res.json({ 
        success: true, 
        shopUserStatus: shopUsersDB[trimmedUser], 
        cellId: occupiedCells[0],
        occupiedCells,
        walletsState: wallets,
        hasBranchLeader: hasBranchLeader
    });
});

app.post('/api/reset', async (req, res) => {
    treeDB = createInitialTree();
    activeMatricesList = ['A1'];
    shopUsersDB = {};
    refundRecords = [];
    simulatedPayouts = { cashbackPaid: 0, referralsPaid: 0 };
    wallets = createInitialWallets();
    referalsDB = {
        'SYSTEM_ROOT': null,
        'LEADER_1': 'SYSTEM_ROOT',
        'LEADER_2': 'SYSTEM_ROOT'
    };
    lastRegisteredBot = null;

    // При сбросе системы возвращаем блокировку на Сайте 1 в исходное состояние
    try {
        await fetch(`${SITE1_URL}/api/shop/expire-33days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ forceExpire: false })
        });
    } catch (e) {}

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
    console.log(`[САЙТ 2] Сервер успешно запущен на порту ${PORT}`);
});
