<script>
  import { displayActions } from '../stores/displayStore.js';
  import { displays } from '../stores/displayStore.js';

  function createTestDisplay() {
    console.log('[TEST] Creating test display...');

    // Create a test display with specific position
    const displayId = displayActions.addDisplay('EURUSD', {
      x: 200 + Math.random() * 100,
      y: 200 + Math.random() * 100
    });

    console.log('[TEST] Display created with ID:', displayId);

    // Check current displays
    $displays.forEach((display, id) => {
      console.log('[TEST] Current display:', {
        id,
        symbol: display.symbol,
        position: display.position,
        ready: display.ready
      });
    });
  }

  function createMultipleTestDisplays() {
    console.log('[TEST] Creating multiple test displays...');

    const symbols = ['EURUSD', 'GBPUSD', 'USDJPY', 'XAUUSD'];
    symbols.forEach((symbol, index) => {
      setTimeout(() => {
        const displayId = displayActions.addDisplay(symbol, {
          x: 100 + (index * 150),
          y: 100 + (index * 50)
        });
        console.log(`[TEST] Created display for ${symbol} with ID: ${displayId}`);
      }, index * 200); // Stagger creation
    });
  }
</script>

<div class="test-controls">
  <h3>Display Creation Test</h3>
  <button on:click={createTestDisplay}>Create Test Display</button>
  <button on:click={createMultipleTestDisplays}>Create Multiple Displays</button>
  <div class="display-count">Current displays: {$displays.size}</div>
</div>

<style>
  .test-controls {
    position: fixed;
    bottom: 20px;
    left: 20px;
    background: rgba(0, 0, 0, 0.9);
    color: white;
    padding: 15px;
    border-radius: 8px;
    z-index: 9999;
    font-family: monospace;
  }

  button {
    background: #4f46e5;
    color: white;
    border: none;
    padding: 8px 12px;
    margin: 5px;
    border-radius: 4px;
    cursor: pointer;
  }

  button:hover {
    background: #3730a3;
  }

  .display-count {
    margin-top: 10px;
    font-weight: bold;
  }
</style>