// Data callback handler composable for FloatingDisplay
// Creates and manages the data processing callback for WebSocket messages
import { processSymbolData as processSymbolDataCore } from '../lib/displayDataProcessor.js';
import { useSymbolData } from './useSymbolData.js';

export function useDataCallback() {
  const { processSymbolData: processMarketProfileData } = useSymbolData();

  function createCallback(formattedSymbol, lastDataRef, lastMarketProfileDataRef, canvasRef) {
    return (data) => {
      try {
        const result = processSymbolDataCore(data, formattedSymbol, lastDataRef.value);
        if (result?.type === 'data') {
          lastDataRef.value = result.data;
        } else if (result?.type === 'error' && !isConnectionRelated(result.message)) {
          canvasRef?.renderError(`BACKEND_ERROR: ${result.message}`);
        }

        const profileResult = processMarketProfileData(
          data,
          formattedSymbol,
          lastDataRef.value,
          lastMarketProfileDataRef.value
        );
        if (profileResult.lastMarketProfileData !== undefined) {
          lastMarketProfileDataRef.value = profileResult.lastMarketProfileData;
        }
        if (profileResult.error) {
          canvasRef?.renderError(profileResult.error);
        }
      } catch (error) {
        canvasRef?.renderError(`JSON_PARSE_ERROR: ${error.message}`);
      }
    };
  }

  function isConnectionRelated(message) {
    const msg = message.toLowerCase();
    return ['disconnected', 'connecting', 'waiting', 'timeout', 'invalid symbol', 'backend not ready']
      .some(term => msg.includes(term));
  }

  return { createCallback };
}
