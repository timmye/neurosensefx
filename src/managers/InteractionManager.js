import { actions } from '../stores/floatingStore.js';

/**
 * Centralized Interaction Manager
 * 
 * Single authority for all mouse interactions to eliminate competing event systems
 * that cause resize/drag conflicts and race conditions.
 */
export class InteractionManager {
  constructor() {
    this.activeInteraction = null; // 'drag' | 'resize' | null
    this.targetId = null;
    this.handleType = null;
    this.startData = null;
    this.isInitialized = false;
    
    // 🔧 PERFORMANCE: Add debouncing for high-frequency events
    this.lastMouseMoveTime = 0;
    this.mouseMoveThrottle = 16; // ~60fps (1000ms / 60 = 16.67ms)
    this.pendingMouseMove = null;
    
    // Bind methods to maintain context
    this.handleMouseMove = this.handleMouseMove.bind(this);
    this.handleMouseUp = this.handleMouseUp.bind(this);
  }

  /**
   * SINGLE ENTRY POINT for all mouse interactions
   * Replaces competing event systems with unified authority
   */
  handleMouseDown(targetId, interactionType, handleType, mousePos, startData) {
    console.log(`[INTERACTION_MANAGER] Starting ${interactionType} for ${targetId} with handle ${handleType}`);
    
    // Only end existing interaction if it's different
    if (this.activeInteraction && this.activeInteraction !== interactionType) {
      this.endCurrentInteraction();
    }
    
    // Set new interaction
    this.activeInteraction = interactionType;
    this.targetId = targetId;
    this.handleType = handleType;
    this.startData = { mousePos, startData };
    
    // Initialize interaction in the store
    if (interactionType === 'drag') {
      actions.startDrag('display', targetId, startData.position, mousePos);
    } else if (interactionType === 'resize') {
      actions.startResize(targetId, handleType, startData.position, startData.size, mousePos);
    }
    
    // Add ONE set of global listeners
    this.addGlobalListeners();
  }

  /**
   * Unified mouse move handler for both drag and resize
   */
  handleMouseMove(e) {
    if (!this.activeInteraction) return;
    
    const mousePos = { x: e.clientX, y: e.clientY };
    
    if (this.activeInteraction === 'drag') {
      actions.updateDrag(mousePos);
    } else if (this.activeInteraction === 'resize') {
      actions.updateResize(mousePos);
    }
  }

  /**
   * Unified mouse up handler for both drag and resize
   */
  handleMouseUp(e) {
    console.log(`[INTERACTION_MANAGER] Ending ${this.activeInteraction} for ${this.targetId}`);
    this.endCurrentInteraction();
  }

  /**
   * Cleanly end current interaction
   */
  endCurrentInteraction() {
    if (!this.activeInteraction) return;
    
    if (this.activeInteraction === 'drag') {
      actions.endDrag();
    } else if (this.activeInteraction === 'resize') {
      actions.endResize();
    }
    
    this.activeInteraction = null;
    this.targetId = null;
    this.handleType = null;
    this.startData = null;
    
    // Remove global listeners
    this.removeGlobalListeners();
  }


  /**
   * Add global event listeners only once
   */
  addGlobalListeners() {
    if (this.isInitialized) return;
    
    console.log(`[INTERACTION_MANAGER] Adding global listeners`);
    document.addEventListener('mousemove', this.handleMouseMove);
    document.addEventListener('mouseup', this.handleMouseUp);
    this.isInitialized = true;
  }

  /**
   * Remove global event listeners cleanly
   */
  removeGlobalListeners() {
    if (!this.isInitialized) return;
    
    console.log(`[INTERACTION_MANAGER] Removing global listeners`);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    this.isInitialized = false;
    
    // 🔧 PERFORMANCE: Clear throttling state
    this.lastMouseMoveTime = 0;
    this.pendingMouseMove = null;
  }

  /**
   * Force cleanup (for component destruction)
   */
  cleanup() {
    this.endCurrentInteraction();
  }

  /**
   * Get current interaction state for debugging
   */
  getState() {
    return {
      activeInteraction: this.activeInteraction,
      targetId: this.targetId,
      handleType: this.handleType,
      isInitialized: this.isInitialized
    };
  }
}

// Export singleton instance
export const interactionManager = new InteractionManager();
