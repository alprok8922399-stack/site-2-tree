/* ==========================================================================
   🚨 КРИТИЧЕСКАЯ ЗОНА: ТОЛЬКО ДЛЯ ЧТЕНИЯ (READ-ONLY)
   ⚠️ ЛЮБЫЕ ИЗМЕНЕНИЯ В ЭТОМ ФАЙЛЕ ЗАПРЕЩЕНЫ И МОГУТ СЛОМАТЬ СИСТЕМУ ДЕПЛОЯ!
   ========================================================================== */

const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const screenContainer = document.getElementById('screenContainer');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

let currentRootId = 'A1'; 
let searchTargetUser = ''; // Цель для подсветки в Матрицах

// КЭШ ДЛЯ ОПТИМИЗАЦИИ СЕТИ И ПРЕДОТВРАЩЕНИЯ МЕРЦАНИЯ DOM
let globalTreeCached = null; 
let lastTreeJsonString = ''; 

// Создаем HTML-структуру для всплывающего окна информации по матричной ячейке
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

// --- УПРАВЛЕНИЕ МАСШТАБОМ (ZOOM) ---
function setZoom(scaleValue) {
    if (zoomSlider) {
        zoomSlider.value = scaleValue;
    }
    if (mainTreeDisplay) {
        mainTreeDisplay.style.transform = `scale(${scaleValue})`;
        mainTreeDisplay.style.width = '100%';
    }
}

if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
        setZoom(e.target.value);
    });
}

if (screenContainer) {
    screenContainer.addEventListener('click', (e) => {
        if (e.target === screenContainer || e.target === mainTreeDisplay || e.target.classList.contains('matrices-row')) {
            setZoom(0.8);
        }
    });
}

// --- ПОИСК И ФОКУСИРОВКА В МАТРИЦАХ ---
if (searchBtn) {
    searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) {
            findUserAndFocus(val);
        } else {
            currentRootId = 'A1';
            searchTargetUser = '';
            setZoom(0.8); 
            fetchTree(true); 
        }
    });
}

// Плавный скролл к найденной ячейке в Матрицах
function scrollToFocusedCell() {
    setTimeout(() => {
        const focusedCell = document.querySelector('.focused-cell');
        if (focusedCell) {
            focusedCell.scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'center'
            });
        }
    }, 100);
}

// Получение данных матрицы с сервера
async function fetchTree(forceRender = false) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        
        const currentTreeStr = JSON.stringify(data) + `_root:${currentRootId}_target:${searchTargetUser}`;
        globalTreeCached = data; 
        
        if (currentTreeStr === lastTreeJsonString && !forceRender) {
            return; 
        }
        
        lastTreeJsonString = currentTreeStr;
        renderDynamicSplitting(data);
    } catch (err) {
        console.error('Ошибка загрузки данных дерева:', err);
    }
}

// Поиск ячейки по логину пользователя
function findUserAndFocus(username) {
    fetch(`${API_URL}/tree`)
        .then(res => res.json())
        .then(tree => {
            let foundCellId = null;
            let exactUsername = '';

            for (const [id, cell] of Object.entries(tree)) {
                if (cell && cell.user && cell.user.toLowerCase() === username.toLowerCase()) {
                    foundCellId = id;
                    exactUsername = cell.user;
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
                searchTargetUser = exactUsername; 
                
                setZoom(0.8); 
                fetchTree(true); 
                scrollToFocusedCell();
            } else {
                alert(`Пользователь "${username}" не найден в матричной структуре`);
            }
        });
}

// Вывод детальной информации о ячейке во всплывающем окне
window.showUserDetails = async function(username, cellId, event) {
    if (event) event.stopPropagation(); 
    
    if (!username || username === '-') {
        currentRootId = cellId;
        setZoom(0.8);
        fetchTree(true);
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
            renderDynamicSplitting(globalTreeCached);
            scrollToFocusedCell(); 
        } else {
            modalBody.innerHTML = `<span style="color:#e43f5a;">Ошибка: ${data.error}</span>`;
        }
    } catch (err) {
        modalBody.innerHTML = `<span style="color:#e43f5a;">Не удалось связаться с сервером деталей</span>`;
    }
};

// Генерация HTML отдельной ячейки
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
    fetchTree(true);
};

// --- ГЕНЕРАЦИЯ СЕМЁРКИ (3 РЯДА: ВЕРХУШКА, ПЛЕЧИ, НИЗ) ---
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

// --- ДИНАМИЧЕСКИЙ РАСЧЕТ И ДЕЛЕНИЕ МАТРИЦ (SPLITTING) ---
function renderDynamicSplitting(tree) {
    globalTreeCached = tree;
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

    if (mainTreeDisplay) {
        mainTreeDisplay.innerHTML = `
            <div class="matrices-row">
                ${activeMatricesHTML.join('')}
            </div>
        `;
        const currentScale = zoomSlider ? zoomSlider.value : 0.8;
        mainTreeDisplay.style.transform = `scale(${currentScale})`;
        mainTreeDisplay.style.width = '100%';
    }
}

// --- СБРОС СИСТЕМЫ ---
if (resetBtn) {
    resetBtn.addEventListener('click', async () => {
        if (!confirm('Очистить базу данных дерева?')) return;
        try {
            const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
            const data = await res.json();
            if (data.success) {
                alert('База успешно сброшена!');
                currentRootId = 'A1';
                searchTargetUser = '';
                lastTreeJsonString = ''; 
                setZoom(0.8);
                fetchTree(true);
            }
        } catch (err) {
            alert('Ошибка при сбросе');
        }
    });
}

// Первичный запуск и автообновление матриц
fetchTree(true);
setInterval(fetchTree, 2000);
