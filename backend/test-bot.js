/**
 * Скрипт стресс-тестирования структуры (test-bot.js)
 * Симулирует регистрацию и покупку единиц N пользователей подряд с умным распределением рефералов.
 */

const http = require('http');

const BATCH_SIZE = 50; // Количество ботов для генерации
const API_URL = 'http://localhost:5000/api/shop/register';

// Карта для отслеживания количества личников у каждого пользователя
const sponsorCounts = {
    'SYSTEM_ROOT': 0
};

// Выбор спонсора: ограничение ~15 личников на человека, затем подхватываются следующие
function getSmartSponsor() {
    const MAX_DIRECT_PER_SPONSOR = 15;

    // 1. Если у SYSTEM_ROOT меньше 15 личников, ставим под него
    if (sponsorCounts['SYSTEM_ROOT'] < MAX_DIRECT_PER_SPONSOR) {
        return 'SYSTEM_ROOT';
    }

    // 2. Ищем доступных пользователей, у которых меньше 15 личников
    const availableSponsors = Object.keys(sponsorCounts).filter(user => sponsorCounts[user] < MAX_DIRECT_PER_SPONSOR);

    if (availableSponsors.length > 0) {
        // Выбираем случайного спонсора из доступных
        const randomIndex = Math.floor(Math.random() * availableSponsors.length);
        return availableSponsors[randomIndex];
    }

    // Резервный вариант: под SYSTEM_ROOT
    return 'SYSTEM_ROOT';
}

async function sendRequest(username, uplineUser) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ 
            username, 
            uplineUser, 
            sponsor: uplineUser,
            unitsCount: 1,
            cellsCount: 1,
            amountMitrons: 1000 
        });
        
        const req = http.request(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    resolve(JSON.parse(body));
                } catch (e) {
                    reject(new Error(`Ошибка парсинга ответа: ${body}`));
                }
            });
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runTest() {
    console.log(`🚀 Начинаем умный стресс-тест: создание ${BATCH_SIZE} пользователей...\n`);
    
    for (let i = 1; i <= BATCH_SIZE; i++) {
        const botName = `AutoBot_${Math.floor(1000 + Math.random() * 9000)}_${Math.floor(1000 + Math.random() * 9000)}`;
        const chosenSponsor = getSmartSponsor();

        try {
            const res = await sendRequest(botName, chosenSponsor);
            if (res.error) {
                console.error(`[${i}/${BATCH_SIZE}] ❌ Ошибка сервера для ${botName}:`, res.error);
            } else {
                // Фиксируем регистрацию у спонсора
                sponsorCounts[chosenSponsor] = (sponsorCounts[chosenSponsor] || 0) + 1;
                // Добавляем нового бота как потенциального спонсора
                sponsorCounts[botName] = 0;

                console.log(`[${i}/${BATCH_SIZE}] ✅ ${botName} встал на позицию: ${res.cellId} (Спонсор: ${chosenSponsor})`);
            }
        } catch (err) {
            console.error(`[${i}/${BATCH_SIZE}] ❌ Сбой сети для ${botName}:`, err.message);
        }
    }
    
    console.log('\n🎉 Тест завершен! Проверь визуализацию структуры в браузере.');
}

runTest();
