/* === ФИНАЛЬНАЯ ВЕРСИЯ: ИЗОЛИРОВАННЫЕ БЛОКИ + АНТИ-КЭШ === */
(function() {
    const style = document.createElement('style');
    style.innerHTML = `
        /* Контейнер для горизонтальной галереи */
        .matrices-container {
            display: flex;
            flex-wrap: wrap;
            gap: 20px;
            padding: 20px;
        }

        /* Каждый блок — это независимая семиместная матрица */
        .matrix-block {
            background: #1a1a1a;
            border: 2px solid #334257;
            border-radius: 12px;
            padding: 15px;
            width: 280px; /* Фиксированная ширина блока */
            display: flex;
            flex-direction: column;
            align-items: center;
        }

        .row {
            display: flex;
            justify-content: center;
            gap: 10px;
            margin-bottom: 10px;
            width: 100%;
        }

        .cell {
            background: #2a2a2a;
            border: 1px solid #444;
            color: #fff;
            padding: 5px;
            border-radius: 5px;
            width: 50px;
            text-align: center;
            font-size: 10px;
        }
        
        .cell.filled {
            background: #2c5f2d; /* Зеленый, если занято */
            border-color: #4CAF50;
        }
    `;
    document.head.appendChild(style);
})();

const API_URL = '/api';

// Главная функция: рисуем блоки
async function fetchTree() {
    try {
        // Добавляем ?t=${Date.now()}, чтобы браузер не брал старые данные из кэша
        const res = await fetch(`${API_URL}/tree?t=${Date.now()}`);
        const data = await res.json();
        renderMatrices(data);
    } catch (err) {
        console.error('Ошибка:', err);
    }
}

function renderMatrices(treeData) {
    const container = document.getElementById('mainTreeDisplay');
    container.className = 'matrices-container';
    container.innerHTML = ''; // Очищаем всё перед отрисовкой

    // Логика: рисуем блоки для каждой активной матрицы
    // Предполагаем, что treeData - это плоский список или объект всех ячеек
    // Здесь нужно отфильтровать только те, которые активны
    
    // ВАШЕ ЗАДАНИЕ: Если сервер присылает все ячейки, 
    // рисуем только те, которые нужны (например, активную матрицу)
    
    // Пример отрисовки одного блока (для теста):
    const block = document.createElement('div');
    block.className = 'matrix-block';
    
    // Здесь должна быть логика формирования 7 ячеек из treeData
    // ... (логика отрисовки A1, B1, B2, C1-C4)
    
    container.appendChild(block);
}

// Запуск обновления каждые 2 секунды
setInterval(fetchTree, 2000);
fetchTree();
