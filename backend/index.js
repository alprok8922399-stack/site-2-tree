const express = require('express');
const cors = require('cors');
const app = express();

app.use(cors());
app.use(express.json());

// ==========================================
// ГЛОБАЛЬНОЕ СОСТОЯНИЕ СИСТЕМЫ (БАЗА ДАННЫХ В ПАМЯТИ)
// ==========================================
let users = [];       // Общий список всех прилетевших участников
let matrixData = {};  // Объект со структурой ячеек: { 'A1': { login, time }, 'D5': {...} }
let activeLogs = [];  // Логи для нижней панели живой ленты

// Статические начальные ячейки (всегда заполнены по ТЗ)
matrixData['A1'] = { login: 'FOUNDER_A1', time: new Date().toISOString(), status: 'archived' };
matrixData['B1'] = { login: 'LEADER_B1', time: new Date().toISOString(), status: 'active' };
matrixData['B2'] = { login: 'LEADER_B2', time: new Date().toISOString(), status: 'active' };

// Ряд С заполняется статично по порядку (C1-C4)
let nextRowCIndex = 1; 

// Параметры для веерного алгоритма начиная с ряда D
let currentTargetRow = 'D'; // Текущий заполняемый ряд
let currentRound = 1;       // Текущий круг веера (место внутри четверок: 1, 2, 3 или 4)
let currentSectorIndex = 0; // Какой сектор в текущем кругу заполняем

// Настройки портов для Render
const PORT = process.env.PORT || 5000;

// Вспомогательная функция для генерации секторов конкретного ряда
function getSectorsForRow(rowName) {
    const rowCounts = { 'C': 4, 'D': 8, 'E': 16, 'F': 32, 'G': 64, 'H': 128, 'I': 256, 'J': 512 };
    // Если ряд дальше J, рассчитываем математически как 2^level
    let count = rowCounts[rowName];
    if (!count) {
        const charCodeDiff = rowName.charCodeAt(0) - 'C'.charCodeAt(0);
        count = 4 * Math.pow(2, charCodeDiff);
    }
    
    const sectorCount = count / 4;
    const sectors = [];
    
    for (let s = 0; s < sectorCount; s++) {
        const startNum = s * 4 + 1;
        sectors.push([
            `${rowName}${startNum}`,
            `${rowName}${startNum + 1}`,
            `${rowName}${startNum + 2}`,
            `${rowName}${startNum + 3}`
        ]);
    }
    return sectors;
}

// Определение следующего ряда по алфавиту
function getNextRowLetter(rowLetter) {
    return String.fromCharCode(rowLetter.charCodeAt(0) + 1);
}

// Проверка: заполнен ли сектор на 100%
function isSectorFilled(sector) {
    return sector.every(cellId => matrixData[cellId] !== undefined);
}

