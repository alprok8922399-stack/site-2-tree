const API_URL = window.location.origin;
const INTERNAL_SECRET_KEY = 'super_secret_mitron_key_2026';

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

// Универсальный вызов обновления таблицы и дерева
function refreshTableAndTree() {
    if (typeof window.loadReferalsTable === 'function') {
        window.loadReferalsTable();
    } else if (typeof window.renderUsersTable === 'function') {
        window.renderUsersTable();
    }
    if (typeof window.renderMatrixTree === 'function') {
        window.renderMatrixTree();
    }
}

// === 1. АВТО-ОБНОВЛЕНИЕ ВЕРХНЕЙ КАРТОЧКИ АДМИНИСТРАТОРА ===

async function loadAdminAnalyticsCard() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats`);
        const data = await response.json();

        if (data.success) {
            const stats = data.stats || data;

            setElementText('adminTotalBalance', `${stats.totalBalance || 0} M`);
            setElementText('incomeDay', `${stats.incomeToday || stats.incomeDay || 0} M`);
            setElementText('incomeWeek', `${stats.incomeWeek || 0} M`);
            setElementText('incomeMonth', `${stats.incomeMonth || 0} M`);
            setElementText('paidCashback', `${stats.cashbackPaid || stats.paidCashback || 0} M`);
            setElementText('paidRef', `${stats.refPayouts || stats.paidRef || 0} M`);
            setElementText('reservePool', `${stats.totalReserve || stats.reservePool || 0} M`);
            setElementText('netProfit', `${stats.netProfit || 0} M`);

            setElementText('totalLoginsCount', stats.totalUsers || stats.totalLogins || 0);
            setElementText('adminLoginsCount', stats.adminLogins || 0);
            setElementText('buyerLoginsCount', stats.buyerLogins || 0);
        }
    } catch (e) {
        console.error('Ошибка автоматической загрузки аналитики админа:', e);
    }
}

// === 2. ФИЛЬТРАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ПО ДАТАМ "ЗАШЛО В ПРОЕКТ" ===

async function filterUsersByDate() {
    const dateFrom = document.getElementById('date-from')?.value;
    const dateTo = document.getElementById('date-to')?.value;
    const resultsContainer = document.getElementById('date-search-results');

    if (!dateFrom || !dateTo) {
        alert('Выберите обе даты для поиска');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/users-by-date?from=${dateFrom}&to=${dateTo}`);
        const data = await response.json();

        if (data.success && resultsContainer) {
            if (data.users && data.users.length > 0) {
                resultsContainer.innerHTML = `<strong>Найдено (${data.users.length}):</strong> ` + 
                    data.users.map(u => `<span style="color:#3498db; cursor:pointer; text-decoration:underline; margin-right:8px;" onclick="loadUserProfile('${u}')">${u}</span>`).join(', ');
            } else {
                resultsContainer.innerHTML = '<em>За выбранный период логинов не найдено.</em>';
            }
        }
    } catch (e) {
        console.error('Ошибка поиска по датам:', e);
    }
}

function resetDateFilter() {
    const dateFrom = document.getElementById('date-from');
    const dateTo = document.getElementById('date-to');
    const resultsContainer = document.getElementById('date-search-results');
    if (dateFrom) dateFrom.value = '';
    if (dateTo) dateTo.value = '';
    if (resultsContainer) resultsContainer.innerHTML = '';
}

// === 3. РЕГИСТРАЦИЯ И УПРАВЛЕНИЕ МАТРИЦЕЙ ===

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
        const response = await fetch(`${API_URL}/api/register-matrix`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_SECRET_KEY
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Успешно! Место занято в ячейке: ${result.cellId || 'OK'}`);
            loadAdminAnalyticsCard();
            refreshTableAndTree();
        } else {
            alert(`Ошибка: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка регистрации в матрице:', error);
    }
}

// === 4. МОДУЛЬ МАРКЕТПЛЕЙСА И ОПЛАТЫ ===

