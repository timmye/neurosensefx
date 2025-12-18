// Framework-First WebSocket Pattern - Crystal Clarity Compliant
// Direct WebSocket API usage with Svelte reactive statements

import { writable } from 'svelte/store';

export function createWebSocketConnection(url) {
  const ws = writable(null);
  const status = writable('disconnected');
  const subscriptions = writable(new Map());
  let reconnectAttempts = 0;
  let reconnectTimer = null;

  function connect() {
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }

    const websocket = new WebSocket(url);
    ws.set(websocket);
    status.set('connecting');

    websocket.onopen = () => {
      console.log('WebSocket connected');
      status.set('connected');
      reconnectAttempts = 0;
      resubscribeAll(websocket);
    };

    websocket.onclose = () => {
      status.set('disconnected');
      if (reconnectAttempts < 5) {
        reconnectTimer = setTimeout(() => {
          reconnectAttempts++;
          connect();
        }, 1000 * Math.pow(2, reconnectAttempts));
      }
    };

    websocket.onerror = (error) => {
      console.error('WebSocket error:', error);
      status.set('error');
    };

    websocket.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        // Debug: Log incoming data to check pipPosition availability
        if (data.type === 'symbolDataPackage' || data.type === 'tick') {
          console.log('🌐 WebSocket Data:', {
            type: data.type,
            symbol: data.symbol,
            pipPosition: data.pipPosition,
            pipSize: data.pipSize
            // pipetteSize removed for efficiency
          });
        }
        subscriptions.update(subs => {
          const callback = subs.get(data.symbol);
          if (callback) callback(data);
          return subs;
        });
      } catch (error) {
        console.error('Message parse error:', error);
      }
    };
  }

  function resubscribeAll(websocket) {
    subscriptions.update(subs => {
      for (const [symbol] of subs) {
        websocket.send(JSON.stringify({
          type: 'get_symbol_data_package',
          symbol,
          adrLookbackDays: 14
        }));
      }
      return subs;
    });
  }

  function subscribe(symbol, callback) {
    subscriptions.update(subs => new Map(subs).set(symbol, callback));

    ws.update(websocket => {
      if (websocket?.readyState === WebSocket.OPEN) {
        websocket.send(JSON.stringify({
          type: 'get_symbol_data_package',
          symbol,
          adrLookbackDays: 14
        }));
      }
      return websocket;
    });

    return () => {
      subscriptions.update(subs => {
        const newSubs = new Map(subs);
        newSubs.delete(symbol);
        return newSubs;
      });
    };
  }

  function disconnect() {
    reconnectAttempts = 5;
    if (reconnectTimer) {
      clearTimeout(reconnectTimer);
    }
    ws.update(websocket => {
      if (websocket) websocket.close();
      return null;
    });
  }

  return {
    connect,
    disconnect,
    subscribe,
    ws,
    status
  };
}