You are configuring NeuroSense FX visualization components and display parameters. The system uses a unified configuration architecture with schema-driven parameters and inheritance patterns.

## Configuration Architecture

### Global Configuration System
- **Configuration Inheritance**: New displays inherit current runtime settings
- **Schema Validation**: All parameters validated against `visualizationSchema.js`
- **Runtime Persistence**: Complete workspace configuration saved/restored
- **Real-time Updates**: Configuration changes apply immediately to all displays

### Component Configuration Groups

#### Market Profile Configuration
```javascript
marketProfile: {
  mode: 'traditional',           // Rendering mode
  deltaMode: 'none',            // Delta analysis overlay
  colorScheme: 'green-red'      // Visual color palette
}
```

**Available Modes:**
- `traditional` - Classic TPO-based market profile
- `delta` - Delta analysis with buy/sell pressure
- `volume` - Volume-based profile visualization

#### Volatility Orb Configuration
```javascript
volatilityOrb: {
  mode: 'gradient',             // Visualization style
  colorMode: 'volatility',      // Color mapping strategy
  updateSpeed: 300,             // Animation update interval (ms)
  radius: 15                    // Orb size in pixels
}
```

**Available Color Modes:**
- `volatility` - Color based on volatility levels
- `momentum` - Color based on price momentum
- `custom` - User-defined color scheme

#### Day Range Meter Configuration
```javascript
dayRangeMeter: {
  adrLookbackDays: 14,          // ADR calculation period
  showPercentage: true,         // Show price as % of daily range
  alertThreshold: 0.8           // Proximity alert threshold
}
```

#### Price Display Configuration
```javascript
priceDisplay: {
  fontSize: 14,                 // Text size in pixels
  fontFamily: 'JetBrains Mono', // Monospace for numerical data
  showGlow: true,               // Glow effect for current price
  digitGrouping: true           // Format price with separators
}
```

## Configuration Commands

### Global Configuration Management
- **`/config-global [component.parameter] [value]`** - Update global configuration
  - `config-global marketProfile.mode delta` - Change market profile mode
  - `config-global volatilityOrb.colorMode momentum` - Change orb coloring
  - `config-global priceDisplay.fontSize 16` - Increase text size

### Display-Specific Configuration
- **`/config-display [display-id] [parameter] [value]`** - Configure specific display
- **`/config-inherit`** - Make new displays inherit current runtime settings

### Configuration Persistence
- **`/config-save [name]`** - Save current configuration as preset
- **`/config-load [name]`** - Load saved configuration preset
- **`/config-reset`** - Reset to factory defaults
- **`/config-export`** - Export configuration to JSON file

## Configuration Inheritance Patterns

### New Display Creation
When creating new displays (Ctrl+N or from Symbol Palette):
1. System automatically inherits current runtime settings
2. Individual display settings can override global defaults
3. Configuration validation ensures parameter compatibility

### Workspace Restoration
Workspace restoration includes:
- Complete runtime configuration (not factory defaults)
- Display-specific overrides and customizations
- User-defined presets and custom color schemes
- Layout and positioning information

## Validation & Error Handling

### Schema Validation
All configuration changes are validated against:
- Parameter type checking (string, number, boolean, select)
- Range validation for numeric parameters
- Option validation for select parameters
- Cross-parameter compatibility checks

### Error Recovery
- Invalid configurations are rejected with detailed error messages
- Previous valid configuration is maintained on validation failure
- Automatic rollback on configuration errors
- User-friendly error descriptions with suggested fixes

## Advanced Configuration

### Custom Color Schemes
```javascript
// Custom color configuration
colorSchemes: {
  customTrading: {
    bullish: '#00ff88',
    bearish: '#ff3366',
    neutral: '#ffaa00',
    background: '#0a0a0a'
  }
}
```

### Performance Optimization Settings
```javascript
performance: {
  maxDisplays: 20,              // Maximum concurrent displays
  renderFPS: 60,                // Target frame rate
  enableDirtyRectangles: true,  // Optimization for large display counts
  memoryBudgetMB: 50            // Memory budget per display
}
```

### Market Data Specific Settings
```javascript
marketData: {
  updateInterval: 100,          // Market data update frequency (ms)
  validationEnabled: true,      // Strict data validation
  auditTrail: true,             // Log all data updates
  reconnectAttempts: 5          // WebSocket reconnection attempts
}
```

## Troubleshooting Configuration

### Common Issues
1. **New displays not inheriting settings**: Check `/config-inherit` status
2. **Configuration not saving**: Ensure workspace persistence is enabled
3. **Invalid parameter values**: Review schema validation error messages
4. **Performance issues**: Adjust performance optimization settings

### Diagnostic Commands
- **`/config-validate`** - Validate current configuration
- **`/config-diff`** - Show differences from defaults
- **`/config-stats`** - Display configuration statistics
- **`/config-debug`** - Show detailed configuration debugging info

## Examples

**Change Market Profile Mode:**
```
/config-global marketProfile.mode delta
```

**Create Custom Display Configuration:**
```
/config-display display-123 volatilityOrb.radius 20
/config-display display-123 priceDisplay.showGlow false
```

**Save and Share Configuration:**
```
/config-save my-trading-setup
/config-export my-trading-setup.json
```

The configuration system ensures consistent behavior across all displays while allowing for individual customization when needed.