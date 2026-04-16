#!/usr/bin/env node

/**
 * Test backend fetching of TradingView math expression candles.
 * This test will create a mock TradingView session and try to fetch
 * historical candles for DE02Y/US02Y through the backend.
 */

const WebSocket = require('ws');
const http = require('http');

// Mock TradingView session for testing
class MockTradingViewSession {
    constructor() {
        this.connected = false;
        this.subscriptions = new Map();
    }

    async connect() {
        this.connected = true;
        console.log('[MockTradingView] Connected');
        return Promise.resolve();
    }

    async fetchHistoricalCandles(symbol, resolution, from, to) {
        console.log(`[MockTradingView] Fetching historical candles: ${symbol} ${resolution} from=${from} to=${to}`);
        
        // Return mock data for DE02Y/US02Y
        if (symbol === 'DE02Y/US02Y') {
            const bars = [];
            const now = Date.now();
            const barMs = 24 * 60 * 60 * 1000; // 1 day bars
            
            // Generate 10 days of mock data
            for (let i = 9; i >= 0; i--) {
                const timestamp = now - (i * barMs);
                bars.push({
                    timestamp,
                    open: 0.65 + Math.random() * 0.1,
                    high: 0.65 + Math.random() * 0.1 + 0.01,
                    low: 0.65 + Math.random() * 0.1 - 0.01,
                    close: 0.65 + Math.random() * 0.1,
                    volume: Math.random() * 1000
                });
            }
            
            console.log(`[MockTradingView] Returning ${bars.length} bars for ${symbol}`);
            return bars;
        }
        
        throw new Error(`Unknown symbol: ${symbol}`);
    }

    disconnect() {
        this.connected = false;
    }
}

// Create mock server
const server = http.createServer();
const wss = new WebSocket.Server({ server });

const mockTradingViewSession = new MockTradingViewSession();

// Mock WebSocket server handlers
wss.on('connection', (ws) => {
    console.log('[MockServer] Client connected');
    
    // Mock backend message handling
    ws.on('message', async (message) => {
        const data = JSON.parse(message);
        console.log(`[MockServer] Received: ${data.type}`);
        
        switch (data.type) {
            case 'getHistoricalCandles':
                if (data.source === 'tradingview') {
                    try {
                        const bars = await mockTradingViewSession.fetchHistoricalCandles(
                            data.symbol,
                            data.resolution,
                            data.from,
                            data.to
                        );
                        ws.send(JSON.stringify({
                            type: 'candleHistory',
                            symbol: data.symbol,
                            resolution: data.resolution,
                            source: data.source,
                            bars,
                            currentPrice: 0.67
                        }));
                    } catch (error) {
                        ws.send(JSON.stringify({
                            type: 'candleHistory',
                            symbol: data.symbol,
                            resolution: data.resolution,
                            source: data.source,
                            bars: [],
                            error: error.message
                        }));
                    }
                }
                break;
                
            default:
                console.log(`[MockServer] Unknown message type: ${data.type}`);
        }
    });
});

const PORT = 8081;

server.listen(PORT, () => {
    console.log(`Mock backend server listening on port ${PORT}`);
    
    // Test client
    const testWs = new WebSocket(`ws://localhost:${PORT}`);
    
    testWs.on('open', () => {
        console.log('[TestClient] Connected to mock server');
        
        // Test request for DE02Y/US02Y
        testWs.send(JSON.stringify({
            type: 'getHistoricalCandles',
            symbol: 'DE02Y/US02Y',
            resolution: 'D',
            from: Date.now() - 10 * 24 * 60 * 60 * 1000,
            to: Date.now(),
            source: 'tradingview'
        }));
    });
    
    testWs.on('message', (message) => {
        const data = JSON.parse(message);
        console.log(`\n[TestClient] Response received:`);
        console.log(`  Type: ${data.type}`);
        console.log(`  Symbol: ${data.symbol}`);
        console.log(`  Resolution: ${data.resolution}`);
        console.log(`  Source: ${data.source}`);
        console.log(`  Bars count: ${data.bars.length}`);
        if (data.bars.length > 0) {
            console.log(`  First bar: ${new Date(data.bars[0].timestamp).toISOString()} O:${data.bars[0].open} H:${data.bars[0].high} L:${data.bars[0].low} C:${data.bars[0].close}`);
            console.log(`  Last bar: ${new Date(data.bars[data.bars.length - 1].timestamp).toISOString()} O:${data.bars[data.bars.length - 1].open} H:${data.bars[data.bars.length - 1].high} L:${data.bars[data.bars.length - 1].low} C:${data.bars[data.bars.length - 1].close}`);
        }
        if (data.error) {
            console.log(`  ERROR: ${data.error}`);
        }
        
        // Clean up
        testWs.close();
        server.close();
        process.exit(0);
    });
});
