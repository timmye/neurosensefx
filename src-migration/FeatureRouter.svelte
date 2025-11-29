<script>
  import FeatureFlags from './FeatureFlags.js';
  import { onMount } from 'svelte';

  // Old implementation imports
  import OldWorkspace from '../src/components/Workspace.svelte';
  import OldFloatingDisplay from '../src/components/FloatingDisplay.svelte';

  // New implementation imports
  import NewWorkspace from '../src-simple/components/Workspace.svelte';
  import NewFloatingDisplay from '../src-simple/components/FloatingDisplay.svelte';

  // Dynamic component selection
  $: WorkspaceComponent = FeatureFlags.useNewWorkspace ? NewWorkspace : OldWorkspace;
  $: DisplayComponent = FeatureFlags.useNewDisplays ? NewFloatingDisplay : OldFloatingDisplay;

  // Display data from appropriate store
  let displays = [];

  onMount(() => {
    // Initialize displays based on active implementation
    const unsubscribe = FeatureFlags.subscribe(() => {
      // Re-render when flags change
    });
    return unsubscribe;
  });

  function handleFlagChange(flag, value) {
    FeatureFlags.update(flags => ({ ...flags, [flag]: value }));
  }
</script>

<!-- Dynamic workspace component -->
<svelte:component this={WorkspaceComponent}>
  {#each displays as display}
    <svelte:component this={DisplayComponent} {display} />
  {/each}
</svelte:component>

<!-- Debug panel for flag toggling -->
<div class="feature-flags-debug">
  <h4>Feature Flags</h4>
  <label>
    <input
      type="checkbox"
      checked={$FeatureFlags.useNewWorkspace}
      on:change={(e) => handleFlagChange('useNewWorkspace', e.target.checked)}
    />
    New Workspace
  </label>
  <label>
    <input
      type="checkbox"
      checked={$FeatureFlags.useNewDisplays}
      on:change={(e) => handleFlagChange('useNewDisplays', e.target.checked)}
    />
    New Displays
  </label>
</div>

<style>
  .feature-flags-debug {
    position: fixed;
    top: 10px;
    right: 10px;
    background: rgba(0, 0, 0, 0.8);
    color: white;
    padding: 10px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10000;
  }

  .feature-flags-debug label {
    display: block;
    margin: 5px 0;
  }

  .feature-flags-debug h4 {
    margin: 0 0 8px 0;
  }
</style>