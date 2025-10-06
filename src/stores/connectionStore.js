import { writable, derived } from 'svelte/store';

function createConnectionStore() {
  const { subscribe, set, update } = writable({
    status: 'disconnected', // disconnected, connecting, connected, error
    url: '',
    lastConnected: null,
    reconnectAttempts: 0
  });
  
  return {
    subscribe,
    setStatus: (status) => update(state => ({ ...state, status })),
    setUrl: (url) => update(state => ({ ...state, url })),
    setLastConnected: (timestamp) => update(state => ({ ...state, lastConnected: timestamp })),
    incrementReconnectAttempts: () => update(state => ({ ...state, reconnectAttempts: state.reconnectAttempts + 1 })),
    resetReconnectAttempts: () => update(state => ({ ...state, reconnectAttempts: 0 })),
    reset: () => set({
      status: 'disconnected',
      url: '',
      lastConnected: null,
      reconnectAttempts: 0
    })
  };
}

export const connectionStore = createConnectionStore();

// Derived stores
export const isConnected = derived(
  connectionStore,
  $connectionStore => $connectionStore.status === 'connected'
);
