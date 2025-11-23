// =============================================================================
// WORKSPACE GRID UTILITY - Grid Snapping Configuration & Management
// =============================================================================
// Purpose: Centralized grid configuration and interact.js integration
// Provides optimized grid snapping functionality for NeuroSense FX floating displays
// Leverages interact.js's built-in snap modifiers for maximum performance

import interact from 'interactjs';

/**
 * Workspace Grid Management Class
 * Centralized grid configuration and interact.js integration
 */
export class WorkspaceGrid {
  constructor() {
    // Default grid settings
    this.enabled = true;
    this.gridSize = 20;
    this.showGridLines = false;
    this.gridOpacity = 0.2;
    this.showGridOnlyOnDrag = true;
    this.snapThreshold = 10; // 🔧 FIXED: Use reasonable snap range instead of Infinity to prevent forced repositioning
    
    // Visual feedback state
    this.isDragging = false;
    this.gridOverlayElement = null;
    
    // Interact.js instances cache for dynamic updates
    this.interactInstances = new Set();
    
    // Load saved settings if available
    this.loadSettings();
  }

  /**
   * Load grid settings from workspace storage
   */
  loadSettings() {
    try {
      // ✅ FIXED: Use proper ES6 import instead of require() for browser compatibility
      import('./workspaceStorage.js').then(({ loadWorkspaceSettings }) => {
        const settings = loadWorkspaceSettings();
        
        if (settings) {
          Object.assign(this, {
            enabled: settings.gridSnapEnabled ?? true,
            gridSize: settings.gridSize ?? 20,
            showGridLines: settings.showGridLines ?? false,
            gridOpacity: settings.gridOpacity ?? 0.2,
            showGridOnlyOnDrag: settings.showGridOnlyOnDrag ?? true
          });
        }
      }).catch(error => {
        console.warn('[WORKSPACE_GRID] Failed to import workspaceStorage:', error);
      });
    } catch (error) {
      console.warn('[WORKSPACE_GRID] Failed to load grid settings:', error);
    }
  }

  /**
   * Save current grid settings to workspace storage
   */
  async saveSettings() {
    try {
      // ✅ FIXED: Use proper ES6 import instead of require() for browser compatibility
      const { saveWorkspaceSettings } = await import('./workspaceStorage.js');
      const settings = {
        gridSnapEnabled: this.enabled,
        gridSize: this.gridSize,
        showGridLines: this.showGridLines,
        gridOpacity: this.gridOpacity,
        showGridOnlyOnDrag: this.showGridOnlyOnDrag
      };
      saveWorkspaceSettings(settings);
    } catch (error) {
      console.warn('[WORKSPACE_GRID] Failed to save grid settings:', error);
    }
  }

  /**
   * Get interact.js snap configuration for current grid settings
   * @returns {Array} Interact.js snap targets array
   */
  getInteractSnappers() {
    if (!this.enabled) {
      return [];
    }
    
    return [
      interact.snappers.grid({ 
        x: this.gridSize, 
        y: this.gridSize 
      })
    ];
  }

  /**
   * Get complete interact.js modifier configuration
   * @returns {Object} Interact.js modifiers configuration
   */
  getInteractModifiers() {
    const modifiers = [
      // Always include restriction modifiers
      interact.modifiers.restrictEdges({
        outer: { 
          left: 0, 
          top: 0, 
          right: window.innerWidth,
          bottom: window.innerHeight
        }
      })
    ];

    // Add grid snapping if enabled
    if (this.enabled) {
      modifiers.push(
        interact.modifiers.snap({
          targets: this.getInteractSnappers(),
          relativePoints: [{ x: 0, y: 0 }], // Snap element's origin
          range: this.snapThreshold, // Snap from any distance
          enabled: this.enabled
        })
      );
    }

    return modifiers;
  }

  /**
   * Register an interact.js instance for dynamic updates
   * @param {Object} interactable - Interact.js interactable instance
   */
  registerInteractInstance(interactable) {
    this.interactInstances.add(interactable);
  }

