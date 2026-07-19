/* === ПОЛНЫЙ ИСПРАВЛЕННЫЙ КОД matrix.js === */

// 1. Внедрение стилей (чтобы точно отображались)
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .vip-gold {
            display: flex; flex-direction: column; align-items: center; justify-content: center;
            border: 2px solid #ffd700 !important; background: #3a3000 !important;
            border-radius: 8px; width: 100px; height: 60px; margin: 5px;
            cursor: pointer; box-shadow: 0 0 10px rgba(255, 215, 0, 0.3); color: #fff;
        }
        #vipRowContainer {
            width: 100%; text-align: center; padding: 15px;
            border: 1px solid #ffd700; border-radius: 10px; margin-bottom: 20px; background: rgba(255, 215, 0, 0.05);
        }
    `;
    document.head.appendChild(style);
})();

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let currentRootId = 'A1'; 
let searchTargetUser = ''; 
let globalTreeCached = null; 
let lastTreeJsonString = ''; 

// Модальное окно (создание, если нет)
if (!document.getElementById('infoModal')) {
    const modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: none; justify-content: center; align-items: center; z-index: 9999;`;
    modal.innerHTML = `
        <div style="background: #162447; border: 2px solid #00fff0; padding: 20px; border-radius: 12px; max-width: 450px; width: 90%; color: #fff;">
            <h3 id="modalTitle" style="color:#00fff0;">Информация</h3>
            <div id="modalBody">Загрузка...</div>
            <button onclick="document.getElementById('infoModal').style.display='none'" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; border-radius:6px; cursor:pointer; margin-top:10px;">ЗАКРЫТЬ</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Функции управления
function setZoom(scaleValue) {
    if (zoomSlider) zoomSlider.value = scaleValue;
    if (mainTreeDisplay) {
        mainTreeDisplay.style.transform = `scale(${scaleValue})`;
        mainTreeDisplay.style.transformOrigin = 'top center';
    }
}

async function fetchTree(forceRender = false) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        globalTreeCached = data;
        renderDynamicSplitting(data);
    } catch (err) { console.error('Ошибка:', err); }
}

// ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРИНГА
function renderDynamicSplitting(tree) {
    // 1. VIP-РЯД
    const vipIds = ['XYZ_1', 'XYZ_2', 'XYZ_3', 'XYZ_4', 'XYZ_5'];
    let goldHTML = '';
    
    vipIds.forEach(id => {
        const cell = tree[id] || { user: null }; // Если ячейки нет в базе, создаем пустышку
        const occ = cell.user;
        goldHTML += `
            <div class="vip-gold" onclick="showUserDetails('${occ ? cell.user : '-'}', '${id}', event)">
                <div style="font-size: 10px; color: #ffd700;">${id}</div>
                <div style="font-size: 12px; font-weight: bold;">${occ ? cell.user : '-'}</div>
            </div>`;
    });

    // 2. РАСЧЕТ МАТРИЦ
    let activeMatricesHTML = [];
    let queue = [currentRootId]; 
    let processed = new Set();
    
    while (queue.length > 0) {
        const curId = queue.shift();
        if (processed.has(curId)) continue;
        processed.add(curId);
        
        const top = tree[curId] || null;
        const p = parseCell(curId);
        if (!p) continue;
        
        const nL = getNextLevelLetter(p.letter), bL = getNextLevelLetter(nL);
        const lN = p.num * 2 - 1, rN = p.num * 2;
        const ids = { top: curId, left: `${nL}${lN}`, right: `${nL}${rN}`, b1: `${bL}${lN*2-1}`, b2: `${bL}${lN*2}`, b3: `${bL}${rN*2-1}`, b4: `${bL}${rN*2}` };
        const bottom4 = [tree[ids.b1], tree[ids.b2], tree[ids.b3], tree[ids.b4]];
        
        if (bottom4.every(c => c && c.user)) { queue.push(ids.left, ids.right); } 
        else { activeMatricesHTML.push(buildSemerkaHTML(top, tree[ids.left], tree[ids.right], bottom4, ids)); }
    }

    // 3. ФИНАЛЬНЫЙ ВЫВОД (Добавляем стиль с !important, если нужно)
    if (mainTreeDisplay) {
        mainTreeDisplay.innerHTML = `
            <div id="vipRowContainer">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:5px;">👑 VIP-РЯД</div>
                <div style="display:flex; justify-content:center; flex-wrap:wrap;">${goldHTML}</div>
            </div>
            <div class="matrices-row">${activeMatricesHTML.join('')}</div>
        `;
    }
}

// Утилиты
function parseCell(id) { const m = id.match(/^([A-Z]+)(\d+)$/); return m ? { letter: m[1], num: parseInt(m[2], 10) } : null; }
function getNextLevelLetter(letter) {
    let i = letter.length - 1;
    while (i >= 0) {
        if (letter[i] !== 'Z') return letter.substring(0, i) + String.fromCharCode(letter.charCodeAt(i) + 1) + 'A'.repeat(letter.length - 1 - i);
        i--;
    }
    return 'A'.repeat(letter.length + 1);
}

function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids) {
    return `
        <div class="semerka-matrix">
            <div class="matrix-row">${getCellHTML(topCell, 'level-1', ids.top)}</div>
            <div class="matrix-row">${getCellHTML(leftShoulder, 'level-2', ids.left)}${getCellHTML(rightShoulder, 'level-2', ids.right)}</div>
            <div class="matrix-row">${getCellHTML(bottom4[0], 'level-3', ids.b1)}${getCellHTML(bottom4[1], 'level-3', ids.b2)}${getCellHTML(bottom4[2], 'level-3', ids.b3)}${getCellHTML(bottom4[3], 'level-3', ids.b4)}</div>
        </div>
    `;
}

function getCellHTML(cell, roleClass, fallbackId) {
    const user = cell ? cell.user : null;
    return `<div class="cell ${roleClass} ${user ? 'occupied' : ''}" onclick="showUserDetails('${user || '-'}', '${fallbackId}', event)">
                <div class="cell-id">${fallbackId}</div>
                <div class="cell-user">${user || '-'}</div>
            </div>`;
}

window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation();
    if (!username || username === '-') return;
    document.getElementById('infoModal').style.display = 'flex';
    document.getElementById('modalTitle').textContent = `Карточка: ${username}`;
};

// Запуск
fetchTree(true);
setInterval(fetchTree, 5000); // 5 секунд для стабильности на телефоне
