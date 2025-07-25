import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore';

// --- Stores ---
export const wsStatus = writable('disconnected'); 
export const dataSourceMode = writable('simulated');
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());
export const marketDataStore = writable({});

// --- Private State ---
let ws = null;
let simulationTimeout;
let simulationState = {};

// Define frequencySettings at the top so it's accessible
const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2.5 },
};

// --- WebSocket Connection ---
const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws'; 
    const url = `${protocol}//${host}${path}`;
    return url;
};

let WS_URL = getWebSocketUrl();

export function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    stopSimulation();
    wsStatus.set('ws-connecting');
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => ws.send(JSON.stringify({ type: 'connect' }));

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'status':
                    handleStatusMessage(data);
                    break;
                case 'symbolDataPackage':
                    handleDataPackage(data);
                    break;
                case 'tick':
                    symbolStore.dispatchTick(data.symbol, { ...data, bid: parseFloat(data.bid), ask: parseFloat(data.ask) });
                    break;
                case 'subscribeResponse': 
                case 'unsubscribeResponse':
                    handleSubscriptionResponse(data);
                    break;
                case 'error':
                    handleError(data.message);
                    break;
                default:
                    console.warn('Received unknown message type:', data.type);
            }
        };

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

function handleStatusMessage(data) {
    wsStatus.set(data.status);
    availableSymbols.set(data.availableSymbols || []);
    if (data.status === 'connected') {
        const currentSubs = Array.from(get(subscriptions));
        if (currentSubs.length > 0) {
            console.log('Live data reconnected, resubscribing to:', currentSubs);
            subscribe(currentSubs);
        }
    }
    if (data.message) console.log('Backend status message:', data.message);
}

function handleDataPackage(data) {
    const midPoint = (data.prevDayHigh + data.prevDayLow) / 2;
    symbolStore.createNewSymbol(data.symbol, midPoint);
    
    marketDataStore.update(store => {
        store[data.symbol] = {
            adr: data.adr,
            prevDayHigh: data.prevDayHigh,
            prevDayLow: data.prevDayLow,
        };
        return store;
    });

    if (data.initialMarketProfile) {
        symbolStore.dispatchMarketProfile(data.symbol, data.initialMarketProfile);
    }
    
    subscriptions.update(subs => subs.add(data.symbol));
}

function handleError(message) {
    console.error('Backend Error:', message);
    wsStatus.set('error');
    availableSymbols.set([]);
}

export function disconnect() {
    stopSimulation();
    if (ws) {
        ws.onclose = null;
        ws.close();
    }
    ws = null;
    wsStatus.set('disconnected');
    availableSymbols.set([]);
    subscriptions.set(new Set());
    symbolStore.clear();
}

// --- Data Simulation ---
export function startSimulation() {
    disconnect();
    
    const symbol = 'SIM-EURUSD';
    const midPoint = 1.25500;
    symbolStore.createNewSymbol(symbol, midPoint);
    
    marketDataStore.set({
        [symbol]: {
            adr: 0.00850, 
            prevDayHigh: midPoint + 0.00425,
            prevDayLow: midPoint - 0.00425,
        }
    });

    subscriptions.set(new Set([symbol]));
    simulationState = { currentPrice: midPoint, momentum: 0 };
    
    function runSimulationLoop() {
        if (get(dataSourceMode) !== 'simulated') {
             simulationTimeout = null;
             return;
        }

        const config = get(symbolStore)[symbol]?.config;
        if (!config) {
            simulationTimeout = setTimeout(runSimulationLoop, 100);
            return;
        }

        const settings = frequencySettings[config.frequencyMode] || frequencySettings.normal;
        simulationState.momentum = (simulationState.momentum || 0) * 0.85;
        const directionBias = simulationState.momentum * 0.2;
        const randomFactor = Math.random() - 0.5;
        const biasedRandom = randomFactor + directionBias;
        let direction = biasedRandom > 0 ? 1 : (biasedRandom < 0 ? -1 : 0);
        if (direction === 0 && simulationState.momentum !== 0) {
            direction = simulationState.momentum > 0 ? 1 : -1;
        }
        simulationState.momentum = Math.max(-1, Math.min(1, simulationState.momentum + direction * (Math.random() * 0.3 + 0.1)));
        let magnitude = (Math.random() < 0.8) ? Math.random() * 0.8 : (Math.random() < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
        magnitude *= settings.magnitudeMultiplier;
        simulationState.currentPrice += (direction * magnitude / 100000);
        simulationState.currentPrice = Math.max(0.00001, simulationState.currentPrice);

        const tick = { 
            type: 'tick', 
            symbol: symbol, 
            bid: simulationState.currentPrice, 
            ask: simulationState.currentPrice + (Math.random() * 0.2 / 10000),
            timestamp: performance.now(),
            volume: 1000000 + Math.random() * 500000,
            lastTickDirection: direction > 0 ? 'up' : (direction < 0 ? 'down' : 'flat')
        };
        symbolStore.dispatchTick(symbol, tick);

        const nextTickDelay = settings.baseInterval + (Math.random() * settings.randomness);
        simulationTimeout = setTimeout(runSimulationLoop, nextTickDelay);
    }
    
    runSimulationLoop();
}

export function stopSimulation() {
    if (simulationTimeout) clearTimeout(simulationTimeout);
    simulationTimeout = null;
}

// --- Public API ---
export function subscribe(symbols) {
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    } else {
        console.warn('Cannot subscribe, live data source not connected.');
    }
}

export function unsubscribe(symbols) {
    const symbolsToUnsubscribe = Array.isArray(symbols) ? symbols : [symbols];
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
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

function handleSubscriptionResponse(data) {
    if (!data.results) return;
    data.results.forEach(result => {
        if (result.status === 'error') {
            console.error(`Subscription error for ${result.symbol}: ${result.message}`);
        }
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
