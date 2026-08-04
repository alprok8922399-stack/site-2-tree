/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/backend/leaders.js
 * Назначение: Модуль Лидерской квалификации и Бонусов с Ветки (10 M)
 * Срок разморозки бонусов: 33 дня
 * =========================================================
 */

const express = require('express');
const router = express.Router();

// База заблокированных/замороженных именно в качестве Лидеров
const excludedLeadersDB = {}; // { username: { isExcludedFromLeaders: true, isPayoutFrozen: false } }

/**
 * Получить/инициализировать лидерский статус пользователя
 */
function getLeaderStatus(username) {
    if (!username) return { isExcludedFromLeaders: true, isPayoutFrozen: false };
    const cleanUser = username.trim().toLowerCase();
    if (!excludedLeadersDB[cleanUser]) {
        excludedLeadersDB[cleanUser] = {
            isExcludedFromLeaders: false,
            isPayoutFrozen: false
        };
    }
    return excludedLeadersDB[cleanUser];
}

/**
 * Получить список всех активных прямо приглашенных у пользователя (1-я линия)
 * Учитываем только реально действующие профили (без отказников и без заблокированных)
 */
function getActiveDirectReferrals(leaderUsername, referalsDB = {}, shopUsersDB = {}) {
    if (!leaderUsername || !referalsDB) return [];

    const leaderClean = leaderUsername.trim().toLowerCase();

    return Object.keys(referalsDB).filter(user => {
        const sponsor = referalsDB[user];
        if (!sponsor || sponsor.trim().toLowerCase() !== leaderClean) return false;

        const profile = shopUsersDB[user] || shopUsersDB[user.toLowerCase()];
        if (!profile) return false;

        const isPaid = profile.isPaid;
        const isNotRefunded = profile.matrixPosition && profile.matrixPosition.status !== 'refunded';
        const isNotBlocked = !profile.isBlocked;

        return isPaid && isNotRefunded && isNotBlocked;
    });
}

/**
 * Подсчет и получение подробного списка всех квалифицированных Лидеров (10+ активных личников)
 */
function getQualifiedLeaders(referalsDB = {}, shopUsersDB = {}) {
    const qualifiedLeaders = [];
    const allUsers = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allUsers.forEach(username => {
        const leaderStatus = getLeaderStatus(username);
        // Если исключен из Лидеров — пропускаем
        if (leaderStatus.isExcludedFromLeaders) return;

        const activeReferrals = getActiveDirectReferrals(username, referalsDB, shopUsersDB);
        if (activeReferrals.length >= 10) {
            qualifiedLeaders.push({
                username: username,
                activeDirectCount: activeReferrals.length,
                referralsList: activeReferrals,
                isPayoutFrozen: leaderStatus.isPayoutFrozen,
                isExcludedFromLeaders: leaderStatus.isExcludedFromLeaders
            });
        }
    });

    return qualifiedLeaders;
}

/**
 * Поиск первого квалифицированного Лидера вверх по реферальной цепочке ветки
 */
function findBranchLeader(username, referalsDB = {}, shopUsersDB = {}) {
    if (!username) return null;
    let current = referalsDB[username] || referalsDB[username.toLowerCase()];
    let visited = new Set();

    while (current && !visited.has(current.toLowerCase())) {
        visited.add(current.toLowerCase());

        const leaderStatus = getLeaderStatus(current);
        
        // Лидер подходит только если он не исключен из Лидеров
        if (!leaderStatus.isExcludedFromLeaders) {
            const activeReferrals = getActiveDirectReferrals(current, referalsDB, shopUsersDB);
            if (activeReferrals.length >= 10) {
                return current;
            }
        }

        current = referalsDB[current] || referalsDB[current.toLowerCase()];
    }

    return null;
}

/**
 * Расчет лидерских бонусов (10 M) с новичков ветки по прошествии 33 дней.
 * Начисления происходят из чистой прибыли Админа!
 */
