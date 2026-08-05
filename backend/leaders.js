/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/backend/leaders.js
 * Назначение: Модуль Лидерской квалификации и Бонусов с Ветки (7 M)
 * =========================================================
 */

// База заблокированных/замороженных именно в качестве Лидеров
const excludedLeadersDB = {}; // { username: { isExcludedFromLeaders: true, isPayoutFrozen: false } }

/**
 * Получить/инициализировать лидерский статус пользователя
 */
function getLeaderStatus(username) {
    if (!username) return { isExcludedFromLeaders: false, isPayoutFrozen: false };
    const cleanUser = username.trim();
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
function getActiveDirectReferrals(leaderUsername, referalsDB, shopUsersDB) {
    if (!leaderUsername || !referalsDB) return [];

    const leaderClean = leaderUsername.trim().toLowerCase();

    return Object.keys(referalsDB).filter(user => {
        const sponsor = referalsDB[user];
        if (!sponsor || sponsor.trim().toLowerCase() !== leaderClean) return false;

        const profile = shopUsersDB[user];
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
function getQualifiedLeaders(referalsDB, shopUsersDB) {
    const qualifiedLeaders = [];
    if (!referalsDB || !shopUsersDB) return qualifiedLeaders;

    const allUsers = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allUsers.forEach(username => {
        if (!username || ['SYSTEM_ROOT', 'ADMIN_REFUND_OWNER', 'undefined'].includes(username)) return;

        const leaderStatus = getLeaderStatus(username);
        // Если исключен из Лидеров — пропускаем
        if (leaderStatus.isExcludedFromLeaders) return;

        const activeReferrals = getActiveDirectReferrals(username, referalsDB, shopUsersDB);
        if (activeReferrals.length >= 10) {
            qualifiedLeaders.push({
                username: username,
                login: username, // Дублируем для гарантии совместимости с API
                activeDirectCount: activeReferrals.length,
                directCount: activeReferrals.length,
                referralsList: activeReferrals,
                isPayoutFrozen: leaderStatus.isPayoutFrozen,
                isLeaderFrozen: leaderStatus.isPayoutFrozen,
                isExcludedFromLeaders: leaderStatus.isExcludedFromLeaders
            });
        }
    });

    return qualifiedLeaders;
}

/**
 * Поиск первого квалифицированного Лидера вверх по реферальной цепочке ветки
 */
function findBranchLeader(username, referalsDB, shopUsersDB) {
    if (!username || !referalsDB) return null;
    let current = referalsDB[username];
    let visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);

        if (['SYSTEM_ROOT', 'ADMIN_REFUND_OWNER', 'undefined'].includes(current)) break;

        const leaderStatus = getLeaderStatus(current);
        
        // Лидер подходит только если он не исключен из Лидеров
        if (!leaderStatus.isExcludedFromLeaders) {
            const activeReferrals = getActiveDirectReferrals(current, referalsDB, shopUsersDB);
            if (activeReferrals.length >= 10) {
                return current;
            }
        }

        current = referalsDB[current];
    }

    return null;
}

/**
 * Расчет лидерских бонусов (7 M) с новичков ветки по прошествии 33 дней.
 * Заложено в общую математику обязательств экосистемы (777 M)!
 */
function calculateLeaderBranchBonuses(referalsDB, shopUsersDB) {
    const now = Date.now();
    let totalLeaderBonusPaid = 0;
    let totalLeaderBonusReserve = 0;
    const leaderRewardsMap = {};

    if (!shopUsersDB) return { totalLeaderBonusPaid: 0, totalLeaderBonusReserve: 0, leaderRewardsMap };

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

        // Срок выдержки выплат — строго 33 дня, размер бонуса — 7 M
        if (daysPassed >= 33 && !leaderStatus.isPayoutFrozen) {
            leaderRewardsMap[leader].paid += 7;
            totalLeaderBonusPaid += 7;
        } else {
            leaderRewardsMap[leader].reserve += 7;
            totalLeaderBonusReserve += 7;
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

module.exports = {
    getActiveDirectReferrals,
    getQualifiedLeaders,
    findBranchLeader,
    calculateLeaderBranchBonuses,
    toggleLeaderPayoutFreeze,
    removeLeaderStatus,
    getLeaderStatus
};
