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

<g class="day-range-meter">
  {#if state && config}
    <line
      x1={config.centralAxisXPosition}
      y1="0"
      x2={config.centralAxisXPosition}
      y2={config.meterHeight}
      stroke="#4B5563"
      stroke-width={config.centralMeterFixedThickness}
    />
  {/if}
</g>
