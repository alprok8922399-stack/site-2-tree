/* ==========================================================================
   📊 СКРИПТ УПРАВЛЕНИЯ ТАБЛИЦЕЙ РЕФЕРАЛОВ (ДЕРЕВО СВЯЗЕЙ)
   ========================================================================== */

const TABLE_API_URL = '/api';

// Функция инициализации всех обработчиков
function initTableModule() {
    const menuToggleBtn = document.getElementById('menuToggleBtn');
    const menuContent = document.getElementById('menuContent');
    const openTableBtn = document.getElementById('openTableBtn');
    const tableOverlay = document.getElementById('tableOverlay');
    const closeOverlayBtn = document.getElementById('closeOverlayBtn');
    const interactiveRefTableBody = document.getElementById('interactiveRefTableBody');
    const refSearchInput = document.getElementById('refSearchInput');
    const refSearchBtn = document.getElementById('refSearchBtn');
    const refSearchResetBtn = document.getElementById('refSearchResetBtn');

    let expandedUsers = new Set(); 
    let currentRefSearch = ''; 

    // Открытие / Закрытие шторки меню
    if (menuToggleBtn && menuContent) {
        menuToggleBtn.addEventListener('click', () => {
            menuContent.classList.toggle('show');
        });
    }

    // Открытие оверлея таблицы
    if (openTableBtn && tableOverlay) {
        openTableBtn.addEventListener('click', async () => {
            if (menuContent) menuContent.classList.remove('show');
            tableOverlay.classList.add('show');
            document.body.style.overflow = 'hidden';
            await updateReferralTable();
        });
    }

    // Закрытие оверлея таблицы
    if (closeOverlayBtn && tableOverlay) {
        closeOverlayBtn.addEventListener('click', () => {
            tableOverlay.classList.remove('show');
            document.body.style.overflow = '';
        });
    }

    // Запрос и отрисовка реферальной структуры
    async function updateReferralTable() {
        if (!interactiveRefTableBody) return;
        try {
            const res = await fetch(`${TABLE_API_URL}/referrals`);
            const data = await res.json();
            if (!data.success) return;
            
            interactiveRefTableBody.innerHTML = "";
            
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `
                <th style="width: 60%;">Логин Лидера / Партнера</th>
                <th style="width: 20%; text-align: center;">Рефералы</th>
                <th style="width: 20%; text-align: center;">Действие</th>
            `;
            interactiveRefTableBody.appendChild(headerRow);
            
            renderUserRow(data.tree, 0);
        } catch (err) {
            console.error("Ошибка обновления таблицы:", err);
        }
    }

    // Рекурсивная функция создания строк
    function renderUserRow(node, depth) {
        if (!node || !node.username) return;

        const matchesSearch = currentRefSearch === '' || node.username.toLowerCase().includes(currentRefSearch);
        
        if (matchesSearch || hasMatchingChild(node, currentRefSearch)) {
            const tr = document.createElement('tr');
            const hasChildren = node.referrals && node.referrals.length > 0;
            const isExpanded = expandedUsers.has(node.username);
            const paddingLeft = depth * 20 + 10;
            const directRefsCount = hasChildren ? node.referrals.length : 0;
            const isLeader = directRefsCount >= 10;

            let nameColor = '#fff';
            if (depth === 0) nameColor = '#ffd700'; 
            else if (isLeader) nameColor = '#ff8c00'; 

            tr.innerHTML = `
                <td style="padding-left: ${paddingLeft}px; font-weight: ${depth === 0 || isLeader ? 'bold' : 'normal'}; color: ${nameColor};">
                    ${hasChildren ? (isExpanded ? '▼ ' : '▶ ') : '• '} ${node.username} ${isLeader ? '★' : ''}
                </td>
                <td style="text-align: center; color: #00fff0; font-weight: bold;">
                    ${directRefsCount}
                </td>
                <td style="text-align: center;">
                    ${hasChildren ? `<button class="row-toggle-btn" onclick="event.stopPropagation(); window.toggleUserRow('${node.username}')">${isExpanded ? 'Свернуть' : 'Развернуть'}</button>` : '—'}
                </td>
            `;

            tr.onclick = () => {
                if (tableOverlay) tableOverlay.classList.remove('show');
                document.body.style.overflow = '';
                if (typeof window.findUserAndFocus === 'function') {
                    window.findUserAndFocus(node.username);
                }
            };

            interactiveRefTableBody.appendChild(tr);

            if (isLeader && typeof window.registerLeaderStatus === 'function') {
                window.registerLeaderStatus(node.username);
            }

            if (hasChildren && (isExpanded || currentRefSearch !== '')) {
                node.referrals.forEach(child => renderUserRow(child, depth + 1));
            }
        }
    }

    function hasMatchingChild(node, searchStr) {
        if (searchStr === '') return false;
        if (!node.referrals) return false;
        return node.referrals.some(child => child.username.toLowerCase().includes(searchStr) || hasMatchingChild(child, searchStr));
    }

    window.toggleUserRow = function(username) {
        if (expandedUsers.has(username)) {
            expandedUsers.delete(username);
        } else {
            expandedUsers.add(username);
        }
        updateReferralTable();
    };

    if (refSearchBtn) {
        refSearchBtn.addEventListener('click', () => {
            currentRefSearch = refSearchInput.value.trim().toLowerCase();
            updateReferralTable();
        });
    }

    if (refSearchResetBtn) {
        refSearchResetBtn.addEventListener('click', () => {
            refSearchInput.value = '';
            currentRefSearch = '';
            expandedUsers.clear();
            updateReferralTable();
        });
    }

    setInterval(() => {
        if (tableOverlay && tableOverlay.classList.contains('show')) {
            updateReferralTable();
        }
    }, 3000);

    window.updateReferralTable = updateReferralTable;
}

// Запуск инициализации при готовности DOM
document.addEventListener('DOMContentLoaded', initTableModule);
