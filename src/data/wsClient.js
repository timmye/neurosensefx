import { writable } from 'svelte/store';

export const tickData = writable([]);
export const wsStatus = writable('disconnected');

const WS_URL = `ws://localhost:${import.meta.env.VITE_WEBSOCKET_PORT || 3003}`;

let ws;

function connectWebSocket() {
    wsStatus.set('connecting');
    ws = new WebSocket(WS_URL);

    ws.onopen = () => {
        console.log('WebSocket connected');
        wsStatus.set('connected');
        // You can send a message to the backend here if needed, e.g., to subscribe to symbols
        // ws.send(JSON.stringify({ type: 'subscribe', symbols: ['EURUSD'] }));
    };

    ws.onmessage = (event) => {
        const data = JSON.parse(event.data);
        // Assuming the backend sends tick data directly, e.g., { symbol: 'EURUSD', bid: 1.1234, ask: 1.1235 }
        tickData.update(currentTicks => {
            // Add new tick data, limit the array size if necessary
            const newTicks = [...currentTicks, data];
            return newTicks.slice(-100); // Keep last 100 ticks for example
        });
    };

    ws.onclose = () => {
        console.log('WebSocket disconnected');
        wsStatus.set('disconnected');
        // Attempt to reconnect after a delay
        setTimeout(connectWebSocket, 3000);
    };

    ws.onerror = (error) => {
        console.error('WebSocket error:', error);
        wsStatus.set('error');
        ws.close();
    };
}

// Initial connection
connectWebSocket();

// Optional: Function to send messages to the WebSocket server
export function sendWebSocketMessage(message) {
    if (ws && ws.readyState === WebSocket.OPEN) {
        ws.send(JSON.stringify(message));
    } else {
        console.warn('WebSocket is not open. Message not sent:', message);
    }
}
