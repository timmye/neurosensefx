<script>
  export let config;
  export let state;
</script>

<g class="volatility-orb">
  {#if state && config && config.showVolatilityOrb}
    <circle
      cx={config.centralAxisXPosition}
      cy={config.meterHeight / 2}
      r={state.volatility * config.volatilityOrbBaseWidth}
      fill="#4F46E5"
      opacity="0.2"
    />
  {/if}
</g>