async function payCertificate() {
    const username = document.getElementById('current-profile-user')?.innerText;
    if (!username || username === '—') {
        alert('Сначала выберите или загрузите профиль пользователя');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/pay-certificate`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_SECRET_KEY
            },
            body: JSON.stringify({ username })
        });
        const result = await response.json();
        
        if (result.success) {
            const adminMitrons = result.split ? result.split.adminLogistics : 1000;
            const splitInfo = `
Активация успешная!
Списано: 1000 Митронов ($130)
-----------------------------------------
Распределение:
💸 Кошелек Администрации (100%): ${adminMitrons} Mitrons ($130.00)
🔒 DAO Пул (Резерв на отказной период 31 день): 1000 Mitrons
            `;
            alert(splitInfo);
            
            loadUserProfile(username);
            loadAdminAnalyticsCard();
            refreshTableAndTree();
        } else {
            alert(`Ошибка оплаты: ${result.error}`);
        }
    } catch (error) {
        console.error('Ошибка при оплате тарифа:', error);
    }
}

// === 5. НОВАЯ ЕДИНАЯ ИНФО-КАРТОЧКА ПОЛЬЗОВАТЕЛЯ И АДМИНИСТРАТОРА ===

function getProfileModalElement() {
    return document.getElementById('userModal') || 
           document.getElementById('profile-modal') || 
           document.querySelector('.modal');
}

async function loadUserProfile(username, searchQuery = '', page = 1) {
    if (!username || username === '—') return;
    
    // Полное удаление любых старых дублирующих модалок (Удаляем старую карточку навсегда!)
    const oldCards = document.querySelectorAll('.old-user-card, .legacy-modal, #legacy-profile-card');
    oldCards.forEach(card => card.remove());

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
            
            const cellsList = (data.cells && data.cells.length > 0) ? data.cells.join(', ') : 'Нет места';
            setElementText('profile-cell-id', cellsList);
            
            // Расчет дней, статуса и отказного периода (31 день)
            const statusEl = document.getElementById('profile-status');
            const isPaid = data.profile ? data.profile.isPaid : false;
            const isFrozen = data.profile ? data.profile.isFrozen : false;

            if (statusEl) {
                if (isFrozen) {
                    statusEl.innerText = '❄️ ВЫПЛАТЫ ЗАМОРОЖЕНЫ';
                    statusEl.style.backgroundColor = '#ff9800';
                    statusEl.style.color = '#000000';
                } else if (isPaid) {
                    const paidAt = (data.profile && data.profile.paymentDate) ? new Date(data.profile.paymentDate) : new Date();
                    const diffDays = Math.floor(Math.abs(new Date() - paidAt) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays <= 31) {
                        statusEl.innerText = `⏳ Отказной период (${diffDays}/31 дн.)`;
                        statusEl.style.backgroundColor = '#f39c12';
                        statusEl.style.color = '#ffffff';
                    } else {
                        statusEl.innerText = `✅ Доступно к выплате (${diffDays} дн.)`;
                        statusEl.style.backgroundColor = '#5cb85c';
                        statusEl.style.color = '#ffffff';
                    }
                } else {
                    statusEl.innerText = 'Не оплачен';
                    statusEl.style.backgroundColor = '#777777';
                    statusEl.style.color = '#ffffff';
                }
                statusEl.style.padding = '6px 12px';
                statusEl.style.borderRadius = '4px';
                statusEl.style.fontWeight = 'bold';
            }
            
            // Расширенная информация о балансе и стороннем Маркетплейсе
            const mitronsBalance = data.profile ? (data.profile.balanceMitrons || (data.profile.balances ? data.profile.balances.mitrons : 0)) : 0;
            const certAmount = data.profile && data.profile.purchases ? data.profile.purchases.certificateAmount : 1000;
            const spentAmount = data.profile && data.profile.spent ? data.profile.spent.mitrons : 0;
            
            const shopPurchasesAmount = data.stats?.shopPurchasesTotal || 0;
            const totalBuyers = data.stats?.totalBuyers || 0;
            const totalRefundedBuyers = data.stats?.totalRefundedBuyers || 0;

            setElementText('balance-mitrons', `${mitronsBalance} Mitrons`);
            setElementText('balance-usd', `($${convertMitronsToUsd(mitronsBalance)})`);

            let balanceDetailsEl = document.getElementById('profile-balance-details');
            if (!balanceDetailsEl) {
                const balanceContainer = document.getElementById('balance-mitrons')?.parentNode;
                if (balanceContainer) {
                    balanceDetailsEl = document.createElement('div');
                    balanceDetailsEl.id = 'profile-balance-details';
                    balanceDetailsEl.style.cssText = 'font-size: 13px; color: #aaa; margin-top: 6px; background: #111; padding: 10px; border-radius: 6px; border: 1px solid #222;';
                    balanceContainer.appendChild(balanceDetailsEl);
                }
            }
            
            if (balanceDetailsEl) {
                let adminExtraRows = '';
                if (data.username === 'ADMIN' || data.isAdmin) {
                    adminExtraRows = `
                        <div style="margin-top: 10px; padding-top: 10px; border-top: 1px dashed #444; color: #f39c12; font-size: 13px; line-height: 1.6;">
                            <div>🛍️ <strong>Куплено товара на стороннем Маркетплейсе на:</strong> ${shopPurchasesAmount} М (одна покупка 450 М)</div>
                            <div style="font-size: 11px; color: #95a5a6; margin-left: 15px;">* Прибыль пересчитывается с остатка с 550 М</div>
                            <div>📦 <strong>Куплено товара всего на:</strong> ${shopPurchasesAmount} М</div>
                            <div>👥 <strong>Купило товара всего:</strong> ${totalBuyers} Покупателей</div>
                            <div style="color: #e74c3c;">🚫 <strong>Отказалось от покупки всего:</strong> ${totalRefundedBuyers} Покупателей</div>
                            <div style="font-size: 11px; color: #e74c3c; margin-left: 15px;">* Доход пересчитывается, реферальные удаляются (деньги в полном объеме возвращаются Покупателю), логин переходит во владение Администрации.</div>
                        </div>
                    `;
                }

                balanceDetailsEl.innerHTML = `
                    <div style="margin-bottom: 3px;">🎫 Покупка сертификата: <strong>${certAmount} М</strong></div>
                    <div style="margin-bottom: 3px;">🛒 Потрачено на товар: <strong>${spentAmount} М</strong></div>
                    <div style="margin-bottom: 3px;">📍 Логин в ячейке/ячейках: <strong style="color:#2ecc71;">${cellsList}</strong></div>
                    ${adminExtraRows}
                `;
            }

            // Цепочка спонсоров (до 5 поколений вглубь)
            const uplineContainer = document.getElementById('profile-upline-chain');
            if (uplineContainer) {
                uplineContainer.innerHTML = '';
                const chain = data.chain || [];
                
                if (chain.length > 0) {
                    const wrapper = document.createElement('div');
                    wrapper.style.cssText = 'margin-top: 12px; font-size: 14px; background: #1a1a20; padding: 10px; border-radius: 6px; border: 1px solid #33333e;';
                    
                    const title = document.createElement('div');
                    title.style.cssText = 'font-weight: bold; color: #a0a0ab; margin-bottom: 6px; font-size: 13px;';
                    title.innerText = 'Кто пригласил (Цепочка до 5 поколений):';
                    wrapper.appendChild(title);

                    const traceDiv = document.createElement('div');
                    traceDiv.style.cssText = 'display:flex; flex-wrap:wrap; gap:6px; align-items:center;';
                    
                    chain.forEach((uplineLogin, idx) => {
                        const node = document.createElement('span');
                        node.innerText = uplineLogin;
                        node.style.cursor = 'pointer';
                        node.style.color = '#3498db';
                        node.style.fontWeight = 'bold';
                        node.onclick = () => loadUserProfile(uplineLogin);
                        traceDiv.appendChild(node);
                        
                        if (idx < chain.length - 1) {
                            const arrow = document.createElement('span');
                            arrow.innerText = ' ➔ ';
                            arrow.style.color = '#666';
                            traceDiv.appendChild(arrow);
                        }
                    });
                    
                    wrapper.appendChild(traceDiv);
                    uplineContainer.appendChild(wrapper);
                }
            }

            renderAdminActionButtons(data.username, isFrozen);
            renderReferralsSection(data.username, data.referralsData, searchQuery);
        }
    } catch (error) {
        console.error('Ошибка загрузки профиля:', error);
    }
}

// Кнопки действия админа в карточке пользователя
function renderAdminActionButtons(username, isFrozen) {
    let container = document.getElementById('admin-actions-container');
    if (!container) {
        const modal = getProfileModalElement();
        if (modal) {
            const targetContainer = modal.querySelector('.modal-content') || modal;
            container = document.createElement('div');
            container.id = 'admin-actions-container';
            container.style.cssText = 'display: flex; gap: 10px; margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;';
            targetContainer.appendChild(container);
        }
    }

    if (!container) return;

    container.innerHTML = `
        <button id="btn-freeze-user" style="flex: 1; padding: 10px; background: ${isFrozen ? '#27ae60' : '#f39c12'}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            ${isFrozen ? '🔓 Разморозить выплаты' : '❄️ Заморозить выплату'}
        </button>
        <button id="btn-delete-user" style="flex: 1; padding: 10px; background: #e74c3c; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            🚫 Оформить отказ / Удалить (передать логин Админу)
        </button>
    `;

    document.getElementById('btn-freeze-user').onclick = async () => {
        try {
            const res = await fetch(`${API_URL}/api/admin/freeze-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_SECRET_KEY },
                body: JSON.stringify({ username, freeze: !isFrozen })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                loadUserProfile(username);
                loadAdminAnalyticsCard();
                refreshTableAndTree();
            }
        } catch (e) {
            alert('Ошибка при изменении статуса заморозки');
        }
    };

    document.getElementById('btn-delete-user').onclick = async () => {
        if (!confirm(`Вы уверены, что покупатель ${username} отказывается от покупки? Средства вернутся Покупателю, реферальные аннулируются, а логин и ячейки перейдут во владение Администрации!`)) return;
        try {
            const res = await fetch(`${API_URL}/api/admin/delete-user`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-internal-key': INTERNAL_SECRET_KEY },
                body: JSON.stringify({ username, transferToAdmin: true })
            });
            const data = await res.json();
            if (data.success) {
                alert(data.message);
                closeUserProfileCard();
                loadAdminAnalyticsCard();
                refreshTableAndTree();
            }
        } catch (e) {
            alert('Ошибка при оформлении отказа пользователем');
        }
    };
}

