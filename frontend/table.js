/* ==========================================================================
   🚨 КРИТИЧЕСКАЯ ЗОНА: ТОЛЬКО ДЛЯ ЧТЕНИЯ (READ-ONLY)
   ⚠️ ЛЮБЫЕ ИЗМЕНЕНИЯ В ЭТОМ ФАЙЛЕ ЗАПРЕЩЕНЫ И МОГУТ СЛОМАТЬ СИСТЕМУ ДЕПЛОЯ!
   ========================================================================== */

const API_URL = '/api';

// --- ЭЛЕМЕНТЫ УПРАВЛЕНИЯ ТАБЛИЦЕЙ ---
const interactiveRefTableBody = document.getElementById('interactiveRefTableBody');

// Элементы поиска внутри таблицы рефералов
const refSearchInput = document.getElementById('refSearchInput');
const refSearchBtn = document.getElementById('refSearchBtn');
const refSearchResetBtn = document.getElementById('refSearchResetBtn');

let refSearchTargetUser = ''; // Цель для подсветки в Таблице рефералов
let expandedNodes = new Set(); // Помнит, какие ветки развернуты
let lastRefTreeJsonString = ''; 

// --- ПОИСК В ТАБЛИЦЕ РЕФЕРАЛОВ ---
if (refSearchBtn) {
    refSearchBtn.addEventListener('click', () => {
        const val = refSearchInput.value.trim();
        if (val) {
            findReferalAndExpand(val);
        }
    });
}

if (refSearchResetBtn) {
    refSearchResetBtn.addEventListener('click', () => {
        if (refSearchInput) refSearchInput.value = '';
        refSearchTargetUser = '';
        expandedNodes.clear(); 
        buildInteractiveRefTable(true); 
    });
}

