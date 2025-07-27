<script>
  import { scaleLinear } from 'd3-scale';

  export let config;
  export let state;
  export let marketProfile;

  let y = scaleLinear();
  let x = scaleLinear();

  $: if (state && config) {
    y = scaleLinear()
      .domain([state.adrLow, state.adrHigh])
      .range([config.meterHeight, 0]);
  }

  $: if (marketProfile && config) {
    const maxVolume = Math.max(...marketProfile.levels.map(l => l.volume));
    x = scaleLinear()
      .domain([0, maxVolume])
      .range([0, config.visualizationsContentWidth / 2]);
  }
</script>

<g class="market-profile">
  {#if marketProfile && config && config.showMarketProfile}
    {#each marketProfile.levels as level}
      <rect
        x={config.centralAxisXPosition - x(level.sell)}
        y={y(level.price)}
        width={x(level.sell)}
        height="1"
        fill="#EF4444"
        opacity="0.5"
      />
      <rect
        x={config.centralAxisXPosition}
        y={y(level.price)}
        width={x(level.buy)}
        height="1"
        fill="#3B82F6"
        opacity="0.5"
      />
    {/each}
  {/if}
</g>
