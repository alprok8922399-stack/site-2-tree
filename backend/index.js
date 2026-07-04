const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Список уровней по буквам
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

// Динамическая генерация порядка заполнения для любого ряда
function getOrderForLevel(levelName) {
    const levelIdx = LEVELS.indexOf(levelName);
    if (levelIdx === -1) return [];
    
    // Количество ячеек в этом ряду (2 в степени уровня)
    const count = Math.pow(2, levelIdx);
    
    if (levelName === 'A' || levelName === 'B' || levelName === 'C') {
        return Array.from({ length: count }, (_, i) => `${levelName}${i + 1}`);
    }
    
    if (levelName === 'D') {
        // Шахматный порядок для D
        return ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    }
    
    // Для всех рядов от E до Z — автоматический круговой обход (1-е места в четверках, 2-е...)
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
    // Бежим по всем буквам алфавита по очереди
    for (const lvl of LEVELS) {
        const order = getOrderForLevel(lvl);
        
        // Проверяем, сгенерирован ли этот ряд в базе
        const hasAnyCell = order.some(key => tree[key]);
        if (!hasAnyCell) {
            // Если этого ряда еще нет в базе, значит мы дошли до текущего края дерева
            // Возвращаем первую ячейку этого нового ряда
            return order[0] || null;
        }
        
        // Если ряд существует, ищем в нем свободное место по правильному порядку
        for (const key of order) {
            if (tree[key] && !tree[key].user) {
                return key;
            }
        }
    }
    return null;
}

// Автоматическое открытие следующего ряда, если в текущем заняли хотя бы одну ячейку
function checkAndGenerateChildren(tree, lastCellId) {
    if (!lastCellId) return;
    const currentLvl = lastCellId.charAt(0);
    const currentIdx = LEVELS.indexOf(currentLvl);
    
    // Определяем следующую букву
    const nextLvl = LEVELS[currentIdx + 1];
    if (!nextLvl) return; // Конец алфавита
    
    const nextCount = Math.pow(2, currentIdx + 1);
    
    // Превентивно создаем следующий ряд целиком, чтобы робот никогда не спотыкался об undefined
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
    
    if (!cellId) return res.status(400).json({ error: 'Достигнут лимит структуры Z' });
    
    // На случай, если ячейка нашлась, но ее физически забыли создать в базе
    if (!treeDB[cellId]) {
        treeDB[cellId] = { id: cellId, level: cellId.charAt(0), user: null };
    }
    
    treeDB[cellId].user = username;
    
    // Передаем заполненную ячейку, чтобы бэкенд наперед открыл следующий уровень
    checkAndGenerateChildren(treeDB, cellId);
    
    res.json({ success: true, cellId, user: username });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
