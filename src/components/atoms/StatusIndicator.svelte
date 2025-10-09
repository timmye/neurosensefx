<script>
  import { CheckCircle, AlertCircle, XCircle, Loader2, Circle } from 'lucide-svelte';

  export let status = 'idle'; // idle, success, warning, error, loading
  export let size = 'medium'; // small, medium, large
  export let label = '';
  export let showIcon = true;
  
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

  // Get icon size based on component size
  $: iconSize = {
    small: 12,
    medium: 16,
    large: 20
  }[size] || 16;

  // Map status to Lucide icons
  $: statusIcon = {
    success: CheckCircle,
    warning: AlertCircle,
    error: XCircle,
    loading: Loader2,
    idle: Circle
  }[status] || Circle;
</script>

<div class="status-indicator-wrapper">
  {#if showIcon}
    <div class="status-icon">
      <svelte:component this={statusIcon} size={iconSize} style="color: {getStatusColor()}" />
    </div>
  {:else}
    <div class={getClasses()} style="--status-color: {getStatusColor()}"></div>
  {/if}
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
  
  .status-icon {
    display: flex;
    align-items: center;
    justify-content: center;
  }
  
  .status-icon :deep(svg) {
    width: auto;
    height: auto;
  }
  
  .status-loading :deep(svg) {
    animation: spin 1s linear infinite;
  }
  
  @keyframes pulse {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }
  
  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>
