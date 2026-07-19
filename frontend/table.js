const API_BASE_URL = window.location.origin;

// Локальное хранилище структуры реферального дерева
let referralTreeData = {};
// Текущий активный путь раскрытых пользователей
let activePath = [];
// Логин пользователя, у которого сейчас открыто выпадающее меню действий
let openDropdownUser = null;

// Динамическое внедрение стилей для отображения сетки, растущей вправо
const style = document.createElement('style');
style.innerHTML = `
    .referral-grid-wrapper {
        display: flex !important;
        flex-direction: row !important;
        flex-wrap: nowrap !important;
        align-items: flex-start !important;
        gap: 20px !important;
        overflow-x: auto !important;
        padding: 15px !important;
        background: #f8f9fa;
        border-radius: 8px;
        min-height: 400px;
        width: 100% !important;
        box-sizing: border-box;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
    }
    .referral-column {
        flex: 0 0 260px !important;
        background: #ffffff !important;
        border: 1px solid #e3e6f0 !important;
        border-radius: 6px !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.05) !important;
        display: flex !important;
        flex-direction: column !important;
        max-height: 600px !important;
        overflow-y: auto !important;
    }
    .referral-column-header {
        background: #4e73df !important;
        color: #ffffff !important;
        padding: 10px !important;
        font-weight: bold !important;
        text-align: center !important;
        font-size: 14px !important;
        border-top-left-radius: 5px !important;
        border-top-right-radius: 5px !important;
        position: sticky;
        top: 0;
        z-index: 2;
    }
    .referral-column-body {
        padding: 10px !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 8px !important;
    }
    .user-cell-card {
        border: 1px solid #d1d3e2 !important;
        border-radius: 5px !important;
        padding: 10px !important;
        background: #ffffff !important;
        cursor: pointer !important;
        transition: all 0.2s ease-in-out !important;
        position: relative !important;
        user-select: none !important;
    }
    .user-cell-card:hover {
        background: #f1f3f9 !important;
        border-color: #b7b9cc !important;
    }
    .user-cell-card.active-link {
        background: #eaecf4 !important;
        border-color: #4e73df !important;
        box-shadow: inset 0 0 4px rgba(78,115,223,0.2) !important;
    }
    .user-cell-main {
        display: flex !important;
        justify-content: space-between !important;
        align-items: center !important;
        font-size: 14px !important;
    }
    .user-login-text {
        font-weight: 600 !important;
        color: #2e59d9 !important;
    }
    .children-badge {
        background: #858796 !important;
        color: #fff !important;
        font-size: 11px !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        font-weight: bold !important;
    }
    .user-dropdown-menu {
        margin-top: 8px !important;
        padding-top: 8px !important;
        border-top: 1px dashed #d1d3e2 !important;
        display: flex !important;
        flex-direction: column !important;
        gap: 5px !important;
    }
    .dropdown-btn {
        background: #f8f9fa !important;
        border: 1px solid #d1d3e2 !important;
        color: #3a3b45 !important;
        padding: 6px 8px !important;
        font-size: 12px !important;
        border-radius: 4px !important;
        cursor: pointer !important;
        text-align: left !important;
        transition: background 0.1s ease !important;
    }
    .dropdown-btn:hover {
        background: #4e73df !important;
        color: #ffffff !important;
        border-color: #4e73df !important;
    }
    .empty-column-msg {
        color: #858796 !important;
        font-style: italic !important;
        text-align: center !important;
        padding: 15px !important;
        font-size: 13px !important;
    }
`;
document.head.appendChild(style);

/**
 * Загрузка данных реферальной сети
 */
async function loadReferalsTable() {
    const tableBody = document.getElementById('referals-table-body');
    if (!tableBody) return;

    const container = tableBody.closest('table') || tableBody;
    container.innerHTML = '<div style="text-align:center; color:#4e73df; padding: 20px; width: 100%;">Загрузка активной реферальной сетки...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/referals-tree`);
        const result = await response.json();

        if (!result.success || !result.tree) {
            container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Ошибка загрузки структуры рефералов</div>';
            return;
        }

        referralTreeData = result.tree;

        // Поиск корня
        const rootNode = Object.values(referralTreeData).find(node => !node.parentId || node.parentId === 'SYSTEM_ROOT' && node.id === 'SYSTEM_ROOT') 
                         || Object.values(referralTreeData)[0];

        if (activePath.length === 0 && rootNode) {
            activePath = [rootNode.id];
        }

        renderActiveReferralGrid(container);

    } catch (error) {
        console.error('Ошибка генерации реферальной сетки:', error);
        container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Критическая ошибка на стороне клиента</div>';
    }
}

/**
 * Отрисовка многоколоночной структуры
 */
