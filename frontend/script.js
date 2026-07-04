const API_URL = '/api';
const mainTreeDisplay = document.getElementById('mainTreeDisplay');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');

zoomSlider.addEventListener('input', (e) => {
    mainTreeDisplay.style.transform = `scale(${e.target.value})`;
});

async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        renderDynamicSplitting(data);
    } catch (err) {
        console.error('Ошибка загрузки данных:', err);
    }
}

function getCellHTML(cell, roleClass) {
    if (!cell) {
        return `<div class="cell ${roleClass}"><div class="cell-id">-</div><div class="cell-user">-</div></div>`;
    }
    const isOccupied = cell.user ? 'occupied' : '';
    const displayUser = cell.user ? cell.user : '-';
    return `
        <div class="cell ${roleClass} ${isOccupied}" id="cell-${cell.id}">
            <div class="cell-id">${cell.id}</div>
            <div class="cell-user">${displayUser}</div>
        </div>
    `;
}

function buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4) {
    return `
        <div class="semerka-matrix">
            <div class="matrix-row">${getCellHTML(topCell, 'level-1')}</div>
            <div class="matrix-row">
                ${getCellHTML(leftShoulder, 'level-2')}
                ${getCellHTML(rightShoulder, 'level-2')}
            </div>
            <div class="matrix-row">
                ${getCellHTML(bottom4[0], 'level-3')}
                ${getCellHTML(bottom4[1], 'level-3')}
                ${getCellHTML(bottom4[2], 'level-3')}
                ${getCellHTML(bottom4[3], 'level-3')}
            </div>
        </div>
    `;
}

// Вспомогательная функция, чтобы узнать букву и номер следующего уровня для поиска потомков
function parseCell(id) {
    const match = id.match(/^([A-Z])(\d+)$/);
    if (!match) return null;
    return { letter: match[1], num: parseInt(match[2], 10) };
}

function getNextLevelLetter(letter) {
    return String.fromCharCode(letter.charCodeAt(0) + 1);
}

// Главная функция бесконечного динамического поиска активных домиков
function renderDynamicSplitting(tree) {
    // Стек для обхода дерева в поиске активных (незакрытых) матриц
    let activeMatricesHTML = [];
    let queue = ['A1']; // Начинаем жизнь с самой первой матрицы A1
    let processedNodes = new Set();

    while (queue.length > 0) {
        const currentId = queue.shift();
        if (processedNodes.has(currentId)) continue;
        processedNodes.add(currentId);

        const topCell = tree[currentId];
        if (!topCell) continue;

        // Вычисляем соотвествующие плечи и низ для ТЕКУЩЕЙ вершины по закону бинарного дерева
        const parsed = parseCell(currentId);
        if (!parsed) continue;

        const nextLetter = getNextLevelLetter(parsed.letter);       // Уровень плеч (например, B)
        const bottomLetter = getNextLevelLetter(nextLetter);        // Уровень низа (например, C)

        const leftLNum = parsed.num * 2 - 1;
        const rightLNum = parsed.num * 2;

        const leftShoulderId = `${nextLetter}${leftLNum}`;
        const rightShoulderId = `${nextLetter}${rightLNum}`;

        const b1 = `${bottomLetter}${leftLNum * 2 - 1}`;
        const b2 = `${bottomLetter}${leftLNum * 2}`;
        const b3 = `${bottomLetter}${rightLNum * 2 - 1}`;
        const b4 = `${bottomLetter}${rightLNum * 2}`;

        const leftShoulder = tree[leftShoulderId] || null;
        const rightShoulder = tree[rightShoulderId] || null;
        const bottom4 = [
            tree[b1] || null,
            tree[b2] || null,
            tree[b3] || null,
            tree[b4] || null
        ];

        // ПРОВЕРКА: Закрыта ли полностью четверка низа у ЭТОГО конкретного домика?
        const isMatrixClosed = bottom4.every(cell => cell && cell.user);

        if (isMatrixClosed) {
            // Если ЕГО четверка закрылась - этот домик дробится! 
            // Сам он больше не выводится, но его плечи становятся новыми вершинами для проверки в цикле!
            if (leftShoulder) queue.push(leftShoulderId);
            if (rightShoulder) queue.push(rightShoulderId);
        } else {
            // Если четверка еще НЕ закрылась — этот домик прямо сейчас АКТИВЕН. Отрисовываем его на экран!
            activeMatricesHTML.push(buildSemerkaHTML(topCell, leftShoulder, rightShoulder, bottom4));
        }
    }

    // Выводим все активные на данный момент домики в один ряд с ровными отступами
    mainTreeDisplay.innerHTML = `
        <div class="matrices-row">
            ${activeMatricesHTML.join('')}
        </div>
    `;
}

resetBtn.addEventListener('click', async () => {
    if (!confirm('Очистить базу данных дерева?')) return;
    try {
        const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('База успешно сброшена!');
            fetchTree();
        }
    } catch (err) {
        alert('Ошибка при сбросе');
    }
});

fetchTree();
setInterval(fetchTree, 2000);
