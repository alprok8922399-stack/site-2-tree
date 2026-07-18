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

let modal = document.getElementById('infoModal');
if (!modal) {
    modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.style.cssText = `position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background: rgba(0,0,0,0.85); display: none; justify-content: center; align-items: center; z-index: 9999; font-family: sans-serif; padding: 20px; box-sizing: border-box;`;
    modal.innerHTML = `
        <div style="background: #162447; border: 2px solid #00fff0; padding: 20px; border-radius: 12px; max-width: 450px; width: 100%; box-shadow: 0 0 20px rgba(0,255,240,0.3); color: #fff; position: relative;">
            <h3 id="modalTitle" style="margin-top:0; color:#00fff0; font-size:20px; border-bottom:1px solid #0f4c81; padding-bottom:10px;">Информация о партнере</h3>
            <div id="modalBody" style="font-size:15px; line-height:1.6; margin-bottom:20px;">Загрузка...</div>
            <button onclick="document.getElementById('infoModal').style.display='none'" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; font-weight:bold; border-radius:6px; cursor:pointer;">ЗАКРЫТЬ</button>
        </div>
    `;
    document.body.appendChild(modal);
}

function setZoom(scaleValue) {
    if (zoomSlider) zoomSlider.value = scaleValue;
    if (mainTreeDisplay) {
        mainTreeDisplay.style.transform = `scale(${scaleValue})`;
        mainTreeDisplay.style.width = '100%';
    }
}

if (zoomSlider) zoomSlider.addEventListener('input', (e) => setZoom(e.target.value));

if (screenContainer) {
    screenContainer.addEventListener('click', (e) => {
        if (e.target === screenContainer || e.target === mainTreeDisplay || e.target.classList.contains('matrices-row')) setZoom(0.8);
    });
}

if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) findUserAndFocus(val);
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
    } catch (err) { console.error('Ошибка:', err); }
}

function findUserAndFocus(username) {
    fetch(`${API_URL}/tree`).then(res => res.json()).then(tree => {
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
            function getPrevLevelLetter(l) { return l.length > 1 ? l.substring(0, l.length - 1) : (l === 'A' ? 'A' : String.fromCharCode(l.charCodeAt(0) - 1)); }
            let p = parsed;
            let s1L = getPrevLevelLetter(p.letter);
            let s1N = Math.floor((p.num + 1) / 2);
            let s2L = getPrevLevelLetter(s1L);
            let s2N = Math.floor((s1N + 1) / 2);
            let cand = `${s2L}${s2N}`;
            rootId = (s2L === 'A' || tree[cand]) ? cand : `${s1L}${s1N}`;
            if (p.letter === 'A') rootId = 'A1';
            currentRootId = rootId; searchTargetUser = exactUsername; 
            setZoom(0.8); fetchTree(true); scrollToFocusedCell();
        } else alert(`Пользователь "${username}" не найден`);
    });
}

window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation(); 
    if (!username || username === '-') { currentRootId = cellId; setZoom(0.8); fetchTree(true); return; }
    const modalView = document.getElementById('infoModal');
    document.getElementById('modalTitle').textContent = `Карточка: ${username}`;
    document.getElementById('modalBody').innerHTML = `<i>Загрузка...</i>`;
    modalView.style.display = 'flex';
    try {
        const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        if (data.success) {
            document.getElementById('modalBody').innerHTML = `
                <p>👤 <strong>Логин:</strong> ${data.username}</p>
                <p>🏠 <strong>Ячейки:</strong> ${data.cells.join(', ')}</p>
                <p>🤝 <strong>Спонсор:</strong> <span style="color:#ffd700;">${data.sponsor}</span></p>
                <div style="background:#1f4068; padding:10px; border-radius:6px; margin-top:15px; border:1px dashed #00fff0;">
                    <strong style="color:#00fff0;">Линия спонсоров:</strong>
                    <div style="word-break: break-all; font-size:14px; color:#e2e2e2;">${data.chain.join(' ➔ ')}</div>
                </div>
            `;
            currentRootId = cellId; searchTargetUser = username; renderDynamicSplitting(globalTreeCached); scrollToFocusedCell();
        }
    } catch (err) { document.getElementById('modalBody').innerHTML = 'Ошибка'; }
};

function getCellHTML(cell, roleClass, fallbackId = '-') {
    if (!cell) return `<div class="cell ${roleClass}" onclick="switchFocus('${fallbackId}')"><div class="cell-id">${fallbackId}</div><div class="cell-user">-</div></div>`;
    const isFocused = (cell.user && cell.user === searchTargetUser) ? 'focused-cell' : '';
    return `<div class="cell ${roleClass} ${cell.user ? 'occupied' : ''} ${isFocused}" onclick="showUserDetails('${cell.user || '-'}', '${cell.id}', event)"><div class="cell-id">${cell.id}</div><div class="cell-user">${cell.user || '-'}</div></div>`;
}

