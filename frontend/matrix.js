/* === ИЗОЛИРОВАННЫЕ БЛОКИ МАТРИЦ + КАРТОЧКА ПОЛЬЗОВАТЕЛЯ И ПОИСК === */

(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        .matrices-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            padding: 20px;
            justify-content: center;
        }

        .matrix-block {
            background: #1a1a1a;
            border: 2px solid #334257;
            border-radius: 12px;
            padding: 15px;
            width: 300px;
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.5);
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .matrix-block.highlighted {
            border-color: #ff9800;
            transform: scale(1.03);
        }

        .matrix-title {
            color: #4CAF50;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 10px;
        }

        .matrix-row {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 8px;
            width: 100%;
        }

        .matrix-cell {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #aaa;
            padding: 6px 2px;
            border-radius: 6px;
            flex: 1;
            text-align: center;
            font-size: 11px;
            cursor: pointer;
            user-select: none;
            word-break: break-all;
            transition: all 0.2s ease;
        }

        .matrix-cell.filled {
            background: #1e3a20;
            border-color: #4CAF50;
            color: #fff;
        }

        .matrix-cell.searched {
            border-color: #ff4757 !important;
            background: #5f1e1e !important;
            color: #fff !important;
            font-weight: bold;
        }

        /* Модальное окно (Карточка пользователя - строго 3 поля) */
        .user-card-modal {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .user-card-content {
            background: #222;
            border: 2px solid #4CAF50;
            border-radius: 12px;
            padding: 20px;
            width: 280px;
            color: #fff;
            text-align: center;
            position: relative;
        }

        .user-card-close {
            position: absolute;
            top: 10px; right: 15px;
            color: #aaa; font-size: 20px; cursor: pointer;
        }

        .timer-badge {
            margin-top: 15px;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
        }

        /* До 31 дня - один цвет (оранжевый), после 31 дня - другой (зеленый) */
        .timer-badge.active { background: #ff9800; color: #000; }
        .timer-badge.matured { background: #4CAF50; color: #fff; }
    `;
    document.head.appendChild(style);
})();

const MATRIX_API_URL = window.location.origin;
let currentTreeData = {};
let currentSearchTerm = '';
let pressTimer = null;

// Загрузка дерева с бэкенда
async function fetchTree() {
    try {
        const res = await fetch(`${MATRIX_API_URL}/api/tree?t=${Date.now()}`);
        const data = await res.json();
        currentTreeData = data;
        renderMatrices(data);
    } catch (err) {
        console.error('Ошибка загрузки матрицы:', err);
    }
}

// Загрузка списков активных матриц с бэкенда
function renderMatrices(treeData) {
    const container = document.getElementById('mainTreeDisplay');
    if (!container) return;

    container.className = 'matrices-container';
    container.innerHTML = '';

    // Бэкенд передает либо список активных матриц, либо структуру
    let activeTops = treeData.activeMatrices || [];

    if (activeTops.length === 0) {
        // По умолчанию рисуем стартовую семерку
        activeTops = ['A1'];
    }

    activeTops.forEach(topId => {
        renderSingleMatrixBlock(container, topId, treeData);
    });
}

function renderSingleMatrixBlock(container, topId, treeData) {
    const block = document.createElement('div');
    block.className = 'matrix-block';
    block.id = `matrix-block-${topId}`;

    const title = document.createElement('div');
    title.className = 'matrix-title';
    title.innerText = `Матрица ${topId}`;
    block.appendChild(title);

    const structure = getSevenCellIds(topId);

    // Ряд 1 (Вершина)
    const row1 = createRow([structure.top], treeData);
    // Ряд 2 (Плечи)
    const row2 = createRow([structure.left, structure.right], treeData);
    // Ряд 3 (Основание из 4 ячеек)
    const row3 = createRow([structure.b1, structure.b2, structure.b3, structure.b4], treeData);

    block.appendChild(row1);
    block.appendChild(row2);
    block.appendChild(row3);

    container.appendChild(block);
}

// Вспомогательные функции координат
function cellIdToGlobalIndex(cellId) {
    if (!cellId) return 0;
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;
    
    const letter = match[1];
    const num = parseInt(match[2], 10);
    
    let levelIndex = 0;
    for (let i = 0; i < letter.length; i++) {
        levelIndex = levelIndex * 26 + (letter.charCodeAt(i) - 64);
    }
    levelIndex -= 1;

    const levelStart = (1 << levelIndex) - 1;
    return levelStart + (num - 1);
}

function globalIndexToCellId(gIdx) {
    let levelIndex = 0;
    while ((1 << (levelIndex + 1)) - 1 <= gIdx) {
        levelIndex++;
    }
    const levelStart = (1 << levelIndex) - 1;
    const num = (gIdx - levelStart) + 1;
    
    let letter = '';
    let temp = levelIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return `${letter}${num}`;
}

function getSevenCellIds(topId) {
    const gIdx = cellIdToGlobalIndex(topId);
    
    const leftG = gIdx * 2 + 1;
    const rightG = gIdx * 2 + 2;
    
    const b1G = leftG * 2 + 1;
    const b2G = leftG * 2 + 2;
    const b3G = rightG * 2 + 1;
    const b4G = rightG * 2 + 2;

    return {
        top: topId,
        left: globalIndexToCellId(leftG),
        right: globalIndexToCellId(rightG),
        b1: globalIndexToCellId(b1G),
        b2: globalIndexToCellId(b2G),
        b3: globalIndexToCellId(b3G),
        b4: globalIndexToCellId(b4G)
    };
}

function createRow(cellIds, treeData) {
    const row = document.createElement('div');
    row.className = 'matrix-row';

    cellIds.forEach(id => {
        const cellData = treeData[id] || { id, user: null };
        const cellEl = document.createElement('div');
        cellEl.className = 'matrix-cell';
        cellEl.id = `cell-${id}`;

        if (cellData.user) {
            cellEl.classList.add('filled');
            cellEl.innerText = cellData.user;

            if (currentSearchTerm && cellData.user.toLowerCase() === currentSearchTerm.toLowerCase()) {
                cellEl.classList.add('searched');
            }
        } else {
            cellEl.innerText = id;
        }

        addCellEvents(cellEl, cellData);
        row.appendChild(cellEl);
    });

    return row;
}

// События ячеек (клики и долгое нажатие)
function addCellEvents(element, cellData) {
    if (!cellData.user) return;

    element.addEventListener('click', () => {
        switchFocus(element);
        showUserCard(cellData.user);
    });

    element.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
            showUserCard(cellData.user);
        }, 500);
    });

    element.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });
}

function switchFocus(element) {
    element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
}

// Карточка пользователя (СТРОГО 3 ПОЛЯ)
async function showUserCard(username) {
    try {
        const res = await fetch(`${MATRIX_API_URL}/api/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (!data.success) return;

        const profile = data.profile || {};
        const regDateStr = profile.paymentDate || new Date().toISOString();
        const regDate = new Date(regDateStr);
        const now = new Date();
        const diffDays = Math.floor((now - regDate) / (1000 * 60 * 60 * 24));

        let modal = document.getElementById('userCardModal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'userCardModal';
        modal.className = 'user-card-modal';

        const isMature = diffDays >= 31;
        const badgeClass = isMature ? 'matured' : 'active';
        const badgeText = isMature ? `Дней в матрице: ${diffDays} (Выплата)` : `Дней в матрице: ${diffDays} / 31`;

        // Строго 3 поля: 1. Логин, 2. Дата регистрации, 3. Счетчик 31 дня
        modal.innerHTML = `
            <div class="user-card-content">
                <span class="user-card-close" onclick="document.getElementById('userCardModal').remove()">&times;</span>
                <h3 style="margin-top:0; color:#4CAF50;">${data.username}</h3>
                <p style="font-size:12px; color:#ccc; margin: 10px 0 0 0;">Дата регистрации:<br>${regDate.toLocaleDateString()}</p>
                <div class="timer-badge ${badgeClass}">${badgeText}</div>
            </div>
        `;

        document.body.appendChild(modal);
    } catch (err) {
        console.error('Ошибка загрузки карточки пользователя:', err);
    }
}

function searchMatrixUser(login) {
    if (!login) return;
    currentSearchTerm = login.trim();
    fetchTree().then(() => {
        const searchedEl = document.querySelector('.matrix-cell.searched');
        if (searchedEl) {
            switchFocus(searchedEl);
        } else {
            alert(`Пользователь "${login}" не найден в матрицах.`);
        }
    });
}

// Инициализация Ползунка масштабирования (от 0.03 до 1)
function initZoomSlider() {
    const zoomSlider = document.getElementById('matrix-zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const zoomWrapper = document.getElementById('matrix-zoom-wrapper');

    if (zoomSlider && zoomWrapper) {
        zoomSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            zoomWrapper.style.transform = `scale(${val})`;
            if (zoomValue) {
                zoomValue.textContent = `${Math.round(val * 100)}%`;
            }
        });
    }
}

window.renderMatrixTree = fetchTree;
window.searchMatrixUser = searchMatrixUser;

document.addEventListener('DOMContentLoaded', () => {
    initZoomSlider();
});

setInterval(fetchTree, 3000);
fetchTree();
