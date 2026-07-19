/* === ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД backend/static.js === */

/**
 * Конвертирует индекс уровня в соответствующую букву алфавита (0 -> A, 25 -> Z, 26 -> AA, 27 -> AB...)
 * Обеспечивает бесконечную масштабируемость веерного почкования без риска краша сервера.
 */
function getLevelLetter(levelIndex) {
    let letter = '';
    let temp = levelIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

/**
 * Математический перевод строкового ID ячейки (например, 'A1', 'Z5', 'AA12') 
 * в единый глобальный сквозной индекс бинарного дерева (0, 1, 2...).
 * Гарантирует стопроцентную точность связей дочерних и родительских элементов.
 */
function cellIdToGlobalIndex(cellId) {
    if (!cellId) return 0;
    
    const letterPart = cellId.match(/^[A-Z]+/)[0];
    const numberPart = parseInt(cellId.match(/\d+$/)[0], 10);
    
    // Вычисляем индекс уровня с поддержкой многосимвольных названий (A=0, Z=25, AA=26...)
    let levelIndex = 0;
    for (let i = 0; i < letterPart.length; i++) {
        levelIndex = levelIndex * 26 + (letterPart.charCodeAt(i) - 64);
    }
    levelIndex--; // Переводим в 0-индексируемую систему
    
    // Смещение начала текущего уровня в глобальном бинарном дереве: (2^L) - 1
    const levelStartGlobalIndex = (1 << levelIndex) - 1;
    
    // Глобальный индекс = смещение уровня + позиция внутри уровня (с нуля)
    return levelStartGlobalIndex + (numberPart - 1);
}

/**
 * Курс конвертации Митронов в USD согласно ТЗ.
 * 1000 Митронов = 130 USD. Рубли полностью отсутствуют.
 */
function mitronsToUsd(mitrons) {
    const RATE = 130 / 1000;
    return (mitrons * RATE).toFixed(2);
}

/**
 * Возвращает дефолтную чистую структуру карточки покупателя для базы данных маркетплейса.
 * Интегрирована поддержка пула 5 ЗОЛОТЫХ ЯЧЕЕК (XYZ_1 - XYZ_5) для квалификаций.
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
