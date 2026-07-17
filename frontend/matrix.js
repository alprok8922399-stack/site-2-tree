/* ==========================================================================
   🚨 КРИТИЧЕСКАЯ ЗОНА: ТОЛЬКО ДЛЯ ЧТЕНИЯ (READ-ONLY) — С ОБНОВЛЕНИЕМ "ЗОЛОТЫХ МЕСТ"
   ⚠️ ЛЮБЫЕ ИЗМЕНЕНИЯ В ЭТОМ ФАЙЛЕ ЗАПРЕЩЕНЫ И МОГУТ СЛОМАТЬ СИСТЕМУ ДЕПЛОЯ!
   ========================================================================== */

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const screenContainer = document.getElementById('screenContainer');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let currentRootId = 'A1'; 
let searchTargetUser = ''; // Цель для подсветки в Матрицах

// КЭШ ДЛЯ ОПТИМИЗАЦИИ СЕТИ И ПРЕДОТВРАЩЕНИЯ МЕРЦАНИЯ DOM
let globalTreeCached = null; 
let lastTreeJsonString = ''; 

// ДОБАВЛЯЕМ СТИЛИ ДЛЯ ЗОЛОТЫХ ЯЧЕЕК В HEAD
const goldStyle = document.createElement('style');
goldStyle.innerHTML = `
    .golden-container {
        display: flex;
        flex-direction: column;
        align-items: center;
        background: rgba(255, 215, 0, 0.05);
        border: 2px solid #ffd700;
        border-radius: 16px;
        padding: 20px;
        margin-bottom: 30px;
        box-shadow: 0 0 30px rgba(255, 215, 0, 0.15);
        width: fit-content;
        margin-left: auto;
        margin-right: auto;
    }
    .golden-title {
        color: #ffd700;
        font-family: sans-serif;
        font-size: 22px;
        font-weight: bold;
        text-transform: uppercase;
        letter-spacing: 2px;
        margin-bottom: 15px;
        text-shadow: 0 0 10px rgba(255, 215, 0, 0.5);
    }
    .golden-row {
        display: flex;
        gap: 25px;
        justify-content: center;
    }
    .golden-cell {
        background: #1b1917 !important;
        border: 2px solid #ffd700 !important;
        box-shadow: 0 0 15px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2);
        transition: transform 0.2s, box-shadow 0.2s;
        cursor: pointer;
        border-radius: 10px;
        width: 100px;
        height: 80px;
        display: flex;
        flex-direction: column;
        justify-content: center;
        align-items: center;
        text-align: center;
    }
    .golden-cell:hover {
        transform: scale(1.08);
        box-shadow: 0 0 25px rgba(255, 215, 0, 0.8), inset 0 0 15px rgba(255, 215, 0, 0.3);
    }
    .golden-cell .cell-id {
        color: #ffd700 !important;
        font-weight: bold;
        font-size: 13px;
        margin-bottom: 5px;
    }
    .golden-cell .cell-user {
        color: #fff !important;
        font-weight: bold;
        font-size: 15px;
    }
    .golden-cell.vacant {
        border-style: dashed !important;
        opacity: 0.7;
    }
    .vip-badge-header {
        position: fixed;
        top: 20px;
        right: 20px;
        background: linear-gradient(135deg, #ffd700, #b8860b);
        color: #000;
        padding: 8px 16px;
        border-radius: 20px;
        font-weight: bold;
        box-shadow: 0 0 15px #ffd700;
        font-family: sans-serif;
        font-size: 14px;
        z-index: 1000;
        display: none; /* Будет включаться у премиум-пользователей */
    }
`;
document.head.appendChild(goldStyle);

