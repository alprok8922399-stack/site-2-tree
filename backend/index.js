const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('frontend'));

// Стартовая статичная база данных (Шапка А и B всегда заполнены)
function createInitialTree() {
    return {
        'A1': { id: 'A1', level: 'A', user: 'SYSTEM_ROOT' },
        'B1': { id: 'B1', level: 'B', user: 'LEADER_1' },
        'B2': { id: 'B2', level: 'B', user: 'LEADER_2' },
        'C1': { id: 'C1', level: 'C', user: null },
        'C2': { id: 'C2', level: 'C', user: null },
        'C3': { id: 'C3', level: 'C', user: null },
        'C4': { id: 'C4', level: 'C', user: null }
    };
}

let treeDB = createInitialTree();

// Вспомогательная функция для генерации ячеек конкретного уровня в БД
function ensureLevelExists(tree, levelLetter, totalCells) {
    for (let i = 1; i <= totalCells; i++) {
        const cellId = `${levelLetter}${i}`;
        if (!tree[cellId]) {
            tree[cellId] = { id: cellId, level: levelLetter, user: null };
        }
    }
}

// Умный бесконечный веерный поиск по Закону Четырёх Секторов
function getNextEmptyCell(tree) {
    // 1. Уровень C заполняется строго по порядку (базовые 4 ячейки)
    const levelC = ['C1', 'C2', 'C3', 'C4'];
    for (const cellId of levelC) {
        if (!tree[cellId].user) return cellId;
    }

    // 2. Бесконечный цикл по всем последующим уровням (D, E, F, G...)
    const levels = [
        { current: 'D', next: 'E', currentCount: 8,  nextCount: 16 },
        { current: 'E', next: 'F', currentCount: 16, nextCount: 32 },
        { current: 'F', next: 'G', currentCount: 32, nextCount: 64 },
        { current: 'G', next: 'H', currentCount: 64, nextCount: 128 }
        // Можно добавлять буквы дальше, логика подхватит автоматически
    ];

    for (const lvl of levels) {
        // Проверяем, созданы ли ячейки текущего уровня в БД
        ensureLevelExists(tree, lvl.current, lvl.currentCount);

        // Рассчитываем размер одного сектора (всего ячеек делим на 4 сектора)
        const sectorSize = lvl.currentCount / 4;

        // Генерируем точный веерный порядок для этого уровня: 
        // Сначала первые места всех 4-х секторов, потом вторые, третьи и т.д.
        const dynamicOrder = [];
        for (let pos = 0; pos < sectorSize; pos++) {
            for (let sec = 0; sec < 4; sec++) {
                // Вычисляем реальный номер ячейки в ряду
                const cellIndex = (sec * sectorSize) + pos + 1;
                dynamicOrder.push(`${lvl.current}${cellIndex}`);
            }
        }

        // Ищем пустую ячейку по этому веерному порядку
        for (const cellId of dynamicOrder) {
            if (!tree[cellId].user) {
                return cellId;
            }
        }

        // Если мы здесь, значит текущий уровеньlvl.current заполнен на 100%!
        // Автоматически открываем ячейки следующего уровня в базе (Защитный барьер пройден)
        ensureLevelExists(tree, lvl.next, lvl.nextCount);
    }

    return null; 
}

// API: Передача дерева на фронтенд
app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

// API: Регистрация нового пользователя роботом с Сайта №1
app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ error: 'Имя пользователя обязательно' });
    }

    const nextCellId = getNextEmptyCell(treeDB);
    if (!nextCellId) {
        return res.status(400).json({ error: 'Достигнут предел тестовых уровней' });
    }

    treeDB[nextCellId].user = username;
    getNextEmptyCell(treeDB); // Актуализируем триггеры барьеров

    res.json({ success: true, cellId: nextCellId, user: username });
});

// API: Сброс базы данных к начальному статичному состоянию
app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    res.json({ success: true, message: 'Дерево сброшено к начальному состоянию' });
});

app.listen(PORT, () => {
    console.log(`Сервер Сайта №2 запущен на порту ${PORT}`);
});
