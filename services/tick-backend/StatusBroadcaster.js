/**
 * StatusBroadcaster - Handles status updates and broadcasting to clients
 * Manages backend status communication
 */
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
     * Broadcast message to clients subscribed to a symbol from a specific source
     * @param {Object} message - Message to broadcast
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source ('ctrader' or 'tradingview')
     */
    broadcastToClients(message, symbol, source) {
        const key = `${symbol}:${source}`;
        const symbolSubscribers = this.wsServer.subscriptionManager.getSubscribedClients(symbol, source);
        if (!symbolSubscribers) return;

        let jsonMessage;
        try {
            jsonMessage = JSON.stringify(message);
        } catch (error) {
            console.error('[StatusBroadcaster] Failed to stringify message:', error);
            return;
        }

        symbolSubscribers.forEach(client => {
            try {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(jsonMessage);
                }
            } catch (error) {
                console.error('[StatusBroadcaster] Failed to send to client:', error.message);
            }
        });
    }

    /**
     * Send message to a specific client
     * @param {WebSocket} client - Client WebSocket connection
     * @param {Object} data - Data to send
     */
    sendToClient(client, data) {
        if (client.readyState === 1) { // WebSocket.OPEN
            client.send(JSON.stringify(data));
        }
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

    /**
     * Get current backend status
     * @returns {string} Current status
     */
    getCurrentStatus() {
        return this.currentBackendStatus;
    }

    /**
     * Get current available symbols
     * @returns {Array<string>} Available symbols
     */
    getAvailableSymbols() {
        return this.currentAvailableSymbols;
    }
}

module.exports = { StatusBroadcaster };
