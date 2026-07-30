/**
 * Скрипт стресс-тестирования матрицы (test-bot.js)
 * Симулирует регистрацию и покупку пакетов N пользователей подряд.
 */

const http = require('http');

const BATCH_SIZE = 50; // Количество ботов для генерации
const API_URL = 'http://localhost:5000/api/shop/register';

async function sendRequest(username, uplineUser) {
    return new Promise((resolve, reject) => {
        const data = JSON.stringify({ 
            username, 
            uplineUser, 
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
    console.log(`🚀 Начинаем стресс-тест: создание ${BATCH_SIZE} пользователей...\n`);
    
    for (let i = 1; i <= BATCH_SIZE; i++) {
        const botName = `Bot_${i}`;
        try {
            const res = await sendRequest(botName, 'SYSTEM_ROOT');
            if (res.error) {
                console.error(`[${i}/${BATCH_SIZE}] ❌ Ошибка сервера для ${botName}:`, res.error);
            } else {
                console.log(`[${i}/${BATCH_SIZE}] ✅ ${botName} встал в ячейку: ${res.cellId}`);
            }
        } catch (err) {
            console.error(`[${i}/${BATCH_SIZE}] ❌ Сбой сети для ${botName}:`, err.message);
        }
    }
    
    console.log('\n🎉 Тест завершен! Проверь визуализацию матрицы в браузере.');
}

runTest();
