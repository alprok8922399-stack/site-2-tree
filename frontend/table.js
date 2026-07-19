const API_BASE_URL = window.location.origin;

// Локальное хранилище структуры реферального дерева
let referralTreeData = {};
// Текущий активный путь раскрытых пользователей (например: ['SYSTEM_ROOT', 'LEADER_1', 'Михаил'])
let activePath = [];
// Логин пользователя, у которого сейчас открыто выпадающее меню действий внутри ячейки
let openDropdownUser = null;

// Динамическое внедрение стилей для отображения сетки, растущей вправо
const style = document.createElement('style');
style.innerHTML = `
    .referral-grid-wrapper {
        display: flex !important;
        flex-direction: row !important;
        align-items: flex-start !important;
        gap: 20px !important;
        overflow-x: auto !important;
        padding: 15px !important;
        background: #f8f9fa;
        border-radius: 8px;
        min-height: 400px;
        width: 100% !important;
        box-sizing: border-box;
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
        padding: 4px 8px !important;
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
 * Основная функция инициализации и загрузки данных реферальной сети
 */
async function loadReferalsTable() {
    const tableBody = document.getElementById('referals-table-body');
    if (!tableBody) return;

    // Авто-настройка контейнера под Flex для поддержки бесконечного роста вправо
    const container = tableBody.closest('table') || tableBody;
    container.innerHTML = '<div style="text-align:center; padding: 20px; width: 100%;">Загрузка активной реферальной сетки...</div>';

    try {
        const response = await fetch(`${API_BASE_URL}/api/referals-tree`);
        const result = await response.json();

        if (!result.success || !result.tree) {
            container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Ошибка загрузки структуры рефералов</div>';
            return;
        }

        referralTreeData = result.tree;

        // Определяем корневого Лидера системы (у которого parentId равен null или отсутствует)
        const rootNode = Object.values(referralTreeData).find(node => !node.parentId || node.parentId === 'SYSTEM_ROOT' && node.id === 'SYSTEM_ROOT') 
                         || Object.values(referralTreeData)[0];

        // Если путь пуст, инициализируем его корнем системы
        if (activePath.length === 0 && rootNode) {
            activePath = [rootNode.id];
        }

        // Отрисовываем сетку
        renderActiveReferralGrid(container);

    } catch (error) {
        console.error('Ошибка генерации реферальной сетки:', error);
        container.innerHTML = '<div style="text-align:center; color:red; padding: 20px;">Критическая ошибка на стороне клиента</div>';
    }
}

/**
 * Отрисовка многоколоночной структуры слева направо
 */
function renderActiveReferralGrid(container) {
    container.innerHTML = '';
    
    // Создаем обертку для горизонтального скролла колонок
    const wrapper = document.createElement('div');
    wrapper.className = 'referral-grid-wrapper';

    // 1. Первая колонка: Всегда выводит корневых лидеров (уровень 1)
    const rootUsers = Object.values(referralTreeData).filter(node => !node.parentId || node.id === 'SYSTEM_ROOT');
    renderColumn(wrapper, 'Корневой Лидер', rootUsers, 0);

    // 2. Последующие колонки: Строятся на основе выбранного пути activePath
    for (let i = 0; i < activePath.length; i++) {
        const currentLogin = activePath[i];
        const userNode = referralTreeData[currentLogin];

        if (userNode && userNode.children && userNode.children.length > 0) {
            // Находим объекты детей по их логинам
            const childrenNodes = userNode.children.map(childLogin => referralTreeData[childLogin]).filter(Boolean);
            renderColumn(wrapper, `Личники: ${currentLogin}`, childrenNodes, i + 1);
        }
    }

    container.appendChild(wrapper);
}

/**
 * Рендеринг отдельной вертикальной колонки рефералов
 */
function renderColumn(wrapper, title, usersList, columnIndex) {
    const column = document.createElement('div');
    column.className = 'referral-column';

    // Заголовок колонки
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
            
            // Если пользователь находится в текущей цепочке выбора — подсвечиваем его
            if (activePath.includes(user.id)) {
                card.classList.add('active-link');
            }

            // Основная строка карточки (Имя + Кол-во личников)
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

            // КОМБО-ЭФФЕКТ: Выпадающий список быстрых действий внутри ячейки
            if (openDropdownUser === user.id) {
                const dropdown = document.createElement('div');
                dropdown.className = 'user-dropdown-menu';
                dropdown.onclick = (e) => e.stopPropagation(); // Защита от клика по карточке

                dropdown.innerHTML = `
                    <button class="dropdown-btn" onclick="window.viewUserCardTrigger('${user.login}')">👤 Открыть Инфо-Карточку</button>
                    <button class="dropdown-btn" onclick="window.focusUserMatrixTrigger('${user.login}')">📊 Показать в Матрице</button>
                    <button class="dropdown-btn" onclick="navigator.clipboard.writeText('${user.login}')">📋 Копировать логин</button>
                `;
                card.appendChild(dropdown);
            }

            // Обработка клика по карточке пользователя
            card.addEventListener('click', (e) => {
                e.stopPropagation();

                // 1. Корректируем цепочку path под текущий уровень
                activePath = activePath.slice(0, columnIndex);
                activePath.push(user.id);

                // 2. Переключаем состояние выпадающего списка внутри ячейки
                if (openDropdownUser === user.id) {
                    openDropdownUser = null; // Закрываем, если кликнули повторно
                } else {
                    openDropdownUser = user.id; // Открываем выпадающий список
                }

                // Перерисовываем интерфейс сетки
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
 * УМНЫЙ ПОИСК (Smart Path): Находит пользователя, вычисляет всю цепочку предков 
 * до корня, автоматически раскрывает все списки и фокусирует интерфейс.
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
            // Активируем всю цепочку раскрытия от корня до цели
            activePath = result.chain;
            // Автоматически открываем выпадающий список действий у найденного юзера
            openDropdownUser = result.chain[result.chain.length - 1];

            // Обновляем отображение сетки
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

// Экспортируем функции в глобальную область видимости окон для связи с другими модулями фронтенда
window.searchReferralUser = searchReferralUser;
window.viewUserCardTrigger = (login) => {
    console.log(`Инфо-карточка для ${login} вызвана.`);
    if (typeof window.showUserCard === 'function') window.showUserCard(login);
};
window.focusUserMatrixTrigger = (login) => {
    console.log(`Фокусировка матрицы на ${login}`);
    if (typeof window.focusMatrixOnUser === 'function') window.focusMatrixOnUser(login);
};

// Автоматическая привязка при загрузке документа
document.addEventListener('DOMContentLoaded', () => {
    loadReferalsTable();
    
    const refreshBtn = document.getElementById('refresh-table-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadReferalsTable);
    }

    // Авто-поиск: перехват стандартной поисковой строки, если она есть на странице
    const searchInput = document.getElementById('user-search-input') || document.querySelector('.search-box input');
    const searchBtn = document.getElementById('user-search-btn') || document.querySelector('.search-box button');

    if (searchBtn && searchInput) {
        searchBtn.addEventListener('click', () => searchReferralUser(searchInput.value));
        searchInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') searchReferralUser(searchInput.value);
        });
    }
});
