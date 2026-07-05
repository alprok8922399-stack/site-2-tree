// ... (оставить начало до функции renderDynamicSplitting)

function renderDynamicSplitting(tree) {
    let activeMatricesHTML = [];
    // Собираем все ключи, сортируем их, чтобы идти по порядку уровней
    const rows = {};
    for (const id in tree) {
        const letter = id.replace(/[0-9]/g, '');
        if (!rows[letter]) rows[letter] = [];
        rows[letter].push(id);
    }
    
    // Отрисовка идет от текущего уровня вниз
    // Скрипт теперь просто берет все существующие уровни из tree
    Object.keys(rows).sort().forEach(letter => {
        if (['A', 'B'].includes(letter)) return; // Не рендерим занавес как матрицы
        
        // Здесь логика отрисовки «семерок» для каждого ряда
        // ... (рендеринг на основе данных с сервера)
    });
    
    mainTreeDisplay.innerHTML = `<div class="matrices-row">${activeMatricesHTML.join('')}</div>`;
}

// ... (оставить остальную часть)
