<script>
  import { createEventDispatcher, onMount } from 'svelte';
  import { Button, Input, Slider, Toggle, Select, Badge, Icon, Label } from '../atoms/index.js';
  import { Accordion, FormField } from '../organisms/index.js';
  
  export let indicator = null;
  export let settings = {};
  export let presets = [];
  export let showPresets = true;
  export let showAdvanced = false;
  export let compact = false;
  
  const dispatch = createEventDispatcher();
  
  // Indicator type configurations
  const indicatorConfigs = {
    priceFloat: {
      name: 'Price Float',
      description: 'Horizontal line showing current price',
      icon: 'minus',
      category: 'price',
      defaultSettings: {
        width: 100,
        height: 4,
        color: '#a78bfa',
        glow: true,
        xOffset: 0,
        yOffset: 0,
        animation: 'smooth',
        showLabel: true,
        labelFormat: 'price'
      },
      settings: [
        {
          key: 'width',
          type: 'slider',
          label: 'Width',
          min: 20,
          max: 200,
          step: 5,
          unit: 'px'
        },
        {
          key: 'height',
          type: 'slider',
          label: 'Height',
          min: 1,
          max: 10,
          step: 1,
          unit: 'px'
        },
        {
          key: 'color',
          type: 'color',
          label: 'Color'
        },
        {
          key: 'glow',
          type: 'toggle',
          label: 'Glow Effect'
        },
        {
          key: 'showLabel',
          type: 'toggle',
          label: 'Show Price Label'
        },
        {
          key: 'labelFormat',
          type: 'select',
          label: 'Label Format',
          options: [
            { value: 'price', label: 'Price (1.2345)' },
            { value: 'pips', label: 'Pips (+45)' },
            { value: 'percent', label: 'Percent (+0.37%)' },
            { value: 'change', label: 'Change (+0.0045)' }
          ]
        }
      ]
    },
    marketProfile: {
      name: 'Market Profile',
      description: 'Price distribution over time',
      icon: 'bar-chart-2',
      category: 'volume',
      defaultSettings: {
        width: 1.0,
        opacity: 0.7,
        showOutline: true,
        colorScheme: 'default',
        timeframe: 'session',
        showValueArea: true,
        valueAreaPercentage: 70,
        showPoc: true,
        maxRows: 50
      },
      settings: [
        {
          key: 'width',
          type: 'slider',
          label: 'Width',
          min: 0.5,
          max: 2.0,
          step: 0.1,
          unit: 'x'
        },
        {
          key: 'opacity',
          type: 'slider',
          label: 'Opacity',
          min: 0.1,
          max: 1.0,
          step: 0.1
        },
        {
          key: 'showOutline',
          type: 'toggle',
          label: 'Show Outline'
        },
        {
          key: 'showValueArea',
          type: 'toggle',
          label: 'Show Value Area'
        },
        {
          key: 'valueAreaPercentage',
          type: 'slider',
          label: 'Value Area %',
          min: 50,
          max: 90,
          step: 5,
          unit: '%'
        },
        {
          key: 'timeframe',
          type: 'select',
          label: 'Timeframe',
          options: [
            { value: 'session', label: 'Session' },
            { value: 'day', label: 'Daily' },
            { value: 'week', label: 'Weekly' },
            { value: 'month', label: 'Monthly' }
          ]
        },
        {
          key: 'maxRows',
          type: 'slider',
          label: 'Max Rows',
          min: 20,
          max: 100,
          step: 5,
          unit: 'rows'
        }
      ]
    },
    volatilityOrb: {
      name: 'Volatility Orb',
      description: 'Circular volatility visualization',
      icon: 'circle',
      category: 'volatility',
      defaultSettings: {
        baseWidth: 200,
        colorMode: 'directional',
        showMetric: true,
        metric: 'atr',
        sensitivity: 1.0,
        smoothing: 0.8,
        showScale: true,
        animationSpeed: 'medium'
      },
      settings: [
        {
          key: 'baseWidth',
          type: 'slider',
          label: 'Base Width',
          min: 100,
          max: 400,
          step: 10,
          unit: 'px'
        },
        {
          key: 'colorMode',
          type: 'select',
          label: 'Color Mode',
          options: [
            { value: 'directional', label: 'Directional' },
            { value: 'volatility', label: 'Volatility' },
            { value: 'gradient', label: 'Gradient' },
            { value: 'solid', label: 'Solid' }
          ]
        },
        {
          key: 'showMetric',
          type: 'toggle',
          label: 'Show Metric'
        },
        {
          key: 'metric',
          type: 'select',
          label: 'Metric',
          options: [
            { value: 'atr', label: 'ATR' },
            { value: 'stddev', label: 'Standard Deviation' },
            { value: 'range', label: 'Range' },
            { value: 'volume', label: 'Volume' }
          ]
        },
        {
          key: 'sensitivity',
          type: 'slider',
          label: 'Sensitivity',
          min: 0.1,
          max: 2.0,
          step: 0.1,
          unit: 'x'
        },
        {
          key: 'smoothing',
          type: 'slider',
          label: 'Smoothing',
          min: 0.0,
          max: 1.0,
          step: 0.1
        },
        {
          key: 'showScale',
          type: 'toggle',
          label: 'Show Scale'
        },
        {
          key: 'animationSpeed',
          type: 'select',
          label: 'Animation Speed',
          options: [
            { value: 'slow', label: 'Slow' },
            { value: 'medium', label: 'Medium' },
            { value: 'fast', label: 'Fast' },
            { value: 'instant', label: 'Instant' }
          ]
        }
      ]
    },
    adrMeter: {
      name: 'ADR Meter',
      description: 'Average daily range indicator',
      icon: 'gauge',
      category: 'range',
      defaultSettings: {
        showPulse: true,
        threshold: 10,
        color: '#3b82f6',
        showPercentage: true,
        showTarget: true,
        targetPercentage: 80,
        alertThreshold: 90,
        orientation: 'vertical'
      },
      settings: [
        {
          key: 'showPulse',
          type: 'toggle',
          label: 'Show Pulse'
        },
        {
          key: 'threshold',
          type: 'slider',
          label: 'Threshold',
          min: 5,
          max: 50,
          step: 1,
          unit: 'pips'
        },
        {
          key: 'showPercentage',
          type: 'toggle',
          label: 'Show Percentage'
        },
        {
          key: 'showTarget',
          type: 'toggle',
          label: 'Show Target'
        },
        {
          key: 'targetPercentage',
          type: 'slider',
          label: 'Target %',
          min: 50,
          max: 100,
          step: 5,
          unit: '%'
        },
        {
          key: 'alertThreshold',
          type: 'slider',
          label: 'Alert Threshold',
          min: 70,
          max: 100,
          step: 5,
          unit: '%'
        },
        {
          key: 'orientation',
          type: 'select',
          label: 'Orientation',
          options: [
            { value: 'vertical', label: 'Vertical' },
            { value: 'horizontal', label: 'Horizontal' }
          ]
        }
      ]
    },
    priceDisplay: {
      name: 'Price Display',
      description: 'Numeric price display',
      icon: 'type',
      category: 'price',
      defaultSettings: {
        fontSize: 16,
        showPipettes: true,
        fontFamily: 'mono',
        showChange: true,
        showPercentage: true,
        colorMode: 'directional',
        decimals: 5,
        thousandsSeparator: true
      },
      settings: [
        {
          key: 'fontSize',
          type: 'slider',
          label: 'Font Size',
          min: 10,
          max: 32,
          step: 1,
          unit: 'px'
        },
        {
          key: 'fontFamily',
          type: 'select',
          label: 'Font Family',
          options: [
            { value: 'mono', label: 'Monospace' },
            { value: 'sans', label: 'Sans-serif' },
            { value: 'serif', label: 'Serif' }
          ]
        },
        {
          key: 'showPipettes',
          type: 'toggle',
          label: 'Show Pipettes'
        },
        {
          key: 'decimals',
          type: 'slider',
          label: 'Decimal Places',
          min: 2,
          max: 8,
          step: 1,
          unit: 'digits'
        },
        {
          key: 'showChange',
          type: 'toggle',
          label: 'Show Change'
        },
        {
          key: 'showPercentage',
          type: 'toggle',
          label: 'Show Percentage'
        },
        {
          key: 'colorMode',
          type: 'select',
          label: 'Color Mode',
          options: [
            { value: 'directional', label: 'Directional' },
            { value: 'static', label: 'Static' },
            { value: 'gradient', label: 'Gradient' }
          ]
        },
        {
          key: 'thousandsSeparator',
          type: 'toggle',
          label: 'Thousands Separator'
        }
      ]
    }
  };
  
  // Default presets
  const defaultPresets = [
    {
      id: 'minimal',
      name: 'Minimal',
      description: 'Clean and simple appearance',
      settings: {
        priceFloat: { glow: false, showLabel: false, height: 2 },
        marketProfile: { showOutline: false, opacity: 0.5 },
        volatilityOrb: { showScale: false, animationSpeed: 'instant' },
        adrMeter: { showPulse: false, showPercentage: false },
        priceDisplay: { showPipettes: false, showChange: false, showPercentage: false }
      }
    },
    {
      id: 'detailed',
      name: 'Detailed',
      description: 'Maximum information display',
      settings: {
        priceFloat: { glow: true, showLabel: true, height: 6 },
        marketProfile: { showOutline: true, showValueArea: true, opacity: 0.8 },
        volatilityOrb: { showScale: true, showMetric: true, animationSpeed: 'medium' },
        adrMeter: { showPulse: true, showPercentage: true, showTarget: true },
        priceDisplay: { showPipettes: true, showChange: true, showPercentage: true, decimals: 5 }
      }
    },
    {
      id: 'performance',
      name: 'Performance',
      description: 'Optimized for speed',
      settings: {
        priceFloat: { glow: false, animation: 'none', height: 3 },
        marketProfile: { maxRows: 30, opacity: 0.6 },
        volatilityOrb: { animationSpeed: 'fast', smoothing: 0.5 },
        adrMeter: { showPulse: false, showPercentage: false },
        priceDisplay: { fontFamily: 'mono', showPipettes: false }
      }
    }
  ];
  
  $: availablePresets = presets.length > 0 ? presets : defaultPresets;
  $: indicatorConfig = indicator ? indicatorConfigs[indicator.type] : null;
  $: currentSettings = indicator ? { ...indicatorConfig?.defaultSettings, ...settings } : {};
  $: hasCustomSettings = indicator && JSON.stringify(currentSettings) !== JSON.stringify(indicatorConfig?.defaultSettings || {});
  
  function handleSettingChange(key, value) {
    if (!indicator) return;
    
    settings[key] = value;
    settings = { ...settings }; // Trigger reactivity
    
    dispatch('settingChange', { indicatorId: indicator.id, key, value });
    dispatch('settingsChange', { indicatorId: indicator.id, settings });
  }
  
  function applyPreset(presetId) {
    if (!indicator) return;
    
    const preset = availablePresets.find(p => p.id === presetId);
    if (!preset || !preset.settings[indicator.type]) return;
    
    const presetSettings = preset.settings[indicator.type];
    settings = { ...currentSettings, ...presetSettings };
    
    dispatch('presetApplied', { indicatorId: indicator.id, presetId, settings });
    dispatch('settingsChange', { indicatorId: indicator.id, settings });
  }
  
  function resetToDefaults() {
    if (!indicator || !indicatorConfig) return;
    
    settings = { ...indicatorConfig.defaultSettings };
    
    dispatch('settingsReset', { indicatorId: indicator.id, settings });
    dispatch('settingsChange', { indicatorId: indicator.id, settings });
  }
  
  function exportSettings() {
    if (!indicator) return;
    
    const exportData = {
      indicatorType: indicator.type,
      indicatorId: indicator.id,
      settings: currentSettings,
      timestamp: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(exportData, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    
    const exportFileDefaultName = `${indicator.type}-settings.json`;
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    dispatch('settingsExported', { indicatorId: indicator.id, settings: currentSettings });
  }
  
  function importSettings(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const importData = JSON.parse(e.target.result);
        
        // Validate import data
        if (!importData.settings || !importData.indicatorType) {
          throw new Error('Invalid settings format');
        }
        
        if (importData.indicatorType !== indicator.type) {
          throw new Error(`Settings incompatible with ${indicator.type} indicator`);
        }
        
        settings = { ...currentSettings, ...importData.settings };
        
        dispatch('settingsImported', { indicatorId: indicator.id, settings });
        dispatch('settingsChange', { indicatorId: indicator.id, settings });
      } catch (error) {
        console.error('Failed to import settings:', error);
        dispatch('importError', { error: error.message });
      }
    };
    
    reader.readAsText(file);
  }
  
  function renderSettingField(setting) {
    const { key, type, label, ...props } = setting;
    const value = currentSettings[key];
    
    switch (type) {
      case 'slider':
        return `
          <FormField>
            <Label for="${key}">${label}</Label>
            <Slider
              id="${key}"
              bind:value={currentSettings.${key}}
              min={${props.min}}
              max={${props.max}}
              step={${props.step}}
              on:change={(v) => handleSettingChange('${key}', v)}
            />
            <span class="setting-unit">${props.unit || ''}</span>
          </FormField>
        `;
      
      case 'toggle':
        return `
          <FormField>
            <Toggle
              bind:checked={currentSettings.${key}}
              on:change={(v) => handleSettingChange('${key}', v)}
            />
            <Label for="${key}">${label}</Label>
          </FormField>
        `;
      
      case 'select':
        return `
          <FormField>
            <Label for="${key}">${label}</Label>
            <Select
              id="${key}"
              bind:value={currentSettings.${key}}
              options={${JSON.stringify(props.options)}}
              on:change={(v) => handleSettingChange('${key}', v)}
            />
          </FormField>
        `;
      
      case 'color':
        return `
          <FormField>
            <Label for="${key}">${label}</Label>
            <div class="color-input-group">
              <input
                type="color"
                id="${key}"
                bind:value={currentSettings.${key}}
                on:change={(e) => handleSettingChange('${key}', e.target.value)}
              />
              <Input
                type="text"
                bind:value={currentSettings.${key}}
                on:change={(v) => handleSettingChange('${key}', v)}
                placeholder="#000000"
              />
            </div>
          </FormField>
        `;
      
      default:
        return '';
    }
  }
