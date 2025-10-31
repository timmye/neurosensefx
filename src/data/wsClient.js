import { writable, get } from 'svelte/store';
import { symbolStore, defaultConfig } from './symbolStore';
import { TickSchema, SymbolDataPackageSchema } from './schema.js';

export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('live');
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());

let ws = null;
let simulationInterval = null;
let connectionMonitorInterval = null;

const WS_URL = (() => {
    // Use VITE_BACKEND_URL if available (for cloud environments), otherwise use the default local URL
    if (import.meta.env.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws';
    return `${protocol}//${host}${path}`;
})();

export function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    
    stopSimulation();
    // WebSocket connection initiated
    wsStatus.set('ws-connecting');
    try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
        // WebSocket connected
            startConnectionMonitor();
        };
        ws.onmessage = (event) => {
            const rawData = JSON.parse(event.data);
            handleSocketMessage(rawData);
        };
        ws.onclose = (event) => {
            console.log(`[WSCLIENT_DEBUG] WebSocket closed, code: ${event.code}, reason: ${event.reason}`);
            stopConnectionMonitor();
            ws = null;
            if (get(wsStatus) !== 'error') wsStatus.set('disconnected');
            availableSymbols.set([]);
        };
        ws.onerror = (err) => {
            console.error('[wsClient] WebSocket Error:', err);
            stopConnectionMonitor();
            if (ws) ws.close(); // Ensure close is called on error
            wsStatus.set('error'); // Set status to error on connection failure
        };
    } catch (e) {
        console.error('[wsClient] Failed to create WebSocket:', e);
        ws = null;
        wsStatus.set('error'); // Set status to error on creation failure
    }
}

function startConnectionMonitor() {
    stopConnectionMonitor();
    connectionMonitorInterval = setInterval(() => {
        if (!ws) {
            stopConnectionMonitor();
        }
    }, 2000);
}

function stopConnectionMonitor() {
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }
}

function handleSocketMessage(data) {
    console.log(`[WSCLIENT_DEBUG] Received message:`, data);
    
    if (data.type === 'symbolDataPackage') {
        console.log(`[WSCLIENT_DEBUG] Processing symbolDataPackage for ${data.symbol}`);
        const packageResult = SymbolDataPackageSchema.safeParse(data);
        if (packageResult.success) {
            handleDataPackage(packageResult.data);
        } else {
            console.error('[wsClient] Invalid symbol data package:', packageResult.error);
        }
    } else if (data.type === 'status' || data.type === 'ready') {
         const status = data.type === 'ready' ? 'connected' : data.status;
         console.log(`[WSCLIENT_DEBUG] Setting status to: ${status}`);
         wsStatus.set(status);
         if(status === 'connected'){
             console.log(`[WSCLIENT_DEBUG] Setting available symbols to:`, data.availableSymbols);
             availableSymbols.set(data.availableSymbols || []);
         }
    } else if (data.type === 'tick') {
    // Processing tick
        const tickResult = TickSchema.safeParse(data);
        if (tickResult.success) {
            symbolStore.dispatchTick(tickResult.data.symbol, tickResult.data);
        } else {
            console.error('[wsClient] Invalid tick data received:', tickResult.error);
        }
    }
}

function handleDataPackage(data) {
    console.log(`[WSCLIENT_DEBUG] handleDataPackage called for ${data.symbol}`);
    symbolStore.createNewSymbol(data.symbol, data);
    subscriptions.update(subs => {
        subs.add(data.symbol);
        return subs;
    });
    console.log(`[WSCLIENT_DEBUG] Symbol ${data.symbol} added to subscriptions`);
}

export function disconnect() {
    stopSimulation();
    if (ws) {
        ws.onclose = null; // Prevent triggering onclose logic during manual disconnect
        ws.close();
        ws = null;
    }
    wsStatus.set('disconnected');
    availableSymbols.set([]);
    subscriptions.set(new Set());
    symbolStore.clear();
}

