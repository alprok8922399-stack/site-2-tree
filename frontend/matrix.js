/* ==========================================================================
   🛠️ МОДУЛЬ: matrix.js (Управление картой матриц, VIP-зоной и Модерацией)
   ========================================================================== */

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const screenContainer = document.getElementById('screenContainer');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Новые DOM-элементы под VIP-механики и Карточку Модератора
const vipRowContainer = document.getElementById('vipRowContainer');
const rightSidebar = document.querySelector('.right-sidebar');
const userModalCard = document.getElementById('userModalCard');

let currentRootId = 'A1'; 
let searchTargetUser = ''; // Цель для подсветки в Матрицах

// КЭШ ДЛЯ ОПТИМИЗАЦИИ СЕТИ И ПРЕДОТВРАЩЕНИЯ МЕРЦАНИЯ DOM
let globalTreeCached = null; 
let lastTreeJsonString = ''; 

// Переменные для реализации симуляции долгого нажатия (Long-press)
let touchTimeout = null;
const LONG_PRESS_MS = 600;

// --- УПРАВЛЕНИЕ МАСШТАБОМ (ZOOM) ---
function setZoom(scaleValue) {
    if (zoomSlider) zoomSlider.value = scaleValue;
    if (mainTreeDisplay) {
        mainTreeDisplay.style.transform = `scale(${scaleValue})`;
        mainTreeDisplay.style.width = '100%';
    }
}

if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => setZoom(e.target.value));
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

// --- СЕТЕВЫЕ ЗАПРОСЫ И СИНХРОНИЗАЦИЯ ---
async function fetchTree(forceRender = false) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        
        // Дополнительно запрашиваем реферальное дерево для вычисления VIP-условий (Серебро)
        const refRes = await fetch(`${API_URL}/referals-tree`);
        const refData = await refRes.json();
        const refTree = refData.success ? refData.tree : {};

        const currentTreeStr = JSON.stringify(data) + `_root:${currentRootId}_target:${searchTargetUser}_refLen:${Object.keys(refTree).length}`;
        globalTreeCached = data; 
        
        if (currentTreeStr === lastTreeJsonString && !forceRender) {
            return; 
        }
        
        lastTreeJsonString = currentTreeStr;
        
        // Рендерим VIP-зону и стандартные матрицы
        renderVipZone(data, refTree);
        renderDynamicSplitting(data, refTree);
    } catch (err) {
        console.error('Ошибка загрузки данных дерева:', err);
    }
}

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

// --- 👑 ЛОГИКА VIP-ЗОНЫ (ЗОЛОТОЙ И СЕРЕБРЯНЫЙ РЯДЫ) ---
function renderVipZone(tree, refTree) {
    if (!vipRowContainer) return;

    // 1. Статичные 5 Золотых мест (ячейки G1 - G5)
    let goldHTML = '';
    for (let i = 1; i <= 5; i++) {
        const cellId = `G${i}`;
        const cell = tree[cellId];
        const isOccupied = cell && cell.user;
        const displayUser = isOccupied ? cell.user : 'Выплата Создателю';
        const focusedClass = (isOccupied && cell.user === searchTargetUser) ? 'focused-cell' : '';

        goldHTML += `
            <div class="vip-cell vip-gold ${isOccupied ? 'occupied' : ''} ${focusedClass}" 
                 data-cell-id="${cellId}" data-user="${isOccupied ? cell.user : '-'}">
                <div class="vip-id">${cellId}</div>
                <div class="vip-user" title="${displayUser}">${displayUser}</div>
            </div>
        `;
    }

    // 2. Динамический расчет Серебряных мест (Условие: 10 личников + у каждого 31+ дней активности)
    let silverHTML = '';
    
    const silverLeaders = Object.values(refTree).filter(node => {
        const directRefs = Object.values(refTree).filter(child => child.sponsor === node.username);
        if (directRefs.length < 10) return false;

        return directRefs.every(child => {
            if (!child.createdAt) return false;
            const daysActive = Math.floor((Date.now() - new Date(child.createdAt).getTime()) / (1000 * 60 * 60 * 24));
            return daysActive > 31;
        });
    }).map(node => node.username);

    const totalSilverSlots = Math.max(silverLeaders.length, 1); 
    for (let i = 1; i <= totalSilverSlots; i++) {
        const cellId = `S${i}`;
        const leaderUser = silverLeaders[i - 1];
        
        if (leaderUser) {
            const focusedClass = (leaderUser === searchTargetUser) ? 'focused-cell' : '';
            silverHTML += `
                <div class="vip-cell vip-silver occupied ${focusedClass}" data-cell-id="${cellId}" data-user="${leaderUser}">
                    <div class="vip-id">${cellId}</div>
                    <div class="vip-user">${leaderUser}</div>
                </div>
            `;
        } else if (silverLeaders.length === 0 && i === 1) {
            silverHTML += `
                <div class="vip-cell vip-silver" data-cell-id="${cellId}" data-user="-">
                    <div class="vip-id">${cellId}</div>
                    <div class="vip-user">Нет квалификаций</div>
                </div>
            `;
        }
    }

    vipRowContainer.innerHTML = `
        <div style="display:flex; flex-direction:column; gap:10px; width:100%; align-items:center; margin-bottom:20px;">
            <div style="color:#ffd700; font-weight:bold; font-size:14px;">👑 ЗОЛОТОЙ VIP-РЯД (5 МЕСТ)</div>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">${goldHTML}</div>
            <div style="color:#a2e8dd; font-weight:bold; font-size:14px; margin-top:5px;">🥈 СЕРЕБРЯНЫЙ РЯД ЛИДЕРОВ</div>
            <div style="display:flex; gap:10px; justify-content:center; flex-wrap:wrap;">${silverHTML}</div>
        </div>
    `;

    bindCellInteractions();
}

