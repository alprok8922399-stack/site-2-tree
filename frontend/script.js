const API_URL = window.location.origin;

// URL Сайта 1 (Маркетплейса) для кросс-серверных запросов симуляции
const SITE1_API_URL = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' 
    ? 'http://localhost:3000' 
    : 'https://site-1-registrar.onrender.com';

// === ГЛОБАЛЬНЫЙ КУРС ВАЛЮТЫ ===
const MITRON_RATE_USD = 130 / 1000; 

function convertMitronsToUsd(mitrons) {
    return (mitrons * MITRON_RATE_USD).toFixed(2);
}

// Вспомогательная функция для защиты от XSS (экранирование)
function escapeHtml(str) {
    if (!str) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
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
            setElementText('stat-total-balance', `${s.totalBalance || 0} M`);
            setElementText('stat-income-today', `${s.incomeToday || 0} M`);
            setElementText('stat-income-week', `${s.incomeWeek || 0} M`);
            setElementText('stat-income-month', `${s.incomeMonth || 0} M`);

            // Внешние закупки и статистика покупателей
            setElementText('stat-goods-bought-m', `${s.goodsBoughtM || 0} M`);
            setElementText('stat-buyers-count', `${s.buyersCount || 0} чел.`);
            setElementText('stat-refused-today-count', `${s.refusedTodayCount || s.refusedTodayText || s.refusedToday || 0}`);
            setElementText('stat-refused-count', `${s.refusedCount || s.refusedTotalText || 0}`);

            // Выплаты, резервы, Фонд DAO и Чистая прибыль
            setElementText('stat-cashback-paid', `${s.cashbackPaid || 0} M`);
            setElementText('stat-referrals-paid', `${s.referralsPaid || 0} M`);
            setElementText('stat-referrals-reserve', `${s.referralsReserve || 0} M`);
            setElementText('stat-in-reserve', `${s.inReserve || 0} M`);
            setElementText('stat-dao-fund', `${s.daoFund || 0} M`);
            setElementText('stat-net-profit', `${s.netProfit || 0} M`);

            // Логины
            setElementText('stat-total-logins', s.totalLogins || 0);
            setElementText('stat-admin-logins', s.adminLogins || 0);
            setElementText('stat-user-logins', s.userLogins || 0);
        }
        
        // Автоматически обновляем количество квалифицированных Лидеров (10+ личников)
        loadLeadersCount();
    } catch (error) {
        console.error('Ошибка загрузки статистики администратора:', error);
    }
}

// === МОДУЛЬ УПРАВЛЕНИЯ ЛИДЕРАМИ (10+ ЛИЧНО-ПРИГЛАШЕННЫХ) ===

async function loadLeadersCount() {
    try {
        const response = await fetch(`${API_URL}/api/admin/leaders`);
        if (!response.ok) return;
        const data = await response.json();
        if (data.success && Array.isArray(data.leaders)) {
            setElementText('stat-leaders-count', `${data.leaders.length} чел.`);
        }
    } catch (error) {
        console.error('Ошибка загрузки количества лидеров:', error);
    }
}

async function openLeadersModal() {
    const modal = document.getElementById('leaders-modal');
    if (modal) {
        modal.style.display = 'block';
        modal.classList.add('active');
        await renderLeadersList();
    }
}

function closeLeadersModal() {
    const modal = document.getElementById('leaders-modal');
    if (modal) {
        modal.style.display = 'none';
        modal.classList.remove('active');
    }
}

