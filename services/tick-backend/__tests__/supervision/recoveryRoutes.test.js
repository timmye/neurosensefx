import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from 'vitest';

// Recovery surface (B5): GET /health and dev-only POST /admin/reconnect.
//
// httpServer.js holds `app` and `server` as module-level singletons, so
// addRecoveryRoutes must be called exactly ONCE for the whole suite; calling it
// per-test would double-mount routes (and the module registry isn't reliably
// cleared by vi.resetModules across tests). We therefore mount the routes a
// single time in beforeAll against a thin holder, and each test swaps the
// holder's supervisor/tv spies before issuing requests. The route handlers read
// supervisor/tv from the holder at request time, so the spy under test is the
// one that gets called.
//
// NODE_ENV is 'test' (not 'production') here, so the dev-only /admin/reconnect
// guard permits the call. The production guard is exercised by a dedicated test
// that flips config.nodeEnv.

const http = require('../../httpServer');
const config = require('../../config');

// Holder so route handlers (mounted once) delegate to a per-test mock.
// Each field is reassigned in the test before the request is sent.
const holder = {
    supervisor: { observableState: () => [], reset: () => false },
    tradingViewSession: { reconnect: () => {} },
};

// Routes delegate to holder.* (read at request time, not mount time).
http.addRecoveryRoutes(
    {
        observableState: (...a) => holder.supervisor.observableState(...a),
        reset: (...a) => holder.supervisor.reset(...a),
    },
    { reconnect: (...a) => holder.tradingViewSession.reconnect(...a) }
);

function makeSupervisorMock() {
    return {
        observableState: vi.fn(() => [
            { feed: 'ctrader', state: 'CONNECTED', since: 1, attempts: 0 },
        ]),
        reset: vi.fn(() => true),
    };
}

function makeTvMock() {
    return { reconnect: vi.fn() };
}

function request(server, method, path, body) {
    return new Promise((resolve, reject) => {
        const http = require('http');
        const payload = body != null ? JSON.stringify(body) : null;
        const req = http.request(
            {
                method,
                path,
                port: server.address().port,
                headers: payload
                    ? { 'content-type': 'application/json', 'content-length': Buffer.byteLength(payload) }
                    : {},
            },
            (res) => {
                let data = '';
                res.on('data', (chunk) => { data += chunk; });
                res.on('end', () => {
                    let parsed = null;
                    try { parsed = data.length ? JSON.parse(data) : null; } catch (e) { parsed = data; }
                    resolve({ status: res.statusCode, body: parsed });
                });
            }
        );
        req.on('error', reject);
        if (payload) req.write(payload);
        req.end();
    });
}

describe('Recovery routes (B5)', () => {
    const originalNodeEnv = config.nodeEnv;
    let server;

    beforeAll(async () => {
        server = http.server;
        await new Promise((resolve, reject) => {
            server.listen(0, resolve);
            server.on('error', reject);
        });
    });

    afterAll(async () => {
        await new Promise((resolve) => server.close(resolve));
        config.nodeEnv = originalNodeEnv;
    });

    beforeEach(() => {
        config.nodeEnv = 'test';
        holder.supervisor = makeSupervisorMock();
        holder.tradingViewSession = makeTvMock();
    });

    it('GET /health returns 200 with status ok and feeds, and calls observableState', async () => {
        const res = await request(server, 'GET', '/health');

        expect(res.status).toBe(200);
        expect(res.body.status).toBe('ok');
        expect(Array.isArray(res.body.feeds)).toBe(true);
        expect(res.body.feeds[0]).toEqual({ feed: 'ctrader', state: 'CONNECTED', since: 1, attempts: 0 });
        expect(holder.supervisor.observableState).toHaveBeenCalledTimes(1);
    });

    it('POST /admin/reconnect with feed=ctrader calls supervisor.reset(ctrader)', async () => {
        const res = await request(server, 'POST', '/admin/reconnect', { feed: 'ctrader' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, feed: 'ctrader' });
        expect(holder.supervisor.reset).toHaveBeenCalledWith('ctrader');
        expect(holder.tradingViewSession.reconnect).not.toHaveBeenCalled();
    });

    it('POST /admin/reconnect with feed=tradingview calls tv.reconnect', async () => {
        const res = await request(server, 'POST', '/admin/reconnect', { feed: 'tradingview' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, feed: 'tradingview' });
        expect(holder.tradingViewSession.reconnect).toHaveBeenCalledTimes(1);
        expect(holder.supervisor.reset).not.toHaveBeenCalled();
    });

    it('POST /admin/reconnect with feed=all resets ctrader and reconnects tv', async () => {
        const res = await request(server, 'POST', '/admin/reconnect', { feed: 'all' });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, feed: 'all' });
        expect(holder.supervisor.reset).toHaveBeenCalledWith('ctrader');
        expect(holder.tradingViewSession.reconnect).toHaveBeenCalledTimes(1);
    });

    it('POST /admin/reconnect with omitted feed defaults to all', async () => {
        const res = await request(server, 'POST', '/admin/reconnect', {});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ ok: true, feed: 'all' });
        expect(holder.supervisor.reset).toHaveBeenCalledWith('ctrader');
        expect(holder.tradingViewSession.reconnect).toHaveBeenCalledTimes(1);
    });

    it('POST /admin/reconnect with invalid feed returns 400', async () => {
        const res = await request(server, 'POST', '/admin/reconnect', { feed: 'bogus' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeDefined();
        expect(holder.supervisor.reset).not.toHaveBeenCalled();
    });

    it('POST /admin/reconnect is disabled in production', async () => {
        config.nodeEnv = 'production';

        const res = await request(server, 'POST', '/admin/reconnect', { feed: 'ctrader' });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/disabled in production/);
        expect(holder.supervisor.reset).not.toHaveBeenCalled();
    });
});
