import { writable, get } from 'svelte/store';
import { displayActions } from '../stores/displayStore.js';
import { TickSchema, SymbolDataPackageSchema } from './schema.js';
import { wsErrorHandler, createWebSocketConnection } from '../utils/websocketErrorHandler.js';
import { withErrorBoundary, withAsyncErrorBoundary } from '../utils/errorBoundaryUtils.js';

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

// Connection fallback testing
async function testDirectConnection(port) {
    return new Promise((resolve) => {
        const testWs = new WebSocket(`ws://localhost:${port}`);
        const timeout = setTimeout(() => {
            testWs.close();
            resolve(false);
        }, 3000);

        testWs.onopen = () => {
            clearTimeout(timeout);
            testWs.close();
            resolve(true);
        };

        testWs.onerror = () => {
            clearTimeout(timeout);
            resolve(false);
        };
    });
}

const WS_URL = (() => {
    // Priority 1: Cloud environment override
    if (import.meta.env.VITE_BACKEND_URL) {
        return import.meta.env.VITE_BACKEND_URL;
    }

    // Priority 2: Direct connection with environment-aware port
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.hostname;
    const port = import.meta.env.DEV ? 8080 : 8081;  // Use actual backend port
    return `${protocol}//${host}:${port}`;
})();

// Connection retry management
let retryCount = 0;
let maxRetries = 5;
let retryDelay = 1000; // Start with 1 second
let retryTimeout = null;

export async function connect() {
    return withAsyncErrorBoundary(async () => {
        if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
            return;
        }

        // Clear any existing retry timeout
        if (retryTimeout) {
            clearTimeout(retryTimeout);
            retryTimeout = null;
        }

        await attemptConnection();
    }, null, 'WebSocketConnect');
}

async function attemptConnection() {
    // WebSocket connection initiated
    wsStatus.set('ws-connecting');
    console.log(`[wsClient] Connection attempt ${retryCount + 1}/${maxRetries} to ${WS_URL}`);

    try {
        // Use error handler for connection
        ws = await wsErrorHandler.connect(WS_URL);

        // Set up event handlers with error boundaries
        ws.onopen = withErrorBoundary(() => {
            console.log('[wsClient] WebSocket connected successfully');
            retryCount = 0; // Reset retry count on successful connection
            startConnectionMonitor();
        }, null, 'WebSocketOpen');

        ws.onmessage = withErrorBoundary((event) => {
            wsErrorHandler.handleData(event.data, handleSocketMessage);
        }, null, 'WebSocketMessage');

        ws.onclose = withErrorBoundary((event) => {
            console.log(`[wsClient] WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
            stopConnectionMonitor();
            ws = null;

            if (get(wsStatus) !== 'error') {
                wsStatus.set('disconnected');
                // Let the error handler manage reconnection
                // Only schedule retry if error handler doesn't handle it
                if (event.code !== 1000 && retryCount < maxRetries && wsErrorHandler.getStatus().state !== 'RECONNECTING') {
                    scheduleRetry();
                }
            }
        }, null, 'WebSocketClose');

        ws.onerror = withErrorBoundary((err) => {
            console.error('[wsClient] WebSocket Error:', err);
            stopConnectionMonitor();
            if (ws) ws.close(); // Ensure close is called on error
            wsStatus.set('error'); // Set status to error on connection failure

            // Let the error handler manage reconnection
            if (retryCount < maxRetries && wsErrorHandler.getStatus().state !== 'RECONNECTING') {
                scheduleRetry();
            }
        }, null, 'WebSocketError');

    } catch (e) {
        console.error('[wsClient] Failed to create WebSocket:', e);
        ws = null;
        wsStatus.set('error'); // Set status to error on creation failure

        // Schedule retry if under retry limit and error handler isn't handling it
        if (retryCount < maxRetries && wsErrorHandler.getStatus().state !== 'RECONNECTING') {
            scheduleRetry();
        }
    }
}

function scheduleRetry() {
    retryCount++;
    const delay = retryDelay * Math.pow(2, retryCount - 1); // Exponential backoff
    console.log(`[wsClient] Scheduling retry ${retryCount}/${maxRetries} in ${delay}ms`);

    retryTimeout = setTimeout(() => {
        retryTimeout = null;
        attemptConnection();
    }, delay);
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
    const displays = currentStore.displays || new Map();

    for (const [displayId, display] of displays) {
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
    // Clear retry logic
    if (retryTimeout) {
        clearTimeout(retryTimeout);
        retryTimeout = null;
    }
    retryCount = 0;

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

        // Add subscription confirmation message for Phase 3 testing
        console.log(`WebSocket subscription confirmation: ${symbol}`);

        // Add display ready message
        setTimeout(() => {
            console.log(`display ready for ${symbol}`);
        }, 500);

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