async function renderLeadersList() {
    const listContainer = document.getElementById('modal-leaders-list') || 
                          document.getElementById('leaders-list-container') ||
                          document.getElementById('leaders-list');

    if (!listContainer) {
        console.warn('Контейнер для списка лидеров не найден в DOM HTML');
        return;
    }

    listContainer.innerHTML = '<div style="color:#aaa; font-size:12px; padding:10px;">Загрузка списка лидеров...</div>';

    try {
        const response = await fetch(`${API_URL}/api/admin/leaders`);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();

        if (data.success && Array.isArray(data.leaders)) {
            setElementText('stat-leaders-count', `${data.leaders.length} чел.`);

            if (data.leaders.length === 0) {
                listContainer.innerHTML = '<div style="color:#777; font-size:12px; padding:10px;">Лидеров пока нет (нужно 10+ активных личников)</div>';
                return;
            }

            listContainer.innerHTML = '';
            data.leaders.forEach(leader => {
                const item = document.createElement('div');
                item.style.cssText = 'display:flex; justify-content:space-between; align-items:center; background:#1e1e26; padding:8px 10px; margin-bottom:6px; border-radius:4px; border:1px solid #333; font-size:13px;';

                const isFrozen = leader.isPayoutFrozen;
                const freezeBtnText = isFrozen ? '❄️ Разморозить' : '🧊 Заморозить';
                const freezeBtnBg = isFrozen ? '#27ae60' : '#e67e22';
                const safeUsername = escapeHtml(leader.username);

                item.innerHTML = `
                    <div>
                        <strong style="color:#f39c12; cursor:pointer;" onclick="loadUserProfile('${safeUsername}')">${safeUsername}</strong>
                        <span style="color:#888; font-size:11px; margin-left:8px;">(Личников: ${leader.activeDirectCount || 10})</span>
                        ${isFrozen ? '<span style="color:#e74c3c; font-size:11px; margin-left:6px;">[Заморожен]</span>' : ''}
                    </div>
                    <div style="display:flex; gap:6px;">
                        <button onclick="toggleLeaderFreeze('${safeUsername}')" style="background:${freezeBtnBg}; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">${freezeBtnText}</button>
                        <button onclick="removeLeader('${safeUsername}')" style="background:#c0392b; color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer; font-size:11px;">❌ Исключить</button>
                    </div>
                `;
                listContainer.appendChild(item);
            });
        } else {
            listContainer.innerHTML = `<div style="color:#e74c3c; font-size:12px; padding:10px;">Ошибка: ${escapeHtml(data.error) || 'Не удалось получить лидеров'}</div>`;
        }
    } catch (error) {
        console.error('Ошибка загрузки списка лидеров:', error);
        listContainer.innerHTML = '<div style="color:#e74c3c; font-size:12px; padding:10px;">Ошибка подключения к серверу</div>';
    }
}

