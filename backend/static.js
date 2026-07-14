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

// === 3. РАСЧЕТ И РАСПРЕДЕЛЕНИЕ БОНУСОВ ===

/**
 * Начисляет линейный бонус на 3 уровня вверх
 */
function distributeLinearBonus(buyer, referalsDB, shopUsersDB) {
    const log = [];
    const levels = [50, 10, 10]; // 1-й, 2-й и 3-й уровни спонсорства
    let current = buyer;

    for (let i = 0; i < levels.length; i++) {
        const sponsor = referalsDB[current];
        if (!sponsor) {
            log.push(`Уровень ${i + 1}: Спонсор отсутствует, бонус ${levels[i]} Митронов направлен системе.`);
            break;
        }

        // Если спонсор зарегистрирован в магазине, начисляем ему баланс
        if (shopUsersDB[sponsor]) {
            shopUsersDB[sponsor].balances.mitrons += levels[i];
            shopUsersDB[sponsor].balances.usd = parseFloat(mitronsToUsd(shopUsersDB[sponsor].balances.mitrons));
            shopUsersDB[sponsor].balances.rub = parseFloat(mitronsToRub(shopUsersDB[sponsor].balances.mitrons));
            log.push(`Уровень ${i + 1}: Спонсор ${sponsor} получил ${levels[i]} Митронов.`);
        } else {
            log.push(`Уровень ${i + 1}: Спонсор ${sponsor} не имеет карточки покупателя. Бонус направлен системе.`);
        }
        current = sponsor;
    }
    return log;
}

/**
 * Распределяет глубинный Серебряный бонус (10 Митронов) первому активному Серебряному спонсору выше по ветке
 */
function distributeSilverBonus(buyer, referalsDB, shopUsersDB) {
    let current = referalsDB[buyer];
    
    // Пропускаем первого спонсора, так как премия идет со второго уровня структуры и глубже
    if (!current) return "Нет спонсора для распределения Серебряного бонуса.";
    current = referalsDB[current];

    while (current) {
        const sponsorCard = shopUsersDB[current];
        if (sponsorCard && sponsorCard.silverStatus && sponsorCard.silverStatus.isActive) {
            sponsorCard.balances.mitrons += 10;
            sponsorCard.balances.usd = parseFloat(mitronsToUsd(sponsorCard.balances.mitrons));
            sponsorCard.balances.rub = parseFloat(mitronsToRub(sponsorCard.balances.mitrons));
            return `Серебряный бонус 10 Митронов успешно начислен лидеру: ${current}`;
        }
        current = referalsDB[current];
    }
    return "В спонсорской ветке нет активных Серебряных мест. Начисление не произведено.";
}

// === 4. ИНИЦИАЛИЗАЦИЯ ДЕФОЛТНЫХ СУЩНОСТЕЙ ===

function createNewUserCard(username) {
    return {
        username: username,
        isPaid: false,
        paymentDate: null,
        isRealBuyer: false,
        
        balances: {
            mitrons: 0,
            usd: 0,
            rub: 0
        },
        
        silverStatus: {
            isActive: false,
            activatedAt: null,
            realDirectReferralsCount: 0
        },
        
        matrixPosition: {
            currentCellId: null,
            status: 'pending'
        }
    };
}

function createInitialWallets() {
    return {
        myWallet: {
            address: "0xCreatorColdWalletAddress...",
            balanceMitrons: 0
        },
        payoutReserveWallet: {
            address: "0xPayoutReserveWalletAddress...",
            balanceMitrons: 0
        },
        bufferWallet: {
            address: "0xBufferWalletAddress...",
            balanceMitrons: 0
        }
    };
}

module.exports = {
    getLevelLetter,
    cellIdToGlobalIndex,
    mitronsToUsd,
    mitronsToRub,
    distributeLinearBonus,
    distributeSilverBonus,
    createNewUserCard,
    createInitialWallets
};
