// DEBUGGER: Test to verify if maxTpo is being recalculated correctly on each update
// The bug might be that maxTpo is NOT being recalculated, causing incorrect scaling

console.log('[DEBUGGER:TEST:19] Testing maxTpo recalculation hypothesis');

function simulateUpdateWithMaxTpoTracking() {
  const profile = [
    { price: 1.0850, tpo: 25 },
    { price: 1.0851, tpo: 30 },
    { price: 1.0852, tpo: 28 },
    { price: 1.0853, tpo: 20 }
  ];

  console.log(`\n[DEBUGGER:TEST:20] Initial profile:`);
  profile.forEach(level => console.log(`  ${level.price}: TPO=${level.tpo}`));

  const initialMaxTpo = Math.max(...profile.map(d => d.tpo));
  console.log(`\n[DEBUGGER:TEST:21] Initial maxTpo: ${initialMaxTpo}`);

  // Scenario 1: maxTpo is NOT recalculated (buggy behavior)
  console.log(`\n[DEBUGGER:TEST:22] === SCENARIO 1: maxTpo NOT recalculated (BUGGY) ===`);
  const marketProfileWidth = 100;
  const tpoScale_fixed = marketProfileWidth / initialMaxTpo;

  // Add new bar that increases maxTpo
  profile[1].tpo += 1; // Now TPO=31, new max
  const newMaxTpo = Math.max(...profile.map(d => d.tpo));

  console.log(`After update: 1.0851 TPO=${profile[1].tpo}, actual maxTpo=${newMaxTpo}`);
  console.log(`But using stale maxTpo=${initialMaxTpo} for scaling`);

  profile.forEach(level => {
    const barWidth = level.tpo * tpoScale_fixed;
    console.log(`  ${level.price}: TPO=${level.tpo}, barWidth=${barWidth.toFixed(2)}px (max allowed=${marketProfileWidth}px)`);
  });

  if (profile[1].tpo * tpoScale_fixed > marketProfileWidth) {
    console.log(`\n⚠️  OVERFLOW DETECTED! Bar width exceeds market profile width!`);
    console.log(`   ${profile[1].price}: ${(profile[1].tpo * tpoScale_fixed).toFixed(2)}px > ${marketProfileWidth}px`);
  }

  // Scenario 2: maxTpo IS recalculated (correct behavior)
  console.log(`\n[DEBUGGER:TEST:23] === SCENARIO 2: maxTpo recalculated (CORRECT) ===`);
  const tpoScale_correct = marketProfileWidth / newMaxTpo;

  profile.forEach(level => {
    const barWidth = level.tpo * tpoScale_correct;
    console.log(`  ${level.price}: TPO=${level.tpo}, barWidth=${barWidth.toFixed(2)}px`);
  });

  console.log(`\n[DEBUGGER:TEST:24] === VERIFICATION ===`);
  console.log(`In the code, maxTpo is calculated in orchestrator.js:34`);
  console.log(`Then tpoScale is calculated in orchestrator.js:35`);
  console.log(`Then bars are drawn in rendering.js:22-34`);
  console.log(`\nLet me verify the actual code flow...`);
}

simulateUpdateWithMaxTpoTracking();
