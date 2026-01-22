/**
 * DataRouter - Routes data from cTrader and TradingView to clients
 * Parallel feeds, no aggregation - just simple routing
 */
class DataRouter {
    constructor(webSocketServer) {
        this.wsServer = webSocketServer;
    }

    /**
     * Route tick data from cTrader
     * @param {Object} tick - cTrader tick data
     */
    routeFromCTrader(tick) {
        const message = {
            type: 'tick',
            source: 'ctrader',
            ...tick
        };
        this.broadcastToClients(message, tick.symbol, 'ctrader');
    }

    /**
     * Route candle data from TradingView
     * @param {Object} candle - TradingView candle data (can be tick or symbolDataPackage)
     */
    routeFromTradingView(candle) {
        // Handle both tick events and symbolDataPackage events
        const price = candle.price || candle.current;
        const message = {
            type: candle.type || 'tick',
            source: 'tradingview',
            symbol: candle.symbol,
            price: price,
            timestamp: candle.timestamp,
            // Include additional fields for symbolDataPackage
            ...(candle.open !== undefined && { open: candle.open }),
            ...(candle.high !== undefined && { high: candle.high }),
            ...(candle.low !== undefined && { low: candle.low }),
            ...(candle.projectedAdrHigh !== undefined && { projectedAdrHigh: candle.projectedAdrHigh }),
            ...(candle.projectedAdrLow !== undefined && { projectedAdrLow: candle.projectedAdrLow }),
            // CRITICAL: Include pipPosition and pipSize
            ...(candle.pipPosition !== undefined && { pipPosition: candle.pipPosition }),
            ...(candle.pipSize !== undefined && { pipSize: candle.pipSize }),
            // Also include current for symbolDataPackage
            ...(candle.current !== undefined && { current: candle.current }),
            // Include initialMarketProfile for Market Profile data
            ...(candle.initialMarketProfile !== undefined && { initialMarketProfile: candle.initialMarketProfile })
        };
        this.broadcastToClients(message, candle.symbol, 'tradingview');
    }

    routeProfileUpdate(symbol, delta, seq) {
        const message = {
            type: 'profileUpdate',
            symbol,
            delta,
            seq
        };
        // Broadcast to both cTrader and TradingView subscribers
        // since MarketProfileService doesn't track which source a symbol uses
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
        // Broadcast to both cTrader and TradingView subscribers
        this.broadcastToClients(error_message, symbol, 'ctrader');
        this.broadcastToClients(error_message, symbol, 'tradingview');
    }

    /**
     * Broadcast message to clients subscribed to a symbol from a specific source
     * @param {Object} message - Message to broadcast
     * @param {string} symbol - Symbol identifier
     * @param {string} source - Data source ('ctrader' or 'tradingview')
     */
    broadcastToClients(message, symbol, source) {
        const key = `${symbol}:${source}`;
        const symbolSubscribers = this.wsServer.backendSubscriptions.get(key);
        if (!symbolSubscribers) return;

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
