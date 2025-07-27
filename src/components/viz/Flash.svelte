<script>
  import { onMount } from 'svelte';

  export let config;
  export let flashEffect;

  let showFlash = false;
  let flashStyle = '';

  $: if (flashEffect && config) {
    if (config.showFlash && flashEffect.magnitude >= config.flashThreshold) {
      showFlash = true;
      flashStyle = `background-color: rgba(255, 255, 255, ${config.flashIntensity});`;
      setTimeout(() => (showFlash = false), 100);
    }
  }
</script>

{#if showFlash}
  <div class="flash-overlay" style={flashStyle}></div>
{/if}

<style>
  .flash-overlay {
    position: absolute;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    pointer-events: none;
  }
</style>
