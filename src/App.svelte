<script>
  import { onMount, onDestroy } from 'svelte';
  import { displayStore, displayActions, displays, icons, panels, defaultConfig, contextMenu } from './stores/displayStore.js';
  import { subscribe, unsubscribe } from './data/wsClient.js';
  import FloatingDisplay from './components/FloatingDisplay.svelte';
  import FloatingIcon from './components/FloatingIcon.svelte';
  import UnifiedContextMenu from './components/UnifiedContextMenu.svelte';
  import SymbolPalette from './components/SymbolPalette.svelte';
  import StatusPanel from './components/StatusPanel/StatusPanel.svelte';
  import StatusIcon from './components/StatusPanel/StatusIcon.svelte';
  import symbolService from './services/symbolService.js';
  import { Environment, EnvironmentConfig, initializeEnvironment, getEnvironmentInfo } from './lib/utils/environmentUtils.js';

  
  // 🎨 CANVAS CONTEXT: Load context menu test script
  import '../test-context-menu.js';

  // 📝 Window Type Extension: contextMenuRef will be available globally
  
  // Store subscriptions
  $: displayList = Array.from($displays.values());
  $: iconList = Array.from($icons.values());
  $: panelList = Array.from($panels.values());
  
  let symbolPaletteRef;
  let contextMenuRef; // Reference to UnifiedContextMenu for intelligent context detection

  // Make contextMenuRef globally available for components
  $: if (contextMenuRef && typeof window !== 'undefined') {
    window.contextMenuRef = contextMenuRef;
  }

  // 🌍 ENVIRONMENT AWARENESS: Global environment state and initialization
  let environmentInfo = null;
  let showGlobalEnvironmentIndicator = false;
  let environmentInitialized = false;
  
  
  // Enhanced keyboard shortcuts
  function handleKeyDown(e) {
    // Ignore if typing in input/textarea
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      // Still handle Ctrl+K even when typing
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        focusSymbolPalette();
      }
      return;
    }
    
    // Escape - close context menu or collapse panels
    if (e.key === 'Escape') {
      if ($contextMenu.open) {
        displayActions.hideContextMenu();
      } else {
        // Collapse expanded icon if any
        const expandedIcon = Array.from($icons.values()).find(icon => icon.isExpanded);
        if (expandedIcon) {
          displayActions.collapseIcon(expandedIcon.id);
        }
      }
    }
    
    // Ctrl+K / Cmd+K - Focus symbol palette
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault();
      focusSymbolPalette();
    }
    
    // Ctrl+N - Open symbol palette for new display (FIXED: Use proper symbol subscription)
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault();
      try {
        focusSymbolPalette(); // Open symbol palette for proper subscription workflow
      } catch (error) {
        console.error('[APP] Failed to open symbol palette:', error);
      }
    }
    
    // Ctrl+Shift+K - Toggle symbol palette
    if (e.ctrlKey && e.shiftKey && e.key === 'K') {
      e.preventDefault();
      toggleSymbolPalette();
    }
  }
  
  // Focus symbol palette (expand if collapsed)
  function focusSymbolPalette() {
    const iconId = 'symbol-palette-icon';
    const icon = $icons.get(iconId);
    
    // Expand icon if collapsed
    if (icon && !icon.isExpanded) {
      displayActions.expandIcon(iconId);
    }
    
    // Focus search input with delay for animation
    setTimeout(() => {
      if (symbolPaletteRef && symbolPaletteRef.focusSearch) {
        symbolPaletteRef.focusSearch();
      } else {
        // Fallback: find search input directly
        const searchInput = document.querySelector('.search-input');
        if (searchInput) {
          searchInput.focus();
          searchInput.select();
        }
      }
    }, 300);
  }
  
  // Toggle symbol palette visibility
  function toggleSymbolPalette() {
    const iconId = 'symbol-palette-icon';
    const icon = $icons.get(iconId);
    
    if (icon) {
      if (icon.isExpanded) {
        displayActions.collapseIcon(iconId);
      } else {
        displayActions.expandIcon(iconId);
      }
    }
  }
  
  // Initialize displays on mount
  onMount(async () => {
    try {
      // 🌍 ENVIRONMENT AWARENESS: Initialize environment system first
      console.log('[APP] Initializing environment system...');
      const envInit = initializeEnvironment();
      if (envInit.success) {
        environmentInitialized = true;
        environmentInfo = getEnvironmentInfo();
        showGlobalEnvironmentIndicator = EnvironmentConfig.current.showEnvironmentIndicator;

        console.log('[APP] Environment initialized successfully:', {
          environment: Environment.current,
          showIndicator: showGlobalEnvironmentIndicator,
          config: EnvironmentConfig.current
        });

        // Show environment-specific console message
        if (Environment.isDevelopment) {
          console.log('%c🔧 NeuroSense FX Development Mode', 'color: #a855f7; font-weight: bold; font-size: 14px;');
          console.log('%cDebug logging and development features are enabled', 'color: #a855f7; font-style: italic;');
        } else {
          console.log('%c🚀 NeuroSense FX Production Mode', 'color: #0891b2; font-weight: bold; font-size: 14px;');
        }
      } else {
        console.warn('[APP] Environment initialization failed:', envInit);
      }

      // Initialize workspace from persisted data first
      await displayActions.initializeWorkspace();

      // Ensure symbol palette starts collapsed (override any saved state)
      setTimeout(() => {
        // Force collapse and remove any existing panel
        displayActions.collapseIcon('symbol-palette-icon');

        // Remove any existing symbol palette panel from previous sessions
        displayStore.update(store => {
          const newPanels = new Map(store.panels);
          newPanels.delete('symbol-palette');
          return {
            ...store,
            panels: newPanels
          };
        });
      }, 100);

      // Initialize symbol service
      await symbolService.initialize();
      const symbols = symbolService.getSymbols();
      const firstSymbol = symbolService.getFirstSymbol();
      
      // Create symbol palette floating icon (panel is created when icon is clicked)
      displayActions.addIcon('symbol-palette-icon', 'symbol-palette', { x: 20, y: 20 }, {
        title: 'Symbol Palette',
        status: 'online'
      });

      // Create status icon (following symbol palette pattern)
      console.log('[APP] Creating status icon...');
      displayActions.addIcon('status-icon', 'status-icon', { x: window.innerWidth - 100, y: 20 }, {
        title: 'System Status',
        status: 'online'
      });
      console.log('[APP] Status icon created');

    } catch (error) {
      console.error('[APP] Initialization failed:', error);
      // Fallback: try to create display with default symbol
      try {
        const fallbackSymbol = 'EURUSD';
        const validation = symbolService.validateSymbol(fallbackSymbol);
        if (validation.valid) {
          const displayId = displayActions.addDisplay(validation.symbol, { x: 100, y: 100 });
        }
      } catch (fallbackError) {
        console.error('[APP] Fallback display creation also failed:', fallbackError);
      }
    }

    // 🎨 CONTEXT MENU: Setup global context menu reference after components are mounted
    setTimeout(() => {
      if (contextMenuRef && typeof window !== 'undefined') {
        window.contextMenuRef = contextMenuRef;
        console.log('🎨 [APP] window.contextMenuRef set globally');
      } else {
        console.warn('🎨 [APP] contextMenuRef not available for global assignment');
        // Try again after additional delay
        setTimeout(() => {
          if (contextMenuRef && typeof window !== 'undefined') {
            window.contextMenuRef = contextMenuRef;
            console.log('🎨 [APP] window.contextMenuRef set globally (retry)');
          } else {
            console.error('🎨 [APP] Failed to set window.contextMenuRef after retry');
          }
        }, 1000);
      }

      // 🔧 TESTING: Global test canvas creation function for drift testing
      if (typeof window !== 'undefined') {
        window.createTestCanvas = function(symbol = 'EURUSD', x = 200, y = 200) {
          try {
            console.log(`[TEST] Creating test canvas for ${symbol} at (${x}, ${y})`);
            const displayId = displayActions.addDisplay(symbol, { x, y });

            if (displayId) {
              console.log(`[TEST] Successfully created display ${displayId}`);

              // Simulate proper subscription workflow
              setTimeout(() => {
                if (window.wsClient && window.wsClient.subscribe) {
                  window.wsClient.subscribe(symbol);
                  console.log(`[TEST] Subscribed to ${symbol} for display ${displayId}`);
                }
              }, 100);

              return displayId;
            } else {
              console.error(`[TEST] Failed to create display for ${symbol}`);
              return null;
            }
          } catch (error) {
            console.error(`[TEST] Error creating test canvas:`, error);
            return null;
          }
        };
        console.log('🧪 [APP] window.createTestCanvas() available for drift testing');
      }
    }, 1000); // Increase delay to ensure components are fully mounted
  });


  // Handle workspace right-click
  function handleWorkspaceContextMenu(e) {
    if (e.target === e.currentTarget) {
      e.preventDefault();
      
      // Use unified context menu system
      const context = {
        type: 'workspace',
        targetId: null,
        targetType: 'workspace'
      };
      
      displayActions.showContextMenu(e.clientX, e.clientY, null, 'workspace', context);
    }
  }
