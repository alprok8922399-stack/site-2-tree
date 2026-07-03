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

// Функция поиска пустой ячейки с учетом твоего шахматного порядка для ряда D
function findNextEmptyCell(tree) {
    // 1. Проверяем уровни A, B, C по порядку
    const standardLevels = ['A', 'B', 'C'];
    for (const lvl of standardLevels) {
        const keys = Object.keys(tree).filter(k => k.startsWith(lvl));
        keys.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        for (const key of keys) {
            if (!tree[key].user) return key;
        }
    }

    // 2. Если очередь дошла до D, идем строго по твоему порядку: D1, D5, D2, D6, D3, D7, D4, D8
    const orderD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const key of orderD) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 3. Для ряда E идем по порядку E1-E16 (если они созданы триггерами)
    const keysE = Object.keys(tree).filter(k => k.startsWith('E'));
    keysE.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
    for (const key of keysE) {
        if (!tree[key].user) return key;
    }

    return null;
}

// Функция-триггер: открывает ряды по твоим условиям
function checkAndGenerateChildren(tree) {
    // ТРИГГЕР 1: Заполнилась ячейка C4 -> Появляется весь ряд D
    if (tree['C4'] && tree['C4'].user && !tree['D1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `D${i}`;
            tree[id] = { id, level: 'D', user: null, color: 'gray' };
        }
        console.log("[LOG] C4 filled! Whole row D generated.");
    }

    // ТРИГГЕР 2: Заполнилась ячейка D4 -> Появляются 8 пустых ячеек E1-E8
    if (tree['D4'] && tree['D4'].user && !tree['E1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
        console.log("[LOG] D4 filled! E1-E8 generated.");
    }

    // ТРИГГЕР 3: Заполнилась ячейка D8 -> Появляются еще 8 ячеек E9-E16
    if (tree['D8'] && tree['D8'].user && !tree['E9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
        console.log("[LOG] D8 filled! E9-E16 generated.");
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
    
    // Проверяем условия появления новых рядов сразу после записи юзера
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
