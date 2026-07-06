const express = require('express');
const cors = require('cors');
const path = require('path'); // Добавили модуль для путей
const app = express();

app.use(cors());
app.use(express.json());

// Связываем бэкенд с папкой фронтенда, чтобы по ссылке открывался интерфейс матрицы
app.use(express.static(path.join(__dirname, '../frontend')));

let users = [];       
let matrixData = {};  
let activeLogs = [];  

matrixData['A1'] = { login: 'FOUNDER_A1', time: new Date().toISOString(), status: 'archived' };
matrixData['B1'] = { login: 'LEADER_B1', time: new Date().toISOString(), status: 'active' };
matrixData['B2'] = { login: 'LEADER_B2', time: new Date().toISOString(), status: 'active' };

let nextRowCIndex = 1; 
let currentTargetRow = 'D'; 
let currentRound = 1;       
let currentSectorIndex = 0; 

const PORT = process.env.PORT || 5000;

function getSectorsForRow(rowName) {
    const rowCounts = { 'C': 4, 'D': 8, 'E': 16, 'F': 32, 'G': 64, 'H': 128 };
    let count = rowCounts[rowName] || 4;
    const sectorCount = count / 4;
    const sectors = [];
    for (let s = 0; s < sectorCount; s++) {
        const startNum = s * 4 + 1;
        sectors.push([`${rowName}${startNum}`, `${rowName}${startNum + 1}`, `${rowName}${startNum + 2}`, `${rowName}${startNum + 3}`]);
    }
    return sectors;
}

function getNextRowLetter(rowLetter) {
    return String.fromCharCode(rowLetter.charCodeAt(0) + 1);
}

function isSectorFilled(sector) {
    return sector.every(cellId => matrixData[cellId] !== undefined);
}

function findNextFreeCellAndPlaceUser(login) {
    const timestamp = new Date().toISOString();
    
    if (nextRowCIndex <= 4) {
        const cellId = `C${nextRowCIndex}`;
        matrixData[cellId] = { login, time: timestamp, status: 'active' };
        nextRowCIndex++;
        if (nextRowCIndex > 4) {
            if (matrixData['A1']) matrixData['A1'].status = 'archived';
            activeLogs.unshift(`[${new Date().toLocaleTimeString()}] Ряд C заполнен! Открыт ряд D.`);
        }
        return cellId;
    }
    
    while (true) {
        let sectors = getSectorsForRow(currentTargetRow);
        if (currentSectorIndex < sectors.length) {
            let sector = sectors[currentSectorIndex];
            let cellId = sector[currentRound - 1];
            currentSectorIndex++;
            
            if (!matrixData[cellId]) {
                matrixData[cellId] = { login, time: timestamp, status: 'active' };
                if (currentRound === 4 && isSectorFilled(sector)) {
                    const nextRow = getNextRowLetter(currentTargetRow);
                    const sectorNumInRow = currentSectorIndex;
                    const startE = (sectorNumInRow - 1) * 8 + 1;
                    activeLogs.unshift(`[${new Date().toLocaleTimeString()}] БАХ! Сектор ${sectorNumInRow} ряда ${currentTargetRow} закрыт ячейкой ${cellId}! Родились ячейки ряда ${nextRow}`);
                }
                
                let allFilled = sectors.every(sec => sec.every(c => matrixData[c] !== undefined));
                if (allFilled) {
                    currentTargetRow = getNextRowLetter(currentTargetRow);
                    currentRound = 1;
                    currentSectorIndex = 0;
                }
                return cellId;
            }
        } else {
            currentRound++;
            currentSectorIndex = 0;
            if (currentRound > 4) currentRound = 1;
        }
    }
}

// API эндпоинты
app.post('/api/register', (req, res) => {
    const { login } = req.body;
    if (!login) return res.status(400).json({ success: false });
    const allocatedCell = findNextFreeCellAndPlaceUser(login);
    users.push({ login, cell: allocatedCell, time: new Date().toLocaleTimeString() });
    activeLogs.unshift(`[${new Date().toLocaleTimeString()}] ${login} встал в ячейку ${allocatedCell}`);
    res.json({ success: true, data: { cell: allocatedCell } });
});

app.get('/api/matrix', (req, res) => {
    res.json({
        matrix: matrixData,
        logs: activeLogs.slice(0, 50),
        totalUsers: users.length + 3,
        currentConfig: { row: currentTargetRow, round: currentRound, sector: currentSectorIndex }
    });
});

// Отдаем фронтенд на любые другие запросы
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../frontend/index.html'));
});

app.listen(PORT, () => console.log(`Матрица запущена на порту ${PORT}`));
