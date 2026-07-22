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
    .table-search-btn:hover {
        background: #3e8e41;
    }
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
    .table-matrix-btn:hover {
        background: #9b59b6;
    }
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
    .table-nav-btn:hover {
        background: #3498db;
    }
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
    .table-reset-btn:hover {
        background: #e67e22;
    }
    .referral-grid-wrapper {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: flex-start !important;
        gap: 15px !important;
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
        flex: 0 0 250px !important;
        background: #222222 !important;
        border: 1px solid #333333 !important;
        border-radius: 6px !important;
        display: flex !important;
        flex-direction: column !important;
        max-height: 600px !important;
        overflow-y: auto !important;
        padding: 8px !important;
        gap: 6px !important;
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
    .user-cell-card.searched-highlight .user-login-text {
        color: #ffffff !important;
    }
    .children-badge {
        background: #555555 !important;
        color: #fff !important;
        font-size: 11px !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        font-weight: bold;
    }
    .user-dropdown-menu {
        margin-top: 8px !important;
        padding-top: 8px !important;
        border-top: 1px dashed #444444 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 5px !important;
    }
    .dropdown-btn {
        background: #333333 !important;
        border: 1px solid #555555 !important;
        color: #ffffff !important;
        padding: 6px 8px !important;
        font-size: 12px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        text-align: left !important;
    }
    .dropdown-btn:hover {
        background: #4CAF50 !important;
        border-color: #4CAF50 !important;
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
        
        if (isBackground && newTreeJsonString === lastTreeJsonString) {
            return;
        }

        if (isBackground && isUserInteracting) {
            return;
        }

        lastTreeJsonString = newTreeJsonString;
        referralTreeData = result.tree;

        const rootUser = referralTreeData['SYSTEM_ROOT'] || Object.values(referralTreeData).find(node => !node.parentId) || Object.values(referralTreeData)[0];

        if (activePath.length === 0 && rootUser) {
            activePath = [rootUser.id];
        }

        renderActiveReferralGrid(targetContainer, isBackground);

    } catch (error) {
        console.error('Ошибка загрузки интерактивной таблицы:', error);
    }
}

/**
 * Отрисовка интерактивной таблицы с УЗКИМ СРЕЗОМ
 */
function renderActiveReferralGrid(container, isBackground = false) {
    const oldInput = document.getElementById('interactiveTableSearchInput');
    const savedSearchValue = oldInput ? oldInput.value : '';
    const isInputFocused = (document.activeElement === oldInput);

    const wrapperOld = document.getElementById('referralGridWrapper');
    const scrollLeftVal = wrapperOld ? wrapperOld.scrollLeft : 0;
    
    const columnScrolls = {};
    if (wrapperOld) {
        const cols = wrapperOld.querySelectorAll('.referral-column');
        cols.forEach((col, idx) => {
            columnScrolls[idx] = col.scrollTop;
        });
    }

    container.innerHTML = '';
    
    // Блок поиска и кнопок быстрой навигации
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

    if (savedSearchValue) {
        searchInput.value = savedSearchValue;
    }

    if (isInputFocused) {
        setTimeout(() => {
            searchInput.focus();
            searchInput.setSelectionRange(savedSearchValue.length, savedSearchValue.length);
        }, 0);
    }

    searchInput.addEventListener('input', () => {
        isUserInteracting = true;
    });

    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.searchTableUserByInput();
    });

    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    // РЕНДЕР СРЕЗА: Рендерим колонки строго по активному пути activePath
    if (activePath.length > 0) {
        // Первая колонка среза — это первый элемент в activePath
        const startId = activePath[0];
        const startUser = referralTreeData[startId];

        if (startUser) {
            renderAlignedColumn(wrapper, [startUser], 0, null);
        }

        // Каждая последующая колонка рендерит ДЕТЕЙ предыдущего выбранного пользователя из activePath
        for (let i = 0; i < activePath.length; i++) {
            const currentLogin = activePath[i];
            const userNode = referralTreeData[currentLogin];

            if (userNode && userNode.children && userNode.children.length > 0) {
                const childrenNodes = userNode.children.map(childLogin => referralTreeData[childLogin]).filter(Boolean);
                renderAlignedColumn(wrapper, childrenNodes, i + 1, userNode);
            }
        }
    }

    container.appendChild(wrapper);

    // Восстанавливаем скролл колонок
    const newCols = wrapper.querySelectorAll('.referral-column');
    newCols.forEach((col, idx) => {
        if (columnScrolls[idx]) {
            col.scrollTop = columnScrolls[idx];
        }
    });

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

function renderAlignedColumn(wrapper, usersList, columnIndex, parentNode) {
    const column = document.createElement('div');
    column.className = 'referral-column';

    if (!usersList || usersList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-column-msg';
        emptyMsg.innerText = 'Нет зарегистрированных личников';
        column.appendChild(emptyMsg);
    } else {
        if (parentNode && parentNode.children) {
            parentNode.children.forEach(childId => {
                const slot = document.createElement('div');
                slot.className = 'table-row-slot';
                
                const user = referralTreeData[childId];
                if (user) {
                    slot.appendChild(createUserCardElement(user, columnIndex));
                }
                column.appendChild(slot);
            });
        } else {
            usersList.forEach(user => {
                const slot = document.createElement('div');
                slot.className = 'table-row-slot';
                slot.appendChild(createUserCardElement(user, columnIndex));
                column.appendChild(slot);
            });
        }
    }

    wrapper.appendChild(column);
}

