const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

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
function getNextEmptyCell(tree) {
    // 1. Уровень C (проверяем по порядку)
    const levelC = ['C1', 'C2', 'C3', 'C4'];
    for (const cellId of levelC) {
        if (!tree[cellId]) tree[cellId] = { id: cellId, level: 'C', user: null };
        if (!tree[cellId].user) return cellId; // Если есть место в С — отдаем его
    }

    // 2. Уровень D (если дошли сюда, значит С заполнены)
    // Создаем ВСЕ 8 ячеек D в системе
    const levelD = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    for (const cellId of levelD) {
        if (!tree[cellId]) {
            tree[cellId] = { id: cellId, level: 'D', user: null };
        }
    }

    // Возвращаем null, чтобы регистратор пока остановился, 
    // так как "пока точка" (ячейки появились, но заполнение не идет)
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
