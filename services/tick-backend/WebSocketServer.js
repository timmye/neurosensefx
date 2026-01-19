const WebSocket = require('ws');
const { DataRouter } = require('./DataRouter');

class WebSocketServer {
    constructor(port, cTraderSession, tradingViewSession) {
        this.wss = new WebSocket.Server({ port });
        this.cTraderSession = cTraderSession;
        this.tradingViewSession = tradingViewSession;
        this.clientSubscriptions = new Map();
        this.backendSubscriptions = new Map(); // key: "symbol:source", value: Set<ws>
        this.pendingRequests = new Map(); // key: "symbol:adr", value: {promise, clients[]}

        this.currentBackendStatus = 'disconnected';
        this.currentAvailableSymbols = [];

        this.dataRouter = new DataRouter(this);

        this.wss.on('connection', (ws) => this.handleConnection(ws));

        // cTrader event handlers
        this.cTraderSession.on('tick', (tick) => this.dataRouter.routeFromCTrader(tick));
        this.cTraderSession.on('connected', (symbols) => this.updateBackendStatus('connected', null, symbols));
        this.cTraderSession.on('disconnected', () => this.updateBackendStatus('disconnected'));
        this.cTraderSession.on('error', (error) => this.updateBackendStatus('error', error.message));

        // TradingView event handlers
        this.tradingViewSession.on('tick', (tick) => this.dataRouter.routeFromTradingView(tick));
        this.tradingViewSession.on('candle', (candle) => this.dataRouter.routeFromTradingView(candle));
        this.tradingViewSession.on('connected', () => console.log('[TradingView] Backend connected'));
        this.tradingViewSession.on('disconnected', () => console.log('[TradingView] Backend disconnected'));
        this.tradingViewSession.on('error', (error) => console.error('[TradingView] Backend error:', error));
    }

    updateBackendStatus(status, message = null, availableSymbols = []) {
        this.currentBackendStatus = status;
        if (availableSymbols && availableSymbols.length > 0) {
            this.currentAvailableSymbols = availableSymbols;
        }

        const statusData = { type: 'status', status, availableSymbols: this.currentAvailableSymbols, symbol: 'system' };
        if (message) statusData.message = message;
        this.broadcastToAll(statusData);

        if (status === 'connected') {
            this.broadcastToAll({ type: 'ready', availableSymbols: this.currentAvailableSymbols, symbol: 'system' });
        }
    }

