const API_URL = 'https://site-1-registrar.onrender.com';

const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const refTableBody = document.getElementById('refTableBody');

// Кнопки управления роботом
const startBtn = document.getElementById('startBtn');
const stopBtn = document.getElementById('stopBtn');
const logDiv = document.getElementById('log');

let currentRootId = 'A1'; 
let searchTargetUser = ''; 
let isRunning = false;
let userIndex = 1;
let timerId = null;

const LEVELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

function printLog(text, type = '') {
    if (!logDiv) return;
    const span = document.createElement('span');
    span.className = type;
    span.innerText = `\n> ${text}`;
    logDiv.appendChild(span);
    logDiv.scrollTop = logDiv.scrollHeight;
}

// Логика управления роботом-тестировщиком
if (startBtn && stopBtn) {
    startBtn.addEventListener('click', () => {
        isRunning = true;
        startBtn.style.display = 'none';
        stopBtn.style.display = 'block';
        printLog('Робот запущен. Имитация покупок на маркетплейсе.', 'info');
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
        // 1. Имитируем регистрацию на Маркетплейсе (Сайт №1)
        const regRes = await fetch(`${API_URL}/api/shop/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const regData = await regRes.json();

        if (regData.error) {
            printLog(`⚠️ Отклонено: ${regData.error}`, 'err');
            userIndex++;
            timerId = setTimeout(runNextCycle, 1000);
            return;
        }

        // 2. Имитируем оплату 10 000 руб. в магазине, чтобы юзер улетел в матрицу
        const payRes = await fetch(`${API_URL}/api/shop/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, amount: 10000 })
        });
        const payData = await payRes.json();

        if (payData.error) {
            printLog(`⚠️ Ошибка оплаты: ${payData.error}`, 'err');
        } else {
            printLog(`Вставка: ${username} оплатил товар и встал в матрицу.`, 'succ');
            userIndex++;
            await fetchTree(); // Обновляем экран
        }
    } catch (err) {
        printLog(`⚠️ Ошибка сети: Нет связи с Сайтом №2`, 'err');
    }

    if (isRunning) {
        timerId = setTimeout(runNextCycle, 2000);
    }
}

// Управление масштабом (зум)
if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
        if (mainTreeDisplay) mainTreeDisplay.style.transform = `scale(${e.target.value})`;
    });
}

// Поиск
if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) {
            searchTargetUser = val;
            findUserAndFocus(val);
        } else {
            currentRootId = 'A1';
            searchTargetUser = '';
            fetchTree();
        }
    });
}

