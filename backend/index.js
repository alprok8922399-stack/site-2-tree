const express = require('express');
const cors = require('cors'); // Подключаем модуль CORS для разблокировки запросов
const app = express();
const PORT = process.env.PORT || 10000;

// Разрешаем абсолютно всем внешним адресам (включая твой телефон) запрашивать данные
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Временное хранилище дерева в оперативной памяти сервера
let treeStorage = {
    "A1": { id: "A1", user: "Admin", parentId: null }
};

// Хелпер для разбора имени ячейки (например, "A1" -> { letter: "A", num: 1 })
function parseCellId(id) {
    const match = id.match(/^([A-Z]+)(\d+)$/);
    if (!match) return null;
    return { letter: match[1], num: parseInt(match[2], 10) };
}

// Главная страница (чтобы не было ошибки Cannot GET /)
app.get('/', (req, res) => {
    res.send('<h1>Сервер дерева успешно запущен и работает!</h1><p>Ожидаю запросы от фронтенда...</p>');
});

// Эндпоинт 1: Получение всей структуры дерева для отрисовки матриц
app.get('/api/tree', (req, res) => {
    res.json(treeStorage);
});

// Эндпоинт 2: Сброс базы данных в начальное состояние
app.post('/api/reset', (req, res) => {
    treeStorage = {
        "A1": { id: "A1", user: "Admin", parentId: null }
    };
    res.json({ success: true, message: "Дерево успешно сброшено" });
});

// Эндпоинт 3: Получение детальной информации о пользователе и его личниках
app.get('/api/user-details/:username', (req, res) => {
    const targetUser = req.params.username;
    
    // 1. Находим все ячейки, которые занял этот пользователь
    let userCells = [];
    for (const [id, cell] of Object.entries(treeStorage)) {
        if (cell && cell.user && cell.user.toLowerCase() === targetUser.toLowerCase()) {
            userCells.push(id);
        }
    }

    if (userCells.length === 0) {
        return res.json({ 
            success: false, 
            error: `Пользователь ${targetUser} не найден в базе данных.` 
        });
    }

    // 2. Ищем его прямого спонсора (родителя для его самой первой/главной ячейки)
    // Сортируем ячейки по длине букв и номеру, чтобы найти самую раннюю
    userCells.sort((a, b) => {
        const pA = parseCellId(a);
        const pB = parseCellId(b);
        if (pA.letter.length !== pB.letter.length) {
            return pA.letter.length - pB.letter.length;
        }
        if (pA.letter !== pB.letter) {
            return pA.letter.localeCompare(pB.letter);
        }
        return pA.num - pB.num;
    });

    const primaryCellId = userCells[0];
    const primaryCell = treeStorage[primaryCellId];
    let sponsorName = "Нет спонсора (Корневой аккаунт)";
    
    if (primaryCell && primaryCell.parentId) {
        const parentCell = treeStorage[primaryCell.parentId];
        if (parentCell && parentCell.user) {
            sponsorName = parentCell.user;
        }
    }

    // 3. Строим цепочку спонсоров вверх ("Кто-за-кем")
    let chain = [];
    let currentId = primaryCellId;
    while (currentId) {
        const cCell = treeStorage[currentId];
        if (cCell && cCell.user) {
            chain.push(`${cCell.user} (${cCell.id})`);
            currentId = cCell.parentId;
        } else {
            break;
        }
    }
    // Разворачиваем, чтобы было от корня к пользователю
    chain.reverse();

    // 4. Находим всех его личников (приглашенных рефералов)
    let referralsSet = new Set();
    for (const [id, cell] of Object.entries(treeStorage)) {
        if (cell && cell.parentId && cell.user) {
            const parentCell = treeStorage[cell.parentId];
            if (parentCell && parentCell.user && parentCell.user.toLowerCase() === targetUser.toLowerCase()) {
                if (cell.user.toLowerCase() !== targetUser.toLowerCase()) {
                    referralsSet.add(cell.user);
                }
            }
        }
    }

    res.json({
        success: true,
        username: targetUser,
        cells: userCells,
        sponsor: sponsorName,
        chain: chain,
        referrals: Array.from(referralsSet)
    });
});

// Эндпоинт 4: Регистрация нового пользователя (для связи с Первым сайтом)
app.post('/api/register', (req, res) => {
    const { username, parentCellId } = req.body;

    if (!username || !parentCellId) {
        return res.status(400).json({ success: false, error: "Не указан username или parentCellId" });
    }

    let queue = [parentCellId];
    let targetCellId = null;

    while (queue.length > 0) {
        const currentId = queue.shift();
        const cell = treeStorage[currentId];

        if (!cell || !cell.user) {
            targetCellId = currentId;
            break;
        }

        const parsed = parseCellId(currentId);
        if (!parsed) continue;

        let i = parsed.letter.length - 1;
        let nextLetter = "";
        while (i >= 0) {
            if (parsed.letter[i] !== 'Z') {
                nextLetter = parsed.letter.substring(0, i) + String.fromCharCode(parsed.letter.charCodeAt(i) + 1) + 'A'.repeat(parsed.letter.length - 1 - i);
                break;
            }
            i--;
        }
        if (!nextLetter) nextLetter = 'A'.repeat(parsed.letter.length + 1);

        const leftChildId = `${nextLetter}${parsed.num * 2 - 1}`;
        const rightChildId = `${nextLetter}${parsed.num * 2}`;

        queue.push(leftChildId);
        queue.push(rightChildId);
    }

    if (!targetCellId) {
        return res.json({ success: false, error: "Не удалось найти свободное место в дереве" });
    }

    const parsedTarget = parseCellId(targetCellId);
    
    let calculatedParentId = null;
    if (targetCellId !== "A1") {
        let prevLetter = "";
        let k = parsedTarget.letter.length - 1;
        while (k >= 0) {
            if (parsedTarget.letter[k] !== 'A') {
                prevLetter = parsedTarget.letter.substring(0, k) + String.fromCharCode(parsedTarget.letter.charCodeAt(k) - 1) + 'Z'.repeat(parsedTarget.letter.length - 1 - k);
                break;
            }
            k--;
        }
        if (!prevLetter && parsedTarget.letter.length > 1) {
            prevLetter = 'Z'.repeat(parsedTarget.letter.length - 1);
        } else if (!prevLetter) {
            prevLetter = 'A';
        }
        
        calculatedParentId = `${prevLetter}${Math.floor((parsedTarget.num + 1) / 2)}`;
    }

    treeStorage[targetCellId] = {
        id: targetCellId,
        user: username,
        parentId: calculatedParentId
    };

    res.json({
        success: true,
        message: `Пользователь ${username} успешно зарегистрирован в ячейку ${targetCellId}`,
        cellId: targetCellId
    });
});

app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});
