import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore';

// --- Stores ---
// Overall connection status: disconnected, ws-connecting, ws-open, ctrader-connecting, connected, error
export const wsStatus = writable('disconnected'); 
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
    const path = '/ws'; 
    const url = `${protocol}//${host}${path}`;
    console.log('Generated WebSocket URL:', url); // Debug log
    return url;
};

let WS_URL = getWebSocketUrl(); // Use let because it might be needed in reconnect logic later

export function connect() {
    console.log('Attempting WebSocket connection to:', WS_URL); // Debug log
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        console.log('WebSocket already connecting or open.'); // Debug log
        return;
    }
    stopSimulation(); // Ensure simulation is stopped
    wsStatus.set('ws-connecting'); // Set status to WS connecting
    try {
        ws = new WebSocket(WS_URL);

        ws.onopen = () => {
            console.log('WebSocket connection established.'); // Debug log
            // Status will be updated by backend's status message
            console.log('Sending initial connect message.'); // Debug log
            ws.send(JSON.stringify({ type: 'connect' }));
        };

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            console.log('Received WebSocket message:', data); // Debug log
            switch (data.type) {
                case 'status':
                     // Simply update stores based on the backend's unified status
                    wsStatus.set(data.status);
                    availableSymbols.set(data.availableSymbols || []);
                    if (data.status === 'connected') {
                         // Resubscribe to non-simulation symbols if we were previously subscribed
                         const currentSubs = get(subscriptions);
                         const symbolsToResubscribe = Array.from(currentSubs).filter(symbol => 
                              get(availableSymbols).includes(symbol) // Only resubscribe if symbol is available
                         );
                         if (symbolsToResubscribe.length > 0) {
                             console.log('Live data connected, resubscribing to:', symbolsToResubscribe);
                             subscribe(symbolsToResubscribe);
                         }
                    }
                    // Log backend message if any
                    if (data.message) {
                         console.log('Backend status message:', data.message);
                    }
                    break;
                case 'tick':
                    symbolStore.dispatchTick(data.symbol, { ...data, bid: parseFloat(data.bid), ask: parseFloat(data.ask) });
                    break;
                case 'subscribeResponse':
                case 'unsubscribeResponse':
                    handleSubscriptionResponse(data);
                    break;
                case 'error': // Backend explicitly sending an error message
                    console.error('Backend Error Message:', data.message);
                    wsStatus.set('error'); // Transition to error state
                    // Clearing might be safer on backend error.
                    availableSymbols.set([]);
                    subscriptions.set(new Set());
                    break;
                default:
                    console.warn('Received unknown message type:', data.type); // Debug log
            }
        };

        ws.onclose = (event) => {
            console.log('WebSocket connection closed.', event); // Debug log
            ws = null;
            // Transition to disconnected unless we were in an error state already
            if (get(wsStatus) !== 'error') {
                 wsStatus.set('disconnected');
            }
            availableSymbols.set([]);
            subscriptions.set(new Set());
        };

        ws.onerror = (err) => {
            console.error('WebSocket Error:', err); // Debug log
            wsStatus.set('error'); // Set status to error on WS error
            availableSymbols.set([]);
            subscriptions.set(new Set());
            if (ws) ws.close(); // Ensure connection is closed
        };
    } catch (e) {
        console.error('Failed to create WebSocket:', e); // Debug log
        wsStatus.set('error'); // Set status to error on WebSocket creation failure
        availableSymbols.set([]);
        subscriptions.set(new Set());
        ws = null;
    }
}

export function disconnect() {
    console.log('Attempting to disconnect WebSocket.'); // Debug log
    if (ws && ws.readyState === WebSocket.OPEN) {
        // Optionally send a disconnect message to backend
        // ws.send(JSON.stringify({ type: 'disconnect' })); 
        ws.onclose = null; // Prevent onclose from firing during manual disconnect
        ws.close();
    } else {
         console.log('WebSocket not open, cannot disconnect.');
    }
    ws = null;
    wsStatus.set('disconnected');
    availableSymbols.set([]);
    subscriptions.set(new Set());
}

// --- Data Simulation ---
const frequencySettings = {
    calm: { baseInterval: 2000, randomness: 1500, magnitudeMultiplier: 0.5 },
    normal: { baseInterval: 800, randomness: 1000, magnitudeMultiplier: 1 },
    active: { baseInterval: 300, randomness: 400, magnitudeMultiplier: 1.5 },
    volatile: { baseInterval: 100, randomness: 200, magnitudeMultiplier: 2.5 },
};

