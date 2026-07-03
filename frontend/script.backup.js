// Указываем реальный адрес бэкенда на Render вместо localhost
const BACKEND_URL = 'https://site-2-tree.onrender.com';

const resetBtn = document.getElementById('resetBtn');
const zoomSlider = document.getElementById('zoomSlider');
const treeContainer = document.querySelector('.tree-container');
const scrollWrapper = document.querySelector('.scroll-wrapper');

// Переменные для зума пальцами
let currentScale = 0.6;
let initialDistance = null;

// Функция отрисовки дерева на экране телефона
function renderTree(tree) {
    // Карты строк уровней, включая левые и правые блоки для D, E и F
    const levels = {
        A: document.getElementById('level-A'),
        B: document.getElementById('level-B'),
        C: document.getElementById('level-C'),
        'D-left': document.getElementById('level-D-left'),
        'D-right': document.getElementById('level-D-right'),
        'E-left': document.getElementById('level-E-left'),
        'E-right': document.getElementById('level-E-right'),
        'F-left': document.getElementById('level-F-left'),
        'F-right': document.getElementById('level-F-right')
    };
    
    // Очищаем все блоки перед перерисовкой
    Object.values(levels).forEach(el => {
        if (el) el.innerHTML = '';
    });

    // Пробегаемся по всем ячейкам из базы данных
    Object.keys(tree).forEach(cellId => {
        const cellData = tree[cellId];
        const level = cellData.level;
        const num = parseInt(cellId.slice(1));

        // Создаем графический блок ячейки
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        
        if (cellData.color) {
            cellEl.classList.add(`color-${cellData.color}`);
        }
        
        if (cellData.user) {
            cellEl.classList.add('occupied');
        }

        cellEl.innerHTML = `
            <div class="cell-id">${cellData.id}</div>
            <div class="cell-user">${cellData.user || 'Пусто'}</div>
        `;

        // Определяем, в какую именно строку отправлять ячейку
        let targetRow = levels[level];

        if (level === 'D') {
            if (num <= 4) targetRow = levels['D-left'];
            else targetRow = levels['D-right'];
        }
        
        if (level === 'E') {
            if (num <= 8) targetRow = levels['E-left'];
            else targetRow = levels['E-right'];
        }

        if (level === 'F') {
            if (num <= 16) targetRow = levels['F-left'];
            else targetRow = levels['F-right'];
        }

        if (targetRow) {
            targetRow.appendChild(cellEl);
        }
    });
}

// Функция применения зума к матрице
function applyZoom(scale) {
    currentScale = Math.max(0.1, Math.min(scale, 1.5)); // Ограничения от 0.1 (в точку) до 1.5
    if (treeContainer) {
        treeContainer.style.transform = `scale(${currentScale})`;
        treeContainer.style.transformOrigin = 'top center';
    }
    if (zoomSlider) {
        zoomSlider.value = currentScale;
    }
}

// Слушатель ползунка (изменение вручную)
if (zoomSlider) {
    zoomSlider.addEventListener('input', (e) => {
        applyZoom(parseFloat(e.target.value));
    });
}

// --- УПРАВЛЕНИЕ ЖЕСТАМИ ДЛЯ ТЕЛЕФОНА (ЗУМ ПАЛЬЦАМИ) ---
if (scrollWrapper) {
    scrollWrapper.addEventListener('touchstart', (e) => {
        if (e.touches.length === 2) {
            // Запоминаем начальное расстояние между двумя пальцами
            initialDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
        }
    });

    scrollWrapper.addEventListener('touchmove', (e) => {
        if (e.touches.length === 2 && initialDistance) {
            e.preventDefault(); // Запрещаем стандартный зум браузера
            
            // Считаем текущее расстояние между пальцами
            const currentDistance = Math.hypot(
                e.touches[0].pageX - e.touches[1].pageX,
                e.touches[0].pageY - e.touches[1].pageY
            );
            
            // Вычисляем коэффициент изменения
            const factor = currentDistance / initialDistance;
            applyZoom(currentScale * factor);
            
            // Обновляем начальную точку для плавности
            initialDistance = currentDistance;
        }
    }, { passive: false });

    scrollWrapper.addEventListener('touchend', (e) => {
        if (e.touches.length < 2) {
            initialDistance = null;
        }
    });
}

// Функция запроса свежих данных от бэкенда
async function fetchTree() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/tree`);
        if (response.ok) {
            const tree = await response.json();
            renderTree(tree);
        }
    } catch (error) {
        console.error('Ошибка сети при получении дерева:', error);
    }
}

// Кнопка сброса структуры (Очистить БД)
resetBtn.addEventListener('click', async () => {
    if (confirm('Вы уверены, что хотите полностью очистить дерево?')) {
        try {
            const response = await fetch(`${BACKEND_URL}/api/reset`, { method: 'POST' });
            if (response.ok) {
                alert('Дерево успешно сброшено!');
                fetchTree();
            }
        } catch (error) {
            alert('Ошибка сети при сбросе дерева');
        }
    }
});

// Инициализация при старте сайта
fetchTree();
setInterval(fetchTree, 2000);
// Применяем начальный зум из ползунка
applyZoom(parseFloat(zoomSlider.value));