async function addLeaderFromModal() {
    const input = document.getElementById('new-leader-username');
    if (!input) return;
    const username = input.value.trim();

    if (!username) {
        alert('Введите логин пользователя');
        return;
    }

    try {
        const response = await fetch(`${API_URL}/api/admin/leaders/add`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (data.success) {
            input.value = '';
            await renderLeadersList();
            loadAdminStats();
        } else {
            alert(`Ошибка: ${data.error || 'Не удалось добавить лидера'}`);
        }
    } catch (error) {
        console.error('Ошибка добавления лидера:', error);
        alert('Ошибка при добавлении лидера');
    }
}

async function toggleLeaderFreeze(username) {
    try {
        const response = await fetch(`${API_URL}/api/admin/leaders/freeze`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (data.success) {
            await renderLeadersList();
        } else {
            alert(`Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка заморозки выплат лидера:', error);
    }
}

async function removeLeader(username) {
    if (!confirm(`Вы уверены, что хотите исключить пользователя ${username} из Лидеров?`)) return;

    try {
        const response = await fetch(`${API_URL}/api/admin/leaders/remove`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username })
        });
        const data = await response.json();

        if (data.success) {
            await renderLeadersList();
            loadAdminStats();
        } else {
            alert(`Ошибка: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка удаления лидера:', error);
    }
}

// === СИМУЛЯТОР ПРОХОЖДЕНИЯ 31 ДНЯ ДЛЯ ВСЕХ СИСТЕМ (САЙТ 2 + САЙТ 1) ===
async function simulate31Days() {
    try {
        // 1. Симуляция на Сайте 2 (Дерево, балансы, статус 31 дня)
        const response = await fetch(`${API_URL}/api/admin/simulate-31-days`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        // 2. Симуляция на Сайте 1 (Маркетплейс - заказы и таймштампы покупок)
        try {
            await fetch(`${SITE1_API_URL}/api/admin/simulate-31-days`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (e1) {
            console.warn('Внимание: не удалось отправить запрос симуляции на Сайт 1 (Маркетплейс):', e1);
        }

        if (data.success) {
            alert(data.message || 'Симуляция 31 дня успешно выполнена для всей системы!');
            
            // Пересчитываем статистику Админа
            loadAdminStats();

            // Если открыта карточка пользователя — обновляем её
            const currentProfileUser = document.getElementById('current-profile-user')?.innerText;
            if (currentProfileUser && currentProfileUser !== '—') {
                loadUserProfile(currentProfileUser);
            }

            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
        } else {
            alert(`Ошибка симуляции: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка выполнения симуляции 31 дня:', error);
        alert('Не удалось выполнить симуляцию 31 дня');
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
                resultEl.innerText = `Найдено: ${data.count} логинов (${(data.logins || []).join(', ') || 'нет'})`;
            }
        } else {
            alert(`Ошибка поиска: ${data.error}`);
        }
    } catch (error) {
        console.error('Ошибка поиска логинов за период:', error);
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
            body: JSON.stringify({ username: shopUserStr, sponsor: shopSponsorStr })
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
            const split = result.split || {};
            const goodsCost = split.adminLogistics ?? 450;
            const daoFund = split.daoPool ?? 23;
            const netProfit = split.netProfit ?? 207;

            const splitInfo = `
Активация успешна!
Списано: ${split.totalMitrons || 1000} Митронов
-----------------------------------------
Распределение:
💸 Закупка товара (сторонний МП): ${goodsCost} Митронов
🔒 Резерв 100% кешбэка: 250 Митронов
🤝 Реферальный резерв (50+10+10): 70 Митронов
🛡️ Фонд DAO (10% от остатка): ${daoFund} Митронов
💼 Чистая прибыль Админа: ${netProfit} Митронов
            `;
            alert(splitInfo);
            
            loadUserProfile(username);
            if (typeof window.renderMatrixTree === 'function') {
                window.renderMatrixTree();
            }
            loadAdminStats();
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
            setElementText('profile-cell-id', cellId || 'Нет позиции');
            
            // Расчет дней с момента активации и выбор цвета статус-бара
            const statusEl = document.getElementById('profile-status');
            if (statusEl) {
                if (data.profile.isPaid) {
                    const paidAt = data.profile.paymentDate ? new Date(data.profile.paymentDate) : new Date();
                    const diffTime = Math.abs(new Date() - paidAt);
                    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
                    
                    statusEl.innerText = `Оплачен (${diffDays} дн.)`;
                    if (diffDays > 31) {
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
            
            // --- 3 КОШЕЛЬКА СУБЪЕКТА (Администрация / Выплатной / Буфер) ---
            const balances = data.profile.balances || {};
            const cleanWithdraw = balances.cleanWithdraw || balances.mitrons || 0;
            const payoutReserve = balances.payoutReserve || 0;
            const transitBuffer = balances.transitBuffer || 0;

            setElementText('balance-mitrons', `${cleanWithdraw} M (Вывод) | ${payoutReserve} M (Резерв) | ${transitBuffer} M (Буфер)`);
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
                    
                    if (chainData.success && Array.isArray(chainData.chain) && chainData.chain.length > 0) {
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
                            const safeLogin = escapeHtml(uplineLogin);
                            if (idx === chainData.chain.length - 1) {
                                node.innerHTML = `<strong style="color:#2ecc71; background: #223828; padding: 2px 6px; border-radius: 4px;">${safeLogin}</strong>`;
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
    header.style.cssText = 'display: flex; justify-space-between; align-items: center; margin-bottom: 8px; font-weight: bold; color: #a0a0ab; font-size: 13px;';
    header.innerHTML = `<span>Лично приглашенные: <strong style="color:#3498db;">${refData.totalCount || 0}</strong></span>`;
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
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                loadUserProfile(username, e.target.value, 1);
            }, 300);
        };

        searchBox.appendChild(input);
        wrapper.appendChild(searchBox);
    }

    // Список личников
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
        moreBtn.onclick = () => loadUserProfile(username, currentSearch, (refData.currentPage || 1) + 1);
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
window.simulate31Days = simulate31Days;

// Мост связи для работы модального окна Лидеров
window.openLeadersModal = openLeadersModal;
window.closeLeadersModal = closeLeadersModal;
window.addLeaderFromModal = addLeaderFromModal;
window.toggleLeaderFreeze = toggleLeaderFreeze;
window.removeLeader = removeLeader;

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

    // Привязка кнопки тестов 31 дня, если она есть на странице
    const sim31Btn = document.getElementById('simulate-31days-btn');
    if (sim31Btn) {
        sim31Btn.addEventListener('click', simulate31Days);
    }

    // === УНИВЕРСАЛЬНЫЙ ОБРАБОТЧИК ЗАКРЫТИЯ КАРТОЧКИ ПО КЛИКУ ВНЕ ЕЁ ===
    document.addEventListener('click', (e) => {
        const modal = getProfileModalElement();
        if (modal) {
            const computedStyle = window.getComputedStyle(modal);
            if (computedStyle.display !== 'none' && computedStyle.visibility !== 'hidden') {
                const contentBox = modal.querySelector('.modal-content') || 
                                   modal.querySelector('.card-body') || 
                                   modal.querySelector('.user-card-content') || 
                                   modal.children[0];

                const isTrigger = e.target.closest('#search-profile-btn') || 
                                  e.target.closest('#simulate-31days-btn') ||
                                  e.target.closest('.dropdown-btn') || 
                                  e.target.closest('.user-cell-card') ||
                                  e.target.closest('[onclick*="showUserCard"]') ||
                                  e.target.closest('[onclick*="simulate31Days"]') ||
                                  e.target.closest('[onclick*="viewUserCardTrigger"]');

                if (!isTrigger) {
                    if (contentBox) {
                        if (!contentBox.contains(e.target)) {
                            closeUserProfileCard();
                        }
                    } else if (modal === e.target) {
                        closeUserProfileCard();
                    }
                }
            }
        }

        // Закрытие модального окна Лидеров при клике по затемненному фону
        const leadersModal = document.getElementById('leaders-modal');
        if (leadersModal && e.target === leadersModal) {
            closeLeadersModal();
        }
    });
});
