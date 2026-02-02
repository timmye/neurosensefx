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
        console.log('[useDataCallback] profileResult:', {
          hasLastMarketProfileData: profileResult.lastMarketProfileData !== undefined,
          lastMarketProfileDataLength: profileResult.lastMarketProfileData?.length || 0,
          lastMarketProfileDataRefValueBefore: lastMarketProfileDataRef.value,
          lastMarketProfileDataRefValueBeforeLength: lastMarketProfileDataRef.value?.length || 0,
          hasError: !!profileResult.error
        });
        // Only update if we have new profile data (not undefined/null)
        // and it's different from the current value
        if (profileResult.lastMarketProfileData !== undefined &&
            profileResult.lastMarketProfileData !== null) {
          lastMarketProfileDataRef.value = profileResult.lastMarketProfileData;
          console.log('[useDataCallback] Updated lastMarketProfileDataRef.value:', {
            length: lastMarketProfileDataRef.value?.length || 0,
            isFirstItem: lastMarketProfileDataRef.value?.[0]
          });
        } else {
          console.log('[useDataCallback] Skipped update (no new profile data)');
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
