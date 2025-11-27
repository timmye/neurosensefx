<script>
  import { onMount } from 'svelte';

  export let loader; // Function that returns Promise of component
  export let fallback = null; // Fallback component while loading
  export let errorComponent = null; // Component to show on error
  export let delay = 200; // Delay before showing fallback (ms)
  export let timeout = 10000; // Loading timeout (ms)

  let loadedComponent = null;
  let loading = false;
  let error = null;
  let showFallback = false;

  // Show fallback after delay to prevent flicker for fast loads
  let fallbackTimeout;

  onMount(async () => {
    loading = true;

    // Show fallback after delay
    fallbackTimeout = setTimeout(() => {
      if (loading) {
        showFallback = true;
      }
    }, delay);

    try {
      // Set up timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Component loading timed out after ${timeout}ms`));
        }, timeout);
      });

      // Load the component with timeout
      const componentPromise = loader();
      const component = await Promise.race([componentPromise, timeoutPromise]);

      loading = false;
      loadedComponent = component.default || component;
      clearTimeout(fallbackTimeout);
      showFallback = false;

    } catch (err) {
      loading = false;
      error = err;
      clearTimeout(fallbackTimeout);
      showFallback = false;
      console.error('[LAZY_COMPONENT] Failed to load component:', err);
    }
  });

  // Cleanup on destroy
  $: if ($$.destroyed && fallbackTimeout) {
    clearTimeout(fallbackTimeout);
  }
</script>

{#if loadedComponent}
  <svelte:component this={loadedComponent} {...$$restProps} />
{:else if error && errorComponent}
  <svelte:component this={errorComponent} {error} {...$$restProps} />
{:else if error}
  <div class="lazy-component-error">
    <p>Failed to load component</p>
    {#if __DEV__}
      <pre>{error.message}</pre>
    {/if}
  </div>
{:else if showFallback && fallback}
  <svelte:component this={fallback} {...$$restProps} />
{:else if showFallback}
  <div class="lazy-component-loading">
    <div class="loading-spinner"></div>
    <p>Loading...</p>
  </div>
{/if}

<style>
  .lazy-component-error {
    padding: 20px;
    text-align: center;
    color: #ef4444;
    background: #1f2937;
    border-radius: 8px;
    border: 1px solid #374151;
  }

  .lazy-component-loading {
    padding: 20px;
    text-align: center;
    color: #9ca3af;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 12px;
  }

  .loading-spinner {
    width: 24px;
    height: 24px;
    border: 2px solid #374151;
    border-top: 2px solid #3b82f6;
    border-radius: 50%;
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    0% { transform: rotate(0deg); }
    100% { transform: rotate(360deg); }
  }
</style>