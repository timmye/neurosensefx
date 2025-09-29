import { writable, get } from 'svelte/store';
import { symbolStore, defaultConfig } from './symbolStore';
import { TickSchema, SymbolDataPackageSchema } from './schema.js';

export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('simulated');
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
    console.log('[MP_DEBUG | wsClient] Attempting to connect to WebSocket.');
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
         console.log('[MP_DEBUG | wsClient] WebSocket already open or connecting. Aborting connect.');
        return;
    }
    
    stopSimulation();
    wsStatus.set('ws-connecting');
     console.log('[MP_DEBUG | wsClient] Setting wsStatus to ws-connecting.');
    try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
             console.log('[MP_DEBUG | wsClient] WebSocket opened.');
            startConnectionMonitor();
        };
        ws.onmessage = (event) => {
            const rawData = JSON.parse(event.data);
            // FIX: Log the stringified object to see the full data structure.
            if (rawData.type === 'symbolDataPackage') {
                console.log('[MP_DEBUG | wsClient] Received symbolDataPackage raw data string:', JSON.stringify(rawData, null, 2));
            } else {
                 // E2E_DEBUG: Keep for end-to-end diagnosis until production deployment.
                 console.log(`[DEBUG_TRACE | wsClient] Received message from WebSocket:`, JSON.stringify(rawData));
            }
            handleSocketMessage(rawData);
        };
        ws.onclose = (event) => {
             console.log('[MP_DEBUG | wsClient] WebSocket closed:', event.code, event.reason);
            stopConnectionMonitor();
            ws = null;
            if (get(wsStatus) !== 'error') wsStatus.set('disconnected');
             console.log('[MP_DEBUG | wsClient] Setting wsStatus to disconnected.');
            availableSymbols.set([]);
        };
        ws.onerror = (err) => {
            console.error('[MP_DEBUG | wsClient] WebSocket Error:', err);
            stopConnectionMonitor();
            if (ws) ws.close(); // Ensure close is called on error
             wsStatus.set('error'); // Set status to error on connection failure
             console.log('[MP_DEBUG | wsClient] Setting wsStatus to error.');
        };
    } catch (e) {
        console.error('[MP_DEBUG | wsClient] Failed to create WebSocket:', e);
        ws = null;
         wsStatus.set('error'); // Set status to error on creation failure
          console.log('[MP_DEBUG | wsClient] Setting wsStatus to error.');
    }
}

function startConnectionMonitor() {
     console.log('[MP_DEBUG | wsClient] Starting connection monitor.');
    stopConnectionMonitor();
    connectionMonitorInterval = setInterval(() => {
        if (!ws) {
             console.log('[MP_DEBUG | wsClient] Connection monitor detected no WebSocket.');
            stopConnectionMonitor();
        }
    }, 2000);
}

function stopConnectionMonitor() {
     console.log('[MP_DEBUG | wsClient] Stopping connection monitor.');
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }
}

function handleSocketMessage(data) {
    // E2E_DEBUG: Keep for end-to-end diagnosis until production deployment.
    console.log(`[DEBUG_TRACE | wsClient] Received message from WebSocket:`, JSON.stringify(data));

    if (data.type === 'symbolDataPackage') {
        const packageResult = SymbolDataPackageSchema.safeParse(data);
        if (packageResult.success) {
            console.log(`[MP_TRACE | wsClient] Received package with ${packageResult.data.initialMarketProfile.length} profile entries.`, packageResult.data);
            handleDataPackage(packageResult.data);
        } else {
            console.error('[MP_DEBUG | wsClient] Invalid symbol data package:', packageResult.error);
        }
    } else if (data.type === 'status' || data.type === 'ready') {
         const status = data.type === 'ready' ? 'connected' : data.status;
         wsStatus.set(status);
          console.log('[MP_DEBUG | wsClient] Setting wsStatus to:', status);
         if(status === 'connected'){
             availableSymbols.set(data.availableSymbols || []);
              console.log('[MP_DEBUG | wsClient] Available symbols set:', data.availableSymbols);
         }
    } else if (data.type === 'tick') {
        const tickResult = TickSchema.safeParse(data);
        if (tickResult.success) {
             // E2E_DEBUG: Keep for end-to-end diagnosis until production deployment.
             console.log(`[DEBUG_TRACE | wsClient] Dispatching tick to store/worker:`, JSON.stringify(tickResult.data));
            symbolStore.dispatchTick(tickResult.data.symbol, tickResult.data);
        } else {
            console.error('[MP_DEBUG | wsClient] Invalid tick data received:', tickResult.error);
        }
    }
}

function handleDataPackage(data) {
     console.log('[MP_DEBUG | wsClient] Handling data package for symbol:', data.symbol, data);
    symbolStore.createNewSymbol(data.symbol, data);
    subscriptions.update(subs => {
         console.log('[MP_DEBUG | wsClient] Adding subscription for symbol:', data.symbol);
        subs.add(data.symbol);
        return subs;
    });
}

export function disconnect() {
    console.log('[MP_DEBUG | wsClient] Disconnecting WebSocket.');
    stopSimulation();
    if (ws) {
        ws.onclose = null; // Prevent triggering onclose logic during manual disconnect
        ws.close();
        ws = null;
    }
    wsStatus.set('disconnected');
     console.log('[MP_DEBUG | wsClient] Setting wsStatus to disconnected.');
    availableSymbols.set([]);
    subscriptions.set(new Set());
     console.log('[MP_DEBUG | wsClient] Clearing symbolStore and subscriptions.');
    symbolStore.clear();
}

function startSimulation() {
    console.log('[MP_DEBUG | wsClient] Starting simulation.');
    disconnect(); // Ensure clean state before starting simulation
    const symbol = 'SIM-EURUSD';
    const midPoint = 1.25500;
    const adr = 0.00850;

    // Add some mock market profile data for simulation debugging
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
     console.log('[MP_DEBUG | wsClient] Generated mockInitialMarketProfile for simulation:', mockInitialMarketProfile);

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
     console.log('[MP_DEBUG | wsClient] Created new symbol and subscription for simulation.');

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
     console.log('[MP_DEBUG | wsClient] Stopping simulation.');
    if (simulationInterval) {
        cancelAnimationFrame(simulationInterval);
        simulationInterval = null;
    }
}

export function subscribe(symbol) {
    console.log('[MP_DEBUG | wsClient] Subscribe called for symbol:', symbol);
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        const adrLookbackDays = 14;
         console.log('[MP_DEBUG | wsClient] Sending get_symbol_data_package request for symbol:', symbol);
        ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays }));
    }
}

export function unsubscribe(symbol) {
    console.log('[MP_DEBUG | wsClient] Unsubscribe called for symbol:', symbol);
    if (get(dataSourceMode) === 'live' && ws) {
         console.log('[MP_DEBUG | wsClient] Sending unsubscribe request for symbol:', symbol);
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: [symbol] }));
    }
    symbolStore.removeSymbol(symbol);
    subscriptions.update(subs => {
         console.log('[MP_DEBUG | wsClient] Removing subscription for symbol:', symbol);
        subs.delete(symbol);
        return subs;
    });
}

export function initializeWsClient() {
    dataSourceMode.subscribe(mode => {
        console.log('[MP_DEBUG | wsClient] dataSourceMode changed to:', mode);
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
}
