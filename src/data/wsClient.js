import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore';

export const wsStatus = writable('disconnected'); 
export const dataSourceMode = writable('simulated');
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());
export const marketDataStore = writable({});

let ws = null;
let simulationTimeout;
let simulationState = {};

const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2.5 },
};

const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws'; 
    return `${protocol}//${host}${path}`;
};

let WS_URL = getWebSocketUrl();

export function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;
    
    stopSimulation();
    wsStatus.set('ws-connecting');
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => ws.send(JSON.stringify({ type: 'connect' }));
        ws.onmessage = (event) => handleSocketMessage(JSON.parse(event.data));
        ws.onclose = () => {
            ws = null;
            if (get(wsStatus) !== 'error') wsStatus.set('disconnected');
            availableSymbols.set([]);
        };
        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
            handleError('WebSocket connection failed.');
            if (ws) ws.close();
        };
    } catch (e) {
        console.error('Failed to create WebSocket:', e);
        handleError('Failed to create WebSocket.');
        ws = null;
    }
}

function handleSocketMessage(data) {
    switch (data.type) {
        case 'status':
            handleStatusMessage(data);
            break;
        case 'symbolDataPackage':
            console.log('[wsClient] Received symbolDataPackage:', data);
            handleDataPackage(data);
            break;
        case 'tick':
            symbolStore.dispatchTick(data.symbol, { ...data, bid: parseFloat(data.bid), ask: parseFloat(data.ask) });
            break;
        case 'error':
            handleError(data.message);
            break;
        default:
            console.warn('Received unknown message type:', data.type);
    }
}

function handleStatusMessage(data) {
    wsStatus.set(data.status);
    availableSymbols.set(data.availableSymbols || []);
    if (data.status === 'connected') {
        const currentSubs = Array.from(get(subscriptions));
        if (currentSubs.length > 0) {
            subscribe(currentSubs);
        }
    }
}

function handleDataPackage(data) {
    if (data.todaysOpen === null) {
        console.error(`Invalid initialPrice '${data.todaysOpen}' for ${data.symbol}. Defaulting to 0.`);
        data.todaysOpen = 0;
    }
    symbolStore.createNewSymbol(data.symbol, data.todaysOpen);
    
    marketDataStore.update(store => {
        store[data.symbol] = {
            adr: data.adr,
            projectedHigh: data.projectedHigh,
            projectedLow: data.projectedLow,
        };
        console.log('[wsClient] Updated marketDataStore:', store);
        return store;
    });

    if (get(dataSourceMode) === 'live' && ws) {
        console.log(`Front-end initialized for ${data.symbol}. Requesting tick stream.`);
        ws.send(JSON.stringify({ type: 'start_tick_stream', symbol: data.symbol }));
    }
    
    subscriptions.update(subs => subs.add(data.symbol));
}

function handleError(message) {
    console.error('Backend Error:', message);
    wsStatus.set('error');
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

export function startSimulation() {
    disconnect();
    
    const symbol = 'SIM-EURUSD';
    const midPoint = 1.25500;
    symbolStore.createNewSymbol(symbol, midPoint);
    marketDataStore.set({
        [symbol]: {
            adr: 0.00850, 
            projectedHigh: midPoint + 0.00425,
            projectedLow: midPoint - 0.00425,
        }
    });
    subscriptions.set(new Set([symbol]));
    simulationState = { currentPrice: midPoint, momentum: 0 };
    
    const runSimulationLoop = () => {
        if (get(dataSourceMode) !== 'simulated') return;
        const config = get(symbolStore)[symbol]?.config;
        if (!config) {
            simulationTimeout = setTimeout(runSimulationLoop, 100);
            return;
        }

        const settings = frequencySettings[config.frequencyMode] || frequencySettings.normal;
        simulationState.momentum = (simulationState.momentum || 0) * 0.85;
        let direction = (Math.random() - 0.5 + (simulationState.momentum * 0.2)) > 0 ? 1 : -1;
        simulationState.momentum = Math.max(-1, Math.min(1, simulationState.momentum + direction * (Math.random() * 0.3 + 0.1)));
        let magnitude = (Math.random() < 0.8) ? Math.random() * 0.8 : (Math.random() < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
        simulationState.currentPrice += (direction * magnitude * settings.magnitudeMultiplier / 100000);
        
        symbolStore.dispatchTick(symbol, { 
            bid: simulationState.currentPrice, 
            ask: simulationState.currentPrice + (Math.random() * 0.2 / 10000),
        });
        simulationTimeout = setTimeout(runSimulationLoop, settings.baseInterval + (Math.random() * settings.randomness));
    };
    
    runSimulationLoop();
}

export function stopSimulation() {
    if (simulationTimeout) clearTimeout(simulationTimeout);
    simulationTimeout = null;
}

export function subscribe(symbols) {
    const symbolsToSubscribe = Array.isArray(symbols) ? symbols : [symbols];
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        symbolsToSubscribe.forEach(symbol => {
            console.log(`Requesting initial data for ${symbol}...`);
            ws.send(JSON.stringify({ type: 'get_symbol_data', symbol: symbol }));
        });
    } else {
        console.warn('Cannot subscribe, live data source not connected.');
    }
}

export function unsubscribe(symbols) {
    const symbolsToUnsubscribe = Array.isArray(symbols) ? symbols : [symbols];
    if (get(dataSourceMode) === 'live' && ws) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: symbolsToUnsubscribe }));
    }
    symbolsToUnsubscribe.forEach(symbol => {
        symbolStore.removeSymbol(symbol);
        subscriptions.update(subs => {
            subs.delete(symbol);
            return subs;
        });
        marketDataStore.update(store => {
            delete store[symbol];
            return store;
        });
    });
}

dataSourceMode.subscribe(mode => {
    symbolStore.clear();
    subscriptions.set(new Set());
    marketDataStore.set({});
    if (mode === 'simulated') {
        disconnect(); 
        startSimulation();
    } else {
        stopSimulation();
        connect();
    }
});
