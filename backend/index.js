const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Начальное состояние с «железным занавесом» для красоты
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

// Вспомогательная функция для генерации букв рядов по алфавиту (A, B... Z, AA, AB...)
function getNextLevelLetter(letter) {
    let i = letter.length - 1;
    let chars = letter.split('');
    while (i >= 0) {
        if (chars[i] !== 'Z') {
            chars[i] = String.fromCharCode(chars[i].charCodeAt(0) + 1);
            for (let j = i + 1; j < chars.length; j++) chars[j] = 'A';
            return chars.join('');
        }
        i--;
    }
    return 'A'.repeat(letter.length + 1);
}

// Функция для динамического создания следующего ряда в памяти, если он ещё не создан
function ensureRowExists(tree, letter) {
    // Вычисляем количество ячеек в зависимости от буквы ряда относительно ряда C (4 ячейки)
    // Ряд C=4, D=8, E=16, F=32, G=64... Каждая следующая буква удваивает объем
    // Чтобы узнать количество шагов удвоения, посчитаем расстояние от 'C'
    let current = 'C';
    let count = 4;
    while (current !== letter) {
        current = getNextLevelLetter(current);
        count *= 2;
        // Защита от бесконечного цикла, если передана неверная буква
        if (count > 1000000) break;
    }

    // Если первая ячейка этого ряда отсутствует — генерируем весь ряд пустым
    if (!tree[`${letter}1`]) {
        for (let i = 1; i <= count; i++) {
            const id = `${letter}${i}`;
            tree[id] = { id, level: letter, user: null };
        }
    }
}

// Глобальный Умный Поиск следующей пустой ячейки БЕЗ ЛИМИТОВ
function findNextEmptyCell(tree) {
    // 1. Уровень C строго слева направо
    for (let i = 1; i <= 4; i++) {
        if (!tree[`C${i}`].user) return `C${i}`;
    }

    // 2. Уровень D строго шахматами
    ensureRowExists(tree, 'D');
    const orderD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const key of orderD) {
        if (tree[key] && !tree[key].user) return key;
    }

    // 3. Бесконечный цикл по всем последующим рядам (E, F, G, H, J, K...)
    let currentLetter = 'E';
    while (true) {
        ensureRowExists(tree, currentLetter);

        // Определяем общее количество ячеек в текущем ряду
        let cellCount = 4;
        let testLetter = 'C';
        while (testLetter !== currentLetter) {
            testLetter = getNextLevelLetter(testLetter);
            cellCount *= 2;
        }

        // Обход ряда по кругам (четверками)
        // 1-й круг: 1, 5, 9, 13...
        // 2-й круг: 2, 6, 10, 14...
        // 3-й круг: 3, 7, 11, 15...
        // 4-й круг: 4, 8, 12, 16...
        for (let circle = 1; circle <= 4; circle++) {
            for (let i = circle; i <= cellCount; i += 4) {
                const key = `${currentLetter}${i}`;
                if (tree[key] && !tree[key].user) {
                    return key; // Нашли свободное место в текущем круге
                }
            }
        }

        // Если весь текущий ряд полностью заполнен, переходим к следующей букве ряда
        currentLetter = getNextLevelLetter(currentLetter);
        
        // Пропускаем букву 'I', чтобы не путать с единицей, если это требуется по стандарту матриц
        if (currentLetter === 'I') {
            currentLetter = 'J';
        }
    }
}

// ЭНДПОИНТЫ API
app.get('/api/tree', (req, res) => res.json(treeDB));

// Регистрация + автоматическое распределение по бесконечной структуре
app.post('/api/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя обязательно' });

    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = username;

    res.json({ success: true, cellId, user: username });
});

// Имитация оплаты (для связки с Маркетплейсом)
app.post('/api/shop/pay', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Логин не указан' });

    // Находим пустую ячейку и ставим туда человека
    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = username;

    console.log(`[БЭКЕНД СТРУКТУРЫ] Транзакция 10 000 руб. Участник ${username} успешно занял ячейку ${cellId}. 5 000 руб отправлено на системный баланс.`);

    res.json({ success: true, cellId, user: username });
});

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Ядро структуры (Сайт 2) запущено на порту ${PORT}`));
