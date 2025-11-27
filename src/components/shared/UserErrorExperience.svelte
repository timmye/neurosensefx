<script>
  import { onMount } from 'svelte';

  // Props
  export let errors = [];
  export let showNotifications = true;
  export let autoDismiss = true;
  export let dismissDelay = 5000;
  export let maxVisibleErrors = 5;

  // State
  let activeErrors = [];
  let dismissedErrors = new Set();
  let errorHistory = [];
  let showDetails = false;

  // Error categories for different handling
  const ERROR_CATEGORIES = {
    NETWORK: 'Network',
    DATA: 'Data',
    DISPLAY: 'Display',
    CRITICAL: 'Critical',
    WARNING: 'Warning',
    INFO: 'Info'
  };

  // Categorize error
  function categorizeError(error) {
    if (!error) return ERROR_CATEGORIES.INFO;

    const message = error.message || error.toString().toLowerCase();

    if (message.includes('network') || message.includes('connection') || message.includes('websocket')) {
      return ERROR_CATEGORIES.NETWORK;
    }
    if (message.includes('data') || message.includes('parse') || message.includes('validation')) {
      return ERROR_CATEGORIES.DATA;
    }
    if (message.includes('display') || message.includes('render') || message.includes('canvas')) {
      return ERROR_CATEGORIES.DISPLAY;
    }
    if (message.includes('critical') || message.includes('emergency') || message.includes('safety')) {
      return ERROR_CATEGORIES.CRITICAL;
    }
    if (message.includes('warning') || message.includes('deprecated')) {
      return ERROR_CATEGORIES.WARNING;
    }

    return ERROR_CATEGORIES.INFO;
  }

  // Get user-friendly error message
  function getUserFriendlyMessage(error, category) {
    const message = error.message || error.toString();

    switch (category) {
      case ERROR_CATEGORIES.NETWORK:
        return 'Connection issue detected. Trading data may be delayed. Reconnecting...';
      case ERROR_CATEGORIES.DATA:
        return 'Data processing issue. Some market data may be temporarily unavailable.';
      case ERROR_CATEGORIES.DISPLAY:
        return 'Visualization error. Some displays may not render correctly.';
      case ERROR_CATEGORIES.CRITICAL:
        return 'Critical system error. Safety measures have been activated.';
      case ERROR_CATEGORIES.WARNING:
        return 'Performance warning. System may be running slower than normal.';
      default:
        return message.length > 100 ? message.substring(0, 100) + '...' : message;
    }
  }

  // Get recovery actions for error category
  function getRecoveryActions(category, error) {
    switch (category) {
      case ERROR_CATEGORIES.NETWORK:
        return [
          { label: 'Retry Connection', action: 'retry-connection' },
          { label: 'Check Status', action: 'check-status' }
        ];
      case ERROR_CATEGORIES.DATA:
        return [
          { label: 'Refresh Data', action: 'refresh-data' },
          { label: 'Reset Display', action: 'reset-display' }
        ];
      case ERROR_CATEGORIES.DISPLAY:
        return [
          { label: 'Retry Render', action: 'retry-render' },
          { label: 'Safe Mode', action: 'safe-mode' }
        ];
      case ERROR_CATEGORIES.CRITICAL:
        return [
          { label: 'Emergency Reset', action: 'emergency-reset' },
          { label: 'Contact Support', action: 'contact-support' }
        ];
      default:
        return [
          { label: 'Dismiss', action: 'dismiss' },
          { label: 'Details', action: 'show-details' }
        ];
    }
  }

  // Add new error
  function addError(error) {
    if (!error) return;

    const errorId = error.id || `error-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const category = categorizeError(error);
    const timestamp = new Date();

    const processedError = {
      id: errorId,
      originalError: error,
      category,
      message: getUserFriendlyMessage(error, category),
      timestamp,
      severity: getSeverity(category),
      actions: getRecoveryActions(category, error),
      autoDismiss: category !== ERROR_CATEGORIES.CRITICAL
    };

    // Skip if already dismissed
    if (dismissedErrors.has(errorId)) return;

    // Add to active errors
    activeErrors = [processedError, ...activeErrors].slice(0, maxVisibleErrors);
    errorHistory = [processedError, ...errorHistory].slice(0, 50);

    // Auto-dismiss if enabled and not critical
    if (autoDismiss && processedError.autoDismiss) {
      setTimeout(() => {
        dismissError(errorId);
      }, dismissDelay);
    }

    // Log error for debugging
    console.error('[USER_ERROR_EXPERIENCE]', processedError);
  }

  // Get severity level
  function getSeverity(category) {
    switch (category) {
      case ERROR_CATEGORIES.CRITICAL:
        return 'critical';
      case ERROR_CATEGORIES.NETWORK:
      case ERROR_CATEGORIES.DATA:
        return 'high';
      case ERROR_CATEGORIES.DISPLAY:
      case ERROR_CATEGORIES.WARNING:
        return 'medium';
      default:
        return 'low';
    }
  }

  // Dismiss error
  function dismissError(errorId) {
    dismissedErrors.add(errorId);
    activeErrors = activeErrors.filter(error => error.id !== errorId);
  }

  // Execute recovery action
  async function executeAction(error, action) {
    console.log(`[USER_ERROR_EXPERIENCE] Executing action: ${action} for error: ${error.id}`);

    try {
      switch (action) {
        case 'retry-connection':
          // Trigger WebSocket reconnection
          if (window.wsClient) {
            window.wsClient.connect();
          }
          break;

        case 'check-status':
          // Show system status
          alert('Connection Status: Checking... (Status panel would open here)');
          break;

        case 'refresh-data':
          // Trigger data refresh
          console.log('Refreshing data...');
          break;

        case 'reset-display':
          // Reset problematic display
          console.log('Resetting display...');
          break;

        case 'retry-render':
          // Retry rendering
          console.log('Retrying render...');
          break;

        case 'safe-mode':
          // Activate safe mode
          console.log('Activating safe mode...');
          break;

        case 'emergency-reset':
          // Emergency system reset
          if (window.safeTradingWorkflow) {
            window.safeTradingWorkflow.attemptRecovery();
          }
          break;

        case 'contact-support':
          // Open support contact
          window.open('mailto:support@neurosensefx.com?subject=Trading Platform Error', '_blank');
          break;

        case 'show-details':
          showDetails = true;
          break;

        case 'dismiss':
          dismissError(error.id);
          break;

        default:
          console.warn(`[USER_ERROR_EXPERIENCE] Unknown action: ${action}`);
      }

      // Dismiss error after action (except show-details)
      if (action !== 'show-details') {
        dismissError(error.id);
      }

    } catch (actionError) {
      console.error(`[USER_ERROR_EXPERIENCE] Action failed: ${action}`, actionError);
      // Show action failed notification
      addError({
        message: `Recovery action failed: ${action}`,
        category: ERROR_CATEGORIES.WARNING
      });
    }
  }

  // Clear all errors
  function clearAllErrors() {
    activeErrors.forEach(error => dismissedErrors.add(error.id));
    activeErrors = [];
  }

  // Global error listener
  onMount(() => {
    // Listen for global errors
    const handleError = (event) => {
      addError({
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        source: 'global'
      });
    };

    const handleUnhandledRejection = (event) => {
      addError({
        message: event.reason,
        source: 'promise'
      });
    };

    // Listen for custom error events from other components
    const handleCustomError = (event) => {
      addError(event.detail);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('trading-error', handleCustomError);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      window.removeEventListener('trading-error', handleCustomError);
    };
  });

  // React to errors prop changes
  $: if (errors && Array.isArray(errors)) {
    errors.forEach(error => addError(error));
  }

  // Make globally available for other components
  $: if (typeof window !== 'undefined') {
    window.userErrorExperience = {
      addError,
      dismissError,
      clearAllErrors,
      getActiveErrors: () => activeErrors,
      getErrorHistory: () => errorHistory
    };
  }
</script>

{#if showNotifications && activeErrors.length > 0}
  <div class="error-experience-container" class:has-critical={activeErrors.some(e => e.severity === 'critical')}>
    {#each activeErrors as error (error.id)}
      <div class="error-notification" class:severity-critical={error.severity === 'critical'} class:severity-high={error.severity === 'high'} class:severity-medium={error.severity === 'medium'} class:severity-low={error.severity === 'low'} class:category-network={error.category === 'network'} class:category-rendering={error.category === 'rendering'} class:category-data={error.category === 'data'} class:category-user={error.category === 'user'}>
        <div class="error-header">
          <div class="error-icon">
            {#if error.severity === 'critical'}
              🚨
            {:else if error.category === ERROR_CATEGORIES.NETWORK}
              🌐
            {:else if error.category === ERROR_CATEGORIES.DATA}
              📊
            {:else if error.category === ERROR_CATEGORIES.DISPLAY}
              🖥️
            {:else}
              ⚠️
            {/if}
          </div>
          <div class="error-content">
            <div class="error-title">{error.category} Error</div>
            <div class="error-message">{error.message}</div>
            <div class="error-time">
              {error.timestamp.toLocaleTimeString()}
            </div>
          </div>
          <button class="error-dismiss" on:click={() => dismissError(error.id)} title="Dismiss">
            ×
          </button>
        </div>

        {#if error.actions && error.actions.length > 0}
          <div class="error-actions">
            {#each error.actions as action}
              <button
                class="error-action"
                class:action-primary={action.action.includes('retry') || action.action.includes('emergency')}
                on:click={() => executeAction(error, action.action)}
              >
                {action.label}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}

    {#if activeErrors.length > 1}
      <div class="error-summary">
        <span class="summary-text">{activeErrors.length} active issues</span>
        <button class="clear-all" on:click={clearAllErrors}>
          Clear All
        </button>
      </div>
    {/if}
  </div>
{/if}

{#if showDetails && errorHistory.length > 0}
  <div class="error-details-modal" on:click={() => showDetails = false}>
    <div class="error-details-content" on:click|stopPropagation>
      <div class="details-header">
        <h3>Error History</h3>
        <button class="close-details" on:click={() => showDetails = false}>
          ×
        </button>
      </div>
      <div class="details-body">
        {#each errorHistory as error}
          <div class="detail-item">
            <div class="detail-time">{error.timestamp.toLocaleString()}</div>
            <div class="detail-category">{error.category}</div>
            <div class="detail-message">{error.message}</div>
            {#if error.originalError?.stack}
              <details class="detail-stack">
                <summary>Technical Details</summary>
                <pre>{error.originalError.stack}</pre>
              </details>
            {/if}
          </div>
        {/each}
      </div>
    </div>
  </div>
{/if}

<style>
  .error-experience-container {
    position: fixed;
    top: 20px;
    right: 20px;
    z-index: 10000;
    max-width: 400px;
    pointer-events: none;
  }

  .error-experience-container.has-critical {
    top: 10px;
    right: 10px;
  }

  .error-notification {
    background: rgba(31, 41, 55, 0.95);
    border: 1px solid #4b5563;
    border-radius: 8px;
    margin-bottom: 8px;
    padding: 12px;
    backdrop-filter: blur(8px);
    pointer-events: all;
    animation: slideIn 0.3s ease-out;
  }

  .error-notification.severity-critical {
    background: rgba(220, 38, 38, 0.95);
    border-color: #dc2626;
    animation: criticalPulse 2s infinite;
  }

  .error-notification.severity-high {
    background: rgba(245, 158, 11, 0.95);
    border-color: #f59e0b;
  }

  .error-notification.severity-medium {
    background: rgba(59, 130, 246, 0.95);
    border-color: #3b82f6;
  }

  @keyframes slideIn {
    from {
      transform: translateX(100%);
      opacity: 0;
    }
    to {
      transform: translateX(0);
      opacity: 1;
    }
  }

  @keyframes criticalPulse {
    0%, 100% {
      box-shadow: 0 0 0 0 rgba(220, 38, 38, 0.4);
    }
    50% {
      box-shadow: 0 0 0 8px rgba(220, 38, 38, 0);
    }
  }

  .error-header {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    margin-bottom: 8px;
  }

  .error-icon {
    font-size: 18px;
    flex-shrink: 0;
    margin-top: 2px;
  }

  .error-content {
    flex: 1;
    min-width: 0;
  }

  .error-title {
    font-size: 12px;
    font-weight: 600;
    color: #f3f4f6;
    margin: 0 0 4px 0;
  }

  .error-message {
    font-size: 13px;
    color: #d1d5db;
    line-height: 1.4;
    margin: 0 0 4px 0;
  }

  .error-time {
    font-size: 11px;
    color: #9ca3af;
  }

  .error-dismiss {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 16px;
    cursor: pointer;
    padding: 0;
    width: 20px;
    height: 20px;
    display: flex;
    align-items: center;
    justify-content: center;
    border-radius: 4px;
    transition: background-color 0.2s;
  }

  .error-dismiss:hover {
    background: rgba(75, 85, 99, 0.5);
  }

  .error-actions {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .error-action {
    background: rgba(75, 85, 99, 0.5);
    border: 1px solid #4b5563;
    color: #f3f4f6;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .error-action:hover {
    background: rgba(75, 85, 99, 0.7);
  }

  .error-action.action-primary {
    background: rgba(59, 130, 246, 0.5);
    border-color: #3b82f6;
  }

  .error-action.action-primary:hover {
    background: rgba(59, 130, 246, 0.7);
  }

  .error-summary {
    background: rgba(31, 41, 55, 0.95);
    border: 1px solid #4b5563;
    border-radius: 6px;
    padding: 8px 12px;
    display: flex;
    justify-content: space-between;
    align-items: center;
    pointer-events: all;
    backdrop-filter: blur(8px);
  }

  .summary-text {
    font-size: 12px;
    color: #9ca3af;
  }

  .clear-all {
    background: rgba(239, 68, 68, 0.5);
    border: 1px solid #ef4444;
    color: #fca5a5;
    padding: 2px 8px;
    border-radius: 4px;
    font-size: 11px;
    cursor: pointer;
    transition: all 0.2s;
  }

  .clear-all:hover {
    background: rgba(239, 68, 68, 0.7);
  }

  .error-details-modal {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 10001;
  }

  .error-details-content {
    background: #1f2937;
    border: 1px solid #4b5563;
    border-radius: 8px;
    padding: 20px;
    max-width: 600px;
    max-height: 80vh;
    width: 90%;
    overflow-y: auto;
  }

  .details-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 16px;
    padding-bottom: 12px;
    border-bottom: 1px solid #4b5563;
  }

  .details-header h3 {
    color: #f3f4f6;
    margin: 0;
    font-size: 16px;
  }

  .close-details {
    background: none;
    border: none;
    color: #9ca3af;
    font-size: 20px;
    cursor: pointer;
    padding: 0;
    width: 24px;
    height: 24px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .details-body {
    max-height: 400px;
    overflow-y: auto;
  }

  .detail-item {
    background: rgba(31, 41, 55, 0.5);
    border: 1px solid #374151;
    border-radius: 4px;
    padding: 12px;
    margin-bottom: 8px;
  }

  .detail-time {
    font-size: 11px;
    color: #9ca3af;
    margin-bottom: 4px;
  }

  .detail-category {
    font-size: 12px;
    font-weight: 600;
    color: #60a5fa;
    margin-bottom: 4px;
  }

  .detail-message {
    font-size: 13px;
    color: #d1d5db;
    line-height: 1.4;
    margin-bottom: 8px;
  }

  .detail-stack {
    margin: 0;
  }

  .detail-stack summary {
    cursor: pointer;
    font-size: 11px;
    color: #9ca3af;
    padding: 4px;
    background: rgba(0, 0, 0, 0.2);
    border-radius: 3px;
    margin-bottom: 4px;
  }

  .detail-stack pre {
    background: #111827;
    color: #e5e7eb;
    padding: 8px;
    border-radius: 4px;
    font-size: 10px;
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 100px;
    overflow-y: auto;
  }

  /* Responsive design */
  @media (max-width: 640px) {
    .error-experience-container {
      top: 10px;
      right: 10px;
      left: 10px;
      max-width: none;
    }

    .error-notification {
      padding: 10px;
    }

    .error-actions {
      flex-direction: column;
    }

    .error-action {
      width: 100%;
      text-align: center;
    }
  }
</style>