// --- 🖱️ ДВОЙНОЙ ТРИГГЕР (КОРОТКИЙ КЛИК / LONG-PRESS) ---
function bindCellInteractions() {
    document.querySelectorAll('.cell, .vip-cell').forEach(cell => {
        cell.onmousedown = (e) => startPress(e, cell);
        cell.onmouseup = (e) => endPress(e, cell);
        cell.onmouseleave = () => clearPress();

        cell.ontouchstart = (e) => startPress(e, cell);
        cell.ontouchend = (e) => endPress(e, cell);
    });
}

function startPress(e, cellElement) {
    if (e.type === 'mousedown' && e.button !== 0) return; 
    clearPress();

    cellElement.dataset.pressTriggered = 'false';
    
    touchTimeout = setTimeout(() => {
        cellElement.dataset.pressTriggered = 'true';
        const username = cellElement.dataset.user;
        const cellId = cellElement.dataset.cellId;
        if (username && username !== '-') {
            handleLongPress(username, cellId);
        }
    }, LONG_PRESS_MS);
}

function endPress(e, cellElement) {
    const wasLongPress = cellElement.dataset.pressTriggered === 'true';
    clearPress();

    if (!wasLongPress) {
        const username = cellElement.dataset.user;
        const cellId = cellElement.dataset.cellId;
        handleShortClick(username, cellId);
    }
}

function clearPress() {
    if (touchTimeout) {
        clearTimeout(touchTimeout);
        touchTimeout = null;
    }
}

// --- 🛑 ВЗАИМОДЕЙСТВИЕ АДМИНА С ЯЧЕЙКАМИ ---

// 1. Короткий клик: вывод прямых рефералов в правую боковую панель
async function handleShortClick(username, cellId) {
    if (!username || username === '-') {
        if (cellId && !cellId.startsWith('G') && !cellId.startsWith('S')) {
            switchFocus(cellId);
        }
        return;
    }

    if (!rightSidebar) return;
    rightSidebar.classList.add('show');
    rightSidebar.innerHTML = `<h3 style="color:#00fff0; font-size:14px; margin-top:0;">👥 Рефералы: ${username}</h3><div style="font-size:12px; color:#fff;">Загрузка личников...</div>`;

    try {
        const res = await fetch(`${API_URL}/referals-tree`);
        const data = await res.json();
        if (data.success && data.tree) {
            const children = Object.values(data.tree).filter(node => node.sponsor === username);
            children.sort((a, b) => a.username.localeCompare(b.username));

            if (children.length === 0) {
                rightSidebar.innerHTML = `<h3 style="color:#00fff0; font-size:14px; margin-top:0;">👥 Рефералы: ${username}</h3><div style="font-size:12px; color:#ffd700;">Личных рефералов нет</div>`;
                return;
            }

            let html = `<h3 style="color:#00fff0; font-size:14px; margin-top:0; border-bottom:1px solid #0f4c81; padding-bottom:6px;">👥 Личники (${children.length}):</h3><ul style="list-style:none; padding:0; margin:0; font-size:12px; max-height:80vh; overflow-y:auto;">`;
            children.forEach(child => {
                html += `<li style="padding:6px; border-bottom:1px solid #162447; color:#fff; display:flex; justify-content:between;">
                    <strong>${child.username}</strong> <span style="color:#a2e8dd;">Ур. ${child.calculatedColumn || 1}</span>
                </li>`;
            });
            html += `</ul>`;
            rightSidebar.innerHTML = html;
        }
    } catch (e) {
        rightSidebar.innerHTML = `<div style="color:#e43f5a; font-size:12px;">Ошибка загрузки боковой панели</div>`;
    }
}