// Рендер секции личников
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
        moreBtn.onclick = () => loadUserProfile(username, currentSearch, (refData.currentPage || 1) + 1);
        wrapper.appendChild(moreBtn);
    }

    container.appendChild(wrapper);
}

function loadAdminCard() {
    loadUserProfile('ADMIN');
}

function closeUserProfileCard() {
    const modal = getProfileModalElement();
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

function closeUserModal() {
    closeUserProfileCard();
}

async function resetSystem() {
    if (!confirm('Вы уверены, что хотите полностью очистить систему матриц и балансов?')) return;
    
    try {
        const response = await fetch(`${API_URL}/api/reset-database`, { 
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_SECRET_KEY
            }
        });
        const result = await response.json();
        if (result.success) {
            alert('Система успешно сброшена к исходному состоянию!');
            closeUserProfileCard();
            loadAdminAnalyticsCard();
            refreshTableAndTree();
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

function searchProfile() {
    const searchInput = document.getElementById('search-username-input');
    const inputName = searchInput ? searchInput.value.trim() : '';
    if (inputName) loadUserProfile(inputName);
}

// === ГЛОБАЛЬНЫЕ МОСТЫ СВЯЗИ ===
window.showUserCard = loadUserProfile;
window.openUserProfile = loadUserProfile;
window.showProfileModal = loadUserProfile;
window.closeUserCard = closeUserProfileCard;
window.closeUserModal = closeUserModal;
window.loadAdminCard = loadAdminCard;
window.searchProfile = searchProfile;
window.payCertificate = payCertificate;
window.resetSystem = resetSystem;
window.filterUsersByDate = filterUsersByDate;
window.resetDateFilter = resetDateFilter;

// Привязка событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    loadAdminAnalyticsCard();

    // Авто-обновление карточки админа каждые 10 секунд
    setInterval(loadAdminAnalyticsCard, 10000);

    const searchBtn = document.getElementById('search-profile-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', searchProfile);
    }
});
