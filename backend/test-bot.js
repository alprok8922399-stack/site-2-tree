/**
 * Скрипт стресс-тестирования матрицы (test-bot.js)
 * Симулирует регистрацию и покупку пакетов N пользователей подряд.
 */

const http = require('http');

const BATCH_SIZE = 50; // Количество ботов для генерации
const API_URL = 'http://localhost:5000/api/shop/pay';

async function sendRequest(username, sponsor) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ username, sponsor, amount: 1000 });
        
        const req = http.request(API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(data)
            }
        }, (res) => {
            let body = '';
            res.on('data', chunk => body += chunk);
            res.on('end', () => resolve(JSON.parse(body)));
        });

        req.on('error', reject);
        req.write(data);
        req.end();
    });
}

async function runTest() {
    console.log(`🚀 Начинаем стресс-тест: создание ${BATCH_SIZE} пользователей...\n`);
    
    for (let i = 1; i <= BATCH_SIZE; i++) {
        const botName = `Bot_${i}`;
        try {
            const res = await sendRequest(botName, 'SYSTEM_ROOT');
            console.log(`[${i}/${BATCH_SIZE}] ✅ ${botName} встал в ячейку: ${res.cellId}`);
        } catch (err) {
            console.error(`[${i}/${BATCH_SIZE}] ❌ Ошибка для ${botName}:`, err.message);
        }
    }
    
    console.log('\n🎉 Тест завершен! Проверь визуализацию матрицы в браузере.');
}

runTest();
