const WebSocket = require('ws');
const cookie = require('cookie');
const { sessionManager, SESSION_COOKIE_NAME } = require('./middleware');
const { DataRouter } = require('./DataRouter');
const { MarketProfileService } = require('./MarketProfileService');
const { TwapService } = require('./TwapService');
const { SubscriptionManager } = require('./SubscriptionManager');
const { RequestCoordinator } = require('./RequestCoordinator');
const { StatusBroadcaster } = require('./StatusBroadcaster');

console.log('[WebSocketServer] FILE LOADED - Modular architecture with sub-managers');

// Resolution string (used by frontend) to cTrader period string mapping
const RESOLUTION_TO_PERIOD = {
    '1m': 'M1', '5m': 'M5', '10m': 'M10', '15m': 'M15', '30m': 'M30',
    '1h': 'H1', '4h': 'H4', '12h': 'H12',
    'D': 'D1', 'W': 'W1', 'M': 'MN1'
};

class WebSocketServer {
    // Constructor receives an http.Server instead of a port number (ref: DL-002).
    // The ws.Server attaches to the same HTTP server that Express uses.
    constructor(server, cTraderSession, tradingViewSession, twapService = null, marketProfileService = null) {
        this.wss = new WebSocket.Server({ server });
        this.cTraderSession = cTraderSession;
        this.tradingViewSession = tradingViewSession;

        // Registry of active WebSocket connections by userId.
        // Used to close old connections when a new login invalidates the session (ref: DL-023).
        this.wsByUserId = new Map();

        // When a session is invalidated (new login from another device),
        // close the old WebSocket connection with code 4001 (ref: DL-006, DL-023).
        sessionManager.on('sessionInvalidated', ({ userId }) => {
            const oldWs = this.wsByUserId.get(userId);
            if (oldWs && oldWs.readyState === WebSocket.OPEN) {
                oldWs.close(4001, 'Session invalidated by new login');
            }
        });

        // Initialize sub-managers
        this.subscriptionManager = new SubscriptionManager();
        this.requestCoordinator = new RequestCoordinator(this);
        this.statusBroadcaster = new StatusBroadcaster(this);

        this.dataRouter = new DataRouter(this);
        this.marketProfileService = marketProfileService || new MarketProfileService();
        this.twapService = twapService || new TwapService();

        // Connection handler receives the HTTP upgrade request for cookie parsing (ref: DL-005).
        this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));

        this.cTraderSession.on('tick', (tick) => {
            const price = tick.price ?? ((tick.bid != null && tick.ask != null) ? (tick.bid + tick.ask) / 2 : tick.bid ?? tick.ask);
            if (price != null) this.lastPrices.set(tick.symbol, { price, timestamp: Date.now() });
            this.dataRouter.routeFromCTrader(tick);
        });
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
        this.cTraderSession.on('m1Bar', (bar) => this.marketProfileService.onM1Bar(bar.symbol, bar, 'ctrader'));
        this.cTraderSession.on('m1Bar', (bar) => this.twapService.onM1Bar(bar.symbol, bar, 'ctrader'));
        this.cTraderSession.on('m1Bar', (bar) => this.dataRouter.routeM1CandleUpdate(bar));
        this.cTraderSession.on('barUpdate', (bar) => this.dataRouter.routeCandleUpdate(bar));
        this.marketProfileService.on('profileUpdate', (data) => {
            const isDelta = !!data.delta;
            const payload = data.delta || data.profile;
            this.dataRouter.routeProfileUpdate(data.symbol, payload, data.source || 'ctrader', data.seq, isDelta);
        });
        this.marketProfileService.on('profileError', (data) => this.dataRouter.routeProfileError(data.symbol, data.error, data.message));
        this.twapService.on('twapUpdate', (data) => this.dataRouter.routeTwapUpdate(data.symbol, data));

        // Per-client candle subscription tracking: 'symbol:period' -> Set<ws>
        this.candleSubscriptions = new Map();

        // Last known price per symbol — populated from tick events.
        // Used to attach currentPrice to candleHistory responses so the
        // frontend can render the correct close on the current bar immediately.
        this.lastPrices = new Map(); // symbol -> { price, timestamp }

        // TradingView event handlers
        this.tradingViewSession.on('m1Bar', (bar) => {
            console.log(`[WebSocketServer] TradingView m1Bar received:`, JSON.stringify(bar));
            this.marketProfileService.onM1Bar(bar.symbol, bar, 'tradingview');
        });
        this.tradingViewSession.on('m1Bar', (bar) => this.twapService.onM1Bar(bar.symbol, bar, 'tradingview'));
        this.tradingViewSession.on('m1Bar', (bar) => this.dataRouter.routeTradingViewM1CandleUpdate(bar));
        this.tradingViewSession.on('tick', (tick) => {
            if (tick.price != null) this.lastPrices.set(tick.symbol, { price: tick.price, timestamp: Date.now() });
            this.dataRouter.routeFromTradingView(tick);
        });
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
        // Frontend expects messages within 30 seconds, we send every 15 seconds
        console.log('[WebSocketServer] Starting heartbeat interval (15s)');
        this.heartbeatInterval = setInterval(() => {
            console.log('[WebSocketServer] Heartbeat interval triggered');
            this.sendHeartbeat();
        }, 15000);

        // Schedule daily reset at 0000hrs UTC
        console.log('[WebSocketServer] Scheduling daily reset at 0000hrs UTC');
        this.scheduleDailyReset();
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

    scheduleDailyReset() {
        const now = new Date();
        const midnight = new Date(now);
        midnight.setUTCHours(24, 0, 0, 0);
        const msUntilMidnight = midnight - now;

        console.log(`[WebSocketServer] Daily reset scheduled in ${Math.round(msUntilMidnight / 60000)} minutes`);
        this._dailyResetTimeout = setTimeout(() => {
            this.performDailyReset();
            this.scheduleDailyReset(); // Re-schedule for next day
        }, msUntilMidnight);
    }

    async performDailyReset() {
        const activeSymbols = this.subscriptionManager.getActiveSymbols();
        if (activeSymbols.length === 0) {
            console.log('[WebSocketServer] No active symbols, skipping daily reset');
            return;
        }

        console.log(`[WebSocketServer] Performing daily reset for ${activeSymbols.length} symbols: ${activeSymbols.join(', ')}`);

        // Step 1: Reset backend state for each symbol
        // Skip symbols with in-flight initialization to avoid race with initializeFromHistory
        for (const symbol of activeSymbols) {
            if (this.marketProfileService.isInitializing.get(symbol) || this.twapService.isInitializing.get(symbol)) {
                console.warn(`[WebSocketServer] Skipping daily reset for ${symbol} — initialization in progress`);
                continue;
            }
            this.twapService.resetDaily(symbol);
            this.marketProfileService.cleanupSymbol(symbol);
        }

        // Step 2: Broadcast dailyReset to all connected clients
        const dailyResetMsg = {
            type: 'dailyReset',
            symbols: activeSymbols,
            timestamp: Date.now(),
            symbol: 'system'
        };
        let clientCount = 0;
        this.wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                try {
                    client.send(JSON.stringify(dailyResetMsg));
                    clientCount++;
                } catch (error) {
                    console.error('[WebSocketServer] Failed to send dailyReset to client:', error.message);
                }
            }
        });
        console.log(`[WebSocketServer] dailyReset sent to ${clientCount} clients`);

        // Step 3: Re-fetch fresh data for each symbol and re-send to subscribed clients
        // This triggers initializeFromHistory which rebuilds profiles from new day's M1 bars
        for (const symbol of activeSymbols) {
            try {
                const clients = new Set();
                for (const source of ['ctrader', 'tradingview']) {
                    const sourceClients = this.subscriptionManager.getSubscribedClients(symbol, source);
                    if (sourceClients) {
                        for (const c of sourceClients) {
                            clients.add(c);
                        }
                    }
                }
                if (clients.size === 0) continue;

                // Determine which source to use for the data fetch
                const hasCtrader = this.subscriptionManager.getSubscribedClients(symbol, 'ctrader')?.size > 0;
                const source = hasCtrader ? 'ctrader' : 'tradingview';
                const clientArray = Array.from(clients);

                if (hasCtrader && this.cTraderSession.getSymbolDataPackage) {
                    const data = await this.cTraderSession.getSymbolDataPackage(symbol, 14);
                    if (data) {
                        // Re-subscribe to symbol so profile Map exists for initializeFromHistory
                        this.marketProfileService.subscribeToSymbol(symbol, source);
                        this.requestCoordinator.sendDataToClients(data, clientArray);
                        console.log(`[WebSocketServer] Re-sent data package for ${symbol} to ${clientArray.length} clients`);
                    }
                } else {
                    console.log(`[WebSocketServer] Skipping re-fetch for ${symbol} (${source}) — will auto-recover via M1 bar day-boundary guard`);
                }
            } catch (error) {
                console.error(`[WebSocketServer] Failed to re-fetch data for ${symbol} during daily reset:`, error.message);
            }
        }
    }

    // Cleanup method to stop heartbeat when server is shut down
    close() {
        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
        if (this._dailyResetTimeout) {
            clearTimeout(this._dailyResetTimeout);
            this._dailyResetTimeout = null;
        }
    }

    /**
     * Authenticate the WebSocket upgrade request via session cookie.
     * Rejects unauthenticated connections immediately with close code 4001 (ref: DL-005).
     * No unauthenticated window — unlike first-message auth which allows resource occupation (ref: RA-003).
     */
    handleConnection(ws, req) {
        const cookieHeader = req.headers.cookie || '';
        const parsed = cookie.parse(cookieHeader);
        const sessionToken = parsed[SESSION_COOKIE_NAME];

        if (!sessionToken) {
            ws.close(4001, 'No session cookie');
            return;
        }

        // Session validation is async; handlers are attached only after auth succeeds.
        // This prevents unauthenticated sockets from receiving any market data (ref: DL-005).
        sessionManager.validateSession(sessionToken).then(userId => {
            if (!userId) {
                ws.close(4001, 'Invalid session');
                return;
            }
            ws.userId = userId;
            this.wsByUserId.set(userId, ws);
            console.log('Client connected (userId=' + userId + ')');
            this.attachConnectionHandlers(ws);
        }).catch(() => {
            ws.close(4001, 'Session validation failed');
        });
    }

    /** Attach message/close/error handlers after successful authentication. */
    attachConnectionHandlers(ws) {
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
                case 'getHistoricalCandles':
                    await this.handleGetHistoricalCandles(ws, data);
                    break;
                case 'subscribeCandles':
                    await this.handleSubscribeCandles(ws, data);
                    break;
                case 'unsubscribeCandles':
                    this.handleUnsubscribeCandles(ws, data);
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
                source: data.source,
                originalType: data.type
            });
        }
    }

    async handleSubscribe(ws, symbolName, adrLookbackDays = 14, source = 'ctrader') {
        console.log(`[DEBUGGER:WebSocketServer:handleSubscribe:117] Called with symbol=${symbolName}, adrLookbackDays=${adrLookbackDays}, source=${source}`);
        if (!symbolName || typeof symbolName !== 'string' || symbolName.trim().length === 0) {
            console.log(`[DEBUGGER:WebSocketServer:handleSubscribe:119] Invalid symbol name: ${symbolName}`);
            return this.sendToClient(ws, { type: 'error', message: `Invalid symbol name: ${symbolName}`, symbol: symbolName, source: source });
        }

        // Add client subscription first
        const isFirstSubscriber = this.subscriptionManager.addClientSubscription(symbolName, source, ws);
        console.log(`[DEBUGGER:WebSocketServer:handleSubscribe:124] isFirstSubscriber=${isFirstSubscriber}`);

        // CRITICAL: cTrader requires spot (ticks) subscription BEFORE M1 bars subscription
        // Subscribe to ticks first if first subscriber for cTrader
        if (isFirstSubscriber && source === 'ctrader') {
            this.cTraderSession.subscribeToTicks(symbolName).catch(err => {
                console.error(`Failed to subscribe to ticks for ${symbolName}:`, err?.message || String(err));
                // Notify client of subscription failure so frontend can track failed pairs
                this.sendToClient(ws, {
                    type: 'error',
                    code: err.code || 'SUBSCRIPTION_FAILED',
                    message: `Failed to subscribe to ticks for ${symbolName}: ${err?.message || String(err)}`,
                    symbol: symbolName,
                    source: source
                });
            });
        }

        // Define callback to subscribe to M1 bars when profile initialization completes
        const onDataReceived = () => {
            console.log(`[WebSocketServer] Profile initialization complete for ${symbolName}, now subscribing to M1 bars`);
            if (source === 'ctrader') {
                this.cTraderSession.subscribeToM1Bars(symbolName).catch(err => {
                    console.error(`Failed to subscribe to M1 bars for ${symbolName}:`, err?.message || String(err));
                    // Notify client of subscription failure
                    this.sendToClient(ws, {
                        type: 'error',
                        code: err.code || 'SUBSCRIPTION_FAILED',
                        message: `Failed to subscribe to M1 bars for ${symbolName}: ${err?.message || String(err)}`,
                        symbol: symbolName,
                        source: source
                    });
                });
            }
        };

        // Subscribe to M1 bars if first subscription for this symbol
        // NOTE: M1 bar subscription activates upon profile initialization completion
        if (!this.subscriptionManager.hasM1BarSubscription(symbolName, source)) {
            this.subscriptionManager.addBackendSubscription(symbolName, source);
            console.log(`[WebSocketServer] Registering M1 bar subscription for ${symbolName} (${source}) - will activate after profile initialization`);
            this.marketProfileService.subscribeToSymbol(symbolName, source);
        }

        // Delegate request handling with completion callback
        return this.requestCoordinator.handleRequest(symbolName, adrLookbackDays, source, ws, onDataReceived);
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
                // Clean up market profile data to free memory
                this.marketProfileService.cleanupSymbol(symbol);
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

    async handleGetHistoricalCandles(ws, data) {
        const { symbol, resolution, from, to } = data;
        const source = data.source || 'ctrader';

        if (!symbol || !resolution || from == null || to == null) {
            return this.sendToClient(ws, {
                type: 'error',
                message: 'Missing required fields: symbol, resolution, from, to',
                symbol: symbol || 'system'
            });
        }

        const period = RESOLUTION_TO_PERIOD[resolution];
        if (!period) {
            return this.sendToClient(ws, {
                type: 'error',
                message: `Unsupported resolution: ${resolution}. Supported: ${Object.keys(RESOLUTION_TO_PERIOD).join(', ')}`,
                symbol
            });
        }

        console.log(`[TV-CHART] getHistoricalCandles: ${symbol} ${resolution}(${period}) from=${from} to=${to} source=${source}`);

        try {
            let bars;
            if (source === 'tradingview') {
                bars = await this.tradingViewSession.fetchHistoricalCandles(symbol, resolution, from, to);
            } else {
                bars = await this.requestCoordinator.enqueueDirect(
                    () => this.cTraderSession.fetchHistoricalCandles(symbol, period, from, to),
                    90_000
                );
            }
            this.sendToClient(ws, {
                type: 'candleHistory',
                symbol,
                resolution,
                period,
                source,
                bars,
                currentPrice: this.lastPrices.get(symbol)?.price ?? null
            });
            console.log(`[TV-CHART] Sent ${bars.length} ${resolution} bars for ${symbol} (${source})`);
        } catch (error) {
            console.error(`[TV-CHART] Failed to fetch historical candles for ${symbol} ${resolution} (${source}):`, error.message);
            this.sendToClient(ws, {
                type: 'candleHistory',
                symbol,
                resolution,
                period,
                source,
                bars: [],
                error: error.message
            });
        }
    }

    async handleSubscribeCandles(ws, data) {
        const { symbol, resolution } = data;
        const source = data.source || 'ctrader';

        if (!symbol || !resolution) {
            return this.sendToClient(ws, {
                type: 'error',
                message: 'Missing required fields: symbol, resolution',
                symbol: symbol || 'system'
            });
        }

        const period = RESOLUTION_TO_PERIOD[resolution];
        if (!period) {
            return this.sendToClient(ws, {
                type: 'error',
                message: `Unsupported resolution: ${resolution}`,
                symbol
            });
        }

        const key = `${symbol}:${period}:${source}`;

        // Track this client's candle subscription
        if (!this.candleSubscriptions.has(key)) {
            this.candleSubscriptions.set(key, new Set());
        }
        this.candleSubscriptions.get(key).add(ws);

        // Only subscribe to backend if this is the first client for this key
        const isFirstClient = this.candleSubscriptions.get(key).size === 1;

        if (isFirstClient) {
            if (source === 'tradingview') {
                // Ensure TradingView has an active subscription for this symbol
                // (M1 bars flow from the ticker subscription pipeline)
                const hasTVSub = this.subscriptionManager.getSubscribedClients(symbol, 'tradingview')?.size > 0;
                if (!hasTVSub) {
                    console.log(`[TV-CHART] No TradingView ticker subscription for ${symbol}, initiating one`);
                    this.handleSubscribe(ws, symbol, 14, 'tradingview').catch(err => {
                        console.error(`[TV-CHART] Failed to initiate TradingView subscription for ${symbol}:`, err.message);
                    });
                }
                this.sendToClient(ws, {
                    type: 'candleSubscription',
                    symbol,
                    resolution,
                    period,
                    source,
                    status: 'subscribed'
                });
                console.log(`[TV-CHART] TradingView candle subscription active: ${symbol} ${resolution}(${period})`);
            } else {
                // cTrader: subscribe to ticks and bars
                try {
                    await this.cTraderSession.subscribeToTicks(symbol);
                    await this.cTraderSession.subscribeToBars(symbol, period);
                    this.sendToClient(ws, {
                        type: 'candleSubscription',
                        symbol,
                        resolution,
                        period,
                        source,
                        status: 'subscribed'
                    });
                    console.log(`[WebSocketServer] Candle subscription active: ${symbol} ${resolution}(${period})`);
                } catch (error) {
                    // Clean up client tracking on failure
                    const clients = this.candleSubscriptions.get(key);
                    if (clients) {
                        clients.delete(ws);
                        if (clients.size === 0) this.candleSubscriptions.delete(key);
                    }
                    console.error(`[WebSocketServer] Failed to subscribe to candles for ${symbol} ${resolution}:`, error.message || error);
                    this.sendToClient(ws, {
                        type: 'error',
                        message: `Failed to subscribe to candles: ${error.message || error}`,
                        symbol,
                        resolution
                    });
                }
            }
        } else {
            this.sendToClient(ws, {
                type: 'candleSubscription',
                symbol,
                resolution,
                period,
                source,
                status: 'subscribed'
            });
            console.log(`[WebSocketServer] Candle subscription: ${symbol} ${resolution}(${period}) (${source}, ${this.candleSubscriptions.get(key).size} clients)`);
        }
    }

    handleUnsubscribeCandles(ws, data) {
        const { symbol, resolution } = data;
        const source = data.source || 'ctrader';

        if (!symbol || !resolution) return;

        const period = RESOLUTION_TO_PERIOD[resolution];
        if (!period) return;

        const key = `${symbol}:${period}:${source}`;
        const clients = this.candleSubscriptions.get(key);

        if (!clients || !clients.has(ws)) {
            console.log(`[WebSocketServer] Candle unsubscribe: ${symbol} ${resolution}(${period}) - client not subscribed`);
            return;
        }

        clients.delete(ws);

        if (clients.size === 0) {
            this.candleSubscriptions.delete(key);
            // Only unsubscribe from backend when last client leaves
            if (source === 'ctrader') {
                this.cTraderSession.unsubscribeFromBars(symbol, period).catch(err => {
                    console.error(`[WebSocketServer] Failed to unsubscribe from candles for ${symbol} ${resolution}:`, err.message);
                });
            }
            // TradingView subscriptions are managed by the ticker subscription lifecycle
        }

        console.log(`[WebSocketServer] Candle unsubscription: ${symbol} ${resolution}(${period}) (${source}, ${clients?.size || 0} remaining clients)`);
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
        // Clean up userId registry on disconnect. Only delete if this is the
        // current connection for the user (avoids deleting a newer connection) (ref: DL-023).
        if (ws.userId) {
            const existing = this.wsByUserId.get(ws.userId);
            if (existing === ws) {
                this.wsByUserId.delete(ws.userId);
            }
        }

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

        // Clean up candle subscriptions for this client
        for (const [key, clients] of this.candleSubscriptions) {
            if (clients.has(ws)) {
                clients.delete(ws);
                if (clients.size === 0) {
                    this.candleSubscriptions.delete(key);
                    // Parse key: "symbol:period:source"
                    const parts = key.split(':');
                    const symbol = parts[0];
                    const period = parts.slice(1, -1).join(':'); // period might contain ':'
                    const source = parts[parts.length - 1];
                    if (source === 'ctrader') {
                        this.cTraderSession.unsubscribeFromBars(symbol, period).catch(err => {
                            console.error(`[WebSocketServer] Failed to unsubscribe from candles on client disconnect for ${key}:`, err.message);
                        });
                    }
                }
            }
        }
    }
}

module.exports = { WebSocketServer };
