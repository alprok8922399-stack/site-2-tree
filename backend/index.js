const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// База данных покупателей интернет-магазина (Логин -> Данные)
let shopUsersDB = {
    'SYSTEM_ROOT': { username: 'SYSTEM_ROOT', isPaid: true, balance: 0, referrer: null },
    'LEADER_1': { username: 'LEADER_1', isPaid: true, balance: 0, referrer: 'SYSTEM_ROOT' },
    'LEADER_2': { username: 'LEADER_2', isPaid: true, balance: 0, referrer: 'SYSTEM_ROOT' }
};

// Глобальная секретная структура матрицы (индексы ячеек от 1 до бесконечности)
// Храним в плоском виде: { 1: 'SYSTEM_ROOT', 2: 'LEADER_1', 3: 'LEADER_2' }
// Ряд A = 1
// Ряд B = 2, 3
// Ряд C = 4, 5, 6, 7
// Ряд D = 8..15
// Ряд E = 16..31
// Ряд F = 32..63
let treeDB = {
    1: { id: 1, label: 'A1', level: 'A', user: 'SYSTEM_ROOT' },
    2: { id: 2, label: 'B1', level: 'B', user: 'LEADER_1' },
    3: { id: 3, label: 'B2', level: 'B', user: 'LEADER_2' }
};

// Журнал бухгалтерских Ledger-проводок
let financialLedger = [];

// Вспомогательная функция определения имени ряда и порядкового номера в ряду по индексу
function getCellMeta(index) {
    const row = Math.floor(Math.log2(index));
    const letter = String.fromCharCode(65 + row); // 65 - это 'A' в ASCII
    const startIdx = Math.pow(2, row);
    const numInRow = index - startIdx + 1;
    return { level: letter, label: `${letter}${numInRow}` };
}

// Умный веерный алгоритм поиска следующей ячейки по Закону Четырёх
function findNextEmptyCellIndex() {
    let checkIndex = 4; // Начинаем поиск с ряда C (индекс 4)
    
    while (true) {
        const meta = getCellMeta(checkIndex);
        const row = Math.floor(Math.log2(checkIndex));
        const countInRow = Math.pow(2, row);
        
        // Ряды A, B, C заполняются по порядку (1, 2, 4 ячейки)
        if (row <= 2) {
            if (!treeDB[checkIndex] || !treeDB[checkIndex].user) {
                return checkIndex;
            }
            checkIndex++;
            continue;
        }

        // Ряд D (индекс 8-15) идет прыжками под лидеров ряда B
        if (row === 3) {
            const dOrder = [8, 12, 9, 13, 10, 14, 11, 15];
            for (let idx of dOrder) {
                if (!treeDB[idx] || !treeDB[idx].user) return idx;
            }
            checkIndex = 16; // Если весь D закрыт, прыгаем на E
            continue;
        }

        // Для всех рядов ниже E, F, G... до бесконечности применяем циклическую веерную формулу четверками
        // Нам нужно пройти по всем первым ячейкам каждого сектора, потом по вторым и т.д.
        const startRowIndex = countInRow;
        
        for (let step = 0; step < 4; step++) {
            for (let i = 0; i < countInRow; i += 4) {
                const targetIdx = startRowIndex + i + step;
                if (!treeDB[targetIdx] || !treeDB[targetIdx].user) {
                    return targetIdx;
                }
            }
        }
        
        // Если весь текущий ряд заполнился, переходим на индекс начала следующего ряда
        checkIndex = startRowIndex + countInRow;
    }
}

// Функция начисления денег по «Модели 1-2-4» (3 уровня бухгалтерии)
function processMatrixPayout(newCellIndex, amount) {
    // Выплата идет тому, кто стоит на 2 уровня выше в локальном треугольнике
    // В бинарном дереве родитель ячейки N равен Math.floor(N / 2)
    // Соответственно, вершина локальной семерки — это Math.floor(Math.floor(newCellIndex / 2) / 2) = Math.floor(newCellIndex / 4)
    const targetVertexIndex = Math.floor(newCellIndex / 4);
    
    if (targetVertexIndex >= 1 && treeDB[targetVertexIndex]) {
        const vertexUser = treeDB[targetVertexIndex].user;
        if (vertexUser && shopUsersDB[vertexUser]) {
            const payoutAmount = amount * 0.5; // 50% от суммы оплаты идет на выплату вершине
            
            // Начисляем баланс в базу
            shopUsersDB[vertexUser].balance += payoutAmount;
            
            // Записываем строгую транзакцию в бухгалтерский Ledger-лог
            financialLedger.push({
                timestamp: new Date().toISOString(),
                cellIndex: newCellIndex,
                cellLabel: getCellMeta(newCellIndex).label,
                payoutTo: vertexUser,
                vertexCell: getCellMeta(targetVertexIndex).label,
                amount: payoutAmount
            });
            
            console.log(`[LEDGER] Бухгалтерия: Ячейка ${getCellMeta(newCellIndex).label} закрылась. Выплата ${payoutAmount} руб начислена на вершину ${getCellMeta(targetVertexIndex).label} пользователю ${vertexUser}`);
        }
    }
}

