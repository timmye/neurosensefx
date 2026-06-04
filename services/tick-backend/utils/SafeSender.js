'use strict';

const BUFFER_THRESHOLD = 64 * 1024; // 64KB
const SLOW_DISCONNECT_CODE = 4002;

/** Number of slow-client disconnects since last counter reset. */
let slowDisconnectCount = 0;

/**
 * Safely send a message to a WebSocket client with backpressure protection.
 * @param {WebSocket} ws - Target WebSocket connection
 * @param {string} message - Stringified message to send
 * @returns {boolean} true if sent, false if skipped (not open or slow client)
 */
function send(ws, message) {
    if (!ws || ws.readyState !== 1) return false;

    if (ws.bufferedAmount > BUFFER_THRESHOLD) {
        slowDisconnectCount++;
        console.warn(`[SafeSender] Disconnecting slow client (bufferedAmount=${ws.bufferedAmount})`);
        try {
            ws.close(SLOW_DISCONNECT_CODE, 'Slow connection');
        } catch (e) {
            // ignore close errors on already-closing sockets
        }
        return false;
    }

    try {
        ws.send(message);
        return true;
    } catch (error) {
        console.error(`[SafeSender] Failed to send: ${error.message}`);
        return false;
    }
}

/**
 * Get and reset the slow-client disconnect counter.
 * @returns {number} Disconnect count since last call
 */
function drainDisconnectCount() {
    const count = slowDisconnectCount;
    slowDisconnectCount = 0;
    return count;
}

module.exports = { send, drainDisconnectCount, BUFFER_THRESHOLD, SLOW_DISCONNECT_CODE };
