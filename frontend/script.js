// Указываем реальный адрес бэкенда на Render вместо localhost
const BACKEND_URL = 'https://site-2-tree.onrender.com';

const resetBtn = document.getElementById('resetBtn');

// Функция отрисовки дерева на экране телефона
function renderTree(tree) {
    // Очищаем строки уровней перед перерисовкой
    const levels = {
        A: document.getElementById('level-A'),
        B: document.getElementById('level-B'),
        C: document.getElementById('level-C'),
        D: document.getElementById('level-D')
    };
    
    Object.values(levels).forEach(el => el.innerHTML = '');

    // Пробегаемся по всем ячейкам из базы данных
    Object.keys(tree).forEach(cellId => {
        const cellData = tree[cellId];
        const level = cellData.level;

        // Создаем графический блок ячейки
        const cellEl = document.createElement('div');
        cellEl.className = 'cell';
        if (cellData.user) {
            cellEl.classList.add('occupied');
        }

        cellEl.innerHTML = `
            <div class="cell-id">${cellData.id}</div>
            <div class="cell-user">${cellData.user || 'Пусто'}</div>
        `;

        // Добавляем ячейку в соответствующую строку на экране
        if (levels[level]) {
            levels[level].appendChild(cellEl);
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