// Скролл к найденной карточке в таблице
function scrollToFocusedReferal() {
    setTimeout(() => {
        const focusedCard = document.querySelector('.ref-node-focused');
        if (focusedCard) {
            focusedCard.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }, 500); 
}

// Поиск реферала на сервере с раскрытием всех родителей вверх
async function findReferalAndExpand(username) {
    try {
        const res = await fetch(`${API_URL}/referals-tree`);
        const data = await res.json();
        if (!data.success || !data.tree) return;

        const refTree = data.tree;
        let targetNode = Object.values(refTree).find(node => node.username.toLowerCase() === username.toLowerCase());
        
        if (targetNode) {
            refSearchTargetUser = targetNode.username; 
            
            let currentSponsor = targetNode.sponsor;
            while (currentSponsor && refTree[currentSponsor]) {
                expandedNodes.add(currentSponsor); 
                currentSponsor = refTree[currentSponsor].sponsor;
            }
            
            buildInteractiveRefTable(true);
            scrollToFocusedReferal();
        } else {
            alert(`Реферал "${username}" не найден в структуре таблицы`);
        }
    } catch (err) {
        console.error('Ошибка поиска реферала:', err);
    }
}

// --- ПОСТРОЕНИЕ ИНТЕРАКТИВНОЙ ТАБЛИЦЫ ---
async function buildInteractiveRefTable(forceRender = false) {
    if (!interactiveRefTableBody) return;

    try {
        const res = await fetch(`${API_URL}/referals-tree`);
        const data = await res.json();
        if (!data.success || !data.tree) {
            interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ff3366; padding: 20px;">Ошибка загрузки структуры рефералов</td></tr>';
            return;
        }

        const refTree = data.tree;
        
        // Если вообще нет данных или только корень пустой
        const hasData = Object.keys(refTree).length > 0;
        if (!hasData) {
            interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ffd700; padding: 20px; font-size: 16px;">База данных пуста. Зарегистрируйте первого пользователя в матрицах!</td></tr>';
            return;
        }

        const currentRefTreeStr = JSON.stringify(data) + `_expanded:${Array.from(expandedNodes).join(',')}_target:${refSearchTargetUser}`;
        
        if (currentRefTreeStr === lastRefTreeJsonString && !forceRender) {
            return; 
        }
        lastRefTreeJsonString = currentRefTreeStr;
        
        function buildUserNodeHTML(username) {
            let children = Object.values(refTree).filter(node => node.sponsor === username);
            children.sort((a, b) => a.username.localeCompare(b.username));

            let hasChildren = children.length > 0;
            let currentColumn = refTree[username] ? refTree[username].calculatedColumn : 1;
            let directRefCount = children.length;
            let isExpanded = expandedNodes.has(username); 

            const isTarget = username.toLowerCase() === refSearchTargetUser.toLowerCase();

            let isFoundTargetStyle = isTarget 
                ? 'border: 2px solid #ff3366; box-shadow: 0 0 15px #ff3366; background: #ff3366;' 
                : 'border: 1px solid #00fff0; background: #1f4068; box-shadow: 0 1px 3px rgba(0,0,0,0.2);';

            let html = `
                <div class="ref-node ${isTarget ? 'ref-node-focused' : ''}" style="display: flex; align-items: flex-start; margin-bottom: 6px; gap: 8px;">
                    <div class="user-card" style="padding: 6px 10px; border-radius: 6px; min-width: 120px; max-width: 140px; box-sizing: border-box; ${isFoundTargetStyle}">
                        <div style="font-weight: bold; color: #fff; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${username}">${username}</div>
                        <div style="font-size: 10px; color: #ffd700; margin-top: 2px;">Уровень: ${currentColumn}</div>
                        <div style="font-size: 10px; color: #a2e8dd; margin-top: 2px;">👥 Рефы: <strong>${directRefCount}</strong></div>
                        ${hasChildren ? `<button class="tree-toggle-btn" onclick="toggleRefBranch('${username}', this)">${isExpanded ? '▲' : '▼'}</button>` : ''}
                    </div>
                    
                    ${hasChildren ? `
                        <div id="children_of_${username}" class="children-container" style="display: ${isExpanded ? 'flex' : 'none'};">
                            ${children.map(child => buildUserNodeHTML(child.username)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            return html;
        }

        // Пытаемся найти корень дерева (обычно это SYSTEM_ROOT, либо первый попавшийся элемент без спонсора)
        let rootKey = 'SYSTEM_ROOT';
        if (!refTree[rootKey]) {
            // Если SYSTEM_ROOT нет, берем первого пользователя без спонсора или просто первого в списке
            const rootCandidate = Object.values(refTree).find(node => !node.sponsor || node.sponsor === 'null');
            if (rootCandidate) {
                rootKey = rootCandidate.username;
            } else {
                rootKey = Object.keys(refTree)[0];
            }
        }

        if (rootKey && refTree[rootKey]) {
            let fullTreeHTML = `
                <tr>
                    <td colspan="2" style="padding: 10px; overflow-x: auto;">
                        <div style="display: flex; min-width: max-content;">
                            ${buildUserNodeHTML(rootKey)}
                        </div>
                    </td>
                </tr>
            `;
            interactiveRefTableBody.innerHTML = fullTreeHTML;
        } else {
            interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ffd700; padding: 20px;">Пользователи в системе не найдены.</td></tr>';
        }

    } catch (e) {
        console.error(e);
        interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #e43f5a; padding: 20px;">Не удалось загрузить реферальное дерево</td></tr>';
    }
}

// ДЕЛАЕМ ФУНКЦИЮ ГЛОБАЛЬНОЙ — ТЕПЕРЬ MATRIX.JS ТОЧНО ЕЁ УВИДИТ!
window.buildInteractiveRefTable = buildInteractiveRefTable;

window.toggleRefBranch = function(username, btn) {
    const container = document.getElementById(`children_of_${username}`);
    if (!container) return;

    if (container.style.display === 'none') {
        container.style.display = 'flex';
        btn.innerHTML = '▲';
        expandedNodes.add(username); 
    } else {
        container.style.display = 'none';
        btn.innerHTML = '▼';
        expandedNodes.delete(username); 
    }
    buildInteractiveRefTable(true); 
};

// Запуск фонового обновления структуры таблицы
setInterval(() => {
    const embeddedTable = document.getElementById('embeddedTableContainer');
    if (embeddedTable && embeddedTable.style.display === 'block') {
        buildInteractiveRefTable();
    }
}, 2000);

// Сразу пробуем один раз отрисовать, если таблица вдруг уже открыта
buildInteractiveRefTable();
