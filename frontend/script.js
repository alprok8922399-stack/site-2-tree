const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const screenContainer = document.getElementById('screenContainer');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');
const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');

// --- ЭЛЕМЕНТЫ УПРАВЛЕНИЯ ---
const menuToggleBtn = document.getElementById('menuToggleBtn');
const menuContent = document.getElementById('menuContent');
const openTableBtn = document.getElementById('openTableBtn');
const tableOverlay = document.getElementById('tableOverlay');
const closeOverlayBtn = document.getElementById('closeOverlayBtn');
const interactiveRefTableBody = document.getElementById('interactiveRefTableBody');

// Элементы поиска внутри таблицы рефералов
const refSearchInput = document.getElementById('refSearchInput');
const refSearchBtn = document.getElementById('refSearchBtn');
const refSearchResetBtn = document.getElementById('refSearchResetBtn');

// ГЛОБАЛЬНОЕ ХРАНИЛИЩЕ СОСТОЯНИЯ (Общее для всех модулей)
let currentRootId = 'A1'; 
let searchTargetUser = '';      // Цель для подсветки в Матрицах
let refSearchTargetUser = '';   // Цель для подсветки в Таблице рефералов

let globalTreeCached = null; 
let lastTreeJsonString = '';     // Хэш состояния матриц
let lastRefTreeJsonString = '';  // Хэш состояния таблицы рефералов

let expandedNodes = new Set();   // Помнит, какие ветки рефералов развернуты

// --- ЛОГИКА МЕНЮ И ОВЕРЛЕЯ ---
if (menuToggleBtn && menuContent) {
    menuToggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        menuContent.classList.toggle('show');
    });
}

if (openTableBtn && tableOverlay && menuContent) {
    openTableBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tableOverlay.classList.add('show');
        menuContent.classList.remove('show');
        if (typeof buildInteractiveRefTable === 'function') {
            buildInteractiveRefTable(true); // Вызов из модуля table.js
        }
    });
}

if (closeOverlayBtn && tableOverlay) {
    closeOverlayBtn.addEventListener('click', () => {
        tableOverlay.classList.remove('show');
    });
}

document.addEventListener('click', (e) => {
    if (menuContent && menuContent.classList.contains('show')) {
        if (!menuContent.contains(e.target) && e.target !== menuToggleBtn) {
            menuContent.classList.remove('show');
        }
    }
});

// --- ИНИЦИАЛИЗАЦИЯ МОДАЛЬНОГО ОКНА КАРТОЧКИ ---
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
    if (!zoomSlider || !mainTreeDisplay) return;
    zoomSlider.value = scaleValue;
    mainTreeDisplay.style.transform = `scale(${scaleValue})`;
    mainTreeDisplay.style.width = '100%';
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

// --- СВЯЗУЮЩИЕ КНОПКИ ПОИСКА (ДЕЛЕГИРУЮТ В ДРУГИЕ МОДУЛИ) ---
if (searchBtn && searchInput) {
    searchBtn.addEventListener('click', () => {
        const val = searchInput.value.trim();
        if (val) {
            if (typeof findUserAndFocus === 'function') findUserAndFocus(val);
        } else {
            currentRootId = 'A1';
            searchTargetUser = '';
            setZoom(0.8); 
            fetchTree(true);
        }
    });
}

if (refSearchBtn && refSearchInput) {
    refSearchBtn.addEventListener('click', () => {
        const val = refSearchInput.value.trim();
        if (val && typeof findReferalAndExpand === 'function') {
            findReferalAndExpand(val);
        }
    });
}

if (refSearchResetBtn && refSearchInput) {
    refSearchResetBtn.addEventListener('click', () => {
        refSearchInput.value = '';
        refSearchTargetUser = '';
        expandedNodes.clear();
        if (typeof buildInteractiveRefTable === 'function') buildInteractiveRefTable(true);
    });
}

// Всплывающая карточка деталей пользователя
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
    modalBody.innerHTML = `<i>Загрузка данных...</i>`;
    modalView.style.display = 'flex';

    try {
        const res = await fetch(`${API_URL}/user-details/${encodeURIComponent(username)}`);
        const data = await res.json();
        
        if (data.success) {
            const cellsList = data.cells.join(', ');
            
            modalBody.innerHTML = `
                <p>👤 <strong>Логин:</strong> ${data.username}</p>
                <p>🏠 <strong>Занятые ячейки:</strong> ${cellsList}</p>
                <p>🤝 <strong>Прямой Спонсор:</strong> <span style="color:#ffd700;">${data.sponsor}</span></p>
            `;
            
            currentRootId = cellId;
            searchTargetUser = username;
            if (typeof renderDynamicSplitting === 'function') renderDynamicSplitting(globalTreeCached);
            if (typeof scrollToFocusedCell === 'function') scrollToFocusedCell(); 
        } else {
            modalBody.innerHTML = `<span style="color:#e43f5a;">Ошибка: ${data.error}</span>`;
        }
    } catch (err) {
        modalBody.innerHTML = `<span style="color:#e43f5a;">Не удалось связаться с сервером деталей</span>`;
    }
};

// Переключение фокуса на пустую ячейку матрицы
window.switchFocus = function(cellId) {
    currentRootId = cellId;
    setZoom(0.8); 
    fetchTree(true);
};

// --- ЕДИНЫЙ ЦЕНТРАЛЬНЫЙ ТАЙМЕР ОБНОВЛЕНИЯ ДАННЫХ ---
async function fetchTree(forceRender = false) {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        
        const currentTreeStr = JSON.stringify(data) + `_root:${currentRootId}_target:${searchTargetUser}`;
        globalTreeCached = data; 
        
        // Рендерим матрицы (из модуля matrix.js), только если изменился хэш данных или передан флаг forceRender
        if (currentTreeStr !== lastTreeJsonString || forceRender) {
            lastTreeJsonString = currentTreeStr;
            if (typeof renderDynamicSplitting === 'function') {
                renderDynamicSplitting(data);
            }
        }
        
        // Синхронно обновляем таблицу рефералов, если оверлей сейчас открыт
        if (tableOverlay && tableOverlay.classList.contains('show')) {
            if (typeof buildInteractiveRefTable === 'function') {
                buildInteractiveRefTable(forceRender);
            }
        }
    } catch (err) {
        console.error('Ошибка загрузки глобального дерева:', err);
    }
}

// Кнопка полного сброса базы данных
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
                refSearchTargetUser = '';
                expandedNodes.clear(); 
                lastTreeJsonString = '';
                lastRefTreeJsonString = '';
                setZoom(0.8);
                fetchTree(true);
            }
        } catch (err) {
            alert('Ошибка при сбросе');
        }
    });
}

// Запуск при инициализации страницы
fetchTree(true);

// Фоновое бесшумное обновление каждые 2 секунды
setInterval(fetchTree, 2000);
