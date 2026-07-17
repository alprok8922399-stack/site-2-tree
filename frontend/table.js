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
        const res = await fetch(`${API_URL}/referals-tree`);
        const resData = await res.json();
        
        if (!resData || !resData.tree) return;
        const tree = resData.tree;
        
        let targetNode = Object.values(tree).find(node => node && node.username && node.username.toLowerCase() === username.toLowerCase());
        
        if (targetNode) {
            refSearchTargetUser = targetNode.username; 
            
            // Раскрываем ветки вверх по цепочке спонсоров
            let currentSponsor = targetNode.sponsor;
            while (currentSponsor) {
                const sponsorNode = Object.values(tree).find(n => n && n.username === currentSponsor);
                if (sponsorNode) {
                    expandedNodes.add(sponsorNode.username);
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

// Построение реферального дерева строго по структуре бэкенда
async function buildInteractiveRefTable(forceRender = false) {
    if (!interactiveRefTableBody) return;

    try {
        const res = await fetch(`${API_URL}/referals-tree`);
        const resData = await res.json();

        if (!resData || !resData.tree) {
            interactiveRefTableBody.innerHTML = '<div style="text-align:center; color:#e43f5a; padding: 20px;">Ошибка структуры данных от сервера</div>';
            return;
        }

        const tree = resData.tree;
        const activeUsers = Object.values(tree).filter(node => node && node.username && node.username !== 'null');

        if (activeUsers.length === 0) {
            interactiveRefTableBody.innerHTML = '<div style="text-align:center; color:#ffd700; padding: 20px; font-size: 16px; background: rgba(28,37,65,0.6); border-radius:8px;">Реферальная структура пуста.</div>';
            return;
        }

        const currentRefTreeStr = JSON.stringify(resData) + `_expanded:${Array.from(expandedNodes).join(',')}_target:${refSearchTargetUser}`;
        
        if (currentRefTreeStr === lastRefTreeJsonString && !forceRender) {
            return; 
        }
        lastRefTreeJsonString = currentRefTreeStr;

        // Рекурсивное построение дерева на DIV-блоках
        function buildUserNodeHTML(userLogin) {
            // Ищем детей, у которых поле sponsor равно текущему userLogin
            let children = activeUsers.filter(node => node.sponsor === userLogin);
            children.sort((a, b) => a.username.localeCompare(b.username));

            let hasChildren = children.length > 0;
            let directRefCount = children.length;
            let isExpanded = expandedNodes.has(userLogin); 

            const isTarget = userLogin.toLowerCase() === refSearchTargetUser.toLowerCase();

            let isFoundTargetStyle = isTarget 
                ? 'border: 2px solid #ff3366; box-shadow: 0 0 15px #ff3366; background: #ff3366;' 
                : 'border: 1px solid #00fff0; background: #1c2541; box-shadow: 0 2px 5px rgba(0,0,0,0.3);';

            let html = `
                <div class="ref-node" style="display: flex; flex-direction: column; align-items: flex-start; margin-bottom: 10px;">
                    <div class="user-card ${isTarget ? 'ref-node-focused' : ''}" style="padding: 10px; border-radius: 8px; min-width: 140px; box-sizing: border-box; ${isFoundTargetStyle}">
                        <div style="font-weight: bold; color: #fff; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${userLogin}">${userLogin}</div>
                        <div style="font-size: 11px; color: #a2e8dd; margin-top: 5px;">👥 Рефы: <strong>${directRefCount}</strong></div>
                        ${hasChildren ? `<button class="tree-toggle-btn" onclick="toggleRefBranch('${userLogin}', this)">${isExpanded ? 'Свернуть ▲' : 'Развернуть ▼'}</button>` : ''}
                    </div>
                    
                    ${hasChildren ? `
                        <div id="children_of_${userLogin}" class="children-container" style="display: ${isExpanded ? 'flex' : 'none'}; flex-direction: column; margin-top: 6px; padding-left: 15px; border-left: 2px dashed #00fff0; gap: 6px;">
                            ${children.map(child => buildUserNodeHTML(child.username)).join('')}
                        </div>
                    ` : ''}
                </div>
            `;
            return html;
        }

        // В твоей базе корнем всегда является SYSTEM_ROOT
        let rootUsername = 'SYSTEM_ROOT';

        // Проверяем, есть ли он вообще в пришедшей структуре
        if (!tree[rootUsername]) {
            // Если вдруг нет, берем того, у кого спонсор null или кто идет первым
            let fallbackNode = activeUsers.find(node => !node.sponsor || node.sponsor === 'null') || activeUsers[0];
            rootUsername = fallbackNode ? fallbackNode.username : null;
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
            interactiveRefTableBody.innerHTML = '<div style="text-align:center; color:#ffd700; padding: 20px;">Зарегистрированные пользователи не найдены.</div>';
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
