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
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
            if (typeof window.renderUsersTable === 'function') {
                window.renderUsersTable();
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
        const response = await fetch(`${API_URL}/api/register-shop`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'x-internal-key': INTERNAL_SECRET_KEY
            },
            body: JSON.stringify({ username: shopUserStr, sponsor: shopSponsorStr })
        });
        const result = await response.json();
        
        if (result.success) {
            alert(`Покупатель ${shopUserStr} успешно зарегистрирован!`);
            loadUserProfile(shopUserStr);
            if (typeof window.renderUsersTable === 'function') {
                window.renderUsersTable();
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
            loadSystemWallets();
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

// Загрузка состояния системных кошельков
async function loadSystemWallets() {
    try {
        const response = await fetch(`${API_URL}/api/system-wallets`);
        const data = await response.json();
        if (data.success) {
            const adminM = data.adminWallet || 0;
            const daoM = data.daoWallet || 0;
            
            setElementText('sys-admin-wallet', `${adminM} M ($${convertMitronsToUsd(adminM)})`);
            setElementText('sys-dao-wallet', `${daoM} M ($${convertMitronsToUsd(daoM)})`);
        }
    } catch (e) {
        console.error('Не удалось загрузить данные системных кошельков:', e);
    }
}

// === 3. ИНФО-КАРТОЧКА ПОЛЬЗОВАТЕЛЯ И КНОПКИ АДМИНИСТРАТОРА ===

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
                modal.style.maxWidth = '900px';
                modal.style.width = '90%';
                modal.style.transform = 'scale(1.05)';
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
            
            // Расширенная информация о балансе и покупках
            const mitronsBalance = data.profile ? (data.profile.balanceMitrons || (data.profile.balances ? data.profile.balances.mitrons : 0)) : 0;
            const certAmount = data.profile && data.profile.purchases ? data.profile.purchases.certificateAmount : 1000;
            const spentAmount = data.profile && data.profile.spent ? data.profile.spent.mitrons : 0;

            setElementText('balance-mitrons', `${mitronsBalance} Mitrons`);
            setElementText('balance-usd', `($${convertMitronsToUsd(mitronsBalance)})`);

            // Детальная информация по балансу
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
                balanceDetailsEl.innerHTML = `
                    <div style="margin-bottom: 3px;">🎫 Покупка сертификата: <strong>${certAmount} М</strong></div>
                    <div style="margin-bottom: 3px;">🛒 Потрачено на товар: <strong>${spentAmount} М</strong></div>
                    <div>📍 Логин в ячейке/ячейках: <strong style="color:#2ecc71;">${cellsList}</strong></div>
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
            container = document.createElement('div');
            container.id = 'admin-actions-container';
            container.style.cssText = 'display: flex; gap: 10px; margin-top: 15px; border-top: 1px solid #333; padding-top: 10px;';
            modal.appendChild(container);
        }
    }

    if (!container) return;

    container.innerHTML = `
        <button id="btn-freeze-user" style="flex: 1; padding: 10px; background: ${isFrozen ? '#27ae60' : '#f39c12'}; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            ${isFrozen ? '🔓 Разморозить выплаты' : '❄️ Заморозить выплату'}
        </button>
        <button id="btn-delete-user" style="flex: 1; padding: 10px; background: #e74c3c; color: #fff; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">
            🚫 Заблокировать и удалить (передать логин Админу)
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
            }
        } catch (e) {
            alert('Ошибка при изменении статуса заморозки');
        }
    };

    document.getElementById('btn-delete-user').onclick = async () => {
        if (!confirm(`Вы уверены, что хотите заблокировать и удалить аккаунт ${username}? Все его ячейки перейдут к Администрации!`)) return;
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
                if (typeof window.renderMatrixTree === 'function') window.renderMatrixTree();
                if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
            }
        } catch (e) {
            alert('Ошибка при удалении пользователя');
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

// === 4. КАРТОЧКА АДМИНИСТРАТОРА ===

async function openAdminCard() {
    try {
        const response = await fetch(`${API_URL}/api/admin/stats`);
        const data = await response.json();

        if (data.success) {
            const stats = data.stats;
            let modal = document.getElementById('admin-stats-modal');

            if (!modal) {
                modal = document.createElement('div');
                modal.id = 'admin-stats-modal';
                modal.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); background: #15151e; color: #fff; border: 2px solid #e74c3c; border-radius: 8px; padding: 20px; z-index: 10000; width: 90%; max-width: 500px; box-shadow: 0 0 25px rgba(231,76,60,0.5);';
                document.body.appendChild(modal);
            }

            modal.innerHTML = `
                <div style="display:flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 15px;">
                    <h3 style="margin: 0; color: #e74c3c;">👑 Карточка Администратора</h3>
                    <button onclick="document.getElementById('admin-stats-modal').style.display='none'" style="background:none; border:none; color:#fff; font-size: 20px; cursor:pointer; font-weight:bold;">✖</button>
                </div>
                <div style="display: grid; gap: 8px; font-size: 14px;">
                    <div>💰 <strong>Общий баланс:</strong> ${stats.totalBalance || 0} M ($${convertMitronsToUsd(stats.totalBalance || 0)})</div>
                    <div>📈 <strong>Поступило за сегодня:</strong> ${stats.incomeToday || 0} M</div>
                    <div>📅 <strong>Поступило за неделю:</strong> ${stats.incomeWeek || 0} M</div>
                    <div>📆 <strong>Поступило за месяц:</strong> ${stats.incomeMonth || 0} M</div>
                    <hr style="border-color: #333; margin: 4px 0;">
                    <div>🎁 <strong>Выплачено по акции (кешбэк 100%):</strong> ${stats.cashbackPaid || 0} M</div>
                    <div>🤝 <strong>Выплачено реферальных:</strong> ${stats.refPayouts || 0} M</div>
                    <div>🔒 <strong>В резерве на выплаты (всего):</strong> ${stats.totalReserve || 0} M</div>
                    <div>💵 <strong>Чистая прибыль:</strong> <strong style="color: #2ecc71;">${stats.netProfit || 0} M</strong></div>
                    <hr style="border-color: #333; margin: 4px 0;">
                    <div>👥 <strong>Всего Логинов в системе:</strong> ${stats.totalUsers || 0}</div>
                    <div style="padding-left: 15px; color: #aaa;">• Логинов админа: ${stats.adminLogins || 0}</div>
                    <div style="padding-left: 15px; color: #aaa;">• Логинов покупателей: ${stats.buyerLogins || 0}</div>
                </div>
            `;
            modal.style.display = 'block';
        }
    } catch (e) {
        alert('Ошибка загрузки статистики Администратора');
    }
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
            if (typeof window.renderMatrixTree === 'function') window.renderMatrixTree();
            if (typeof window.renderUsersTable === 'function') window.renderUsersTable();
            closeUserProfileCard();
            loadSystemWallets();
        }
    } catch (error) {
        console.error('Ошибка при сбросе системы:', error);
    }
}

// === ГЛОБАЛЬНЫЕ МОСТЫ СВЯЗИ ===
window.showUserCard = loadUserProfile;
window.closeUserCard = closeUserProfileCard;
window.openAdminCard = openAdminCard;

// Привязка событий после загрузки страницы
document.addEventListener('DOMContentLoaded', () => {
    loadSystemWallets();

    const searchBtn = document.getElementById('search-profile-btn');
    if (searchBtn) {
        searchBtn.addEventListener('click', () => {
            const searchInput = document.getElementById('search-username-input');
            const inputName = searchInput ? searchInput.value.trim() : '';
            if (inputName) loadUserProfile(inputName);
        });
    }

    // Обработчик закрытия карточки по клику вне ее
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
                          e.target.closest('[onclick*="openAdminCard"]');

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
