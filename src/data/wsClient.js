import { writable, get } from 'svelte/store';
import { vizConfig } from '/src/stores.js';

// --- Stores ---
export const tickData = writable({});
export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('simulated'); // 'live' or 'simulated'
export const subscriptions = writable(new Set());

// --- Private State ---
let ws = null; // Initialize ws as null
let simulationInterval;
let simulationState = {};
let currentConfig = {};

// Subscribe to config changes to get the latest settings for the simulator
vizConfig.subscribe(value => {
    currentConfig = value;
});

// --- WebSocket Connection ---
const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const backendPort = 5035; 
    
    const parts = host.split(':');
    const hostname = parts[0];
    return `${protocol}//${hostname}:${backendPort}`;
};

const WS_URL = getWebSocketUrl();

function startLiveStream() {
    if (ws && ws.readyState === WebSocket.OPEN) return; // Already open

    // Ensure any previous connection is fully stopped before starting a new one
    stopLiveStream(); 
    stopSimulation(); // Also ensure simulation is stopped

    wsStatus.set('connecting');
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('wsClient.js: Live WebSocket connected');
            wsStatus.set('connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'tick') {
                console.log('wsClient.js: Received live tick:', data); 
                tickData.set({ [data.symbol]: data });
            } else if (data.type === 'subscribeResponse') {
                console.log('wsClient.js: Subscribe response:', data.results); 
                data.results.forEach(result => {
                    if (result.status === 'subscribed') {
                        subscriptions.update(subs => subs.add(result.symbol));
                    }
                });
            } else if (data.type === 'unsubscribeResponse') {
                console.log('wsClient.js: Unsubscribe response:', data.results); 
                data.results.forEach(result => {
                    if (result.status === 'unsubscribed') {
                        subscriptions.update(subs => {
                            subs.delete(result.symbol);
                            return subs;
                        });
                    }
                });
            }
        };

        ws.onclose = () => {
            console.log('wsClient.js: Live WebSocket disconnected');
            // Only attempt reconnect if still in live mode
            if (get(dataSourceMode) === 'live') {
                setTimeout(startLiveStream, 3000);
            }
            stopLiveStream(); // Centralize cleanup
        };

        ws.onerror = (error) => {
            console.error('wsClient.js: WebSocket error:', error);
            wsStatus.set('error');
            stopLiveStream(); // Centralize cleanup
        };
    } catch (e) {
        console.error('wsClient.js: Error creating WebSocket:', e); 
        wsStatus.set('error');
        ws = null; // Ensure ws is null if constructor fails
    }
}

function stopLiveStream() {
    if (ws) {
        ws.onclose = null; // Prevent onclose from triggering reconnect logic or further calls
        ws.onerror = null; // Prevent onerror from triggering further calls
        if (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING) {
            ws.close();
        }
        ws = null; // Ensure ws is explicitly nulled
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
    simulationState = {
        lastTickTime: performance.now(),
        currentPrice: 1.25500,
        momentum: 0,
    };
    subscriptions.update(subs => subs.add('SIM-EURUSD'));
}

function generateSimulatedTick() {
    const now = performance.now();
    const settings = frequencySettings[currentConfig.frequencyMode] || frequencySettings.normal;
    if (now - simulationState.lastTickTime < (settings.baseInterval + (Math.random() * settings.randomness))) return;
    simulationState.momentum = (simulationState.momentum || 0) * 0.85;
    const bias = simulationState.momentum * 0.1;
    const direction = Math.random() < (0.5 + bias) ? 1 : -1;
    simulationState.momentum = Math.max(-1, Math.min(1, simulationState.momentum + direction * 0.25));
    const rand = Math.random();
    let magnitude = (rand < 0.8) ? Math.random() * 0.8 : (rand < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
    magnitude *= settings.magnitudeMultiplier;
    const newPrice = simulationState.currentPrice + (direction * magnitude / 10000);
    simulationState.lastTickTime = now;
    simulationState.currentPrice = newPrice;
    const tick = { type: 'tick', symbol: 'SIM-EURUSD', bid: newPrice, ask: newPrice + (0.2 / 10000), spread: 0.2, timestamp: now };
    console.log('wsClient.js: Generated simulated tick:', tick); 
    tickData.set({ [tick.symbol]: tick });
}

function startSimulation() {
    stopLiveStream();
    initializeSimulator();
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(generateSimulatedTick, 50);
    wsStatus.set('connected');
    console.log("wsClient.js: Data simulation started"); 
}

function stopSimulation() {
    if (simulationInterval) {
        clearInterval(simulationInterval);
        simulationInterval = null;
    }
    subscriptions.update(subs => {
        subs.delete('SIM-EURUSD');
        return subs;
    });
    wsStatus.set('disconnected');
    console.log("wsClient.js: Data simulation stopped"); 
}

// --- Public API ---

export function setDataSource(mode) {
    console.log('wsClient.js: setDataSource called with mode:', mode); 
    dataSourceMode.set(mode);
    if (mode === 'live') {
        startLiveStream();
    } else if (mode === 'simulated') {
        startSimulation();
    } else {
        console.error(`Unknown data source mode: ${mode}`);
    }
}

export function subscribe(symbols) {
    if (get(dataSourceMode) === 'live' && ws && ws.readyState === WebSocket.OPEN) {
        console.log('wsClient.js: Sending subscribe for:', symbols); 
        ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    } else {
        console.warn('wsClient.js: Cannot subscribe, not in live mode or WebSocket is not open.');
    }
}

export function unsubscribe(symbols) {
    if (get(dataSourceMode) === 'live' && ws && ws.readyState === WebSocket.OPEN) {
        console.log('wsClient.js: Sending unsubscribe for:', symbols); 
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    } else {
         console.warn('wsClient.js: Cannot unsubscribe, not in live mode or WebSocket is not open.');
    }
}

// Initialize with the default mode
setDataSource(get(dataSourceMode));