// Создаем HTML-структуру для всплывающего окна информации
let modal = document.getElementById('infoModal');
if (!modal) {
    modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); display: none; justify-content: center;
        align-items: center; z-index: 9999; font-family: sans-serif; padding: 20px; box-sizing: border-box;
    `;
    modal.innerHTML = `
        <div style="background: #162447; border: 2px solid #00fff0; padding: 20px; border-radius: 12px; max-width: 450px; width: 100%; box-shadow: 0 0 20px rgba(0,255,240,0.3); color: #fff; position: relative;">
            <h3 id="modalTitle" style="margin-top:0; color:#00fff0; font-size:20px; border-bottom:1px solid #0f4c81; padding-bottom:10px;">Информация о партнере</h3>
            <div id="modalBody" style="font-size:15px; line-height:1.6; margin-bottom:20px;">Загрузка...</div>
            <button onclick="document.getElementById('infoModal').style.display='none'" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; font-weight:bold; border-radius:6px; cursor:pointer;">ЗАКРЫТЬ</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// --- УПРАВЛЕНИЕ МАСШТАБОМ (ZOOM) ---
function setZoom(scaleValue) {
    if (zoomSlider) {
        zoomSlider.value = scaleValue;
    }
    if (mainTreeDisplay) {
        mainTreeDisplay.style.transform = `scale(${scaleValue})`;
        mainTreeDisplay.style.width = '100%';
    }
}

if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
        setZoom(e.target.value);
    });
}

if (screenContainer) {
    screenContainer.addEventListener('click', (e) => {
        if (e.target === screenContainer || e.target === mainTreeDisplay || e.target.classList.contains('matrices-row')) {
            setZoom(0.8);
        }
    });
}

// --- ПОИСК И ФОКУСИРОВКА В МАТРИЦАХ ---
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) {
            findUserAndFocus(val);
        } else {
            currentRootId = 'A1';
            searchTargetUser = '';
            setZoom(0.8); 
            fetchTree(true); 
        }
    });
}

function scrollToFocusedCell() {
    setTimeout(() => {
        const focusedCell = document.querySelector('.focused-cell');
        if (focusedCell) {
            focusedCell.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }, 100);
}

// Получение данных матрицы с сервера
async function fetchTree(forceRender = false) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        
        const currentTreeStr = JSON.stringify(data) + `_root:${currentRootId}_target:${searchTargetUser}`;
        globalTreeCached = data; 
        
        if (currentTreeStr === lastTreeJsonString && !forceRender) {
            return; 
        }
        
        lastTreeJsonString = currentTreeStr;
        renderDynamicSplitting(data);
    } catch (err) {
        console.error('Ошибка загрузки данных дерева:', err);
    }
}

