import { writable, get } from 'svelte/store';
import { symbolStore } from './symbolStore';
import { TickSchema, SymbolDataPackageSchema } from './schema.js';

export const wsStatus = writable('disconnected');
export const dataSourceMode = writable('simulated');
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());

let ws = null;
let simulationTimeout;

const getWebSocketUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws';
    return `${protocol}//${host}${path}`;
};

const WS_URL = getWebSocketUrl();

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
            wsStatus.set(data.status);
            break;
        case 'ready':
            wsStatus.set('ready');
            availableSymbols.set(data.availableSymbols || []);
            const currentSubs = Array.from(get(subscriptions));
            if (currentSubs.length > 0) {
                currentSubs.forEach(symbol => subscribe(symbol));
            }
            break;
        case 'symbolDataPackage':
            const packageResult = SymbolDataPackageSchema.safeParse(data);
            if (packageResult.success) {
                handleDataPackage(packageResult.data);
            } else {
                console.error('Invalid symbol data package:', packageResult.error);
            }
            break;
        case 'tick':
            const tickResult = TickSchema.safeParse(data);
            if (tickResult.success) {
                symbolStore.dispatchTick(tickResult.data.symbol, tickResult.data);
            } else {
                console.error('Invalid tick data:', tickResult.error);
            }
            break;
        case 'error':
            handleError(data.message);
            break;
        default:
            console.warn('Received unknown message type:', data.type);
    }
}

function handleDataPackage(data) {
    symbolStore.createNewSymbol(data.symbol, data);
    subscriptions.update(subs => subs.add(data.symbol));
    if (get(dataSourceMode) === 'live' && ws) {
        ws.send(JSON.stringify({ type: 'start_tick_stream', symbol: data.symbol }));
    }
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
    const adr = 0.00850;
    const adrLookbackDays = 5;

    const mockDataPackage = {
        symbol,
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
}

export function stopSimulation() {
    if (simulationTimeout) clearTimeout(simulationTimeout);
    simulationTimeout = null;
}

export function subscribe(symbol) {
    if (get(dataSourceMode) === 'live' && get(wsStatus) === 'ready' && ws) {
        // Get the current adrLookbackDays from the symbolStore config
        const symbolData = get(symbolStore)[symbol];
        const adrLookbackDays = symbolData?.config?.adrLookbackDays || 5; // Default to 5 if not set
        ws.send(JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays }));
    } else {
        console.warn('Cannot subscribe, live data source not ready.');
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
