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

  function formatPrice(price) {
    const parts = price.toFixed(5).split('.');
    return {
      bigFigure: parts[0] + '.' + parts[1].slice(0, 2),
      pips: parts[1].slice(2, 4),
      pipette: parts[1].slice(4),
    };
  }

  $: formattedPrice = state ? formatPrice(state.currentPrice) : {};
</script>

<g class="price-display" transform="translate({config.priceHorizontalOffset}, {y(state.currentPrice)})">
  {#if state && config}
    <text y="0" dominant-baseline="middle">
      <tspan font-size={config.priceFontSize * config.bigFigureFontSizeRatio} fill="#E5E7EB">{formattedPrice.bigFigure}</tspan>
      <tspan font-size={config.priceFontSize * config.pipFontSizeRatio} fill="#E5E7EB">{formattedPrice.pips}</tspan>
      {#if config.showPipetteDigit}
        <tspan font-size={config.priceFontSize * config.pipetteFontSizeRatio} fill="#E5E7EB">{formattedPrice.pipette}</tspan>
      {/if}
    </text>
  {/if}
</g>
