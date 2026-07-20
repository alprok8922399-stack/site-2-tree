const API_BASE_URL = window.location.origin;

// Локальное хранилище структуры реферального дерева
let referralTreeData = {};
// Текущий активный путь раскрытых пользователей (массив логинов)
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
        background: #181818;
        border-radius: 8px;
        min-height: 400px;
        width: 100% !important;
        box-sizing: border-box;
        scroll-behavior: smooth;
        -webkit-overflow-scrolling: touch;
    }
    .referral-column {
        flex: 0 0 260px !important;
        background: #222222 !important;
        border: 1px solid #333333 !important;
        border-radius: 6px !important;
        box-shadow: 0 2px 4px rgba(0,0,0,0.5) !important;
        display: flex !important;
        flex-direction: column !important;
        max-height: 600px !important;
        overflow-y: auto !important;
    }
    .referral-column-header {
        background: #2c5f2d !important;
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
        border: 1px solid #444444 !important;
        border-radius: 5px !important;
        padding: 10px !important;
        background: #2a2a2a !important;
        cursor: pointer !important;
        transition: all 0.2s ease-in-out !important;
        position: relative !important;
        user-select: none !important;
    }
    .user-cell-card:hover {
        background: #333333 !important;
        border-color: #666666 !important;
    }
    .user-cell-card.active-link {
        background: #1e3a20 !important;
        border-color: #4CAF50 !important;
        box-shadow: inset 0 0 4px rgba(76,175,80,0.4) !important;
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
    .children-badge {
        background: #555555 !important;
        color: #fff !important;
        font-size: 11px !important;
        padding: 2px 6px !important;
        border-radius: 10px !important;
        font-weight: bold !important;
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
        transition: background 0.1s ease !important;
    }
    .dropdown-btn:hover {
        background: #4CAF50 !important;
        color: #ffffff !important;
        border-color: #4CAF50 !important;
    }
    .empty-column-msg {
        color: #888888 !important;
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

    try {
        const response = await fetch(`${API_BASE_URL}/api/referals-tree?t=${Date.now()}`);
        const result = await response.json();

        if (!result.success || !result.tree) {
            container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Ошибка загрузки структуры рефералов</div>';
            return;
        }

        referralTreeData = result.tree;

        // Определяем корневого лидера
        const rootUser = referralTreeData['SYSTEM_ROOT'] || Object.values(referralTreeData).find(node => !node.parentId) || Object.values(referralTreeData)[0];

        if (activePath.length === 0 && rootUser) {
            activePath = [rootUser.id];
        }

        renderActiveReferralGrid(container);

    } catch (error) {
        console.error('Ошибка генерации реферальной сетки:', error);
        container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Критическая ошибка на стороне клиента</div>';
    }
}

/**
 * Отрисовка многоколоночной структуры (Активная Реферальная Сетка)
 */
function renderActiveReferralGrid(container) {
    container.innerHTML = '';
    
    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';
    wrapper.id = 'referralGridWrapper';

    // 1. Первая колонка: Корневой Лидер (Михаил / SYSTEM_ROOT)
    const rootUsers = Object.values(referralTreeData).filter(node => !node.parentId || node.id === 'SYSTEM_ROOT');
    renderColumn(wrapper, 'Корневой Лидер', rootUsers, 0);

    // 2. Последующие колонки: Личники пользователей из activePath
    for (let i = 0; i < activePath.length; i++) {
        const currentLogin = activePath[i];
        const userNode = referralTreeData[currentLogin];

        if (userNode && userNode.children && userNode.children.length > 0) {
            const childrenNodes = userNode.children.map(childLogin => referralTreeData[childLogin]).filter(Boolean);
            renderColumn(wrapper, `Личники: ${currentLogin}`, childrenNodes, i + 1);
        }
    }

    container.appendChild(wrapper);

    // Автоматическая прокрутка вправо к последней открытой колонке
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

    if (!usersList || usersList.length === 0) {
        const emptyMsg = document.createElement('div');
        emptyMsg.className = 'empty-column-msg';
        emptyMsg.innerText = 'Нет зарегистрированных личников';
        body.appendChild(emptyMsg);
    } else {
        usersList.forEach(user => {
            const card = document.createElement('div');
            card.className = 'user-cell-card';
            
            // Если пользователь входит в активный путь раскрытия
            if (activePath.includes(user.id)) {
                card.classList.add('active-link');
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

            // Рендер выпадающего меню внутри ячейки
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

            // Клик по карточке пользователя
            card.addEventListener('click', (e) => {
                e.stopPropagation();

                // Отрезаем цепочку до колонки, где кликнули, и добавляем кликнутого человека
                activePath = activePath.slice(0, columnIndex);
                activePath.push(user.id);

                // Переключаем 상태 выпадающего меню
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
 * УМНЫЙ ПОИСК (Smart Path): разворачивает всю ветку предков от корня до пользователя
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
window.refreshReferralTable = loadReferalsTable;

window.viewUserCardTrigger = (login) => {
    if (typeof window.showUserCard === 'function') {
        window.showUserCard(login);
    } else {
        alert(`Логин: ${login}`);
    }
};

window.focusUserMatrixTrigger = (login) => {
    if (typeof window.searchMatrixUser === 'function') {
        window.searchMatrixUser(login);
    } else {
        alert(`Поиск по матрице недоступен`);
    }
};

window.copyToClipboardTrigger = (text, btn) => {
    navigator.clipboard.writeText(text).then(() => {
        const oldText = btn.innerText;
        btn.innerText = '✅ Скопировано!';
        setTimeout(() => { btn.innerText = oldText; }, 1500);
    }).catch(err => console.error('Не удалось скопировать:', err));
};

// Глобальный клик для закрытия меню действий при клике вне карточки
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

// Автоматическая привязка событий при загрузке страницы
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
