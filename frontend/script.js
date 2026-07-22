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
            if (typeof window.refreshReferralTable === 'function') {
                window.refreshReferralTable();
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
            if (typeof window.refreshReferralTable === 'function') {
                window.refreshReferralTable();
            }
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
            if (typeof window.refreshReferralTable === 'function') {
                window.refreshReferralTable();
            }
        } else {
            alert(`Ошибка оплаты: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка при оплате тарифа:', error);
    }
}

// === 3. ИНФО-КАРТОЧКА ПОЛЬЗОВАТЕЛЯ И UPLINE TRACKING ===

function getProfileModalElement() {
    return document.getElementById('profile-modal') || 
           document.querySelector('.user-card-modal') || 
           document.querySelector('.modal') || 
           document.getElementById('user-card');
}

async function loadUserProfile(username, searchQuery = '', page = 1) {
    if (!username || username === '—') return;
    
    try {
        const url = `${API_URL}/api/user-details/${encodeURIComponent(username)}?search=${encodeURIComponent(searchQuery)}&page=${page}`;
        const response = await fetch(url);
        if (!response.ok) throw new Error('Пользователь не найден');
        const data = await response.json();
        
        if (data.success) {
            const modal = getProfileModalElement();
            if (modal) {
                modal.style.display = 'block';
                modal.classList.add('active');
            }

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
                        statusEl.style.backgroundColor = '#d9534f';
                        statusEl.style.color = '#ffffff';
                    } else {
                        statusEl.style.backgroundColor = '#5cb85c';
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
                                node.innerHTML = `<strong style="color:#2ecc71; background: #223828; padding: 2px 6px; border-radius: 4px;">${uplineLogin}</strong>`;
                            } else {
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

            // --- БЛОК СПИСКА ЛИЧНИКОВ С ПОИСКОМ И ПАГИНАЦИЕЙ ---
            renderReferralsSection(data.username, data.referralsData, searchQuery);
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// Рендер секции личников внутри карточки
function renderReferralsSection(username, refData, currentSearch) {
    let container = document.getElementById('profile-referrals-section');
    if (!container) {
        const uplineContainer = document.getElementById('profile-upline-chain');
        if (uplineContainer && uplineContainer.parentNode) {
            container = document.createElement('div');
            container.id = 'profile-referrals-section';
            uplineContainer.parentNode.appendChild(container);
        }
    }

    if (!container || !refData) return;
    container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.style.cssText = 'margin-top: 12px; font-size: 14px; background: #1a1a20; padding: 10px; border-radius: 6px; border: 1px solid #33333e;';

    const header = document.createElement('div');
    header.style.cssText = 'display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-weight: bold; color: #a0a0ab; font-size: 13px;';
    header.innerHTML = `<span>Лично приглашенные: <strong style="color:#3498db;">${refData.totalCount}</strong></span>`;
    wrapper.appendChild(header);

    // Строка поиска по личникам
    if (refData.totalCount > 0) {
        const searchBox = document.createElement('div');
        searchBox.style.cssText = 'margin-bottom: 8px; display: flex; gap: 6px;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Поиск по личникам...';
        input.value = currentSearch;
        input.style.cssText = 'flex: 1; padding: 5px 8px; background: #0e0e12; border: 1px solid #333; color: #fff; border-radius: 4px; font-size: 12px;';
        
        let timeout = null;
        input.oninput = (e) => {
            clearTimeout(timeout);
            timeout = setTimeout(() => {
                loadUserProfile(username, e.target.value, 1);
            }, 300);
        };

        searchBox.appendChild(input);
        wrapper.appendChild(searchBox);
    }

    // Список личников (чипсы)
    const listDiv = document.createElement('div');
    listDiv.style.cssText = 'display: flex; flex-wrap: wrap; gap: 6px; align-items: center; max-height: 150px; overflow-y: auto; padding: 4px;';

    if (refData.list && refData.list.length > 0) {
        refData.list.forEach(refUser => {
            const chip = document.createElement('span');
            chip.innerText = refUser;
            chip.style.cssText = 'background: #252530; color: #3498db; padding: 3px 8px; border-radius: 4px; font-weight: bold; cursor: pointer; text-decoration: underline; font-size: 12px;';
            chip.onclick = () => loadUserProfile(refUser);
            listDiv.appendChild(chip);
        });
    } else {
        const emptyMsg = document.createElement('div');
        emptyMsg.style.cssText = 'color: #777; font-size: 12px; padding: 4px 0;';
        emptyMsg.innerText = currentSearch ? 'Никого не найдено' : 'Нет личных приглашений';
        listDiv.appendChild(emptyMsg);
    }

    wrapper.appendChild(listDiv);

    // Кнопка "Загрузить ещё"
    if (refData.hasMore) {
        const moreBtn = document.createElement('button');
        moreBtn.innerText = 'Показать ещё...';
        moreBtn.style.cssText = 'margin-top: 8px; width: 100%; padding: 6px; background: #2a2a36; border: 1px solid #444; color: #3498db; border-radius: 4px; cursor: pointer; font-size: 12px;';
        moreBtn.onclick = () => loadUserProfile(username, currentSearch, refData.currentPage + 1);
        wrapper.appendChild(moreBtn);
    }

    container.appendChild(wrapper);
}

function closeUserProfileCard() {
    const modal = getProfileModalElement();
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
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
            if (typeof window.refreshReferralTable === 'function') {
                window.refreshReferralTable();
            }
            
            setElementText('current-profile-user', '—');
            setElementText('profile-cell-id', '—');
            setElementText('profile-status', '—');
            setElementText('balance-mitrons', '0 Mitrons');
            setElementText('balance-usd', '$0.00');
            
            const uplineContainer = document.getElementById('profile-upline-chain');
            if (uplineContainer) uplineContainer.innerHTML = '';
            
            closeUserProfileCard();
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// === ГЛОБАЛЬНЫЕ МОСТЫ СВЯЗИ ===
window.showUserCard = loadUserProfile;
window.closeUserCard = closeUserProfileCard;
window.registerInMatrix = registerInMatrix;
window.registerShopUser = registerShopUser;
window.payCertificate = payCertificate;
window.resetSystem = resetSystem;
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

    // === УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК ЗАКРЫТИЯ КАРТОЧКИ ПО КЛИКУ ВНЕ ЕЁ ===
    document.addEventListener('click', (e) => {
        const modal = getProfileModalElement();
        if (!modal) return;

        const computedStyle = window.getComputedStyle(modal);
        if (computedStyle.display === 'none' || computedStyle.visibility === 'hidden') return;

        const contentBox = modal.querySelector('.modal-content') || 
                           modal.querySelector('.card-body') || 
                           modal.querySelector('.user-card-content') || 
                           modal.children[0];

        const isTrigger = e.target.closest('#search-profile-btn') || 
                          e.target.closest('.dropdown-btn') || 
                          e.target.closest('.user-cell-card') ||
                          e.target.closest('[onclick*="showUserCard"]') ||
                          e.target.closest('[onclick*="viewUserCardTrigger"]');

        if (isTrigger) return;

        if (contentBox) {
            if (!contentBox.contains(e.target)) {
                closeUserProfileCard();
            }
        } else if (modal === e.target) {
            closeUserProfileCard();
        }
    });
});
