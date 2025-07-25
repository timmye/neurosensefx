import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore';

// --- Stores ---
export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('simulated'); // 'live' or 'simulated'
export const subscriptions = writable(new Set());

// --- Private State ---
let ws = null;
let simulationInterval;
let simulationState = {};

// --- WebSocket Connection ---
const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    return `${protocol}//${host}/ws`;
};

const WS_URL = getWebSocketUrl();

function startLiveStream() {
    if (ws && ws.readyState === WebSocket.OPEN) return;
    
    stopLiveStream(); 
    stopSimulation(); 

    wsStatus.set('connecting');
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            wsStatus.set('connected');
            // Resubscribe to any existing symbols on reconnect
            const currentSubs = get(subscriptions);
            if (currentSubs.size > 0) {
                subscribe([...currentSubs]);
            }
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'tick') {
                data.bid = parseFloat(data.bid);
                data.ask = parseFloat(data.ask);
                symbolStore.dispatchTick(data.symbol, data);
            } else if (data.type === 'subscribeResponse') {
                data.results.forEach(result => {
                    if (result.status === 'subscribed') {
                        subscriptions.update(subs => subs.add(result.symbol));
                        symbolStore.createNewSymbol(result.symbol);
                    }
                });
            }
        };

        ws.onclose = () => {
            if (get(dataSourceMode) === 'live') {
                setTimeout(startLiveStream, 3000);
            }
            stopLiveStream();
        };

        ws.onerror = () => {
            wsStatus.set('error');
            stopLiveStream();
        };
    } catch (e) {
        wsStatus.set('error');
        ws = null;
    }
}

function stopLiveStream() {
    if (ws) {
        ws.onclose = null;
        ws.onerror = null;
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null;
    }
    wsStatus.set('disconnected');
}

// --- Data Simulation ---
const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2 },
};

function initializeSimulator() {
    const symbol = 'SIM-EURUSD';
    simulationState = { lastTickTime: performance.now(), currentPrice: 1.25500, momentum: 0 };
    subscriptions.update(subs => subs.add(symbol));
    symbolStore.createNewSymbol(symbol);
}

function generateSimulatedTick() {
    const symbol = 'SIM-EURUSD';
    const settings = frequencySettings['normal'];
    
    simulationState.momentum = (simulationState.momentum || 0) * 0.85;
    const bias = simulationState.momentum * 0.1;
    const direction = Math.random() < (0.5 + bias) ? 1 : -1;
    simulationState.momentum = Math.max(-1, Math.min(1, simulationState.momentum + direction * 0.25));
    const rand = Math.random();
    let magnitude = (rand < 0.8) ? Math.random() * 0.8 : (rand < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
    magnitude *= settings.magnitudeMultiplier;
    const newPrice = simulationState.currentPrice + (direction * magnitude / 10000);
    simulationState.lastTickTime = performance.now();
    simulationState.currentPrice = newPrice;
    const tick = { type: 'tick', symbol: symbol, bid: newPrice, ask: newPrice + (0.2 / 10000), spread: 0.2, timestamp: performance.now() };
    
    symbolStore.dispatchTick(symbol, tick);
}

function startSimulation() {
    stopLiveStream();
    initializeSimulator();
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(generateSimulatedTick, 50);
    wsStatus.set('connected');
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    subscriptions.update(subs => { subs.delete('SIM-EURUSD'); return subs; });
    wsStatus.set('disconnected');
}

// --- Public API ---
export function setDataSource(mode) {
    dataSourceMode.set(mode);
    if (mode === 'live') {
        startLiveStream();
    } else if (mode === 'simulated') {
        startSimulation();
    }
}

export function subscribe(symbols) {
    if (get(dataSourceMode) === 'live' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    }
}

export function unsubscribe(symbols) {
    if (get(dataSourceMode) === 'live' && ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    }
}

// Initialize with the default mode
setDataSource(get(dataSourceMode));
