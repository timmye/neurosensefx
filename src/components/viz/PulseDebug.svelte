<script>
  import { onMount } from 'svelte';

  let debugCanvas;
  const width = 300;
  const height = 120;

  onMount(() => {
    if (!debugCanvas) {
      console.error('Debug canvas not found!');
      return;
    }

    // Set canvas dimensions
    const dpr = window.devicePixelRatio || 1;
    debugCanvas.width = width * dpr;
    debugCanvas.height = height * dpr;
    debugCanvas.style.width = `${width}px`;
    debugCanvas.style.height = `${height}px`;

    const ctx = debugCanvas.getContext('2d');
    if (!ctx) {
      console.error('Could not get 2D context');
      return;
    }
    ctx.scale(dpr, dpr);

    // Perform the simplest possible drawing operation
    ctx.fillStyle = 'red';
    ctx.beginPath();
    ctx.arc(50, 50, 20, 0, 2 * Math.PI); // Draw a large red circle at (50, 50)
    ctx.fill();

    console.log('PulseDebug.svelte: Attempted to draw a red circle.');
  });
</script>

<div class="debug-wrapper">
  <canvas bind:this={debugCanvas}></canvas>
</div>

<style>
  .debug-wrapper {
    border: 1px solid red;
    width: 300px;
    height: 120px;
  }
  canvas {
    width: 100%;
    height: 100%;
    background-color: #333;
  }
</style>