// Поиск ячейки по логину
function findUserAndFocus(username) {
    fetch(`${API_URL}/tree`)
        .then(res => res.json())
        .then(tree => {
            let foundCellId = null;
            let exactUsername = '';

            for (const [id, cell] of Object.entries(tree)) {
                if (cell && cell.user && cell.user.toLowerCase() === username.toLowerCase()) {
                    foundCellId = id;
                    exactUsername = cell.user;
                    break;
                }
            }
            
            if (foundCellId) {
                const parsed = parseCell(foundCellId);
                let rootId = foundCellId; 
                
                function getPrevLevelLetter(letter) {
                    if (letter.length > 1) return letter.substring(0, letter.length - 1);
                    if (letter === 'A') return 'A';
                    return String.fromCharCode(letter.charCodeAt(0) - 1);
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
                searchTargetUser = exactUsername; 
                
                setZoom(0.8); 
                fetchTree(true); 
                scrollToFocusedCell();
            } else {
                alert(`Пользователь "${username}" не найден в матричной структуре`);
            }
        });
}

// КЛИК ПО ЗОЛОТОМУ МЕСТУ
window.showGoldenDetails = async function(slotId, username) {
    const modalView = document.getElementById('infoModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    // Меняем рамку модального окна на золотую
    modalView.firstElementChild.style.borderColor = '#ffd700';
    modalView.firstElementChild.style.boxShadow = '0 0 20px rgba(255,215,0,0.5)';
    
    modalTitle.textContent = `Золотое Место: ${slotId}`;
    modalView.style.display = 'flex';

    if (!username || username === '-') {
        // Если место пустое — показываем ID для активации и копирование
        const uniqueActivationCode = `${slotId}-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
        modalBody.innerHTML = `
            <p style="color:#ffd700; font-size: 16px;">⭐ Это место свободно для VIP-партнера.</p>
            <p>Скопируйте уникальный ID активации и передайте его пользователю:</p>
            <div style="background:#1b1917; padding:10px; border-radius:6px; font-family:monospace; color:#ffd700; font-size:16px; word-break:break-all; border:1px solid #ffd700; text-align:center;" id="activationCodeArea">${uniqueActivationCode}</div>
            <button onclick="navigator.clipboard.writeText('${uniqueActivationCode}'); alert('ID скопирован в буфер!');" style="margin-top:15px; width:100%; padding:10px; background:#ffd700; border:none; color:#000; font-weight:bold; border-radius:6px; cursor:pointer;">КОПИРОВАТЬ ID АКТИВАЦИИ</button>
        `;
    } else {
        // Если занято — загружаем его данные и выводим две кнопки администратора
        modalBody.innerHTML = `<i>Загрузка данных VIP-пользователя...</i>`;
        try {
            const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
            const data = await res.json();
            
            if (data.success) {
                modalBody.innerHTML = `
                    <p>👑 <strong style="color:#ffd700;">Статус: ПРЕМИУМ ПОЛЬЗОВАТЕЛЬ</strong></p>
                    <p>👤 <strong>Логин:</strong> ${data.username}</p>
                    <p>💰 <strong>Доля распределения:</strong> ${getGoldDistributionShare(slotId)}</p>
                    <hr style="border:0; border-top:1px solid #0f4c81; margin: 15px 0;">
                    
                    <button onclick="freezeGoldPayout('${username}', '${slotId}')" style="width:100%; padding:10px; background:#ffd700; border:none; color:#000; font-weight:bold; border-radius:6px; cursor:pointer; margin-bottom:10px;">❄️ ЗАМОРОЗИТЬ ВЫПЛАТЫ</button>
                    <button onclick="deleteGoldUser('${username}', '${slotId}')" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; font-weight:bold; border-radius:6px; cursor:pointer;">❌ УДАЛИТЬ ПОЛЬЗОВАТЕЛЯ</button>
                `;
            } else {
                modalBody.innerHTML = `<span style="color:#e43f5a;">Ошибка: ${data.error}</span>`;
            }
        } catch (err) {
            modalBody.innerHTML = `<span style="color:#e43f5a;">Ошибка при получении данных с сервера</span>`;
        }
    }
};

// Функция получения доли начисления в зависимости от ячейки
function getGoldDistributionShare(slotId) {
    switch (slotId) {
        case 'GP-1': return '15 Митронов (50%)';
        case 'GP-2': return '5 Митронов (16.6%)';
        case 'GP-3': return '5 Митронов (16.6%)';
        case 'GP-4': return '2.5 Митронов (8.3%)';
        case 'GP-5': return '2.5 Митронов (8.3%)';
        default: return '0';
    }
}

// Админ-функции для кнопок Золотых ячеек
window.freezeGoldPayout = function(username, slotId) {
    if (confirm(`Заморозить вечные выплаты для VIP-пользователя ${username}?`)) {
        fetch(`${API_URL}/gold/freeze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, slotId })
        }).then(() => alert('Выплаты успешно заморожены!'));
    }
};

window.deleteGoldUser = function(username, slotId) {
    if (confirm(`Вы уверены, что хотите УДАЛИТЬ пользователя ${username} из ячейки ${slotId}? Выплаты прекратятся.`)) {
        fetch(`${API_URL}/gold/delete`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, slotId })
        }).then(() => {
            alert('Пользователь успешно удален.');
            document.getElementById('infoModal').style.display = 'none';
            fetchTree(true);
        });
    }
};