</script>

{#if indicatorConfig}
  <div class="indicator-settings" class:compact>
    <!-- Header -->
    <div class="settings-header">
      <div class="indicator-info">
        <div class="indicator-title">
          <Icon name={indicatorConfig.icon} size="sm" />
          {indicatorConfig.name}
        </div>
        <div class="indicator-description">{indicatorConfig.description}</div>
        
        <div class="indicator-meta">
          <Badge variant="outline" size="xs">{indicatorConfig.category}</Badge>
          {hasCustomSettings && (
            <Badge variant="primary" size="xs">Customized</Badge>
          )}
        </div>
      </div>
      
      <div class="header-actions">
        <Button
          variant="ghost"
          size="sm"
          on:click={exportSettings}
          title="Export settings"
        >
          <Icon name="download" size="xs" />
        </Button>
        
        <Button
          variant="ghost"
          size="sm"
          on:click={() => document.getElementById('settings-import').click()}
          title="Import settings"
        >
          <Icon name="upload" size="xs" />
        </Button>
        
        <input
          id="settings-import"
          type="file"
          accept=".json"
          style="display: none"
          on:change={importSettings}
        />
        
        <Button
          variant="outline"
          size="sm"
          on:click={resetToDefaults}
          disabled={!hasCustomSettings}
        >
          <Icon name="refresh-cw" size="xs" />
          Reset
        </Button>
      </div>
    </div>
    
    <!-- Presets -->
    {#if showPresets && availablePresets.length > 0}
      <div class="presets-section">
        <h4 class="section-title">Presets</h4>
        <div class="presets-grid">
          {#each availablePresets as preset}
            <Button
              variant="outline"
              size="sm"
              on:click={() => applyPreset(preset.id)}
              class="preset-button"
              title={preset.description}
            >
              {preset.name}
            </Button>
          {/each}
        </div>
      </div>
    {/if}
    
    <!-- Settings -->
    <div class="settings-section">
      <Accordion
        items={[
          {
            id: 'basic',
            title: 'Basic Settings',
            icon: 'settings',
            defaultOpen: true
          },
          {
            id: 'advanced',
            title: 'Advanced Settings',
            icon: 'sliders',
            defaultOpen: showAdvanced
          }
        ]}
      >
        <div slot="basic" class="settings-group">
          {#each indicatorConfig.settings.filter(s => !s.advanced) as setting}
            <FormField>
              <Label for={setting.key}>{setting.label}</Label>
              
              {#if setting.type === 'slider'}
                <div class="slider-group">
                  <Slider
                    id={setting.key}
                    bind:value={currentSettings[setting.key]}
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    on:change={(v) => handleSettingChange(setting.key, v)}
                  />
                  <span class="setting-unit">{setting.unit || ''}</span>
                </div>
              {:else if setting.type === 'toggle'}
                <Toggle
                  bind:checked={currentSettings[setting.key]}
                  on:change={(v) => handleSettingChange(setting.key, v)}
                />
              {:else if setting.type === 'select'}
                <Select
                  id={setting.key}
                  bind:value={currentSettings[setting.key]}
                  options={setting.options}
                  on:change={(v) => handleSettingChange(setting.key, v)}
                />
              {:else if setting.type === 'color'}
                <div class="color-input-group">
                  <input
                    type="color"
                    id={setting.key}
                    bind:value={currentSettings[setting.key]}
                    on:change={(e) => handleSettingChange(setting.key, e.target.value)}
                  />
                  <Input
                    type="text"
                    bind:value={currentSettings[setting.key]}
                    on:change={(v) => handleSettingChange(setting.key, v)}
                    placeholder="#000000"
                  />
                </div>
              {/if}
            </FormField>
          {/each}
        </div>
        
        <div slot="advanced" class="settings-group">
          {#each indicatorConfig.settings.filter(s => s.advanced) as setting}
            <FormField>
              <Label for={setting.key}>{setting.label}</Label>
              
              {#if setting.type === 'slider'}
                <div class="slider-group">
                  <Slider
                    id={setting.key}
                    bind:value={currentSettings[setting.key]}
                    min={setting.min}
                    max={setting.max}
                    step={setting.step}
                    on:change={(v) => handleSettingChange(setting.key, v)}
                  />
                  <span class="setting-unit">{setting.unit || ''}</span>
                </div>
              {:else if setting.type === 'toggle'}
                <Toggle
                  bind:checked={currentSettings[setting.key]}
                  on:change={(v) => handleSettingChange(setting.key, v)}
                />
              {:else if setting.type === 'select'}
                <Select
                  id={setting.key}
                  bind:value={currentSettings[setting.key]}
                  options={setting.options}
                  on:change={(v) => handleSettingChange(setting.key, v)}
                />
              {:else if setting.type === 'color'}
                <div class="color-input-group">
                  <input
                    type="color"
                    id={setting.key}
                    bind:value={currentSettings[setting.key]}
                    on:change={(e) => handleSettingChange(setting.key, e.target.value)}
                  />
                  <Input
                    type="text"
                    bind:value={currentSettings[setting.key]}
                    on:change={(v) => handleSettingChange(setting.key, v)}
                    placeholder="#000000"
                  />
                </div>
              {/if}
            </FormField>
          {/each}
        </div>
      </Accordion>
    </div>
  </div>
{:else}
  <div class="no-indicator">
    <Icon name="settings" size="lg" variant="muted" />
    <h4>No Indicator Selected</h4>
    <p>Select an indicator to configure its settings.</p>
  </div>
{/if}

<style>
  .indicator-settings {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
  }
  
  .compact {
    gap: var(--space-3);
  }
  
  .settings-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: var(--space-3);
    padding-bottom: var(--space-3);
    border-bottom: 1px solid var(--border-subtle);
  }
  
  .indicator-info {
    flex: 1;
  }
  
  .indicator-title {
    display: flex;
    align-items: center;
    gap: var(--space-2);
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
    margin-bottom: var(--space-1);
  }
  
  .indicator-description {
    font-size: var(--font-size-sm);
    color: var(--text-secondary);
    margin-bottom: var(--space-2);
  }
  
  .indicator-meta {
    display: flex;
    gap: var(--space-2);
  }
  
  .header-actions {
    display: flex;
    gap: var(--space-1);
  }
  
  .presets-section {
    padding: var(--space-3);
    background: var(--bg-secondary);
    border-radius: var(--radius-md);
  }
  
  .section-title {
    margin: 0 0 var(--space-3) 0;
    font-size: var(--font-size-base);
    font-weight: var(--font-weight-semibold);
    color: var(--text-primary);
  }
  
  .presets-grid {
    display: flex;
    flex-wrap: wrap;
    gap: var(--space-2);
  }
  
  .preset-button {
    flex-shrink: 0;
  }
  
  .settings-section {
    flex: 1;
  }
  
  .settings-group {
    display: flex;
    flex-direction: column;
    gap: var(--space-4);
    padding: var(--space-3);
  }
  
  .slider-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .setting-unit {
    font-size: var(--font-size-xs);
    color: var(--text-secondary);
    min-width: 40px;
    text-align: right;
  }
  
  .color-input-group {
    display: flex;
    align-items: center;
    gap: var(--space-2);
  }
  
  .color-input-group input[type="color"] {
    width: 40px;
    height: 32px;
    border: 1px solid var(--border-default);
    border-radius: var(--radius-sm);
    cursor: pointer;
    background: transparent;
  }
  
  .color-input-group .input {
    flex: 1;
  }
  
  .no-indicator {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    padding: var(--space-8) var(--space-4);
    gap: var(--space-3);
    color: var(--text-tertiary);
  }
  
  .no-indicator h4 {
    margin: 0;
    font-size: var(--font-size-lg);
    font-weight: var(--font-weight-semibold);
    color: var(--text-secondary);
  }
  
  .no-indicator p {
    margin: 0;
    font-size: var(--font-size-base);
    color: var(--text-tertiary);
  }
  
  /* Responsive Design */
  @media (max-width: 768px) {
    .settings-header {
      flex-direction: column;
      gap: var(--space-2);
    }
    
    .header-actions {
      width: 100%;
      justify-content: flex-end;
    }
    
    .presets-grid {
      flex-direction: column;
    }
    
    .preset-button {
      width: 100%;
    }
  }
</style>
