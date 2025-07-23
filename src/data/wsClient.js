import { writable, get } from 'svelte/store';
import { vizConfig } from '/src/stores.js';

// --- Stores ---
export const tickData = writable({});
export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('simulated'); // 'live' or 'simulated'
export const subscriptions = writable(new Set());

// --- Private State ---
let ws = null;
let simulationInterval;
let simulationState = {};
let currentConfig = {};

vizConfig.subscribe(value => {
    currentConfig = value;
});

// --- WebSocket Connection ---
const getWebSocketUrl = () => {
    // CORRECT: Connect to the '/ws' path on the *same host* as the frontend.
    // Vite's proxy will intercept this and forward it to the backend (localhost:5035).
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
    console.log(`wsClient.js: Attempting to connect to ${WS_URL} via Vite proxy`);
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('wsClient.js: Live WebSocket connected via proxy');
            wsStatus.set('connected');
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.type === 'tick') {
                // --- CENTRALIZED TYPE COERCION HERE ---
                data.bid = parseFloat(data.bid);
                data.ask = parseFloat(data.ask);
                data.spread = parseFloat(data.spread);
                // ----------------------------------------
                console.log('wsClient.js: Received live tick (parsed):', data); 
                tickData.set({ [data.symbol]: data });
            } else if (data.type === 'subscribeResponse') {
                console.log('wsClient.js: Subscribe response:', data.results); 
                data.results.forEach(result => {
                    if (result.status === 'subscribed') {
                        subscriptions.update(subs => subs.add(result.symbol));
                    }
                });
            } // ... other message types
        };

        ws.onclose = () => {
            console.log('wsClient.js: Live WebSocket disconnected');
            if (get(dataSourceMode) === 'live') {
                setTimeout(startLiveStream, 3000);
            }
            stopLiveStream();
        };

        ws.onerror = (error) => {
            console.error('wsClient.js: WebSocket proxy error:', error);
            wsStatus.set('error');
            stopLiveStream();
        };
    } catch (e) {
        console.error('wsClient.js: Error creating WebSocket:', e); 
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
    simulationState = { lastTickTime: performance.now(), currentPrice: 1.25500, momentum: 0 };
    subscriptions.update(subs => subs.add('SIM-EURUSD'));
}

function generateSimulatedTick() {
    // ... (simulation logic remains the same)
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
    tickData.set({ [tick.symbol]: tick });
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
