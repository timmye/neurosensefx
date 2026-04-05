/**
 * PostgreSQL connection pool and query helper. Raw pg driver, no ORM (ref: DL-004).
 * verifySchema confirms all 5 auth tables exist on startup.
 */
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.PG_HOST || 'localhost',
    port: parseInt(process.env.PG_PORT || '5432', 10),
    database: process.env.PG_DATABASE || 'neurosensefx',
    user: process.env.PG_USER || 'neurosensefx',
    password: process.env.PG_PASSWORD || '',
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000
});

pool.on('error', (err) => {
    console.error('[DB] Unexpected pool error:', err.message);
});

/**
 * Execute a parameterized query using a checked-out client.
 * Client is released in a finally block to prevent pool leaks.
 * @param {string} text - SQL query with $1, $2 placeholders
 * @param {any[]} params
 * @returns {Promise<import('pg').QueryResult>}
 */
async function query(text, params) {
    return pool.query(text, params);
}

/**
 * Verify that all 5 auth tables exist in the public schema.
 * Called on server startup. Logs warning if schema is incomplete.
 */
async function verifySchema() {
    try {
        const result = await query(
            "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('users','sessions','workspaces','drawings','price_markers')"
        );
        const tables = result.rows.map(r => r.table_name);
        if (tables.length === 5) {
            console.log('[DB] Auth schema verified (5 tables found)');
        } else {
            console.warn('[DB] Auth schema incomplete: found ' + tables.length + '/5 tables: ' + tables.join(', '));
        }
    } catch (err) {
        console.error('[DB] Schema verification failed:', err.message);
    }
}

module.exports = { query, pool, verifySchema };
