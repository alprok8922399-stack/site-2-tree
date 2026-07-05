const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

const LEVELS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

// База данных покупателей интернет-магазина (Логин -> Данные)
let shopUsersDB = {
    'SYSTEM_ROOT': { username: 'SYSTEM_ROOT', isPaid: true, balance: 0 },
    'LEADER_1': { username: 'LEADER_1', isPaid: true, balance: 0 },
    'LEADER_2': { username: 'LEADER_2', isPaid: true, balance: 0 }
};

// Глобальная секретная структура матрицы
function createInitialTree() {
    return {
        'A1': { id: 'A1', level: 'A', user: 'SYSTEM_ROOT' },
        'B1': { id: 'B1', level: 'B', user: 'LEADER_1' },
        'B2': { id: 'B2', level: 'B', user: 'LEADER_2' }
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
        const hasAnyCell = order.some(key => tree[key]);
        if (!hasAnyCell) {
            return order[0] || null;
        }
        
        for (const key of order) {
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

// ==========================================
// ЭНДПОИНТЫ ДЛЯ МАРКЕТПЛЕЙСА (ПЕРВЫЙ САЙТ)
// ==========================================

// 1. Обычная регистрация покупателя на сайте (БЕЗ попадания в матрицу)
app.post('/api/shop/register', (req, res) => {
    const { username } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    if (shopUsersDB[username]) {
        return res.status(400).json({ error: 'Пользователь уже зарегистрирован в магазине' });
    }
    
    // Создаем профиль обычного покупателя
    shopUsersDB[username] = {
        username: username,
        isPaid: false,      // Еще не оплатил товар
        balance: 0          // Внутренний баланс
    };
    
    res.json({ success: true, message: 'Покупатель успешно зарегистрирован на маркетплейсе', user: shopUsersDB[username] });
});

// 2. Имитация ОПЛАТЫ товара (Ввод 10 000 рублей, Сплитование и ПОСАДКА в матрицу)
app.post('/api/shop/pay', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount) return res.status(400).json({ error: 'Не указан логин или сумма платежа' });
    
    const user = shopUsersDB[username];
    if (!user) return res.status(404).json({ error: 'Покупатель не найден' });
    if (user.isPaid) return res.status(400).json({ error: 'Этот заказ уже оплачен' });
    
    // НАУКА СПЛИТОВАНИЯ (на будущее):
    // В реальности тут идет вызов API ЮKassa/Stripe для разделения платежа
    const marketPlacePart = amount * 0.5; // 50% летит на маркетплейс за товар
    const myWalletPart = amount * 0.5;    // 50% летит в твой кошелек структуры
    
    // Фиксируем оплату в магазине
    user.isPaid = true;
    user.balance += myWalletPart; // Условно отображаем твою долю или кэшбэк
    
    // ЧУДО МАТРИЦЫ: Молча и незаметно для юзера сажаем его в глобальное дерево!
    let cellId = findNextEmptyCell(treeDB);
    if (!cellId) return res.status(500).json({ error: 'Ошибка структуры матрицы' });
    
    const lvl = cellId.replace(/[0-9]/g, '');
    if (!treeDB[cellId]) {
        treeDB[cellId] = { id: cellId, level: lvl, user: null };
    }
    
    treeDB[cellId].user = username;
    generateNextLevelPreemptively(treeDB, lvl);
    
    console.log(`[SPLIT PAYMENT] Юзер ${username} оплатил ${amount} руб. Товар куплен! Матрица молча выделила ячейку ${cellId}`);
    
    res.json({ 
        success: true, 
        message: 'Оплата успешно прошла!', 
        split: { marketplace: marketPlacePart, myWallet: myWalletPart },
        shopUserStatus: user
    });
});


// ==========================================
// ЭНДПОИНТЫ ДЛЯ СЕКРЕТНОЙ АДМИНКИ (ВТОРОЙ САЙТ)
// ==========================================
app.get('/api/tree', (req, res) => res.json(treeDB));

app.post('/api/reset', (req, res) => {
    treeDB = createInitialTree();
    // Оставляем только системных юзеров при сбросе
    shopUsersDB = {
        'SYSTEM_ROOT': { username: 'SYSTEM_ROOT', isPaid: true, balance: 0 },
        'LEADER_1': { username: 'LEADER_1', isPaid: true, balance: 0 },
        'LEADER_2': { username: 'LEADER_2', isPaid: true, balance: 0 }
    };
    res.json({ success: true });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