  /**
   * Unregister an interact.js instance
   * @param {Object} interactable - Interact.js interactable instance
   */
  unregisterInteractInstance(interactable) {
    this.interactInstances.delete(interactable);
  }

  /**
   * Update all registered interact.js instances with new grid settings
   */
  updateAllInteractInstances() {
    this.interactInstances.forEach(interactable => {
      try {
        // Update interactable with new modifiers
        interactable.set({
          modifiers: this.getInteractModifiers()
        });
      } catch (error) {
        console.warn('[WORKSPACE_GRID] Failed to update interact instance:', error);
      }
    });
  }

  /**
   * Update grid settings and refresh all interact.js instances
   * @param {Object} newSettings - Grid configuration updates
   */
  updateSettings(newSettings) {
    const oldSettings = {
      enabled: this.enabled,
      gridSize: this.gridSize,
      showGridLines: this.showGridLines,
      gridOpacity: this.gridOpacity,
      showGridOnlyOnDrag: this.showGridOnlyOnDrag
    };

    // Apply new settings
    Object.assign(this, newSettings);

    // Update interact.js instances if grid settings changed
    if (oldSettings.enabled !== this.enabled || oldSettings.gridSize !== this.gridSize) {
      this.updateAllInteractInstances();
    }

    // Update visual grid if visible
    if (this.gridOverlayElement && (oldSettings.showGridLines !== this.showGridLines || 
        oldSettings.gridOpacity !== this.gridOpacity || 
        oldSettings.gridSize !== this.gridSize)) {
      this.updateGridOverlay();
    }

    // Save settings
    this.saveSettings();

    console.log('[WORKSPACE_GRID] Grid settings updated:', {
      enabled: this.enabled,
      gridSize: this.gridSize,
      showGridLines: this.showGridLines,
      instancesUpdated: this.interactInstances.size
    });
  }

  /**
   * Check if coordinate is on grid line
   * @param {number} coord - Coordinate to check
   * @returns {boolean} True if on grid line
   */
  isOnGridLine(coord) {
    if (!this.enabled) return false;
    return coord % this.gridSize === 0;
  }

  /**
   * Snap coordinate to nearest grid line
   * @param {number} coord - Coordinate to snap
   * @returns {number} Snapped coordinate
   */
  snapToGrid(coord) {
    if (!this.enabled) return coord;
    return Math.round(coord / this.gridSize) * this.gridSize;
  }

  /**
   * Snap position to grid
   * @param {Object} position - {x, y} position
   * @returns {Object} Snapped position
   */
  snapPositionToGrid(position) {
    return {
      x: this.snapToGrid(position.x),
      y: this.snapToGrid(position.y)
    };
  }

  /**
   * Get grid line positions for rendering
   * @param {Object} viewport - {width, height} viewport dimensions
   * @returns {Object} Grid lines positions {vertical: [], horizontal: []}
   */
  getGridLines(viewport) {
    if (!this.enabled) {
      return { vertical: [], horizontal: [] };
    }

    const vertical = [];
    const horizontal = [];

    // Generate vertical grid lines
    for (let x = 0; x <= viewport.width; x += this.gridSize) {
      vertical.push(x);
    }

    // Generate horizontal grid lines
    for (let y = 0; y <= viewport.height; y += this.gridSize) {
      horizontal.push(y);
    }

    return { vertical, horizontal };
  }

  /**
   * Create or update visual grid overlay
   */
  updateGridOverlay() {
    if (!this.showGridLines) {
      this.hideGridOverlay();
      return;
    }

    if (!this.gridOverlayElement) {
      this.createGridOverlay();
    }

    // Update grid overlay styles
    this.gridOverlayElement.style.backgroundImage = `
      linear-gradient(to right, rgba(255,255,255,${this.gridOpacity}) 1px, transparent 1px),
      linear-gradient(to bottom, rgba(255,255,255,${this.gridOpacity}) 1px, transparent 1px)
    `;
    this.gridOverlayElement.style.backgroundSize = `${this.gridSize}px ${this.gridSize}px`;
  }

