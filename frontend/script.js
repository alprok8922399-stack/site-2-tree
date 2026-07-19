const API_URL = window.location.origin;

// === ГЛОБАЛЬНЫЙ КУРС ВАЛЮТЫ ===
const MITRON_RATE_USD = 130 / 1000; 

function convertMitronsToUsd(mitrons) {
    return (mitrons * MITRON_RATE_USD).toFixed(2);
}

// Вспомогательная функция для безопасного обновления текста в DOM
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = text;
    }
}

// === 1. РАБОТА С БИНАРНОЙ МАТРИЦЕЙ ===

async function loadMatrixTree() {
    try {
        const response = await fetch(`${API_URL}/api/tree`);
        const treeData = await response.json();
        renderMatrixUI(treeData);
    } catch (error) {
        console.error('Ошибка при загрузке матрицы:', error);
    }
}

function renderMatrixUI(tree) {
    const matrixContainer = document.getElementById('matrix-zoom-wrapper');
    if (!matrixContainer) return;
    
    matrixContainer.innerHTML = ''; 

    const levels = {};
    Object.values(tree).forEach(cell => {
        if (!levels[cell.level]) levels[cell.level] = [];
        levels[cell.level].push(cell);
    });

    Object.keys(levels).sort().forEach(levelLetter => {
        const rowDiv = document.createElement('div');
        rowDiv.className = `matrix-row level-${levelLetter}`;
        
        levels[levelLetter].sort((a, b) => {
            const numA = parseInt(a.id.replace(/^\D+/g, ''), 10) || 0;
            const numB = parseInt(b.id.replace(/^\D+/g, ''), 10) || 0;
            return numA - numB;
        });

        levels[levelLetter].forEach(cell => {
            const cellElement = document.createElement('div');
            cellElement.className = `matrix-cell ${cell.user ? 'occupied' : 'empty'}`;
            cellElement.id = `ui-cell-${cell.id}`;
            
            cellElement.innerHTML = `
                <div class="cell-id">${cell.id}</div>
                <div class="cell-user">${cell.user ? cell.user : 'Свободно'}</div>
            `;
            
            rowDiv.appendChild(cellElement);
        });

        matrixContainer.appendChild(rowDiv);
    });
}

async function registerInMatrix() {
    const usernameInput = document.getElementById('matrix-username');
    const sponsorInput = document.getElementById('matrix-sponsor');
    
    if (!usernameInput || !usernameInput.value.trim()) {
        alert('Введите имя пользователя для регистрации');
        return;
    }

    const payload = {
        username: usernameInput.value.trim(),
        sponsor: sponsorInput ? sponsorInput.value.trim() : ''
    };

    try {
        const response = await fetch(`${API_URL}/api/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Успешно! Место занято в ячейке: ${result.cellId}`);
            loadMatrixTree();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка регистрации в матрице:', error);
    }
}

// === 2. МОДУЛЬ МАРКЕТПЛЕЙСА И ЛОГИКА СЕЙФОВ ===

