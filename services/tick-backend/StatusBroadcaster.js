/**
 * StatusBroadcaster - Handles status updates and broadcasting to clients
 * Manages backend status communication
 */
const { send: safeSend } = require('./utils/SafeSender');

class StatusBroadcaster {
    constructor(wsServer) {
        this.wsServer = wsServer;
        this.currentBackendStatus = 'disconnected';
        this.currentAvailableSymbols = [];
    }

    /**
     * Update and broadcast backend status
     * @param {string} status - Backend status ('connected', 'disconnected', 'error')
     * @param {string|null} message - Optional status message
     * @param {Array<string>} availableSymbols - Optional list of available symbols
     */
    broadcastStatus(status, message = null, availableSymbols = []) {
        this.currentBackendStatus = status;
        if (availableSymbols && availableSymbols.length > 0) {
            this.currentAvailableSymbols = availableSymbols;
        }

        const statusData = {
            type: 'status',
            status,
            availableSymbols: this.currentAvailableSymbols,
            symbol: 'system'
        };
        if (message) statusData.message = message;

        this.broadcastToAll(statusData);

        if (status === 'connected') {
            this.broadcastToAll({
                type: 'ready',
                availableSymbols: this.currentAvailableSymbols,
                symbol: 'system'
            });
        }
    }

    /**
     * Broadcast message to all connected clients
     * @param {Object} message - Message to broadcast
     */
    broadcastToAll(message) {
        this.wsServer.wss.clients.forEach(client => {
            this.sendToClient(client, message);
        });
    }

    /**
     * Send message to a specific client
     * @param {WebSocket} client - Client WebSocket connection
     * @param {Object} data - Data to send
     */
    sendToClient(client, data) {
        safeSend(client, JSON.stringify(data));
    }

    /**
     * Send current status to a newly connected client
     * @param {WebSocket} client - Client WebSocket connection
     */
    sendInitialStatus(client) {
        this.sendToClient(client, {
            type: 'status',
            status: this.currentBackendStatus,
            availableSymbols: this.currentAvailableSymbols,
            symbol: 'system'
        });

        if (this.currentBackendStatus === 'connected') {
            this.sendToClient(client, {
                type: 'ready',
                availableSymbols: this.currentAvailableSymbols,
                symbol: 'system'
            });
        }
    }

}

module.exports = { StatusBroadcaster };
