# DESIGN_UNIFIED_CONTEXT_MENU_ARCHITECTURE

## Overview

The Unified Context Menu Architecture establishes a single, intelligent context menu system for NeuroSense FX that adapts dynamically to provide the most relevant controls "in context" for traders. This architecture unifies the sophisticated CanvasContextMenu functionality with the centralized floatingStore, eliminating architectural inconsistencies while preserving advanced trader-focused features.

## Design Philosophy

### Core Principles
1. **Context-Aware Intelligence**: Single menu that adapts content based on click target
2. **Unified State Management**: All interactions flow through centralized floatingStore
3. **Progressive Disclosure**: Most relevant options first, advanced controls accessible
4. **Architectural Consistency**: Follows established floating architecture patterns

### User Experience Benefits
- **Seamless Interaction**: One right-click rule across entire interface
- **Intelligent Context**: Menu shows exactly what's needed for current context
- **Trader Focus**: Advanced canvas controls preserved and enhanced
- **Consistent Behavior**: Predictable interactions across all elements

## Technical Architecture

### Context Detection System
```
Right-Click Target Analysis:
├── Canvas Area → Full 85+ parameter controls
├── Header Area → Display management (duplicate, close, bring to front)
├── Workspace Background → Workspace operations (add display, panel management)
├── Panel Area → Panel-specific controls
└── Icon Area → Icon management/status indicator and quick actions
```

### Enhanced Store Integration
```javascript
// Enhanced display structure in floatingStore
{
  id: 'display-123',
  symbol: 'EURUSD',
  position: { x: 100, y: 100 },
  config: {
    // Basic display config
    visualizationsContentWidth: 220,
    meterHeight: 120,
    flashIntensity: 0.3,
    
    // Integrated CanvasContextMenu parameters (85+ total)
    priceFloatWidth: 100,
    priceFloatHeight: 2,
    priceFloatXOffset: 0,
    priceFloatUseDirectionalColor: true,
    marketProfileView: 'separate',
    marketProfileUpColor: '#10b981',
    marketProfileDownColor: '#ef4444',
    volatilityColorMode: 'intensity',
    volatilityOrbBaseWidth: 150,
    flashThreshold: 1.0,
    flashIntensity: 0.3,
    // ... all parameters organized by groups
  },
  state: {
    ready: false,
    currentPrice: 0,
    projectedAdrHigh: 0,
    projectedAdrLow: 0,
    visualHigh: 0,
    visualLow: 0,
    volatility: 0
  }
}
```

### Unified Context Menu Structure
```
UnifiedContextMenu.svelte
├── Context Detection Engine
│   ├── Click target analysis
│   ├── Context type determination
│   └── Available options calculation
├── Dynamic Content Renderer
│   ├── Tabbed interface (for canvas context)
│   ├── Quick actions (for header/workspace context)
│   └── Progressive disclosure controls
├── Store Integration Layer
│   ├── Parameter update actions
│   ├── Display management actions
│   └── Workspace operation actions
└── Search & Navigation System
    ├── Cross-parameter search
    ├── Keyboard shortcuts
    └── Quick navigation
```

## State Management Enhancement

### Enhanced floatingStore.js Actions
```javascript
// Canvas configuration actions (NEW)
export const actions = {
  // Existing display actions (unchanged)
  addDisplay: (symbol, position) => { /* ... */ },
  removeDisplay: (id) => { /* ... */ },
  setActiveDisplay: (id) => { /* ... */ },
  
  // NEW: Canvas configuration management
  updateCanvasConfig: (displayId, parameter, value) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          config: {
            ...display.config,
            [parameter]: value
          }
        });
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  updateMultipleCanvasConfig: (displayId, configUpdates) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          config: {
            ...display.config,
            ...configUpdates
          }
        });
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  resetCanvasConfig: (displayId) => {
    floatingStore.update(store => {
      const newDisplays = new Map(store.displays);
      const display = newDisplays.get(displayId);
      if (display) {
        newDisplays.set(displayId, {
          ...display,
          config: { ...defaultConfig } // Reset to defaults
        });
      }
      return { ...store, displays: newDisplays };
    });
  },
  
  // Enhanced context menu management
  showUnifiedContextMenu: (x, y, context) => {
    floatingStore.update(store => ({
      ...store,
      contextMenu: {
        open: true,
        x,
        y,
        context // { type: 'canvas' | 'header' | 'workspace' | 'panel', targetId, targetType }
      }
    }));
  },
  
  hideContextMenu: () => {
    floatingStore.update(store => ({
      ...store,
      contextMenu: { open: false, x: 0, y: 0, context: null }
    }));
  }
};
```