    handleConnection(ws) {
        console.log('Client connected');
        this.clientSubscriptions.set(ws, new Set());
        ws.on('message', (message) => this.handleMessage(ws, message));
        ws.on('close', () => this.handleClose(ws));
        ws.on('error', (error) => console.error('Client WebSocket error:', error));
        
        // Send initial connection status immediately upon connection
        this.sendToClient(ws, {
            type: 'status',
            status: this.currentBackendStatus,
            availableSymbols: this.currentAvailableSymbols,
            symbol: 'system'
        });

        if (this.currentBackendStatus === 'connected') {
            this.sendToClient(ws, { type: 'ready', availableSymbols: this.currentAvailableSymbols, symbol: 'system' });
        }
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
        // Route to appropriate backend based on source
        if (source === 'tradingview') {
            return this.handleTradingViewSubscribe(ws, symbolName, adrLookbackDays);
        }

        // cTrader subscription (default)
        // Only validate symbol name format (not presence in symbolMap to avoid race condition)
        // Let cTrader API handle invalid symbols - it will return an error if the symbol doesn't exist
        if (!symbolName || typeof symbolName !== 'string' || symbolName.trim().length === 0) {
            return this.sendToClient(ws, { type: 'error', message: `Invalid symbol name: ${symbolName}`, symbol: symbolName });
        }

        // Check if request is already in flight
        const requestKey = `${symbolName}:${adrLookbackDays}`;

        if (this.pendingRequests.has(requestKey)) {
            const pending = this.pendingRequests.get(requestKey);
            pending.clients.push(ws);
            console.log(`[COALESCE] Joining pending request for ${requestKey} (${pending.clients.length} clients)`);
            return pending.promise;
        }

        // Create new pending request with retry logic for rate limiting
        const clients = [ws];
        const MAX_RETRIES = 3;
        const INITIAL_RETRY_DELAY_MS = 500;

        const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

        const fetchWithRetry = async (retries = 0) => {
            try {
                const data = await this.cTraderSession.getSymbolDataPackage(symbolName, adrLookbackDays);
                console.log(`[COALESCE] Sending ${requestKey} to ${clients.length} clients${retries > 0 ? ` (after ${retries} retries)` : ''}`);
                console.log(`[E2E_TRACE | WebSocketServer] Sending package with ${data.initialMarketProfile.length} profile entries.`);

                clients.forEach(client => {
                    this.sendToClient(client, {
                        type: 'symbolDataPackage',
                        source: 'ctrader',
                        symbol: data.symbol,
                        digits: data.digits,
                        adr: data.adr,
                        todaysOpen: data.todaysOpen,
                        todaysHigh: data.todaysHigh,
                        todaysLow: data.todaysLow,
                        projectedAdrHigh: data.projectedAdrHigh,
                        projectedAdrLow: data.projectedAdrLow,
                        initialPrice: data.initialPrice,
                        initialMarketProfile: data.initialMarketProfile || [],
                        pipPosition: data.pipPosition,
                        pipSize: data.pipSize,
                        pipetteSize: data.pipetteSize
                    });
                });

                // Register subscriptions for all waiting clients
                clients.forEach(client => {
                    const clientSubs = this.clientSubscriptions.get(client);
                    if (clientSubs && !clientSubs.has(symbolName)) {
                        clientSubs.add(symbolName);

                        const key = `${symbolName}:ctrader`;
                        let symbolSubscribers = this.backendSubscriptions.get(key);
                        if (!symbolSubscribers) {
                            symbolSubscribers = new Set();
                            this.backendSubscriptions.set(key, symbolSubscribers);
                        }
                        symbolSubscribers.add(client);

                        if (symbolSubscribers.size === 1) {
                            this.cTraderSession.subscribeToTicks(symbolName).catch(err => {
                                console.error(`Failed to subscribe to ticks for ${symbolName}:`, err);
                            });
                        }
                    }
                });

                this.pendingRequests.delete(requestKey);
                return data;
            } catch (error) {
                const isRateLimit = error.errorCode === 'REQUEST_FREQUENCY_EXCEEDED';
                const isBlocked = error.errorCode === 'BLOCKED_PAYLOAD_TYPE';

                // Retry on rate limit or blocked payload errors
                if ((isRateLimit || isBlocked) && retries < MAX_RETRIES) {
                    const delayMs = INITIAL_RETRY_DELAY_MS * Math.pow(2, retries);
                    const errorType = isRateLimit ? 'Rate limit' : 'Blocked payload';
                    console.log(`[COALESCE] ${errorType} for ${requestKey}, retry ${retries + 1}/${MAX_RETRIES} after ${delayMs}ms`);
                    await sleep(delayMs);
                    return fetchWithRetry(retries + 1);
                }

                console.error(`[COALESCE] Failed ${requestKey} after ${retries} retries:`, error);
                this.pendingRequests.delete(requestKey);

                // Only send error to client if it's a rate limit issue (blocked is expected for some pairs)
                if (isRateLimit) {
                    clients.forEach(client => {
                        this.sendToClient(client, {
                            type: 'error',
                            message: `Failed to get data for ${symbolName}: ${error.message || error.description}`,
                            symbol: symbolName
                        });
                    });
                }

                throw error;
            }
        };

        const promise = fetchWithRetry();
        this.pendingRequests.set(requestKey, { promise, clients });
        return promise;
    }