async function registerShopUser() {
    const shopUserField = document.getElementById('shop-username');
    const shopSponsorField = document.getElementById('shop-sponsor');
    
    if (!shopUserField) return;
    const shopUserStr = shopUserField.value.trim();
    const shopSponsorStr = shopSponsorField ? shopSponsorField.value.trim() : '';
    
    if (!shopUserStr) {
        alert('Укажите логин покупателя');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/shop/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username: shopUserStr, sponsor: shopSponsorStr })
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Покупатель ${shopUserStr} успешно зарегистрирован!`);
            loadUserProfile(shopUserStr);
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка регистрации покупателя:', error);
    }
}

async function payCertificate() {
    const username = document.getElementById('current-profile-user')?.innerText;
    if (!username || username === '—') {
        alert('Сначала выберите или загрузите профиль пользователя');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/shop/pay`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const result = await response.json();
        
        if (result.success) {
            const splitInfo = `
Активация успешна!
Списано: ${result.split.totalMitrons} Митронов ($${result.split.totalUsd})
-----------------------------------------
Распределение сейфов кошельков:
💸 Ликвидность Маркетплейса (70%): ${result.split.marketplaceMitrons} Митронов
🔒 Холодный сейф Создателя (30%): ${result.split.myWalletMitrons} Митронов
            `;
            alert(splitInfo);
            
            loadUserProfile(username);
            loadMatrixTree();
        } else {
            alert(`Ошибка оплаты: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка при оплате тарифа:', error);
    }
}

// === 3. ПРОФИЛЬ, НЕОНОВЫЙ ФОКУС И ОБРАТНЫЙ АПЛАЙН-ТРЕКИНГ ===
async function loadUserProfile(username) {
    if (!username) return;
    
    try {
        const response = await fetch(`${API_URL}/api/user-details/${username}`);
        if (!response.ok) throw new Error('Пользователь не найден');
        const data = await response.json();
        
        if (data.success) {
            // Заполнение базовых текстовых полей инфо-карточки
            setElementText('current-profile-user', data.username);
            
            const cellId = data.profile.matrixPosition.currentCellId;
            setElementText('profile-cell-id', cellId || 'Нет места');
            setElementText('profile-status', data.profile.isPaid ? 'Оплачен (Активен)' : 'Не оплачен');
            
            const mitronsBalance = data.profile.balances.mitrons;
            setElementText('balance-mitrons', `${mitronsBalance} Mitrons`);
            setElementText('balance-usd', `$${convertMitronsToUsd(mitronsBalance)}`);
            
            // --- СТРОГО В КАРТОЧКЕ: ОБРАТНЫЙ СПИСОК СПОНСОРОВ (UPLINE TRACKING) ---
            const uplineContainer = document.getElementById('profile-upline-chain');
            if (uplineContainer) {
                uplineContainer.innerHTML = ''; // Очищаем старую цепочку предков
                
                // Делаем запрос к бэкенду для генерации пути вверх до SYSTEM_ROOT
                try {
                    const chainRes = await fetch(`${API_URL}/api/get-upline-chain?login=${encodeURIComponent(username)}`);
                    const chainData = await chainRes.json();
                    
                    if (chainData.success && chainData.chain && chainData.chain.length > 0) {
                        const traceDiv = document.createElement('div');
                        traceDiv.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; align-items:center; margin-top:10px; font-size:13px; background:#f1f3f9; padding:8px; border-radius:4px; border:1px dashed #ced4da;';
                        
                        // Рендерим цепочку вида: Текущий -> Спонсор 1 -> Спонсор 2 -> Root
                        chainData.chain.forEach((uplineLogin, idx) => {
                            const node = document.createElement('span');
                            if (idx === 0) {
                                node.innerHTML = `<strong style="color:#4e73df;">${uplineLogin}</strong>`;
                            } else {
                                node.innerText = uplineLogin;
                                node.style.cursor = 'pointer';
                                node.style.color = '#6e707e';
                                node.style.textDecoration = 'underline';
                                // Клик по спонсору в цепочке мгновенно переключает карточку на него!
                                node.onclick = () => loadUserProfile(uplineLogin);
                            }
                            traceDiv.appendChild(node);
                            
                            if (idx < chainData.chain.length - 1) {
                                const arrow = document.createElement('span');
                                arrow.innerText = ' ➔ ';
                                arrow.style.color = '#858796';
                                traceDiv.appendChild(arrow);
                            }
                        });
                        uplineContainer.appendChild(traceDiv);
                    }
                } catch (e) {
                    console.error('Не удалось загрузить аплайн-цепочку спонсоров:', e);
                }
            }

            // --- УМНЫЙ АВТОФОКУС В ДЕРЕВЕ МАТРИЦЫ ---
            document.querySelectorAll('.matrix-cell.search-highlight').forEach(el => {
                el.classList.remove('search-highlight');
            });

            if (cellId) {
                const targetCell = document.getElementById(`ui-cell-${cellId}`);
                if (targetCell) {
                    const zoomSlider = document.getElementById('matrix-zoom-slider');
                    const matrixWrapper = document.getElementById('matrix-zoom-wrapper');
                    const zoomValueText = document.getElementById('zoom-value');
                    
                    if (zoomSlider && parseFloat(zoomSlider.value) < 0.5) {
                        zoomSlider.value = 0.8;
                        if (matrixWrapper) matrixWrapper.style.transform = `scale(0.8)`;
                        if (zoomValueText) zoomValueText.innerText = `80%`;
                    }

                    targetCell.classList.add('search-highlight');

                    setTimeout(() => {
                        targetCell.scrollIntoView({
                            behavior: 'smooth',
                            block: 'center',
                            inline: 'center'
                        });
                    }, 150);
                }
            }
            
            // Отрисовка статуса 5 ЗОЛОТЫХ ЯЧЕЕК
            const goldenContainer = document.getElementById('golden-cells-status');
            if (goldenContainer) {
                goldenContainer.innerHTML = '';
                const countReal = data.profile.goldenStatus.realDirectReferralsCount || 0;
                
                const title = document.createElement('h4');
                title.innerText = `Статус 5 ЗОЛОТЫХ ЯЧЕЕК (XYZ_1 - XYZ_5):`;
                goldenContainer.appendChild(title);
                
                const list = document.createElement('ul');
                list.className = 'golden-cells-list';
                
                for (let i = 1; i <= 5; i++) {
                    const li = document.createElement('li');
                    const isCellUnlocked = countReal >= (i * 2); 
                    
                    li.className = isCellUnlocked ? 'cell-gold-active' : 'cell-gold-locked';
                    li.innerText = `Ячейка XYZ_${i}: ${isCellUnlocked ? '🏆 АКТИВИРОВАНА (ЗОЛОТО)' : '🔒 Заблокирована'}`;
                    list.appendChild(li);
                }
                
                goldenContainer.appendChild(list);
                
                const counterText = document.createElement('p');
                counterText.innerText = `Реальных покупателей в первой линии: ${countReal} / 10`;
                goldenContainer.appendChild(counterText);
            }
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

async function resetSystem() {
    if (!confirm('Вы уверены, что хотите полностью очистить систему матриц и балансов?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/reset`, { method: 'POST' });
        const result = await response.json();
        if (result.success) {
            alert('Система успешно сброшена к исходному состоянию!');
            loadMatrixTree();
            
            setElementText('current-profile-user', '—');
            setElementText('profile-cell-id', '—');
            setElementText('profile-status', '—');
            setElementText('balance-mitrons', '0 Mitrons');
            setElementText('balance-usd', '$0.00');
            
            const goldenContainer = document.getElementById('golden-cells-status');
            if (goldenContainer) goldenContainer.innerHTML = '';
            
            const uplineContainer = document.getElementById('profile-upline-chain');
            if (uplineContainer) uplineContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// === ГЛОБАЛЬНЫЕ МОСТЫ СВЯЗИ ДЛЯ ДРУГИХ МОДУЛЕЙ (table.js и matrix.js) ===
window.showUserCard = loadUserProfile;
window.focusMatrixOnUser = (login) => {
    // Вызов фокуса на матрицу перенаправляет на загрузку профиля с его авто-центрированием
    loadUserProfile(login);
};

// Привязка событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    loadMatrixTree();
    
    const zoomSlider = document.getElementById('matrix-zoom-slider');
    const zoomValueText = document.getElementById('zoom-value');
    const matrixWrapper = document.getElementById('matrix-zoom-wrapper');

    if (zoomSlider && matrixWrapper && zoomValueText) {
        zoomSlider.addEventListener('input', (event) => {
            const currentScale = event.target.value;
            matrixWrapper.style.transform = `scale(${currentScale})`;
            zoomValueText.innerText = `${Math.round(currentScale * 100)}%`;
        });
    }
    
    const searchBtn = document.getElementById('search-profile-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('search-username-input');
            const inputName = searchInput ? searchInput.value.trim() : '';
            if (inputName) loadUserProfile(inputName);
        });
    }
});
