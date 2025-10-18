<script>
  // Props
  export let status = 'unknown'; // Possible values: connected, disconnected, connecting, error, ready, unknown
  export let text = '';
  export let showIndicator = true;
  export let size = 'medium'; // Possible values: small, medium, large
  
  // Default status text based on status value if not provided
  $: displayText = text || getDefaultText(status);
  
  // CSS classes based on props
  $: containerClass = `status-display status-${status} size-${size}`;
  $: indicatorClass = `status-indicator status-${status}`;
  
  function getDefaultText(statusValue) {
    switch (statusValue) {
      case 'connected': return 'Connected';
      case 'disconnected': return 'Disconnected';
      case 'connecting': return 'Connecting';
      case 'ws-connecting': return 'WebSocket Connecting';
      case 'ws-open': return 'WebSocket Open';
      case 'error': return 'Error';
      case 'ready': return 'Ready';
      default: return 'Unknown';
    }
  }
</script>

<div class={containerClass}>
  {#if showIndicator}
    <span class={indicatorClass}></span>
  {/if}
  <span class="status-text">{displayText}</span>
</div>

<style>
  .status-display {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    background-color: #111827;
    border-radius: 4px;
  }
  
  .status-indicator {
    width: 10px;
    height: 10px;
    border-radius: 50%;
  }
  
  .status-text {
    font-weight: 500;
    color: #e5e7eb;
  }
  
  /* Status colors */
  .status-disconnected .status-indicator,
  .status-error .status-indicator {
    background-color: #ef4444;
  }
  
  .status-connecting .status-indicator,
  .status-ws-connecting .status-indicator,
  .status-ws-open .status-indicator {
    background-color: #f59e0b;
  }
  
  .status-connected .status-indicator,
  .status-ready .status-indicator {
    background-color: #22c55e;
  }
  
  .status-unknown .status-indicator {
    background-color: #6b7280;
  }
  
  /* Size variations */
  .size-small {
    padding: 4px 6px;
    font-size: 10px;
  }
  
  .size-small .status-indicator {
    width: 8px;
    height: 8px;
  }
  
  .size-medium {
    padding: 6px 8px;
    font-size: 12px;
  }
  
  .size-medium .status-indicator {
    width: 10px;
    height: 10px;
  }
  
  .size-large {
    padding: 8px 12px;
    font-size: 14px;
  }
  
  .size-large .status-indicator {
    width: 12px;
    height: 12px;
  }
</style>