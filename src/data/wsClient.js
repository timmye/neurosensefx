import { writable, get } from 'svelte/store';
import { displayActions } from '../stores/displayStore.js';
import { TickSchema, SymbolDataPackageSchema } from './schema.js';

export const wsStatus = writable('disconnected');
export const availableSymbols = writable([]);
export const subscriptions = writable(new Set());

// Cache symbols to persist across connection drops
let cachedSymbols = [];
const originalSet = availableSymbols.set;
availableSymbols.set = (value) => {
    if (value && value.length > 0) {
        cachedSymbols = [...value];
    }
    return originalSet.call(availableSymbols, value);
};

// Restore cached symbols on subscription if available
availableSymbols.subscribe((value) => {
    if ((!value || value.length === 0) && cachedSymbols.length > 0) {
        console.log('🔄 Restoring cached symbols:', cachedSymbols.length);
        setTimeout(() => availableSymbols.set(cachedSymbols), 100);
    }
});

let ws = null;
let connectionMonitorInterval = null;

const WS_URL = (() => {
    // Use VITE_BACKEND_URL if available (for cloud environments), otherwise use the default local URL
    if (import.meta.env.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL;
    }
    
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const path = '/ws';
    return `${protocol}//${host}${path}`;
})();

export function connect() {
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
        return;
    }
    
    // WebSocket connection initiated
    wsStatus.set('ws-connecting');
    try {
        ws = new WebSocket(WS_URL);
        ws.onopen = () => {
        // WebSocket connected
            startConnectionMonitor();
        };
        ws.onmessage = (event) => {
            const rawData = JSON.parse(event.data);
            handleSocketMessage(rawData);
        };
        ws.onclose = (event) => {
            stopConnectionMonitor();
            ws = null;
            if (get(wsStatus) !== 'error') wsStatus.set('disconnected');
            // Don't immediately clear symbols on disconnect - they might be cached
            // availableSymbols.set([]);
        };
        ws.onerror = (err) => {
            console.error('[wsClient] WebSocket Error:', err);
            stopConnectionMonitor();
            if (ws) ws.close(); // Ensure close is called on error
            wsStatus.set('error'); // Set status to error on connection failure
        };
    } catch (e) {
        console.error('[wsClient] Failed to create WebSocket:', e);
        ws = null;
        wsStatus.set('error'); // Set status to error on creation failure
    }
}

function startConnectionMonitor() {
    stopConnectionMonitor();
    connectionMonitorInterval = setInterval(() => {
        if (!ws) {
            stopConnectionMonitor();
        }
    }, 2000);
}

function stopConnectionMonitor() {
    if (connectionMonitorInterval) {
        clearInterval(connectionMonitorInterval);
        connectionMonitorInterval = null;
    }
}

function handleSocketMessage(data) {
    
    if (data.type === 'symbolDataPackage') {
        const packageResult = SymbolDataPackageSchema.safeParse(data);
        if (packageResult.success) {
            handleDataPackage(packageResult.data);
        } else {
            console.error('[wsClient] Invalid symbol data package:', packageResult.error);
        }
    } else if (data.type === 'status' || data.type === 'ready') {
         const status = data.type === 'ready' ? 'connected' : data.status;
         wsStatus.set(status);
         if(status === 'connected'){
             availableSymbols.set(data.availableSymbols || []);
         }
    } else if (data.type === 'tick') {
    // Processing tick
        const tickResult = TickSchema.safeParse(data);
        if (tickResult.success) {
                        displayActions.dispatchTick(tickResult.data.symbol, tickResult.data);
        } else {
            console.error('[wsClient] Invalid tick data received:', tickResult.error);
        }
    }
}

function handleDataPackage(data) {
        
    // 🔧 CRITICAL FIX: Check if display already exists before creating/updating
    const currentStore = get(displayStore);
    let existingDisplay = null;
    
    // Search for existing display with this symbol
    for (const [displayId, display] of currentStore.displays) {
        if (display.symbol === data.symbol) {
            existingDisplay = display;
            break;
        }
    }
    
    if (existingDisplay) {
        // Update existing display (workspace restoration case)
        displayActions.updateExistingSymbol(data.symbol, data);
    } else {
        // Create new display (symbol palette case)
        displayActions.createNewSymbol(data.symbol, data);
    }

    subscriptions.update(subs => {
        subs.add(data.symbol);
        return subs;
    });
}

export function disconnect() {
    if (ws) {
        ws.onclose = null; // Prevent triggering onclose logic during manual disconnect
        ws.close();
        ws = null;
    }
    wsStatus.set('disconnected');
    availableSymbols.set([]);
    subscriptions.set(new Set());
    
    // Clear all displays and workers
    displayActions.clear();
    console.log('[wsClient] Disconnect called - displayStore cleared');
}

export function subscribe(symbol) {
    console.log(`[WSCLIENT_DEBUG] subscribe called for symbol: ${symbol}`);
    console.log(`[WSCLIENT_DEBUG] wsStatus: ${get(wsStatus)}, ws exists: ${!!ws}`);
    
    if (get(wsStatus) === 'connected' && ws) {
        const adrLookbackDays = 14;
        const message = JSON.stringify({ type: 'get_symbol_data_package', symbol, adrLookbackDays });
        console.log(`[WSCLIENT_DEBUG] Sending message: ${message}`);
        ws.send(message);
    } else {
        console.log(`[WSCLIENT_DEBUG] Cannot subscribe - WebSocket not connected`);
    }
}

export function unsubscribe(symbol) {
    if (ws) {
        ws.send(JSON.stringify({ type: 'unsubscribe', symbols: [symbol] }));
    }
    
    // Remove symbol displays and workers
    displayActions.removeSymbol(symbol);
    console.log('[wsClient] Unsubscribe called for:', symbol);
    
    subscriptions.update(subs => {
        subs.delete(symbol);
        return subs;
    });
}

export function initializeWsClient() {
    // Initialize live WebSocket connection
    connect();
}