window.switchFocus = function(cellId) { currentRootId = cellId; setZoom(0.8); fetchTree(true); };

function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids) {
    return `
        <div class="semerka-matrix" onclick="setZoom(0.8); event.stopPropagation();">
            <div class="matrix-row">${getCellHTML(topCell, 'level-1', ids.top)}</div>
            <div class="matrix-row">${getCellHTML(leftShoulder, 'level-2', ids.left)}${getCellHTML(rightShoulder, 'level-2', ids.right)}</div>
            <div class="matrix-row">${getCellHTML(bottom4[0], 'level-3', ids.b1)}${getCellHTML(bottom4[1], 'level-3', ids.b2)}${getCellHTML(bottom4[2], 'level-3', ids.b3)}${getCellHTML(bottom4[3], 'level-3', ids.b4)}</div>
        </div>
    `;
}

function parseCell(id) { const m = id.match(/^([A-Z]+)(\d+)$/); return m ? { letter: m[1], num: parseInt(m[2], 10) } : null; }
function getNextLevelLetter(letter) {
    let i = letter.length - 1;
    while (i >= 0) {
        if (letter[i] !== 'Z') return letter.substring(0, i) + String.fromCharCode(letter.charCodeAt(i) + 1) + 'A'.repeat(letter.length - 1 - i);
        i--;
    }
    return 'A'.repeat(letter.length + 1);
}

// --- ОСНОВНАЯ ФУНКЦИЯ ---
function renderDynamicSplitting(tree) {
    globalTreeCached = tree;

    // ГЕНЕРАЦИЯ VIP-РЯДА (XYZ_1 - XYZ_5)
    const vipIds = [];
    for (let i = 1; i <= 5; i++) {
        vipIds.push(`XYZ_${i}`);
    }

    let goldHTML = '';
    vipIds.forEach(id => {
        const cell = tree[id] || null;
        const occ = cell && cell.user;
        goldHTML += `
            <div class="vip-gold ${occ ? 'occupied' : ''} ${occ && cell.user === searchTargetUser ? 'focused-cell' : ''}" 
                 onclick="showUserDetails('${occ ? cell.user : '-'}', '${id}', event)"
                 style="background: ${occ ? '#3a3000' : '#1f4068'}; border: 2px solid #ffd700; border-radius: 8px; padding: 10px; text-align: center; width: 100px; cursor: pointer; margin: 5px;">
                <div style="font-size: 11px; color: #ffd700; font-weight: bold;">${id}</div>
                <div style="font-size: 12px; font-weight: bold; overflow: hidden; text-overflow: ellipsis;">${occ ? cell.user : '-'}</div>
            </div>`;
    });

    // Расчет матриц
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

    if (mainTreeDisplay) {
        mainTreeDisplay.innerHTML = `
            <div id="vipRowContainer" style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px; width:100%;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">👑 VIP-РЯД</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">${goldHTML}</div>
            </div>
            <div class="matrices-row">${activeMatricesHTML.join('')}</div>
        `;
        const scale = zoomSlider ? zoomSlider.value : 0.8;
        mainTreeDisplay.style.transform = `scale(${scale})`;
        mainTreeDisplay.style.width = '100%';
    }
}
    // 2. Считаем матрицы
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

    // 3. Выводим ВСЁ сразу
    if (mainTreeDisplay) {
        mainTreeDisplay.innerHTML = `
            <div id="vipRowContainer" style="display:flex; flex-direction:column; align-items:center; margin-bottom:20px; width:100%;">
                <div style="color:#ffd700; font-weight:bold; margin-bottom:10px;">👑 ЗОЛОТОЙ VIP-РЯД</div>
                <div style="display:flex; gap:10px; flex-wrap:wrap; justify-content:center;">${goldHTML}</div>
            </div>
            <div class="matrices-row">${activeMatricesHTML.join('')}</div>
        `;
        const scale = zoomSlider ? zoomSlider.value : 0.8;
        mainTreeDisplay.style.transform = `scale(${scale})`;
        mainTreeDisplay.style.width = '100%';
    }
}

if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Очистить базу?')) return;
        const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
        if ((await res.json()).success) { alert('База сброшена'); currentRootId = 'A1'; fetchTree(true); }
    });
}

fetchTree(true);
setInterval(fetchTree, 2000);
