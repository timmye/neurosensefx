<script>
  import { onMount } from 'svelte';
  import { get } from 'svelte/store';
  import { symbolStore } from '../../data/symbolStore.js';
  import DayRangeMeter from './DayRangeMeter.svelte';
  import PriceFloat from './PriceFloat.svelte';
  import PriceDisplay from './PriceDisplay.svelte';
  import VolatilityOrb from './VolatilityOrb.svelte';
  import MarketProfile from './MarketProfile.svelte';
  import Flash from './Flash.svelte';

  export let symbol;
  export let config;
  export let state;
  export let marketProfile;
  export let flashEffect;

  let width = 220;
  let height = 120;

  $: if (config) {
    width = config.visualizationsContentWidth;
    height = config.meterHeight;
  }
</script>

<div class="viz-container" style="--width: {width}px; --height: {height}px;">
  <svg {width} {height}>
    <g>
      <DayRangeMeter {config} {state} />
      <PriceFloat {config} {state} />
      <PriceDisplay {config} {state} />
      <VolatilityOrb {config} {state} />
      <MarketProfile {config} {state} {marketProfile} />
    </g>
  </svg>
  <Flash {config} {flashEffect} />
</div>

<style>
  .viz-container {
    position: relative;
    width: var(--width);
    height: var(--height);
  }
  svg {
    background-color: #111827;
  }
</style>
