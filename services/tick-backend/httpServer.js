/**
 * Express HTTP server integrated into the existing Node.js backend.
 * Shares the same port as the WebSocket server via http.createServer.
 * Dev mode enables CORS for Vite dev server on localhost:5174. (ref: DL-002, DL-018)
 */
const express = require('express');
const http = require('http');
const cookieParser = require('cookie-parser');
const { errorResponse } = require('./middleware');

const app = express();

app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

if (process.env.NODE_ENV !== 'production') {
    // Dev-only CORS: Vite runs on port 5174, backend on 8081 (ref: DL-018)
    const cors = require('cors');
    app.use(cors({
        origin: 'http://localhost:5174',
        credentials: true
    }));
}

// Security headers applied to all responses (ref: DL-017)
app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'DENY');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
});

const { authRoutes } = require('./authRoutes');
app.use(authRoutes);

const { persistenceRoutes } = require('./persistenceRoutes');
app.use(persistenceRoutes);

const server = http.createServer(app);

/**
 * Start the HTTP server on the given port. Returns a Promise that resolves
 * with the http.Server instance once listening.
 * @param {number} port
 * @returns {Promise<http.Server>}
 */
function listen(port) {
    return new Promise((resolve, reject) => {
        server.listen(port, () => {
            console.log(`[HTTP] Express server listening on port ${port}`);
            resolve(server);
        });
        server.on('error', reject);
    });
}

module.exports = { app, server, listen };
