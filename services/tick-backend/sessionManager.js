/**
 * Redis-backed session manager. Session cookies chosen over JWT for
 * single-instance deployment where cookie revocation is instant (ref: DL-001).
 * One session per user: creating a new session invalidates the old one (ref: DL-006).
 * Emits 'sessionInvalidated' event so WebSocket connections can close promptly (ref: DL-023).
 * Redis SPOF is accepted for v1 single-VPS: host failure loses PostgreSQL too (ref: DL-013).
 */
const Redis = require('ioredis');
const crypto = require('crypto');
const EventEmitter = require('events');

const SESSION_COOKIE_NAME = 'neurosense_session';
const SESSION_TTL = 30 * 24 * 60 * 60;
const MAX_AGE_MS = SESSION_TTL * 1000;

class SessionManager extends EventEmitter {
    constructor() {
        super();
        this.redis = new Redis(process.env.REDIS_URL || 'redis://localhost:6379');
        this.redis.on('error', (err) => console.error('[SessionManager] Redis error:', err.message));
    }

    /** Cookie options shared between backend set-cookie and frontend reads (ref: DL-020). */
    get cookieOptions() {
        return {
            path: '/',
            httpOnly: true,
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: MAX_AGE_MS
        };
    }

    /** SHA-256 hash of the raw session token for Redis key storage. */
    hashToken(token) {
        return crypto.createHash('sha256').update(token).digest('hex');
    }

    /**
     * Create a new session for userId. If an existing session exists for this
     * user, it is deleted and 'sessionInvalidated' is emitted so that the
     * corresponding WebSocket connection can be closed (ref: DL-006, DL-023).
     * @param {string} userId
     * @returns {Promise<string>} raw session token (not hashed)
     */
    async createSession(userId) {
        const indexKey = 'sess:user:' + userId;
        const existingTokenHash = await this.redis.get(indexKey);
        if (existingTokenHash) {
            await this.redis.del('sess:' + existingTokenHash);
            this.emit('sessionInvalidated', { userId });
        }

        const token = crypto.randomBytes(48).toString('hex');
        const tokenHash = this.hashToken(token);
        const now = new Date();
        const expiresAt = new Date(now.getTime() + MAX_AGE_MS);

        // Atomic multi: store session data + user-to-session index with shared TTL
        const multi = this.redis.multi();
        multi.set(
            'sess:' + tokenHash,
            JSON.stringify({ userId, createdAt: now.toISOString(), expiresAt: expiresAt.toISOString() }),
            'EX', SESSION_TTL
        );
        multi.set(indexKey, tokenHash, 'EX', SESSION_TTL);
        await multi.exec();

        return token;
    }

    /**
     * Validate a raw session token. Returns userId if valid, null otherwise.
     * @param {string} token
     * @returns {Promise<string|null>}
     */
    async validateSession(token) {
        const tokenHash = this.hashToken(token);
        const data = await this.redis.get('sess:' + tokenHash);
        if (!data) return null;
        try {
            const parsed = JSON.parse(data);
            return parsed.userId;
        } catch (e) {
            return null;
        }
    }

    /**
     * Delete a session and its user-to-session index. Used on logout.
     * @param {string} token
     */
    async deleteSession(token) {
        const tokenHash = this.hashToken(token);
        const data = await this.redis.get('sess:' + tokenHash);
        if (data) {
            try {
                const parsed = JSON.parse(data);
                await this.redis.del('sess:user:' + parsed.userId);
            } catch (e) { }
        }
        await this.redis.del('sess:' + tokenHash);
    }
}

module.exports = { SessionManager, SESSION_COOKIE_NAME };
