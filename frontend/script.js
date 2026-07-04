const API_URL = '/api';
const treeContainer = document.querySelector('.tree-container');
const zoomSlider = document.getElementById('zoomSlider');
const resetBtn = document.getElementById('resetBtn');

zoomSlider.addEventListener('input', (e) => {
    treeContainer.style.transform = `scale(${e.target.value})`;
});

async function fetchTree() {
    try {
        const res = await fetch(`${API_URL}/tree`);
        const data = await res.json();
        renderTree(data);
    } catch (err) {
        console.error('Ошибка загрузки данных дерева:', err);
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
    // 1. Рендерим самый верхний фундамент системы
    document.getElementById('level-A').innerHTML = createCellHTML(tree['A1']);
    document.getElementById('level-B').innerHTML = createCellHTML(tree['B1']) + createCellHTML(tree['B2']);

    // 2. Распределяем элементы по 4 независимым домикам (Модулям)
    
    // --- МОДУЛЬ 1 (Под C1) ---
    document.getElementById('mod-1-C').innerHTML = createCellHTML(tree['C1']);
    document.getElementById('mod-1-D').innerHTML = createCellHTML(tree['D1']) + createCellHTML(tree['D2']);
    document.getElementById('mod-1-E-left').innerHTML = createCellHTML(tree['E1']) + createCellHTML(tree['E2']);
    document.getElementById('mod-1-E-right').innerHTML = createCellHTML(tree['E3']) + createCellHTML(tree['E4']);
    document.getElementById('mod-1-F-left').innerHTML = [1,2,3,4].map(i => createCellHTML(tree[`F${i}`])).join('');
    document.getElementById('mod-1-F-right').innerHTML = [5,6,7,8].map(i => createCellHTML(tree[`F${i}`])).join('');

    // --- МОДУЛЬ 2 (Под C2) ---
    document.getElementById('mod-2-C').innerHTML = createCellHTML(tree['C2']);
    document.getElementById('mod-2-D').innerHTML = createCellHTML(tree['D3']) + createCellHTML(tree['D4']);
    document.getElementById('mod-2-E-left').innerHTML = createCellHTML(tree['E5']) + createCellHTML(tree['E6']);
    document.getElementById('mod-2-E-right').innerHTML = createCellHTML(tree['E7']) + createCellHTML(tree['E8']);
    document.getElementById('mod-2-F-left').innerHTML = [9,10,11,12].map(i => createCellHTML(tree[`F${i}`])).join('');
    document.getElementById('mod-2-F-right').innerHTML = [13,14,15,16].map(i => createCellHTML(tree[`F${i}`])).join('');

    // --- МОДУЛЬ 3 (Под C3) ---
    document.getElementById('mod-3-C').innerHTML = createCellHTML(tree['C3']);
    document.getElementById('mod-3-D').innerHTML = createCellHTML(tree['D5']) + createCellHTML(tree['D6']);
    document.getElementById('mod-3-E-left').innerHTML = createCellHTML(tree['E9']) + createCellHTML(tree['E10']);
    document.getElementById('mod-3-E-right').innerHTML = createCellHTML(tree['E11']) + createCellHTML(tree['E12']);
    document.getElementById('mod-3-F-left').innerHTML = [17,18,19,20].map(i => createCellHTML(tree[`F${i}`])).join('');
    document.getElementById('mod-3-F-right').innerHTML = [21,22,23,24].map(i => createCellHTML(tree[`F${i}`])).join('');

    // --- МОДУЛЬ 4 (Под C4) ---
    document.getElementById('mod-4-C').innerHTML = createCellHTML(tree['C4']);
    document.getElementById('mod-4-D').innerHTML = createCellHTML(tree['D7']) + createCellHTML(tree['D8']);
    document.getElementById('mod-4-E-left').innerHTML = createCellHTML(tree['E13']) + createCellHTML(tree['E14']);
    document.getElementById('mod-4-E-right').innerHTML = createCellHTML(tree['E15']) + createCellHTML(tree['E16']);
    document.getElementById('mod-4-F-left').innerHTML = [25,26,27,28].map(i => createCellHTML(tree[`F${i}`])).join('');
    document.getElementById('mod-4-F-right').innerHTML = [29,30,31,32].map(i => createCellHTML(tree[`F${i}`])).join('');
}

resetBtn.addEventListener('click', async () => {
    if (!confirm('Очистить базу данных дерева?')) return;
    try {
        const res = await fetch(`${API_URL}/reset`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
            alert('База очищена!');
            fetchTree();
        }
    } catch (err) {
        alert('Ошибка сброса');
    }
});

fetchTree();
setInterval(fetchTree, 2000);
