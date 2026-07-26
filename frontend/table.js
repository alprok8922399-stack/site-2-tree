const API_BASE_URL = window.location.origin;

let referralTreeData = {};
let activePath = [];
let openDropdownUser = null;
let lastTreeJsonString = "";
let isUserInteracting = false;
let highlightedTableUser = null;

// Динамические стили
const style = document.createElement('style');
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
    .table-search-input:focus { border-color: #4CAF50; }
    .table-search-btn {
        background: #2c5f2d; color: #fff; border: none; padding: 8px 12px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .table-search-btn:hover { background: #3e8e41; }
    .table-matrix-btn {
        background: #8e44ad; color: #fff; border: none; padding: 8px 12px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .table-nav-btn {
        background: #2980b9; color: #fff; border: none; padding: 8px 10px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .table-reset-btn {
        background: #d35400; color: #fff; border: none; padding: 8px 10px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .referral-grid-wrapper {
        display: flex !important; flex-direction: row !important;
        flex-wrap: nowrap !important; align-items: flex-start !important;
        gap: 12px !important; overflow-x: auto !important; padding: 10px 5px !important;
        background: #181818; border-radius: 8px; min-height: 420px; width: 100% !important;
        box-sizing: border-box; -webkit-overflow-scrolling: touch;
    }
    .referral-column {
        flex: 0 0 220px !important; background: #222222 !important;
        border: 1px solid #333333 !important; border-radius: 6px !important;
        display: flex !important; flex-direction: column !important;
        max-height: 600px !important; overflow-y: auto !important; padding: 8px !important; gap: 6px !important;
    }
    .table-row-slot { min-height: 52px; display: flex; flex-direction: column; justify-content: center; }
    .user-cell-card {
        border: 1px solid #444444 !important; border-radius: 5px !important;
        padding: 8px 10px !important; background: #2a2a2a !important; cursor: pointer !important;
        transition: all 0.2s ease !important; position: relative !important; user-select: none !important;
    }
    .user-cell-card:hover { background: #333333 !important; border-color: #666666 !important; }
    .user-cell-card.active-link { background: #1e3a20 !important; border-color: #4CAF50 !important; }
    .user-cell-card.searched-highlight {
        border-color: #ff4757 !important; background: #5f1e1e !important;
        box-shadow: 0 0 15px #ff4757 !important; animation: pulseRed 1.5s infinite alternate;
    }
    @keyframes pulseRed { 0% { box-shadow: 0 0 5px #ff4757; } 100% { box-shadow: 0 0 20px #ff4757; } }
    .user-cell-main { display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 13px !important; }
    .user-login-text { font-weight: 600 !important; color: #4CAF50 !important; }
    .children-badge { background: #555555 !important; color: #fff !important; font-size: 11px !important; padding: 2px 6px !important; border-radius: 10px !important; }
    .user-dropdown-menu { margin-top: 8px !important; padding-top: 8px !important; border-top: 1px dashed #444444 !important; display: flex !important; flex-direction: column !important; gap: 5px !important; }
    .dropdown-btn { background: #333333 !important; border: 1px solid #555555 !important; color: #ffffff !important; padding: 6px 8px !important; font-size: 12px !important; border-radius: 4px !important; cursor: pointer !important; text-align: left !important; }
    .empty-column-msg { color: #888888 !important; font-style: italic !important; text-align: center !important; padding: 15px !important; font-size: 12px !important; }
`;
document.head.appendChild(style);

function getTableContainer() {
    return document.getElementById('referals-table-body') || 
           document.getElementById('tableContainer') || 
           document.getElementById('referralTable') ||
           document.querySelector('.referral-table-container');
}

async function loadReferalsTable(isBackground = false) {
    const targetContainer = getTableContainer();
    if (!targetContainer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/referals-tree?t=${Date.now()}`);
        if (!response.ok) return;
        const result = await response.json();

        const rawTree = result.tree || result.referralsTree || result.data;
        if (!result.success || !rawTree) return;

        const newTreeJsonString = JSON.stringify(rawTree);
        
        if (isBackground && (newTreeJsonString === lastTreeJsonString || isUserInteracting)) {
            return;
        }

        lastTreeJsonString = newTreeJsonString;
        referralTreeData = rawTree;

        let rootUserKey = Object.keys(referralTreeData).find(key => key === 'SYSTEM_ROOT' || !referralTreeData[key].parentId);
        if (!rootUserKey) rootUserKey = Object.keys(referralTreeData)[0];

        if (activePath.length === 0 && rootUserKey) {
            activePath = [rootUserKey];
        }

        renderActiveReferralGrid(targetContainer, isBackground);

    } catch (error) {
        console.error('Ошибка загрузки интерактивной таблицы:', error);
    }
}

function renderActiveReferralGrid(container, isBackground = false) {
    const oldInput = document.getElementById('interactiveTableSearchInput');
    const savedSearchValue = oldInput ? oldInput.value : '';

    container.innerHTML = '';
    
    const searchBlock = document.createElement('div');
    searchBlock.className = 'table-search-container';
    searchBlock.innerHTML = `
        <input type="text" id="interactiveTableSearchInput" class="table-search-input" placeholder="Поиск пользователя..." />
        <button type="button" class="table-search-btn" onclick="window.searchTableUserByInput()">Найти</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableStart()">⏮️ В начало</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableEnd()">⏭️ В конец</button>
        <button type="button" class="table-reset-btn" onclick="window.resetTableToRoot()">🏠 К корню</button>
    `;
    container.appendChild(searchBlock);

    const searchInput = searchBlock.querySelector('input');
    if (savedSearchValue) searchInput.value = savedSearchValue;

    searchInput.addEventListener('input', () => { isUserInteracting = true; });
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.searchTableUserByInput(); });

    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    if (activePath.length > 5) activePath = activePath.slice(0, 5);

    // 1. Коренная колонка
    const firstLoginInPath = activePath[0];
    let rootColumnUsers = [];
    if (firstLoginInPath && referralTreeData[firstLoginInPath]) {
        rootColumnUsers = [referralTreeData[firstLoginInPath]];
    } else {
        rootColumnUsers = Object.values(referralTreeData).filter(node => !node.parentId || node.id === 'SYSTEM_ROOT');
    }
    renderAlignedColumn(wrapper, rootColumnUsers, 0, null);

    // 2. Линии рефералов
    for (let i = 0; i < activePath.length && i < 4; i++) {
        const currentLogin = activePath[i];
        const userNode = referralTreeData[currentLogin];

        if (userNode && userNode.children && userNode.children.length > 0) {
            const childrenNodes = userNode.children.map(childLogin => referralTreeData[childLogin]).filter(Boolean);
            renderAlignedColumn(wrapper, childrenNodes, i + 1, userNode);
        }
    }

    container.appendChild(wrapper);
}

function renderAlignedColumn(wrapper, usersList, columnIndex, parentNode) {
    const column = document.createElement('div');
    column.className = 'referral-column';

    if (!usersList || usersList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-column-msg';
        emptyMsg.innerText = 'Нет зарегистрированных личников';
        column.appendChild(emptyMsg);
    } else {
        usersList.forEach(user => {
            const slot = document.createElement('div');
            slot.className = 'table-row-slot';
            slot.appendChild(createUserCardElement(user, columnIndex));
            column.appendChild(slot);
        });
    }

    wrapper.appendChild(column);
}

function createUserCardElement(user, columnIndex) {
    const userLogin = user.login || user.id;
    const card = document.createElement('div');
    card.className = 'user-cell-card';
    card.id = `table-user-${userLogin}`;
    
    if (activePath.includes(userLogin)) card.classList.add('active-link');
    if (highlightedTableUser && highlightedTableUser.toLowerCase() === userLogin.toLowerCase()) card.classList.add('searched-highlight');

    const mainRow = document.createElement('div');
    mainRow.className = 'user-cell-main';
    
    const loginSpan = document.createElement('span');
    loginSpan.className = 'user-login-text';
    loginSpan.innerText = userLogin;
    mainRow.appendChild(loginSpan);

    const childrenCount = (user.children || []).length;
    if (childrenCount > 0) {
        const badge = document.createElement('span');
        badge.className = 'children-badge';
        badge.innerText = `L: ${childrenCount}`;
        mainRow.appendChild(badge);
    }

    card.appendChild(mainRow);

    card.addEventListener('click', (e) => {
        e.stopPropagation();
        isUserInteracting = true;

        openDropdownUser = (openDropdownUser === userLogin) ? null : userLogin;

        activePath = activePath.slice(0, columnIndex);
        activePath.push(userLogin);

        const targetContainer = getTableContainer();
        if (targetContainer) renderActiveReferralGrid(targetContainer);
    });

    return card;
}

window.searchTableUserByInput = function() {
    const input = document.getElementById('interactiveTableSearchInput');
    if (!input) return;
    const query = input.value.trim().toLowerCase();
    if (!query) return;

    const foundUserKey = Object.keys(referralTreeData).find(key => key.toLowerCase() === query || (referralTreeData[key].login && referralTreeData[key].login.toLowerCase() === query));

    if (foundUserKey) {
        const foundUser = referralTreeData[foundUserKey];
        const targetLogin = foundUser.login || foundUserKey;
        highlightedTableUser = targetLogin;
        
        let path = [targetLogin];
        let current = foundUser;
        while (current && current.parentId && referralTreeData[current.parentId]) {
            const parentUser = referralTreeData[current.parentId];
            path.unshift(parentUser.login || current.parentId);
            current = parentUser;
        }
        
        activePath = path.slice(0, 5);
        const targetContainer = getTableContainer();
        if (targetContainer) renderActiveReferralGrid(targetContainer);
    } else {
        alert('Пользователь не найден');
    }
};

window.scrollToTableStart = function() {
    const wrapper = document.getElementById('referralGridWrapper');
    if (wrapper) wrapper.scrollLeft = 0;
};

window.scrollToTableEnd = function() {
    const wrapper = document.getElementById('referralGridWrapper');
    if (wrapper) wrapper.scrollLeft = wrapper.scrollWidth;
};

window.resetTableToRoot = function() {
    const rootUserKey = Object.keys(referralTreeData).find(key => key === 'SYSTEM_ROOT' || !referralTreeData[key].parentId) || Object.keys(referralTreeData)[0];
    if (rootUserKey) {
        activePath = [rootUserKey];
        highlightedTableUser = null;
        openDropdownUser = null;
        const targetContainer = getTableContainer();
        if (targetContainer) renderActiveReferralGrid(targetContainer);
    }
};

setInterval(() => { loadReferalsTable(true); }, 3000);
document.addEventListener('DOMContentLoaded', () => { loadReferalsTable(); });
