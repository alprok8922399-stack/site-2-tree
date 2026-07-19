/* === ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД (ГАЛЕРЕЯ НЕЗАВИСИМЫХ БЛОКОВ) === */
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .matrices-row {
            display: flex;
            flex-direction: row;
            flex-wrap: nowrap;
            overflow-x: auto;
            gap: 25px;
            padding: 15px 10px;
            justify-content: flex-start;
            align-items: flex-start;
            scroll-behavior: smooth;
            -webkit-overflow-scrolling: touch;
        }
        
        .matrix-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 280px;
            flex-shrink: 0;
        }

        .semerka-matrix {
            background: rgba(255, 255, 255, 0.03);
            border: 2px solid #334257;
            border-radius: 12px;
            padding: 12px;
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 10px;
            width: 100%;
            box-sizing: border-box;
        }

        .matrix-row {
            display: flex;
            justify-content: center;
            align-items: center;
            gap: 8px;
            width: 100%;
        }

        .cell {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            border-radius: 6px;
            height: 50px;
            box-sizing: border-box;
            color: #fff;
            font-family: sans-serif;
            cursor: pointer;
            transition: all 0.2s ease;
        }

        .cell-id { font-size: 9px; opacity: 0.7; margin-bottom: 2px; }
        .cell-user { font-size: 11px; font-weight: bold; max-width: 90%; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        .level-gold { background: #ffd700 !important; color: #000 !important; border: 1px solid #cca100; width: 85px; }
        .level-skyblue { background: #87ceeb !important; color: #000 !important; border: 1px solid #5fa9c7; width: 80px; }
        .level-gray { background: #4a4a4a !important; color: #fff !important; border: 1px solid #666; width: 62px; }

        .highlight-search { border: 3px solid #ff4141 !important; box-shadow: 0 0 15px #ff4141 !important; transform: scale(1.05); }
    `;
    document.head.appendChild(style);
})();

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');

// Получение буквы уровня
function getLevelLetter(levelIndex) {
    let letter = '';
    let temp = levelIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return letter;
}

// ДВИЖОК: Поиск только незавершенных матриц
function renderDynamicSplitting(tree) {
    if (!mainTreeDisplay) return;

    let activeMatrices = [];
    // Очередь: уровень, номер матрицы
    let queue = [{ level: 0, num: 1 }]; 
    let processed = new Set();

    while (queue.length > 0) {
        const current = queue.shift();
        const currentLetter = getLevelLetter(current.level);
        const key = `${currentLetter}${current.num}`;
        
        if (processed.has(key)) continue;
        processed.add(key);

        // Определяем индексы для проверки заполнения фундамента
        const baseLevel = current.level + 2;
        const baseLetter = getLevelLetter(baseLevel);
        const baseNumStart = (current.num - 1) * 4 + 1;
        
        const b1 = `${baseLetter}${baseNumStart}`;
        const b2 = `${baseLetter}${baseNumStart + 1}`;
        const b3 = `${baseLetter}${baseNumStart + 2}`;
        const b4 = `${baseLetter}${baseNumStart + 3}`;

        // ПРОВЕРКА: Весь ли ряд заполнен?
        const isFull = (tree[b1] && tree[b1].user) && 
                       (tree[b2] && tree[b2].user) && 
                       (tree[b3] && tree[b3].user) && 
                       (tree[b4] && tree[b4].user);

        if (isFull) {
            // Если ряд полон — матрица считается закрытой ("почковалась").
            // Активной её не рендерим, ищем её детей в очереди.
            queue.push({ level: current.level + 1, num: current.num * 2 - 1 });
            queue.push({ level: current.level + 1, num: current.num * 2 });
        } else {
            // Ряд НЕ полон — это активная матрица. Рендерим её.
            activeMatrices.push({ level: current.level, num: current.num });
        }
    }

    // Отрисовка галереи активных матриц
    let finalHTML = activeMatrices.map(m => {
        const currentLetter = getLevelLetter(m.level);
        const nextLetter = getLevelLetter(m.level + 1);
        const baseLetter = getLevelLetter(m.level + 2);
        
        const idTop = `${currentLetter}${m.num}`;
        const idL = `${nextLetter}${m.num * 2 - 1}`;
        const idR = `${nextLetter}${m.num * 2}`;
        const baseStart = (m.num - 1) * 4 + 1;

        return `
            <div class="matrix-column">
                <div class="semerka-matrix">
                    <div class="matrix-row">${createCellMarkup(tree[idTop], 'level-gold', idTop)}</div>
                    <div class="matrix-row">
                        ${createCellMarkup(tree[idL], 'level-skyblue', idL)}
                        ${createCellMarkup(tree[idR], 'level-skyblue', idR)}
                    </div>
                    <div class="matrix-row">
                        ${createCellMarkup(tree[`${baseLetter}${baseStart}`], 'level-gray', `${baseLetter}${baseStart}`)}
                        ${createCellMarkup(tree[`${baseLetter}${baseStart + 1}`], 'level-gray', `${baseLetter}${baseStart + 1}`)}
                        ${createCellMarkup(tree[`${baseLetter}${baseStart + 2}`], 'level-gray', `${baseLetter}${baseStart + 2}`)}
                        ${createCellMarkup(tree[`${baseLetter}${baseStart + 3}`], 'level-gray', `${baseLetter}${baseStart + 3}`)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    mainTreeDisplay.innerHTML = `<div class="matrices-row">${finalHTML || '<p style="color:#fff; padding:20px;">Ожидание заполнения...</p>'}</div>`;
}

function createCellMarkup(cell, colorClass, fallbackId) {
    const username = (cell && cell.user) ? cell.user : '-';
    return `
        <div class="cell ${colorClass}" onclick="handleCellClick('${username}', '${fallbackId}', event)">
            <div class="cell-id">${fallbackId}</div>
            <div class="cell-user">${username}</div>
        </div>
    `;
}

window.handleCellClick = function(username, cellId, event) {
    if (event) event.stopPropagation();
    if (!username || username === '-') return;
    if (window.showUserCard) window.showUserCard(username);
};

async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        renderDynamicSplitting(data);
    } catch (err) { console.error(err); }
}

fetchTree();
setInterval(fetchTree, 5000);
