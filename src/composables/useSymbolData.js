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
    const result = { lastData, lastMarketProfileData, error: null };

    if (data.type === 'symbolDataPackage' && data.initialMarketProfile) {
      const bucketSize = data.bucketSize;
      const { profile, actualBucketSize } = buildProfile(
        data.initialMarketProfile,
        bucketSize,
        data
      );
      result.lastMarketProfileData = profile;
    } else if (data.type === 'profileUpdate' && data.profile) {
      result.lastMarketProfileData = data.profile.levels;
    } else if (data.type === 'profileError' && data.symbol === formattedSymbol) {
      result.error = `PROFILE_ERROR: ${data.message}`;
    }

    return result;
  }

  return { buildProfile, processSymbolData };
}
