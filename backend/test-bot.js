/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/backend/test-bot.js
 * Назначение: Скрипт стресс-тестирования структуры
 * Симулирует регистрацию и покупку единиц N пользователей подряд 
 * с умным распределением рефералов (до 15 личников на спонсора).
 * =========================================================
 */

const http = require('http');
const https = require('https');

const BATCH_SIZE = 50; // Количество ботов для генерации

// Используем порт из переменных окружения или дефолтный 5000
const PORT = process.env.PORT || 5000;
const API_URL = process.env.SITE2_URL 
    ? `${process.env.SITE2_URL}/api/shop/register` 
    : `http://localhost:${PORT}/api/shop/register`;

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

        const targetUrl = new URL(API_URL);
        const transport = targetUrl.protocol === 'https:' ? https : http;

        const req = transport.request(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            },
            timeout: 15000 // 15 секунд таймаут
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(body);
                    resolve(json);
                } catch (e) {
                    resolve({ error: `Сервер вернул некорректный ответ (не JSON): ${body.substring(0, 50)}...` });
                }
            });
        });

        req.on('timeout', () => {
            req.destroy();
            reject(new Error('Превышено время ожидания ответа (Таймаут)'));
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runTest() {
    console.log(`🚀 Начинаем умный стресс-тест: создание ${BATCH_SIZE} пользователей...`);
    console.log(`🎯 Целевой URL: ${API_URL}\n`);
    
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

                console.log(`[${i}/${BATCH_SIZE}] ✅ ${botName} встал на позицию: ${res.cellId || 'OK'} (Спонсор: ${chosenSponsor})`);
            }
        } catch (err) {
            console.error(`[${i}/${BATCH_SIZE}] ❌ Сбой сети для ${botName}:`, err.message);
        }

        // Пауза 100 мс между запросами
        await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    console.log('\n🎉 Тест завершен! Проверь визуализацию структуры в браузере.');
}

runTest();