  /**
   * Create visual grid overlay element
   */
  createGridOverlay() {
    if (this.gridOverlayElement) return;

    this.gridOverlayElement = document.createElement('div');
    this.gridOverlayElement.className = 'workspace-grid-overlay';
    this.gridOverlayElement.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: 0;
      background-image: 
        linear-gradient(to right, rgba(255,255,255,${this.gridOpacity}) 1px, transparent 1px),
        linear-gradient(to bottom, rgba(255,255,255,${this.gridOpacity}) 1px, transparent 1px);
      background-size: ${this.gridSize}px ${this.gridSize}px;
      opacity: ${this.showGridLines ? 1 : 0};
      transition: opacity 0.2s ease;
    `;

    document.body.appendChild(this.gridOverlayElement);
  }

  /**
   * Show visual grid overlay
   */
  showGridOverlay() {
    if (!this.showGridOnlyOnDrag || this.isDragging) {
      this.updateGridOverlay();
      if (this.gridOverlayElement) {
        this.gridOverlayElement.style.opacity = '1';
      }
    }
  }

  /**
   * Hide visual grid overlay
   */
  hideGridOverlay() {
    if (this.gridOverlayElement) {
      this.gridOverlayElement.style.opacity = '0';
    }
  }

  /**
   * Set dragging state for visual grid feedback
   * @param {boolean} isDragging - Whether dragging is active
   */
  setDraggingState(isDragging) {
    this.isDragging = isDragging;
    
    if (this.showGridOnlyOnDrag) {
      if (isDragging) {
        this.showGridOverlay();
      } else {
        this.hideGridOverlay();
      }
    }
  }

  /**
   * Enable grid snapping
   */
  enable() {
    this.updateSettings({ enabled: true });
  }

  /**
   * Disable grid snapping
   */
  disable() {
    this.updateSettings({ enabled: false });
  }

  /**
   * Toggle grid snapping enabled state
   * @returns {boolean} New enabled state
   */
  toggle() {
    this.updateSettings({ enabled: !this.enabled });
    return this.enabled;
  }

  /**
   * Set grid size
   * @param {number} size - Grid size in pixels
   */
  setGridSize(size) {
    // Validate grid size (must be positive integer)
    const validSize = Math.max(8, Math.min(64, Math.round(size)));
    this.updateSettings({ gridSize: validSize });
  }

  /**
   * Toggle visual grid lines
   * @returns {boolean} New showGridLines state
   */
  toggleGridLines() {
    this.updateSettings({ showGridLines: !this.showGridLines });
    return this.showGridLines;
  }

  /**
   * Get current grid configuration
   * @returns {Object} Current grid settings
   */
  getSettings() {
    return {
      enabled: this.enabled,
      gridSize: this.gridSize,
      showGridLines: this.showGridLines,
      gridOpacity: this.gridOpacity,
      showGridOnlyOnDrag: this.showGridOnlyOnDrag,
      snapThreshold: this.snapThreshold
    };
  }

  /**
   * Cleanup grid resources
   */
  cleanup() {
    this.interactInstances.clear();
    this.hideGridOverlay();
    
    if (this.gridOverlayElement) {
      document.body.removeChild(this.gridOverlayElement);
      this.gridOverlayElement = null;
    }
  }
}

// =============================================================================
// SINGLETON INSTANCE & EXPORTS
// =============================================================================

// Create singleton instance for global use
export const workspaceGrid = new WorkspaceGrid();

// Export convenience functions
export const enableGrid = () => workspaceGrid.enable();
export const disableGrid = () => workspaceGrid.disable();
export const toggleGrid = () => workspaceGrid.toggle();
export const setGridSize = (size) => workspaceGrid.setGridSize(size);
export const toggleGridLines = () => workspaceGrid.toggleGridLines();
export const getGridSettings = () => workspaceGrid.getSettings();

export default workspaceGrid;
