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
    // 1. Уровень C
    const levelC = ['C1', 'C2', 'C3', 'C4'];
    for (const id of levelC) {
        if (!tree[id]) tree[id] = { id, level: 'C', user: null };
        if (!tree[id].user) return id; 
    }

    // 2. Уровень D (инициализация)
    const levelD = ['D1', 'D2', 'D3', 'D4', 'D5', 'D6', 'D7', 'D8'];
    for (const id of levelD) {
        if (!tree[id]) tree[id] = { id, level: 'D', user: null };
    }

    // --- МОНИТОРИНГ ---
    // Постоянно логируем состояние триггеров для понимания хода процесса
    console.log(`[TREE LOG] D4 user: ${tree['D4']?.user || 'null'}, D8 user: ${tree['D8']?.user || 'null'}`);

    // 3. Триггеры появления уровня E
    // Если D4 занят -> создаем E1-E8
    if (tree['D4'] && tree['D4'].user) {
        for (let i = 1; i <= 8; i++) {
            const eid = `E${i}`;
            if (!tree[eid]) {
                tree[eid] = { id: eid, level: 'E', user: null };
                console.log(`[TREE LOG] Event: Initialized ${eid}`);
            }
        }
    }
    // Если D8 занят -> создаем E9-E16
    if (tree['D8'] && tree['D8'].user) {
        for (let i = 9; i <= 16; i++) {
            const eid = `E${i}`;
            if (!tree[eid]) {
                tree[eid] = { id: eid, level: 'E', user: null };
                console.log(`[TREE LOG] Event: Initialized ${eid}`);
            }
        }
    }

    // 4. Заполнение уровня D (веерный алгоритм)
    const sequenceD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const id of sequenceD) {
        if (!tree[id].user) return id;
    }

    // 5. Заполнение уровня E
    for (let i = 1; i <= 16; i++) {
        const eid = `E${i}`;
        if (tree[eid] && !tree[eid].user) return eid;
    }

    return null; // Уровни C, D и E заполнены
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