    async handleTradingViewSubscribe(ws, symbolName, adrLookbackDays = 14) {
        if (!symbolName) {
            return this.sendToClient(ws, { type: 'error', message: `Invalid symbol: ${symbolName}` });
        }

        try {
            // Add client to subscriptions FIRST
            // This ensures the client receives the candle emitted during subscribeToSymbol()
            const clientSubs = this.clientSubscriptions.get(ws);
            if (clientSubs && !clientSubs.has(symbolName)) {
                clientSubs.add(symbolName);
            }

            const key = `${symbolName}:tradingview`;
            let symbolSubscribers = this.backendSubscriptions.get(key);
            if (!symbolSubscribers) {
                symbolSubscribers = new Set();
                this.backendSubscriptions.set(key, symbolSubscribers);
            }
            symbolSubscribers.add(ws);  // Client added BEFORE subscribeToSymbol

            // NOW subscribe - candle will reach the client
            await this.tradingViewSession.subscribeToSymbol(symbolName, adrLookbackDays);

        } catch (error) {
            console.error(`Failed to get TradingView data for ${symbolName}:`, error);
            this.sendToClient(ws, { type: 'error', message: `Failed to get TradingView data for ${symbolName}: ${error.message}`, symbol: symbolName });
        }
    }
    
    handleUnsubscribe(ws, symbols) {
        const clientSubs = this.clientSubscriptions.get(ws);
        if (!clientSubs) return;

        for (const symbolName of symbols) {
            if (clientSubs.has(symbolName)) {
                clientSubs.delete(symbolName);

                // Check both sources for the symbol
                const ctraderKey = `${symbolName}:ctrader`;
                const tradingviewKey = `${symbolName}:tradingview`;

                for (const key of [ctraderKey, tradingviewKey]) {
                    const symbolSubscribers = this.backendSubscriptions.get(key);
                    if (symbolSubscribers && symbolSubscribers.has(ws)) {
                        symbolSubscribers.delete(ws);
                        if (symbolSubscribers.size === 0) {
                            // Unsubscribe from appropriate backend
                            if (key === ctraderKey) {
                                this.cTraderSession.unsubscribeFromTicks(symbolName);
                            }
                            this.backendSubscriptions.delete(key);
                        }
                    }
                }
            }
        }
    }

    sendToClient(ws, data) {
        if (ws.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify(data));
        }
    }

    broadcastToAll(data) {
        this.wss.clients.forEach(client => this.sendToClient(client, data));
    }
    
    broadcastTick(tick) {
        // E2E_DEBUG: Keep for end-to-end diagnosis until production deployment.
        console.log(`[DEBUG_TRACE | WebSocketServer] Broadcasting tick to subscribers:`, JSON.stringify(tick));

        // Note: broadcastTick is now handled by DataRouter for both sources
        // This method is kept for compatibility but delegates to DataRouter
        if (tick.source === 'tradingview') {
            this.dataRouter.routeFromTradingView(tick);
        } else {
            this.dataRouter.routeFromCTrader(tick);
        }
    }

    handleClose(ws) {
        console.log('Client disconnected');
        this.handleUnsubscribe(ws, Array.from(this.clientSubscriptions.get(ws) || []));
        this.clientSubscriptions.delete(ws);

        // Ensure ws is removed from all backendSubscriptions Sets (memory leak fix)
        for (const [key, subscribers] of this.backendSubscriptions) {
            if (subscribers.has(ws)) {
                subscribers.delete(ws);
                if (subscribers.size === 0) {
                    this.backendSubscriptions.delete(key);
                    // Unsubscribe from backend if cTrader key
                    if (key.endsWith(':ctrader')) {
                        const symbol = key.split(':')[0];
                        this.cTraderSession.unsubscribeFromTicks(symbol);
                    }
                }
            }
        }
    }
}

module.exports = { WebSocketServer };
