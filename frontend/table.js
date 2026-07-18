// frontend/table.js

const API_BASE_URL = window.location.origin;

// === ФИКСИРОВАННЫЙ КУРС ВАЛЮТЫ ===
// 1000 Митронов = 130 USD по умолчанию. Рубли полностью удалены.
const MITRON_TO_USD_RATE = 130 / 1000; 

/**
 * Конвертирует Митроны в USD для отображения в таблице
 */
function convertToUsd(mitrons) {
    return (mitrons * MITRON_TO_USD_RATE).toFixed(2);
}

/**
 * Загрузка реферального дерева и построение таблицы пользователей
 */
async function loadReferalsTable() {
    const tableBody = document.getElementById('referals-table-body');
    if (!tableBody) return;

    tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Загрузка структуры данных...</td></tr>';

    try {
        // Получаем структуру дерева с расчитанными колонками (уровнями)
        const response = await fetch(`${API_BASE_URL}/api/referals-tree`);
        const result = await response.json();

        if (!result.success || !result.tree) {
            tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Ошибка загрузки структуры рефералов</td></tr>';
            return;
        }

        tableBody.innerHTML = ''; // Очищаем заглушку перед рендерингом

        // Перебираем всех пользователей из полученной структуры
        for (const username of Object.keys(result.tree)) {
            const userNode = result.tree[username];
            
            // Запрашиваем индивидуальные детали по каждому пользователю для вывода баланса и Золотого статуса
            let details = { 
                profile: { 
                    balances: { mitrons: 0 }, 
                    isPaid: false, 
                    goldenStatus: { realDirectReferralsCount: 0 } 
                } 
            };
            
            try {
                const detailRes = await fetch(`${API_BASE_URL}/api/user-details/${username}`);
                if (detailRes.ok) {
                    details = await detailRes.json();
                }
            } catch (e) {
                console.error(`Не удалось загрузить детальный профиль для пользователя: ${username}`, e);
            }

            const tr = document.createElement('tr');

            // 1. Колонка: Логин участника
            const tdUser = document.createElement('td');
            tdUser.innerHTML = `<strong>${username}</strong>`;
            tr.appendChild(tdUser);

            // 2. Колонка: Спонсор (Пригласитель)
            const tdSponsor = document.createElement('td');
            tdSponsor.innerText = userNode.sponsor || 'SYSTEM_ROOT';
            tr.appendChild(tdSponsor);

            // 3. Колонка: Глубина в реферальной системе
            const tdColumn = document.createElement('td');
            tdColumn.innerText = `Уровень ${userNode.calculatedColumn}`;
            tr.appendChild(tdColumn);

            // 4. Колонка: Текущий баланс (Только Митроны и эквивалент в USD)
            const tdBalance = document.createElement('td');
            const mitrons = details.profile.balances.mitrons || 0;
            tdBalance.innerHTML = `<span>${mitrons} Mitrons</span><br><small style="color: #28a745;">($${convertToUsd(mitrons)})</small>`;
            tr.appendChild(tdBalance);

            // 5. Колонка: Статус 5 ЗОЛОТЫХ ЯЧЕЕК (XYZ_1 - XYZ_5)
            const tdGolden = document.createElement('td');
            const realCount = details.profile.goldenStatus.realDirectReferralsCount || 0;
            
            // Каждые 2 Реальных покупателя активируют одну Золотую Ячейку из пяти доступных
            let activeGoldenCount = Math.min(5, Math.floor(realCount / 2));
            
            if (activeGoldenCount > 0) {
                tdGolden.innerHTML = `
                    <span style="color: #d4af37; font-weight: bold; text-shadow: 0px 0px 2px rgba(0,0,0,0.2);">
                        🏆 ЗОЛОТО (XYZ_1 - XYZ_${activeGoldenCount})
                    </span><br>
                    <small style="color: #666;">Реальных в 1-й линии: ${realCount}/10</small>
                `;
            } else {
                tdGolden.innerHTML = `
                    <span style="color: #999; font-style: italic;">🔒 XYZ_1 - XYZ_5 заблокированы</span><br>
                    <small style="color: #666;">Реальных в 1-й линии: ${realCount}/10</small>
                `;
            }
            tr.appendChild(tdGolden);

            tableBody.appendChild(tr);
        }

    } catch (error) {
        console.error('Ошибка при генерации таблицы рефералов:', error);
        tableBody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Критическая ошибка на стороне клиента</td></tr>';
    }
}

// Автоматическая инициализация таблицы при полной загрузке DOM-структуры страницы
document.addEventListener('DOMContentLoaded', () => {
    loadReferalsTable();
    
    // Поддержка кнопки ручного обновления данных на интерфейсе
    const refreshBtn = document.getElementById('refresh-table-btn');
    if (refreshBtn) {
        refreshBtn.addEventListener('click', loadReferalsTable);
    }
});