async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/api/tree`);
        const data = await res.json();
        renderDynamicSplitting(data);
        renderTableList(data);
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }
}

function findUserAndFocus(username) {
    fetch(`${API_URL}/api/tree`)
        .then(res => res.json())
        .then(tree => {
            let foundCellId = null;
            for (const [id, cell] of Object.entries(tree)) {
                if (cell && cell.user && cell.user.toLowerCase() === username.toLowerCase()) {
                    foundCellId = id;
                    break;
                }
            }
            
            if (foundCellId) {
                const parsed = parseCell(foundCellId);
                let rootId = foundCellId; 
                
                function getPrevLevelLetter(letter) {
                    const idx = LEVELS.indexOf(letter);
                    if (idx <= 0) return 'A';
                    return LEVELS[idx - 1];
                }
                
                let currentLetter = parsed.letter;
                let currentNum = parsed.num;
                
                let step1Letter = getPrevLevelLetter(currentLetter);
                let step1Num = Math.floor((currentNum + 1) / 2);
                
                let step2Letter = getPrevLevelLetter(step1Letter);
                let step2Num = Math.floor((step1Num + 1) / 2);
                
                let candidateRoot = `${step2Letter}${step2Num}`;
                
                if (step2Letter === 'A' || tree[candidateRoot]) {
                    rootId = candidateRoot;
                } else {
                    let candidateRoot2 = `${step1Letter}${step1Num}`;
                    rootId = candidateRoot2;
                }
                
                if (parsed.letter === 'A') rootId = 'A1';

                currentRootId = rootId;
                searchTargetUser = username; 
                renderDynamicSplitting(tree);
                renderTableList(tree);
            } else {
                alert(`Пользователь ${username} не найден`);
            }
        });
}

function getCellHTML(cell, roleClass, fallbackId = '-') {
    if (!cell) {
        return `<div class="cell ${roleClass}"><div class="cell-id">${fallbackId}</div><div class="cell-user">-</div></div>`;
    }
    const isOccupied = cell.user ? 'occupied' : '';
    const displayUser = cell.user ? cell.user : '-';
    const isFocused = (cell.user && cell.user === searchTargetUser) ? 'focused-cell' : '';

    return `
        <div class="cell ${roleClass} ${isOccupied} ${isFocused}" onclick="switchFocus('${cell.id}')">
            <div class="cell-id">${cell.id}</div>
            <div class="cell-user">${displayUser}</div>
        </div>
    `;
}

window.switchFocus = function(cellId) {
    currentRootId = cellId;
    fetchTree();
};

function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids) {
    return `
        <div class="semerka-matrix">
            <div class="matrix-row">${getCellHTML(topCell, 'level-1', ids.top)}</div>
            <div class="matrix-row">
                ${getCellHTML(leftShoulder, 'level-2', ids.left)}
                ${getCellHTML(rightShoulder, 'level-2', ids.right)}
            </div>
            <div class="matrix-row">
                ${getCellHTML(bottom4[0], 'level-3', ids.b1)}
                ${getCellHTML(bottom4[1], 'level-3', ids.b2)}
                ${getCellHTML(bottom4[2], 'level-3', ids.b3)}
                ${getCellHTML(bottom4[3], 'level-3', ids.b4)}
            </div>
        </div>
    `;
}

function parseCell(id) {
    const match = id.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return { letter: match[1], num: parseInt(match[2], 10) };
}

function getNextLevelLetter(letter) {
    const idx = LEVELS.indexOf(letter);
    if (idx === -1 || idx === LEVELS.length - 1) return letter;
    return LEVELS[idx + 1];
}

function renderDynamicSplitting(tree) {
    if (!mainTreeDisplay) return;
    let activeMatricesHTML = [];
    let queue = [currentRootId]; 
    let processedNodes = new Set();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (processedNodes.has(currentId)) continue;
        processedNodes.add(currentId);

        const topCell = tree[currentId] || null;
        const parsed = parseCell(currentId);
        if (!parsed) continue;

        const nextLetter = getNextLevelLetter(parsed.letter);       
        const bottomLetter = getNextLevelLetter(nextLetter);        

        const leftLNum = parsed.num * 2 - 1;
        const rightLNum = parsed.num * 2;

        const leftShoulderId = `${nextLetter}${leftLNum}`;
        const rightShoulderId = `${nextLetter}${rightLNum}`;

        const b1 = `${bottomLetter}${leftLNum * 2 - 1}`;
        const b2 = `${bottomLetter}${leftLNum * 2}`;
        const b3 = `${bottomLetter}${rightLNum * 2 - 1}`;
        const b4 = `${bottomLetter}${rightLNum * 2}`;

        const leftShoulder = tree[leftShoulderId] || null;
        const rightShoulder = tree[rightShoulderId] || null;
        const bottom4 = [
            tree[b1] || null,
            tree[b2] || null,
            tree[b3] || null,
            tree[b4] || null
        ];

        const isMatrixClosed = (topCell && topCell.user) && 
                               (leftShoulder && leftShoulder.user) && 
                               (rightShoulder && rightShoulder.user) && 
                               bottom4.every(cell => cell && cell.user);

        if (isMatrixClosed) {
            queue.push(leftShoulderId);
            queue.push(rightShoulderId);
        } else {
            const ids = { top: currentId, left: leftShoulderId, right: rightShoulderId, b1, b2, b3, b4 };
            activeMatricesHTML.push(buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids));
        }
    }

    mainTreeDisplay.innerHTML = `
        <div class="matrices-row">
            ${activeMatricesHTML.join('')}
        </div>
    `;
}

function renderTableList(tree) {
    if (!refTableBody) return;
    let html = '';
    let list = [];
    for (const [id, cell] of Object.entries(tree)) {
        if (cell && cell.user) {
            list.push({ id: id, user: cell.user });
        }
    }
    
    list.sort((a, b) => a.id.localeCompare(b.id, undefined, {numeric: true, sensitivity: 'base'}));

    list.forEach(item => {
        const isCurrentSearch = (item.user === searchTargetUser) ? 'style="background: #ff3366; color: white; font-weight:bold;"' : '';
        html += `
            <tr ${isCurrentSearch} onclick="switchFocus('${item.id}')">
                <td><strong>${item.user}</strong></td>
                <td>${item.id}</td>
            </tr>
        `;
    });

    refTableBody.innerHTML = html || '<tr><td colspan="2" style="text-align:center;">База пуста</td></tr>';
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Очистить базу данных дерева?')) return;
        try {
            const res = await fetch(`${API_URL}/api/reset`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                userIndex = 1;
                currentRootId = 'A1';
                searchTargetUser = '';
                printLog('База сброшена.', 'info');
                await fetchTree();
            }
        } catch (err) {
            printLog('Ошибка при сбросе', 'err');
        }
    });
}

// Запуск инициализации при открытии страницы
fetchTree();
// Автообновление экрана каждые 2 секунды
setInterval(fetchTree, 2000);
