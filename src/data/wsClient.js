import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore';

// --- Stores ---
export const wsStatus = writable('disconnected'); // For the LIVE connection
export const dataSourceMode = writable('simulated'); // 'live' or 'simulated'
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());

// --- Private State ---
let ws = null;
let simulationTimeout;
let simulationState = {};

// --- WebSocket Connection ---
const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    // This MUST match the port the backend is running on.
    const port = '8080'; 
    return `${protocol}//${host}:${port}`;
};

const WS_URL = getWebSocketUrl();

export function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    stopSimulation(); // Ensure simulation is stopped
    wsStatus.set('connecting');
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('WebSocket opened, sending connect message.');
            ws.send(JSON.stringify({ type: 'connect' }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            switch (data.type) {
                case 'status':
                    wsStatus.set(data.status);
                    if (data.status === 'connected' && data.availableSymbols) {
                        availableSymbols.set(data.availableSymbols);
                        const currentSubs = get(subscriptions);
                        if (currentSubs.size > 0) {
                            // Re-subscribe to symbols on reconnect
                            subscribe([...currentSubs]);
                        }
                    }
                    break;
                case 'tick':
                    symbolStore.dispatchTick(data.symbol, { ...data, bid: parseFloat(data.bid), ask: parseFloat(data.ask) });
                    break;
                case 'subscribeResponse':
                case 'unsubscribeResponse':
                    handleSubscriptionResponse(data);
                    break;
                case 'error':
                    console.error('Backend Error:', data.message);
                    break;
            }
        };

        ws.onclose = () => {
            ws = null;
            wsStatus.set('disconnected');
            availableSymbols.set([]);
        };

        ws.onerror = (err) => {
            console.error('WebSocket Error:', err);
            wsStatus.set('error');
            if (ws) ws.close();
        };
    } catch (e) {
        console.error('Failed to create WebSocket:', e);
        wsStatus.set('error');
        ws = null;
    }
}

export function disconnect() {
    if (ws) {
        ws.onclose = null; // Prevent onclose from firing during manual disconnect
        ws.send(JSON.stringify({ type: 'disconnect' }));
        ws.close();
        ws = null;
    }
    wsStatus.set('disconnected');
    availableSymbols.set([]);
}

// --- Data Simulation ---
const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2.5 },
};

export function startSimulation() {
    disconnect(); // Ensure live connection is off
    if (simulationTimeout) clearTimeout(simulationTimeout);
    
    const symbol = 'SIM-EURUSD';
    symbolStore.createNewSymbol(symbol);
    subscriptions.update(subs => {
        subs.add(symbol);
        return subs;
    });

    simulationState = { currentPrice: 1.25500, momentum: 0 };
    
    // Initial tick
    symbolStore.dispatchTick(symbol, {
        type: 'tick', symbol, bid: simulationState.currentPrice, ask: simulationState.currentPrice + 0.00002, timestamp: performance.now()
    });

    function runSimulationLoop() {
        const config = get(symbolStore)[symbol]?.config;
        if (!config) {
            simulationTimeout = setTimeout(runSimulationLoop, 100);
            return;
        }

        const settings = frequencySettings[config.frequencyMode] || frequencySettings.normal;

        simulationState.momentum = (simulationState.momentum || 0) * 0.85;
        const bias = simulationState.momentum * 0.1;
        const direction = Math.random() < (0.5 + bias) ? 1 : -1;
        simulationState.momentum = Math.max(-1, Math.min(1, simulationState.momentum + direction * 0.25));
        
        let magnitude = (Math.random() < 0.8) ? Math.random() * 0.8 : (Math.random() < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
        magnitude *= settings.magnitudeMultiplier;
        
        simulationState.currentPrice += (direction * magnitude / 10000);
        
        const tick = { type: 'tick', symbol, bid: simulationState.currentPrice, ask: simulationState.currentPrice + (0.2 / 10000), timestamp: performance.now() };
        symbolStore.dispatchTick(symbol, tick);

        const nextTickDelay = settings.baseInterval + (Math.random() * settings.randomness);
        simulationTimeout = setTimeout(runSimulationLoop, nextTickDelay);
    }
    
    runSimulationLoop();
}

export function stopSimulation() {
    if (simulationTimeout) {
        clearTimeout(simulationTimeout);
        simulationTimeout = null;
    }
}

// --- Public API for Subscriptions ---
export function subscribe(symbols) {
    if (get(dataSourceMode) !== 'live') return;
    if (get(wsStatus) === 'connected' && ws) {
        ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    } else {
        console.warn('Cannot subscribe, WebSocket is not connected.');
    }
}

export function unsubscribe(symbols) {
    if (get(dataSourceMode) !== 'live') return;
    if (get(wsStatus) === 'connected' && ws) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    }
}

function handleSubscriptionResponse(data) {
    if (!data.results) return;
    
    subscriptions.update(subs => {
        data.results.forEach(result => {
            if (result.status === 'subscribed') {
                subs.add(result.symbol);
                symbolStore.createNewSymbol(result.symbol); 
            } else if (result.status === 'unsubscribed') {
                subs.delete(result.symbol);
            } else if (result.status === 'error') {
                console.error(`Subscription error for ${result.symbol}: ${result.message}`);
            }
        });
        return new Set(subs);
    });
}
