const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const screenContainer = document.getElementById('screenContainer');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// Новые элементы управления меню и оверлеем из обновленного HTML
const menuToggleBtn = document.getElementById('menuToggleBtn');
const menuContent = document.getElementById('menuContent');
const openTableBtn = document.getElementById('openTableBtn');
const tableOverlay = document.getElementById('tableOverlay');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');

// Элементы динамической реферальной матрешки
const refTableHeaders = document.getElementById('refTableHeaders');
const refTableColumnsBody = document.getElementById('refTableColumnsBody');

let currentRootId = 'A1'; 
let searchTargetUser = ''; 
let globalTreeCached = null; // Будет хранить последнюю успешную копию данных

// Храним текущее состояние раскрытых веток в таблице рефералов
// Структура: [ 'Логин_Спонсора_Уровня_1', 'Логин_Уровня_2', ... ]
let currentRefBranch = []; 

// Храним состояния свернутых колонок рефералов (true - свернуто, false - развернуто)
let collapsedColumns = {};

// Создаем HTML-структуру для всплывающего окна информации (если её еще нет на странице)
let modal = document.getElementById('infoModal');
if (!modal) {
    modal = document.createElement('div');
    modal.id = 'infoModal';
    modal.style.cssText = `
        position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
        background: rgba(0,0,0,0.85); display: none; justify-content: center;
        align-items: center; z-index: 9999; font-family: sans-serif; padding: 20px; box-sizing: border-box;
    `;
    modal.innerHTML = `
        <div style="background: #162447; border: 2px solid #00fff0; padding: 20px; border-radius: 12px; max-width: 450px; width: 100%; box-shadow: 0 0 20px rgba(0,255,240,0.3); color: #fff; position: relative;">
            <h3 id="modalTitle" style="margin-top:0; color:#00fff0; font-size:20px; border-bottom:1px solid #0f4c81; padding-bottom:10px;">Информация о партнере</h3>
            <div id="modalBody" style="font-size:15px; line-height:1.6; margin-bottom:20px;">Загрузка...</div>
            <button onclick="document.getElementById('infoModal').style.display='none'" style="width:100%; padding:10px; background:#e43f5a; border:none; color:white; font-weight:bold; border-radius:6px; cursor:pointer;">ЗАКРЫТЬ</button>
        </div>
    `;
    document.body.appendChild(modal);
}

// Логика работы выпадающего меню управления (Шторка)
if (menuToggleBtn && menuContent) {
    menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuContent.classList.toggle('show');
    });
}

// Открытие полноэкранного окна с таблицей рефералов
if (openTableBtn && tableOverlay && menuContent) {
    openTableBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tableOverlay.classList.add('show');
        menuContent.classList.remove('show'); // Сворачиваем шторку обратно
        buildInteractiveRefTable(); // Строим матрешку при открытии
    });
}

// Закрытие полноэкранного окна с таблицей
if (closeOverlayBtn && tableOverlay) {
    closeOverlayBtn.addEventListener('click', () => {
        tableOverlay.classList.remove('show');
    });
}

// Закрытие шторки при клике в любое пустое место экрана
document.addEventListener('click', (e) => {
    if (menuContent && menuContent.classList.contains('show')) {
        if (!menuContent.contains(e.target) && e.target !== menuToggleBtn) {
            menuContent.classList.remove('show');
        }
    }
});

function setZoom(scaleValue) {
    zoomSlider.value = scaleValue;
    mainTreeDisplay.style.transform = `scale(${scaleValue})`;
    mainTreeDisplay.style.width = '100%';
}

zoomSlider.addEventListener('input', (e) => {
    setZoom(e.target.value);
});

if (screenContainer) {
    screenContainer.addEventListener('click', (e) => {
        if (e.target === screenContainer || e.target === mainTreeDisplay || e.target.classList.contains('matrices-row')) {
            setZoom(0.8);
        }
    });
}

searchBtn.addEventListener('click', () => {
    const val = searchInput.value.trim();
    if (val) {
        searchTargetUser = val;
        findUserAndFocus(val);
    } else {
        currentRootId = 'A1';
        searchTargetUser = '';
        setZoom(0.8); 
        fetchTree();
    }
});

async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        globalTreeCached = data; // Обновляем глобальный кэш данных дерева
        renderDynamicSplitting(data);
        
        // Перерисовываем реферальную таблицу, только если она сейчас открыта пользователем
        if (tableOverlay && tableOverlay.classList.contains('show')) {
            buildInteractiveRefTable();
        }
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }
}

