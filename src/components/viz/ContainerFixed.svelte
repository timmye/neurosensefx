<script>
  import { onMount, onDestroy } from 'svelte';
  import { withErrorBoundary, withAsyncErrorBoundary } from '../../utils/errorBoundaryUtils.js';

  export let id = 'container';
  export let symbol = 'EURUSD';
  export let config = {};
  export let data = null;

  let canvas;
  let ctx;
  let canvasError = false;
  let canvasReady = false;

  onMount(() => {
    console.log(`[CONTAINER_FIXED:${id}] Component mounted with symbol: ${symbol}`);

    // Initialize canvas with error boundary
    try {
      if (!canvas) {
        throw new Error('Canvas element not found');
      }

      ctx = canvas.getContext('2d');
      if (!ctx) {
        throw new Error('Failed to get canvas context');
      }

      canvasReady = true;
      console.log(`[CONTAINER_FIXED:${id}] Canvas initialized successfully`);

      // Test error boundary by simulating a potential error
      if (Math.random() < 0.1) { // 10% chance of error for testing
        throw new Error('Simulated canvas initialization error for testing');
      }

    } catch (error) {
      console.error(`[CONTAINER_FIXED:${id}] Canvas initialization failed:`, error);
      canvasError = true;
      canvasReady = false;
    }
  });

  onDestroy(() => {
    console.log(`[CONTAINER_FIXED:${id}] Component destroyed`);
  });

  // Test function to trigger error boundaries
  function testError() {
    throw new Error('Test error triggered by user');
  }
</script>

<div class="container-fixed" class:has-error={canvasError}>
  <h3>Fixed Container: {symbol}</h3>

  {#if canvasError}
    <div class="error-state">
      <p>❌ Canvas failed to initialize</p>
      <p>Symbol: {symbol}</p>
      <button on:click={testError}>Test Error Boundary</button>
    </div>
  {:else if canvasReady}
    <div class="success-state">
      <p>✅ Canvas ready</p>
      <canvas bind:this={canvas} width={300} height={200} class="test-canvas"></canvas>
      <button on:click={testError}>Test Error Boundary</button>
    </div>
  {:else}
    <div class="loading-state">
      <p>⏳ Initializing...</p>
    </div>
  {/if}
</div>

<style>
  .container-fixed {
    border: 2px solid #4b5563;
    border-radius: 8px;
    padding: 16px;
    margin: 8px;
    background: #1f2937;
    color: #f3f4f6;
  }

  .container-fixed.has-error {
    border-color: #ef4444;
    background: rgba(239, 68, 68, 0.1);
  }

  .error-state {
    text-align: center;
    padding: 20px;
  }

  .success-state {
    text-align: center;
    padding: 20px;
  }

  .loading-state {
    text-align: center;
    padding: 20px;
  }

  .test-canvas {
    border: 1px solid #6b7280;
    border-radius: 4px;
    background: #111827;
    margin: 10px auto;
    display: block;
  }

  button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 4px;
    cursor: pointer;
    margin-top: 10px;
  }

  button:hover {
    background: #2563eb;
  }

  h3 {
    margin: 0 0 16px 0;
    color: #f3f4f6;
  }
</style>