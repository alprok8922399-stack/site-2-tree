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
 * Конвертация внутренних баллов (Mitrons) в USD по курсу
 */
function mitronsToUsd(mitrons) {
    const RATE = 130 / 1000;
    return (mitrons * RATE).toFixed(2);
}

/**
 * Создание новой базовой карточки пользователя
 */
function createNewUserCard(username) {
    return {
        username: username,
        isPaid: false,
        paymentDate: null,
        balances: {
            mitrons: 0,
            usd: 0
        },
        matrixPosition: {
            currentCellId: null,
            status: 'inactive'
        }
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
            name: 'DAO Пул (Фонд развития)',
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
