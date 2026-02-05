// DEBUGGER: Temporary test file for investigating market profile TPO scaling bug
// TO BE DELETED BEFORE FINAL REPORT
// This test verifies how TPO values accumulate and scale

console.log('[DEBUGGER:TEST:1] Starting market profile scaling investigation');

// Simulate backend behavior: how TPO values accumulate
function simulateBackendProfile() {
  const profile = new Map();

  // Simulate historical data (500 bars)
  const historicalBars = 500;
  console.log(`\n[DEBUGGER:TEST:2] Simulating ${historicalBars} historical M1 bars`);

  for (let i = 0; i < historicalBars; i++) {
    const priceLevel = 1.0850 + (i % 20) * 0.0001; // 20 price levels
    const currentTpo = profile.get(priceLevel) || 0;
    profile.set(priceLevel, currentTpo + 1);
  }

  console.log(`[DEBUGGER:TEST:3] After historical accumulation:`);
  console.log(`  Total price levels: ${profile.size}`);
  console.log(`  Max TPO: ${Math.max(...profile.values())}`);
  console.log(`  Sample TPO values: ${Array.from(profile.values()).slice(0, 5)}`);

  // Now simulate live updates (new bars)
  console.log(`\n[DEBUGGER:TEST:4] Simulating live M1 bar updates (5 bars)`);
  for (let i = 0; i < 5; i++) {
    const priceLevel = 1.0850 + (i % 20) * 0.0001; // Same price levels
    const currentTpo = profile.get(priceLevel) || 0;
    profile.set(priceLevel, currentTpo + 1);

    const maxTpo = Math.max(...profile.values());
    console.log(`[DEBUGGER:TEST:5.${i}] After bar ${i+1}: maxTpo=${maxTpo}, updatedLevel TPO=${profile.get(priceLevel)}`);
  }

  return Array.from(profile.entries()).map(([price, tpo]) => ({ price, tpo })).sort((a, b) => a.price - b.price);
}

// Simulate frontend rendering: how bars are scaled
function simulateFrontendRendering(profileData) {
  console.log(`\n[DEBUGGER:TEST:6] Simulating frontend rendering`);
  console.log(`  Profile levels: ${profileData.length}`);

  const maxTpo = Math.max(...profileData.map(d => d.tpo));
  const marketProfileWidth = 100; // pixels
  const tpoScale = marketProfileWidth / maxTpo;

  console.log(`[DEBUGGER:TEST:7] Scaling calculations:`);
  console.log(`  maxTpo: ${maxTpo}`);
  console.log(`  marketProfileWidth: ${marketProfileWidth}`);
  console.log(`  tpoScale: ${tpoScale.toFixed(4)}`);

  console.log(`\n[DEBUGGER:TEST:8] Bar width calculations (first 5 levels):`);
  profileData.slice(0, 5).forEach((level, idx) => {
    const barWidth = Math.max(level.tpo * tpoScale, 1);
    console.log(`  Level ${idx}: price=${level.price}, tpo=${level.tpo}, barWidth=${barWidth.toFixed(2)}px`);
  });
}

// Run the simulation
const profile = simulateBackendProfile();
simulateFrontendRendering(profile);

console.log(`\n[DEBUGGER:TEST:9] === KEY INSIGHTS ===`);
console.log(`Backend accumulates TPO values correctly (each bar adds 1 to each price level)`);
console.log(`Frontend calculates maxTpo from ENTIRE profile on each render`);
console.log(`tpoScale = marketProfileWidth / maxTpo`);
console.log(`barWidth = level.tpo * tpoScale`);
console.log(`\nIf maxTpo increases on every update, tpoScale decreases proportionally.`);
console.log(`This causes ALL bars to shrink, making new additions appear disproportionately large.`);
