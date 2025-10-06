<script>
  export let status = 'idle'; // idle, success, warning, error, loading
  export let size = 'medium'; // small, medium, large
  export let label = '';
  
  function getClasses() {
    return [
      'status-indicator',
      `status-indicator-${size}`,
      `status-${status}`
    ].filter(Boolean).join(' ');
  }
  
  function getStatusColor() {
    switch (status) {
      case 'success': return 'var(--color-success)';
      case 'warning': return 'var(--color-warning)';
      case 'error': return 'var(--color-danger)';
      case 'loading': return 'var(--color-focus)';
      default: return 'var(--text-secondary)';
    }
  }
</script>

<div class="status-indicator-wrapper">
  <div class={getClasses()} style="--status-color: {getStatusColor()}"></div>
  {#if label}
    <span class="status-label">{label}</span>
  {/if}
</div>

<style>
  .status-indicator-wrapper {
    display: inline-flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .status-indicator {
    display: inline-block;
    background-color: var(--status-color);
    border-radius: var(--radius-full);
    transition: all var(--motion-fast) var(--ease-snappy);
  }
  
  .status-indicator-small {
    width: 8px;
    height: 8px;
  }
  
  .status-indicator-medium {
    width: 12px;
    height: 12px;
  }
  
  .status-indicator-large {
    width: 16px;
    height: 16px;
  }
  
  .status-loading {
    animation: pulse 1.5s ease-in-out infinite;
  }
  
  .status-label {
    font-size: var(--text-sm);
    color: var(--text-primary);
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
</style>
