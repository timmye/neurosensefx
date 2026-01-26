const WebSocket = require('ws');
const { DataRouter } = require('./DataRouter');
const { MarketProfileService } = require('./MarketProfileService');
const { SubscriptionManager } = require('./SubscriptionManager');
const { RequestCoordinator } = require('./RequestCoordinator');
const { StatusBroadcaster } = require('./StatusBroadcaster');

console.log('[WebSocketServer] FILE LOADED - v3.0 with sub-managers');

class WebSocketServer {
    constructor(port, cTraderSession, tradingViewSession) {
        this.wss = new WebSocket.Server({ port });
        this.cTraderSession = cTraderSession;
        this.tradingViewSession = tradingViewSession;

        // Initialize sub-managers
        this.subscriptionManager = new SubscriptionManager();
        this.requestCoordinator = new RequestCoordinator(this);
        this.statusBroadcaster = new StatusBroadcaster(this);

        this.dataRouter = new DataRouter(this);
        this.marketProfileService = new MarketProfileService();

        this.wss.on('connection', (ws) => this.handleConnection(ws));

        this.cTraderSession.on('tick', (tick) => this.dataRouter.routeFromCTrader(tick));
        this.cTraderSession.on('connected', (symbols) => {
            this.statusBroadcaster.broadcastStatus('connected', null, symbols);
            if (symbols && Array.isArray(symbols)) {
                symbols.forEach(symbol => {
                    this.marketProfileService.resetSequence(symbol);
                });
            }
        });
        this.cTraderSession.on('disconnected', () => this.statusBroadcaster.broadcastStatus('disconnected'));
        this.cTraderSession.on('error', (error) => this.statusBroadcaster.broadcastStatus('error', error.message));
        this.cTraderSession.on('m1Bar', (bar) => this.marketProfileService.onM1Bar(bar.symbol, bar));
        this.marketProfileService.on('profileUpdate', (data) => this.dataRouter.routeProfileUpdate(data.symbol, data.profile));
        this.marketProfileService.on('profileError', (data) => this.dataRouter.routeProfileError(data.symbol, data.error, data.message));

        // TradingView event handlers
        this.tradingViewSession.on('m1Bar', (bar) => this.marketProfileService.onM1Bar(bar.symbol, bar));
        this.tradingViewSession.on('tick', (tick) => this.dataRouter.routeFromTradingView(tick));
        this.tradingViewSession.on('candle', (candle) => this.dataRouter.routeFromTradingView(candle));
        this.tradingViewSession.on('connected', () => console.log('[TradingView] Backend connected'));
        this.tradingViewSession.on('disconnected', () => console.log('[TradingView] Backend disconnected'));
        this.tradingViewSession.on('error', (error) => console.error('[TradingView] Backend error:', error));
    }

    handleConnection(ws) {
        console.log('Client connected');
        ws.on('message', (message) => this.handleMessage(ws, message));
        ws.on('close', () => this.handleClose(ws));
        ws.on('error', (error) => console.error('Client WebSocket error:', error));

        this.statusBroadcaster.sendInitialStatus(ws);
    }

    async handleMessage(ws, message) {
        let data;
        // Parse JSON - separate try-catch for parse errors
        try {
            data = JSON.parse(message);
        } catch (parseError) {
            console.error('[WebSocketServer] JSON parse error:', parseError.message);
            return this.sendToClient(ws, {
                type: 'error',
                message: 'Invalid message format.',
                symbol: 'system'
            });
        }

        // Process message - separate try-catch for processing errors
        try {
            console.log(`[DEBUG] WebSocketServer received message: ${JSON.stringify(data)}`);
            if (data.symbol) {
                console.log(`[SYMBOL_TRACE | WebSocketServer] Received initial request from client for symbol: ${data.symbol}`);
            } else if (data.symbols) {
                console.log(`[SYMBOL_TRACE | WebSocketServer] Received subscribe request for symbols: ${data.symbols.join(', ')}`);
            }

            switch (data.type) {
                case 'get_symbol_data_package':
                case 'subscribe':
                    if (data.type === 'subscribe' && data.symbols) {
                        await this.handleSubscribe(ws, data.symbols[0], 14, data.source || 'ctrader');
                    } else {
                        await this.handleSubscribe(ws, data.symbol, data.adrLookbackDays, data.source || 'ctrader');
                    }
                    break;
                case 'unsubscribe':
                    if (data.symbols) this.handleUnsubscribe(ws, data.symbols);
                    break;
                case 'reinit':
                    await this.handleReinit(ws, data);
                    break;
                default:
                    console.warn(`Unknown message type: ${data.type}`);
            }
        } catch (processingError) {
            console.error(`[WebSocketServer] Processing error for ${data.symbol || 'unknown'}:`, processingError.message);
            this.sendToClient(ws, {
                type: 'error',
                message: processingError.message || 'Processing failed',
                symbol: data.symbol || 'system',
                originalType: data.type
            });
        }
    }

