const API_BASE_URL = window.location.origin;

let referralTreeData = {};
let activePath = [];
let lastTreeJsonString = "";
let highlightedTableUser = null;

// Принудительно внедряем адаптированные стили таблицы
const style = document.createElement('style');
style.innerHTML = `
    .table-search-container {
        display: flex;
        gap: 8px;
        margin-bottom: 15px;
        max-width: 100%;
        flex-wrap: wrap;
    }
    .table-search-input {
        flex: 1 1 200px;
        padding: 10px 14px;
        background: #141414;
        border: 1px solid #444;
        border-radius: 6px;
        color: #fff;
        font-size: 14px;
        outline: none;
    }
    .table-search-input:focus { border-color: #4CAF50; }
    .table-search-btn {
        background: #2c5f2d; color: #fff; border: none; padding: 10px 16px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
        transition: 0.2s;
    }
    .table-search-btn:hover { background: #3e8e41; }
    .table-nav-btn {
        background: #2980b9; color: #fff; border: none; padding: 10px 12px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .table-reset-btn {
        background: #d35400; color: #fff; border: none; padding: 10px 12px;
        border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 13px;
    }
    .referral-grid-wrapper {
        display: flex !important; flex-direction: row !important;
        flex-wrap: nowrap !important; align-items: flex-start !important;
        gap: 12px !important; overflow-x: auto !important; padding: 12px 8px !important;
        background: #121214; border-radius: 8px; min-height: 380px; width: 100% !important;
        box-sizing: border-box; -webkit-overflow-scrolling: touch;
        border: 1px solid #2a2a2e;
    }
    .referral-column {
        flex: 0 0 210px !important; background: #1e1e24 !important;
        border: 1px solid #333339 !important; border-radius: 8px !important;
        display: flex !important; flex-direction: column !important;
        max-height: 550px !important; overflow-y: auto !important; padding: 10px !important; gap: 8px !important;
    }
    .table-row-slot { min-height: 48px; display: flex; flex-direction: column; justify-content: center; }
    .user-cell-card {
        border: 1px solid #3a3a42 !important; border-radius: 6px !important;
        padding: 10px 12px !important; background: #282830 !important; cursor: pointer !important;
        transition: all 0.2s ease !important; position: relative !important; user-select: none !important;
    }
    .user-cell-card:hover { background: #32323d !important; border-color: #555566 !important; transform: translateY(-1px); }
    .user-cell-card.active-link { background: #1e3a20 !important; border-color: #4CAF50 !important; }
    .user-cell-card.searched-highlight {
        border-color: #ff4757 !important; background: #4a151b !important;
        box-shadow: 0 0 12px rgba(255, 71, 87, 0.6) !important;
    }
    .user-cell-main { display: flex !important; justify-content: space-between !important; align-items: center !important; font-size: 13px !important; }
    .user-login-text { font-weight: 600 !important; color: #4CAF50 !important; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; }
    .children-badge { background: #333340 !important; color: #aaa !important; font-size: 11px !important; padding: 2px 6px !important; border-radius: 10px !important; border: 1px solid #444; }
    .empty-column-msg { color: #666677 !important; font-style: italic !important; text-align: center !important; padding: 20px 10px !important; font-size: 12px !important; }
`;
document.head.appendChild(style);

function getTableContainer() {
    return document.getElementById('referals-table-body');
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
        if (isBackground && newTreeJsonString === lastTreeJsonString) return;

        lastTreeJsonString = newTreeJsonString;
        referralTreeData = rawTree;

        let rootUserKey = Object.keys(referralTreeData).find(key => key === 'SYSTEM_ROOT' || !referralTreeData[key].parentId);
        if (!rootUserKey) rootUserKey = Object.keys(referralTreeData)[0];

        // Очистка активного пути от удалённых пользователей
        activePath = activePath.filter(user => referralTreeData[user]);

        if (activePath.length === 0 && rootUserKey) {
            activePath = [rootUserKey];
        }

        renderActiveReferralGrid(targetContainer);

    } catch (error) {
        console.error('Ошибка при рендере таблицы:', error);
    }
}