function findUserAndFocus(username) {
    fetch(`${API_URL}/tree`)
        .then(res => res.json())
        .then(tree => {
            globalTreeCached = tree;
            let foundCellId = null;
            for (const [id, cell] of Object.entries(tree)) {
                if (cell && cell.user && cell.user.toLowerCase() === username.toLowerCase()) {
                    foundCellId = id;
                    break;
                }
            }
            
            if (foundCellId) {
                const parsed = parseCell(foundCellId);
                let rootId = foundCellId; 
                
                function getPrevLevelLetter(letter) {
                    if (letter.length > 1) return letter.substring(0, letter.length - 1);
                    if (letter === 'A') return 'A';
                    return String.fromCharCode(letter.charCodeAt(0) - 1);
                }
                
                let currentLetter = parsed.letter;
                let currentNum = parsed.num;
                
                let step1Letter = getPrevLevelLetter(currentLetter);
                let step1Num = Math.floor((currentNum + 1) / 2);
                
                let step2Letter = getPrevLevelLetter(step1Letter);
                let step2Num = Math.floor((step1Num + 1) / 2);
                
                let candidateRoot = `${step2Letter}${step2Num}`;
                
                if (step2Letter === 'A' || tree[candidateRoot]) {
                    rootId = candidateRoot;
                } else {
                    let candidateRoot2 = `${step1Letter}${step1Num}`;
                    rootId = candidateRoot2;
                }
                
                if (parsed.letter === 'A') rootId = 'A1';

                currentRootId = rootId;
                searchTargetUser = username; 
                setZoom(0.8); 
                renderDynamicSplitting(tree);
            } else {
                alert(`Пользователь ${username} не найден в текущей структуре`);
            }
        });
}

// Функция клика по заполненной ячейке матрицы — вызывает модалку с деталями
window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation(); // Чтобы не срабатывал зум контейнера
    
    if (!username || username === '-') {
        currentRootId = cellId;
        setZoom(0.8);
        fetchTree();
        return;
    }

    const modalView = document.getElementById('infoModal');
    const modalTitle = document.getElementById('modalTitle');
    const modalBody = document.getElementById('modalBody');
    
    modalTitle.textContent = `Карточка: ${username}`;
    modalBody.innerHTML = `<i>Загрузка связей...</i>`;
    modalView.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (data.success) {
            const cellsList = data.cells.join(', ');
            const chainLine = data.chain.length > 0 ? data.chain.join(' ➔ ') : 'Корневой аккаунт';
            
            modalBody.innerHTML = `
                <p>👤 <strong>Логин:</strong> ${data.username}</p>
                <p>🏠 <strong>Занятые ячейки:</strong> ${cellsList}</p>
                <p>🤝 <strong>Прямой Спонсор:</strong> <span style="color:#ffd700;">${data.sponsor}</span></p>
                <div style="background:#1f4068; padding:10px; border-radius:6px; margin-top:15px; border:1px dashed #00fff0;">
                    <strong style="color:#00fff0; display:block; margin-bottom:5px;">Линия спонсоров вверх («Кто-за-кем»):</strong>
                    <div style="word-break: break-all; font-size:14px; color:#e2e2e2;">${chainLine}</div>
                </div>
            `;
            
            currentRootId = cellId;
            searchTargetUser = username;
            
            if (globalTreeCached) {
                renderDynamicSplitting(globalTreeCached);
            }
        } else {
            modalBody.innerHTML = `<span style="color:#e43f5a;">Ошибка: ${data.error}</span>`;
        }
    } catch (err) {
        modalBody.innerHTML = `<span style="color:#e43f5a;">Не удалось связаться с сервером деталей</span>`;
    }
};

// Функция переключения сворачивания/разворачивания колонки рефералов по клику на заголовок
window.toggleColumnCollapse = function(columnIndex) {
    collapsedColumns[columnIndex] = !collapsedColumns[columnIndex];
    buildInteractiveRefTable();
};