### Context Types and Available Options
```javascript
const CONTEXT_CONFIGURATIONS = {
  canvas: {
    title: 'Canvas Controls',
    showTabs: true,
    tabs: ['quickActions', 'priceDisplay', 'marketProfile', 'volatility', 'layoutSizing', 'advanced'],
    showSearch: true,
    showReset: true
  },
  
  header: {
    title: 'Display Options',
    showTabs: false,
    quickActions: ['bringToFront', 'duplicate', 'close'],
    showSearch: false,
    showReset: false
  },
  
  workspace: {
    title: 'Workspace',
    showTabs: false,
    quickActions: ['addDisplay', 'showSymbolPalette', 'workspaceSettings'],
    showSearch: false,
    showReset: false
  },
  
  panel: {
    title: 'Panel Options',
    showTabs: false,
    quickActions: ['bringToFront', 'close', 'reset'],
    showSearch: false,
    showReset: true
  }
};
```

## Component Specifications

### UnifiedContextMenu.svelte
**Purpose**: Single, intelligent context menu for all right-click interactions

**Props**:
- None (uses store for all state)

**Size**: Dynamic based on context
- Canvas: 500×700px (tabbed interface)
- Header/Panel/Workspace: 200×150px (quick actions)

**Z-Index**: 20000+ (always on top)

**Context Detection**:
```javascript
function detectContextMenuContext(event) {
  const target = event.target;
  
  // Canvas click
  if (target.classList.contains('canvas-element') || target.closest('canvas')) {
    const displayId = target.closest('[data-display-id]')?.dataset.displayId;
    return { type: 'canvas', targetId: displayId, targetType: 'display' };
  }
  
  // Header click
  if (target.classList.contains('header') || target.closest('.header')) {
    const displayId = target.closest('[data-display-id]')?.dataset.displayId;
    return { type: 'header', targetId: displayId, targetType: 'display' };
  }
  
  // Panel click
  if (target.classList.contains('floating-panel') || target.closest('.floating-panel')) {
    const panelId = target.closest('[data-panel-id]')?.dataset.panelId;
    return { type: 'panel', targetId: panelId, targetType: 'panel' };
  }
  
  // Workspace click
  return { type: 'workspace', targetId: null, targetType: 'workspace' };
}
```

**Dynamic Content Rendering**:
```svelte
{#if $contextMenu.open}
  <div class="unified-context-menu" style="left: {$contextMenu.x}px; top: {$contextMenu.y}px;">
    <!-- Canvas Context - Full Tabbed Interface -->
    {#if $contextMenu.context.type === 'canvas'}
      <CanvasTabbedInterface 
        displayId={$contextMenu.context.targetId}
        onParameterChange={handleParameterChange}
      />
    {:else if $contextMenu.context.type === 'header'}
      <HeaderQuickActions 
        displayId={$contextMenu.context.targetId}
        onAction={handleQuickAction}
      />
    {:else if $contextMenu.context.type === 'workspace'}
      <WorkspaceQuickActions onAction={handleQuickAction} />
    {:else if $contextMenu.context.type === 'panel'}
      <PanelQuickActions 
        panelId={$contextMenu.context.targetId}
        onAction={handleQuickAction}
      />
    {/if}
  </div>
{/if}
```

### CanvasTabbedInterface.svelte
**Purpose**: Preserve CanvasContextMenu's sophisticated functionality within unified architecture

**Features**:
- All 6 tabs (Quick Actions, Price Display, Market Profile, Volatility, Layout Sizing, Advanced)
- 85+ parameter controls organized by groups
- Search functionality across all parameters
- Keyboard shortcuts and navigation
- Reset to defaults functionality

**Store Integration**:
```javascript
// Handle parameter changes through store
function handleParameterChange(parameter, value) {
  actions.updateCanvasConfig(displayId, parameter, value);
}

// Handle batch updates
function handleBatchConfig(configUpdates) {
  actions.updateMultipleCanvasConfig(displayId, configUpdates);
}

// Handle reset
function handleReset() {
  actions.resetCanvasConfig(displayId);
}
```

## Implementation Strategy

### Phase 1: Foundation (Week 1)
1. **Create UnifiedContextMenu.svelte**
   - Implement context detection engine
   - Create dynamic content rendering system
   - Integrate with floatingStore context menu state

2. **Enhance floatingStore**
   - Add canvas configuration actions
   - Extend display state structure
   - Implement unified context menu management

3. **Create Context Components**
   - CanvasTabbedInterface.svelte
   - HeaderQuickActions.svelte
   - WorkspaceQuickActions.svelte
   - PanelQuickActions.svelte

