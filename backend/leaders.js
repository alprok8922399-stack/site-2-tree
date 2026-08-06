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
 * Сортируем по дате регистрации/оплаты для точного определения 11-го и последующих
 */
function getActiveDirectReferrals(leaderUsername, referalsDB, shopUsersDB) {
    if (!leaderUsername || !referalsDB) return [];

    const leaderClean = leaderUsername.trim().toLowerCase();

    const referrals = Object.keys(referalsDB).filter(user => {
        const sponsor = referalsDB[user];
        if (!sponsor || sponsor.trim().toLowerCase() !== leaderClean) return false;

        const profile = shopUsersDB[user];
        if (!profile) return false;

        const isPaid = profile.isPaid;
        const isNotRefunded = profile.matrixPosition && profile.matrixPosition.status !== 'refunded';
        const isNotBlocked = !profile.isBlocked;

        return isPaid && isNotRefunded && isNotBlocked;
    });

    // Сортируем по дате оплаты (или регистрации) от старых к новым
    return referrals.sort((a, b) => {
        const timeA = shopUsersDB[a]?.paymentDate ? new Date(shopUsersDB[a].paymentDate).getTime() : 0;
        const timeB = shopUsersDB[b]?.paymentDate ? new Date(shopUsersDB[b].paymentDate).getTime() : 0;
        return timeA - timeB;
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
 * Правило: Лидер начинает получать по 7 M с каждого участника, начиная с 11-го личника!
 * Первые 10 личников квалификационные — с них 7 M не начисляются.
 */
function calculateLeaderBranchBonuses(referalsDB, shopUsersDB) {
    const now = Date.now();
    let totalLeaderBonusPaid = 0;
    let totalLeaderBonusReserve = 0;
    const leaderRewardsMap = {};

    if (!shopUsersDB) return { totalLeaderBonusPaid: 0, totalLeaderBonusReserve: 0, leaderRewardsMap };

    // Собираем всех Лидеров и их личников начиная с 11-го
    const leadersList = getQualifiedLeaders(referalsDB, shopUsersDB);
    const eligibleBonusUsers = new Set();

    leadersList.forEach(leaderInfo => {
        const referrals = leaderInfo.referralsList;
        // Начиная с 11-го (индекс 10 и выше)
        if (referrals.length > 10) {
            const extraReferrals = referrals.slice(10);
            extraReferrals.forEach(u => eligibleBonusUsers.add(u));
        }
    });

    Object.keys(shopUsersDB).forEach(newUser => {
        const profile = shopUsersDB[newUser];
        if (!profile || !profile.isPaid) return;
        if (profile.matrixPosition && profile.matrixPosition.status === 'refunded') return;

        const leader = findBranchLeader(newUser, referalsDB, shopUsersDB);
        if (!leader) return;

        // Если это личник данного Лидера, но он входит в первые 10 квалификационных — пропускаем!
        const directSponsor = referalsDB[newUser];
        if (directSponsor && directSponsor.trim().toLowerCase() === leader.trim().toLowerCase()) {
            if (!eligibleBonusUsers.has(newUser)) {
                return;
            }
        }

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

        // Срок выдержки выплат — строго 33 дня, размер бонуса — 7 M по ТЗ
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
