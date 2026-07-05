const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

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
let isRobotActive = false;
let robotInterval = null;

function findNextEmptyCell(tree) {
    const orderABC = ['A1', 'B1', 'B2', 'C1', 'C2', 'C3', 'C4'];
    for (const key of orderABC) {
        if (tree[key] && !tree[key].user) return key;
    }

    const orderD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const key of orderD) {
        if (tree[key] && !tree[key].user) return key;
    }

    const orderE = [
        'E1', 'E5', 'E9', 'E13',
        'E2', 'E6', 'E10', 'E14',
        'E3', 'E7', 'E11', 'E15',
        'E4', 'E8', 'E12', 'E16'
    ];
    for (const key of orderE) {
        if (tree[key] && !tree[key].user) return key;
    }

    const orderF = [
        'F1', 'F5', 'F9', 'F13', 'F17', 'F21', 'F25', 'F29',
        'F2', 'F6', 'F10', 'F14', 'F18', 'F22', 'F26', 'F30',
        'F3', 'F7', 'F11', 'F15', 'F19', 'F23', 'F27', 'F31',
        'F4', 'F8', 'F12', 'F16', 'F20', 'F24', 'F28', 'F32'
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
            tree[id] = { id, level: 'D', user: null };
        }
    }
    if (tree['D4'] && tree['D4'].user && !tree['E1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null };
        }
    }
    if (tree['D8'] && tree['D8'].user && !tree['E9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null };
        }
    }

    if (tree['E4'] && tree['E4'].user && !tree['F1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null };
        }
    }
    if (tree['E8'] && tree['E8'].user && !tree['F9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null };
        }
    }
    if (tree['E12'] && tree['E12'].user && !tree['F17']) {
        for (let i = 17; i <= 24; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null };
        }
    }
    if (tree['E16'] && tree['E16'].user && !tree['F25']) {
        for (let i = 25; i <= 32; i++) {
            const id = `F${i}`;
            tree[id] = { id, level: 'F', user: null };
        }
    }
}

function runRobotCycle() {
    if (!isRobotActive) return;

    console.log("Робот: проверка...");
    const cellId = findNextEmptyCell(treeDB);

    if (cellId) {
        const botName = `Bot_${Date.now().toString().slice(-4)}`;
        treeDB[cellId].user = botName;
        checkAndGenerateChildren(treeDB);
        console.log(`Робот успешно занял ячейку: ${cellId} (User: ${botName})`);
    } else {
        console.log("Робот: все ячейки заняты.");
    }
}

app.get('/api/robot/status', (req, res) => {
    res.json({ running: isRobotActive });
});

app.post('/api/robot/start', (req, res) => {
    if (!isRobotActive) {
        isRobotActive = true;
        robotInterval = setInterval(runRobotCycle, 5000);
        console.log("Робот ЗАПУЩЕН");
    }
    res.json({ success: true, message: "Робот активирован" });
});

app.post('/api/robot/stop', (req, res) => {
    isRobotActive = false;
    if (robotInterval) {
        clearInterval(robotInterval);
        robotInterval = null;
    }
    console.log("Робот ОСТАНОВЛЕН");
    res.json({ success: true, message: "Робот остановлен" });
});

app.get('/api/tree', (req, res) => res.json(treeDB));

app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });
    const cellId = findNextEmptyCell(treeDB);
    if (!cellId) return res.status(400).json({ error: 'Все текущие уровни заполнены' });
    treeDB[cellId].user = username;
    checkAndGenerateChildren(treeDB);
    res.json({ success: true, cellId, user: username });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    isRobotActive = false;
    if (robotInterval) {
        clearInterval(robotInterval);
        robotInterval = null;
    }
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
