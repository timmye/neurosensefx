/**
 * CRUD API for user-scoped persistence: workspace layout, chart drawings,
 * and price markers. All routes require authentication (ref: DL-003).
 * Uses PostgreSQL JSONB columns — data is always loaded/saved as a complete unit.
 * POST /api/migrate uses a transaction for all-or-nothing insert (ref: DL-022).
 */
const express = require('express');
const { query, pool } = require('./db');
const { requireAuth, errorResponse } = require('./middleware');

const router = express.Router();

// All persistence endpoints require authentication
router.use(requireAuth);

/** PUT /api/workspace — save workspace layout (upsert). */
router.put('/api/workspace', async (req, res) => {
    try {
        await query(
            'INSERT INTO workspaces (user_id, layout, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = CURRENT_TIMESTAMP',
            [req.userId, JSON.stringify(req.body)]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Persistence] PUT /api/workspace error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save workspace');
    }
});

/** GET /api/workspace — load workspace layout. Returns {layout: null} if none exists. */
router.get('/api/workspace', async (req, res) => {
    try {
        const result = await query('SELECT layout FROM workspaces WHERE user_id = $1', [req.userId]);
        if (result.rows.length === 0) {
            return res.json({ layout: null });
        }
        res.json({ layout: result.rows[0].layout });
    } catch (err) {
        console.error('[Persistence] GET /api/workspace error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load workspace');
    }
});

/** PUT /api/drawings/:symbol/:resolution — save drawings with optimistic locking. */
router.put('/api/drawings/:symbol/:resolution', async (req, res) => {
    const { symbol, resolution } = req.params;
    const clientVersion = parseInt(req.headers['x-drawings-version'], 10) || 0;
    try {
        const result = await query(
            `INSERT INTO drawings (user_id, symbol, resolution, data, updated_at, version)
             VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1)
             ON CONFLICT (user_id, symbol, resolution)
             DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP, version = drawings.version + 1
             WHERE drawings.version = $5
             RETURNING version`,
            [req.userId, symbol.toUpperCase(), resolution, JSON.stringify(req.body), clientVersion]
        );
        if (result.rows.length === 0) {
            const current = await query(
                'SELECT data, version FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
                [req.userId, symbol.toUpperCase(), resolution]
            );
            return res.status(409).json({
                error: 'VERSION_CONFLICT',
                data: current.rows[0]?.data || [],
                version: current.rows[0]?.version || 1,
            });
        }
        res.json({ success: true, version: result.rows[0].version });
    } catch (err) {
        console.error('[Persistence] PUT /api/drawings error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save drawings');
    }
});

/** GET /api/drawings/:symbol/:resolution — load drawings with version. */
router.get('/api/drawings/:symbol/:resolution', async (req, res) => {
    const { symbol, resolution } = req.params;
    try {
        const result = await query(
            'SELECT data, version FROM drawings WHERE user_id = $1 AND symbol = $2 AND resolution = $3',
            [req.userId, symbol.toUpperCase(), resolution]
        );
        if (result.rows.length === 0) {
            return res.json({ data: null, version: 0 });
        }
        res.json({ data: result.rows[0].data, version: result.rows[0].version });
    } catch (err) {
        console.error('[Persistence] GET /api/drawings error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load drawings');
    }
});

/** PUT /api/markers/:symbol — save price markers for a symbol (upsert). */
router.put('/api/markers/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        await query(
            'INSERT INTO price_markers (user_id, symbol, data, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol) DO UPDATE SET data = $3, updated_at = CURRENT_TIMESTAMP',
            [req.userId, symbol.toUpperCase(), JSON.stringify(req.body)]
        );
        res.json({ success: true });
    } catch (err) {
        console.error('[Persistence] PUT /api/markers error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to save markers');
    }
});

/** GET /api/markers/:symbol — load price markers for a symbol. */
router.get('/api/markers/:symbol', async (req, res) => {
    const { symbol } = req.params;
    try {
        const result = await query(
            'SELECT data FROM price_markers WHERE user_id = $1 AND symbol = $2',
            [req.userId, symbol.toUpperCase()]
        );
        if (result.rows.length === 0) {
            return res.json({ data: null });
        }
        res.json({ data: result.rows[0].data });
    } catch (err) {
        console.error('[Persistence] GET /api/markers error:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Failed to load markers');
    }
});

/**
 * POST /api/migrate — upload local browser data to server on first login.
 * Uses a PostgreSQL transaction for all-or-nothing insert: if any INSERT fails,
 * the entire migration rolls back and local data is preserved (ref: DL-007, DL-022).
 * Body: {workspace?, drawings?: [{symbol, resolution, data}], markers?: [{symbol, data}]}
 */
router.post('/api/migrate', async (req, res) => {
    const { workspace, drawings, markers } = req.body;
    // Raw pool.connect for transaction control (ref: DL-022)
    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        if (workspace) {
            await client.query(
                'INSERT INTO workspaces (user_id, layout, updated_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT (user_id) DO UPDATE SET layout = $2, updated_at = CURRENT_TIMESTAMP',
                [req.userId, JSON.stringify(workspace)]
            );
        }

        if (drawings && Array.isArray(drawings)) {
            for (const d of drawings) {
                await client.query(
                    'INSERT INTO drawings (user_id, symbol, resolution, data, updated_at, version) VALUES ($1, $2, $3, $4, CURRENT_TIMESTAMP, 1) ON CONFLICT (user_id, symbol, resolution) DO UPDATE SET data = $4, updated_at = CURRENT_TIMESTAMP',
                    [req.userId, d.symbol.toUpperCase(), d.resolution, JSON.stringify(d.data)]
                );
            }
        }

        if (markers && Array.isArray(markers)) {
            for (const m of markers) {
                await client.query(
                    'INSERT INTO price_markers (user_id, symbol, data, updated_at) VALUES ($1, $2, $3, CURRENT_TIMESTAMP) ON CONFLICT (user_id, symbol) DO UPDATE SET data = $3, updated_at = CURRENT_TIMESTAMP',
                    [req.userId, m.symbol.toUpperCase(), JSON.stringify(m.data)]
                );
            }
        }

        await client.query('COMMIT');
        res.json({ success: true });
    } catch (err) {
        // Transaction rollback on any failure — local data remains intact (ref: DL-022)
        await client.query('ROLLBACK');
        console.error('[Persistence] Migration failed, rolled back:', err.message);
        errorResponse(res, 500, 'SERVER_ERROR', 'Data migration failed');
    } finally {
        client.release();
    }
});

module.exports = { persistenceRoutes: router };
