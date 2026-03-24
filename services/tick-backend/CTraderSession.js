const EventEmitter = require('events');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const { CTraderConnection } = require('../../libs/cTrader-Layer/build/entry/node/main');
const { HealthMonitor } = require('./HealthMonitor');
const { ReconnectionManager } = require('./utils/ReconnectionManager');
const { CTraderSymbolLoader } = require('./CTraderSymbolLoader');
const { CTraderDataProcessor } = require('./CTraderDataProcessor');
const { CTraderEventHandler } = require('./CTraderEventHandler');

/**
 * CTrader Session - Main orchestration for cTrader connection.
 * Delegates symbol loading, data processing, and event handling to focused modules.
 */
class CTraderSession extends EventEmitter {
    constructor() {
        super();
        this.connection = null;
        this.heartbeatInterval = null;
        this.ctidTraderAccountId = Number(process.env.CTRADER_ACCOUNT_ID);
        this.accessToken = process.env.CTRADER_ACCESS_TOKEN;
        this.clientId = process.env.CTRADER_CLIENT_ID;
        this.clientSecret = process.env.CTRADER_CLIENT_SECRET;

        this.symbolLoader = null;
        this.dataProcessor = null;
        this.eventHandler = null;

        this.healthMonitor = new HealthMonitor('ctrader', 10000, 5000);
        this.reconnection = new ReconnectionManager(15000, 500, Number(process.env.MAX_RECONNECT_ATTEMPTS) || 20);

        // Store listener references to prevent duplicates
        this.spotEventHandler = null;
        this.closeEventHandler = null;
        this.errorEventHandler = null;

        // Connection state guards
        this.isConnecting = false;
        this.eventListenersAttached = false;
    }

    async connect() {
        if (this.isConnecting) {
            console.log('[CTraderSession] Connection already in progress, skipping');
            return;
        }

        this.isConnecting = true;

        if (this.connection) this.connection.close();

        this.connection = new CTraderConnection({
            host: process.env.HOST,
            port: Number(process.env.PORT),
        });

        this.symbolLoader = new CTraderSymbolLoader(this.connection, this.ctidTraderAccountId);
        this.dataProcessor = new CTraderDataProcessor(this.connection, this.ctidTraderAccountId, this.symbolLoader);
        this.eventHandler = new CTraderEventHandler(this.dataProcessor, this.healthMonitor);

        this.removeEventListeners();
        this.setupEventListeners();

        // Add timeout to detect hanging connection
        let timeoutHandle;
        const timeout = new Promise((_, reject) => {
            timeoutHandle = setTimeout(() => reject(new Error('cTrader connection timeout after 10 seconds')), 10000);
        });

        try {
            await Promise.race([this.connection.open(), timeout]);
            clearTimeout(timeoutHandle);
            this.isConnecting = false;
        } catch (error) {
            clearTimeout(timeoutHandle);
            this.isConnecting = false;
            console.error('[CTraderSession] Connection failed:', error.message);
            this.handleDisconnect(error, true);
            throw error;
        }

        await this.authenticate();
        await this.symbolLoader.loadAllSymbols();
        this.startHeartbeat();
        this.healthMonitor.start();
        this.reconnection.reset();
        this.emit('connected', this.symbolLoader.getAllSymbolNames());
    }

