<script>
  import { createEventDispatcher } from 'svelte';
  import { volatilityGroup } from '../utils/parameterGroups.js';
  import ToggleControl from '../controls/ToggleControl.svelte';
  import RangeControl from '../controls/RangeControl.svelte';
  import ColorControl from '../controls/ColorControl.svelte';
  import SelectControl from '../controls/SelectControl.svelte';
  
  export let config = {};
  export let onParameterChange = () => {};
  
  const dispatch = createEventDispatcher();
  
  // Group controls by type for better organization
  const controlSections = [
    {
      title: 'Volatility Orb',
      controls: [
        'volatilityColorMode',
        'volatilityOrbBaseWidth',
        'volatilityOrbInvertBrightness',
        'volatilitySizeMultiplier'
      ]
    },
    {
      title: 'Flash Settings',
      controls: [
        'flashThreshold',
        'flashIntensity',
        'showFlash'
      ]
    },
    {
      title: 'Orb Flash',
      controls: [
        'orbFlashThreshold',
        'orbFlashIntensity',
        'showOrbFlash'
      ]
    },
    {
      title: 'ADR Settings',
      controls: [
        'adrRange',
        'adrLookbackDays',
        'adrProximityThreshold'
      ]
    },
    {
      title: 'ADR Pulse',
      controls: [
        'adrPulseColor',
        'adrPulseWidthRatio',
        'adrPulseHeight'
      ]
    },
    {
      title: 'ADR Range Lines',
      controls: [
        'adrRangeIndicatorLinesColor',
        'adrRangeIndicatorLinesThickness',
        'showAdrRangeIndicatorLines'
      ]
    }
  ];
  
  function handleChange(parameter, value) {
    onParameterChange(parameter, value);
  }
  
  function renderControl(controlKey) {
    const controlType = volatilityGroup.controlTypes[controlKey];
    
    switch (controlType) {
      case 'toggle':
        return ToggleControl;
      case 'range':
        return RangeControl;
      case 'color':
        return ColorControl;
      case 'select':
        return SelectControl;
      default:
        return null;
    }
  }
  
  function getControlProps(controlKey) {
    return {
      parameter: controlKey,
      label: volatilityGroup.labels[controlKey],
      value: config[controlKey],
      onChange: handleChange,
      options: volatilityGroup.controlOptions?.[controlKey],
      min: volatilityGroup.ranges?.[controlKey]?.min,
      max: volatilityGroup.ranges?.[controlKey]?.max,
      step: volatilityGroup.ranges?.[controlKey]?.step
    };
  }
</script>

<div class="tab-content">
  <div class="tab-header">
    <h3>Volatility</h3>
    <p class="tab-description">Volatility orb and flash settings</p>
  </div>
  
  {#each controlSections as section}
    <div class="control-section">
      <h4 class="section-title">{section.title}</h4>
      <div class="controls-grid">
        {#each section.controls as controlKey}
          <div class="control-item">
            <svelte:component 
              this={renderControl(controlKey)} 
              {...getControlProps(controlKey)}
            />
          </div>
        {/each}
      </div>
    </div>
  {/each}
  
  <div class="volatility-footer">
    <p class="tip">💡 Tip: Adjust flash thresholds to control sensitivity to price movements</p>
  </div>
</div>

<style>
  .tab-content {
    padding: 16px;
  }
  
  .tab-header {
    margin-bottom: 20px;
  }
  
  .tab-header h3 {
    margin: 0 0 4px 0;
    color: #d1d5db;
    font-size: 16px;
    font-weight: 600;
  }
  
  .tab-description {
    margin: 0;
    color: #9ca3af;
    font-size: 12px;
  }
  
  .control-section {
    margin-bottom: 24px;
  }
  
  .section-title {
    margin: 0 0 12px 0;
    color: #e5e7eb;
    font-size: 14px;
    font-weight: 500;
    padding-bottom: 6px;
    border-bottom: 1px solid #4b5563;
  }
  
  .controls-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 12px;
  }
  
  .control-item {
    background: #374151;
    border-radius: 6px;
    padding: 12px;
    transition: background-color 0.2s ease;
  }
  
  .control-item:hover {
    background: #4b5563;
  }
  
  .volatility-footer {
    margin-top: 16px;
    padding-top: 16px;
    border-top: 1px solid #4b5563;
  }
  
  .tip {
    margin: 0;
    color: #6b7280;
    font-size: 11px;
    font-style: italic;
    text-align: center;
  }
</style>