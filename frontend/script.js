// frontend/script.js

const API_URL = window.location.origin;

// === ГЛОБАЛЬНЫЙ КУРС ВАЛЮТЫ ===
const MITRON_RATE_USD = 130 / 1000; 

function convertMitronsToUsd(mitrons) {
    return (mitrons * MITRON_RATE_USD).toFixed(2);
}

// Вспомогательная функция для безопасного обновления текста в DOM (защита от падения скрипта при отсутствии ID)
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

// Рендеринг структуры матрицы внутрь отмасштабированного контейнера
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
        
        // Исправлено: добавлен "|| 0" на случай, если в ID ячейки не окажется цифр (защита от NaN)
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
            
            // Исправлено: удален избыточный matrixContainer.appendChild(cellElement)
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

// === УМНЫЙ ПОИСК, НЕОНОВЫЙ ФОКУС И АВТО-СКРОЛЛ ===
async function loadUserProfile(username) {
    if (!username) return;
    
    try {
        const response = await fetch(`${API_URL}/api/user-details/${username}`);
        if (!response.ok) throw new Error('Пользователь не найден');
        const data = await response.json();
        
        if (data.success) {
            // Исправлено: безопасное заполнение данных через общую функцию проверки элементов
            setElementText('current-profile-user', data.username);
            
            const cellId = data.profile.matrixPosition.currentCellId;
            setElementText('profile-cell-id', cellId || 'Нет места');
            setElementText('profile-status', data.profile.isPaid ? 'Оплачен (Активен)' : 'Не оплачен');
            
            const mitronsBalance = data.profile.balances.mitrons;
            setElementText('balance-mitrons', `${mitronsBalance} Mitrons`);
            setElementText('balance-usd', `$${convertMitronsToUsd(mitronsBalance)}`);
            
            // --- УМНЫЙ АВТОФОКУС В ДЕРЕВЕ МАТРИЦЫ ---
            // 1. Убираем старую неоновую подсветку с прошлых поисков
            document.querySelectorAll('.matrix-cell.search-highlight').forEach(el => {
                el.classList.remove('search-highlight');
            });

            if (cellId) {
                const targetCell = document.getElementById(`ui-cell-${cellId}`);
                if (targetCell) {
                    const zoomSlider = document.getElementById('matrix-zoom-slider');
                    const matrixWrapper = document.getElementById('matrix-zoom-wrapper');
                    const zoomValueText = document.getElementById('zoom-value');
                    
                    // 2. Если масштаб слишком мелкий для глаз, плавно возвращаем к 80%
                    if (zoomSlider && parseFloat(zoomSlider.value) < 0.5) {
                        zoomSlider.value = 0.8;
                        if (matrixWrapper) matrixWrapper.style.transform = `scale(0.8)`;
                        if (zoomValueText) zoomValueText.innerText = `80%`;
                    }

                    // 3. Включаем неоновую пульсацию на нужной ячейке
                    targetCell.classList.add('search-highlight');

                    // 4. Плавно центрируем экран телефона/ПК ровно на этой ячейке
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
            
            // Исправлено: Безопасное обнуление полей через вспомогательную функцию
            setElementText('current-profile-user', '—');
            setElementText('profile-cell-id', '—');
            setElementText('profile-status', '—');
            setElementText('balance-mitrons', '0 Mitrons');
            setElementText('balance-usd', '$0.00');
            
            const goldenContainer = document.getElementById('golden-cells-status');
            if (goldenContainer) {
                goldenContainer.innerHTML = '';
            }
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// Привязка событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    loadMatrixTree();
    
    // === ОБРАБОТЧИК ДЛЯ СУПЕР-ЗУМА ДО 0.03 ===
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
