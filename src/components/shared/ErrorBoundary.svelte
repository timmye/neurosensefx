<script>
  import { onMount } from 'svelte';

  // Error boundary state
  let hasError = false;
  let error = null;
  let errorInfo = null;
  let retryCount = 0;
  let maxRetries = 3;

  // Props
  export let fallbackComponent = null;
  export let errorMessage = "This component encountered an error";
  export let showRetry = true;
  export let onErrorCallback = null;

  // Error handling functions
  const handleError = (error, errorInfo = null) => {
    hasError = true;
    error = error;
    retryCount++;

    // Log error with context
    console.error('[COMPONENT_ERROR_BOUNDARY]', {
      error: error.message,
      stack: error.stack,
      errorInfo,
      retryCount,
      timestamp: new Date().toISOString()
    });

    // Call custom error callback if provided
    if (onErrorCallback) {
      try {
        onErrorCallback(error, errorInfo);
      } catch (callbackError) {
        console.error('[COMPONENT_ERROR_BOUNDARY] Error callback failed:', callbackError);
      }
    }

    // Disable auto-retry after max attempts
    if (retryCount >= maxRetries) {
      showRetry = false;
    }
  };

  const retry = () => {
    hasError = false;
    error = null;
    errorInfo = null;
  };

  // Note: In Svelte 4, onError is handled differently than in some other frameworks
  // We'll use global error handlers instead

  // Global error event listener for unhandled errors
  onMount(() => {
    const handleGlobalError = (event) => {
      if (event.error && event.error instanceof Error) {
        handleError(event.error, {
          type: 'global',
          filename: event.filename,
          lineno: event.lineno,
          colno: event.colno
        });
      }
    };

    const handleUnhandledRejection = (event) => {
      handleError(new Error(event.reason), {
        type: 'unhandled_promise',
        promise: event.promise
      });
    };

    window.addEventListener('error', handleGlobalError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleGlobalError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  });

  // Reset error state when children change
  $: if (hasError && $$slots.default) {
    // Don't reset if we've exceeded max retries
    if (retryCount < maxRetries) {
      retry();
    }
  }
</script>

{#if hasError}
  <div class="error-boundary-fallback" class:critical={retryCount >= 2}>
    <div class="error-content">
      <div class="error-icon">⚠️</div>
      <h3 class="error-title">{errorMessage}</h3>

      {#if retryCount > 1}
        <p class="error-retry-info">
          Retry attempt {retryCount} of {maxRetries}
        </p>
      {/if}

      {#if showRetry && retryCount < maxRetries}
        <button class="retry-button" on:click={retry}>
          Try Again
        </button>
      {/if}

      {#if fallbackComponent}
        <div class="fallback-component">
          <svelte:component this={fallbackComponent} />
        </div>
      {/if}

      {#if error && import.meta.env.DEV}
        <details class="error-details">
          <summary>Error Details (Development)</summary>
          <pre class="error-stack">{error.stack}</pre>
        </details>
      {/if}
    </div>
  </div>
{:else}
  <slot />
{/if}

<style>
  .error-boundary-fallback {
    display: flex;
    align-items: center;
    justify-content: center;
    min-height: 200px;
    padding: 20px;
    background: rgba(239, 68, 68, 0.1);
    border: 2px dashed rgba(239, 68, 68, 0.3);
    border-radius: 8px;
    margin: 10px;
  }

  .error-boundary-fallback.critical {
    background: rgba(239, 68, 68, 0.2);
    border-color: rgba(239, 68, 68, 0.5);
  }

  .error-content {
    text-align: center;
    color: #ef4444;
    max-width: 400px;
  }

  .error-icon {
    font-size: 48px;
    margin-bottom: 16px;
  }

  .error-title {
    font-size: 18px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: #dc2626;
  }

  .error-retry-info {
    font-size: 14px;
    color: #7f1d1d;
    margin: 8px 0;
  }

  .retry-button {
    background: #dc2626;
    color: white;
    border: none;
    padding: 8px 16px;
    border-radius: 6px;
    cursor: pointer;
    font-size: 14px;
    font-weight: 500;
    margin: 12px 0;
    transition: background-color 0.2s;
  }

  .retry-button:hover {
    background: #b91c1c;
  }

  .fallback-component {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid rgba(239, 68, 68, 0.3);
  }

  .error-details {
    margin-top: 16px;
    text-align: left;
  }

  .error-details summary {
    cursor: pointer;
    font-size: 12px;
    color: #7f1d1d;
    margin-bottom: 8px;
  }

  .error-stack {
    background: #1f2937;
    color: #f3f4f6;
    padding: 8px;
    border-radius: 4px;
    font-size: 11px;
    overflow-x: auto;
    white-space: pre-wrap;
    max-height: 200px;
    overflow-y: auto;
  }
</style>