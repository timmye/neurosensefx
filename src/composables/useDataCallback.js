// Data callback handler composable for FloatingDisplay
// Creates and manages the data processing callback for WebSocket messages
//
// DATA CONTRACTS: See src/lib/dataContracts.js for type definitions

import { processSymbolData as processSymbolDataCore } from '../lib/displayDataProcessor.js';
import { useSymbolData } from './useSymbolData.js';
import { validateWebSocketMessage, logValidationResult } from '../lib/dataContracts.js';

export function useDataCallback() {
  const { processSymbolData: processMarketProfileData } = useSymbolData();

  /**
   * Creates a callback for processing WebSocket messages
   * @param {string} formattedSymbol
   * @param {{value: Object}} lastDataRef
   * @param {{value: Array}} lastMarketProfileDataRef
   * @param {Object} canvasRef
   * @returns {Function}
   */
  function createCallback(formattedSymbol, lastDataRef, lastMarketProfileDataRef, canvasRef) {
    function isConnectionRelated(message) {
      const msg = message.toLowerCase();
      return ['disconnected', 'connecting', 'waiting', 'timeout', 'invalid symbol', 'backend not ready']
        .some(term => msg.includes(term));
    }

    return (data) => {
      // Dev mode validation
      if (import.meta.env.DEV) {
        const validation = validateWebSocketMessage(data, 'useDataCallback');
        logValidationResult('useDataCallback:input', validation, data);
      }

      try {
        const result = processSymbolDataCore(data, formattedSymbol, lastDataRef.value);
        if (result?.type === 'data') {
          lastDataRef.value = result.data;
        } else if (result?.type === 'error' && !isConnectionRelated(result.message)) {
          canvasRef?.renderError(`BACKEND_ERROR: ${result.message}`);
        }

        // Process market profile
        const profileResult = processMarketProfileData(
          data, formattedSymbol, lastDataRef.value, lastMarketProfileDataRef.value
        );

        if (import.meta.env.DEV) {
          console.log('[useDataCallback] profileResult:', {
            hasData: profileResult.lastMarketProfileData !== undefined,
            length: profileResult.lastMarketProfileData?.length || 0
          });
        }

        if (profileResult.lastMarketProfileData !== undefined) {
          lastMarketProfileDataRef.value = profileResult.lastMarketProfileData;
        }
        if (profileResult.error) {
          canvasRef?.renderError(profileResult.error);
        }
      } catch (error) {
        canvasRef?.renderError(`PROCESSING_ERROR: ${error.message}`);
      }
    };
  }

  return { createCallback };
}
