/* ==========================================================================
   🚨 КРИТИЧЕСКАЯ ЗОНА: ТОЛЬКО ДЛЯ ЧТЕНИЯ (READ-ONLY)
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
let searchTargetUser = ''; 

let globalTreeCached = null; 
let lastTreeJsonString = ''; 

const goldStyle = document.createElement('style');
goldStyle.innerHTML = `
    .golden-container { display: flex; flex-direction: column; align-items: center; background: rgba(255, 215, 0, 0.05); border: 2px solid #ffd700; border-radius: 16px; padding: 20px; margin-bottom: 30px; box-shadow: 0 0 30px rgba(255, 215, 0, 0.15); width: fit-content; margin-left: auto; margin-right: auto; }
    .golden-title { color: #ffd700; font-family: sans-serif; font-size: 22px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin-bottom: 15px; text-shadow: 0 0 10px rgba(255, 215, 0, 0.5); }
    .golden-row { display: flex; gap: 25px; justify-content: center; }
    .golden-cell { background: #1b1917 !important; border: 2px solid #ffd700 !important; box-shadow: 0 0 15px rgba(255, 215, 0, 0.4), inset 0 0 10px rgba(255, 215, 0, 0.2); transition: transform 0.2s, box-shadow 0.2s; cursor: pointer; border-radius: 10px; width: 100px; height: 80px; display: flex; flex-direction: column; justify-content: center; align-items: center; text-align: center; }
    .golden-cell:hover { transform: scale(1.08); box-shadow: 0 0 25px rgba(255, 215, 0, 0.8), inset 0 0 15px rgba(255, 215, 0, 0.3); }
    .golden-cell .cell-id { color: #ffd700 !important; font-weight: bold; font-size: 13px; margin-bottom: 5px; }
    .golden-cell .cell-user { color: #fff !important; font-weight: bold; font-size: 15px; }
    .golden-cell.vacant { border-style: dashed !important; opacity: 0.7; }
`;
document.head.appendChild(goldStyle);

let modal = document.getElementById('infoModal');
if (!modal) {
    modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: none; justify-content: center; align-items: center; z-index: 9999; font-family: sans-serif; padding: 20px; box-sizing: border-box;`;
    modal.innerHTML = `<div style="background: #162447; border: 2px solid #00fff0; padding: 20px; border-radius: 12px; max-width: 450px; width: 100%; box-shadow: 0 0 20px rgba(0,255,240,0.3); color: #fff; position: relative;"><h3 id="modalTitle" style="margin-top:0; color:#00fff0; font-size:20px; border-bottom:1px solid #0f4c81; padding-bottom:10px;">Информация</h3><div id="modalBody" style="font-size:15px; line-height:1.6; margin-bottom:20px;">Загрузка...</div><button onclick="document.getElementById('infoModal').style.display='none'" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; font-weight:bold; border-radius:6px; cursor:pointer;">ЗАКРЫТЬ</button></div>`;
    document.body.appendChild(modal);
}

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

if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) { findUserAndFocus(val); }
        else { currentRootId = 'A1'; searchTargetUser = ''; setZoom(0.8); fetchTree(true); }
    });
}

function scrollToFocusedCell() {
    setTimeout(() => {
        const focusedCell = document.querySelector('.focused-cell');
        if (focusedCell) focusedCell.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 100);
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
    } catch (err) {
        console.error(err);
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
                    foundCellId = id; exactUsername = cell.user; break;
                }
            }
            if (foundCellId) {
                const parsed = parseCell(foundCellId);
                let rootId = foundCellId;
                currentRootId = 'A1'; // Для сброса на корень при поиске
                searchTargetUser = exactUsername; 
                setZoom(0.8); fetchTree(true); scrollToFocusedCell();
            } else {
                alert(`Пользователь "${username}" не найден`);
            }
        });
}

window.showGoldenDetails = async function(slotId, username) {
    const modalView = document.getElementById('infoModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    modalView.firstElementChild.style.borderColor = '#ffd700';
    modalTitle.textContent = `Золотое Место: ${slotId}`;
    modalView.style.display = 'flex';
    if (!username || username === '-') {
        const uniqueCode = `${slotId}-${Math.random().toString(36).substr(2, 5).toUpperCase()}`;
        modalBody.innerHTML = `<p>⭐ Место свободно.</p><div style="background:#1b1917; padding:10px; border-radius:6px; color:#ffd700; font-family:monospace;">${uniqueCode}</div>`;
    } else {
        modalBody.innerHTML = `<p>👤 VIP: <strong>${username}</strong></p>`;
    }
};

window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation();
    if (!username || username === '-') { currentRootId = cellId; setZoom(0.8); fetchTree(true); return; }
    const modalView = document.getElementById('infoModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    modalView.firstElementChild.style.borderColor = '#00fff0';
    modalTitle.textContent = `Карточка: ${username}`;
    modalView.style.display = 'flex';
    modalBody.innerHTML = `<p>👤 Логин: ${username}</p><p>🏠 Ячейка: ${cellId}</p>`;
};

function generateGoldenPlacesHTML(tree) {
    const goldIDs = ['GP-1', 'GP-2', 'GP-3', 'GP-4', 'GP-5'];
    let cellsHTML = goldIDs.map(id => {
        const cell = tree[id] || { id, user: '-' };
        return `<div class="golden-cell ${cell.user === '-' ? 'vacant' : ''}" onclick="showGoldenDetails('${id}', '${cell.user}')"><div class="cell-id">${id}</div><div class="cell-user">${cell.user}</div></div>`;
    }).join('');
    return `<div class="golden-container" onclick="event.stopPropagation();"><div class="golden-title">🌟 Золотые Места 🌟</div><div class="golden-row">${cellsHTML}</div></div>`;
}

function getCellHTML(cell, roleClass, fallbackId = '-') {
    if (!cell) return `<div class="cell ${roleClass}" onclick="switchFocus('${fallbackId}')"><div class="cell-id">${fallbackId}</div><div class="cell-user">-</div></div>`;
    const isFocused = (cell.user && cell.user === searchTargetUser) ? 'focused-cell' : '';
    return `<div class="cell ${roleClass} ${cell.user ? 'occupied' : ''} ${isFocused}" onclick="showUserDetails('${cell.user || '-'}', '${cell.id}', event)"><div class="cell-id">${cell.id}</div><div class="cell-user">${cell.user || '-'}</div></div>`;
}

window.switchFocus = function(cellId) { currentRootId = cellId; setZoom(0.8); fetchTree(true); };

function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids) {
    return `<div class="semerka-matrix" onclick="setZoom(0.8); event.stopPropagation();"><div class="matrix-row">${getCellHTML(topCell, 'level-1', ids.top)}</div><div class="matrix-row">${getCellHTML(leftShoulder, 'level-2', ids.left)}${getCellHTML(rightShoulder, 'level-2', ids.right)}</div><div class="matrix-row">${getCellHTML(bottom4[0], 'level-3', ids.b1)}${getCellHTML(bottom4[1], 'level-3', ids.b2)}${getCellHTML(bottom4[2], 'level-3', ids.b3)}${getCellHTML(bottom4[3], 'level-3', ids.b4)}</div></div>`;
}

function parseCell(id) { const match = id.match(/^([A-Z]+)(\d+)$/); return match ? { letter: match[1], num: parseInt(match[2], 10) } : null; }
function getNextLevelLetter(letter) { return String.fromCharCode(letter.charCodeAt(0) + 1); }

function renderDynamicSplitting(tree) {
    globalTreeCached = tree;
    let activeMatricesHTML = [];
    let queue = [currentRootId];
    let processedNodes = new Set();
    while (queue.length > 0) {
        const currentId = queue.shift(); if (processedNodes.has(currentId)) continue; processedNodes.add(currentId);
        const topCell = tree[currentId] || null; const parsed = parseCell(currentId); if (!parsed) continue;
        const nextLetter = getNextLevelLetter(parsed.letter); const bottomLetter = getNextLevelLetter(nextLetter);
        const leftLNum = parsed.num * 2 - 1; const rightLNum = parsed.num * 2;
        const leftShoulderId = `${nextLetter}${leftLNum}`; const rightShoulderId = `${nextLetter}${rightLNum}`;
        const b1 = `${bottomLetter}${leftLNum * 2 - 1}`; const b2 = `${bottomLetter}${leftLNum * 2}`;
        const b3 = `${bottomLetter}${rightLNum * 2 - 1}`; const b4 = `${bottomLetter}${rightLNum * 2}`;
        const leftShoulder = tree[leftShoulderId] || null; const rightShoulder = tree[rightShoulderId] || null;
        const bottom4 = [tree[b1]||null, tree[b2]||null, tree[b3]||null, tree[b4]||null];
        if (bottom4.every(cell => cell && cell.user)) { queue.push(leftShoulderId); queue.push(rightShoulderId); }
        else { const ids = { top: currentId, left: leftShoulderId, right: rightShoulderId, b1, b2, b3, b4 }; activeMatricesHTML.push(buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids)); }
    }
    if (mainTreeDisplay) {
        const embeddedTable = document.getElementById('embeddedTableContainer');
        if (embeddedTable && embeddedTable.style.display === 'block') { mainTreeDisplay.style.display = 'none'; return; }
        mainTreeDisplay.style.display = 'flex'; mainTreeDisplay.style.flexDirection = 'column'; mainTreeDisplay.style.gap = '40px';
        let rowsHTML = []; for (let i = 0; i < activeMatricesHTML.length; i += 32) { rowsHTML.push(`<div class="matrices-row" style="display: flex; gap: 40px;">${activeMatricesHTML.slice(i, i + 32).join('')}</div>`); }
        mainTreeDisplay.innerHTML = generateGoldenPlacesHTML(tree) + rowsHTML.join('');
        mainTreeDisplay.style.transform = `scale(${zoomSlider ? zoomSlider.value : 0.8})`;
    }
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Очистить БД?')) return;
        await fetch(`${API_URL}/reset`, { method: 'POST' });
        currentRootId = 'A1'; searchTargetUser = ''; lastTreeJsonString = ''; fetchTree(true);
    });
}

fetchTree(true);
setInterval(fetchTree, 2000);

// --- ИСПРАВЛЕННАЯ ЛОГИКА ПЕРЕКЛЮЧЕНИЯ ЭКРАНОВ И СКРЫТИЯ ШАПКИ ---
const tableBtn = document.getElementById('tableBtn');
const tableBtnBack = document.getElementById('tableBtnBack');
const matrixHeader = document.getElementById('matrixHeader');
const embeddedTableContainer = document.getElementById('embeddedTableContainer');
const backToMatricesZone = document.getElementById('backToMatricesZone');

function switchToTable() {
    if (matrixHeader) matrixHeader.style.display = 'none'; // ПОЛНОСТЬЮ СКРЫВАЕМ ШАПКУ МАТРИЦ
    if (mainTreeDisplay) mainTreeDisplay.style.display = 'none';
    if (embeddedTableContainer) embeddedTableContainer.style.display = 'block';
    if (backToMatricesZone) backToMatricesZone.style.display = 'block'; // Показываем золотую кнопку возврата
    if (typeof window.buildInteractiveRefTable === 'function') {
        window.buildInteractiveRefTable(true);
    }
}

function switchToMatrices() {
    if (matrixHeader) matrixHeader.style.display = 'flex'; // ВОЗВРАЩАЕМ ШАПКУ МАТРИЦ
    if (embeddedTableContainer) embeddedTableContainer.style.display = 'none';
    if (backToMatricesZone) backToMatricesZone.style.display = 'none';
    if (mainTreeDisplay) mainTreeDisplay.style.display = 'flex';
    fetchTree(true);
}

if (tableBtn) tableBtn.addEventListener('click', switchToTable);
if (tableBtnBack) tableBtnBack.addEventListener('click', switchToMatrices);
