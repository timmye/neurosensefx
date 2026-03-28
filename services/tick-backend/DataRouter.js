/**
 * DataRouter - Routes data from cTrader and TradingView to clients
 * Parallel feeds, no aggregation - just simple routing
 */
const { buildCTraderMessage, buildTradingViewMessage } = require('./utils/MessageBuilder');

const DEBUG = process.env.DEBUG_PROFILE === '1';

class DataRouter {
    constructor(webSocketServer) {
        this.wsServer = webSocketServer;
    }

    /**
     * Route tick data from cTrader
     * @param {Object} tick - cTrader tick data
     */
    routeFromCTrader(tick) {
        tick._receivedAt = Date.now();
        const message = buildCTraderMessage(tick);
        this.broadcastToClients(message, tick.symbol, 'ctrader');
    }

    /**
     * Route candle data from TradingView
     * @param {Object} candle - TradingView candle data (can be tick or symbolDataPackage)
     */
    routeFromTradingView(candle) {
        candle._receivedAt = Date.now();
        const message = buildTradingViewMessage(candle);
        this.broadcastToClients(message, candle.symbol, 'tradingview');
    }

    routeProfileUpdate(symbol, profileOrDelta, source, seq, isDelta = false) {
        if (DEBUG) console.log(`[DataRouter] routeProfileUpdate: ${symbol} (${source}), seq=${seq}, isDelta=${isDelta}`);
        const message = {
            type: 'profileUpdate',
            symbol,
            source,
            seq,
            ...(isDelta ? { delta: profileOrDelta } : { profile: profileOrDelta })
        };
        if (DEBUG) console.log(`[DataRouter] About to call broadcastToClients for ${source}`);
        this.broadcastToClients(message, symbol, source);
        if (DEBUG) console.log(`[DataRouter] Profile update broadcast complete for ${symbol}:${source}`);
    }

    routeProfileError(symbol, error, message) {
        const error_message = {
            type: 'profileError',
            symbol,
            error,
            message
        };
        console.log(`[DataRouter] routeProfileError: ${symbol} - ${error}: ${message}`);
        this.broadcastToClients(error_message, symbol, 'ctrader');
        this.broadcastToClients(error_message, symbol, 'tradingview');
    }

    routeTwapUpdate(symbol, data, source) {
        const message = {
            type: 'twapUpdate',
            symbol,
            source, // Add source for frontend routing
            data
        };
        if (DEBUG) console.log(`[DataRouter] routeTwapUpdate called for ${symbol}:${source}:`, JSON.stringify(message));

        try {
            // Broadcast to both cTrader and TradingView subscribers
            // since TWAPService doesn't track which source a symbol uses
            if (DEBUG) console.log(`[DataRouter] About to call broadcastToClients for ${source}`);
            this.broadcastToClients(message, symbol, source);
            if (DEBUG) console.log(`[DataRouter] TWAP update broadcast complete for ${symbol}:${source}`);
        } catch (error) {
            console.error(`[DataRouter] Error in routeTwapUpdate for ${symbol}:${source}:`, error);
        }
    }

    /**
     * Broadcast message to clients subscribed to a symbol from a specific source
     * @param {Object} message - Message to broadcast
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source ('ctrader' or 'tradingview')
     */
    broadcastToClients(message, symbol, source) {
        const symbolSubscribers = this.wsServer.subscriptionManager.getSubscribedClients(symbol, source);
        if (DEBUG) console.log(`[DataRouter] broadcastToClients for ${symbol}:${source}, subscribers: ${symbolSubscribers?.size || 0}`);
        if (!symbolSubscribers) {
            if (DEBUG) console.log(`[DataRouter] No subscribers for ${symbol}:${source}, skipping broadcast`);
            return;
        }

        message.sentAt = Date.now();
        let jsonMessage;
        try {
            jsonMessage = JSON.stringify(message);
        } catch (error) {
            console.error('[DataRouter] Failed to stringify message:', error);
            return;
        }

        symbolSubscribers.forEach(client => {
            try {
                if (client.readyState === 1) { // WebSocket.OPEN
                    client.send(jsonMessage);
                }
            } catch (error) {
                console.error('[DataRouter] Failed to send to client:', error.message);
            }
        });
    }
}

module.exports = { DataRouter };
