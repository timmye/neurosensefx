<script>
  import Workspace from './components/Workspace.svelte';
  import './lib/visualizers.js'; // Ensure visualizations are registered
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