// ==========================================
// ЭНДПОИНТЫ ДЛЯ МАРКЕТПЛЕЙСА (ПЕРВЫЙ САЙТ)
// ==========================================

// 1. Регистрация покупателя (с привязкой реферала)
app.post('/api/shop/register', (req, res) => {
    const { username, ref } = req.body;
    if (!username) return res.status(400).json({ error: 'Имя пользователя обязательно' });
    
    if (shopUsersDB[username]) {
        return res.status(400).json({ error: 'Пользователь уже зарегистрирован' });
    }
    
    // Проверяем существование пригласителя, иначе пишем SYSTEM_ROOT
    let referrerUser = 'SYSTEM_ROOT';
    if (ref && shopUsersDB[ref]) {
        referrerUser = ref;
    }
    
    shopUsersDB[username] = {
        username: username,
        isPaid: false,
        balance: 0,
        referrer: referrerUser // Жесткая фиксация спонсора в БД
    };
    
    res.json({ success: true, message: 'Покупатель успешно зарегистрирован', user: shopUsersDB[username] });
});

// 2. Оплата товара и автоматическая посадка в скрытую матрицу
app.post('/api/shop/pay', (req, res) => {
    const { username, amount } = req.body;
    if (!username || !amount) return res.status(400).json({ error: 'Не указан логин или сумма' });
    
    const user = shopUsersDB[username];
    if (!user) return res.status(404).json({ error: 'Покупатель не найден' });
    if (user.isPaid) return res.status(400).json({ error: 'Заказ уже оплачен' });
    
    user.isPaid = true;
    
    // Вычисляем следующую пустую ячейку по нашему веерному алгоритму
    const nextIdx = findNextEmptyCellIndex();
    const meta = getCellMeta(nextIdx);
    
    // Сохраняем пользователя в ячейку матрицы
    treeDB[nextIdx] = {
        id: nextIdx,
        label: meta.label,
        level: meta.level,
        user: username
    };
    
    // Запускаем транзакционный расчет выплаты по «Модели 1-2-4»
    processMatrixPayout(nextIdx, amount);
    
    console.log(`[MATRIX] Юзер ${username} оплатил товар. Встал в ячейку ${meta.label} (Индекс: ${nextIdx})`);
    
    res.json({ 
        success: true, 
        message: 'Оплата обработана, матрица обновлена', 
        cellLabel: meta.label,
        shopUserStatus: user
    });
});

// ==========================================
// ЭНДПОИНТЫ ДЛЯ СЕКРЕТНОЙ АДМИНКИ (ВТОРОЙ САЙТ)
// ==========================================

// Отдаем всю матрицу в плоском формате
app.get('/api/tree', (req, res) => {
    res.json(treeDB);
});

// Отдаем данные пользователей и их реферальные связи
app.get('/api/users', (req, res) => {
    res.json(shopUsersDB);
});

// Отдаем лог бухгалтерских проводок
app.get('/api/ledger', (req, res) => {
    res.json(financialLedger);
});

// Полный сброс всей системы в начальное состояние
app.post('/api/reset', (req, res) => {
    treeDB = {
        1: { id: 1, label: 'A1', level: 'A', user: 'SYSTEM_ROOT' },
        2: { id: 2, label: 'B1', level: 'B', user: 'LEADER_1' },
        3: { id: 3, label: 'B2', level: 'B', user: 'LEADER_2' }
    };
    shopUsersDB = {
        'SYSTEM_ROOT': { username: 'SYSTEM_ROOT', isPaid: true, balance: 0, referrer: null },
        'LEADER_1': { username: 'LEADER_1', isPaid: true, balance: 0, referrer: 'SYSTEM_ROOT' },
        'LEADER_2': { username: 'LEADER_2', isPaid: true, balance: 0, referrer: 'SYSTEM_ROOT' }
    };
    financialLedger = [];
    res.json({ success: true, message: 'Система полностью очищена' });
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
