const express = require('express');
const cors = require('cors');
const path = require('path'); // Добавили модуль для работы с путями

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 10000;

// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ СИСТЕМЫ (В памяти)
// ==========================================
let binaryTree = [null]; 
let systemLogs = [];
let totalUsersCount = 0;

const mockNames = ['CryptoKing', 'Alpha_Менеджер', 'LuckyStrike', 'Bitcoin_Bro', 'CyberPulse', 'Tesla_Fan', 'Web3_Wanderer', 'Matrix_Neo', 'Rich_Fox', 'Future_Shark', 'Infinity', 'GoldenБосс'];

function addLog(message) {
    const time = new Date().toLocaleTimeString('ru-RU');
    systemLogs.unshift(`[${time}] ${message}`);
    if (systemLogs.length > 50) systemLogs.pop();
}

function isMatrixFull(globalIndex) {
    const b1 = globalIndex * 2;
    const b2 = globalIndex * 2 + 1;
    const c1 = globalIndex * 4;
    const c2 = globalIndex * 4 + 1;
    const c3 = globalIndex * 4 + 2;
    const c4 = globalIndex * 4 + 3;
    return !!(binaryTree[b1] && binaryTree[b2] && binaryTree[c1] && binaryTree[c2] && binaryTree[c3] && binaryTree[c4]);
}

binaryTree[1] = { login: 'FOUNDER', globalIndex: 1 };
totalUsersCount = 1;
addLog('Система успешно запущена. Главный стол (FOUNDER) активирован.');

// АВТО-СИМУЛЯТОР ЖИВЫХ РЕГИСТРАЦИЙ
setInterval(() => {
    let nextIndex = binaryTree.length;
    const randomName = mockNames[Math.floor(Math.random() * mockNames.length)];
    const uniqueLogin = `${randomName}_${Math.floor(100 + Math.random() * 900)}`;
    
    binaryTree[nextIndex] = { login: uniqueLogin, globalIndex: nextIndex };
    totalUsersCount++;

    const parentIndex = Math.floor(nextIndex / 2);
    const parentLogin = binaryTree[parentIndex].login;
    addLog(`Регистрация: ${uniqueLogin} занял глобальное место №${nextIndex} под спонсором ${parentLogin}.`);

    if (isMatrixFull(parentIndex)) {
        addLog(`🔥 МАТРИЦА ЗАКРЫТА! У пользователя ${parentLogin} заполнился нижний ряд. Начислена выплата! Юзер ушел в архив.`);
    }
}, 4000);

// ==========================================
// МАРШРУТЫ (ROUTES)
// ==========================================

// 1. НАСТРОЙКА ГЛАВНОЙ СТРАНИЦЫ (Убирает ошибку Cannot GET /)
app.get('/', (req, res) => {
    res.json({
        status: "ONLINE",
        message: "Бэкенд Бизнес-Матрицы успешно запущен и работает!",
        database: `Зарегистрировано юзеров: ${totalUsersCount}`,
        instruction: "Чтобы получить структуру матрицы, сделайте запрос на /api/matrix"
    });
});

// 2. API ЭНДПОИНТ: СБОРКА ЛОКАЛЬНОЙ МАТРИЦЫ С УЧЕТОМ ЛИНЗЫ
app.get('/api/matrix', (req, res) => {
    const rootQuery = req.query.root;
    let targetIndex = 1;

    if (rootQuery) {
        const found = binaryTree.findIndex(u => u && u.login.toLowerCase() === rootQuery.toLowerCase());
        if (found !== -1) {
            targetIndex = found;
        }
    }

    const idxA1 = targetIndex;
    const idxB1 = targetIndex * 2;
    const idxB2 = targetIndex * 2 + 1;
    const idxC1 = targetIndex * 4;
    const idxC2 = targetIndex * 4 + 1;
    const idxC3 = targetIndex * 4 + 2;
    const idxC4 = targetIndex * 4 + 3;

    const getCellInfo = (idx) => {
        if (idx >= binaryTree.length || !binaryTree[idx]) return null;
        let status = 'active';
        if (isMatrixFull(idx)) {
            status = 'archived';
        }
        return { login: binaryTree[idx].login, status: status };
    };

    const localMatrix = {
        'A1': getCellInfo(idxA1),
        'B1': getCellInfo(idxB1),
        'B2': getCellInfo(idxB2),
        'C1': getCellInfo(idxC1),
        'C2': getCellInfo(idxC2),
        'C3': getCellInfo(idxC3),
        'C4': getCellInfo(idxC4)
    };

    let parentRootLogin = null;
    if (targetIndex > 1) {
        const pIdx = Math.floor(targetIndex / 2);
        if (binaryTree[pIdx]) parentRootLogin = binaryTree[pIdx].login;
    }

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