</script>

<svelte:window on:keydown={handleKeyDown} />

<main>
  <!-- Workspace Background -->
  <div
    class="workspace"
    on:contextmenu={handleWorkspaceContextMenu}
  >
    <!-- 🌍 Global Environment Indicator -->
    {#if showGlobalEnvironmentIndicator && environmentInfo}
      <div class="global-environment-indicator" class:env-dev={Environment.isDevelopment} class:env-prod={Environment.isProduction}>
        <div class="env-icon">
          {Environment.isDevelopment ? '🔧' : '🚀'}
        </div>
        <div class="env-text">
          <span class="env-mode">{Environment.current.toUpperCase()}</span>
          {#if Environment.isDevelopment}
            <span class="env-details">DEV MODE</span>
          {/if}
        </div>
        {#if Environment.isDevelopment && EnvironmentConfig.current.debugLogging}
          <div class="env-debug-indicator" title="Debug Logging Enabled"></div>
        {/if}
      </div>
    {/if}
  </div>
  
      <!-- Floating Icons (Layer 3) -->
      {#each iconList as icon (icon.id)}
        <FloatingIcon
          id={icon.id}
          type={icon.type}
          position={icon.position}
          config={icon.config}
          title={icon.config?.title}
          on:toggleExpansion={(e) => {
            const { id, isExpanded } = e.detail;
            if (isExpanded) {
              displayActions.expandIcon(id);
            } else {
              displayActions.collapseIcon(id);
            }
          }}
        >
          {#if icon.type === 'status-icon'}
            <StatusIcon />
          {/if}
        </FloatingIcon>
      {/each}
  
  <!-- Floating Displays (Layer 1) -->
  {#each displayList as display (display.id)}
    <FloatingDisplay 
      id={display.id}
      symbol={display.symbol}
      position={display.position}
    />
  {/each}
  
  <!-- Symbol Palette (Layer 2) -->
  {#each panelList as panel (panel.id)}
    {#if panel.id === 'symbol-palette'}
      <SymbolPalette bind:this={symbolPaletteRef} />
    {/if}
  {/each}

  <!-- Status Panel (Layer 2 - Expanded when icon is clicked) -->
  {#each panelList as panel (panel.id)}
    {#if panel.id === 'status-panel'}
      <StatusPanel position={panel.position} config={panel.config} isFromIconExpansion={true} />
    {/if}
  {/each}
  
  <!-- Unified Context Menu (Layer 4) -->
  <UnifiedContextMenu bind:this={contextMenuRef} />
  
</main>

<style>
  :global(body) {
    background-color: #111827;
    margin: 0;
    overflow: hidden;
  }
  
  main {
    width: 100vw;
    height: 100vh;
    position: relative;
  }
  
  .workspace {
    position: absolute;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: #111827;
    background-image:
      radial-gradient(circle at 20% 50%, rgba(79, 70, 229, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 80% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 50%),
      radial-gradient(circle at 40% 20%, rgba(239, 68, 68, 0.1) 0%, transparent 50%);
  }

  /* 🌍 Global Environment Indicator Styles */
  .global-environment-indicator {
    position: absolute;
    top: 12px;
    left: 12px;
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid;
    background: rgba(15, 23, 42, 0.9);
    backdrop-filter: blur(12px);
    z-index: 1000;
    transition: all 0.3s ease;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
  }

  .global-environment-indicator.env-dev {
    border-color: rgba(168, 85, 247, 0.4);
    background: rgba(168, 85, 247, 0.15);
    color: #a855f7;
    box-shadow: 0 4px 12px rgba(168, 85, 247, 0.2);
  }

  .global-environment-indicator.env-prod {
    border-color: rgba(8, 145, 178, 0.4);
    background: rgba(8, 145, 178, 0.15);
    color: #0891b2;
    box-shadow: 0 4px 12px rgba(8, 145, 178, 0.2);
  }

  .env-icon {
    font-size: 16px;
    line-height: 1;
    animation: env-icon-pulse 2s infinite ease-in-out;
  }

  @keyframes env-icon-pulse {
    0%, 100% {
      transform: scale(1);
    }
    50% {
      transform: scale(1.1);
    }
  }

  .env-text {
    display: flex;
    flex-direction: column;
    gap: 1px;
  }

  .env-mode {
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    line-height: 1;
  }

  .env-details {
    font-size: 9px;
    font-weight: 500;
    opacity: 0.8;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }

  .env-debug-indicator {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #f59e0b;
    flex-shrink: 0;
    animation: debug-pulse 1.5s infinite ease-in-out;
  }

  @keyframes debug-pulse {
    0%, 100% {
      opacity: 0.6;
    }
    50% {
      opacity: 1;
    }
  }

  /* Responsive adjustments for global environment indicator */
  @media (max-width: 768px) {
    .global-environment-indicator {
      top: 8px;
      left: 8px;
      padding: 6px 8px;
      font-size: 11px;
      gap: 6px;
    }

    .env-icon {
      font-size: 14px;
    }

    .env-details {
      font-size: 8px;
    }

    .env-debug-indicator {
      width: 5px;
      height: 5px;
    }
  }

  /* Reduced motion support */
  @media (prefers-reduced-motion: reduce) {
    .global-environment-indicator,
    .env-icon,
    .env-debug-indicator {
      transition: none;
      animation: none;
    }
  }

  /* High contrast support */
  @media (prefers-contrast: high) {
    .global-environment-indicator {
      border-width: 2px;
      background: #000;
    }

    .global-environment-indicator.env-dev {
      border-color: #a855f7;
      color: #a855f7;
    }

    .global-environment-indicator.env-prod {
      border-color: #0891b2;
      color: #0891b2;
    }
  }
</style>
