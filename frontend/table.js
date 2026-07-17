/* ==========================================================================
   🚨 КРИТИЧЕСКАЯ ЗОНА: ТОЛЬКО ДЛЯ ЧТЕНИЯ (READ-ONLY)
   ⚠️ ЛЮБЫЕ ИЗМЕНЕНИЯ В ЭТОМ ФАЙЛЕ ЗАПРЕЩЕНЫ И МОГУТ СЛОМАТЬ СИСТЕМУ ДЕПЛОЯ!
   ========================================================================== */

const API_URL = '/api';

const interactiveRefTableBody = document.getElementById('interactiveRefTableBody');
const refSearchInput = document.getElementById('refSearchInput');
const refSearchBtn = document.getElementById('refSearchBtn');
const refSearchResetBtn = document.getElementById('refSearchResetBtn');

let refSearchTargetUser = ''; 
let expandedNodes = new Set(); 
let lastRefTreeJsonString = ''; 

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

async function findReferalAndExpand(username) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const tree = await res.json();
        
        let targetNode = Object.values(tree).find(node => node && node.user && node.user.toLowerCase() === username.toLowerCase());
        
        if (targetNode) {
            refSearchTargetUser = targetNode.user; 
            
            // Раскрываем всех спонсоров вверх по цепочке
            let currentSponsor = targetNode.sponsor;
            while (currentSponsor) {
                // Ищем узел спонсора
                const sponsorNode = Object.values(tree).find(n => n && n.user === currentSponsor);
                if (sponsorNode) {
                    expandedNodes.add(sponsorNode.user);
                    currentSponsor = sponsorNode.sponsor;
                } else {
                    currentSponsor = null;
                }
            }
            
            buildInteractiveRefTable(true);
            scrollToFocusedReferal();
        } else {
            alert(`Реферал "${username}" не найден в структуре`);
        }
    } catch (err) {
        console.error('Ошибка поиска реферала:', err);
    }
}

// Построение реферального дерева на основе матрицы /api/tree
async function buildInteractiveRefTable(forceRender = false) {
    if (!interactiveRefTableBody) return;

    try {
        const res = await fetch(`${API_URL}/tree`);
        const tree = await res.json();

        // Фильтруем только существующие ячейки с пользователями (и убираем служебные GP-ячейки)
        const activeUsers = Object.values(tree).filter(node => node && node.user && node.user !== '-' && !node.id.startsWith('GP'));

        if (activeUsers.length === 0) {
            interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ffd700; padding: 20px; font-size: 16px;">База данных пуста. Зарегистрируйте первого пользователя в матрицах!</td></tr>';
            return;
        }

        const currentRefTreeStr = JSON.stringify(tree) + `_expanded:${Array.from(expandedNodes).join(',')}_target:${refSearchTargetUser}`;
        
        if (currentRefTreeStr === lastRefTreeJsonString && !forceRender) {
            return; 
        }
        lastRefTreeJsonString = currentRefTreeStr;

        // Рекурсивная функция построения ветки дерева для пользователя
        function buildUserNodeHTML(username) {
            // Ищем прямых рефералов (тех, у кого этот пользователь записан как sponsor)
            let children = activeUsers.filter(node => node.sponsor === username);
            
            // Исключаем дублирование (если один логин занял несколько ячеек, в реф-дереве он показывается один раз)
            const uniqueChildrenMap = {};
            children.forEach(child => {
                uniqueChildrenMap[child.user] = child;
            });
            let uniqueChildren = Object.values(uniqueChildrenMap);
            uniqueChildren.sort((a, b) => a.user.localeCompare(b.user));

            let hasChildren = uniqueChildren.length > 0;
            let directRefCount = uniqueChildren.length;
            let isExpanded = expandedNodes.has(username); 

            const isTarget = username.toLowerCase() === refSearchTargetUser.toLowerCase();

            let isFoundTargetStyle = isTarget 
                ? 'border: 2px solid #ff3366; box-shadow: 0 0 15px #ff3366; background: #ff3366;' 
                : 'border: 1px solid #00fff0; background: #1f4068; box-shadow: 0 1px 3px rgba(0,0,0,0.2);';

            let html = `
                <div class="ref-node ${isTarget ? 'ref-node-focused' : ''}" style="display: flex; align-items: flex-start; margin-bottom: 6px; gap: 8px;">
                    <div class="user-card" style="padding: 6px 10px; border-radius: 6px; min-width: 120px; max-width: 140px; box-sizing: border-box; ${isFoundTargetStyle}">
                        <div style="font-weight: bold; color: #fff; font-size: 12px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${username}">${username}</div>
                        <div style="font-size: 10px; color: #a2e8dd; margin-top: 4px;">👥 Рефы: <strong>${directRefCount}</strong></div>
                        ${hasChildren ? `<button class="tree-toggle-btn" onclick="toggleRefBranch('${username}', this)">${isExpanded ? '▲' : '▼'}</button>` : ''}
                    </div>
                    
                    ${hasChildren ? `
                        <div id="children_of_${username}" class="children-container" style="display: ${isExpanded ? 'flex' : 'none'};">
                            ${uniqueChildren.map(child => buildUserNodeHTML(child.user)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            return html;
        }

        // Находим корневого пользователя (у которого нет спонсора или спонсор не найден в списке активных пользователей)
        let rootUserNode = activeUsers.find(node => {
            if (!node.sponsor || node.sponsor === 'null' || node.sponsor === '-') return true;
            // Если спонсор указан, но его физически нет в списке зарегистрированных
            return !activeUsers.some(u => u.user === node.sponsor);
        });

        // Если не удалось однозначно определить корень, берём самый первый узел в матрице (например, A1)
        let rootUsername = rootUserNode ? rootUserNode.user : null;
        if (!rootUsername && activeUsers.length > 0) {
            rootUsername = activeUsers[0].user;
        }

        if (rootUsername) {
            let fullTreeHTML = `
                <tr>
                    <td colspan="2" style="padding: 10px; overflow-x: auto;">
                        <div style="display: flex; min-width: max-content;">
                            ${buildUserNodeHTML(rootUsername)}
                        </div>
                    </td>
                </tr>
            `;
            interactiveRefTableBody.innerHTML = fullTreeHTML;
        } else {
            interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color:#ffd700; padding: 20px;">Зарегистрированные пользователи не найдены.</td></tr>';
        }

    } catch (e) {
        console.error(e);
        interactiveRefTableBody.innerHTML = '<tr><td colspan="2" style="text-align:center; color: #e43f5a; padding: 20px;">Не удалось загрузить реферальное дерево</td></tr>';
    }
}

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

setInterval(() => {
    const embeddedTable = document.getElementById('embeddedTableContainer');
    if (embeddedTable && embeddedTable.style.display === 'block') {
        buildInteractiveRefTable();
    }
}, 2000);

buildInteractiveRefTable();
