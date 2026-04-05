/**
 * Auth API routes: register, login, logout, GET /api/me.
 * Password hashing uses bcrypt 12 rounds in async mode (ref: DL-008, DL-021).
 * Rate limiting: application-level per-email lockout (10 failures / 15 min) (ref: DL-009).
 * Audit events logged to audit_log table (ref: DL-012, DL-015).
 */
const express = require('express');
const bcrypt = require('bcrypt');
const { query } = require('./db');
const { errorResponse, requireAuth, sessionManager, SESSION_COOKIE_NAME } = require('./middleware');

const router = express.Router();
const BCRYPT_ROUNDS = 12;
const LOGIN_LOCKOUT_THRESHOLD = 10;
// 15-minute lockout window after threshold exceeded (ref: DL-009)
const LOGIN_LOCKOUT_DURATION = 15 * 60;

/** Email format validation: basic structure check only. */
function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

/**
 * Password validation: 8-72 bytes, reject whitespace-only (ref: DL-010).
 * Max 72 bytes prevents silent bcrypt truncation attack.
 */
function isValidPassword(password) {
    if (typeof password !== 'string') return false;
    if (password.length < 8) return false;
    if (Buffer.byteLength(password, 'utf8') > 72) return false;
    if (password.trim().length === 0) return false;
    return true;
}

/** Strip HTML tags and enforce max 128 chars to prevent stored XSS (ref: DL-016). */
function sanitizeDisplayName(name) {
    if (!name) return null;
    return name.replace(/<[^>]*>/g, '').slice(0, 128).trim() || null;
}

/** Check if email is locked out due to too many failed login attempts (ref: DL-009). */
async function isEmailLocked(email) {
    const key = 'login_lockout:' + email;
    const attempts = await sessionManager.redis.get(key);
    return parseInt(attempts, 10) >= LOGIN_LOCKOUT_THRESHOLD;
}

/** Record a failed login attempt. Sets TTL on first failure for auto-expiry. */
async function recordFailedLogin(email) {
    const key = 'login_lockout:' + email;
    const current = await sessionManager.redis.incr(key);
    if (current === 1) {
        await sessionManager.redis.expire(key, LOGIN_LOCKOUT_DURATION);
    }
}

/** Clear failed login counter on successful authentication. */
async function clearLoginAttempts(email) {
    await sessionManager.redis.del('login_lockout:' + email);
}

/** Log an auth event to the audit_log table. Non-blocking: errors are logged but not thrown (ref: DL-012, DL-015). */
async function logAuthEvent(action, userId, details) {
    try {
        await query(
            'INSERT INTO audit_log (action, user_id, details) VALUES ($1, $2, $3)',
            [action, userId, JSON.stringify(details)]
        );
    } catch (err) {
        console.error('[Auth] Audit log failed:', err.message);
    }
}

/** POST /api/register — create account and auto-login. Returns user object. */
router.post('/api/register', async (req, res) => {
    const { email, password, display_name } = req.body;

    if (!email || !password) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    }
    if (!isValidEmail(email)) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Invalid email format');
    }
    if (!isValidPassword(password)) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Password must be 8-72 bytes and not whitespace-only');
    }

    const displayName = sanitizeDisplayName(display_name);

    try {
        const existing = await query('SELECT id FROM users WHERE email = $1', [email]);
        if (existing.rows.length > 0) {
            return errorResponse(res, 409, 'EMAIL_EXISTS', 'An account with this email already exists');
        }

        // Async bcrypt to avoid blocking the event loop during hash (ref: DL-021)
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const result = await query(
            'INSERT INTO users (email, password_hash, display_name) VALUES ($1, $2, $3) RETURNING id, email, display_name',
            [email, passwordHash, displayName]
        );

        const user = result.rows[0];
        await logAuthEvent('register', user.id, { email: email, ip: req.ip, userAgent: req.get('User-Agent') });

        const token = await sessionManager.createSession(user.id);
        res.cookie(SESSION_COOKIE_NAME, token, sessionManager.cookieOptions);

        res.status(201).json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
    } catch (err) {
        console.error('[Auth] Register error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Registration failed');
    }
});

/** POST /api/login — authenticate and create session. Rate limited per email. */
router.post('/api/login', async (req, res) => {
    const { email, password } = req.body;

    if (!email || !password) {
        return errorResponse(res, 400, 'VALIDATION_ERROR', 'Email and password are required');
    }

    // Dual-layer rate limit: application-level per-email check (ref: DL-009)
    const locked = await isEmailLocked(email);
    if (locked) {
        return errorResponse(res, 429, 'RATE_LIMITED', 'Too many failed login attempts. Try again later.');
    }

    try {
        const result = await query('SELECT id, email, password_hash, display_name FROM users WHERE email = $1', [email]);
        if (result.rows.length === 0) {
            await recordFailedLogin(email);
            return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }

        const user = result.rows[0];
        // Async bcrypt.compare to avoid blocking event loop (ref: DL-021)
        const valid = await bcrypt.compare(password, user.password_hash);
        if (!valid) {
            await recordFailedLogin(email);
            return errorResponse(res, 401, 'INVALID_CREDENTIALS', 'Invalid email or password');
        }

        await clearLoginAttempts(email);
        await query('UPDATE users SET last_login_at = CURRENT_TIMESTAMP WHERE id = $1', [user.id]);
        await logAuthEvent('login', user.id, { email: email, ip: req.ip, userAgent: req.get('User-Agent') });

        const token = await sessionManager.createSession(user.id);
        res.cookie(SESSION_COOKIE_NAME, token, sessionManager.cookieOptions);

        res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
    } catch (err) {
        console.error('[Auth] Login error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Login failed');
    }
});

/** POST /api/logout — delete session and clear cookie. Requires auth. */
router.post('/api/logout', requireAuth, async (req, res) => {
    await sessionManager.deleteSession(req.sessionToken);
    await logAuthEvent('logout', req.userId, { ip: req.ip, userAgent: req.get('User-Agent') });
    res.clearCookie(SESSION_COOKIE_NAME, sessionManager.cookieOptions);
    res.json({ success: true });
});

/** GET /api/me — return current user info. Requires auth. */
router.get('/api/me', requireAuth, async (req, res) => {
    try {
        const result = await query('SELECT id, email, display_name, created_at FROM users WHERE id = $1', [req.userId]);
        if (result.rows.length === 0) {
            return errorResponse(res, 401, 'UNAUTHORIZED', 'User not found');
        }
        const user = result.rows[0];
        res.json({ user: { id: user.id, email: user.email, displayName: user.display_name } });
    } catch (err) {
        console.error('[Auth] GET /api/me error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to fetch user');
    }
});

module.exports = { authRoutes: router };
