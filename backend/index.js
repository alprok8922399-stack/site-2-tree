const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

function getCellColor(level) {
    if (level === 'A') return 'gold';
    if (level === 'B') return 'blue';
    return 'gray';
}

function createInitialTree() {
    return {
        'A1': { id: 'A1', level: 'A', user: 'SYSTEM_ROOT', color: 'gold' },
        'B1': { id: 'B1', level: 'B', user: 'LEADER_1', color: 'blue' },
        'B2': { id: 'B2', level: 'B', user: 'LEADER_2', color: 'blue' },
        'C1': { id: 'C1', level: 'C', user: null, color: 'gray' },
        'C2': { id: 'C2', level: 'C', user: null, color: 'gray' },
        'C3': { id: 'C3', level: 'C', user: null, color: 'gray' },
        'C4': { id: 'C4', level: 'C', user: null, color: 'gray' },
        // Сразу добавляем пустой ряд D из 8 ячеек, чтобы они были видны на экране
        'D1': { id: 'D1', level: 'D', user: null, color: 'gray' },
        'D2': { id: 'D2', level: 'D', user: null, color: 'gray' },
        'D3': { id: 'D3', level: 'D', user: null, color: 'gray' },
        'D4': { id: 'D4', level: 'D', user: null, color: 'gray' },
        'D5': { id: 'D5', level: 'D', user: null, color: 'gray' },
        'D6': { id: 'D6', level: 'D', user: null, color: 'gray' },
        'D7': { id: 'D7', level: 'D', user: null, color: 'gray' },
        'D8': { id: 'D8', level: 'D', user: null, color: 'gray' }
    };
}

let treeDB = createInitialTree();

function findNextEmptyCell(tree) {
    const levels = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];
    for (const lvl of levels) {
        const keys = Object.keys(tree).filter(k => k.startsWith(lvl));
        keys.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        for (const key of keys) {
            if (!tree[key].user) return key;
        }
    }
    return null;
}

function checkAndGenerateChildren(tree) {
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
}

app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    const cellId = findNextEmptyCell(treeDB);
    if (!cellId) return res.status(400).json({ error: 'Предел уровней' });
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
