/**
 * Модуль хелперов и статики (Сайт 2)
 * Проект: MITRON
 */

/**
 * Превращает индекс уровня/столбца в буквенное обозначение по аналогии с Excel:
 * 0 -> A, 1 -> B ... 25 -> Z, 26 -> AA, 27 -> AB и т.д.
 */
function getLevelLetter(index) {
    let letter = '';
    while (index >= 0) {
        letter = String.fromCharCode((index % 26) + 65) + letter;
        index = Math.floor(index / 26) - 1;
    }
    return letter;
}

/**
 * Преобразует ID ячейки (например 'AA1' или 'C3') в глобальный численный индекс
 */
function cellIdToGlobalIndex(cellId) {
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;
    
    const letters = match[1];
    const num = parseInt(match[2], 10);
    
    let levelIndex = 0;
    for (let i = 0; i < letters.length; i++) {
        levelIndex = levelIndex * 26 + (letters.charCodeAt(i) - 64);
    }
    levelIndex -= 1; // Корректировка к 0-индексу
    
    const levelStartGIdx = (1 << levelIndex) - 1;
    return levelStartGIdx + (num - 1);
}

/**
 * Конвертация внутренних баллов (Mitrons) в USD по курсу (1000 M = $130 USD)
 */
function mitronsToUsd(mitrons) {
    const RATE = 130 / 1000;
    return (mitrons * RATE).toFixed(2);
}

/**
 * Создание расширенной базовой карточки пользователя (поддержка 31-дневных резервов)
 */
function createNewUserCard(username) {
    return {
        username: username,
        isPaid: false,
        paymentDate: null,
        isBlocked: false,
        ownedByAdmin: false,
        payoutsSuspended: false,
        balances: {
            mitrons: 0,
            usd: 0
        },
        matrixPosition: {
            currentCellId: null,
            occupiedCells: [],
            status: 'inactive', // inactive -> active -> payout_pending -> completed
            reservedPerCell: 0,  // 250 M с каждой ячейки
            reservedMatrixM: 0,  // 1000 M при закрытии 4 ячеек
            payoutEligibleDate: null // Дата разблокировки через 31 день
        },
        pendingReferralRewards: [] // Резерв рефералок: [{ fromUser, amount, level, unlockDate, status }]
    };
}

/**
 * Инициализация системных кошельков
 */
function createInitialWallets() {
    return {
        adminWallet: {
            name: 'Административный кошелек (Логистика / Товар)',
            balanceMitrons: 0
        },
        daoWallet: {
            name: 'DAO Пул (Фонд развития и Резерв)',
            balanceMitrons: 0
        }
    };
}

module.exports = {
    getLevelLetter,
    cellIdToGlobalIndex,
    mitronsToUsd,
    createNewUserCard,
    createInitialWallets
};
