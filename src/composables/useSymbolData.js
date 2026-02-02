// Symbol data processing composable for FloatingDisplay
// Handles Market Profile data transformation
import { buildInitialProfile } from '../lib/marketProfileProcessor.js';

export function useSymbolData() {
  function buildProfile(initialData, bucketSize, symbolData) {
    if (!initialData || initialData.length === 0) {
      return { profile: [], actualBucketSize: bucketSize };
    }
    return buildInitialProfile(initialData, bucketSize, symbolData);
  }

  function processSymbolData(data, formattedSymbol, lastData, lastMarketProfileData) {
    // Initialize result with undefined to indicate no update needed
    const result = { lastData, lastMarketProfileData: undefined, error: null };

    console.log('[useSymbolData] processSymbolData called:', {
      dataType: data?.type,
      hasProfile: !!data?.profile,
      profileLevelsLength: data?.profile?.levels?.length || 0,
      formattedSymbol,
      hasLastMarketProfileData: !!lastMarketProfileData
    });

    if (data.type === 'symbolDataPackage' && data.initialMarketProfile) {
      const bucketSize = data.bucketSize;
      const { profile, actualBucketSize } = buildProfile(
        data.initialMarketProfile,
        bucketSize,
        data
      );
      result.lastMarketProfileData = profile;
      console.log('[useSymbolData] symbolDataPackage processed, profile length:', profile?.length || 0);
    } else if (data.type === 'profileUpdate' && data.profile) {
      result.lastMarketProfileData = data.profile.levels;
      console.log('[useSymbolData] profileUpdate processed, levels length:', data.profile.levels?.length || 0);
      console.log('[DEBUGGER:useSymbolData:34-35] Sample levels:', data.profile.levels?.slice(0, 3).map(l => ({price: l.price, tpo: l.tpo})));
    } else if (data.type === 'profileError' && data.symbol === formattedSymbol) {
      result.error = `PROFILE_ERROR: ${data.message}`;
      console.log('[useSymbolData] profileError processed:', result.error);
    } else {
      console.log('[useSymbolData] No matching condition for data type:', data?.type);
    }

    console.log('[useSymbolData] Result:', {
      hasLastMarketProfileData: !!result.lastMarketProfileData,
      lastMarketProfileDataLength: result.lastMarketProfileData?.length || 0,
      hasError: !!result.error
    });

    return result;
  }

  return { buildProfile, processSymbolData };
}
