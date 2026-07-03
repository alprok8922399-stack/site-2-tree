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

// Функция поиска пустой ячейки с учетом твоих шахматных порядков
function findNextEmptyCell(tree) {
    // 1. Уровни A, B, C по порядку
    const standardLevels = ['A', 'B', 'C'];
    for (const lvl of standardLevels) {
        const keys = Object.keys(tree).filter(k => k.startsWith(lvl));
        keys.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        for (const key of keys) {
            if (!tree[key].user) return key;
        }
    }

    // 2. Ряд D строго по твоему порядку: D1, D5, D2, D6, D3, D7, D4, D8
    const orderD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const key of orderD) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 3. Ряд E строго по новому шахматному порядку
    const orderE = [
        'E1', 'E5', 'E9', 'E13',
        'E2', 'E6', 'E10', 'E14',
        'E3', 'E7', 'E11', 'E15',
        'E4', 'E8', 'E12', 'E16'
    ];
    for (const key of orderE) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 4. Ряд F по порядку F1-F32 (если они созданы триггерами)
    const keysF = Object.keys(tree).filter(k => k.startsWith('F'));
    keysF.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    for (const key of keysF) {
        if (!tree[key].user) return key;
    }

    return null;
}

// Функция-триггер: создание дочерних рядов
function checkAndGenerateChildren(tree) {
    // Заполнилась ячейка C4 -> Появляется весь ряд D
    if (tree['C4'] && tree['C4'].user && !tree['D1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `D${i}`;
            tree[id] = { id, level: 'D', user: null, color: 'gray' };
        }
    }

    // Заполнилась ячейка D4 -> Появляются пустые ячейки E1-E8 под D1-D4
    if (tree['D4'] && tree['D4'].user && !tree['E1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
    }

    // Заполнилась ячейка D8 -> Появляются пустые ячейки E9-E16 под D5-D8
    if (tree['D8'] && tree['D8'].user && !tree['E9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
    }

    // --- ТРИГГЕРЫ ДЛЯ РЯДА F ---
    // Закрылась E4 -> появляются F1-F8
    if (tree['E4'] && tree['E4'].user && !tree['F1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
    // Закрылась E8 -> появляются F9-F16
    if (tree['E8'] && tree['E8'].user && !tree['F9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
    // Закрылась E12 -> появляются F17-F24
    if (tree['E12'] && tree['E12'].user && !tree['F17']) {
        for (let i = 17; i <= 24; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null, color: 'gray' };
        }
    }
    // Закрылась E16 -> появляются F25-F32
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
    if (!cellId) return res.status(400).json({ error: 'Предел уровней или нет свободных мест' });

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
