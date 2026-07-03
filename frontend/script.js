// Указываем реальный адрес бэкенда на Render вместо localhost
const BACKEND_URL = 'https://site-2-tree.onrender.com';

const resetBtn = document.getElementById('resetBtn');

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
        const num = parseInt(cellId.slice(1)); // Получаем номер ячейки (например, 4 из D4)

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

        // Если это уровень D, делим по номерам ячеек
        if (level === 'D') {
            if (num <= 4) {
                targetRow = levels['D-left'];
            } else {
                targetRow = levels['D-right'];
            }
        }
        
        // Если это уровень E, делим по номерам ячеек
        if (level === 'E') {
            if (num <= 8) {
                targetRow = levels['E-left'];
            } else {
                targetRow = levels['E-right'];
            }
        }

        // Если это уровень F, делим по номерам ячеек
        if (level === 'F') {
            if (num <= 16) {
                targetRow = levels['F-left'];
            } else {
                targetRow = levels['F-right'];
            }
        }

        // Добавляем ячейку на экран, если строка существует
        if (targetRow) {
            targetRow.appendChild(cellEl);
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

// Автоматически обновляем дерево каждые 2 секунды, чтобы видеть регистрации на лету
fetchTree();
setInterval(fetchTree, 2000);
