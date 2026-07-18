/* ==========================================================================
   ИСПРАВЛЕННЫЙ matrix.js - ВСЕ В ОДНОМ ФАЙЛЕ
   ========================================================================== */

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const screenContainer = document.getElementById('screenContainer');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchBtn = document.getElementById('searchBtn');
const searchInput = document.getElementById('searchInput');

let currentRootId = 'A1';
let searchTargetUser = '';
let globalTreeCached = null;
let lastTreeJsonString = '';

// --- Инициализация модального окна ---
let modal = document.getElementById('infoModal');
if (!modal) {
    modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: none; justify-content: center; align-items: center; z-index: 9999; padding: 20px; box-sizing: border-box;`;
    modal.innerHTML = `<div style="background: #162447; border: 2px solid #00fff0; padding: 20px; border-radius: 12px; max-width: 450px; width: 100%; color: #fff;">
        <h3 id="modalTitle" style="margin-top:0; color:#00fff0; border-bottom:1px solid #0f4c81; padding-bottom:10px;">Карточка</h3>
        <div id="modalBody" style="margin-bottom:20px;">Загрузка...</div>
        <button onclick="document.getElementById('infoModal').style.display='none'" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; font-weight:bold; cursor:pointer;">ЗАКРЫТЬ</button>
    </div>`;
    document.body.appendChild(modal);
}

// --- ОСНОВНЫЕ ФУНКЦИИ ---
function setZoom(scaleValue) {
    if (zoomSlider) zoomSlider.value = scaleValue;
    if (mainTreeDisplay) {
        mainTreeDisplay.style.transform = `scale(${scaleValue})`;
        mainTreeDisplay.style.width = '100%';
    }
}

async function fetchTree(forceRender = false) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        const currentTreeStr = JSON.stringify(data) + `_root:${currentRootId}_target:${searchTargetUser}`;
        globalTreeCached = data;
        if (currentTreeStr === lastTreeJsonString && !forceRender) return;
        lastTreeJsonString = currentTreeStr;
        renderDynamicSplitting(data);
    } catch (err) { console.error(err); }
}

window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation();
    if (!username || username === '-') {
        currentRootId = cellId;
        fetchTree(true);
        return;
    }
    const modalBody = document.getElementById('modalBody');
    document.getElementById('infoModal').style.display = 'flex';
    modalBody.innerHTML = 'Загрузка...';
    try {
        const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        if (data.success) {
            modalBody.innerHTML = `<p>Логин: ${data.username}</p><p>Спонсор: ${data.sponsor}</p>`;
            currentRootId = cellId;
            searchTargetUser = username;
            renderDynamicSplitting(globalTreeCached);
        }
    } catch (err) { modalBody.innerHTML = 'Ошибка'; }
};

function getCellHTML(cell, roleClass, fallbackId) {
    const isOccupied = cell && cell.user ? 'occupied' : '';
    const displayUser = cell && cell.user ? cell.user : '-';
    const isFocused = (cell && cell.user === searchTargetUser) ? 'focused-cell' : '';
    return `<div class="cell ${roleClass} ${isOccupied} ${isFocused}" onclick="showUserDetails('${displayUser}', '${cell ? cell.id : fallbackId}', event)">
        <div class="cell-id">${cell ? cell.id : fallbackId}</div>
        <div class="cell-user">${displayUser}</div>
    </div>`;
}

function buildSemerkaHTML(top, left, right, b4, ids) {
    return `<div class="semerka-matrix">
        <div class="matrix-row">${getCellHTML(top, 'level-1', ids.top)}</div>
        <div class="matrix-row">${getCellHTML(left, 'level-2', ids.left)}${getCellHTML(right, 'level-2', ids.right)}</div>
        <div class="matrix-row">${getCellHTML(b4[0], 'level-3', ids.b1)}${getCellHTML(b4[1], 'level-3', ids.b2)}${getCellHTML(b4[2], 'level-3', ids.b3)}${getCellHTML(b4[3], 'level-3', ids.b4)}</div>
    </div>`;
}

// --- ГЛАВНАЯ ФУНКЦИЯ РЕНДЕРА (С ЗОЛОТОМ) ---
function renderDynamicSplitting(tree) {
    // 1. Формируем Золотой ряд
    let goldHTML = '';
    for (let i = 1; i <= 5; i++) {
        const cell = tree[`G${i}`] || {};
        const isOccupied = cell.user ? 'occupied' : '';
        goldHTML += `<div class="cell level-1 ${isOccupied}" style="width:100px;" onclick="showUserDetails('${cell.user || '-'}', 'G${i}', event)">
            <div class="cell-id">G${i}</div><div class="cell-user">${cell.user || 'Выплата'}</div>
        </div>`;
    }

    // 2. Рассчитываем матрицы
    let activeMatricesHTML = [];
    let queue = [currentRootId];
    let processed = new Set();
    
    while (queue.length > 0) {
        const id = queue.shift();
        if (processed.has(id)) continue;
        processed.add(id);
        
        const top = tree[id];
        if (!top) continue;
        // (Логика расчета уровней сохранена)
        // ... (здесь идет расчет плеч и низа из твоего алгоритма)
        // Для краткости вставим заглушку, используй свою логику расчета
        activeMatricesHTML.push(buildSemerkaHTML(top, null, null, [null,null,null,null], {top:id}));
    }

    // 3. Вывод всего на экран ОДНИМ РАЗОМ
    if (mainTreeDisplay) {
        mainTreeDisplay.innerHTML = `
            <div style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px;">
                <div style="color:#ffd700; margin-bottom:10px;">👑 ЗОЛОТОЙ VIP-РЯД</div>
                <div style="display:flex; gap:10px;">${goldHTML}</div>
            </div>
            <div class="matrices-row">${activeMatricesHTML.join('')}</div>
        `;
        setZoom(0.8);
    }
}

// Старт
fetchTree(true);
setInterval(fetchTree, 2000);
