/* === ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД matrix.js === */
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Контейнер для горизонтального свайпа матриц на телефоне */
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
        
        /* Столбец: Памятники истории + Активная матрица под ними */
        .matrix-column {
            display: flex;
            flex-direction: column;
            align-items: center;
            min-width: 280px;
        }

        /* Памятники истории (Верхние закрытые ячейки) */
        .history-stack {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 5px;
            margin-bottom: 8px;
            width: 100%;
        }

        .cell-history {
            opacity: 0.35;
            filter: grayscale(40%);
            transform: scale(0.9);
            border: 1px dashed #ccc !important;
            background: #222 !important;
            box-shadow: none !important;
        }

        .history-connector {
            color: #555;
            font-size: 14px;
            margin-bottom: 8px;
            font-weight: bold;
        }

        /* Семиместная рабочая матрица */
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

        /* Общие стили ячеек */
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

        .cell-id {
            font-size: 9px;
            opacity: 0.7;
            margin-bottom: 2px;
        }

        .cell-user {
            font-size: 11px;
            font-weight: bold;
            max-width: 90%;
            overflow: hidden;
            text-overflow: ellipsis;
            white-space: nowrap;
        }

        /* Цветовая гамма правила Работа_матриц */
        .level-gold {
            background: #ffd700 !important;
            color: #000 !important;
            border: 1px solid #cca100;
            width: 85px;
        }
        .level-gold .cell-id { color: #444; }

        .level-skyblue {
            background: #87ceeb !important;
            color: #000 !important;
            border: 1px solid #5fa9c7;
            width: 80px;
        }
        .level-skyblue .cell-id { color: #444; }

        .level-gray {
            background: #4a4a4a !important;
            color: #fff !important;
            border: 1px solid #666;
            width: 62px;
        }

        /* Подсветка при поиске */
        .highlight-search {
            border: 3px solid #ff4141 !important;
            box-shadow: 0 0 15px #ff4141 !important;
            transform: scale(1.05);
        }
    `;
    document.head.appendChild(style);
})();

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let globalTreeCached = null;
let currentSearchQuery = '';

// Поиск и автоматическая фокусировка на экране телефона
if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
        currentSearchQuery = searchInput.value.trim().toLowerCase();
        if (globalTreeCached) {
            renderDynamicSplitting(globalTreeCached);
            setTimeout(scrollToHighlightedCell, 150);
        }
    });
}

function scrollToHighlightedCell() {
    const target = document.querySelector('.highlight-search');
    if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }
}

// Запрос дерева с сервера
async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        globalTreeCached = data;
        renderDynamicSplitting(data);
    } catch (err) {
        console.error('Ошибка обновления матрицы:', err);
    }
}

// Утилита получения буквенного шага (A -> B -> C ... -> Z -> AA)
function getNextLevelLetter(letter) {
    let i = letter.length - 1;
    while (i >= 0) {
        if (letter[i] !== 'Z') {
            return letter.substring(0, i) + String.fromCharCode(letter.charCodeAt(i) + 1) + 'A'.repeat(letter.length - 1 - i);
        }
        i--;
    }
    return 'A'.repeat(letter.length + 1);
}

// ОСНОВНОЙ ДВИЖОК АВТОНОМНОГО ВЕЕРНОГО ПОЧКОВАНИЯ
function renderDynamicSplitting(tree) {
    if (!mainTreeDisplay) return;

    let activeMatrices = [];
    let queue = [{ letter: 'A', num: 1, history: [] }];
    let processed = new Set();

    // Обход графа для поиска активных (неделимых) на данный момент матриц
    while (queue.length > 0) {
        const current = queue.shift();
        const key = `${current.letter}${current.num}`;
        
        if (processed.has(key)) continue;
        processed.add(key);

        const nextLetter = getNextLevelLetter(current.letter);
        const baseLetter = getNextLevelLetter(nextLetter);
        
        const baseNumStart = (current.num - 1) * 4 + 1;
        const b1 = `${baseLetter}${baseNumStart}`;
        const b2 = `${baseLetter}${baseNumStart + 1}`;
        const b3 = `${baseLetter}${baseNumStart + 2}`;
        const b4 = `${baseLetter}${baseNumStart + 3}`;

        const isB1Filled = tree[b1] && tree[b1].user;
        const isB2Filled = tree[b2] && tree[b2].user;
        const isB3Filled = tree[b3] && tree[b3].user;
        const isB4Filled = tree[b4] && tree[b4].user;

        // Если вся нижняя четверка основания заполнена — матрица делится (почкуется) под ними
        if (isB1Filled && isB2Filled && isB3Filled && isB4Filled) {
            const nextHistory = [...current.history, key];
            queue.push({ letter: nextLetter, num: current.num * 2 - 1, history: nextHistory });
            queue.push({ letter: nextLetter, num: current.num * 2, history: nextHistory });
        } else {
            // Матрица не заполнена до конца — она является АКТИВНОЙ рабочей единицей на экране
            activeMatrices.push({
                rootLetter: current.letter,
                rootNum: current.num,
                history: current.history
            });
        }
    }

    // Рендеринг списка активных матриц в одну линию (горизонтальный свайп)
    let finalHTML = activeMatrices.map(m => {
        const nextLetter = getNextLevelLetter(m.rootLetter);
        const baseLetter = getNextLevelLetter(nextLetter);
        
        const idTop = `${m.rootLetter}${m.rootNum}`;
        const idL = `${nextLetter}${m.rootNum * 2 - 1}`;
        const idR = `${nextLetter}${m.rootNum * 2}`;
        
        const baseStart = (m.rootNum - 1) * 4 + 1;
        const idB1 = `${baseLetter}${baseStart}`;
        const idB2 = `${baseLetter}${baseStart + 1}`;
        const idB3 = `${baseLetter}${baseStart + 2}`;
        const idB4 = `${baseLetter}${baseStart + 3}`;

        // Сборка "Памятников истории" над текущей матрицей
        let historyHTML = '';
        if (m.history.length > 0) {
            historyHTML += `<div class="history-stack">`;
            m.history.forEach(histId => {
                const u = tree[histId] ? tree[histId].user : 'Система';
                historyHTML += `
                    <div class="cell cell-history ${checkHighlight(u)}" onclick="handleCellClick('${u}', '${histId}', event)">
                        <span class="cell-id">${histId}</span>
                        <span class="cell-user">${u}</span>
                    </div>`;
            });
            historyHTML += `</div><div class="history-connector">↓</div>`;
        }

        // Рендеринг 7 мест строго по цветам правила: Золото -> Небесно-голубой -> Серый
        return `
            <div class="matrix-column">
                ${historyHTML}
                <div class="semerka-matrix">
                    <div class="matrix-row">
                        ${createCellMarkup(tree[idTop], 'level-gold', idTop, true)}
                    </div>
                    <div class="matrix-row">
                        ${createCellMarkup(tree[idL], 'level-skyblue', idL, true)}
                        ${createCellMarkup(tree[idR], 'level-skyblue', idR, true)}
                    </div>
                    <div class="matrix-row">
                        ${createCellMarkup(tree[idB1], 'level-gray', idB1, false)}
                        ${createCellMarkup(tree[idB2], 'level-gray', idB2, false)}
                        ${createCellMarkup(tree[idB3], 'level-gray', idB3, false)}
                        ${createCellMarkup(tree[idB4], 'level-gray', idB4, false)}
                    </div>
                </div>
            </div>
        `;
    }).join('');

    mainTreeDisplay.innerHTML = `<div class="matrices-row">${finalHTML}</div>`;
}

// Вспомогательная разметка ячеек. Верхушка и плечи АКТИВНЫХ матриц ВСЕГДА статично заполнены
function createCellMarkup(cell, colorClass, fallbackId, isStaticFilled) {
    let username = cell ? cell.user : null;
    
    if (isStaticFilled && !username) {
        username = 'Заполнено';
    }
    
    const displayUser = username || '-';
    const highlightClass = checkHighlight(displayUser);

    return `
        <div class="cell ${colorClass} ${highlightClass}" onclick="handleCellClick('${displayUser}', '${fallbackId}', event)">
            <div class="cell-id">${fallbackId}</div>
            <div class="cell-user">${displayUser}</div>
        </div>
    `;
}

function checkHighlight(username) {
    if (!currentSearchQuery || username === '-' || username === 'Заполнено') return '';
    return username.toLowerCase().includes(currentSearchQuery) ? 'highlight-search' : '';
}

// Обработка клика по ячейке матрицы
window.handleCellClick = function(username, cellId, event) {
    if (event) event.stopPropagation();
    if (!username || username === '-' || username === 'Заполнено') return;
    
    // Вызов стандартной карточки
    if (document.getElementById('infoModal')) {
        document.getElementById('infoModal').style.display = 'flex';
        document.getElementById('modalTitle').textContent = `Ячейка: ${cellId}`;
        document.getElementById('modalBody').innerHTML = `<strong>Пользователь:</strong> ${username}`;
    }
};

// Инициализация и автообновление
fetchTree();
setInterval(fetchTree, 5000);
