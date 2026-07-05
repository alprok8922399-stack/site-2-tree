const API_URL = '/api';
let isRunning = false;
let userIndex = 1;
let timerId = null;

// Элементы интерфейса секретной админки
const logDiv = document.getElementById('log');
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const treeContainer = document.getElementById('treeContainer');
const resetBtn = document.getElementById('resetBtn');

function printLog(text, type = '') {
    if (!logDiv) return;
    const span = document.createElement('span');
    span.className = type;
    span.innerText = `\n> ${text}`;
    logDiv.appendChild(span);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Запуск автоматического тестирования (имитация покупок на Сайте №1)
if (startBtn && stopBtn) {
    startBtn.addEventListener('click', () => {
        isRunning = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        printLog('Робот запущен. Умный режим авто-покупок маркетплейса.', 'info');
        runNextCycle();
    });

    stopBtn.addEventListener('click', () => {
        isRunning = false;
        startBtn.style.display = 'block';
        stopBtn.style.display = 'none';
        printLog('Автомат остановлен.', 'err');
        if (timerId) clearTimeout(timerId);
    });
}

async function runNextCycle() {
    if (!isRunning) return;

    const username = `AutoUser_${userIndex}`;
    printLog(`Генерация: ${username}...`);

    try {
        // ШАГ 1: Регистрируем робота в магазине (Сайт №1)
        const regRes = await fetch(`${API_URL}/shop/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const regData = await regRes.json();

        if (regData.error) {
            printLog(`⚠️ Магазин отклонил: ${regData.error}`, 'err');
            userIndex++;
            timerId = setTimeout(runNextCycle, 1500);
            return;
        }

        // ШАГ 2: Имитируем оплату товара на 10 000 руб., чтобы юзер молча улетел в матрицу
        const payRes = await fetch(`${API_URL}/shop/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, amount: 10000 })
        });
        const payData = await payRes.json();

        if (payData.error) {
            printLog(`⚠️ Ошибка платежа: ${payData.error}`, 'err');
        } else {
            printLog(`Вставка: ${username} успешно оплатил товар и вошел в матрицу.`, 'succ');
            userIndex++;
            // Обновляем отрисовку дерева на экране админки
            await loadTree();
        }

    } catch (err) {
        printLog(`⚠️ Ошибка сети: Нет связи с Общим Бэкендом`, 'err');
    }

    if (isRunning) {
        timerId = setTimeout(runNextCycle, 2000);
    }
}

// Загрузка и отрисовка дерева матрицы на секретном сайте
async function loadTree() {
    if (!treeContainer) return;
    try {
        const res = await fetch(`${API_URL}/tree`);
        const tree = await res.json();
        
        treeContainer.innerHTML = '';
        
        // Сортируем ячейки по уровням для красивого вывода
        const sortedKeys = Object.keys(tree).sort((a, b) => {
            const lvlA = a.charAt(0);
            const lvlB = b.charAt(0);
            if (lvlA !== lvlB) return lvlA.localeCompare(lvlB);
            return parseInt(a.slice(1)) - parseInt(b.slice(1));
        });

        sortedKeys.forEach(key => {
            const cell = tree[key];
            if (cell.user) {
                const div = document.createElement('div');
                div.className = 'tree-node';
                div.innerHTML = `<strong>${cell.id}</strong><br><small>${cell.user}</small>`;
                treeContainer.appendChild(div);
            }
        });
    } catch (err) {
        console.error('Ошибка обновления карты дерева', err);
    }
}

// Кнопка полного сброса базы
if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Вы уверены, что хотите очистить всю базу данных?')) return;
        try {
            const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
            if (res.ok) {
                printLog('База данных успешно очищена. Структура сброшена.', 'info');
                userIndex = 1;
                await loadTree();
            }
        } catch (err) {
            printLog('Не удалось сбросить базу данных', 'err');
        }
    });
}

// При входе на страницу сразу подгружаем текущую карту
loadTree();