// Вывод детальной информации о стандартной ячейке матрицы
window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation(); 
    
    if (!username || username === '-') {
        currentRootId = cellId;
        setZoom(0.8);
        fetchTree(true);
        return;
    }

    const modalView = document.getElementById('infoModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    // Возвращаем стандартный неоновый стиль модалки
    modalView.firstElementChild.style.borderColor = '#00fff0';
    modalView.firstElementChild.style.boxShadow = '0 0 20px rgba(0,255,240,0.3)';
    
    modalTitle.textContent = `Карточка: ${username}`;
    modalBody.innerHTML = `<i>Загрузка связей...</i>`;
    modalView.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (data.success) {
            const cellsList = data.cells.join(', ');
            const chainLine = data.chain.length > 0 ? data.chain.join(' ➔ ') : 'Корневой аккаунт';
            
            modalBody.innerHTML = `
                <p>👤 <strong>Логин:</strong> ${data.username}</p>
                <p>🏠 <strong>Занятые ячейки:</strong> ${cellsList}</p>
                <p>🤝 <strong>Прямой Спонсор:</strong> <span style="color:#ffd700;">${data.sponsor}</span></p>
                <div style="background:#1f4068; padding:10px; border-radius:6px; margin-top:15px; border:1px dashed #00fff0;">
                    <strong style="color:#00fff0; display:block; margin-bottom:5px;">Линия спонсоров вверх:</strong>
                    <div style="word-break: break-all; font-size:14px; color:#e2e2e2;">${chainLine}</div>
                </div>
            `;
            
            currentRootId = cellId;
            searchTargetUser = username;
            renderDynamicSplitting(globalTreeCached);
            scrollToFocusedCell(); 
        } else {
            modalBody.innerHTML = `<span style="color:#e43f5a;">Ошибка: ${data.error}</span>`;
        }
    } catch (err) {
        modalBody.innerHTML = `<span style="color:#e43f5a;">Не удалось связаться с сервером деталей</span>`;
    }
};

// ГЕНЕРАЦИЯ HTML ДЛЯ ЗОЛОТЫХ ЯЧЕЕК СВЕРХУ
function generateGoldenPlacesHTML(tree) {
    // В сервере мы зарезервируем ключи GP-1, GP-2, GP-3, GP-4, GP-5 в объекте дерева
    const goldIDs = ['GP-1', 'GP-2', 'GP-3', 'GP-4', 'GP-5'];
    
    let cellsHTML = goldIDs.map(id => {
        const cell = tree[id] || { id, user: '-' };
        const isVacant = cell.user === '-' ? 'vacant' : '';
        return `
            <div class="golden-cell ${isVacant}" onclick="showGoldenDetails('${id}', '${cell.user}')">
                <div class="cell-id">${id}</div>
                <div class="cell-user">${cell.user}</div>
            </div>
        `;
    }).join('');

    return `
        <div class="golden-container" onclick="event.stopPropagation();">
            <div class="golden-title">🌟 Золотые Места 🌟</div>
            <div class="golden-row">
                ${cellsHTML}
            </div>
        </div>
    `;
}

// --- ГЕНЕРАЦИЯ HTML ОТДЕЛЬНОЙ ЯЧЕЙКИ ---
function getCellHTML(cell, roleClass, fallbackId = '-') {
    if (!cell) {
        return `<div class="cell ${roleClass}" onclick="switchFocus('${fallbackId}')"><div class="cell-id">${fallbackId}</div><div class="cell-user">-</div></div>`;
    }
    const isOccupied = cell.user ? 'occupied' : '';
    const displayUser = cell.user ? cell.user : '-';
    const isFocused = (cell.user && cell.user === searchTargetUser) ? 'focused-cell' : '';

    return `
        <div class="cell ${roleClass} ${isOccupied} ${isFocused}" onclick="showUserDetails('${displayUser}', '${cell.id}', event)">
            <div class="cell-id">${cell.id}</div>
            <div class="cell-user">${displayUser}</div>
        </div>
    `;
}

window.switchFocus = function(cellId) {
    currentRootId = cellId;
    setZoom(0.8); 
    fetchTree(true);
};

