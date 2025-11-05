// =============================================================================
// MARKET PROFILE CONFIGURATION FIXES ONLY
// =============================================================================
// This file contains the corrected market profile configuration values
// to be copied into displayStore.js

const MARKET_PROFILE_FIXES = {
  // === MARKET PROFILE CONFIGURATION FIXES ===
  marketProfileUpColor: '#10B981',    // ✅ FIXED: Green for buy volume
  marketProfileDownColor: '#EF4444',  // ✅ FIXED: Red for sell volume  
  marketProfileOpacity: 0.7,
  marketProfileOutline: true,
  marketProfileOutlineShowStroke: true,
  marketProfileOutlineStrokeWidth: 1,
  marketProfileOutlineUpColor: '#4B5563',
  marketProfileOutlineDownColor: '#4B5563',
  marketProfileOutlineOpacity: 1,
  distributionDepthMode: 'all',
  distributionPercentage: 50,
  priceBucketMultiplier: 1,
  marketProfileWidthRatio: 15,         // ✅ FIXED: 15% = visible bars (33px on 220px canvas)
  showMaxMarker: true
};

console.log('MARKET PROFILE CONFIGURATION FIXES:');
console.log('marketProfileUpColor:', MARKET_PROFILE_FIXES.marketProfileUpColor);
console.log('marketProfileDownColor:', MARKET_PROFILE_FIXES.marketProfileDownColor);
console.log('marketProfileWidthRatio:', MARKET_PROFILE_FIXES.marketProfileWidthRatio);

export default MARKET_PROFILE_FIXES;
