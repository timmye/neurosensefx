<script>
  import { createEventDispatcher } from 'svelte';
  
  export let snapPoint = null;
  export let showIndicator = false;
  export let gridSize = 20;
  export let gridStyle = 'lines';
  
  const dispatch = createEventDispatcher();
  
  // Calculate snap indicator position
  $: indicatorStyle = snapPoint ? {
    left: `${snapPoint.x}px`,
    top: `${snapPoint.y}px`,
    transform: 'translate(-50%, -50%)'
  } : {};
  
  // Determine snap type styling
  $: snapType = snapPoint?.type || 'grid';
  $: snapVariant = snapType === 'grid' ? 'primary' : snapType === 'edge' ? 'secondary' : 'accent';
</script>

{#if showIndicator && snapPoint}
  <div 
    class="snap-indicator"
    class:snap-grid={snapType === 'grid'}
    class:snap-edge={snapType === 'edge'}
    class:snap-center={snapType === 'center'}
    style={indicatorStyle}
  >
    <div class="snap-point"></div>
    <div class="snap-lines">
      <div class="snap-line horizontal"></div>
      <div class="snap-line vertical"></div>
    </div>
    <div class="snap-label">
      {snapType === 'grid' ? 'Grid' : snapType === 'edge' ? 'Edge' : 'Center'}
    </div>
  </div>
{/if}

<style>
  .snap-indicator {
    position: absolute;
    pointer-events: none;
    z-index: 9999;
    animation: snapPulse 1s ease-in-out infinite;
  }
  
  .snap-point {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    background: var(--color-primary);
    border: 2px solid var(--bg-primary);
    box-shadow: 0 0 8px rgba(59, 130, 246, 0.5);
  }
  
  .snap-indicator.snap-grid .snap-point {
    background: var(--color-primary);
  }
  
  .snap-indicator.snap-edge .snap-point {
    background: var(--color-secondary);
    box-shadow: 0 0 8px rgba(107, 114, 128, 0.5);
  }
  
  .snap-indicator.snap-center .snap-point {
    background: var(--color-accent);
    box-shadow: 0 0 8px rgba(168, 85, 247, 0.5);
  }
  
  .snap-lines {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  .snap-line {
    position: absolute;
    background: currentColor;
    opacity: 0.6;
  }
  
  .snap-line.horizontal {
    width: 40px;
    height: 1px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  .snap-line.vertical {
    width: 1px;
    height: 40px;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
  }
  
  .snap-indicator.snap-grid .snap-line {
    color: var(--color-primary);
  }
  
  .snap-indicator.snap-edge .snap-line {
    color: var(--color-secondary);
  }
  
  .snap-indicator.snap-center .snap-line {
    color: var(--color-accent);
  }
  
  .snap-label {
    position: absolute;
    top: -20px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    font-weight: var(--font-weight-medium);
    padding: 2px 6px;
    background: var(--bg-elevated);
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    white-space: nowrap;
    color: var(--text-primary);
  }
  
  @keyframes snapPulse {
    0%, 100% {
      opacity: 1;
      transform: translate(-50%, -50%) scale(1);
    }
    50% {
      opacity: 0.8;
      transform: translate(-50%, -50%) scale(1.1);
    }
  }
</style>
