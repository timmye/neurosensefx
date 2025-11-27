<script>
  // Props for fallback configuration
  export let symbol = "Unknown";
  export let visualizationType = "Unknown";
  export let error = null;
  export let onRetry = null;

  function handleRetry() {
    if (onRetry) {
      onRetry();
    }
  }
</script>

<div class="viz-error-fallback">
  <div class="viz-error-content">
    <div class="viz-error-header">
      <div class="viz-icon">📊</div>
      <div class="viz-info">
        <h4 class="viz-title">{symbol} - {visualizationType}</h4>
        <p class="viz-status">Visualization Error</p>
      </div>
    </div>

    <div class="viz-error-body">
      <p class="error-message">
        The {visualizationType.toLowerCase()} for {symbol} could not be rendered.
        This could be due to data loading issues or a temporary system error.
      </p>

      {#if error?.message}
        <div class="error-technical">
          <span class="error-code">{error.message}</span>
        </div>
      {/if}

      {#if onRetry}
        <button class="viz-retry-button" on:click={handleRetry}>
          🔄 Retry Loading {visualizationType}
        </button>
      {/if}
    </div>

    <div class="viz-error-footer">
      <div class="system-status">
        <span class="status-indicator status-warning"></span>
        <span class="status-text">Trading functionality remains active</span>
      </div>
    </div>
  </div>
</div>

<style>
  .viz-error-fallback {
    width: 100%;
    height: 100%;
    min-height: 200px;
    background: linear-gradient(135deg, #1e293b 0%, #334155 100%);
    border: 1px solid #475569;
    border-radius: 8px;
    padding: 16px;
    display: flex;
    flex-direction: column;
  }

  .viz-error-content {
    flex: 1;
    display: flex;
    flex-direction: column;
  }

  .viz-error-header {
    display: flex;
    align-items: center;
    gap: 12px;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #475569;
  }

  .viz-icon {
    font-size: 24px;
    opacity: 0.7;
  }

  .viz-info {
    flex: 1;
  }

  .viz-title {
    font-size: 14px;
    font-weight: 600;
    color: #f1f5f9;
    margin: 0 0 4px 0;
  }

  .viz-status {
    font-size: 12px;
    color: #fbbf24;
    margin: 0;
  }

  .viz-error-body {
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-bottom: 16px;
  }

  .error-message {
    font-size: 13px;
    color: #cbd5e1;
    line-height: 1.4;
    margin: 0;
  }

  .error-technical {
    background: rgba(239, 68, 68, 0.1);
    border: 1px solid rgba(239, 68, 68, 0.3);
    border-radius: 4px;
    padding: 8px;
  }

  .error-code {
    font-size: 11px;
    color: #f87171;
    font-family: monospace;
  }

  .viz-retry-button {
    background: #3b82f6;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 12px;
    font-weight: 500;
    align-self: flex-start;
    transition: background-color 0.2s;
  }

  .viz-retry-button:hover {
    background: #2563eb;
  }

  .viz-error-footer {
    padding-top: 12px;
    border-top: 1px solid #475569;
  }

  .system-status {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .status-indicator {
    width: 8px;
    height: 8px;
    border-radius: 50%;
  }

  .status-warning {
    background: #fbbf24;
    animation: pulse-warning 2s infinite;
  }

  @keyframes pulse-warning {
    0%, 100% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
  }

  .status-text {
    font-size: 11px;
    color: #94a3b8;
  }
</style>