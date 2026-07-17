// static.js

// === 1. ГЛОБАЛЬНЫЕ КОНСТАНТЫ ===
const MITRON_RATE_USD = 130 / 1000; // 1 Митрон = 0.13 USD (исходя из константы 1000 Митронов = 130 USDT)
const USD_TO_RUB = 76.62;          // Текущий курс доллара к рублю (для расчетов в реальном времени)

// === 2. СТАТИЧЕСКИЕ ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

/**
 * Преобразует индекс уровня в буквенное обозначение (0 -> A, 1 -> B, 27 -> AB)
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
 * Преобразует ID ячейки (например, "C1") в её глобальный порядковый индекс в бинаре
 */
function cellIdToGlobalIndex(id) {
    const match = id.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;
    const letter = match[1];
    const num = parseInt(match[2], 10);
    
    let levelIndex = 0;
    for (let i = 0; i < letter.length; i++) {
        levelIndex = levelIndex * 26 + (letter.charCodeAt(i) - 64);
    }
    levelIndex -= 1;
    
    const levelStartGlobalIndex = (1 << levelIndex) - 1;
    return levelStartGlobalIndex + (num - 1);
}

/**
 * Конвертирует Митроны в Доллары США
 */
function mitronsToUsd(mitrons) {
    return (mitrons * MITRON_RATE_USD).toFixed(2);
}

/**
 * Конвертирует Митроны в Рубли (через USD)
 */
function mitronsToRub(mitrons) {
    const usd = mitrons * MITRON_RATE_USD;
    return (usd * USD_TO_RUB).toFixed(2);
}

// === 3. ИНИЦИАЛИЗАЦИЯ ДЕФОЛТНЫХ СУЩНОСТЕЙ (АРХИТЕКТУРА ДАННЫХ) ===

/**
 * Генерирует дефолтную карточку Покупателя со всеми новыми полями под ТЗ
 */
function createNewUserCard(username) {
    return {
        username: username,
        isPaid: false,               // Флаг оплаты сертификата
        paymentDate: null,           // Точная дата оплаты (для расчета 31 дня)
        isRealBuyer: false,          // Стал ли покупатель "Реальным" (31 день + подтверждение товара)
        
        // Балансы пользователя
        balances: {
            mitrons: 0,              // Внутренний баланс в Митронах
            usd: 0,                  // Отображаемый баланс в USD
            rub: 0                   // Отображаемый баланс в рублях
        },
        
        // Поля для Серебряных мест
        silverStatus: {
            isActive: false,         // Активировано ли Серебряное место (требуется 10 Реальных в 1-й линии)
            activatedAt: null,       // Время активации статуса
            realDirectReferralsCount: 0 // Счетчик Реальных покупателей, приглашенных ЛИЧНО
        },
        
        // Матричный след (где юзер сейчас находится для рендеринга и триггера)
        matrixPosition: {
            currentCellId: null,     // ID ячейки (например, 'C1')
            status: 'pending'        // 'pending', 'active', 'divided'
        }
    };
}

/**
 * Начальное состояние трехконтурного сейфа кошельков
 */
function createInitialWallets() {
    return {
        // Контур 1: Сверхсекретное холодное хранилище прибыли Создателя (450 Митронов с каждого чека)
        myWallet: {
            address: "0xCreatorColdWalletAddress...",
            balanceMitrons: 0
        },
        // Контур 2: Главный резерв ликвидности (сюда уходят 550 Митронов с каждой оплаты)
        payoutReserveWallet: {
            address: "0xPayoutReserveWalletAddress...",
            balanceMitrons: 0
        },
        // Контур 3: Операционный транзитный горячий кошелек (всегда пуст, наполняется строго под транзакцию)
        bufferWallet: {
            address: "0xBufferWalletAddress...",
            balanceMitrons: 0
        }
    };
}

// Экспортируем все наши функции и константы наружу
module.exports = {
    getLevelLetter,
    cellIdToGlobalIndex,
    mitronsToUsd,
    mitronsToRub,
    createNewUserCard,
    createInitialWallets
};
