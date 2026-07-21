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

// === 1. РЕГИСТРАЦИЯ И УПРАВЛЕНИЕ МАТРИЦЕЙ ===

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
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка регистрации в матрице:', error);
    }
}

// === 2. МОДУЛЬ МАРКЕТПЛЕЙСА И ОПЛАТЫ ===

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
Списано: ${result.split.totalMitrons} Митронов
-----------------------------------------
Распределение:
💸 Логистика / Товар: ${result.split.adminLogistics} Митронов
🔒 DAO Пул: ${result.split.daoPool} Митронов
            `;
            alert(splitInfo);
            
            loadUserProfile(username);
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
        } else {
            alert(`Ошибка оплаты: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка при оплате тарифа:', error);
    }
}

// === 3. ИНФО-КАРТОЧКА ПОЛЬЗОВАТЕЛЯ И UPLINE TRACKING ===

async function loadUserProfile(username) {
    if (!username || username === '—') return;
    
    try {
        const response = await fetch(`${API_URL}/api/user-details/${encodeURIComponent(username)}`);
        if (!response.ok) throw new Error('Пользователь не найден');
        const data = await response.json();
        
        if (data.success) {
            setElementText('current-profile-user', data.username);
            
            const cellId = data.profile.matrixPosition ? data.profile.matrixPosition.currentCellId : null;
            setElementText('profile-cell-id', cellId || 'Нет места');
            
            // Расчет дней с момента активации и выбор цвета статус-бара
            const statusEl = document.getElementById('profile-status');
            if (statusEl) {
                if (data.profile.isPaid) {
                    const paidAt = data.profile.paymentDate ? new Date(data.profile.paymentDate) : new Date();
                    const diffTime = Math.abs(new Date() - paidAt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    statusEl.innerText = `Оплачен (${diffDays} дн.)`;
                    if (diffDays > 30) {
                        statusEl.style.backgroundColor = '#d9534f'; // Красный цвет
                        statusEl.style.color = '#ffffff';
                    } else {
                        statusEl.style.backgroundColor = '#5cb85c'; // Зеленый цвет
                        statusEl.style.color = '#ffffff';
                    }
                    statusEl.style.padding = '3px 8px';
                    statusEl.style.borderRadius = '4px';
                } else {
                    statusEl.innerText = 'Не оплачен';
                    statusEl.style.backgroundColor = '#777777';
                    statusEl.style.color = '#ffffff';
                    statusEl.style.padding = '3px 8px';
                    statusEl.style.borderRadius = '4px';
                }
            }
            
            const mitronsBalance = data.profile.balances ? data.profile.balances.mitrons : 0;
            setElementText('balance-mitrons', `${mitronsBalance} Mitrons`);
            setElementText('balance-usd', `$${convertMitronsToUsd(mitronsBalance)}`);
            
            // --- ОБРАТНЫЙ СПИСОК СПОНСОРОВ (UPLINE TRACKING) ---
            const uplineContainer = document.getElementById('profile-upline-chain');
            if (uplineContainer) {
                uplineContainer.innerHTML = '';
                
                try {
                    const chainRes = await fetch(`${API_URL}/api/get-referral-chain?login=${encodeURIComponent(username)}`);
                    const chainData = await chainRes.json();
                    
                    if (chainData.success && chainData.chain && chainData.chain.length > 0) {
                        const wrapper = document.createElement('div');
                        wrapper.style.cssText = 'margin-top: 12px; font-size: 14px; background: #1a1a20; padding: 10px; border-radius: 6px; border: 1px solid #33333e;';
                        
                        const title = document.createElement('div');
                        title.style.cssText = 'font-weight: bold; color: #a0a0ab; margin-bottom: 6px; font-size: 13px;';
                        title.innerText = 'Кто пригласил (Цепочка спонсоров):';
                        wrapper.appendChild(title);

                        const traceDiv = document.createElement('div');
                        traceDiv.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; align-items:center;';
                        
                        chainData.chain.forEach((uplineLogin, idx) => {
                            const node = document.createElement('span');
                            if (idx === chainData.chain.length - 1) {
                                // Сам пользователь
                                node.innerHTML = `<strong style="color:#2ecc71; background: #223828; padding: 2px 6px; border-radius: 4px;">${uplineLogin}</strong>`;
                            } else {
                                // Спонсоры
                                node.innerText = uplineLogin;
                                node.style.cursor = 'pointer';
                                node.style.color = '#3498db';
                                node.style.fontWeight = 'bold';
                                node.style.textDecoration = 'underline';
                                node.title = 'Перейти к профилю спонсора';
                                node.onclick = () => loadUserProfile(uplineLogin);
                            }
                            traceDiv.appendChild(node);
                            
                            if (idx < chainData.chain.length - 1) {
                                const arrow = document.createElement('span');
                                arrow.innerText = ' ➔ ';
                                arrow.style.color = '#666666';
                                arrow.style.fontWeight = 'bold';
                                traceDiv.appendChild(arrow);
                            }
                        });
                        
                        wrapper.appendChild(traceDiv);
                        uplineContainer.appendChild(wrapper);
                    }
                } catch (e) {
                    console.error('Не удалось загрузить аплайн-цепочку спонсоров:', e);
                }
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
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
            
            setElementText('current-profile-user', '—');
            setElementText('profile-cell-id', '—');
            setElementText('profile-status', '—');
            setElementText('balance-mitrons', '0 Mitrons');
            setElementText('balance-usd', '$0.00');
            
            const uplineContainer = document.getElementById('profile-upline-chain');
            if (uplineContainer) uplineContainer.innerHTML = '';
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// === ГЛОБАЛЬНЫЕ МОСТЫ СВЯЗИ ===
window.showUserCard = loadUserProfile;
window.focusMatrixOnUser = (login) => {
    if (typeof window.searchMatrixUser === 'function') {
        window.searchMatrixUser(login);
    } else {
        loadUserProfile(login);
    }
};

// Привязка событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    const searchBtn = document.getElementById('search-profile-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('search-username-input');
            const inputName = searchInput ? searchInput.value.trim() : '';
            if (inputName) loadUserProfile(inputName);
        });
    }
});