export function startSimulation() {
    console.log('Starting simulation.'); // Debug log
    disconnect(); // Ensure live connection is off
    wsStatus.set('disconnected'); // Simulation doesn't use wsStatus, explicitly set live status to disconnected
    availableSymbols.set([]);
    subscriptions.set(new Set());

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
        type: 'tick', symbol, bid: simulationState.currentPrice, ask: simulationState.currentPrice + (Math.random() * 0.2 / 10000), timestamp: performance.now() 
        // Simulation ticks don't need all the backend tick properties, but add some to match expected structure
        , volume: 1000000 + Math.random() * 500000 // Simulated volume
        , lastTickDirection: simulationState.momentum > 0 ? 'up' : (simulationState.momentum < 0 ? 'down' : 'flat') // Simulated direction
    });

    function runSimulationLoop() {
        // Only run simulation if dataSourceMode is 'simulated'
        if (get(dataSourceMode) !== 'simulated') {
             console.log('Simulation loop stopping, data source changed.');
             simulationTimeout = null;
             return;
        }

        const config = get(symbolStore)[symbol]?.config;
        if (!config) {
             console.warn('Simulation config not found, delaying loop.');
            simulationTimeout = setTimeout(runSimulationLoop, 100);
            return;
        }

        const settings = frequencySettings[config.frequencyMode] || frequencySettings.normal;

        simulationState.momentum = (simulationState.momentum || 0) * 0.85; // Apply decay

        // Introduce some randomness to bias direction based on momentum
        const directionBias = simulationState.momentum * 0.2; // Adjust bias strength
        const randomFactor = Math.random() - 0.5; // -0.5 to 0.5
        const biasedRandom = randomFactor + directionBias;

        const direction = biasedRandom > 0 ? 1 : (biasedRandom < 0 ? -1 : 0);

        // Prevent becoming completely flat unless momentum is zero
        if (direction === 0 && simulationState.momentum !== 0) {
            direction = simulationState.momentum > 0 ? 1 : -1;
        }

        simulationState.momentum = Math.max(-1, Math.min(1, simulationState.momentum + direction * (Math.random() * 0.3 + 0.1))); // Adjust momentum change
        
        let magnitude = (Math.random() < 0.8) ? Math.random() * 0.8 : (Math.random() < 0.98) ? 0.8 + Math.random() * 2 : 3 + Math.random() * 5;
        magnitude *= settings.magnitudeMultiplier;
        
        // Adjust price change based on direction and magnitude
        simulationState.currentPrice += (direction * magnitude / 100000); // Adjusted division for smaller price movements
         // Ensure price stays positive (especially for forex)
        simulationState.currentPrice = Math.max(0.00001, simulationState.currentPrice);

        const tick = { 
            type: 'tick', 
            symbol: symbol, 
            bid: simulationState.currentPrice, 
            ask: simulationState.currentPrice + (Math.random() * 0.2 / 10000), // Randomize spread slightly
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
    console.log('Stopping simulation.'); // Debug log
    if (simulationTimeout) {
        clearTimeout(simulationTimeout);
        simulationTimeout = null;
    }
     // Clear simulation symbol from subscriptions and symbolStore
     const simSymbol = 'SIM-EURUSD';
     subscriptions.update(subs => {
         subs.delete(simSymbol);
         return subs;
     });
     symbolStore.removeSymbol(simSymbol);
}

// --- Public API for Subscriptions ---
export function subscribe(symbols) {
    console.log('Attempting to subscribe to:', symbols); // Debug log
    // Only subscribe if data source is live AND wsStatus is connected
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        ws.send(JSON.stringify({ type: 'subscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    } else {
        console.warn('Cannot subscribe, live data source not connected. Current status:', get(wsStatus)); // More detailed warning
    }
}

export function unsubscribe(symbols) {
     console.log('Attempting to unsubscribe from:', symbols); // Debug log
     // Only unsubscribe if data source is live AND wsStatus is connected
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'connected' && ws) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: Array.isArray(symbols) ? symbols : [symbols] }));
    }
}

function handleSubscriptionResponse(data) {
     console.log('Received subscription response:', data); // Debug log
    if (!data.results) return;
    
    subscriptions.update(subs => {
        data.results.forEach(result => {
            if (result.status === 'subscribed') {
                subs.add(result.symbol);
                symbolStore.createNewSymbol(result.symbol); 
            } else if (result.status === 'unsubscribed') {
                subs.delete(result.symbol);
                symbolStore.removeSymbol(result.symbol);
            } else if (result.status === 'error') {
                console.error(`Subscription error for ${result.symbol}: ${result.message}`);
            }
        });
        return new Set(subs);
    });
}

// Ensure simulation stops if data source mode changes from simulated
dataSourceMode.subscribe(mode => {
    if (mode !== 'simulated') {
        stopSimulation();
    }
});
