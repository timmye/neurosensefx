const WebSocket = require('ws');
const { DataRouter } = require('./DataRouter');
const { MarketProfileService } = require('./MarketProfileService');
const { TwapService } = require('./TwapService');
const { SubscriptionManager } = require('./SubscriptionManager');
const { RequestCoordinator } = require('./RequestCoordinator');
const { StatusBroadcaster } = require('./StatusBroadcaster');

console.log('[WebSocketServer] FILE LOADED - Modular architecture with sub-managers');

class WebSocketServer {
    constructor(port, cTraderSession, tradingViewSession, twapService = null, marketProfileService = null) {
        this.wss = new WebSocket.Server({ port });
        this.cTraderSession = cTraderSession;
        this.tradingViewSession = tradingViewSession;

        // Initialize sub-managers
        this.subscriptionManager = new SubscriptionManager();
        this.requestCoordinator = new RequestCoordinator(this);
        this.statusBroadcaster = new StatusBroadcaster(this);

        this.dataRouter = new DataRouter(this);
        this.marketProfileService = marketProfileService || new MarketProfileService();
        this.twapService = twapService || new TwapService();

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
        this.cTraderSession.on('m1Bar', (bar) => this.twapService.onM1Bar(bar.symbol, bar, 'ctrader'));
        this.marketProfileService.on('profileUpdate', (data) => this.dataRouter.routeProfileUpdate(data.symbol, data.profile, data.source || 'ctrader'));
        this.marketProfileService.on('profileError', (data) => this.dataRouter.routeProfileError(data.symbol, data.error, data.message));
        this.twapService.on('twapUpdate', (data) => this.dataRouter.routeTwapUpdate(data.symbol, data, data.source || 'ctrader'));

        // TradingView event handlers
        this.tradingViewSession.on('m1Bar', (bar) => this.marketProfileService.onM1Bar(bar.symbol, bar));
        this.tradingViewSession.on('m1Bar', (bar) => this.twapService.onM1Bar(bar.symbol, bar, 'tradingview'));
        this.tradingViewSession.on('tick', (tick) => this.dataRouter.routeFromTradingView(tick));
        this.tradingViewSession.on('candle', (candle) => this.dataRouter.routeFromTradingView(candle));
        this.tradingViewSession.on('connected', () => {
            console.log('[TradingView] Backend connected');
            this.statusBroadcaster.broadcastStatus('connected');
        });
        this.tradingViewSession.on('disconnected', () => {
            console.log('[TradingView] Backend disconnected');
            this.statusBroadcaster.broadcastStatus('disconnected');
        });
        this.tradingViewSession.on('error', (error) => console.error('[TradingView] Backend error:', error));

        // Start heartbeat to keep frontend connections alive
        // Frontend expects messages every 2 seconds, we send every 5 seconds
        console.log('[WebSocketServer] Starting heartbeat interval (5s - aggressive for trading)');
        this.heartbeatInterval = setInterval(() => {
            console.log('[WebSocketServer] Heartbeat interval triggered');
            this.sendHeartbeat();
        }, 5000);
    }

