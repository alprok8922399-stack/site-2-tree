// backend/static.js

/**
 * Конвертирует индекс уровня в соответствующую букву алфавита (0 -> A, 1 -> B, 2 -> C, и т.д.)
 * Поддерживает корректный переход на динамические уровни.
 */
function getLevelLetter(levelIndex) {
    return String.fromCharCode(65 + levelIndex);
}

/**
 * Математический перевод строкового ID ячейки (например, 'A1', 'B2', 'C4') 
 * в единый глобальный сквозной индекс бинарного дерева (0, 1, 2...).
 * Гарантирует точность привязки дочерних элементов по формуле дерева.
 */
function cellIdToGlobalIndex(cellId) {
    if (!cellId) return 0;
    
    const letterPart = cellId.match(/^[A-Z]+/)[0];
    const numberPart = parseInt(cellId.match(/\d+$/)[0], 10);
    
    // Вычисляем индекс уровня (A -> 0, B -> 1, C -> 2...)
    const levelIndex = letterPart.charCodeAt(0) - 65;
    
    // Смещение начала текущего уровня в глобальном массиве: (2^L) - 1
    const levelStartGlobalIndex = (1 << levelIndex) - 1;
    
    // Глобальный индекс = смещение уровня + позиция внутри уровня (с нуля)
    return levelStartGlobalIndex + (numberPart - 1);
}

/**
 * Хардкодный курс конвертации Митронов в USD согласно ТЗ.
 * 1000 Митронов = 130 USD. Любые рубли полностью стерты.
 */
function mitronsToUsd(mitrons) {
    const RATE = 130 / 1000;
    return (mitrons * RATE).toFixed(2);
}

/**
 * Возвращает дефолтную чистую структуру карточки покупателя для базы данных маркетплейса.
 * Реализована полная поддержка 5 ЗОЛОТЫХ ЯЧЕЕК (XYZ_1 - XYZ_5).
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
            status: 'inactive' // active / inactive
        },
        // Данные для квалификации Золотых Мест
        goldenStatus: {
            realDirectReferralsCount: 0, // Количество реальных людей в первой линии
            unlockedGoldenCells: []       // Список активированных ячеек из пула [XYZ_1..XYZ_5]
        }
    };
}

/**
 * Инициализация системных контуров сейфов-кошельков распределения ликвидности (70% на 30%)
 */
function createInitialWallets() {
    return {
        // Резерв выплат маркетплейса (сюда поступает 70% от активаций = 700 Митронов)
        payoutReserveWallet: {
            balanceMitrons: 0
        },
        // Холодный сейф создателя системы (сюда поступает 30% от активаций = 300 Митронов)
        myWallet: {
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