function renderActiveReferralGrid(container) {
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    // 1. Первая колонка: Корневые лидеры
    const rootUsers = Object.values(referralTreeData).filter(node => !node.parentId || node.id === 'SYSTEM_ROOT');
    renderColumn(wrapper, 'Корневой Лидер', rootUsers, 0);

    // 2. Последующие колонки на основе пути activePath
    for (let i = 0; i < activePath.length; i++) {
        const currentLogin = activePath[i];
        const userNode = referralTreeData[currentLogin];

        if (userNode && userNode.children && userNode.children.length > 0) {
            const childrenNodes = userNode.children.map(childLogin => referralTreeData[childLogin]).filter(Boolean);
            renderColumn(wrapper, `Личники: ${currentLogin}`, childrenNodes, i + 1);
        }
    }

    container.appendChild(wrapper);

    // УМНЫЙ МОБИЛЬНЫЙ СКРОЛЛ: автоматически крутим скроллбар вправо к самой новой колонке
    setTimeout(() => {
        wrapper.scrollLeft = wrapper.scrollWidth;
    }, 50);
}

/**
 * Рендеринг отдельной вертикальной колонки
 */
function renderColumn(wrapper, title, usersList, columnIndex) {
    const column = document.createElement('div');
    column.className = 'referral-column';

    const header = document.createElement('div');
    header.className = 'referral-column-header';
    header.innerText = title;
    column.appendChild(header);

    const body = document.createElement('div');
    body.className = 'referral-column-body';

    if (usersList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-column-msg';
        emptyMsg.innerText = 'Нет зарегистрированных личников';
        body.appendChild(emptyMsg);
    } else {
        usersList.forEach(user => {
            const card = document.createElement('div');
            card.className = 'user-cell-card';
            
            if (activePath.includes(user.id)) {
                card.classList.add('active-link');
            }

            const mainRow = document.createElement('div');
            mainRow.className = 'user-cell-main';
            
            const loginSpan = document.createElement('span');
            loginSpan.className = 'user-login-text';
            loginSpan.innerText = user.login;
            mainRow.appendChild(loginSpan);

            if (user.children && user.children.length > 0) {
                const badge = document.createElement('span');
                badge.className = 'children-badge';
                badge.innerText = `L: ${user.children.length}`;
                mainRow.appendChild(badge);
            }

            card.appendChild(mainRow);

            // Рендер выпадающего меню
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

            // Клик по карточке
            card.addEventListener('click', (e) => {
                e.stopPropagation();

                activePath = activePath.slice(0, columnIndex);
                activePath.push(user.id);

                if (openDropdownUser === user.id) {
                    openDropdownUser = null; 
                } else {
                    openDropdownUser = user.id; 
                }

                const tableBody = document.getElementById('referals-table-body');
                if (tableBody) {
                    const targetContainer = tableBody.closest('table') || tableBody;
                    renderActiveReferralGrid(targetContainer);
                }
            });

            body.appendChild(card);
        });
    }

    column.appendChild(body);
    wrapper.appendChild(column);
}

/**
 * УМНЫЙ ПОИСК (Smart Path): разворачивает всю ветку предков
 */
async function searchReferralUser(login) {
    if (!login) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/api/get-referral-chain?login=${encodeURIComponent(login.trim())}`);
        if (!response.ok) {
            alert('Пользователь не найден в реферальной сети!');
            return;
        }

        const result = await response.json();
        if (result.success && result.chain && result.chain.length > 0) {
            activePath = result.chain;
            openDropdownUser = result.chain[result.chain.length - 1];

            const tableBody = document.getElementById('referals-table-body');
            if (tableBody) {
                const targetContainer = tableBody.closest('table') || tableBody;
                renderActiveReferralGrid(targetContainer);
            }
        }
    } catch (e) {
        console.error('Ошибка работы Умного Поиска:', e);
    }
}

// Экспорт триггеров взаимодействия
window.searchReferralUser = searchReferralUser;
window.viewUserCardTrigger = (login) => {
    if (typeof window.showUserCard === 'function') {
        window.showUserCard(login);
    } else {
        alert(`Инфо-карточка для ${login} не может быть открыта (основной скрипт не загружен).`);
    }
};

window.focusUserMatrixTrigger = (login) => {
    if (typeof window.focusMatrixOnUser === 'function') {
        window.focusMatrixOnUser(login);
        // Дополнительно переключаем юзера на вкладку Матрицы, если она есть
        const matrixTab = document.getElementById('tab-matrix') || document.querySelector('[href="#matrix"]');
        if (matrixTab) matrixTab.click();
    } else {
        alert(`Матрица не найдена на странице.`);
    }
};

window.copyToClipboardTrigger = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const oldText = btn.innerText;
        btn.innerText = '✅ Скопировано!';
        setTimeout(() => { btn.innerText = oldText; }, 1500);
    }).catch(err => console.error('Не удалось скопировать:', err));
};

// Глобальный клик для закрытия меню действий
document.addEventListener('click', () => {
    if (openDropdownUser !== null) {
        openDropdownUser = null;
        const tableBody = document.getElementById('referals-table-body');
        if (tableBody) {
            const targetContainer = tableBody.closest('table') || tableBody;
            renderActiveReferralGrid(targetContainer);
        }
    }
});

// Автоматическая привязка событий
document.addEventListener('DOMContentLoaded', () => {
    loadReferalsTable();
    
    const refreshBtn = document.getElementById('refresh-table-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadReferalsTable);
    }

    const searchInput = document.getElementById('user-search-input') || document.querySelector('.search-box input');
    const searchBtn = document.getElementById('user-search-btn') || document.querySelector('.search-box button');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchReferralUser(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchReferralUser(searchInput.value);
        });
    }
});