    sendHeartbeat() {
        const heartbeatMessage = {
            type: 'heartbeat',
            timestamp: Date.now(),
            symbol: 'system'
        };
        let sentCount = 0;
        let openClients = 0;
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                openClients++;
                try {
                    client.send(JSON.stringify(heartbeatMessage));
                    sentCount++;
                } catch (error) {
                    console.error('[DEBUGGER:WebSocketServer:sendHeartbeat:76] Failed to send heartbeat:', error.message);
                }
            }
        });
        console.log('[DEBUGGER:WebSocketServer:sendHeartbeat:67] Heartbeat sent: ' + sentCount + '/' + openClients + ' clients, timestamp=' + heartbeatMessage.timestamp);
    }

    // Cleanup method to stop heartbeat when server is shut down
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
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
            console.log(`[DEBUGGER:WebSocketServer:handleMessage:82] Received message: ${JSON.stringify(data)}`);
            if (data.symbol) {
                console.log(`[DEBUGGER:WebSocketServer:handleMessage:84] Symbol request: ${data.symbol}, type: ${data.type}, adrLookbackDays: ${data.adrLookbackDays}, source: ${data.source || 'ctrader'}`);
            } else if (data.symbols) {
                console.log(`[DEBUGGER:WebSocketServer:handleMessage:86] Symbols subscribe request: ${data.symbols.join(', ')}, type: ${data.type}`);
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
                case 'refresh_profile':
                    this.handleRefreshProfile(ws, data);
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
        console.log(`[DEBUGGER:WebSocketServer:handleSubscribe:117] Called with symbol=${symbolName}, adrLookbackDays=${adrLookbackDays}, source=${source}`);
        if (!symbolName || typeof symbolName !== 'string' || symbolName.trim().length === 0) {
            console.log(`[DEBUGGER:WebSocketServer:handleSubscribe:119] Invalid symbol name: ${symbolName}`);
            return this.sendToClient(ws, { type: 'error', message: `Invalid symbol name: ${symbolName}`, symbol: symbolName });
        }

        // Add client subscription first
        const isFirstSubscriber = this.subscriptionManager.addClientSubscription(symbolName, source, ws);
        console.log(`[DEBUGGER:WebSocketServer:handleSubscribe:124] isFirstSubscriber=${isFirstSubscriber}`);

        // CRITICAL: cTrader requires spot (ticks) subscription BEFORE M1 bars subscription
        // Subscribe to ticks first if first subscriber for cTrader
        if (isFirstSubscriber && source === 'ctrader') {
            this.cTraderSession.subscribeToTicks(symbolName).catch(err => {
                console.error(`Failed to subscribe to ticks for ${symbolName}:`, err);
            });
        }

        // Subscribe to M1 bars if first subscription for this symbol (AFTER ticks for cTrader)
        if (!this.subscriptionManager.hasM1BarSubscription(symbolName, source)) {
            this.subscriptionManager.addBackendSubscription(symbolName, source);
            console.log(`[WebSocketServer] Subscribing to M1 bars for ${symbolName} (${source})`);
            this.marketProfileService.subscribeToSymbol(symbolName, source);

            if (source === 'ctrader') {
                this.cTraderSession.subscribeToM1Bars(symbolName).catch(err => {
                    console.error(`Failed to subscribe to M1 bars for ${symbolName}:`, err);
                });
            }
        }

        // Delegate request handling
        return this.requestCoordinator.handleRequest(symbolName, adrLookbackDays, source, ws);
    }

    async handleReinit(ws, data) {
        const source = data.source || 'all';
        console.log('[DEBUGGER:WebSocketServer:handleReinit:162] Reinit requested for: ' + source);

        if (source === 'ctrader' || source === 'all') {
            console.log('[DEBUGGER:WebSocketServer:handleReinit:165] Calling cTraderSession.reconnect()');
            await this.cTraderSession.reconnect();
            console.log('[DEBUGGER:WebSocketServer:handleReinit:167] cTraderSession.reconnect() returned');
        }
        if (source === 'tradingview' || source === 'all') {
            console.log('[DEBUGGER:WebSocketServer:handleReinit:169] Calling tradingViewSession.reconnect()');
            await this.tradingViewSession.reconnect();
            console.log('[DEBUGGER:WebSocketServer:handleReinit:171] tradingViewSession.reconnect() returned');
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

    handleRefreshProfile(ws, data) {
        const symbol = data.symbol;
        const source = data.source || 'ctrader';

        // Check if client is subscribed to this symbol
        const clients = this.subscriptionManager.getSubscribedClients(symbol, source);
        if (!clients || !clients.has(ws)) {
            console.log(`[WebSocketServer] Refresh profile requested for ${symbol} by unsubscribed client`);
            return;
        }

        console.log(`[WebSocketServer] Refresh profile requested for ${symbol} (${source})`);
        this.marketProfileService.reemitProfile(symbol);
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
