/**
 * Generic multi-message dependency coordinator
 * Framework-First: Map, Set, setTimeout only
 * Crystal Clarity: <80 lines, <15 line functions
 */
export function createMessageCoordinator(config) {
  const { requiredTypes, timeoutMs, onAllReceived, onTimeout } = config;
  const buffers = new Map();
  const received = new Map();
  const timeouts = new Map();

  function initSymbol(symbol) {
    buffers.set(symbol, new Map());
    received.set(symbol, new Set());
  }

  function startTimeout(symbol) {
    timeouts.set(symbol, setTimeout(() => {
      const partial = Object.fromEntries(buffers.get(symbol));
      cleanup(symbol);
      onTimeout(symbol, partial, received.get(symbol));
    }, timeoutMs));
  }

  function checkComplete(symbol) {
    if (received.get(symbol).size === requiredTypes.length) {
      const allData = Object.fromEntries(buffers.get(symbol));
      cleanup(symbol);
      onAllReceived(symbol, allData);
    }
  }

  function cleanup(symbol) {
    if (timeouts.has(symbol)) clearTimeout(timeouts.get(symbol));
    buffers.delete(symbol);
    received.delete(symbol);
    timeouts.delete(symbol);
  }

  return {
    onMessage(symbol, messageType, data) {
      if (!buffers.has(symbol)) initSymbol(symbol);
      buffers.get(symbol).set(messageType, data);
      received.get(symbol).add(messageType);
      if (received.get(symbol).size === 1) startTimeout(symbol);
      checkComplete(symbol);
    },

    cleanup
  };
}
