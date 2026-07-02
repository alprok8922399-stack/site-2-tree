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
    // 1. Уровень C (база)
    const levelC = ['C1', 'C2', 'C3', 'C4'];
    for (const cellId of levelC) {
        if (!tree[cellId].user) return cellId;
    }

    // 2. Уровень D (веерное заполнение: 1-5, 2-6, 3-7, 4-8)
    const sequenceD = [1, 5, 2, 6, 3, 7, 4, 8];
    for (const num of sequenceD) {
        const cellId = `D${num}`;
        if (!tree[cellId]) tree[cellId] = { id: cellId, level: 'D', user: null };
        if (!tree[cellId].user) return cellId;
    }

    // 3. Уровень E (авто-открытие ячеек)
    const levelE = ['E1', 'E2', 'E3', 'E4', 'E5', 'E6', 'E7', 'E8'];
    for (const cellId of levelE) {
        if (!tree[cellId]) tree[cellId] = { id: cellId, level: 'E', user: null };
    }
    
    for (const cellId of levelE) {
        if (!tree[cellId].user) return cellId;
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
