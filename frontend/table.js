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
            
            let currentSponsor = targetNode.sponsor;
            while (currentSponsor) {
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

// Построение реферального дерева
async function buildInteractiveRefTable(forceRender = false) {
    if (!interactiveRefTableBody) return;

    try {
        const res = await fetch(`${API_URL}/tree`);
        const tree = await res.json();

        // Достаем всех реальных пользователей (игнорируем пустые ячейки "-" и технические GP-места)
        const activeUsers = Object.values(tree).filter(node => node && node.user && node.user !== '-' && !node.id.startsWith('GP'));

        if (activeUsers.length === 0) {
            interactiveRefTableBody.innerHTML = '<div style="text-align:center; color:#ffd700; padding: 20px; font-size: 16px; background: rgba(28,37,65,0.6); border-radius:8px;">База данных пуста. Зарегистрируйте первого пользователя в матрицах!</div>';
            return;
        }

        const currentRefTreeStr = JSON.stringify(tree) + `_expanded:${Array.from(expandedNodes).join(',')}_target:${refSearchTargetUser}`;
        
        if (currentRefTreeStr === lastRefTreeJsonString && !forceRender) {
            return; 
        }
        lastRefTreeJsonString = currentRefTreeStr;

        // Рекурсивный рендеринг карточек
        function buildUserNodeHTML(username) {
            // Ищем рефералов, у которых этот юзер записан спонсором
            let children = activeUsers.filter(node => node.sponsor === username);
            
            // Убираем клоны (если один логин занял несколько мест в матрице, в реф-дереве он один)
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
                : 'border: 1px solid #00fff0; background: #1c2541; box-shadow: 0 2px 5px rgba(0,0,0,0.3);';

            let html = `
                <div class="ref-node" style="display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px;">
                    <div class="user-card ${isTarget ? 'ref-node-focused' : ''}" style="padding: 10px; border-radius: 8px; min-width: 140px; box-sizing: border-box; ${isFoundTargetStyle}">
                        <div style="font-weight: bold; color: #fff; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${username}">${username}</div>
                        <div style="font-size: 11px; color: #a2e8dd; margin-top: 5px;">👥 Рефералы: <strong>${directRefCount}</strong></div>
                        ${hasChildren ? `<button class="tree-toggle-btn" onclick="toggleRefBranch('${username}', this)">${isExpanded ? 'Свернуть ▲' : 'Развернуть ▼'}</button>` : ''}
                    </div>
                    
                    ${hasChildren ? `
                        <div id="children_of_${username}" class="children-container" style="display: ${isExpanded ? 'flex' : 'none'}; flex-direction: column; margin-top: 6px; padding-left: 15px; border-left: 2px dashed #00fff0; gap: 6px;">
                            ${uniqueChildren.map(child => buildUserNodeHTML(child.user)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            return html;
        }

        // ЖЕСТКАЯ СТРАХОВКА: Сначала ищем корень по логике отсутствия спонсора
        let rootUsername = null;
        let rootUserNode = activeUsers.find(node => !node.sponsor || node.sponsor === 'null' || node.sponsor === '-' || !activeUsers.some(u => u.user === node.sponsor));
        
        if (rootUserNode) {
            rootUsername = rootUserNode.user;
        }

        // Если по спонсорам определить не вышло — железобетонно берем пользователя из ячейки A1
        if (!rootUsername && tree['A1'] && tree['A1'].user && tree['A1'].user !== '-') {
            rootUsername = tree['A1'].user;
        }

        // Если и в A1 пусто, берем самого первого активного юзера из массива
        if (!rootUsername && activeUsers.length > 0) {
            rootUsername = activeUsers[0].user;
        }

        if (rootUsername) {
            interactiveRefTableBody.innerHTML = `
                <div style="width: 100%; overflow-x: auto; padding: 10px 0;">
                    <div style="display: flex; flex-direction: column; min-width: max-content;">
                        ${buildUserNodeHTML(rootUsername)}
                    </div>
                </div>
            `;
        } else {
            interactiveRefTableBody.innerHTML = '<div style="text-align:center; color:#ffd700; padding: 20px;">Зарегистрированные пользователи не найдены в системе.</div>';
        }

    } catch (e) {
        console.error(e);
        interactiveRefTableBody.innerHTML = '<div style="text-align:center; color: #e43f5a; padding: 20px;">Не удалось загрузить реферальное дерево</div>';
    }
}

window.buildInteractiveRefTable = buildInteractiveRefTable;

window.toggleRefBranch = function(username, btn) {
    const container = document.getElementById(`children_of_${username}`);
    if (!container) return;

    if (container.style.display === 'none') {
        container.style.display = 'flex';
        btn.innerHTML = 'Свернуть ▲';
        expandedNodes.add(username); 
    } else {
        container.style.display = 'none';
        btn.innerHTML = 'Развернуть ▼';
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
