/**
 * Модуль Лидерской квалификации и Бонусов с Ветки (10 M)
 * Проект: MITRON (Сайт 2)
 */

/**
 * Получить список всех активных прямо приглашенных у пользователя (1-я линия)
 */
function getActiveDirectReferrals(leaderUsername, referalsDB, shopUsersDB) {
    if (!leaderUsername || !referalsDB) return [];

    const leaderClean = leaderUsername.trim().toLowerCase();

    return Object.keys(referalsDB).filter(user => {
        const sponsor = referalsDB[user];
        if (!sponsor || sponsor.trim().toLowerCase() !== leaderClean) return false;

        const profile = shopUsersDB[user];
        if (!profile) return false;

        // Отсекаем отказников, неактивных и заблокированных
        const isPaid = profile.isPaid;
        const isNotRefunded = profile.matrixPosition && profile.matrixPosition.status !== 'refunded';
        const isNotBlocked = !profile.isBlocked;

        return isPaid && isNotRefunded && isNotBlocked;
    });
}

/**
 * Подсчет и получение списка всех лидеров, выполнивших квалификацию (>= 10 активных личников)
 */
function getQualifiedLeaders(referalsDB, shopUsersDB) {
    const qualifiedLeaders = [];
    const allUsers = new Set([...Object.keys(referalsDB), ...Object.keys(shopUsersDB)]);

    allUsers.forEach(username => {
        // Системные и служебные логины не участвуют в лидерской квалификации
        if (['SYSTEM_ROOT', 'ADMIN_REFUND_OWNER'].includes(username)) return;

        const activeReferrals = getActiveDirectReferrals(username, referalsDB, shopUsersDB);
        if (activeReferrals.length >= 10) {
            qualifiedLeaders.push({
                username,
                activeDirectCount: activeReferrals.length
            });
        }
    });

    return qualifiedLeaders;
}

/**
 * Поиск первого квалифицированного Лидера вверх по реферальной цепочке
 */
function findBranchLeader(username, referalsDB, shopUsersDB) {
    let current = referalsDB[username];
    let visited = new Set();

    while (current && !visited.has(current)) {
        visited.add(current);

        if (['SYSTEM_ROOT', 'ADMIN_REFUND_OWNER'].includes(current)) break;

        const activeReferrals = getActiveDirectReferrals(current, referalsDB, shopUsersDB);
        if (activeReferrals.length >= 10) {
            return current; // Нашли ближайшего Лидера ветки!
        }

        current = referalsDB[current];
    }

    return null; // В ветке выше нет квалифицированного лидера
}

/**
 * Расчет накопленных/выплаченных лидерских бонусов (10 M) по прошествии 31 дня
 */
function calculateLeaderBranchBonuses(referalsDB, shopUsersDB) {
    const now = Date.now();
    let totalLeaderBonusPaid = 0;
    let totalLeaderBonusReserve = 0;
    const leaderRewardsMap = {}; // { leaderLogin: { paid: 0, reserve: 0, count: 0 } }

    Object.keys(shopUsersDB).forEach(newUser => {
        const profile = shopUsersDB[newUser];
        if (!profile || !profile.isPaid) return;
        if (profile.matrixPosition && profile.matrixPosition.status === 'refunded') return;

        // Ищем Лидера ветки для этого новичка
        const leader = findBranchLeader(newUser, referalsDB, shopUsersDB);
        if (!leader) return;

        if (!leaderRewardsMap[leader]) {
            leaderRewardsMap[leader] = { paid: 0, reserve: 0, totalCount: 0 };
        }

        const regDate = profile.paymentDate ? new Date(profile.paymentDate).getTime() : now;
        const daysPassed = Math.floor((now - regDate) / (1000 * 60 * 60 * 24));

        leaderRewardsMap[leader].totalCount++;

        if (daysPassed >= 31) {
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

module.exports = {
    getActiveDirectReferrals,
    getQualifiedLeaders,
    findBranchLeader,
    calculateLeaderBranchBonuses
};
