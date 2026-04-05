/**
 * Shared middleware and singleton sessionManager instance.
 * requireAuth validates the neurosense_session cookie and attaches
 * userId and sessionToken to the request. (ref: DL-005, DL-020)
 */
const { SessionManager, SESSION_COOKIE_NAME } = require('./sessionManager');

const sessionManager = new SessionManager();

/** Standardized JSON error envelope: {error: {code, message}} (ref: DL-014) */
function errorResponse(res, statusCode, code, message) {
    return res.status(statusCode).json({ error: { code, message } });
}

/**
 * Authentication middleware. Reads the session cookie, validates it against
 * Redis, and attaches userId/sessionToken to req. Returns 401 with standard
 * error envelope if cookie is missing or session is invalid/expired.
 */
async function requireAuth(req, res, next) {
    const token = req.cookies[SESSION_COOKIE_NAME];
    if (!token) return errorResponse(res, 401, 'UNAUTHORIZED', 'Authentication required');
    const userId = await sessionManager.validateSession(token);
    if (!userId) return errorResponse(res, 401, 'UNAUTHORIZED', 'Session expired or invalid');
    req.userId = userId;
    req.sessionToken = token;
    next();
}

module.exports = { errorResponse, requireAuth, sessionManager, SESSION_COOKIE_NAME };
