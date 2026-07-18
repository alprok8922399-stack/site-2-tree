// frontend/script.js

const API_URL = window.location.origin;

// === ГЛОБАЛЬНЫЙ КУРС ВАЛЮТЫ ===
const MITRON_RATE_USD = 130 / 1000; 

function convertMitronsToUsd(mitrons) {
    return (mitrons * MITRON_RATE_USD).toFixed(2);
}

// === 1. ИНИЦИАЛИЗАЦИЯ И РАБОТА С МАТРИЦЕЙ ===

async function loadMatrixTree() {
    try {
        const response = await fetch(`${API_URL}/api/tree`);
        const treeData = await response.json();
        renderMatrixUI(treeData);
    } catch (error) {
        console.error('Ошибка при загрузке матрицы:', error);
    }
}

// Рендеринг структуры матрицы внутрь отмасштабированного контейнера
function renderMatrixUI(tree) {
    // Рендерим строго в зум-враппер
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
            const numA = parseInt(a.id.replace(/^\D+/g, ''), 10);
            const numB = parseInt(b.id.replace(/^\D+/g, ''), 10);
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
        console.error('Ошибка регистрации:', error);
    }
}

// === 2. МОДУЛЬ МАРКЕТПЛЕЙСА ===

async function registerShopUser() {
    const shopUserStr = document.getElementById('shop-username').value.trim();
    const shopSponsorStr = document.getElementById('shop-sponsor').value.trim();
    
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

async function loadUserProfile(username) {
    if (!username) return;
    
    try {
        const response = await fetch(`${API_URL}/api/user-details/${username}`);
        if (!response.ok) throw new Error('Пользователь не найден');
        const data = await response.json();
        
        if (data.success) {
            document.getElementById('current-profile-user').innerText = data.username;
            document.getElementById('profile-cell-id').innerText = data.profile.matrixPosition.currentCellId || 'Нет места';
            document.getElementById('profile-status').innerText = data.profile.isPaid ? 'Оплачен (Активен)' : 'Не оплачен';
            
            const mitronsBalance = data.profile.balances.mitrons;
            document.getElementById('balance-mitrons').innerText = `${mitronsBalance} Mitrons`;
            document.getElementById('balance-usd').innerText = `$${convertMitronsToUsd(mitronsBalance)}`;
            
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
                    li.innerText = `Ячейка XYZ_${i}: ${isCellUnlocked ? '🏆 АКТИВИРОВАНА (ЗОЛОТО)' : '🔒 Заблокирована (Требуется больше Реальных партнеров)'}`;
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
            if (document.getElementById('current-profile-user')) {
                document.getElementById('current-profile-user').innerText = '—';
                document.getElementById('profile-cell-id').innerText = '—';
                document.getElementById('profile-status').innerText = '—';
                document.getElementById('balance-mitrons').innerText = '0 Mitrons';
                document.getElementById('balance-usd').innerText = '$0.00';
                document.getElementById('golden-cells-status').innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// Привязка событий после загрузки DOM страницы
document.addEventListener('DOMContentLoaded', () => {
    loadMatrixTree();
    
    // === ЛОГИКА ИНТЕРАКТИВНОГО ЗУМА (МАСШТАБИРОВАНИЯ) ===
    const zoomSlider = document.getElementById('matrix-zoom-slider');
    const zoomValueText = document.getElementById('zoom-value');
    const matrixWrapper = document.getElementById('matrix-zoom-wrapper');

    if (zoomSlider && matrixWrapper && zoomValueText) {
        zoomSlider.addEventListener('input', (event) => {
            const currentScale = event.target.value;
            // Применяем CSS трансформацию масштаба
            matrixWrapper.style.transform = `scale(${currentScale})`;
            // Выводим процентное значение для пользователя
            zoomValueText.innerText = `${Math.round(currentScale * 100)}%`;
        });
    }
    
    const searchBtn = document.getElementById('search-profile-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const inputName = document.getElementById('search-username-input').value.trim();
            loadUserProfile(inputName);
        });
    }
});
