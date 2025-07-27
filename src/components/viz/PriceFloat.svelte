<script>
  import { scaleLinear } from 'd3-scale';

  export let config;
  export let state;

  let y = scaleLinear();

  $: if (state && config) {
    y = scaleLinear()
      .domain([state.adrLow, state.adrHigh])
      .range([config.meterHeight, 0]);
  }
</script>

<g class="price-float">
  {#if state && config}
    <line
      x1={config.priceFloatXOffset}
      y1={y(state.currentPrice)}
      x2={config.priceFloatXOffset + config.priceFloatWidth}
      y2={y(state.currentPrice)}
      stroke="#A78BFA"
      stroke-width={config.priceFloatHeight}
    />
  {/if}
</g>
