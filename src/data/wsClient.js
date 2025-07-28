import { writable, get } from 'svelte/store';
import { symbolStore, defaultConfig } from './symbolStore';
import { TickSchema, SymbolDataPackageSchema } from './schema.js';

export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('simulated');
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());

let ws = null;
let simulationInterval = null;

const WS_URL = (() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws';
    return `${protocol}//${host}${path}`;
})()
export function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    
    stopSimulation();
    wsStatus.set('ws-connecting');
    try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {};
        ws.onmessage = (event) => handleSocketMessage(JSON.parse(event.data));
        ws.onclose = () => {
            ws = null;
            if (get(wsStatus) !== 'error') wsStatus.set('disconnected');
            availableSymbols.set([]);
        };
        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
            if (ws) ws.close();
        };
    } catch (e) {
        console.error('Failed to create WebSocket:', e);
        ws = null;
    }
}

function handleSocketMessage(data) {
    if (data.type === 'symbolDataPackage') {
        console.log(`[E2E_DEBUG | wsClient] 9. Received 'symbolDataPackage' from server:`, data);
        const packageResult = SymbolDataPackageSchema.safeParse(data);
        if (packageResult.success) {
            handleDataPackage(packageResult.data);
        } else {
            console.error('Invalid symbol data package:', packageResult.error);
        }
    } else if (data.type === 'status' || data.type === 'ready') {
         const status = data.type === 'ready' ? 'connected' : data.status;
         wsStatus.set(status);
         if(status === 'connected'){
             availableSymbols.set(data.availableSymbols || []);
         }
    } else if (data.type === 'tick') {
        const tickResult = TickSchema.safeParse(data);
        if (tickResult.success) {
            symbolStore.dispatchTick(tickResult.data.symbol, tickResult.data);
        } else {
            console.error('[wsClient] Invalid tick data received:', tickResult.error);
        }
    }
}

function handleDataPackage(data) {
    symbolStore.createNewSymbol(data.symbol, data);
    subscriptions.update(subs => subs.add(data.symbol));
    // The backend now atomically subscribes, so this is no longer needed.
    // if (get(dataSourceMode) === 'live' && ws) {
    //     ws.send(JSON.stringify({ type: 'start_tick_stream', symbol: data.symbol }));
    // }
}

export function disconnect() {
    stopSimulation();
    if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
    }
    wsStatus.set('disconnected');
    availableSymbols.set([]);
    subscriptions.set(new Set());
    symbolStore.clear();
}

function startSimulation() {
    disconnect();
    const symbol = 'SIM-EURUSD';
    const midPoint = 1.25500;
    const adr = 0.00850;

    const mockDataPackage = {
        symbol,
        digits: 5, // Add the missing digits property
        adr,
        todaysOpen: midPoint,
        todaysHigh: midPoint + 0.00150,
        todaysLow: midPoint - 0.00250,
        projectedHigh: midPoint + adr / 2,
        projectedLow: midPoint - adr / 2,
        initialPrice: midPoint,
        initialMarketProfile: [],
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
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        const adrLookbackDays = 5;
        ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays }));
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

dataSourceMode.subscribe(mode => {
    symbolStore.clear();
    subscriptions.set(new Set());
    if (mode === 'simulated') {
        disconnect();
        startSimulation();
    } else {
        stopSimulation();
        connect();
    }
});