    async handleSubscribe(ws, symbolName, adrLookbackDays = 14, source = 'ctrader') {
        if (!symbolName || typeof symbolName !== 'string' || symbolName.trim().length === 0) {
            return this.sendToClient(ws, { type: 'error', message: `Invalid symbol name: ${symbolName}`, symbol: symbolName });
        }

        // Add client subscription first
        const isFirstSubscriber = this.subscriptionManager.addClientSubscription(symbolName, source, ws);

        // Subscribe to M1 bars if first subscription for this symbol
        if (!this.subscriptionManager.hasM1BarSubscription(symbolName, source)) {
            this.subscriptionManager.addBackendSubscription(symbolName, source);
            console.log(`[WebSocketServer] Subscribing to M1 bars for ${symbolName} (${source})`);
            this.marketProfileService.subscribeToSymbol(symbolName);

            if (source === 'ctrader') {
                this.cTraderSession.subscribeToM1Bars(symbolName).catch(err => {
                    console.error(`Failed to subscribe to M1 bars for ${symbolName}:`, err);
                });
            }
        }

        // Subscribe to ticks if first subscriber for cTrader
        if (isFirstSubscriber && source === 'ctrader') {
            this.cTraderSession.subscribeToTicks(symbolName).catch(err => {
                console.error(`Failed to subscribe to ticks for ${symbolName}:`, err);
            });
        }

        // Delegate request handling
        return this.requestCoordinator.handleRequest(symbolName, adrLookbackDays, source, ws);
    }

    async handleReinit(ws, data) {
        const source = data.source || 'all';
        console.log(`[WebSocketServer] Reinit requested for: ${source}`);

        if (source === 'ctrader' || source === 'all') {
            await this.cTraderSession.reconnect();
        }
        if (source === 'tradingview' || source === 'all') {
            await this.tradingViewSession.reconnect();
        }

        this.sendToClient(ws, {
            type: 'reinit_started',
            source,
            timestamp: Date.now()
        });
    }

    handleUnsubscribe(ws, symbols) {
        for (const symbolName of symbols) {
            const emptyKeys = this.subscriptionManager.removeClientSubscription(ws, symbolName);

            // Unsubscribe from backend if no more subscribers
            for (const key of emptyKeys) {
                const [symbol, source] = key.split(':');
                if (source === 'ctrader') {
                    this.cTraderSession.unsubscribeFromTicks(symbolName);
                }
            }
        }
    }

    sendToClient(ws, data) {
        this.statusBroadcaster.sendToClient(ws, data);
    }
    
    broadcastTick(tick) {
        console.log(`[DEBUG_TRACE | WebSocketServer] Broadcasting tick to subscribers:`, JSON.stringify(tick));
        if (tick.source === 'tradingview') {
            this.dataRouter.routeFromTradingView(tick);
        } else {
            this.dataRouter.routeFromCTrader(tick);
        }
    }

    handleClose(ws) {
        console.log('Client disconnected');
        const subscriptions = this.subscriptionManager.removeClient(ws);

        // Unsubscribe from backends if no more subscribers
        for (const symbol of subscriptions) {
            for (const source of ['ctrader', 'tradingview']) {
                const clients = this.subscriptionManager.getSubscribedClients(symbol, source);
                if (!clients || clients.size === 0) {
                    if (source === 'ctrader') {
                        this.cTraderSession.unsubscribeFromTicks(symbol);
                    }
                }
            }
        }
    }
}

module.exports = { WebSocketServer };
