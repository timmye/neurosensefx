// DEBUGGER: Test to understand what happens when new levels have different TPO counts
// This simulates a realistic scenario where not all price levels are touched equally

console.log('[DEBUGGER:TEST:10] Testing realistic market profile with TPO disparity');

function simulateRealisticProfile() {
  const profile = new Map();

  // Simulate historical data (500 bars) - concentrated in middle range
  const historicalBars = 500;
  const basePrice = 1.0850;

  console.log(`\n[DEBUGGER:TEST:11] Simulating ${historicalBars} historical bars with realistic distribution`);

  for (let i = 0; i < historicalBars; i++) {
    // Price distribution: 60% in middle, 20% high, 20% low
    let priceOffset;
    const rand = Math.random();
    if (rand < 0.6) {
      priceOffset = Math.floor(Math.random() * 10) * 0.0001; // Middle range: 1.0850-1.0859
    } else if (rand < 0.8) {
      priceOffset = (10 + Math.floor(Math.random() * 5)) * 0.0001; // High: 1.0860-1.0864
    } else {
      priceOffset = (-5 + Math.floor(Math.random() * 5)) * 0.0001; // Low: 1.0845-1.0849
    }

    const priceLevel = basePrice + priceOffset;
    const currentTpo = profile.get(priceLevel) || 0;
    profile.set(priceLevel, currentTpo + 1);
  }

  console.log(`[DEBUGGER:TEST:12] After historical accumulation:`);
  console.log(`  Total price levels: ${profile.size}`);
  const sortedByTpo = Array.from(profile.entries()).sort((a, b) => b[1] - a[1]);
  console.log(`  Max TPO: ${sortedByTpo[0][1]} (price=${sortedByTpo[0][0]})`);
  console.log(`  Min TPO: ${sortedByTpo[sortedByTpo.length - 1][1]} (price=${sortedByTpo[sortedByTpo.length - 1][0]})`);

  // Simulate 5 new bars in a NEW price level (not previously touched)
  console.log(`\n[DEBUGGER:TEST:13] Adding 5 new bars at a NEW price level (1.0870)`);
  const newPriceLevel = basePrice + 0.0020; // 1.0870 - a level that had 0 TPO before

  for (let i = 0; i < 5; i++) {
    const currentTpo = profile.get(newPriceLevel) || 0;
    profile.set(newPriceLevel, currentTpo + 1);

    const maxTpo = Math.max(...profile.values());
    const newLevelTpo = profile.get(newPriceLevel);

    console.log(`[DEBUGGER:TEST:14.${i}] After bar ${i+1}: newLevel TPO=${newLevelTpo}, maxTpo=${maxTpo}`);
  }

  return Array.from(profile.entries()).map(([price, tpo]) => ({ price, tpo })).sort((a, b) => a.price - b.price);
}

function analyzeRendering(profileData) {
  console.log(`\n[DEBUGGER:TEST:15] Frontend rendering analysis`);
  console.log(`  Total levels: ${profileData.length}`);

  const maxTpo = Math.max(...profileData.map(d => d.tpo));
  const marketProfileWidth = 100;
  const tpoScale = marketProfileWidth / maxTpo;

  console.log(`\n[DEBUGGER:TEST:16] Final scaling:`);
  console.log(`  maxTpo: ${maxTpo}`);
  console.log(`  tpoScale: ${tpoScale.toFixed(4)}`);
  console.log(`  For each TPO increment, bar width increases by: ${tpoScale.toFixed(2)}px`);

  // Find the new level (1.0870) and compare with established levels
  const newLevel = profileData.find(d => Math.abs(d.price - 1.0870) < 0.00001);
  const highTpoLevel = profileData.reduce((max, d) => d.tpo > max.tpo ? d : max);
  const lowTpoLevel = profileData.reduce((min, d) => d.tpo < min.tpo ? d : min);

  console.log(`\n[DEBUGGER:TEST:17] Comparison:`);
  console.log(`  NEW level (1.0870): TPO=${newLevel.tpo}, barWidth=${(newLevel.tpo * tpoScale).toFixed(2)}px`);
  console.log(`  HIGH level (${highTpoLevel.price}): TPO=${highTpoLevel.tpo}, barWidth=${(highTpoLevel.tpo * tpoScale).toFixed(2)}px`);
  console.log(`  LOW level (${lowTpoLevel.price}): TPO=${lowTpoLevel.tpo}, barWidth=${(lowTpoLevel.tpo * tpoScale).toFixed(2)}px`);

  console.log(`\n[DEBUGGER:TEST:18] === CRITICAL INSIGHT ===`);
  console.log(`The new level has TPO=${newLevel.tpo} but the maxTpo is ${maxTpo}.`);
  console.log(`This means the new level's bar width is: ${((newLevel.tpo / maxTpo) * 100).toFixed(1)}% of full width.`);
  console.log(`Meanwhile, the high TPO level has bar width: 100% (at maxTpo).`);

  if (maxTpo > newLevel.tpo * 2) {
    console.log(`\n⚠️  VISUAL DISPARITY DETECTED!`);
    console.log(`The new level appears ${((maxTpo / newLevel.tpo)).toFixed(1)}x smaller than the largest level.`);
    console.log(`This creates the "squashed" appearance the user reported.`);
  }
}

const profile = simulateRealisticProfile();
analyzeRendering(profile);
