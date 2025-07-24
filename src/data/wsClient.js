import { writable, get } from 'svelte/store';
import { vizConfig } from '/src/stores.js';

// --- Stores ---
export const tickData = writable({});
export const wsStatus = writable('disconnected');
export const availableSymbols = writable([]); 
export const subscriptions = writable(new Set());

// --- Private State ---
let ws = null;
let simulationInterval;
let simulationState = {};
let currentConfig = get(vizConfig); // Get initial config for simulator

vizConfig.subscribe(value => currentConfig = value);

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
    console.log(`wsClient.js: Attempting to connect to ${WS_URL} via Vite proxy`);
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('wsClient.js: Live WebSocket connected via proxy');
            wsStatus.set('connected');
            // Request available symbols upon successful connection
            if (ws && ws.readyState === WebSocket.OPEN) {
                 ws.send(JSON.stringify({ type: 'getSubscriptions' })); // Request initial subscriptions
            }
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            
            switch (data.type) {
                case 'connection':
                    console.log('wsClient.js: Connection established. Available symbols:', data.availableSymbols);
                    availableSymbols.set(data.availableSymbols);
                    break;
                case 'tick':
                    // --- CORRECTED: Use update() to merge new ticks ---
                    tickData.update(currentTicks => {
                        return { ...currentTicks, [data.symbol]: data };
                    });
                    // ---------------------------------------------------
                    console.log('wsClient.js: Received live tick (parsed):', data); 
                    break;
                case 'subscribeResponse':
                    console.log('wsClient.js: Subscribe response:', data.results); 
                    data.results.forEach(result => {
                        if (result.status === 'subscribed') {
                            subscriptions.update(subs => subs.add(result.symbol));
                        }
                    });
                    break;
                case 'unsubscribeResponse':
                    console.log('wsClient.js: Unsubscribe response:', data.results);
                    data.results.forEach(result => {
                        if (result.status === 'unsubscribed') {
                            subscriptions.update(subs => {
                                subs.delete(result.symbol);
                                return subs;
                            });
                        }
                    });
                    break;
                case 'subscriptions': // Handle the response to getSubscriptions
                    console.log('wsClient.js: Received current subscriptions:', data.symbols);
                     data.symbols.forEach(symbol => subscriptions.update(subs => subs.add(symbol)));
                    break;
                case 'error':
                    console.error('wsClient.js: Received error from backend:', data.message);
                    break;
            }
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
    availableSymbols.set([]); 
}

// --- Data Simulation ---
// Modified simulation to update tickData store using update()
function startSimulation() {
    stopLiveStream();
    if (simulationInterval) clearInterval(simulationInterval);
    simulationInterval = setInterval(() => {
        const newPrice = 1.25500 + (Math.random() - 0.5) * 0.001;
        const tick = { type: 'tick', symbol: 'SIM-EURUSD', bid: newPrice, ask: newPrice + 0.00012, spread: 0.00012, timestamp: Date.now() };
        // --- Use update() for simulation ticks as well ---
         tickData.update(currentTicks => {
            return { ...currentTicks, [tick.symbol]: tick };
        });
        // -----------------------------------------------------
    }, 800);
    wsStatus.set('connected');
    subscriptions.update(subs => subs.add('SIM-EURUSD'));
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
export const dataSourceMode = writable('simulated');

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
