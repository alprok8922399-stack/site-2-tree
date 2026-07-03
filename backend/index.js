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

// Универсальная математическая функция бесконечного веерного заполнения
function getNextEmptyCell(tree) {
    let lvlIndex = 2; // Начинаем с уровня C (A=0, B=1, C=2)
    
    while (true) {
        let levelChar = String.fromCharCode(65 + lvlIndex);
        let totalCells = Math.pow(2, lvlIndex); // C=4, D=8, E=16, F=32...
        let numGroups = totalCells / 4; // Количество секторов: C=1, D=2, E=4, F=8...
        let groupSize = 4; // Размер сектора всегда 4

        let levelHasAny = false;

        // Циклический веер по секторам (сначала 1-е места, затем 2-е, 3-е, 4-е)
        for (let pos = 1; pos <= groupSize; pos++) {
            for (let g = 1; g <= numGroups; g++) {
                let cellNum = (g - 1) * groupSize + pos;
                let cellId = `${levelChar}${cellNum}`;

                // Если ячейка существует в базе (значит триггер сверху её уже открыл)
                if (tree[cellId]) {
                    levelHasAny = true;

                    // Защитный барьер: если это 4-я ячейка в секторе и она УЖЕ заполнена
                    if (pos === 4 && tree[cellId].user) {
                        let nextLevelChar = String.fromCharCode(65 + lvlIndex + 1);
                        let startChild = (g - 1) * 8 + 1;
                        let endChild = g * 8; // Рождается 8 ячеек под закрытой четверкой
                        
                        for (let c = startChild; c <= endChild; c++) {
                            let childId = `${nextLevelChar}${c}`;
                            if (!tree[childId]) {
                                tree[childId] = { id: childId, level: nextLevelChar, user: null };
                                console.log(`[TREE LOG] Event: Initialized ${childId} (Triggered by ${cellId})`);
                            }
                        }
                    }

                    // Если ячейка пустая — отдаем её роботу
                    if (!tree[cellId].user) {
                        return cellId;
                    }
                }
            }
        }

        // Если на этом уровне вообще нет созданных ячеек, мы дошли до конца (дна) дерева
        if (!levelHasAny) {
            break;
        }

        lvlIndex++;
        if (lvlIndex > 20) break; // Предохранитель от бесконечного цикла (уровень 20 = больше миллиона ячеек)
    }
    
    return null; // Если всё дерево переполнено
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
        return res.status(400).json({ error: 'Достигнут предел уровней' });
    }

    treeDB[nextCellId].user = username;
    getNextEmptyCell(treeDB); // Актуализируем триггеры барьеров сразу после записи

    res.json({ success: true, cellId: nextCellId, user: username });
});

// API: Сброс базы данных к начальному статичному состоянию
app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    res.json({ success: true, message: 'Дерево сброшено к начальному состоянию' });
});

app.listen(PORT, () => {
    console.log(`Сервер Сайта №2 запущен на порту ${PORT}`);
});        keys.sort((a, b) => parseInt(a.slice(1)) - parseInt(b.slice(1)));
        
        for (const key of keys) {
            if (!tree[key].user) return key;
        }
    }
    return null;
}

// 2. Функция-триггер: проверяет, заполнились ли барьерные ячейки и создает детей
function checkAndGenerateChildren(tree) {
    // Логика: если D4 занят -> создаем E1-E8
    if (tree['D4'] && tree['D4'].user && !tree['E1']) {
        for (let i = 1; i <= 8; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
        console.log("[LOG] Trigger: D4 filled, generated E1-E8");
    }
    // Логика: если D8 занят -> создаем E9-E16
    if (tree['D8'] && tree['D8'].user && !tree['E9']) {
        for (let i = 9; i <= 16; i++) {
            const id = `E${i}`;
            tree[id] = { id, level: 'E', user: null, color: 'gray' };
        }
        console.log("[LOG] Trigger: D8 filled, generated E9-E16");
    }
    // Можно добавить сюда же логику для более глубоких уровней (например, если F заняты...)
}

app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });

    const cellId = findNextEmptyCell(treeDB);
    if (!cellId) return res.status(400).json({ error: 'Предел уровней' });

    // Занимаем ячейку
    treeDB[cellId].user = username;

    // После того как заняли — проверяем, не сработал ли триггер создания новых ячеек
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