    setupEventListeners() {
        if (this.eventListenersAttached) {
            console.log('[CTraderSession] Event listeners already attached, skipping');
            return;
        }

        this.spotEventHandler = async (event) => {
            try {
                const symbolId = Number(event.symbolId);
                if (!symbolId) return;

                const symbolName = this.symbolLoader.getSymbolName(symbolId);
                if (!symbolName) return;

                const symbolInfo = await this.symbolLoader.getFullSymbolInfo(symbolId);
                if (!symbolInfo) return;

                let tickData = null;
                let m1Bar = null;

                if (event.trendbar && event.trendbar.length > 0) {
                    const result = this.eventHandler.processTrendbarEvent(event, symbolName, symbolInfo);
                    m1Bar = result.m1Bar;
                    tickData = result.tick;
                } else if (event.bid != null && event.ask != null) {
                    tickData = this.eventHandler.processSpotEvent(event, symbolName, symbolInfo);
                }

                if (tickData) {
                    this.healthMonitor.recordTick();
                    this.emit('tick', tickData);
                }

                if (m1Bar) {
                    this.emit('m1Bar', m1Bar);
                }
            } catch (error) {
                console.error('[ERROR] Unhandled error in PROTO_OA_SPOT_EVENT handler:', error);
            }
        };

        this.closeEventHandler = () => {
            console.log('[DEBUG] CTraderConnection closed');
            this.handleDisconnect(null, true);
        };

        this.errorEventHandler = (err) => {
            console.error('[ERROR] CTraderConnection error:', err);
            this.handleDisconnect(err, true);
        };

        this.connection.on('PROTO_OA_SPOT_EVENT', this.spotEventHandler);
        this.connection.on('close', this.closeEventHandler);
        this.connection.on('error', this.errorEventHandler);

        this.eventListenersAttached = true;
    }

    removeEventListeners() {
        if (!this.connection) return;

        if (this.spotEventHandler) {
            this.connection.removeListener('PROTO_OA_SPOT_EVENT', this.spotEventHandler);
            this.spotEventHandler = null;
        }

        if (this.closeEventHandler) {
            this.connection.removeListener('close', this.closeEventHandler);
            this.closeEventHandler = null;
        }

        if (this.errorEventHandler) {
            this.connection.removeListener('error', this.errorEventHandler);
            this.errorEventHandler = null;
        }

        this.eventListenersAttached = false;
    }

    async authenticate() {
        await this.connection.sendCommand('ProtoOAApplicationAuthReq', {
            clientId: this.clientId,
            clientSecret: this.clientSecret
        });
        await this.connection.sendCommand('ProtoOAAccountAuthReq', {
            ctidTraderAccountId: this.ctidTraderAccountId,
            accessToken: this.accessToken
        });
    }

    handleDisconnect(error = null, shouldScheduleReconnect = true) {
        console.log('[DEBUG] CTraderSession.handleDisconnect() called');
        if (error) console.error('CTraderSession connection failed:', error);
        this.reconnection.cancelReconnect();
        this.isConnecting = false;
        this.healthMonitor.stop();
        this.stopHeartbeat();
        this.emit('disconnected');

        if (this.connection) {
            console.log('[DEBUG] Closing connection in handleDisconnect');
            this.connection.close();
        }

        if (shouldScheduleReconnect) {
            this.scheduleReconnect();
        }
    }

    scheduleReconnect() {
        this.reconnection.scheduleReconnect(() => this.connect());
    }

    startHeartbeat() {
        this.stopHeartbeat();
        this.heartbeatInterval = setInterval(() => {
            if (this.connection) this.connection.sendCommand('ProtoHeartbeatEvent', {});
        }, 10000);
    }

    stopHeartbeat() {
        if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    }

    async subscribeToTicks(symbolName) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeSpotsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: [symbolId]
            });
        }
    }

    async unsubscribeFromTicks(symbolName) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOAUnsubscribeSpotsReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: [symbolId]
            });
        }
    }

    async subscribeToM1Bars(symbolName) {
        const symbolId = this.symbolLoader.getSymbolId(symbolName);
        if (symbolId) {
            await this.connection.sendCommand('ProtoOASubscribeLiveTrendbarReq', {
                ctidTraderAccountId: this.ctidTraderAccountId,
                symbolId: symbolId,
                period: 'M1'
            });
        }
    }

    async getSymbolDataPackage(symbolName, adrLookbackDays = 14) {
        return this.dataProcessor.getSymbolDataPackage(symbolName, adrLookbackDays);
    }

    disconnect() {
        // Use handleDisconnect with shouldScheduleReconnect=false to prevent auto-reconnect
        this.handleDisconnect(null, false);
    }

    async reconnect() {
        console.log('[CTraderSession] Manual reinit requested');
        this.healthMonitor.stop();
        this.reconnection.cancelReconnect();
        this.isConnecting = false;
        await this.disconnect();
        await this.connect();
    }
}

module.exports = { CTraderSession };
