const API_BASE_URL = window.location.origin;

let referralTreeData = {};
let activePath = [];
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
    .table-search-input:focus {
        border-color: #4CAF50;
    }
    .table-search-btn {
        background: #2c5f2d;
        color: #fff;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        white-space: nowrap;
    }
    .table-search-btn:hover { background: #3e8e41; }
    .table-matrix-btn {
        background: #8e44ad;
        color: #fff;
        border: none;
        padding: 8px 12px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        white-space: nowrap;
    }
    .table-matrix-btn:hover { background: #9b59b6; }
    .table-nav-btn {
        background: #2980b9;
        color: #fff;
        border: none;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        white-space: nowrap;
    }
    .table-nav-btn:hover { background: #3498db; }
    .table-reset-btn {
        background: #d35400;
        color: #fff;
        border: none;
        padding: 8px 10px;
        border-radius: 6px;
        cursor: pointer;
        font-weight: bold;
        font-size: 13px;
        white-space: nowrap;
    }
    .table-reset-btn:hover { background: #e67e22; }
    .referral-grid-wrapper {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: flex-start !important;
        gap: 12px !important;
        overflow-x: auto !important;
        padding: 10px 5px !important;
        background: #181818;
        border-radius: 8px;
        min-height: 450px;
        width: 100% !important;
        box-sizing: border-box;
        -webkit-overflow-scrolling: touch;
    }
    .referral-column {
        flex: 0 0 220px !important;
        background: #222222 !important;
        border: 1px solid #333333 !important;
        border-radius: 6px !important;
        display: flex !important;
        flex-direction: column !important;
        max-height: 650px !important;
        overflow-y: auto !important;
        padding: 8px !important;
        gap: 8px !important;
    }
    .column-header-title {
        font-size: 12px;
        font-weight: bold;
        color: #888;
        text-align: center;
        padding-bottom: 4px;
        border-bottom: 1px solid #333;
        margin-bottom: 4px;
    }
    .table-row-slot {
        min-height: 52px;
        display: flex;
        flex-direction: column;
        justify-content: center;
    }
    .user-cell-card {
        border: 1px solid #444444 !important;
        border-radius: 5px !important;
        padding: 10px !important;
        background: #2a2a2a !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        position: relative !important;
        user-select: none !important;
        box-sizing: border-box;
    }
    .user-cell-card.admin-card {
        border-color: #f39c12 !important;
        background: #342308 !important;
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
        animation: pulseRed 1.5s infinite alternate;
    }
    @keyframes pulseRed {
        0% { box-shadow: 0 0 5px #ff4757; }
        100% { box-shadow: 0 0 20px #ff4757; }
    }
    .user-cell-main {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        font-size: 14px !important;
    }
    .user-login-text {
        font-weight: 600 !important;
        color: #4CAF50 !important;
    }
    .user-cell-card.admin-card .user-login-text {
        color: #f1c40f !important;
    }
    .children-badge {
        background: #555555 !important;
        color: #fff !important;
        font-size: 11px !important;
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
document.head.appendChild(style);

/**
 * Загрузка реферального дерева
 */
async function loadReferalsTable(isBackground = false) {
    const targetContainer = document.getElementById('referals-table-body');
    if (!targetContainer) return;

    try {
        const response = await fetch(`${API_BASE_URL}/api/referals-tree?t=${Date.now()}`);
        const result = await response.json();

        if (!result.success || !result.tree) return;

        const newTreeJsonString = JSON.stringify(result.tree);
        
        if (isBackground && newTreeJsonString === lastTreeJsonString) return;
        if (isBackground && isUserInteracting) return;

        lastTreeJsonString = newTreeJsonString;
        referralTreeData = result.tree;

        renderActiveReferralGrid(targetContainer, isBackground);

    } catch (error) {
        console.error('Ошибка загрузки интерактивной таблицы:', error);
    }
}

/**
 * Отрисовка интерактивной таблицы (Первые 3 места Админа + срез на 5 столбцов)
 */
function renderActiveReferralGrid(container, isBackground = false) {
    const oldInput = document.getElementById('interactiveTableSearchInput');
    const savedSearchValue = oldInput ? oldInput.value : '';
    const isInputFocused = (document.activeElement === oldInput);

    const wrapperOld = document.getElementById('referralGridWrapper');
    const scrollLeftVal = wrapperOld ? wrapperOld.scrollLeft : 0;
    
    container.innerHTML = '';
    
    // Поиск и кнопки навигации
    const searchBlock = document.createElement('div');
    searchBlock.className = 'table-search-container';
    searchBlock.innerHTML = `
        <input type="text" id="interactiveTableSearchInput" class="table-search-input" placeholder="Поиск пользователя в таблице..." />
        <button type="button" class="table-search-btn" onclick="window.searchTableUserByInput()">Найти</button>
        <button type="button" class="table-matrix-btn" onclick="window.showSearchedInMatrix()">Показать в матрице</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableStart()">⏮️ В начало</button>
        <button type="button" class="table-nav-btn" onclick="window.scrollToTableEnd()">⏭️ В конец</button>
        <button type="button" class="table-reset-btn" onclick="window.resetTableToRoot()">🏠 К корню</button>
    `;
    container.appendChild(searchBlock);

    const searchInput = searchBlock.querySelector('input');
    if (savedSearchValue) searchInput.value = savedSearchValue;

    if (isInputFocused) {
        setTimeout(() => {
            searchInput.focus();
            searchInput.setSelectionRange(savedSearchValue.length, savedSearchValue.length);
        }, 0);
    }

    searchInput.addEventListener('input', () => { isUserInteracting = true; });
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.searchTableUserByInput();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    // Формируем срез из 5 колонок
    const maxColumns = 5;
    
    // Определяем 1-ю колонку: Первые 3 места Администрации
    let adminNodes = [];
    const rootUser = referralTreeData['SYSTEM_ROOT'] || Object.values(referralTreeData).find(n => !n.parentId);
    
    if (rootUser) {
        adminNodes.push(rootUser);
        if (rootUser.children) {
            rootUser.children.forEach(childId => {
                if (referralTreeData[childId] && adminNodes.length < 3) {
                    adminNodes.push(referralTreeData[childId]);
                }
            });
        }
    }

    if (activePath.length === 0 && adminNodes.length > 0) {
        activePath = [adminNodes[0].id];
    }

    // Рендерим 1-ю колонку (Администрация)
    renderAlignedColumn(wrapper, adminNodes, 0, 'Столбец 1 (Администрация)');

    // Рендерим последующие столбцы (от 2 до 5) по активному пути
    for (let colIdx = 1; colIdx < maxColumns; colIdx++) {
        const parentId = activePath[colIdx - 1];
        if (parentId && referralTreeData[parentId]) {
            const parentNode = referralTreeData[parentId];
            const childrenNodes = (parentNode.children || []).map(id => referralTreeData[id]).filter(Boolean);
            renderAlignedColumn(wrapper, childrenNodes, colIdx, `Столбец ${colIdx + 1}`);
        } else {
            renderAlignedColumn(wrapper, [], colIdx, `Столбец ${colIdx + 1}`);
        }
    }

    container.appendChild(wrapper);

    if (highlightedTableUser && !isBackground) {
        setTimeout(() => {
            const targetCard = document.getElementById(`table-user-${highlightedTableUser}`);
            if (targetCard) {
                targetCard.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
            }
        }, 50);
    } else if (scrollLeftVal > 0) {
        wrapper.scrollLeft = scrollLeftVal;
    }
}

/**
 * Рендер отдельного столбца
 */
function renderAlignedColumn(wrapper, usersList, columnIndex, titleText) {
    const column = document.createElement('div');
    column.className = 'referral-column';

    const header = document.createElement('div');
    header.className = 'column-header-title';
    header.innerText = titleText;
    column.appendChild(header);

    if (!usersList || usersList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-column-msg';
        emptyMsg.innerText = 'Нет личников';
        column.appendChild(emptyMsg);
    } else {
        usersList.forEach((user) => {
            const slot = document.createElement('div');
            slot.className = 'table-row-slot';
            slot.appendChild(createUserCardElement(user, columnIndex));
            column.appendChild(slot);
        });
    }

    wrapper.appendChild(column);
}

/**
 * Элемент карточки в таблице
 */
function createUserCardElement(user, columnIndex) {
    const card = document.createElement('div');
    card.className = 'user-cell-card';
    card.id = `table-user-${user.login}`;

    if (user.isAdmin || user.login.toLowerCase().includes('admin') || user.login === 'SYSTEM_ROOT') {
        card.classList.add('admin-card');
    }

    if (activePath.includes(user.id)) {
        card.classList.add('active-link');
    }

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

    // Клики по ячейке
    card.addEventListener('click', (e) => {
        e.stopPropagation();
        isUserInteracting = true;

        activePath = activePath.slice(0, columnIndex);
        activePath.push(user.id);

        const targetContainer = document.getElementById('referals-table-body');
        if (targetContainer) {
            renderActiveReferralGrid(targetContainer, false);
        }

        // Вызываем НОВУЮ Инфо-Карточку!
        if (typeof window.showUserCard === 'function') {
            window.showUserCard(user.login);
        }

        setTimeout(() => { isUserInteracting = false; }, 1000);
    });

    return card;
}

/**
 * Поиск по таблице
 */
async function searchReferralUser(login) {
    if (!login) return;
    isUserInteracting = true;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/get-referral-chain?login=${encodeURIComponent(login.trim())}`);
        if (!response.ok) {
            alert('Пользователь не найден в системе!');
            isUserInteracting = false;
            return;
        }

        const result = await response.json();
        if (result.success && result.chain && result.chain.length > 0) {
            activePath = result.chain;
            highlightedTableUser = login.trim();

            const targetContainer = document.getElementById('referals-table-body');
            if (targetContainer) {
                renderActiveReferralGrid(targetContainer, false);
            }
        }
    } catch (e) {
        console.error('Ошибка поиска по таблице:', e);
    } finally {
        setTimeout(() => { isUserInteracting = false; }, 1000);
    }
}

window.resetTableToRoot = () => {
    const rootUser = referralTreeData['SYSTEM_ROOT'] || Object.values(referralTreeData).find(n => !n.parentId);
    if (rootUser) {
        activePath = [rootUser.id];
        highlightedTableUser = null;
        
        const inp = document.getElementById('interactiveTableSearchInput');
        if (inp) inp.value = '';

        const targetContainer = document.getElementById('referals-table-body');
        if (targetContainer) renderActiveReferralGrid(targetContainer, false);
    }
};

window.scrollToTableStart = () => {
    const wrapper = document.getElementById('referralGridWrapper');
    if (wrapper) wrapper.scrollTo({ left: 0, behavior: 'smooth' });
};

window.scrollToTableEnd = () => {
    const wrapper = document.getElementById('referralGridWrapper');
    if (wrapper) wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: 'smooth' });
};

window.searchTableUserByInput = () => {
    const inp = document.getElementById('interactiveTableSearchInput');
    if (inp && inp.value) searchReferralUser(inp.value);
};

window.showSearchedInMatrix = () => {
    const inp = document.getElementById('interactiveTableSearchInput');
    const login = inp && inp.value ? inp.value.trim() : highlightedTableUser;
    if (login) {
        if (typeof window.searchMatrixUser === 'function') {
            window.searchMatrixUser(login);
        } else {
            alert(`Поиск по матрице для ${login}`);
        }
    } else {
        alert('Введите логин пользователя!');
    }
};

window.searchReferralUser = searchReferralUser;
window.refreshReferralTable = () => loadReferalsTable(false);

setInterval(() => {
    const inp = document.getElementById('interactiveTableSearchInput');
    if (document.activeElement === inp && inp && inp.value.length > 0) return;
    loadReferalsTable(true);
}, 3000);

document.addEventListener('DOMContentLoaded', () => {
    loadReferalsTable(false);
});
