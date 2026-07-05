const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 10000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

let treeDB = createInitialTree();
let isRobotActive = false; // Статус робота

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

// --- НОВЫЕ РОУТЫ ДЛЯ ОБЩЕНИЯ С САЙТОМ №1 ---

app.get('/api/robot/status', (req, res) => {
    res.json({ active: isRobotActive });
});

app.post('/api/robot/start', (req, res) => {
    isRobotActive = true;
    console.log("Робот ЗАПУЩЕН");
    res.json({ success: true });
});

app.post('/api/robot/stop', (req, res) => {
    isRobotActive = false;
    console.log("Робот ОСТАНОВЛЕН");
    res.json({ success: true });
});

// --- СТАРЫЕ ФУНКЦИИ ---

app.get('/api/tree', (req, res) => res.json(treeDB));

app.post('/api/shop/pay', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин отсутствует' });
    // Тут твоя логика поиска ячейки...
    res.json({ success: true, user: username }); 
});

app.post('/api/reset', (req, res) => { 
    treeDB = createInitialTree(); 
    isRobotActive = false;
    res.json({ success: true }); 
});

app.listen(PORT, '0.0.0.0', () => console.log(`Ядро запущено на порту ${PORT}`));
