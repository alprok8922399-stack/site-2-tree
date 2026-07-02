const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 5000;
const FILE_PATH = path.join(__dirname, 'tree.json');

// Включаем CORS, чтобы Сайт №1 мог слать нам запросы по сети
app.use(cors());
app.use(express.json());

// Структура дерева по умолчанию (начальное состояние)
const initialTree = {
    "A1": { id: "A1", user: null, level: "A", status: "open" },
    "B1": { id: "B1", user: null, level: "B", status: "open" },
    "B2": { id: "B2", user: null, level: "B", status: "open" },
    "C1": { id: "C1", user: null, level: "C", status: "open" },
    "C2": { id: "C2", user: null, level: "C", status: "open" },
    "C3": { id: "C3", user: null, level: "C", status: "open" },
    "C4": { id: "C4", user: null, level: "C", status: "open" }
};

// Функция загрузки дерева из файла tree.json
function loadTree() {
    try {
        if (fs.existsSync(FILE_PATH)) {
            const data = fs.readFileSync(FILE_PATH, 'utf8');
            return JSON.parse(data);
        }
    } catch (e) {
        console.error("Ошибка чтения файла дерева, создаем заново:", e);
    }
    return JSON.parse(JSON.stringify(initialTree));
}

// Функция保存ения дерева в файл tree.json
function saveTree(tree) {
    try {
        fs.writeFileSync(FILE_PATH, JSON.stringify(tree, null, 2), 'utf8');
    } catch (e) {
        console.error("Не удалось сохранить дерево в файл:", e);
    }
}

// Поиск первой свободной открытой ячейки через СТЭК (без рекурсии)
function findEmptyCell(tree) {
    // Порядок проверки ячеек (от верхних уровней к нижним)
    const priority = ["A1", "B1", "B2", "C1", "C2", "C3", "C4"];
    
    // Если открыт уровень D, добавляем его в приоритет поиска
    for (let i = 1; i <= 8; i++) {
        if (tree[`D${i}`]) {
            priority.push(`D${i}`);
        }
    }

    // Ищем перебором массива (стек-логика)
    for (const cellId of priority) {
        if (tree[cellId] && tree[cellId].user === null && tree[cellId].status === "open") {
            return cellId;
        }
    }
    return null;
}

// Проверка «Правила четырёх» для автоматического открытия уровня D
function checkAndOpenLevelD(tree) {
    // Проверяем, заполнена ли вся четвёрка на уровне C
    const isC1Full = tree["C1"] && tree["C1"].user !== null;
    const isC2Full = tree["C2"] && tree["C2"].user !== null;
    const isC3Full = tree["C3"] && tree["C3"].user !== null;
    const isC4Full = tree["C4"] && tree["C4"].user !== null;

    if (isC1Full && isC2Full && isC3Full && isC4Full) {
        // Если заполнена вся четвёрка, а восьмёрок (уровня D) ещё нет — создаём их!
        if (!tree["D1"]) {
            console.log("🔥 'Правило четырёх' сработало! Открываем 'восьмёрки' (уровень D)...");
            for (let i = 1; i <= 8; i++) {
                tree[`D${i}`] = { id: `D${i}`, user: null, level: "D", status: "open" };
            }
        }
    }
}

// API-эндпоинт для регистрации нового пользователя
app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) {
        return res.status(400).json({ message: "Имя пользователя обязательно" });
    }

    let tree = loadTree();
    
    // Находим свободную ячейку
    const targetCell = findEmptyCell(tree);

    if (!targetCell) {
        return res.status(400).json({ message: "Нет свободных мест в структуре!" });
    }

    // Записываем пользователя в ячейку
    tree[targetCell].user = username;
    console.log(`👤 Пользователь ${username} успешно зарегистрирован в ячейку ${targetCell}`);

    // Проверяем, не пора ли открыть уровень D по Правилу четырёх
    checkAndOpenLevelD(tree);

    // Сохраняем обновленное состояние в базу данных (файл)
    saveTree(tree);

    res.json({
        message: "Регистрация успешна",
        cell: targetCell,
        user: username
    });
});

// API-эндпоинт получения текущего дерева (для фронтенда админа)
app.get('/api/tree', (req, res) => {
    const tree = loadTree();
    res.json(tree);
});

// Сброс дерева в начальное состояние (для тестов)
app.post('/api/reset', (req, res) => {
    saveTree(initialTree);
    res.json({ message: "Дерево успешно сброшено в начальное состояние" });
});

// Говорим серверу отдавать статические файлы (HTML, CSS, JS) из папки frontend
app.use(express.static(path.join(__dirname, '../frontend')));

// При заходе на главный URL — отдаем наш index.html для админки
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => {
    console.log(`Сервер структуры (БД дерева) запущен на порту ${PORT}`);
});
