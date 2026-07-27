const API_BASE_URL = window.location.origin;

let referralTreeData = {};
let activePath = [];
let lastTreeJsonString = "";
let isUserInteracting = false;
let highlightedTableUser = null;

const MAX_COLUMNS = 5; 
const SLOT_ROW_HEIGHT = 56; 

// 1. Внедрение стилей
const style = document.createElement('style');
style.id = 'table-dynamic-styles';
style.innerHTML = `
    .table-search-container {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
        max-width: 100%;
        flex-wrap: wrap;
    }
    .table-search-input {
        flex: 1 1 180px;
        padding: 8px 12px;
        background: #1a1a1a;
        border: 1px solid #444;
        border-radius: 6px;
        color: #fff;
        font-size: 13px;
        outline: none;
    }
    .table-search-input:focus {
        border-color: #4CAF50;
    }
    .table-search-btn, .table-matrix-btn, .table-nav-btn, .table-reset-btn {
        color: #fff;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        white-space: nowrap;
    }
    .table-search-btn { background: #2c5f2d; }
    .table-search-btn:hover { background: #3e8e41; }
    .table-matrix-btn { background: #8e44ad; }
    .table-matrix-btn:hover { background: #9b59b6; }
    .table-nav-btn { background: #2980b9; }
    .table-nav-btn:hover { background: #3498db; }
    .table-reset-btn { background: #d35400; }
    .table-reset-btn:hover { background: #e67e22; }

    .referral-grid-wrapper {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: flex-start !important;
        gap: 10px !important;
        overflow-x: auto !important;
        padding: 10px 5px !important;
        background: #181818;
        border-radius: 8px;
        min-height: 400px;
        width: 100% !important;
        box-sizing: border-box;
        -webkit-overflow-scrolling: touch;
    }
    .referral-column {
        flex: 0 0 210px !important;
        min-width: 190px !important;
        background: #222222 !important;
        border: 1px solid #333333 !important;
        border-radius: 6px !important;
        display: flex !important;
        flex-direction: column !important;
        padding: 6px !important;
        box-sizing: border-box;
    }
    .column-header {
        font-weight: bold;
        font-size: 12px;
        color: #4CAF50;
        text-align: center;
        padding: 6px 4px;
        border-bottom: 1px solid #444;
        margin-bottom: 6px;
        background: #1a1a1a;
        border-radius: 4px;
    }
    .table-row-slot {
        display: flex;
        flex-direction: column;
        justify-content: center;
        box-sizing: border-box;
        padding: 2px 0;
    }
    .table-row-slot.empty-slot { opacity: 0.15; }
    .user-cell-card {
        border: 1px solid #444444 !important;
        border-radius: 5px !important;
        padding: 8px 10px !important;
        background: #2a2a2a !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        position: relative !important;
        user-select: none !important;
        box-sizing: border-box;
        width: 100%;
    }
    .user-cell-card:hover {
        background: #333333 !important;
        border-color: #666666 !important;
    }
    .user-cell-card.active-link {
        background: #1e3a20 !important;
        border-color: #4CAF50 !important;
        box-shadow: inset 0 0 6px rgba(76,175,80,0.5) !important;
    }
    .user-cell-card.searched-highlight {
        border-color: #ff4757 !important;
        background: #5f1e1e !important;
        box-shadow: 0 0 15px #ff4757 !important;
    }
    .user-cell-main {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        font-size: 13px !important;
    }
    .user-login-text {
        font-weight: 600 !important;
        color: #4CAF50 !important;
        word-break: break-word;
    }
    .children-badge {
        background: #555555 !important;
        color: #fff !important;
        font-size: 10px !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        font-weight: bold;
    }
    .empty-column-msg {
        color: #888888 !important;
        font-style: italic !important;
        text-align: center !important;
        padding: 15px !important;
        font-size: 12px !important;
    }
`;
if (!document.getElementById('table-dynamic-styles')) {
    document.head.appendChild(style);
}

/**
 * Загрузка реферального дерева
 */
