const API_URL = '/api';
const treeContainer = document.querySelector('.tree-container');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');

// Инициализация зума
zoomSlider.addEventListener('input', (e) => {
    const scale = e.target.value;
    treeContainer.style.transform = `scale(${scale})`;
});

async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        renderTree(data);
    } catch (err) {
        console.error('Ошибка загрузки дерева:', err);
    }
}

function createCellHTML(cell) {
    if (!cell) return '';
    const isOccupied = cell.user ? 'occupied' : '';
    const colorClass = cell.color ? `color-${cell.color}` : '';
    const displayUser = cell.user ? cell.user : '-';
    
    return `
        <div class="cell ${colorClass} ${isOccupied}" id="cell-${cell.id}">
            <div class="cell-id">${cell.id}</div>
            <div class="cell-user">${displayUser}</div>
        </div>
    `;
}

function renderTree(tree) {
    // Очищаем стандартные верхние уровни
    document.getElementById('level-A').innerHTML = createCellHTML(tree['A1']);
    document.getElementById('level-B').innerHTML = createCellHTML(tree['B1']) + createCellHTML(tree['B2']);
    document.getElementById('level-C').innerHTML = [1,2,3,4].map(i => createCellHTML(tree[`C${i}`])).join('');

    // Распределяем ряды D, E, F по 4 независимым изолированным веткам
    
    // Ветка 1 (Лидер D1 -> под ним E1, E2 -> под ними F1..F4)
    document.getElementById('level-D-1').innerHTML = createCellHTML(tree['D1']);
    document.getElementById('level-E-1').innerHTML = [1,2].map(i => createCellHTML(tree[`E${i}`])).join('');
    document.getElementById('level-F-1').innerHTML = [1,2,3,4].map(i => createCellHTML(tree[`F${i}`])).join('');

    // Ветка 2 (Лидер D2 -> под ним E3, E4 -> под ними F5..F8)
    document.getElementById('level-D-2').innerHTML = createCellHTML(tree['D2']);
    document.getElementById('level-E-2').innerHTML = [3,4].map(i => createCellHTML(tree[`E${i}`])).join('');
    document.getElementById('level-F-2').innerHTML = [5,6,7,8].map(i => createCellHTML(tree[`F${i}`])).join('');

    // Ветка 3 (Лидер D3 -> под ним E5, E6 -> под ними F9..F12)
    document.getElementById('level-D-3').innerHTML = createCellHTML(tree['D3']);
    document.getElementById('level-E-3').innerHTML = [5,6].map(i => createCellHTML(tree[`E${i}`])).join('');
    document.getElementById('level-F-3').innerHTML = [9,10,11,12].map(i => createCellHTML(tree[`F${i}`])).join('');

    // Ветка 4 (Лидер D4 -> под ним E7, E8 -> под ними F13..F16)
    document.getElementById('level-D-4').innerHTML = createCellHTML(tree['D4']);
    document.getElementById('level-E-4').innerHTML = [7,8].map(i => createCellHTML(tree[`E${i}`])).join('');
    document.getElementById('level-F-4').innerHTML = [13,14,15,16].map(i => createCellHTML(tree[`F${i}`])).join('');

    // В бэкенде D5..D8 и соответствующие E/F генерируются для правой половины. 
    // Добавим отображение правого крыла в наши ветки, если ячейки существуют:
    if (tree['D5']) {
        document.getElementById('level-D-3').innerHTML += createCellHTML(tree['D5']);
        document.getElementById('level-E-3').innerHTML += [9,10].map(i => createCellHTML(tree[`E${i}`])).join('');
        document.getElementById('level-F-3').innerHTML += [17,18,19,20].map(i => createCellHTML(tree[`F${i}`])).join('');
    }
    if (tree['D6']) {
        document.getElementById('level-D-4').innerHTML += createCellHTML(tree['D6']);
        document.getElementById('level-E-4').innerHTML += [11,12].map(i => createCellHTML(tree[`E${i}`])).join('');
        document.getElementById('level-F-4').innerHTML += [21,22,23,24].map(i => createCellHTML(tree[`F${i}`])).join('');
    }
    if (tree['D7']) {
        // Дополняем крайние ветки
        document.getElementById('level-D-1').innerHTML += createCellHTML(tree['D7']);
        document.getElementById('level-E-1').innerHTML += [13,14].map(i => createCellHTML(tree[`E${i}`])).join('');
        document.getElementById('level-F-1').innerHTML += [25,26,27,28].map(i => createCellHTML(tree[`F${i}`])).join('');
    }
    if (tree['D8']) {
        document.getElementById('level-D-2').innerHTML += createCellHTML(tree['D8']);
        document.getElementById('level-E-2').innerHTML += [15,16].map(i => createCellHTML(tree[`E${i}`])).join('');
        document.getElementById('level-F-2').innerHTML += [29,30,31,32].map(i => createCellHTML(tree[`F${i}`])).join('');
    }
}

resetBtn.addEventListener('click', async () => {
    if (!confirm('Вы уверены, что хотите полностью очистить базу данных дерева?')) return;
    try {
        const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('База данных успешно очищена!');
            fetchTree();
        }
    } catch (err) {
        alert('Ошибка при сбросе базы');
    }
});

// Запуск при старте
fetchTree();
setInterval(fetchTree, 3000);