### Phase 2: Integration (Week 2)
1. **Migrate CanvasContextMenu Functionality**
   - Port all 6 tabs and 85+ parameters
   - Implement store-based parameter management
   - Preserve search and keyboard navigation

2. **Update Event Handling**
   - Replace existing context menu event listeners
   - Implement unified right-click handling
   - Add context detection to FloatingDisplay.svelte

3. **Component Updates**
   - Update FloatingDisplay.svelte to use unified context menu
   - Update App.svelte to use UnifiedContextMenu
   - Remove old ContextMenu.svelte and CanvasContextMenu.svelte

### Phase 3: Enhancement (Week 3)
1. **Progressive Disclosure**
   - Implement intelligent option prioritization
   - Add "advanced options" expansion
   - Create contextual help system

2. **Performance Optimization**
   - Optimize parameter update performance
   - Implement efficient search indexing
   - Add lazy loading for advanced tabs

3. **User Experience Refinement**
   - Add smooth transitions between contexts
   - Implement visual feedback for context switches
   - Create comprehensive keyboard shortcut system

## Parameter Organization

### Preserved CanvasContextMenu Structure
All 85+ parameters are preserved and organized into the same 6 groups:

1. **Quick Actions** (12 parameters): Essential toggles and show/hide controls
2. **Price Display** (18 parameters): Price float and display settings
3. **Market Profile** (20 parameters): Market profile visualization settings
4. **Volatility** (16 parameters): Volatility orb and flash settings
5. **Layout & Sizing** (12 parameters): Dimensions and positioning
6. **Advanced** (17 parameters): Power user and experimental features

### Enhanced Parameter Management
```javascript
// Parameter metadata preserved from CanvasContextMenu
export const parameterGroups = [
  quickActionsGroup,
  priceDisplayGroup,
  marketProfileGroup,
  volatilityGroup,
  layoutSizingGroup,
  advancedGroup
];

// Enhanced with store integration
export const getParameterWithStore = (parameterName) => {
  const metadata = getParameterMetadata(parameterName);
  return {
    ...metadata,
    storeAction: (displayId, value) => actions.updateCanvasConfig(displayId, parameterName, value)
  };
};
```

## Testing Strategy

### Functional Testing
- Context detection accuracy for all click targets
- Parameter updates through store integration
- Menu positioning and viewport constraints
- Cross-context navigation and switching

### Performance Testing
- Menu rendering performance with 85+ parameters
- Search functionality responsiveness
- Store update efficiency
- Memory usage with multiple displays

### User Experience Testing
- Intuitiveness of context switching
- Efficiency of parameter discovery
- Workflow effectiveness for traders
- Accessibility compliance

### Integration Testing
- Compatibility with floating architecture
- Event handling without conflicts
- State persistence and synchronization
- Cross-browser compatibility

## Migration Strategy

### Backward Compatibility
- All existing CanvasContextMenu parameters preserved
- No breaking changes to display configuration
- Smooth transition from dual-menu system

### Data Migration
- Existing display configs automatically enhanced
- Default values applied for new parameters
- User preferences preserved during migration

### Rollback Plan
- Keep original components as backup during migration
- Implement feature flags for gradual rollout
- Comprehensive testing before deployment

## Performance Considerations

### Rendering Optimization
- Lazy loading of tab content
- Efficient parameter grouping and indexing
- Minimal DOM updates for parameter changes
- GPU-accelerated animations and transitions

### Memory Management
- Efficient parameter storage in store
- Proper cleanup of event listeners
- Minimal object creation during updates
- Optimized search indexing

### Scalability
- Support for 50+ concurrent displays
- Efficient parameter update batching
- Optimized context detection algorithms
- Smooth performance under load

## Future Enhancements

### Advanced Context Intelligence
- Contextual help and documentation
- Customizable context menu configurations

### Extended Functionality
- Multi-display parameter synchronization
- Workspace-level parameter templates
- Export/import configuration presets
- Integration with external configuration systems

### Enhanced User Experience
- Gesture-based parameter adjustment
- Real-time parameter validation
- Advanced visualization of parameter effects

## Browser Compatibility

### Supported Features
- Modern JavaScript (ES6+) features
- CSS Grid and Flexbox layouts
- Advanced event handling
- Local storage for persistence

### Fallback Strategies
- Simplified menu rendering for older browsers
- Reduced motion support
- Alternative interaction methods
- Graceful degradation for advanced features

This unified context menu architecture provides a foundation for consistent, intelligent interactions across the entire NeuroSense FX interface, enhancing both trader productivity and system maintainability while preserving the sophisticated functionality that traders depend on.
