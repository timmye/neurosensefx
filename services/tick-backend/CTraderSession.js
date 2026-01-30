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

        this.healthMonitor = new HealthMonitor('ctrader');
        this.reconnection = new ReconnectionManager(60000, 1000);
        this.shouldReconnect = true;
    }

    async connect() {
        if (this.connection) this.connection.close();

        this.connection = new CTraderConnection({
            host: process.env.HOST,
            port: Number(process.env.PORT),
        });

        this.symbolLoader = new CTraderSymbolLoader(this.connection, this.ctidTraderAccountId);
        this.dataProcessor = new CTraderDataProcessor(this.connection, this.ctidTraderAccountId, this.symbolLoader);
        this.eventHandler = new CTraderEventHandler(this.dataProcessor, this.healthMonitor);

        this.setupEventListeners();
        await this.connection.open();
        await this.authenticate();
        await this.symbolLoader.loadAllSymbols();
        this.startHeartbeat();
        this.healthMonitor.start();
        this.reconnection.reset();
        this.emit('connected', this.symbolLoader.getAllSymbolNames());
    }

    setupEventListeners() {
        this.connection.on('PROTO_OA_SPOT_EVENT', async (event) => {
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
        });

        this.connection.on('close', () => {
            console.log('[DEBUG] CTraderConnection closed');
            this.handleDisconnect();
        });

        this.connection.on('error', (err) => {
            console.error('[ERROR] CTraderConnection error:', err);
            this.handleDisconnect(err);
        });
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

    handleDisconnect(error = null) {
        console.log('[DEBUG] CTraderSession.handleDisconnect() called');
        if (error) console.error('CTraderSession connection failed:', error);
        this.healthMonitor.stop();
        this.stopHeartbeat();
        this.emit('disconnected');

        if (this.connection) {
            console.log('[DEBUG] Closing connection in handleDisconnect');
            this.connection.close();
        }

        if (this.shouldReconnect) {
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
        this.reconnection.cancelReconnect();
        this.shouldReconnect = false;

        if (this.connection) {
            try {
                if (typeof this.connection.close === 'function') {
                    this.connection.close();
                } else if (typeof this.connection.disconnect === 'function') {
                    this.connection.disconnect();
                }
            } catch (error) {
                console.log('[DEBUG] Connection close/disconnect failed:', error.message);
            }
            this.connection = null;
        }

        if (this.heartbeatInterval) {
            clearInterval(this.heartbeatInterval);
            this.heartbeatInterval = null;
        }
    }

    async reconnect() {
        console.log('[CTraderSession] Manual reinit requested');
        this.shouldReconnect = true;
        this.healthMonitor.stop();
        this.reconnection.cancelReconnect();
        await this.disconnect();
        await this.connect();
    }
}

module.exports = { CTraderSession };