function createUserCardElement(user, columnIndex) {
    const card = document.createElement('div');
    card.className = 'user-cell-card';
    card.id = `table-user-${user.login}`;
    
    const isAlreadyActive = activePath[columnIndex] === user.id;

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

    if (openDropdownUser === user.id) {
        const dropdown = document.createElement('div');
        dropdown.className = 'user-dropdown-menu';
        dropdown.onclick = (e) => e.stopPropagation(); 

        dropdown.innerHTML = `
            <button class="dropdown-btn" onclick="window.viewUserCardTrigger('${user.login}')">👤 Открыть Инфо-Карточку</button>
            <button class="dropdown-btn" onclick="window.focusUserMatrixTrigger('${user.login}')">📊 Показать в Матрице</button>
            <button class="dropdown-btn" onclick="window.copyToClipboardTrigger('${user.login}', this)">📋 Копировать логин</button>
        `;
        card.appendChild(dropdown);
    }

    card.addEventListener('click', (e) => {
        e.stopPropagation();
        isUserInteracting = true;

        if (isAlreadyActive && activePath.length > columnIndex + 1) {
            activePath = activePath.slice(0, columnIndex + 1);
            openDropdownUser = null;
        } else {
            activePath = activePath.slice(0, columnIndex);
            activePath.push(user.id);

            if (openDropdownUser === user.id) {
                openDropdownUser = null; 
            } else {
                openDropdownUser = user.id; 
            }
        }

        const targetContainer = document.getElementById('referals-table-body');
        if (targetContainer) {
            renderActiveReferralGrid(targetContainer, false);
        }

        setTimeout(() => { isUserInteracting = false; }, 1000);
    });

    return card;
}

/**
 * ПОИСК С УЗКИМ СРЕЗОМ: берет только последних 3 человек из цепочки!
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
            const fullChain = result.chain;
            
            // БЕРЕМ СРЕЗ: Ровно последних 3 человека (Спонсор -> Пользователь -> Дети)
            if (fullChain.length > 3) {
                activePath = fullChain.slice(-3);
            } else {
                activePath = fullChain;
            }

            openDropdownUser = fullChain[fullChain.length - 1];
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

// Сброс таблицы к главному корню
window.resetTableToRoot = () => {
    const rootUser = referralTreeData['SYSTEM_ROOT'] || Object.values(referralTreeData).find(node => !node.parentId) || Object.values(referralTreeData)[0];
    if (rootUser) {
        activePath = [rootUser.id];
        openDropdownUser = null;
        highlightedTableUser = null;
        
        const inp = document.getElementById('interactiveTableSearchInput');
        if (inp) inp.value = '';

        const targetContainer = document.getElementById('referals-table-body');
        if (targetContainer) {
            renderActiveReferralGrid(targetContainer, false);
        }
    }
};

// Навигационные функции (В начало / В конец)
window.scrollToTableStart = () => {
    const wrapper = document.getElementById('referralGridWrapper');
    if (wrapper) {
        wrapper.scrollTo({ left: 0, behavior: 'smooth' });
    }
};

window.scrollToTableEnd = () => {
    const wrapper = document.getElementById('referralGridWrapper');
    if (wrapper) {
        wrapper.scrollTo({ left: wrapper.scrollWidth, behavior: 'smooth' });
    }
};

window.searchTableUserByInput = () => {
    const inp = document.getElementById('interactiveTableSearchInput');
    if (inp && inp.value) {
        searchReferralUser(inp.value);
    }
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

window.viewUserCardTrigger = (login) => {
    if (typeof window.showUserCard === 'function') {
        window.showUserCard(login);
    } else {
        alert(`Инфо-Карточка: ${login}`);
    }
};

window.focusUserMatrixTrigger = (login) => {
    if (typeof window.searchMatrixUser === 'function') {
        window.searchMatrixUser(login);
    } else {
        alert(`Поиск по матрице для ${login}`);
    }
};

window.copyToClipboardTrigger = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const oldText = btn.innerText;
        btn.innerText = '✅ Скопировано!';
        setTimeout(() => { btn.innerText = oldText; }, 1500);
    }).catch(err => console.error('Ошибка копирования:', err));
};

document.addEventListener('click', () => {
    if (openDropdownUser !== null) {
        openDropdownUser = null;
        const targetContainer = document.getElementById('referals-table-body');
        if (targetContainer) {
            renderActiveReferralGrid(targetContainer, false);
        }
    }
});

setInterval(() => {
    const inp = document.getElementById('interactiveTableSearchInput');
    if (document.activeElement === inp && inp && inp.value.length > 0) {
        return;
    }
    loadReferalsTable(true);
}, 3000);

document.addEventListener('DOMContentLoaded', () => {
    loadReferalsTable(false);
});
