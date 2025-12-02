// Connection Setup Utilities - Single Responsibility
// Framework-first: Direct ConnectionManager usage with clear data processing

import { ConnectionManager } from './connectionManager.js';
import { processSymbolData, getWebSocketUrl } from './displayDataProcessor.js';

export function setupDisplayConnection(formattedSymbol) {
  const connectionManager = new ConnectionManager(getWebSocketUrl());
  connectionManager.connect();
  return connectionManager;
}

export function setupDataSubscription(connectionManager, formattedSymbol, lastData, canvasRef) {
  const unsubscribe = connectionManager.subscribeAndRequest(formattedSymbol, (data) => {
    processDataUpdate(data, formattedSymbol, lastData, canvasRef);
  });

  return unsubscribe;
}

function processDataUpdate(data, formattedSymbol, lastData, canvasRef) {
  try {
    const result = processSymbolData(data, formattedSymbol, lastData);
    if (result?.type === 'error') {
      handleDataError(result, canvasRef);
    } else if (result?.type === 'data') {
      console.log('[SYSTEM] Rendering', 'dayRange', '- Symbol:', formattedSymbol);
    } else if (result?.type === 'unhandled') {
      console.log('[SYSTEM] Unhandled message type - Type:', result.messageType);
    }
  } catch (error) {
    canvasRef?.renderError(`JSON_PARSE_ERROR: ${error.message}`);
  }
}

function handleDataError(result, canvasRef) {
  // Check if this is a connection status message, not a real error
  const errorMsg = result.message.toLowerCase();
  const isConnectionStatus = errorMsg.includes('disconnected') ||
                           errorMsg.includes('connecting') ||
                           errorMsg.includes('waiting') ||
                           errorMsg.includes('timeout');

  if (!isConnectionStatus) {
    canvasRef?.renderError(`BACKEND_ERROR: ${result.message}`);
  }
}

export function setupConnectionStatusMonitoring(connectionManager, connectionStatusCallback) {
  connectionManager.onStatusChange = () => {
    connectionStatusCallback(connectionManager.status);
  };
}