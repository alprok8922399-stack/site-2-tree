/**
 * Модуль Лидерской квалификации и Бонусов с Ветки (10 M)
 * Проект: MITRON (Сайт 2)
 */

// База заблокированных/замороженных именно в качестве Лидеров
const excludedLeadersDB = {}; // { username: { isExcludedFromLeaders: true, isPayoutFrozen: false } }

/**
 * Получить/инициализировать лидерский статус пользователя
 */
function getLeaderStatus(username) {
    if (!excludedLeadersDB[username]) {
        excludedLeadersDB[username] = {
            isExcludedFromLeaders: false,
            isPayoutFrozen: false
        };
    }
    return excludedLeadersDB[username];
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
    const allUsers = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allUsers.forEach(username => {
        if (['SYSTEM_ROOT', 'ADMIN_REFUND_OWNER'].includes(username)) return;

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
function findBranchLeader(username, referalsDB, shopUsersDB) {
    let current = referalsDB[username];
    let visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);

        if (['SYSTEM_ROOT', 'ADMIN_REFUND_OWNER'].includes(current)) break;

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
 * Расчет лидерских бонусов (10 M) с новичков ветки по прошествии 31 дня.
 * Начисления происходят из чистой прибыли Админа!
 */
function calculateLeaderBranchBonuses(referalsDB, shopUsersDB) {
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

        // Если выплата заморожена, деньги падают в резерв, а не в выплачено
        if (daysPassed >= 31 && !leaderStatus.isPayoutFrozen) {
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

module.exports = {
    getActiveDirectReferrals,
    getQualifiedLeaders,
    findBranchLeader,
    calculateLeaderBranchBonuses,
    toggleLeaderPayoutFreeze,
    removeLeaderStatus,
    getLeaderStatus
};
