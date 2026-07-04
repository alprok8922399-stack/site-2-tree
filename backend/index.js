const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

function createInitialTree() {
    return {
        'A1': { id: 'A1', level: 'A', user: 'SYSTEM_ROOT', color: 'gold' },
        'B1': { id: 'B1', level: 'B', user: 'LEADER_1', color: 'blue' },
        'B2': { id: 'B2', level: 'B', user: 'LEADER_2', color: 'blue' },
        'C1': { id: 'C1', level: 'C', user: null, color: 'gray' },
        'C2': { id: 'C2', level: 'C', user: null, color: 'gray' },
        'C3': { id: 'C3', level: 'C', user: null, color: 'gray' },
        'C4': { id: 'C4', level: 'C', user: null, color: 'gray' }
    };
}

let treeDB = createInitialTree();

function findNextEmptyCell(tree) {
    // 1. Уровни A, B, C строго по порядку
    const orderABC = ['A1', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'];
    for (const key of orderABC) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 2. Ряд D строго шахматами
    const orderD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const key of orderD) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 3. Ряд E строго веером
    const orderE = [
        'E1', 'E5', 'E9', 'E13',
        'E2', 'E6', 'E10', 'E14',
        'E3', 'E7', 'E11', 'E15',
        'E4', 'E8', 'E12', 'E16'
    ];
    for (const key of orderE) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 4. Ряд F — СТРОГО ТВОЙ ВЕЕРНЫЙ ПОРЯДОК ПО 4 ЯЧЕЙКИ ЗА КРУГ
    const orderF = [
        // 1-й круг (Первые ячейки блоков)
        'F1', 'F9', 'F17', 'F25',
        // 2-й круг (Вторые ячейки блоков)
        'F2', 'F10', 'F18', 'F26',
        // 3-й круг (Третьи ячейки блоков)
        'F3', 'F11', 'F19', 'F27',
        // 4-й круг (Четвертые ячейки блоков)
        'F4', 'F12', 'F20', 'F28',
        
        // Оставшиеся "хвосты" блоков
        'F5', 'F13', 'F21', 'F29',
        'F6', 'F14', 'F22', 'F30',
        'F7', 'F15', 'F23', 'F31',
        'F8', 'F16', 'F24', 'F32'
    ];
    for (const key of orderF) {
        if (tree[key] && !tree[key].user) return key;
    }

    return null;
}

function checkAndGenerateChildren(tree) {
    if (tree['C4'] && tree['C4'].user && !tree['D1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `D${i}`;
            tree[id] = { id, level: 'D', user: null, color: 'gray' };
        }
    }
    if (tree['D4'] && tree['D4'].user && !tree['E1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
    }
    if (tree['D8'] && tree['D8'].user && !tree['E9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
    }

    // Триггеры ряда F
    if (tree['E4'] && tree['E4'].user && !tree['F1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
    if (tree['E8'] && tree['E8'].user && !tree['F9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
    if (tree['E12'] && tree['E12'].user && !tree['F17']) {
        for (let i = 17; i <= 24; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
    if (tree['E16'] && tree['E16'].user && !tree['F25']) {
        for (let i = 25; i <= 32; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
}

app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });

    const cellId = findNextEmptyCell(treeDB);
    if (!cellId) return res.status(400).json({ error: 'Нет свободных мест' });

    treeDB[cellId].user = username;
    checkAndGenerateChildren(treeDB);

    res.json({ success: true, cellId, user: username });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    res.json({ success: true });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
