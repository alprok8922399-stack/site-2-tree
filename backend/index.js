const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

const LEVELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

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

function getOrderForLevel(levelName) {
    const levelIdx = LEVELS.indexOf(levelName);
    if (levelIdx === -1) return [];
    
    const count = Math.pow(2, levelIdx);
    
    if (levelName === 'A' || levelName === 'B' || levelName === 'C') {
        return Array.from({ length: count }, (_, i) => `${levelName}${i + 1}`);
    }
    
    if (levelName === 'D') {
        return ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    }
    
    // Круговой порядок (по 4) для всех уровней от E до Z
    const order = [];
    for (let step = 0; step < 4; step++) {
        for (let i = 1; i <= count; i += 4) {
            if (i + step <= count) {
                order.push(`${levelName}${i + step}`);
            }
        }
    }
    return order;
}

function findNextEmptyCell(tree) {
    for (const lvl of LEVELS) {
        const order = getOrderForLevel(lvl);
        
        // Если этого уровня вообще нет в дереве, значит это край, берём его начало
        const hasAnyCell = order.some(key => tree[key]);
        if (!hasAnyCell) {
            return order[0] || null;
        }
        
        for (const key of order) {
            // Жёсткая защита: если ячейка прописана в порядке, но её забыли создать — создаём на лету
            if (tree[key] === undefined) {
                tree[key] = { id: key, level: lvl, user: null };
            }
            if (!tree[key].user) {
                return key;
            }
        }
    }
    return null;
}

// Убойная превентивная генерация на 1 уровень вперёд
function generateNextLevelPreemptively(tree, currentLvl) {
    const currentIdx = LEVELS.indexOf(currentLvl);
    const nextLvl = LEVELS[currentIdx + 1];
    if (!nextLvl) return;
    
    const nextCount = Math.pow(2, currentIdx + 1);
    for (let i = 1; i <= nextCount; i++) {
        const id = `${nextLvl}${i}`;
        if (!tree[id]) {
            tree[id] = { id, level: nextLvl, user: null };
        }
    }
}

app.get('/api/tree', (req, res) => res.json(treeDB));

app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    
    let cellId = findNextEmptyCell(treeDB);
    if (!cellId) return res.status(400).json({ error: 'Достигнут лимит структуры' });
    
    // Перед записью гарантируем, что узел существует
    const lvl = cellId.replace(/[0-9]/g, '');
    if (!treeDB[cellId]) {
        treeDB[cellId] = { id: cellId, level: lvl, user: null };
    }
    
    treeDB[cellId].user = username;
    
    // Генерируем ячейки СЛЕДУЮЩЕГО уровня наперёд, чтобы при круговом обходе робот не поймал undefined
    generateNextLevelPreemptively(treeDB, lvl);
    
    res.json({ success: true, cellId, user: username });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