// Главная логика построения многоуровневой матрешки рефералов в ширину
async function buildInteractiveRefTable() {
    if (!globalTreeCached) return;

    // Шаг 1: Находим корневого пользователя всей системы (самый первый на уровне А)
    let systemRoot = null;
    if (globalTreeCached['A1'] && globalTreeCached['A1'].user) {
        systemRoot = globalTreeCached['A1'].user;
    } else {
        // Если база пустая, выводим заглушку
        refTableHeaders.innerHTML = '<th style="width:100%;">Реферальная сеть</th>';
        refTableColumnsBody.innerHTML = '<td><div style="text-align:center; padding: 20px;">База данных пуста</div></td>';
        return;
    }

    // Если текущая выбранная ветка пуста, инициализируем её корнем системы
    if (currentRefBranch.length === 0) {
        currentRefBranch = [systemRoot];
    }

    // Будем строить массив колонок. Каждая колонка — это список пользователей
    let columnsData = [];
    
    // Первая колонка — это всегда сам Корень/Спонсор ветки
    columnsData.push([systemRoot]);

    // Для каждого выбранного пользователя на уровнях 1, 2, 3... загружаем его личников по API
    for (let i = 0; i < currentRefBranch.length; i++) {
        const currentUser = currentRefBranch[i];
        try {
            const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(currentUser)}`);
            const details = await res.json();
            
            if (details.success && details.referrals && details.referrals.length > 0) {
                // Добавляем список его личников как следующую колонку справа
                columnsData.push(details.referrals);
            } else {
                // Если личников у этого партнера нет, цепочка вправо прерывается
                break;
            }
        } catch (e) {
            console.error("Ошибка получения личников для " + currentUser, e);
            break;
        }
    }

    // Шаг 2: Генерируем HTML для заголовков <thead> (Рефералы_1, Рефералы_2...)
    let headersHTML = '';
    for (let i = 0; i < columnsData.length; i++) {
        const isCollapsed = collapsedColumns[i] || false;
        const arrowSymbol = isCollapsed ? '▶️' : '🔽';
        const arrowClass = isCollapsed ? 'header-arrow collapsed' : 'header-arrow';
        
        let titleName = i === 0 ? "Спонсор ветки" : `Рефералы_${i}`;
        
        headersHTML += `
            <th onclick="toggleColumnCollapse(${i})">
                <span>${titleName}</span>
                <span class="${arrowClass}">${arrowSymbol}</span>
            </th>
        `;
    }
    refTableHeaders.innerHTML = headersHTML;

    // Шаг 3: Генерируем HTML для списков пользователей <tbody> по колонкам
    let columnsBodyHTML = '';
    for (let i = 0; i < columnsData.length; i++) {
        const usersInColumn = columnsData[i];
        const isColumnHidden = collapsedColumns[i] || false;
        
        columnsBodyHTML += `<td>`;
        // Применяем класс hidden, если заголовок был свернут пользователем
        columnsBodyHTML += `<div class="referrals-column-list ${isColumnHidden ? 'hidden' : ''}">`;
        
        usersInColumn.forEach(username => {
            // Ищем первую занятую ячейку пользователя для вывода бейджика ID
            let cellBadgeId = '';
            for (const [id, cell] of Object.entries(globalTreeCached)) {
                if (cell && cell.user === username) {
                    cellBadgeId = id;
                    break;
                }
            }

            // Проверяем, выбран ли этот пользователь в текущей цепочке активной ветки
            const isActiveInBranch = currentRefBranch.includes(username) ? 'active-branch' : '';
            // Проверяем, является ли он целью глобального поиска по логину
            const isTargetHighlight = (username === searchTargetUser) ? 'style="border-color:#ff3366; background:#ff3366 !important;"' : '';

            columnsBodyHTML += `
                <div class="user-row-card ${isActiveInBranch}" ${isTargetHighlight} onclick="selectRefUser('${username}', ${i}, event)">
                    <div class="user-info-text">
                        <span class="user-name">${username}</span>
                        <span class="user-cell-badge">Ячейка: ${cellBadgeId || '-'}</span>
                    </div>
                    <div class="row-arrow">➔</div>
                </div>
            `;
        });
        
        columnsBodyHTML += `</div></td>`;
    }
    refTableColumnsBody.innerHTML = columnsBodyHTML;
}

// Обработчик клика по карточке пользователя внутри реферального оверлея
window.selectRefUser = function(username, columnIndex, event) {
    event.stopPropagation();
    
    // Обрезаем ветку до уровня кликнутого пользователя и добавляем его как активный выбор
    currentRefBranch = currentRefBranch.slice(0, columnIndex);
    currentRefBranch.push(username);
    
    // Находим его ID ячейки в дереве, чтобы синхронно сфокусировать на нем задний фон матриц
    let targetCellId = 'A1';
    for (const [id, cell] of Object.entries(globalTreeCached)) {
        if (cell && cell.user === username) {
            targetCellId = id;
            break;
        }
    }
    
    currentRootId = targetCellId;
    searchTargetUser = username;
    
    // Отрендерить обновленные матрицы на фоне и перестроить цепочку рефералов вправо
    renderDynamicSplitting(globalTreeCached);
    buildInteractiveRefTable();
};

function getCellHTML(cell, roleClass, fallbackId = '-') {
    if (!cell) {
        return `<div class="cell ${roleClass}" onclick="switchFocus('${fallbackId}')"><div class="cell-id">${fallbackId}</div><div class="cell-user">-</div></div>`;
    }
    const isOccupied = cell.user ? 'occupied' : '';
    const displayUser = cell.user ? cell.user : '-';
    const isFocused = (cell.user && cell.user === searchTargetUser) ? 'focused-cell' : '';

    return `
        <div class="cell ${roleClass} ${isOccupied} ${isFocused}" onclick="showUserDetails('${displayUser}', '${cell.id}', event)">
            <div class="cell-id">${cell.id}</div>
            <div class="cell-user">${displayUser}</div>
        </div>
    `;
}

window.switchFocus = function(cellId) {
    currentRootId = cellId;
    setZoom(0.8); 
    fetchTree();
};

function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids) {
    return `
        <div class="semerka-matrix" onclick="setZoom(0.8); event.stopPropagation();">
            <div class="matrix-row">${getCellHTML(topCell, 'level-1', ids.top)}</div>
            <div class="matrix-row">
                ${getCellHTML(leftShoulder, 'level-2', ids.left)}
                ${getCellHTML(rightShoulder, 'level-2', ids.right)}
            </div>
            <div class="matrix-row">
                ${getCellHTML(bottom4[0], 'level-3', ids.b1)}
                ${getCellHTML(bottom4[1], 'level-3', ids.b2)}
                ${getCellHTML(bottom4[2], 'level-3', ids.b3)}
                ${getCellHTML(bottom4[3], 'level-3', ids.b4)}
            </div>
        </div>
    `;
}

function parseCell(id) {
    const match = id.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return { letter: match[1], num: parseInt(match[2], 10) };
}

function getNextLevelLetter(letter) {
    let i = letter.length - 1;
    while (i >= 0) {
        if (letter[i] !== 'Z') {
            return letter.substring(0, i) + String.fromCharCode(letter.charCodeAt(i) + 1) + 'A'.repeat(letter.length - 1 - i);
        }
        i--;
    }
    return 'A'.repeat(letter.length + 1);
}

function renderDynamicSplitting(tree) {
    if (!tree || Object.keys(tree).length === 0) return;
    
    let activeMatricesHTML = [];
    let queue = [currentRootId]; 
    let processedNodes = new Set();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (processedNodes.has(currentId)) continue;
        processedNodes.add(currentId);

        const topCell = tree[currentId] || null;
        const parsed = parseCell(currentId);
        if (!parsed) continue;

        const nextLetter = getNextLevelLetter(parsed.letter);       
        const bottomLetter = getNextLevelLetter(nextLetter);        

        const leftLNum = parsed.num * 2 - 1;
        const rightLNum = parsed.num * 2;

        const leftShoulderId = `${nextLetter}${leftLNum}`;
        const rightShoulderId = `${nextLetter}${rightLNum}`;

        const b1 = `${bottomLetter}${leftLNum * 2 - 1}`;
        const b2 = `${bottomLetter}${leftLNum * 2}`;
        const b3 = `${bottomLetter}${rightLNum * 2 - 1}`;
        const b4 = `${bottomLetter}${rightLNum * 2}`;

        const leftShoulder = tree[leftShoulderId] || null;
        const rightShoulder = tree[rightShoulderId] || null;
        const bottom4 = [
            tree[b1] || null,
            tree[b2] || null,
            tree[b3] || null,
            tree[b4] || null
        ];

        const isMatrixClosed = bottom4.every(cell => cell && cell.user);

        if (isMatrixClosed) {
            queue.push(leftShoulderId);
            queue.push(rightShoulderId);
        } else {
            const ids = { top: currentId, left: leftShoulderId, right: rightShoulderId, b1, b2, b3, b4 };
            activeMatricesHTML.push(buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4, ids));
        }
    }

    mainTreeDisplay.innerHTML = `
        <div class="matrices-row">
            ${activeMatricesHTML.join('')}
        </div>
    `;
    
    const currentScale = zoomSlider.value;
    mainTreeDisplay.style.transform = `scale(${currentScale})`;
    mainTreeDisplay.style.width = '100%';
}

resetBtn.addEventListener('click', async () => {
    if (!confirm('Очистить базу данных дерева?')) return;
    try {
        const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('База успешно сброшена!');
            currentRootId = 'A1';
            searchTargetUser = '';
            currentRefBranch = []; // Сбрасываем выбранную ветку рефералов
            collapsedColumns = {};
            setZoom(0.8);
            fetchTree();
        }
    } catch (err) {
        alert('Ошибка при сбросе');
    }
});

// Стартовая инициализация
fetchTree();
setInterval(fetchTree, 2000);
