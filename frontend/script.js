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
        renderDynamicMatrices(data);
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

// Построение одной идеальной независимой СЕМЕРКИ с правильной расцветкой: Золото -> Синий -> Серый
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

function renderDynamicMatrices(tree) {
    // Определяем текущее состояние фокуса системы (Эру/Экран)
    const isC4Filled = tree['C4'] && tree['C4'].user;
    const isE16Filled = tree['E16'] && tree['E16'].user;

    let htmlContent = '';

    if (!isC4Filled) {
        // ЭРА 1: Самая первая матрица во главе с А1
        htmlContent = `
            <div class="matrices-row">
                ${buildSemerkaHTML(
                    tree['A1'],
                    tree['B1'], tree['B2'],
                    [tree['C1'], tree['C2'], tree['C3'], tree['C4']]
                )}
            </div>
        `;
    } else if (isC4Filled && !isE16Filled) {
        // ЭРА 2: Матрица А1 закрыта и скрылась! На экране 4 новые СЕМЕРКИ во главе с C1-C4.
        // Каждая ячейка С стала ЗОЛОТОЙ вершиной, D - СИНИМИ плечами, E - СЕРЫМ низом.
        htmlContent = `
            <div class="matrices-row">
                ${buildSemerkaHTML(tree['C1'], tree['D1'], tree['D2'], [tree['E1'], tree['E2'], tree['E3'], tree['E4']])}
                ${buildSemerkaHTML(tree['C2'], tree['D3'], tree['D4'], [tree['E5'], tree['E6'], tree['E7'], tree['E8']])}
                ${buildSemerkaHTML(tree['C3'], tree['D5'], tree['D6'], [tree['E9'], tree['E10'], tree['E11'], tree['E12']])}
                ${buildSemerkaHTML(tree['C4'], tree['D7'], tree['D8'], [tree['E13'], tree['E14'], tree['E15'], tree['E16']])}
            </div>
        `;
    } else {
        // ЭРА 3: Ряд Е тоже закрылся! На экране 8 новых СЕМЕРОК во главе с D1-D8, смотрящих на ряд F.
        // Каждая ячейка D стала ЗОЛОТОЙ вершиной, E - СИНИМИ плечами, F - СЕРЫМ низом.
        htmlContent = `
            <div class="matrices-row">
                ${buildSemerkaHTML(tree['D1'], tree['E1']||null, tree['E2']||null, [tree['F1'], tree['F2'], tree['F3'], tree['F4']])}
                ${buildSemerkaHTML(tree['D2'], tree['E3']||null, tree['E4']||null, [tree['F5'], tree['F6'], tree['F7'], tree['F8']])}
                ${buildSemerkaHTML(tree['D3'], tree['E5']||null, tree['E6']||null, [tree['F9'], tree['F10'], tree['F11'], tree['F12']])}
                ${buildSemerkaHTML(tree['D4'], tree['E7']||null, tree['E8']||null, [tree['F13'], tree['F14'], tree['F15'], tree['F16']])}
                ${buildSemerkaHTML(tree['D5'], tree['E9']||null, tree['E10']||null, [tree['F17'], tree['F18'], tree['F19'], tree['F20']])}
                ${buildSemerkaHTML(tree['D6'], tree['E11']||null, tree['E12']||null, [tree['F21'], tree['F22'], tree['F23'], tree['F24']])}
                ${buildSemerkaHTML(tree['D7'], tree['E13']||null, tree['E14']||null, [tree['F25'], tree['F26'], tree['F27'], tree['F28']])}
                ${buildSemerkaHTML(tree['D8'], tree['E15']||null, tree['E16']||null, [tree['F29'], tree['F30'], tree['F31'], tree['F32']])}
            </div>
        `;
    }

    mainTreeDisplay.innerHTML = htmlContent;
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
setInterval(fetchTree, 1500);
