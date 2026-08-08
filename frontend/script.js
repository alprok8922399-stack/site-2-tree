/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/frontend/script.js
 * Назначение: Основной клиентский скрипт управления структурой, 
 * аналитикой, модальными окнами и профилями.
 * =========================================================
 */

const API_URL = window.location.origin;

// === ГЛОБАЛЬНЫЙ КУРС ВАЛЮТЫ ===
const MITRON_RATE_USD = 130 / 1000; 

function convertMitronsToUsd(mitrons) {
    return (Number(mitrons || 0) * MITRON_RATE_USD).toFixed(2);
}

// Вспомогательная функция для безопасного обновления текста в DOM
function setElementText(id, text) {
    const el = document.getElementById(id);
    if (el) {
        el.innerText = text;
    }
}

// === 0. ФИНАНСОВАЯ АНАЛИТИКА АДМИНИСТРАТОРА ===

async function loadAdminStats() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats`);
        if (!response.ok) return;
        const data = await response.json();

        if (data.success && data.stats) {
            const s = data.stats;
            
            // Основной финансовый поток
            setElementText('stat-total-balance', `${s.totalBalance || 0} M`);
            setElementText('stat-income-today', `${s.incomeToday || 0} M`);
            setElementText('stat-income-week', `${s.incomeWeek || 0} M`);
            setElementText('stat-income-month', `${s.incomeMonth || 0} M`);

            // Внешние закупки и статистика покупателей
            setElementText('stat-goods-bought-m', `${s.externalMPPurchases || 0} M`);
            setElementText('stat-buyers-count', `${s.totalBuyersCount || s.buyersCount || 0} чел.`);
            
            // Отказы за сегодня и за все время
            const refusedTodayText = `${s.refundsTodayCount || 0} чел.`;
            const refusedTotalText = `${s.refundsTotalCount || 0} чел.`;

            setElementText('stat-refused-today-count', refusedTodayText);
            setElementText('stat-refused-count', refusedTotalText);

            // Выплаты, резервы, Фонд DAO и Чистая прибыль
            setElementText('stat-cashback-paid', `${s.cashbackPaidTotal || 0} M`);
            setElementText('stat-referrals-paid', `${s.referralsPaidTotal || 0} M`);
            setElementText('stat-referrals-reserve', `${s.referralsInReserve || 0} M`);
            setElementText('stat-in-reserve', `${s.payoutsInReserveTotal || 0} M`);
            
            // Количество лидеров
            setElementText('stat-leaders-count', `${s.qualifyingLeadersCount || 0} чел.`);

            setElementText('stat-dao-fund', `${s.daoFund || 0} M`);
            setElementText('stat-net-profit', `${s.netAdminProfit || 0} M`);

            // Логины
            setElementText('stat-total-logins', s.totalLoginsCount || 0);
            setElementText('stat-admin-logins', s.adminLoginsCount || 0);
            setElementText('stat-user-logins', s.buyerLoginsCount || 0);
        }
    } catch (error) {
        console.error('Ошибка загрузки статистики администратора:', error);
    }
}

async function filterLoginsByDate() {
    const dateFrom = document.getElementById('admin-date-from')?.value;
    const dateTo = document.getElementById('admin-date-to')?.value;
    const resultEl = document.getElementById('logins-date-result');

    if (!dateFrom || !dateTo) {
        alert('Пожалуйста, выберите обе даты (С ... по ...)');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/logins-by-date?from=${dateFrom}&to=${dateTo}`);
        const data = await response.json();

        if (data.success) {
            if (resultEl) {
                resultEl.innerText = `Найдено: ${data.count} логинов (${data.logins ? data.logins.join(', ') : 'нет'})`;
            }
        } else {
            alert(`Ошибка поиска: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка поиска логинов за период:', error);
    }
}

async function simulate33Days() {
    if (!confirm('Вы действительно хотите разморозить 33 дня и списать средства по выбывшим ячейкам?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/admin/expire-33days`, { method: 'POST' });
        const data = await response.json();
        
        if (data.success) {
            alert(data.message || 'Разморозка за 33 дня успешно выполнена!');
            loadAdminStats();
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
        } else {
            alert(`Ошибка симуляции: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка разморозки 33 дней:', error);
    }
}

// === 0.1 МОДУЛЬ УПРАВЛЕНИЯ ЛИДЕРАМИ ===

async function showLeadersModal() {
    const modal = document.getElementById('leadersModal');
    const container = document.getElementById('leadersListContainer');
    if (!modal || !container) return;

    modal.style.display = 'flex';
    container.innerHTML = '<p style="text-align: center; color: #a0a0ab;">Загрузка списка лидеров (10+ личников)...</p>';

    try {
        const response = await fetch(`${API_URL}/api/admin/leaders`);
        const data = await response.json();

        if (data.success && data.leaders) {
            if (data.leaders.length === 0) {
                container.innerHTML = '<p style="text-align: center; color: #71717a;">Нет активных лидеров с 10+ личниками</p>';
                return;
            }

            container.innerHTML = '';
            data.leaders.forEach(leader => {
                const item = document.createElement('div');
                item.className = 'leader-item';
                item.style.cssText = 'display: flex; justify-content: space-between; align-items: center; background: #1a1a20; padding: 10px; border-radius: 6px; margin-bottom: 8px; border: 1px solid #333;';

                const isFrozen = leader.isLeaderFrozen;
                const freezeBtnText = isFrozen ? '▶️ Разморозить выплату' : '❄️ Заморозить выплату';
                const freezeBtnClass = isFrozen ? 'btn-warning' : 'btn-danger';

                item.innerHTML = `
                    <div>
                        <strong style="color: #2ecc71; font-size: 16px; cursor: pointer; text-decoration: underline;" onclick="loadUserProfile('${leader.username}')">${leader.username}</strong>
                        <div style="font-size: 12px; color: #a0a0ab; margin-top: 4px;">
                            Личников: <strong style="color: #fff;">${leader.activeDirectCount || 0}</strong> | 
                            Статус: <span style="color: ${isFrozen ? '#e74c3c' : '#2ecc71'}; font-weight: bold;">${isFrozen ? 'Заморожен (+7 M на паузе)' : 'Активен (+7 M)'}</span>
                        </div>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="${freezeBtnClass}" style="padding: 6px 12px; font-size: 12px; border-radius: 4px; border: none; cursor: pointer;" onclick="toggleLeaderFreeze('${leader.username}', ${!isFrozen})">
                            ${freezeBtnText}
                        </button>
                        <button class="btn-danger" style="padding: 6px 12px; font-size: 12px; background: #900C3F; color: #fff; border: none; border-radius: 4px; cursor: pointer;" onclick="excludeLeader('${leader.username}')">
                            ❌ Исключить из лидеров
                        </button>
                    </div>
                `;
                container.appendChild(item);
            });
        } else {
            container.innerHTML = `<p style="text-align: center; color: #e74c3c;">Ошибка: ${data.error || 'Не удалось загрузить данные'}</p>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки лидеров:', error);
        container.innerHTML = '<p style="text-align: center; color: #e74c3c;">Сбой сети при загрузке лидеров</p>';
    }
}

function closeLeadersModal() {
    const modal = document.getElementById('leadersModal');
    if (modal) modal.style.display = 'none';
}

async function toggleLeaderFreeze(username, freezeState) {
    const actionText = freezeState ? 'заморозить' : 'разморозить';
    if (!confirm(`Вы действительно хотите ${actionText} лидерские выплаты (+7 M) для ${username}?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/leaders/freeze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, freeze: freezeState })
        });
        const data = await response.json();

        if (data.success) {
            alert(data.message || 'Статус заморозки изменен!');
            showLeadersModal();
        } else {
            alert(`Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка изменения заморозки лидера:', error);
    }
}

async function excludeLeader(username) {
    if (!confirm(`Вы действительно хотите ИСКЛЮЧИТЬ ${username} из состава лидеров? Начисления по 7 M с вновь прибывших прекратятся!`)) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/leaders/exclude`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (data.success) {
            alert(data.message || 'Пользователь исключен из состава лидеров!');
            showLeadersModal();
            loadAdminStats();
        } else {
            alert(`Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка исключения лидера:', error);
    }
}

// === 1. РЕГИСТРАЦИЯ И УПРАВЛЕНИЕ СТРУКТУРОЙ ===

async function registerInMatrix() {
    const usernameInput = document.getElementById('matrix-username');
    const sponsorInput = document.getElementById('matrix-sponsor');
    
    if (!usernameInput || !usernameInput.value.trim()) {
        alert('Введите имя пользователя для регистрации');
        return;
    }

    const payload = {
        username: usernameInput.value.trim(),
        uplineUser: sponsorInput ? sponsorInput.value.trim() : ''
    };

    try {
        const response = await fetch(`${API_URL}/api/shop/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Успешно! Позиция занята в структуре: ${result.cellId}`);
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
            loadAdminStats();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка регистрации в структуре:', error);
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
            body: JSON.stringify({ username: shopUserStr, uplineUser: shopSponsorStr })
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Покупатель ${shopUserStr} успешно зарегистрирован!`);
            loadUserProfile(shopUserStr);
            loadAdminStats();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка регистрации покупателя:', error);
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
            setElementText('profile-cell-id', cellId || 'Нет позиции');
            
            const statusEl = document.getElementById('profile-status');
            if (statusEl) {
                if (data.profile.isPaid) {
                    const paidAt = data.profile.paymentDate ? new Date(data.profile.paymentDate) : new Date();
                    const diffTime = Math.abs(new Date() - paidAt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays >= 33) {
                        statusEl.innerText = `Оплачен (Период 33 дней прошел)`;
                        statusEl.style.backgroundColor = '#5cb85c';
                    } else {
                        statusEl.innerText = `Заморозка (${33 - diffDays} дн. до выплаты)`;
                        statusEl.style.backgroundColor = '#f0ad4e';
                    }
                    statusEl.style.color = '#ffffff';
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
            
            // --- 3 КОШЕЛЬКА СУБЪЕКТА ---
            const balances = data.profile.balances || {};
            const cleanWithdraw = balances.cleanWithdraw || balances.mitrons || 0;
            const payoutReserve = balances.payoutReserve || 0;
            const transitBuffer = balances.transitBuffer || 0;

            setElementText('balance-mitrons', `${cleanWithdraw} M (Баланс) | ${payoutReserve} M (Выплатной) | ${transitBuffer} M (Буфер)`);
            setElementText('balance-usd', `$${convertMitronsToUsd(cleanWithdraw)}`);

            setElementText('balance-clean-withdraw', `${cleanWithdraw} M`);
            setElementText('balance-payout-reserve', `${payoutReserve} M`);
            setElementText('balance-transit-buffer', `${transitBuffer} M`);
            
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

            renderReferralsSection(data.username, data.referralsData, searchQuery);
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// Рендер секции личников внутри карточки
let searchTimeout = null;
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
    header.innerHTML = `<span>Лично приглашенные: <strong style="color:#3498db;">${refData.totalCount || 0}</strong></span>`;
    wrapper.appendChild(header);

    if (refData.totalCount > 0) {
        const searchBox = document.createElement('div');
        searchBox.style.cssText = 'margin-bottom: 8px; display: flex; gap: 6px;';
        
        const input = document.createElement('input');
        input.type = 'text';
        input.placeholder = 'Поиск по личникам...';
        input.value = currentSearch;
        input.style.cssText = 'flex: 1; padding: 5px 8px; background: #0e0e12; border: 1px solid #333; color: #fff; border-radius: 4px; font-size: 12px;';
        
        input.oninput = (e) => {
            if (searchTimeout) clearTimeout(searchTimeout);
            const val = e.target.value;
            searchTimeout = setTimeout(() => {
                loadUserProfile(username, val, 1);
            }, 300);
        };

        searchBox.appendChild(input);
        wrapper.appendChild(searchBox);
    }

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
    if (!confirm('Вы уверены, что хотите полностью очистить систему структуры и балансов?')) return;
    
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
            
            closeUserProfileCard();
            loadAdminStats();
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// === ГЛОБАЛЬНЫЕ МОСТЫ СВЯЗИ ===
window.showUserCard = loadUserProfile;
window.closeUserCard = closeUserProfileCard;
window.filterLoginsByDate = filterLoginsByDate;
window.simulate33Days = simulate33Days;
window.showLeadersModal = showLeadersModal;
window.closeLeadersModal = closeLeadersModal;
window.toggleLeaderFreeze = toggleLeaderFreeze;
window.excludeLeader = excludeLeader;

window.focusMatrixOnUser = (login) => {
    if (typeof window.searchMatrixUser === 'function') {
        window.searchMatrixUser(login);
    } else {
        loadUserProfile(login);
    }
};

// Привязка событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    loadAdminStats();

    const searchBtn = document.getElementById('search-profile-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('search-username-input');
            const inputName = searchInput ? searchInput.value.trim() : '';
            if (inputName) loadUserProfile(inputName);
        });
    }

    const leadersStatCard = document.getElementById('stat-leaders-count')?.closest('.stat-card') || document.getElementById('stat-leaders-count');
    if (leadersStatCard) {
        leadersStatCard.style.cursor = 'pointer';
        leadersStatCard.addEventListener('click', showLeadersModal);
    }

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
                          e.target.closest('[onclick*="loadUserProfile"]') ||
                          e.target.closest('[onclick*="viewUserCardTrigger"]') ||
                          e.target.closest('#leadersModal') ||
                          e.target.closest('#stat-leaders-count');

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
