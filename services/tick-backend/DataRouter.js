/**
 * DataRouter - Routes data from cTrader and TradingView to clients
 * Parallel feeds, no aggregation - just simple routing
 */
const { buildCTraderMessage, buildTradingViewMessage, buildCandleUpdateMessage } = require('./utils/MessageBuilder');

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
     * Route candle update data from multi-timeframe subscriptions.
     * Broadcasts to clients tracked in candleSubscriptions (not tick subscribers).
     * @param {Object} candleData - Candle data with symbol, timeframe, bar, isBarClose
     */
    routeCandleUpdate(candleData) {
        const message = buildCandleUpdateMessage(candleData);
        const key = `${candleData.symbol}:${candleData.timeframe}`;
        const clients = this.wsServer.candleSubscriptions.get(key);
        if (!clients || clients.size === 0) return;

        let jsonMessage;
        try {
            jsonMessage = JSON.stringify(message);
        } catch (error) {
            console.error('[DataRouter] Failed to stringify candle update:', error);
            return;
        }

        clients.forEach(client => {
            try {
                if (client.readyState === 1) {
                    client.send(jsonMessage);
                }
            } catch (error) {
                console.error('[DataRouter] Failed to send candle update to client:', error.message);
            }
        });
    }

    /**
     * Route M1 bar data to chart subscribers.
     * Adapts m1Bar format {symbol, open, high, low, close, timestamp} to candleUpdate format.
     * @param {Object} m1Bar - M1 bar data from CTraderEventHandler.processTrendbarEvent
     */
    routeM1CandleUpdate(m1Bar) {
        const key = `${m1Bar.symbol}:M1`;
        const clients = this.wsServer.candleSubscriptions.get(key);
        if (!clients || clients.size === 0) return;

        const message = buildCandleUpdateMessage({
            symbol: m1Bar.symbol,
            timeframe: 'M1',
            bar: {
                open: m1Bar.open,
                high: m1Bar.high,
                low: m1Bar.low,
                close: m1Bar.close,
                volume: m1Bar.volume || 0,
                timestamp: m1Bar.timestamp
            },
            isBarClose: false
        });

        let jsonMessage;
        try {
            jsonMessage = JSON.stringify(message);
        } catch (error) {
            console.error('[DataRouter] Failed to stringify M1 candle update:', error);
            return;
        }

        clients.forEach(client => {
            try {
                if (client.readyState === 1) {
                    client.send(jsonMessage);
                }
            } catch (error) {
                console.error('[DataRouter] Failed to send M1 candle update to client:', error.message);
            }
        });
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