function renderActiveReferralGrid(container) {
    const oldInput = document.getElementById('interactiveTableSearchInput');
    const savedSearchValue = oldInput ? oldInput.value : '';

    container.innerHTML = '';
    
    // Поисковая панель таблицы
    const searchBlock = document.createElement('div');
    searchBlock.className = 'table-search-container';
    searchBlock.innerHTML = `
        <input type="text" id="interactiveTableSearchInput" class="table-search-input" placeholder="Поиск логина в дереве..." />
        <button type="button" class="table-search-btn" onclick="window.searchTableUserByInput()">Найти</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableStart()">⏮️ Лево</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableEnd()">Право ⏭️</button>
        <button type="button" class="table-reset-btn" onclick="window.resetTableToRoot()">🏠 В корень</button>
    `;
    container.appendChild(searchBlock);

    const searchInput = searchBlock.querySelector('input');
    if (savedSearchValue) searchInput.value = savedSearchValue;
    searchInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') window.searchTableUserByInput(); });

    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    if (activePath.length > 5) activePath = activePath.slice(0, 5);

    // 1. Коренная колонка (0 поколение)
    const firstLoginInPath = activePath[0];
    let rootColumnUsers = [];
    if (firstLoginInPath && referralTreeData[firstLoginInPath]) {
        rootColumnUsers = [referralTreeData[firstLoginInPath]];
    } else {
        rootColumnUsers = Object.values(referralTreeData).filter(node => !node.parentId || node.id === 'SYSTEM_ROOT');
    }
    renderAlignedColumn(wrapper, rootColumnUsers, 0);

    // 2. Последующие колонки рефералов
    for (let i = 0; i < activePath.length && i < 4; i++) {
        const currentLogin = activePath[i];
        const userNode = referralTreeData[currentLogin];

        if (userNode && userNode.children && userNode.children.length > 0) {
            const childrenNodes = userNode.children.map(childLogin => referralTreeData[childLogin]).filter(Boolean);
            renderAlignedColumn(wrapper, childrenNodes, i + 1);
        } else {
            // Если у выбранного пользователя нет рефералов, показываем пустую колонку
            renderAlignedColumn(wrapper, [], i + 1);
            break;
        }
    }

    container.appendChild(wrapper);
}

function renderAlignedColumn(wrapper, usersList, columnIndex) {
    const column = document.createElement('div');
    column.className = 'referral-column';

    if (!usersList || usersList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-column-msg';
        emptyMsg.innerText = 'Нет рефералов в линии';
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

    // Клик по карточке открывает цепочку рефералов и подгружает профиль в верхнюю карточку
    card.addEventListener('click', (e) => {
        e.stopPropagation();

        activePath = activePath.slice(0, columnIndex);
        activePath.push(userLogin);

        const targetContainer = getTableContainer();
        if (targetContainer) renderActiveReferralGrid(targetContainer);

        // Синхронизируем с верхним инпутом поиска профиля
        const searchInput = document.getElementById('search-username-input');
        if (searchInput) {
            searchInput.value = userLogin;
            if (typeof window.searchProfile === 'function') {
                window.searchProfile();
            }
        }
    });

    return card;
}

// Поиск внутри интерактивной таблицы
window.searchTableUserByInput = function() {
    const input = document.getElementById('interactiveTableSearchInput');
    if (!input) return;
    const query = input.value.trim().toLowerCase();
    if (!query) return;

    const foundUserKey = Object.keys(referralTreeData).find(key => 
        key.toLowerCase() === query || 
        (referralTreeData[key].login && referralTreeData[key].login.toLowerCase() === query)
    );

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
        alert('Пользователь не найден в структуре');
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
        const targetContainer = getTableContainer();
        if (targetContainer) renderActiveReferralGrid(targetContainer);
    }
};

// Экспорт для вызова из других модулей (например, при удалении пользователя из админки)
window.loadReferalsTable = loadReferalsTable;

// Фоновое обновление каждые 3 секунды
setInterval(() => { loadReferalsTable(true); }, 3000);
document.addEventListener('DOMContentLoaded', () => { loadReferalsTable(); });