// --- ГЕНЕРАЦИЯ СЕМЁРКИ (3 РЯДА: ВЕРХУШКА, ПЛЕЧИ, НИЗ) ---
function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids) {
    return `
        <div class="semerka-matrix" onclick="setZoom(0.8); event.stopPropagation();">
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
    let i = letter.length - 1;
    while (i >= 0) {
        if (letter[i] !== 'Z') {
            return letter.substring(0, i) + String.fromCharCode(letter.charCodeAt(i) + 1) + 'A'.repeat(letter.length - 1 - i);
        }
        i--;
    }
    return 'A'.repeat(letter.length + 1);
}

// --- ДИНАМИЧЕСКИЙ РАСЧЕТ И ДЕЛЕНИЕ МАТРИЦ (SPLITTING) ---
function renderDynamicSplitting(tree) {
    globalTreeCached = tree;
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

        const isMatrixClosed = bottom4.every(cell => cell && cell.user);

        if (isMatrixClosed) {
            queue.push(leftShoulderId);
            queue.push(rightShoulderId);
        } else {
            const ids = { top: currentId, left: leftShoulderId, right: rightShoulderId, b1, b2, b3, b4 };
            activeMatricesHTML.push(buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids));
        }
    }

    if (mainTreeDisplay) {
        // ПРОВЕРКА: Если открыта таблица, мы насильно НЕ переключаем mainTreeDisplay в flex!
        const embeddedTable = document.getElementById('embeddedTableContainer');
        const isTableVisible = embeddedTable && embeddedTable.style.display === 'block';
        
        mainTreeDisplay.style.display = isTableVisible ? 'none' : 'flex';
        mainTreeDisplay.style.flexDirection = 'column';
        mainTreeDisplay.style.gap = '40px';

        // Генерируем "Золотые места" и ставим их в самый верх
        const goldenPlacesHTML = generateGoldenPlacesHTML(tree);

        // Группируем стандартные матрицы по 32 штуки на ряд
        let rowsHTML = [];
        const itemsPerRow = 32;

        for (let i = 0; i < activeMatricesHTML.length; i += itemsPerRow) {
            const chunk = activeMatricesHTML.slice(i, i + itemsPerRow);
            rowsHTML.push(`
                <div class="matrices-row" style="display: flex; gap: 40px;">
                    ${chunk.join('')}
                </div>
            `);
        }

        // Собираем всё воедино: Золотые места в самом верху, затем стандартная структура
        mainTreeDisplay.innerHTML = goldenPlacesHTML + rowsHTML.join('');

        const currentScale = zoomSlider ? zoomSlider.value : 0.8;
        mainTreeDisplay.style.transform = `scale(${currentScale})`;
        mainTreeDisplay.style.width = '100%';
    }
}

// --- СБРОС СИСТЕМЫ ---
if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Очистить базу данных дерева?')) return;
        try {
            const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('База успешно сброшена!');
                currentRootId = 'A1';
                searchTargetUser = '';
                lastTreeJsonString = ''; 
                setZoom(0.8);
                fetchTree(true);
            }
        } catch (err) {
            alert('Ошибка при сбросе');
        }
    });
}

// Первичный запуск и автообновление матриц
fetchTree(true);
setInterval(fetchTree, 2000);

// --- ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ (МАТРИЦЫ / ТАБЛИЦА) ---
const tableBtn = document.getElementById('tableBtn');
const embeddedTableContainer = document.getElementById('embeddedTableContainer');

if (tableBtn && embeddedTableContainer) {
    tableBtn.addEventListener('click', () => {
        const isTableVisible = embeddedTableContainer.style.display === 'block';

        if (isTableVisible) {
            // Переключаем на Матрицы
            embeddedTableContainer.style.display = 'none';
            if (mainTreeDisplay) mainTreeDisplay.style.display = 'flex';
            tableBtn.textContent = 'таблица';
            tableBtn.style.background = '#00fff0';
            tableBtn.style.color = '#0b132b';
        } else {
            // Переключаем на Таблицу
            if (mainTreeDisplay) mainTreeDisplay.style.display = 'none';
            embeddedTableContainer.style.display = 'block';
            tableBtn.textContent = 'матрицы';
            tableBtn.style.background = '#ffd700'; // Сделаем кнопку золотистой в режиме таблицы
            tableBtn.style.color = '#000';
            
            // Запускаем отрисовку таблицы при переключении
            if (typeof buildInteractiveRefTable === 'function') {
                buildInteractiveRefTable(true);
            }
        }
    });
        }