async function loadReferalsTable(isBackground = false) {
    const targetContainer = document.getElementById('referals-table-body');
    if (!targetContainer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/referals-tree?t=${Date.now()}`);
        if (!response.ok) throw new Error('Network error');
        const result = await response.json();

        if (!result || !result.tree) return;

        const newTreeJsonString = JSON.stringify(result.tree);
        
        if (isBackground && (newTreeJsonString === lastTreeJsonString || isUserInteracting)) {
            return;
        }

        lastTreeJsonString = newTreeJsonString;
        referralTreeData = result.tree || {};

        const rootUser = referralTreeData['SYSTEM_ROOT'] 
                      || Object.values(referralTreeData).find(node => !node.parentId) 
                      || Object.values(referralTreeData)[0];

        if (activePath.length === 0 && rootUser) {
            activePath = [rootUser.id];
        }

        renderActiveReferralGrid(targetContainer, isBackground);

    } catch (error) {
        console.error('Ошибка загрузки интерактивной таблицы:', error);
        if (!isBackground) {
            renderActiveReferralGrid(targetContainer, false);
        }
    }
}

/**
 * Отрисовка интерактивной таблицы
 */
function renderActiveReferralGrid(container, isBackground = false) {
    const oldInput = document.getElementById('interactiveTableSearchInput');
    const savedSearchValue = oldInput ? oldInput.value : '';

    container.innerHTML = '';
    
    // Блок поиска и кнопок
    const searchBlock = document.createElement('div');
    searchBlock.className = 'table-search-container';
    searchBlock.innerHTML = `
        <input type="text" id="interactiveTableSearchInput" class="table-search-input" placeholder="Поиск пользователя..." />
        <button type="button" class="table-search-btn" onclick="window.searchTableUserByInput()">Найти</button>
        <button type="button" class="table-matrix-btn" onclick="window.showSearchedInMatrix()">Показать в матрице</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableStart()">⏮️ В начало</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableEnd()">⏭️ В конец</button>
        <button type="button" class="table-reset-btn" onclick="window.resetTableToRoot()">🏠 К корню</button>
    `;
    container.appendChild(searchBlock);

    const searchInput = searchBlock.querySelector('input');
    if (savedSearchValue) searchInput.value = savedSearchValue;

    searchInput.addEventListener('input', () => { isUserInteracting = true; });
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.searchTableUserByInput();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    // Определение стартовых узлов
    const firstLoginInPath = activePath[0];
    let rootColumnUsers = [];

    if (firstLoginInPath && referralTreeData[firstLoginInPath]) {
        rootColumnUsers = [referralTreeData[firstLoginInPath]];
    } else {
        rootColumnUsers = Object.values(referralTreeData).filter(node => !node.parentId || node.id === 'SYSTEM_ROOT');
        if (rootColumnUsers.length === 0 && Object.keys(referralTreeData).length > 0) {
            rootColumnUsers = [Object.values(referralTreeData)[0]];
        }
    }

    // Расчет высоты (1-й личник напротив, 2-й и далее - раздвигают ВСЕ 5 колонок)
    function getNodeHeight(nodeId, depth) {
        if (depth >= MAX_COLUMNS) return 1;
        const node = referralTreeData[nodeId];
        if (!node || !node.children || node.children.length === 0) return 1;

        let totalSubRows = 0;
        node.children.forEach((childId) => {
            totalSubRows += getNodeHeight(childId, depth + 1);
        });

        return Math.max(1, totalSubRows);
    }

    const columnsData = Array.from({ length: MAX_COLUMNS }, () => []);

    function populateGrid(nodeId, depth, startRow) {
        if (depth >= MAX_COLUMNS) return;
        const node = referralTreeData[nodeId];
        if (!node) return;

        const span = getNodeHeight(nodeId, depth);
        
        columnsData[depth][startRow] = { user: node, span: span, isCard: true };
        for (let r = 1; r < span; r++) {
            columnsData[depth][startRow + r] = { isSpacer: true };
        }

        if (node.children && node.children.length > 0 && depth + 1 < MAX_COLUMNS) {
            let currentChildRow = startRow;
            node.children.forEach((childId) => {
                const childSpan = getNodeHeight(childId, depth + 1);
                populateGrid(childId, depth + 1, currentChildRow);
                currentChildRow += childSpan; // 2-й и следующие личники сдвигают строки вниз
            });
        }
    }

    let totalGridRows = 0;
    rootColumnUsers.forEach(rootNode => {
        const h = getNodeHeight(rootNode.id, 0);
        populateGrid(rootNode.id, 0, totalGridRows);
        totalGridRows += h;
    });

    if (totalGridRows === 0) totalGridRows = 1;

    // Отрисовка ровно 5 колонок
    for (let colIdx = 0; colIdx < MAX_COLUMNS; colIdx++) {
        const colDiv = document.createElement('div');
        colDiv.className = 'referral-column';

        const colHeader = document.createElement('div');
        colHeader.className = 'column-header';
        colHeader.innerText = `Уровень ${colIdx + 1}`;
        colDiv.appendChild(colHeader);

        let rowIdx = 0;
        let hasAnyUser = false;

        while (rowIdx < totalGridRows) {
            const cell = columnsData[colIdx][rowIdx];
            if (cell && cell.isCard) {
                hasAnyUser = true;
                const slot = document.createElement('div');
                slot.className = 'table-row-slot';
                slot.style.minHeight = `${cell.span * SLOT_ROW_HEIGHT}px`;
                slot.appendChild(createUserCardElement(cell.user, colIdx));
                colDiv.appendChild(slot);
                rowIdx += cell.span;
            } else if (cell && cell.isSpacer) {
                rowIdx++;
            } else {
                const slot = document.createElement('div');
                slot.className = 'table-row-slot empty-slot';
                slot.style.minHeight = `${SLOT_ROW_HEIGHT}px`;
                colDiv.appendChild(slot);
                rowIdx++;
            }
        }

        if (!hasAnyUser) {
            const emptyMsg = document.createElement('div');
            emptyMsg.className = 'empty-column-msg';
            emptyMsg.innerText = 'Нет данных';
            colDiv.appendChild(emptyMsg);
        }

        wrapper.appendChild(colDiv);
    }

    container.appendChild(wrapper);
}

/**
 * Создание карточки ячейки (БЕЗ СТАРОЙ КАРТОЧКИ — ВЫЗЫВАЕТ ТОЛЬКО НОВУЮ)
 */
function createUserCardElement(user, columnIndex) {
    const card = document.createElement('div');
    card.className = 'user-cell-card';
    card.id = `table-user-${user.login}`;
    
    if (activePath.includes(user.id)) card.classList.add('active-link');
    if (highlightedTableUser && highlightedTableUser.toLowerCase() === user.login.toLowerCase()) {
        card.classList.add('searched-highlight');
    }

    const mainRow = document.createElement('div');
    mainRow.className = 'user-cell-main';
    
    const loginSpan = document.createElement('span');
    loginSpan.className = 'user-login-text';
    loginSpan.innerText = user.login;
    mainRow.appendChild(loginSpan);

    const childrenCount = (user.children || []).length;
    if (childrenCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'children-badge';
        badge.innerText = `L: ${childrenCount}`;
        mainRow.appendChild(badge);
    }

    card.appendChild(mainRow);

    // Клик открывает НОВУЮ КАРТОЧКУ (старая вырезана навсегда)
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        isUserInteracting = true;

        activePath = activePath.slice(0, columnIndex);
        activePath.push(user.id);
        highlightedTableUser = user.login;

        const targetContainer = document.getElementById('referals-table-body');
        if (targetContainer) renderActiveReferralGrid(targetContainer, false);

        // ВЫЗОВ НОВОЙ КАРТОЧКИ ПОЛЬЗОВАТЕЛЯ С КНОПКАМИ
        if (typeof window.showUserCard === 'function') {
            window.showUserCard(user.login);
        } else if (typeof window.openNewUserCard === 'function') {
            window.openNewUserCard(user.login);
        } else if (typeof window.searchReferralUser === 'function') {
            window.searchReferralUser(user.login);
        }

        setTimeout(() => { isUserInteracting = false; }, 1000);
    });

    return card;
}

async function searchReferralUser(login) {
    if (!login) return;
    isUserInteracting = true;
    try {
        const response = await fetch(`${API_BASE_URL}/api/get-referral-chain?login=${encodeURIComponent(login.trim())}`);
        if (!response.ok) {
            alert('Пользователь не найден!');
            return;
        }
        const result = await response.json();
        if (result.success && result.chain) {
            activePath = result.chain.length > MAX_COLUMNS ? result.chain.slice(-MAX_COLUMNS) : result.chain;
            highlightedTableUser = login.trim();

            const targetContainer = document.getElementById('referals-table-body');
            if (targetContainer) renderActiveReferralGrid(targetContainer, false);

            if (typeof window.showUserCard === 'function') {
                window.showUserCard(login.trim());
            }
        }
    } catch (e) {
        console.error(e);
    } finally {
        setTimeout(() => { isUserInteracting = false; }, 1000);
    }
}

window.resetTableToRoot = () => {
    activePath = [];
    highlightedTableUser = null;
    loadReferalsTable(false);
};

window.scrollToTableStart = () => {
    const w = document.getElementById('referralGridWrapper');
    if (w) w.scrollTo({ left: 0, behavior: 'smooth' });
};

window.scrollToTableEnd = () => {
    const w = document.getElementById('referralGridWrapper');
    if (w) w.scrollTo({ left: w.scrollWidth, behavior: 'smooth' });
};

window.searchTableUserByInput = () => {
    const inp = document.getElementById('interactiveTableSearchInput');
    if (inp && inp.value) searchReferralUser(inp.value.trim());
};

window.showSearchedInMatrix = () => {
    const inp = document.getElementById('interactiveTableSearchInput');
    const login = inp && inp.value ? inp.value.trim() : highlightedTableUser;
    if (login && typeof window.searchMatrixUser === 'function') {
        window.searchMatrixUser(login);
    }
};

window.searchReferralUser = searchReferralUser;
window.refreshReferralTable = () => loadReferalsTable(false);

document.addEventListener('DOMContentLoaded', () => loadReferalsTable(false));
loadReferalsTable(false);