function startSimulation() {
    disconnect(); // Ensure clean state before starting simulation
    const symbol = 'SIM-EURUSD';
    const midPoint = 1.25500;
    const adr = 0.00850;

    // Add some mock market profile data for simulation
     const mockInitialMarketProfile = [];
     // Example: Add a few mock bars
     for(let i = 0; i < 100; i++) {
         const open = midPoint + (Math.random() - 0.5) * 0.0005;
         const close = open + (Math.random() - 0.5) * 0.0005;
         mockInitialMarketProfile.push({
             open,
             close,
             high: Math.max(open, close) + Math.random() * 0.0001,
             low: Math.min(open, close) - Math.random() * 0.0001,
             timestamp: Date.now() - (100 - i) * 60 * 1000, // Go back in time by minutes
             volume: Math.floor(Math.random() * 1000)
         });
     }

    const mockDataPackage = {
        symbol,
        digits: 5,
        adr,
        todaysOpen: midPoint,
        todaysHigh: midPoint + 0.00150,
        todaysLow: midPoint - 0.00250,
        projectedAdrHigh: midPoint + adr / 2,
        projectedAdrLow: midPoint - adr / 2,
        initialPrice: midPoint,
        initialMarketProfile: mockInitialMarketProfile,
    };

    symbolStore.createNewSymbol(symbol, mockDataPackage);
    subscriptions.set(new Set([symbol]));

    let currentPrice = midPoint;
    
    const frequencySettings = {
        calm: { base: 1500, rand: 1000 },
        normal: { base: 500, rand: 500 },
        active: { base: 200, rand: 200 },
        volatile: { base: 50, rand: 50 },
    };
    
    const magnitudeSettings = {
        calm: { base: 0.000005, rand: 0.00001 },
        normal: { base: 0.00001, rand: 0.00002 },
        active: { base: 0.00002, rand: 0.00004 },
        volatile: { base: 0.00005, rand: 0.00008 },
    }

    let nextTickTime = 0;

    const simulationLoop = () => {
        const now = performance.now();
        if (now < nextTickTime) {
            simulationInterval = requestAnimationFrame(simulationLoop);
            return;
        }

        const symbols = get(symbolStore);
        const simSymbol = symbols[symbol];
        
        const currentFrequencyMode = simSymbol?.config?.frequencyMode || defaultConfig.frequencyMode;

        if (!simSymbol || !simSymbol.config || !frequencySettings[currentFrequencyMode] || !magnitudeSettings[currentFrequencyMode]) {
            simulationInterval = requestAnimationFrame(simulationLoop);
            return;
        }

        const freq = frequencySettings[currentFrequencyMode];
        const mag = magnitudeSettings[currentFrequencyMode];
        
        nextTickTime = now + freq.base + (Math.random() * freq.rand);
        
        const direction = Math.random() > 0.5 ? 1 : -1;
        const priceChange = (mag.base + Math.random() * mag.rand) * direction;

        currentPrice += priceChange;
        
        const newTick = {
            symbol,
            bid: currentPrice,
            ask: currentPrice + 0.00012,
            timestamp: now,
        };
        
        symbolStore.dispatchTick(symbol, newTick);
        simulationInterval = requestAnimationFrame(simulationLoop);
    };

    simulationLoop();
}

function stopSimulation() {
    if (simulationInterval) {
        cancelAnimationFrame(simulationInterval);
        simulationInterval = null;
    }
}

export function subscribe(symbol) {
    console.log(`[WSCLIENT_DEBUG] subscribe called for symbol: ${symbol}`);
    console.log(`[WSCLIENT_DEBUG] dataSourceMode: ${get(dataSourceMode)}, wsStatus: ${get(wsStatus)}, ws exists: ${!!ws}`);
    
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        const adrLookbackDays = 14;
        const message = JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays });
        console.log(`[WSCLIENT_DEBUG] Sending message: ${message}`);
        ws.send(message);
    } else {
        console.log(`[WSCLIENT_DEBUG] Cannot subscribe - conditions not met`);
    }
}

export function unsubscribe(symbol) {
    if (get(dataSourceMode) === 'live' && ws) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: [symbol] }));
    }
    symbolStore.removeSymbol(symbol);
    subscriptions.update(subs => {
        subs.delete(symbol);
        return subs;
    });
}

export function initializeWsClient() {
    dataSourceMode.subscribe(mode => {
        symbolStore.clear();
        subscriptions.set(new Set());
        if (mode === 'simulated') {
            disconnect(); // Ensure disconnect for clean transition
            startSimulation();
        } else {
            // Ensure a clean slate before attempting to connect to live data
            if (ws && ws.readyState !== WebSocket.CLOSED && ws.readyState !== WebSocket.CONNECTING) {
                disconnect();
            }
            stopSimulation();
            connect();
        }
    });
    
    // Trigger initial connection since subscription doesn't fire for initial value
    const currentMode = get(dataSourceMode);
    if (currentMode === 'live') {
        connect();
    } else if (currentMode === 'simulated') {
        startSimulation();
    }
}
