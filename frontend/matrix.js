/* === ИЗОЛИРОВАННЫЕ БЛОКИ МАТРИЦ + ЖЁСТКИЙ ПЕРЕНОС КАЖДЫЕ 32 МАТРИЦЫ === */

(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Сбрасываем ограничения у внешних оберток, чтобы они не растягивали всё в 1 строку */
        #matrix-zoom-wrapper, 
        #mainTreeDisplay, 
        .matrices-container {
            display: flex !important;
            flex-direction: column !important; /* Строки strictly друг под другом */
            align-items: flex-start !important;
            justify-content: flex-start !important;
            width: max-content !important;
            max-width: none !important;
        }

        .matrices-container {
            gap: 25px !important;
            padding: 15px !important;
        }

        /* Ряд, содержащий РОВНО до 32 матриц */
        .matrix-row-32 {
            display: flex !important;
            flex-direction: row !important;
            flex-wrap: nowrap !important;
            gap: 20px !important;
            width: max-content !important;
            flex-shrink: 0 !important; /* Запрещаем сжимать ряд */
        }

        .matrix-block {
            box-sizing: border-box !important;
            background: #17171c;
            border: 2px solid #232329;
            border-radius: 12px;
            padding: 15px;
            width: 280px !important;
            min-width: 280px !important;
            max-width: 280px !important;
            flex-shrink: 0 !important; /* Запрещаем матрице сжиматься по ширине */
            display: flex;
            flex-direction: column;
            align-items: center;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            transition: transform 0.2s ease, border-color 0.2s ease;
        }

        .matrix-block.highlighted {
            border-color: #ffd700;
            transform: scale(1.02);
        }

        .matrix-title {
            color: #ffd700;
            font-size: 14px;
            font-weight: bold;
            margin-bottom: 12px;
            text-transform: uppercase;
            letter-spacing: 1px;
        }

        .matrix-row {
            display: flex;
            justify-content: center;
            gap: 8px;
            margin-bottom: 8px;
            width: 100%;
        }

        .matrix-cell {
            background: #202026;
            border: 1px solid #2d2d35;
            color: #71717a;
            padding: 8px 2px;
            border-radius: 6px;
            flex: 1;
            text-align: center;
            font-size: 11px;
            cursor: pointer;
            user-select: none;
            word-break: break-all;
            transition: all 0.2s ease;
        }

        .matrix-cell.searched {
            border-color: #ff4757 !important;
            background: #5f1e1e !important;
            color: #fff !important;
            font-weight: bold;
        }

        /* Модальное окно (Карточка пользователя с цепочкой спонсоров) */
        .user-card-modal {
            position: fixed;
            top: 0; left: 0; width: 100%; height: 100%;
            background: rgba(0,0,0,0.8);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
        }

        .user-card-content {
            background: #17171c;
            border: 2px solid #ffd700;
            border-radius: 12px;
            padding: 20px;
            width: 320px;
            max-width: 90vw;
            color: #fff;
            text-align: center;
            position: relative;
            box-shadow: 0 0 20px rgba(255, 215, 0, 0.2);
        }

        .user-card-close {
            position: absolute;
            top: 10px; right: 15px;
            color: #aaa; font-size: 20px; cursor: pointer;
        }

        .timer-badge {
            margin-top: 12px;
            padding: 8px 12px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: bold;
            display: inline-block;
        }

        .timer-badge.active { background: #ff9800; color: #000; }
        .timer-badge.matured { background: #2ecc71; color: #fff; }
        .timer-badge.suspended { background: #e74c3c; color: #fff; }
        .timer-badge.admin-owned { background: #8e44ad; color: #fff; }

        .modal-upline-box {
            margin-top: 15px;
            background: #202028;
            border: 1px dashed #444455;
            padding: 10px;
            border-radius: 8px;
            font-size: 12px;
            text-align: left;
        }
        .modal-upline-title {
            color: #aaa;
            font-weight: bold;
            margin-bottom: 6px;
            font-size: 11px;
            text-transform: uppercase;
        }
        .modal-upline-chain {
            display: flex;
            flex-wrap: wrap;
            gap: 4px;
            align-items: center;
        }
    `;
    document.head.appendChild(style);
})();

const MATRIX_API_URL = window.location.origin;
let currentTreeData = {};
let currentSearchTerm = '';
let pressTimer = null;

// Загрузка дерева с бэкенда
async function fetchTree() {
    try {
        const res = await fetch(`${MATRIX_API_URL}/api/tree?t=${Date.now()}`);
        const data = await res.json();
        currentTreeData = data;
        renderMatrices(data);
    } catch (err) {
        console.error('Ошибка загрузки матрицы:', err);
    }
}

// Загрузка списков активных матриц с разбивкой ровно по 32 штуки в ряд
function renderMatrices(treeData) {
    const container = document.getElementById('mainTreeDisplay');
    if (!container) return;

    // Принудительно устанавливаем стили контейнеру
    container.className = 'matrices-container';
    container.style.cssText = "display: flex !important; flex-direction: column !important; width: max-content !important;";
    container.innerHTML = '';

    let activeTops = treeData.activeMatrices || [];

    if (activeTops.length === 0) {
        activeTops = ['A1'];
    }

    let currentRow = null;

    activeTops.forEach((topId, index) => {
        // Каждые 32 матрицы (индексы 0, 32, 64 и т.д.) создаем физически новый HTML-блок ряда
        if (index % 32 === 0) {
            currentRow = document.createElement('div');
            currentRow.className = 'matrix-row-32';
            container.appendChild(currentRow);
        }
        renderSingleMatrixBlock(currentRow, topId, treeData);
    });
}

function renderSingleMatrixBlock(container, topId, treeData) {
    const block = document.createElement('div');
    block.className = 'matrix-block';
    block.id = `matrix-block-${topId}`;

    const title = document.createElement('div');
    title.className = 'matrix-title';
    title.innerText = `Матрица ${topId}`;
    block.appendChild(title);

    const structure = getSevenCellIds(topId);

    // Ряд 1 (Вершина)
    const row1 = createRow([structure.top], treeData, 'cell-top');
    // Ряд 2 (Плечи)
    const row2 = createRow([structure.left, structure.right], treeData, 'cell-middle');
    // Ряд 3 (Основание из 4 ячеек)
    const row3 = createRow([structure.b1, structure.b2, structure.b3, structure.b4], treeData, 'cell-bottom');

    block.appendChild(row1);
    block.appendChild(row2);
    block.appendChild(row3);

    container.appendChild(block);
}

// Универсальная конвертация ID ячейки (Excel-формат: A1, Z10, AA1 и т.д.) в глобальный индекс
function cellIdToGlobalIndex(cellId) {
    if (!cellId) return 0;
    const match = cellId.match(/^([A-Z]+)(\d+)$/);
    if (!match) return 0;
    
    const letters = match[1];
    const num = parseInt(match[2], 10);
    
    let levelIndex = 0;
    for (let i = 0; i < letters.length; i++) {
        levelIndex = levelIndex * 26 + (letters.charCodeAt(i) - 64);
    }
    levelIndex -= 1;

    const levelStart = (1 << levelIndex) - 1;
    return levelStart + (num - 1);
}

// Конвертация глобального индекса обратно в Excel-формат ID (A1, AA1...)
function globalIndexToCellId(gIdx) {
    let levelIndex = 0;
    while ((1 << (levelIndex + 1)) - 1 <= gIdx) {
        levelIndex++;
    }
    const levelStart = (1 << levelIndex) - 1;
    const num = (gIdx - levelStart) + 1;
    
    let letter = '';
    let temp = levelIndex;
    while (temp >= 0) {
        letter = String.fromCharCode((temp % 26) + 65) + letter;
        temp = Math.floor(temp / 26) - 1;
    }
    return `${letter}${num}`;
}

function getSevenCellIds(topId) {
    const gIdx = cellIdToGlobalIndex(topId);
    
    const leftG = gIdx * 2 + 1;
    const rightG = gIdx * 2 + 2;
    
    const b1G = leftG * 2 + 1;
    const b2G = leftG * 2 + 2;
    const b3G = rightG * 2 + 1;
    const b4G = rightG * 2 + 2;

    return {
        top: topId,
        left: globalIndexToCellId(leftG),
        right: globalIndexToCellId(rightG),
        b1: globalIndexToCellId(b1G),
        b2: globalIndexToCellId(b2G),
        b3: globalIndexToCellId(b3G),
        b4: globalIndexToCellId(b4G)
    };
}

function createRow(cellIds, treeData, levelColorClass) {
    const row = document.createElement('div');
    row.className = 'matrix-row';

    cellIds.forEach(id => {
        const cellData = treeData[id] || { id, user: null };
        const cellEl = document.createElement('div');
        cellEl.className = 'matrix-cell';
        cellEl.id = `cell-${id}`;

        if (cellData.user) {
            cellEl.classList.add('filled', levelColorClass);
            cellEl.innerText = cellData.user;

            if (currentSearchTerm && cellData.user.toLowerCase() === currentSearchTerm.toLowerCase()) {
                cellEl.classList.add('searched');
            }
        } else {
            cellEl.innerText = id;
        }

        addCellEvents(cellEl, cellData);
        row.appendChild(cellEl);
    });

    return row;
}

// События ячеек (клики и долгое нажатие)
function addCellEvents(element, cellData) {
    if (!cellData.user) return;

    element.addEventListener('click', () => {
        switchFocus(element);
        showUserCard(cellData.user);
    });

    element.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
            showUserCard(cellData.user);
        }, 500);
    });

    element.addEventListener('touchend', () => {
        clearTimeout(pressTimer);
    });
}

function setZoom100() {
    const zoomSlider = document.getElementById('matrix-zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const zoomWrapper = document.getElementById('matrix-zoom-wrapper');

    if (zoomSlider && zoomWrapper) {
        zoomSlider.value = 1.0;
        zoomWrapper.style.transform = 'scale(1.0)';
        if (zoomValue) {
            zoomValue.textContent = '100%';
        }
    }
}

function switchFocus(element) {
    setZoom100(); 
    setTimeout(() => {
        element.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
    }, 100);
}

// Карточка пользователя С ЦЕПОЧКОЙ СПОНСОРОВ И КНОПКАМИ УПРАВЛЕНИЯ
async function showUserCard(username) {
    try {
        const res = await fetch(`${MATRIX_API_URL}/api/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (!data.success) return;

        const profile = data.profile || {};
        const regDateStr = profile.paymentDate || new Date().toISOString();
        const regDate = new Date(regDateStr);
        const now = new Date();
        const diffDays = Math.floor((now - regDate) / (1000 * 60 * 60 * 24));

        let modal = document.getElementById('userCardModal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'userCardModal';
        modal.className = 'user-card-modal';

        const isMature = diffDays >= 31;
        const isSuspended = profile.payoutsSuspended || false;
        const isOwnedByAdmin = profile.ownedByAdmin || false;

        let badgeClass = isMature ? 'matured' : 'active';
        let badgeText = isMature ? `Дней в матрице: ${diffDays} (Выплата)` : `Дней в матрице: ${diffDays} / 31`;

        if (isOwnedByAdmin) {
            badgeClass = 'admin-owned';
            badgeText = '👑 Профиль принадлежит Админу';
        } else if (isSuspended) {
            badgeClass = 'suspended';
            badgeText = '⛔ Выплаты приостановлены';
        }

        let uplineHtml = '<div style="color:#777; font-size:11px;">Загрузка спонсоров...</div>';
        
        modal.innerHTML = `
            <div class="user-card-content">
                <span class="user-card-close" onclick="document.getElementById('userCardModal').remove()">&times;</span>
                <h3 style="margin-top:0; color:#ffd700; word-break: break-all;">
                    ${data.username} ${isOwnedByAdmin ? '<span style="color:#2ecc71; font-size:12px;">(Админ)</span>' : ''}
                </h3>
                <p style="font-size:12px; color:#ccc; margin: 6px 0 0 0;">Дата регистрации:<br>${regDate.toLocaleDateString()}</p>
                
                <div class="timer-badge ${badgeClass}">${badgeText}</div>

                ${!isOwnedByAdmin ? `
                    <div style="margin-top: 15px; display: flex; flex-direction: column; gap: 8px;">
                        <button onclick="adminToggleSuspend('${data.username}')" 
                            style="background: ${isSuspended ? '#27ae60' : '#f39c12'}; color: #fff; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">
                            ${isSuspended ? '▶ Возобновить выплаты' : '⏸ Приостановить выплаты'}
                        </button>

                        <button onclick="adminBlockAndTransfer('${data.username}')" 
                            style="background: #c0392b; color: #fff; border: none; padding: 8px; border-radius: 6px; font-weight: bold; cursor: pointer; font-size: 11px;">
                            🚫 Заблокировать и передать Админу
                        </button>
                    </div>
                ` : `
                    <div style="margin-top: 10px; color: #2ecc71; font-size: 11px; font-weight: bold;">
                        Все выплаты переходят Администратору
                    </div>
                `}

                <div class="modal-upline-box">
                    <div class="modal-upline-title">Кто пригласил (Спонсоры):</div>
                    <div class="modal-upline-chain" id="modalUplineContainer">${uplineHtml}</div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);

        // Загружаем спонсорскую цепочку асинхронно
        try {
            const chainRes = await fetch(`${MATRIX_API_URL}/api/get-referral-chain?login=${encodeURIComponent(username)}`);
            const chainData = await chainRes.json();
            const container = document.getElementById('modalUplineContainer');
            
            if (container && chainData.success && chainData.chain && chainData.chain.length > 0) {
                container.innerHTML = '';
                chainData.chain.forEach((uplineLogin, idx) => {
                    const node = document.createElement('span');
                    if (idx === chainData.chain.length - 1) {
                        node.innerHTML = `<strong style="color:#2ecc71;">${uplineLogin}</strong>`;
                    } else {
                        node.innerText = uplineLogin;
                        node.style.color = '#3498db';
                        node.style.cursor = 'pointer';
                        node.style.textDecoration = 'underline';
                        node.onclick = () => {
                            document.getElementById('userCardModal').remove();
                            showUserCard(uplineLogin);
                        };
                    }
                    container.appendChild(node);

                    if (idx < chainData.chain.length - 1) {
                        const arrow = document.createElement('span');
                        arrow.innerText = ' ➔ ';
                        arrow.style.color = '#555';
                        container.appendChild(arrow);
                    }
                });
            } else if (container) {
                container.innerHTML = '<span style="color:#777;">Нет вышестоящих спонсоров</span>';
            }
        } catch (chainErr) {
            console.error('Ошибка загрузки цепочки в попап:', chainErr);
        }

    } catch (err) {
        console.error('Ошибка загрузки карточки пользователя:', err);
    }
}

// Функция переключения режима приостановки выплат
async function adminToggleSuspend(username) {
    try {
        const res = await fetch(`${MATRIX_API_URL}/api/admin/toggle-suspend`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        alert(data.message);
        showUserCard(username);
    } catch (err) {
        alert('Ошибка при изменении статуса выплат');
    }
}

// Функция блокировки и передачи профиля Админу
async function adminBlockAndTransfer(username) {
    if (!confirm(`Вы уверены, что хотите заблокировать "${username}" и перевести все выплаты Администратору?`)) {
        return;
    }

    try {
        const res = await fetch(`${MATRIX_API_URL}/api/admin/block-and-transfer`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await res.json();
        alert(data.message);
        showUserCard(username);
        fetchTree();
    } catch (err) {
        alert('Ошибка передачи профиля');
    }
}

// Функция показа списка забранных логинов Администратора
async function showAdminLoginsList() {
    try {
        const res = await fetch(`${MATRIX_API_URL}/api/admin/owned-logins`);
        const data = await res.json();
        
        if (!data.success) return;

        let modal = document.getElementById('adminLoginsModal');
        if (modal) modal.remove();

        modal = document.createElement('div');
        modal.id = 'adminLoginsModal';
        modal.className = 'user-card-modal';

        let listHtml = data.logins.map(item => `
            <div style="display:flex; justify-content:space-between; align-items:center; background:#202028; padding:8px 12px; margin-bottom:6px; border-radius:6px; border:1px solid #333;">
                <span style="color:#ffd700; font-weight:bold; cursor:pointer;" onclick="document.getElementById('adminLoginsModal').remove(); searchMatrixUser('${item.login}');">
                    ${item.login}
                </span>
                <button onclick="document.getElementById('adminLoginsModal').remove(); showUserCard('${item.login}');" 
                    style="background:#3498db; color:#fff; border:none; padding:4px 8px; border-radius:4px; font-size:11px; cursor:pointer;">
                    Карточка
                </button>
            </div>
        `).join('');

        modal.innerHTML = `
            <div class="user-card-content" style="width: 320px; max-height: 80vh; overflow-y: auto;">
                <span class="user-card-close" onclick="document.getElementById('adminLoginsModal').remove()">&times;</span>
                <h3 style="margin-top:0; color:#2ecc71;">👑 Логины Администратора (${data.logins.length})</h3>
                <div style="margin-top: 15px; text-align: left;">
                    ${listHtml || '<div style="color:#aaa; text-align:center;">Нет переданных логинов</div>'}
                </div>
            </div>
        `;

        document.body.appendChild(modal);

    } catch (err) {
        console.error('Ошибка загрузки логинов админа:', err);
    }
}

function searchMatrixUser(login) {
    if (!login) return;
    currentSearchTerm = login.trim();
    fetchTree().then(() => {
        const searchedEl = document.querySelector('.matrix-cell.searched');
        if (searchedEl) {
            switchFocus(searchedEl);
        } else {
            alert(`Пользователь "${login}" не найден в матрицах.`);
        }
    });
}

// Инициализация Ползунка масштабирования (от 0.03 до 1)
function initZoomSlider() {
    const zoomSlider = document.getElementById('matrix-zoom-slider');
    const zoomValue = document.getElementById('zoom-value');
    const zoomWrapper = document.getElementById('matrix-zoom-wrapper');

    if (zoomSlider && zoomWrapper) {
        zoomSlider.addEventListener('input', (e) => {
            const val = parseFloat(e.target.value);
            zoomWrapper.style.transform = `scale(${val})`;
            if (zoomValue) {
                zoomValue.textContent = `${Math.round(val * 100)}%`;
            }
        });
    }
}

window.renderMatrixTree = fetchTree;
window.searchMatrixUser = searchMatrixUser;
window.showAdminLoginsList = showAdminLoginsList;
window.adminToggleSuspend = adminToggleSuspend;
window.adminBlockAndTransfer = adminBlockAndTransfer;

document.addEventListener('DOMContentLoaded', () => {
    initZoomSlider();
});

setInterval(fetchTree, 3000);
fetchTree();
