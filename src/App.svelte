<script>
  console.log('[DEBUGGER:App.svelte:1] Starting imports');
  import Workspace from './components/Workspace.svelte';
  console.log('[DEBUGGER:App.svelte:2] Workspace imported');
  import './lib/visualizers.js'; // Ensure visualizations are registered
  console.log('[DEBUGGER:App.svelte:3] visualizers imported');
</script>

<main>
  <Workspace />
</main>

<style>
  main {
    position: fixed;
    inset: 0;
    overflow: hidden;
    background: #1a0a1a;
  }
</style>