<script>
  import FeatureFlags from './FeatureFlags.js';
  import { onMount } from 'svelte';
  import OldWorkspace from '../src/components/Workspace.svelte';
  import NewWorkspace from '../src-simple/components/Workspace.svelte';

  let flags = FeatureFlags.load();

  $: WorkspaceComponent = flags.useSimpleWorkspace ? NewWorkspace : OldWorkspace;

  onMount(() => {
    const unsubscribe = FeatureFlags.subscribe(newFlags => {
      flags = newFlags;
    });
    return unsubscribe;
  });

  function handleFlagChange(flag, value) {
    FeatureFlags.updateFlag(flag, value);
  }
</script>

<svelte:component this={WorkspaceComponent} />

<div class="debug">
  <h4>Feature Flags</h4>
  <label>
    <input
      type="checkbox"
      checked={flags.useSimpleWorkspace}
      on:change={(e) => handleFlagChange('useSimpleWorkspace', e.target.checked)}
    />
    Simple Workspace
  </label>
  <label>
    <input
      type="checkbox"
      checked={flags.useSimpleDisplays}
      on:change={(e) => handleFlagChange('useSimpleDisplays', e.target.checked)}
    />
    Simple Displays
  </label>
  <label>
    <input
      type="checkbox"
      checked={flags.useSimpleVisualizations}
      on:change={(e) => handleFlagChange('useSimpleVisualizations', e.target.checked)}
    />
    Simple Visualizations
  </label>
</div>

<style>
  .debug{position:fixed;top:10px;right:10px;background:rgba(0,0,0,.8);color:#fff;padding:10px;border-radius:4px;font-size:12px;z-index:10000}
  .debug label{display:block;margin:5px 0}
  .debug h4{margin:0 0 8px}
</style>