// ==========================================
// ГЛАВНЫЙ АЛГОРИТМ: ПОИСК СЛЕДУЮЩЕЙ СВОБОДНОЙ ЯЧЕЙКИ ПО ВЕЕРУ
// ==========================================
function findNextFreeCellAndPlaceUser(login) {
    const timestamp = new Date().toISOString();
    
    // 1. ОБРАБОТКА ТЕСТОВОГО РЯДА C (Простое заполнение по порядку)
    if (nextRowCIndex <= 4) {
        const cellId = `C${nextRowCIndex}`;
        matrixData[cellId] = { login, time: timestamp, status: 'active' };
        nextRowCIndex++;
        
        // Триггер: когда ряд С полностью закрылся ячейкой C4
        if (nextRowCIndex > 4) {
            // Верхушка А1 получает выплату и тускнеет
            if (matrixData['A1']) matrixData['A1'].status = 'archived';
            
            // Защитный барьер: под С1-C4 мгновенно рождается весь ряд D (8 ячеек, 2 четверки)
            // В памяти они пока просто пусты, но готовы к вееру
            activeLogs.unshift(`[${new Date().toLocaleTimeString()}] Ряд C заполнен! Матрица делит ряд A1. Открыт ряд D.`);
        }
        return cellId;
    }
    
    // 2. ВЕЕРНЫЙ АЛГОРИТМ (Для рядов D, E, F и до бесконечности)
    while (true) {
        let sectors = getSectorsForRow(currentTargetRow);
        
        // Ищем ячейку по текущему кругу (currentRound: 1-е места, 2-е места...)
        if (currentSectorIndex < sectors.length) {
            let sector = sectors[currentSectorIndex];
            let cellId = sector[currentRound - 1]; // Выбираем 1-ю, 2-ю, 3-ю или 4-ю ячейку в секторе
            
            // Переходим к следующему сектору для следующего шага веера
            currentSectorIndex++;
            
            // Если ячейка свободна, занимаем её!
            if (!matrixData[cellId]) {
                matrixData[cellId] = { login, time: timestamp, status: 'active' };
                
                // Проверяем ТРИГГЕР: Если это была 4-я ячейка сектора, сектор сомкнулся на 100%!
                if (currentRound === 4 && isSectorFilled(sector)) {
                    const nextRow = getNextRowLetter(currentTargetRow);
                    const sectorNumInRow = currentSectorIndex; // Номер текущего сектора
                    
                    // Вычисляем, какие именно 8 ячеек следующего ряда должны родиться под этим сектором
                    const startE = (sectorNumInRow - 1) * 8 + 1;
                    activeLogs.unshift(`[${new Date().toLocaleTimeString()}] БАХ! Сектор ${sectorNumInRow} ряда ${currentTargetRow} закрыт ячейкой ${cellId}! Внизу родились ячейки ряда ${nextRow} с ${nextRow}${startE} по ${nextRow}${startE + 7}`);
                    
                    // Логика тускнения верхних: определяем родителя над этой четверкой (Ряды B, C и т.д.)
                    // Для простоты визуализации на фронтенде статус архивных будет вычисляться автоматически
                }
                
                // Проверяем, закрылся ли ВЕСЬ текущий ряд полностью
                let allFilled = sectors.every(sec => sec.every(c => matrixData[c] !== undefined));
                if (allFilled) {
                    activeLogs.unshift(`[${new Date().toLocaleTimeString()}] Ряд ${currentTargetRow} полностью закрыт! Переходим на ряд ${getNextRowLetter(currentTargetRow)}.`);
                    currentTargetRow = getNextRowLetter(currentTargetRow);
                    currentRound = 1;
                    currentSectorIndex = 0;
                }
                
                return cellId;
            }
        } else {
            // Если прошли все сектора в текущем кругу, переходим к следующему кругу мест (например, от 1-х мест ко 2-м)
            currentRound++;
            currentSectorIndex = 0;
            
            // Защита: если вышли за рамки 4 мест в четверках, сбрасываем (хотя ряд должен закрыться на 4 кругу)
            if (currentRound > 4) {
                currentRound = 1;
            }
        }
    }
}

// ==========================================
// ЭНДПОИНТЫ API
// ==========================================

// 1. Приём новых регистраций с Сайта 1
app.post('/api/register', (req, res) => {
    const { login } = req.body;
    if (!login) {
        return res.status(400).json({ success: false, error: 'Логин не указан' });
    }
    
    // Запускаем робота распределения по матрице
    const allocatedCell = findNextFreeCellAndPlaceUser(login);
    
    const userData = {
        login,
        cell: allocatedCell,
        time: new Date().toLocaleTimeString()
    };
    
    users.push(userData);
    activeLogs.unshift(`[${userData.time}] Пользователь ${login} прилетел с Сайта 1 ➔ встал в ячейку ${allocatedCell}`);
    
    res.json({ success: true, data: userData });
});

// 2. Отдача всей матрицы и логов для фронтенда Сайта 2
app.get('/api/matrix', (req, res) => {
    res.json({
        matrix: matrixData,
        logs: activeLogs.slice(0, 50), // Отдаем последние 50 логов для экономии трафика смартфона
        totalUsers: users.length + 3,  // +3 изначальных статичных лидера
        currentConfig: {
            row: currentTargetRow,
            round: currentRound,
            sector: currentSectorIndex
        }
    });
});

// Запуск сервера
app.listen(PORT, () => {
    console.log(`Сервер бэкенда матрицы запущен на порту ${PORT}`);
});