// 2. Долгий клик: Вызов Карточки Модерации (без цепочек спонсоров)
async function handleLongPress(username, cellId) {
    if (!userModalCard) return;
    
    document.getElementById('modalCardTitle').textContent = `Модерация: ${username}`;
    userModalCard.style.display = 'flex';

    const cardBody = document.getElementById('modalCardBody');
    cardBody.innerHTML = `<div style="color:#00fff0; font-size:14px;">Вычисление активности...</div>`;

    try {
        const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();

        if (data.success) {
            const regDate = data.createdAt ? new Date(data.createdAt) : new Date();
            const daysActive = Math.floor((Date.now() - regDate.getTime()) / (1000 * 60 * 60 * 24));
            const dayClass = daysActive <= 31 ? 'days-active-accent' : 'days-active-normal';

            cardBody.innerHTML = `
                <p style="margin:6px 0;">👤 <strong>Логин:</strong> <span style="color:#00fff0;">${data.username}</span></p>
                <p style="margin:6px 0;">📅 <strong>Регистрация:</strong> ${regDate.toLocaleDateString()}</p>
                <p style="margin:6px 0;">⏱️ <strong>Дней в системе:</strong> <span class="${dayClass}" style="font-weight:bold; font-size:16px;">${daysActive} дн.</span></p>
                <p style="margin:6px 0;">🤝 <strong>Спонсор:</strong> ${data.sponsor || '-'}</p>
                
                <div style="display:flex; gap:10px; margin-top:15px;">
                    <button onclick="freezeUserPayments('${data.username}')" style="flex:1; padding:8px; background:#ffd700; color:#111; font-weight:bold; border:none; border-radius:4px; cursor:pointer; font-size:12px;">ЗАМОРОЗИТЬ</button>
                    <button onclick="deleteUserFromMatrix('${data.username}', '${cellId}')" style="flex:1; padding:8px; background:#e43f5a; color:#fff; font-weight:bold; border:none; border-radius:4px; cursor:pointer; font-size:12px;">УДАЛИТЬ</button>
                </div>
            `;
            
            if (!cellId.startsWith('G') && !cellId.startsWith('S')) {
                currentRootId = cellId;
            }
            searchTargetUser = username;
        } else {
            cardBody.innerHTML = `<div style="color:#e43f5a;">Ошибка получения данных: ${data.error}</div>`;
        }
    } catch (err) {
        cardBody.innerHTML = `<div style="color:#e43f5a;">Сервер не отвечает</div>`;
    }
}

// --- 🚫 ФУНКЦИИ УПРАВЛЕНИЯ МОДЕРАТОРА ---
window.freezeUserPayments = async function(username) {
    if (!confirm(`Заморозить выплаты пользователю ${username}?`)) return;
    try {
        const res = await fetch(`${API_URL}/freeze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        if (data.success) alert(`Выплаты пользователю ${username} успешно заморожены!`);
    } catch (e) {
        alert('Ошибка связи с сервером при заморозке');
    }
};

window.deleteUserFromMatrix = async function(username, cellId) {
    if (!confirm(`ВНИМАНИЕ! Полностью удалить пользователя ${username} из ячейки ${cellId} с потерей структуры?`)) return;
    try {
        const res = await fetch(`${API_URL}/delete-user`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, cellId })
        });
        const data = await res.json();
        if (data.success) {
            alert(`Пользователь ${username} успешно удален!`);
            if (userModalCard) userModalCard.style.display = 'none';
            fetchTree(true);
        }
    } catch (e) {
        alert('Ошибка сервера при удалении');
    }
};

window.switchFocus = function(cellId) {
    currentRootId = cellId;
    setZoom(0.8); 
    fetchTree(true);
};

// --- ГЕНЕРАЦИЯ СЕМЁРКИ (ВЕРХУШКА, ПЛЕЧИ, НИЗ) ---
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

function getCellHTML(cell, roleClass, fallbackId = '-') {
    if (!cell) {
        return `<div class="cell ${roleClass}" data-cell-id="${fallbackId}" data-user="-"><div class="cell-id">${fallbackId}</div><div class="cell-user">-</div></div>`;
    }
    const isOccupied = cell.user ? 'occupied' : '';
    const displayUser = cell.user ? cell.user : '-';
    const isFocused = (cell.user && cell.user === searchTargetUser) ? 'focused-cell' : '';

    return `
        <div class="cell ${roleClass} ${isOccupied} ${isFocused}" data-cell-id="${cell.id}" data-user="${displayUser}">
            <div class="cell-id">${cell.id}</div>
            <div class="cell-user">${displayUser}</div>
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
function renderDynamicSplitting(tree, refTree = {}) {
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
        mainTreeDisplay.innerHTML = `
            <div class="matrices-row">
                ${activeMatricesHTML.join('')}
            </div>
        `;
        const currentScale = zoomSlider ? zoomSlider.value : 0.8;
        mainTreeDisplay.style.transform = `scale(${currentScale})`;
        mainTreeDisplay.style.width = '100%';
    }

    bindCellInteractions();
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
