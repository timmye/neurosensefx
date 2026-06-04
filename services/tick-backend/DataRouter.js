/**
 * DataRouter - Routes data from cTrader and TradingView to clients
 * Parallel feeds, no aggregation - just simple routing
 */
const { buildCTraderMessage, buildTradingViewMessage, buildCandleUpdateMessage } = require('./utils/MessageBuilder');
const { send: safeSend } = require('./utils/SafeSender');

class DataRouter {
    constructor(webSocketServer) {
        this.wsServer = webSocketServer;
    }

    /**
     * Route tick data from cTrader
     * @param {Object} tick - cTrader tick data
     */
    routeFromCTrader(tick) {
        const routedTick = { ...tick, _receivedAt: Date.now() };
        const message = buildCTraderMessage(routedTick);
        this.broadcastToClients(message, routedTick.symbol, 'ctrader');
    }

    /**
     * Route candle data from TradingView
     * @param {Object} candle - TradingView candle data (can be tick or symbolDataPackage)
     */
    routeFromTradingView(candle) {
        const routedCandle = { ...candle, _receivedAt: Date.now() };
        const message = buildTradingViewMessage(routedCandle);
        this.broadcastToClients(message, routedCandle.symbol, 'tradingview');
    }

    routeProfileUpdate(symbol, profileOrDelta, source, seq, isDelta = false) {
        const message = {
            type: 'profileUpdate',
            symbol,
            feedSource: source,
            seq,
            ...(isDelta ? { delta: profileOrDelta } : { profile: profileOrDelta })
        };
        // Broadcast to ALL sources — profile data is shared regardless of originating feed
        this.broadcastToClients(message, symbol, 'ctrader');
        this.broadcastToClients(message, symbol, 'tradingview');
    }

    routeProfileError(symbol, error, message) {
        const error_message = {
            type: 'profileError',
            symbol,
            error,
            message
        };
        console.error(`[DataRouter] routeProfileError: ${symbol} - ${error}: ${message}`);
        this.broadcastToClients(error_message, symbol, 'ctrader');
        this.broadcastToClients(error_message, symbol, 'tradingview');
    }

    routeTwapUpdate(symbol, data) {
        const message = {
            type: 'twapUpdate',
            symbol,
            data
        };

        try {
            // TWAP is source-agnostic: broadcast to all subscribers regardless of source
            this.broadcastToClients(message, symbol, 'ctrader');
            this.broadcastToClients(message, symbol, 'tradingview');
        } catch (error) {
            console.error(`[DataRouter] Error in routeTwapUpdate for ${symbol}:`, error);
        }
    }

    /**
     * Route candle update data from multi-timeframe subscriptions.
     * Broadcasts to clients tracked in candleSubscriptions (not tick subscribers).
     * @param {Object} candleData - Candle data with symbol, timeframe, bar, isBarClose
     */
    routeCandleUpdate(candleData) {
        const message = buildCandleUpdateMessage(candleData);
        const key = `${candleData.symbol}:${candleData.timeframe}:ctrader`;
        this._routeToCandleSubscribers(key, message);
    }

    /**
     * Route M1 bar data to chart subscribers.
     * Adapts m1Bar format {symbol, open, high, low, close, timestamp} to candleUpdate format.
     * @param {Object} m1Bar - M1 bar data from CTraderEventHandler.processTrendbarEvent
     */
    routeM1CandleUpdate(m1Bar) {
        const key = `${m1Bar.symbol}:M1:ctrader`;
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
        this._routeToCandleSubscribers(key, message);
    }

    /**
     * Route TradingView M1 candle updates to chart subscribers.
     * TradingView M1 bars come from the ticker subscription pipeline
     * (TradingViewCandleHandler.updateM1BarFromTick). This routes them
     * to clients that have subscribed to chart candles with source='tradingview'.
     * @param {Object} m1Bar - M1 bar data { symbol, open, high, low, close, timestamp }
     */
    routeTradingViewM1CandleUpdate(m1Bar) {
        const key = `${m1Bar.symbol}:M1:tradingview`;
        const message = {
            type: 'candleUpdate',
            source: 'tradingview',
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
            isBarClose: true
        };
        this._routeToCandleSubscribers(key, message);
    }

    /**
     * Shared helper: send a message to all clients subscribed to a candle key.
     * @param {string} key - Candle subscription key (symbol:period:source)
     * @param {Object} message - Message to send
     */
    _routeToCandleSubscribers(key, message) {
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
                safeSend(client, jsonMessage);
            } catch (error) {
                console.error('[DataRouter] Failed to send candle update to client:', error.message);
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
        if (!symbolSubscribers) {
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
                safeSend(client, jsonMessage);
            } catch (error) {
                console.error('[DataRouter] Failed to send to client:', error.message);
            }
        });
    }
}

module.exports = { DataRouter };
