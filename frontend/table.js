/* ==========================================================================
   📊 СКРИПТ УПРАВЛЕНИЯ ТАБЛИЦЕЙ РЕФЕРАЛОВ (ДЕРЕВО СВЯЗЕЙ)
      ИЗМЕНЕНИЯ НЕ ВНОСИТЬ! ТОЛЬКО ЧТЕНИЕ!!!
   ========================================================================== */

const TABLE_API_URL = '/api';

// Элементы интерактивной таблицы и меню
const menuToggleBtn = document.getElementById('menuToggleBtn');
const menuContent = document.getElementById('menuContent');
const openTableBtn = document.getElementById('openTableBtn');
const tableOverlay = document.getElementById('tableOverlay');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');
const interactiveRefTableBody = document.getElementById('interactiveRefTableBody');
const refSearchInput = document.getElementById('refSearchInput');
const refSearchBtn = document.getElementById('refSearchBtn');
const refSearchResetBtn = document.getElementById('refSearchResetBtn');

let expandedUsers = new Set(); // Кэш развернутых пользователей в таблице
let currentRefSearch = ''; // Поисковый запрос для таблицы

// Открытие / Закрытие шторки меню
if (menuToggleBtn) {
    menuToggleBtn.addEventListener('click', () => {
        menuContent.classList.toggle('show');
    });
}

// Открытие оверлея таблицы
if (openTableBtn) {
    openTableBtn.addEventListener('click', async () => {
        if (menuContent) menuContent.classList.remove('show');
        tableOverlay.classList.add('show');
        document.body.style.overflow = 'hidden';
        await updateReferralTable();
    });
}

// Закрытие оверлея таблицы
if (closeOverlayBtn) {
    closeOverlayBtn.addEventListener('click', () => {
        tableOverlay.classList.remove('show');
        document.body.style.overflow = '';
    });
}

// Запрос и отрисовка реферальной структуры
async function updateReferralTable() {
    try {
        const res = await fetch(`${TABLE_API_URL}/referrals`);
        const data = await res.json();
        if (!data.success) return;
        
        interactiveRefTableBody.innerHTML = "";
        
        // Генерация заголовков таблицы
        const headerRow = document.createElement('tr');
        headerRow.innerHTML = `
            <th style="width: 60%;">Логин Лидера / Партнера</th>
            <th style="width: 20%; text-align: center;">Рефералы</th>
            <th style="width: 20%; text-align: center;">Действие</th>
        `;
        interactiveRefTableBody.appendChild(headerRow);
        
        // Запуск рекурсивной отрисовки структуры от корня
        renderUserRow(data.tree, 0);
    } catch (err) {
        console.error("Ошибка обновления таблицы:", err);
    }
}

// Рекурсивная функция создания строк
function renderUserRow(node, depth) {
    if (!node || !node.username) return;

    // Проверяем фильтр поиска по логину
    const matchesSearch = currentRefSearch === '' || node.username.toLowerCase().includes(currentRefSearch);
    
    // Проверяем, есть ли совпадения внутри вложенных веток
    if (matchesSearch || hasMatchingChild(node, currentRefSearch)) {
        const tr = document.createElement('tr');
        const hasChildren = node.referrals && node.referrals.length > 0;
        const isExpanded = expandedUsers.has(node.username);
        const paddingLeft = depth * 20 + 10;

        // Количество рефералов первого уровня
        const directRefsCount = hasChildren ? node.referrals.length : 0;

        // Проверка бизнес-логики: Если рефералов первого уровня 10 или больше — пользователь считается Лидером
        const isLeader = directRefsCount >= 10;

        // Подсветка: корень дерева (depth === 0) — золотой, Лидеры — оранжевый, обычные — белый
        let nameColor = '#fff';
        if (depth === 0) {
            nameColor = '#ffd700'; // Золотой для создателя
        } else if (isLeader) {
            nameColor = '#ff8c00'; // Темно-оранжевый статус Лидера для Серебра
        }

        tr.innerHTML = `
            <td style="padding-left: ${paddingLeft}px; font-weight: ${depth === 0 || isLeader ? 'bold' : 'normal'}; color: ${nameColor};">
                ${hasChildren ? (isExpanded ? '▼ ' : '▶ ') : '• '} ${node.username} ${isLeader ? '★' : ''}
            </td>
            <td style="text-align: center; color: #00fff0; font-weight: bold;">
                ${directRefsCount}
            </td>
            <td style="text-align: center;">
                ${hasChildren ? `<button class="row-toggle-btn" onclick="event.stopPropagation(); toggleUserRow('${node.username}')">${isExpanded ? 'Свернуть' : 'Развернуть'}</button>` : '—'}
            </td>
        `;

        // Клик по строке перенаправляет фокус матриц на этого пользователя и закрывает оверлей таблицы
        tr.onclick = () => {
            if (tableOverlay) tableOverlay.classList.remove('show');
            document.body.style.overflow = '';
            if (typeof window.findUserAndFocus === 'function') {
                window.findUserAndFocus(node.username);
            } else if (typeof findUserAndFocus === 'function') {
                findUserAndFocus(node.username);
            }
        };

        interactiveRefTableBody.appendChild(tr);

        // Передаем статус лидера в глобальное окно, чтобы matrix.js мог это использовать при отрисовке Серебра
        if (isLeader && typeof window.registerLeaderStatus === 'function') {
            window.registerLeaderStatus(node.username);
        }

        // Если пользователь развернут или активен поиск, выводим дочерние строки
        if (hasChildren && (isExpanded || currentRefSearch !== '')) {
            node.referrals.forEach(child => renderUserRow(child, depth + 1));
        }
    }
}

// Проверка наличия совпадений в глубине дерева
function hasMatchingChild(node, searchStr) {
    if (searchStr === '') return false;
    if (!node.referrals) return false;
    return node.referrals.some(child => child.username.toLowerCase().includes(searchStr) || hasMatchingChild(child, searchStr));
}

// Переключение состояния развернутости строки
window.toggleUserRow = function(username) {
    if (expandedUsers.has(username)) {
        expandedUsers.delete(username);
    } else {
        expandedUsers.add(username);
    }
    updateReferralTable();
};

// Фильтрация поиска внутри таблицы
if (refSearchBtn) {
    refSearchBtn.addEventListener('click', () => {
        currentRefSearch = refSearchInput.value.trim().toLowerCase();
        updateReferralTable();
    });
}

// Сброс поиска внутри таблицы
if (refSearchResetBtn) {
    refSearchResetBtn.addEventListener('click', () => {
        refSearchInput.value = '';
        currentRefSearch = '';
        expandedUsers.clear();
        updateReferralTable();
    });
}

// Интервал автообновления таблицы рефералов, если она открыта на экране
setInterval(() => {
    if (tableOverlay && tableOverlay.classList.contains('show')) {
        updateReferralTable();
    }
}, 3000);

// Экспортируем функцию обновления таблицы в глобальную область видимости
window.updateReferralTable = updateReferralTable;
