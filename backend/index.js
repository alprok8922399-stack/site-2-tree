const express = require('express');
const cors = require('cors');
const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.static('../frontend'));

// Железный занавес — не трогаем!
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

function getNextLevelLetter(letter) {
    let chars = letter.split('');
    let i = chars.length - 1;
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

function ensureRowExists(tree, letter) {
    if (tree[`${letter}1`]) return;
    
    let count = 4;
    let current = 'C';
    while (current !== letter) {
        current = getNextLevelLetter(current);
        count *= 2;
    }
    for (let i = 1; i <= count; i++) {
        tree[`${letter}${i}`] = { id: `${letter}${i}`, level: letter, user: null };
    }
}

function findNextEmptyCell(tree) {
    // Ряд C
    for (let i = 1; i <= 4; i++) if (!tree[`C${i}`].user) return `C${i}`;

    // Ряд D (Шахматы)
    ensureRowExists(tree, 'D');
    const orderD = ['D1', 'D5', 'D2', 'D6', 'D3', 'D7', 'D4', 'D8'];
    for (const key of orderD) if (tree[key] && !tree[key].user) return key;

    // Бесконечный цикл по рядам E, F, G, H, J...
    let letter = 'E';
    while (true) {
        ensureRowExists(tree, letter);
        let cellCount = 4;
        let tmp = 'C';
        while (tmp !== letter) { tmp = getNextLevelLetter(tmp); cellCount *= 2; }

        for (let circle = 1; circle <= 4; circle++) {
            for (let i = circle; i <= cellCount; i += 4) {
                const key = `${letter}${i}`;
                if (tree[key] && !tree[key].user) return key;
            }
        }
        letter = getNextLevelLetter(letter);
        if (letter === 'I') letter = 'J';
    }
}

app.get('/api/tree', (req, res) => res.json(treeDB));
app.post('/api/shop/pay', (req, res) => {
    const { username } = req.body;
    const cellId = findNextEmptyCell(treeDB);
    treeDB[cellId].user = username;
    res.json({ success: true, cellId });
});
app.post('/api/reset', (req, res) => { treeDB = createInitialTree(); res.json({ success: true }); });

app.listen(PORT, () => console.log(`Ядро запущено на ${PORT}`));