function calculateLeaderBranchBonuses(referalsDB = {}, shopUsersDB = {}) {
    const now = Date.now();
    let totalLeaderBonusPaid = 0;
    let totalLeaderBonusReserve = 0;
    const leaderRewardsMap = {};

    Object.keys(shopUsersDB).forEach(newUser => {
        const profile = shopUsersDB[newUser];
        if (!profile || !profile.isPaid) return;
        if (profile.matrixPosition && profile.matrixPosition.status === 'refunded') return;

        const leader = findBranchLeader(newUser, referalsDB, shopUsersDB);
        if (!leader) return;

        const leaderStatus = getLeaderStatus(leader);

        if (!leaderRewardsMap[leader]) {
            leaderRewardsMap[leader] = { 
                paid: 0, 
                reserve: 0, 
                totalCount: 0,
                isPayoutFrozen: leaderStatus.isPayoutFrozen 
            };
        }

        const regDate = profile.paymentDate ? new Date(profile.paymentDate).getTime() : now;
        const daysPassed = Math.floor((now - regDate) / (1000 * 60 * 60 * 24));

        leaderRewardsMap[leader].totalCount++;

        // Ровно 33 дня отказного периода
        if (daysPassed >= 33 && !leaderStatus.isPayoutFrozen) {
            leaderRewardsMap[leader].paid += 10;
            totalLeaderBonusPaid += 10;
        } else {
            leaderRewardsMap[leader].reserve += 10;
            totalLeaderBonusReserve += 10;
        }
    });

    return {
        totalLeaderBonusPaid,
        totalLeaderBonusReserve,
        leaderRewardsMap
    };
}

/**
 * Управление лидерским статусом (Заморозка выплат / Удаление из лидеров)
 */
function toggleLeaderPayoutFreeze(username) {
    const status = getLeaderStatus(username);
    status.isPayoutFrozen = !status.isPayoutFrozen;
    return status;
}

function removeLeaderStatus(username) {
    const status = getLeaderStatus(username);
    status.isExcludedFromLeaders = true;
    return status;
}

// -------------------------------------------------------------
// ЭНДПОИНТЫ ДЛЯ СВЯЗИ С АДМИНКОЙ И ВНЕШНИМ ИНТЕРФЕЙСОМ (САЙТ 2)
// -------------------------------------------------------------

// Получить список лидеров
router.get('/api/admin/leaders', (req, res) => {
    const referalsDB = req.app.locals.referalsDB || {};
    const shopUsersDB = req.app.locals.shopUsersDB || {};
    
    const leaders = getQualifiedLeaders(referalsDB, shopUsersDB);
    res.json({
        success: true,
        count: leaders.length,
        leaders: leaders
    });
});

// Заморозить / Разморозить выплату
router.post('/api/admin/leaders/freeze', (req, res) => {
    const { login } = req.body;
    if (!login) return res.status(400).json({ success: false, message: "Логин не указан" });

    const status = toggleLeaderPayoutFreeze(login);
    res.json({ success: true, frozen: status.isPayoutFrozen, message: `Статус заморозки для ${login} изменен.` });
});

// Удалить ИЗ ЛИДЕРОВ (сохраняя обычный аккаунт)
router.post('/api/admin/leaders/remove', (req, res) => {
    const { login } = req.body;
    if (!login) return res.status(400).json({ success: false, message: "Логин не указан" });

    removeLeaderStatus(login);
    res.json({ success: true, message: `Пользователь ${login} исключен из Лидеров. Аккаунт в системе сохранен.` });
});

// Экспорт как функции, так и роутера Express
module.exports = {
    router,
    getActiveDirectReferrals,
    getQualifiedLeaders,
    findBranchLeader,
    calculateLeaderBranchBonuses,
    toggleLeaderPayoutFreeze,
    removeLeaderStatus,
    getLeaderStatus
};
