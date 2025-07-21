<script>
  import { onMount } from 'svelte';

  export let id;
  export let data = {}; // Placeholder for data prop

  let canvasElement;
  let ctx;

  onMount(() => {
    ctx = canvasElement.getContext('2d');
    // Initial drawing or setup
    draw();
  });

  // Function to draw on the canvas
  function draw() {
    if (!ctx) return;
    ctx.clearRect(0, 0, canvasElement.width, canvasElement.height);
    // For now, just draw a simple rectangle
    ctx.fillStyle = 'purple';
    ctx.fillRect(10, 10, 50, 50);
    ctx.fillStyle = 'white';
    ctx.font = '12px Arial';
    ctx.fillText(`Viz ${id}`, 15, 40);
  }

  // Reactively re-draw when data changes (placeholder)
  $: if (data) {
    draw();
  }
</script>

<canvas bind:this={canvasElement} width="220" height="120" style="border:1px solid #333;"></canvas>

<style>
  canvas {
    display: block;
    margin: 5px;
  }
</style>
