/**
 * =========================================================
 * ПРОЕКТ MITRON — САЙТ 2 (site-2-tree)
 * Файловый путь: site-2-tree/backend/middleware.js
 * Назначение: Защита эндпоинтов по секретному ключу (x-internal-key)
 * =========================================================
 */

const INTERNAL_SECRET = process.env.INTERNAL_SECRET || "alprok8922399_mitron_secret_key";

/**
 * Middleware для проверки секретного ключа между серверами
 */
function verifyInternalRequest(req, res, next) {
    // Пропускаем публичные запросы на чтение дерева и GET статусов
    if (req.method === 'GET') {
        return next();
    }

    const clientKey = req.headers['x-internal-key'];
    
    if (!clientKey || clientKey !== INTERNAL_SECRET) {
        console.warn(`[БЕЗОПАСНОСТЬ] Отклонен запрос без валидного ключа с IP: ${req.ip}`);
        return res.status(403).json({ 
            error: 'Доступ запрещен: отсутствует или неверный внутренний ключ защиты' 
        });
    }

    next();
}

module.exports = {
    verifyInternalRequest,
    INTERNAL_SECRET
};
