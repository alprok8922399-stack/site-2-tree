const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ СИСТЕМЫ (В памяти)
// ==========================================
// Массив имитирует идеальное бинарное дерево (двоичную кучу). 
// Индекс 1 — Главный Основатель (Founder).
// Индексы 2-3 — Ряд B, 4-7 — Ряд C, 8-15 — Ряд D и так далее.
let binaryTree = [null]; 
let systemLogs = [];
let totalUsersCount = 0;

// Список имен для симулятора живых регистраций
const mockNames = ['CryptoKing', 'Alpha_Менеджер', 'LuckyStrike', 'Bitcoin_Bro', 'CyberPulse', 'Tesla_Fan', 'Web3_Wanderer', 'Matrix_Neo', 'Rich_Fox', 'Future_Shark', 'Infinity', 'GoldenБосс'];

// Функция отправки сообщений в живой лог
function addLog(message) {
    const time = new Date().toLocaleTimeString('ru-RU');
    systemLogs.unshift(`[${time}] ${message}`); // Добавляем свежие логи наверх
    if (systemLogs.length > 50) systemLogs.pop(); // Храним только последние 50 событий
}

// Проверка: заполнилась ли личная 7-местная матрица у пользователя?
function isMatrixFull(globalIndex) {
    const b1 = globalIndex * 2;
    const b2 = globalIndex * 2 + 1;
    const c1 = globalIndex * 4;
    const c2 = globalIndex * 4 + 1;
    const c3 = globalIndex * 4 + 2;
    const c4 = globalIndex * 4 + 3;

    // Матрица считается заполненной, если заняты все 6 мест под ним (его ряды B и C)
    return !!(binaryTree[b1] && binaryTree[b2] && binaryTree[c1] && binaryTree[c2] && binaryTree[c3] && binaryTree[c4]);
}

// Инициализация: ставим Главного лидера на вершину структуры
binaryTree[1] = { login: 'FOUNDER', globalIndex: 1 };
totalUsersCount = 1;
addLog('Система успешно запущена. Главный стол (FOUNDER) активирован.');

// ==========================================
// АВТО-СИМУЛЯТОР ЖИВЫХ РЕГИСТРАЦИЙ
// ==========================================
// Каждые 4 секунды скрипт находит свободное место сверху-вниз, слева-направо
setInterval(() => {
    let nextIndex = binaryTree.length;
    
    // Генерируем случайный логин
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const uniqueLogin = `${randomName}_${Math.floor(100 + Math.random() * 900)}`;
    
    // Добавляем пользователя в глобальное дерево
    binaryTree[nextIndex] = { login: uniqueLogin, globalIndex: nextIndex };
    totalUsersCount++;

    // Вычисляем, под кого именно в структуре сел этот человек
    const parentIndex = Math.floor(nextIndex / 2);
    const parentLogin = binaryTree[parentIndex].login;
    
    addLog(`Регистрация: ${uniqueLogin} занял глобальное место №${nextIndex} под спонсором ${parentLogin}.`);

    // Проверяем, не закрылась ли матрица у вышестоящего
    if (isMatrixFull(parentIndex)) {
        addLog(`🔥 МАТРИЦА ЗАКРЫТА! У пользователя ${parentLogin} заполнился нижний ряд. Начислена выплата! Юзер ушел в архив.`);
    }
}, 4000);


// ==========================================
// API ЭНДПОИНТ: СБОРКА ЛОКАЛЬНОЙ МАТРИЦЫ С УЧЕТОМ ЛИНЗЫ
// ==========================================
app.get('/api/matrix', (req, res) => {
    const rootQuery = req.query.root;
    let targetIndex = 1; // По умолчанию показываем Главный стол

    // Если фронтенд передал конкретный логин для фокуса, ищем его индекс в дереве
    if (rootQuery) {
        const found = binaryTree.findIndex(u => u && u.login.toLowerCase() === rootQuery.toLowerCase());
        if (found !== -1) {
            targetIndex = found;
        }
    }

    // Математический расчет индексов 7-местной матрицы для текущего фокуса
    const idxA1 = targetIndex;
    const idxB1 = targetIndex * 2;
    const idxB2 = targetIndex * 2 + 1;
    const idxC1 = targetIndex * 4;
    const idxC2 = targetIndex * 4 + 1;
    const idxC3 = targetIndex * 4 + 2;
    const idxC4 = targetIndex * 4 + 3;

    // Сборка информации о конкретной ячейке
    const getCellInfo = (idx) => {
        if (idx >= binaryTree.length || !binaryTree[idx]) return null;
        
        // Проверяем статус (активный или уже заархивирован)
        let status = 'active';
        if (isMatrixFull(idx)) {
            status = 'archived'; // Блекнет на фронте, если его личная семерка закрыта
        }
        
        return {
            login: binaryTree[idx].login,
            status: status
        };
    };

    // Формируем относительную 7-местную матрицу для отправки на экран
    const localMatrix = {
        'A1': getCellInfo(idxA1),
        'B1': getCellInfo(idxB1),
        'B2': getCellInfo(idxB2),
        'C1': getCellInfo(idxC1),
        'C2': getCellInfo(idxC2),
        'C3': getCellInfo(idxC3),
        'C4': getCellInfo(idxC4)
    };

    // Находим логин спонсора на один уровень выше для кнопки «⬆ Наверх»
    let parentRootLogin = null;
    if (targetIndex > 1) {
        const pIdx = Math.floor(targetIndex / 2);
        if (binaryTree[pIdx]) parentRootLogin = binaryTree[pIdx].login;
    }

    // Отдаем упакованные данные на фронтенд
    res.json({
        matrix: localMatrix,
        parentRoot: parentRootLogin,
        mainRoot: binaryTree[1].login,
        totalUsers: totalUsersCount,
        currentRootDisplay: targetIndex === 1 ? 'Главный стол' : binaryTree[targetIndex].login,
        logs: systemLogs
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер бизнес-матрицы успешно запущен на порту ${PORT}`);
});
