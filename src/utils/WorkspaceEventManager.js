/**
 * Workspace Event Manager
 * Centralized event delegation system for workspace-level interactions
 * Provides single event listeners for performance and consistent behavior
 */

import { workspaceActions } from '../stores/workspaceState.js';
import { uiActions } from '../stores/uiState.js';
import { registryActions } from '../stores/canvasRegistry.js';

export class WorkspaceEventManager {
  constructor(workspaceElement) {
    this.workspace = workspaceElement;
    this.isInitialized = false;
    this.dragState = {
      isDragging: false,
      canvasId: null,
      offset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    };
    
    this.setupEventDelegation();
  }

  /**
   * Setup event delegation at workspace level
   */
  setupEventDelegation() {
    if (this.isInitialized) return;

    // Workspace-level event listeners
    this.workspace.addEventListener('contextmenu', this.handleRightClick.bind(this));
    this.workspace.addEventListener('mousedown', this.handleMouseDown.bind(this));
    
    // Document-level listeners for drag operations
    document.addEventListener('mousemove', this.handleMouseMove.bind(this));
    document.addEventListener('mouseup', this.handleMouseUp.bind(this));
    
    // Keyboard shortcuts
    document.addEventListener('keydown', this.handleKeyDown.bind(this));
    
    // Click outside to close menus
    document.addEventListener('click', this.handleClickOutside.bind(this));

    this.isInitialized = true;
  }

  /**
   * Handle right-click events
   */
  handleRightClick(event) {
    event.preventDefault();
    
    const canvasElement = event.target.closest('.floating-canvas');
    
    if (canvasElement) {
      // Right-click on canvas - show context menu
      const canvasId = canvasElement.dataset.canvasId;
      if (canvasId) {
        this.showCanvasContextMenu(canvasId, event.clientX, event.clientY);
      }
    } else if (event.target === this.workspace) {
      // Right-click on empty workspace - show add display menu
      this.showAddDisplayMenu(event.clientX, event.clientY);
    }
  }

  /**
   * Handle mouse down events
   */
  handleMouseDown(event) {
    if (event.button !== 0) return; // Only left-click
    
    const canvasElement = event.target.closest('.floating-canvas');
    
    if (canvasElement) {
      const canvasId = canvasElement.dataset.canvasId;
      if (canvasId) {
        this.startCanvasDrag(canvasId, event);
      }
    } else {
      // Click on empty workspace - deselect all canvases
      workspaceActions.setActiveCanvas(null);
      uiActions.setActiveCanvas(null);
    }
  }

  /**
   * Handle mouse move events (for dragging)
   */
  handleMouseMove(event) {
    if (!this.dragState.isDragging) return;
    
    event.preventDefault();
    
    const newPosition = {
      x: event.clientX - this.dragState.offset.x,
      y: event.clientY - this.dragState.offset.y
    };
    
    // Constrain to workspace bounds
    const workspaceRect = this.workspace.getBoundingClientRect();
    newPosition.x = Math.max(0, Math.min(newPosition.x, workspaceRect.width - 250)); // Approx canvas width
    newPosition.y = Math.max(0, Math.min(newPosition.y, workspaceRect.height - 150)); // Approx canvas height
    
    workspaceActions.updateDragPosition(newPosition);
  }

  /**
   * Handle mouse up events (end dragging)
   */
  handleMouseUp(event) {
    if (this.dragState.isDragging) {
      this.endCanvasDrag();
    }
  }

  /**
   * Handle keyboard shortcuts
   */
  handleKeyDown(event) {
    // Ignore if user is typing in input fields
    if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') return;
    
    switch (event.key) {
      case 'Escape':
        // Close all menus
        uiActions.hideAllMenus();
        break;
        
      case 'Delete':
      case 'Backspace':
        // Delete active canvas
        const activeCanvasId = this.getActiveSheet();
        if (activeCanvasId) {
          this.deleteCanvas(activeCanvasId);
        }
        break;
        
      case 'n':
      case 'N':
        if (event.ctrlKey || event.metaKey) {
          event.preventDefault();
          this.showAddDisplayMenu(window.innerWidth / 2, window.innerHeight / 2);
        }
        break;
        
      case ' ':
        event.preventDefault();
        // Toggle grid or other workspace-level action
        workspaceActions.toggleGrid();
        break;
    }
  }

  /**
   * Handle clicks outside to close menus
   */
  handleClickOutside(event) {
    const isInsideMenu = event.target.closest('.context-menu, .add-display-menu, .workspace-controls');
    const isInsideCanvas = event.target.closest('.floating-canvas');
    
    if (!isInsideMenu && !isInsideCanvas) {
      uiActions.hideAllMenus();
    }
  }

  /**
   * Start dragging a canvas
   */
  startCanvasDrag(canvasId, event) {
    const canvasElement = this.workspace.querySelector(`[data-canvas-id="${canvasId}"]`);
    if (!canvasElement) return;
    
    const rect = canvasElement.getBoundingClientRect();
    const workspaceRect = this.workspace.getBoundingClientRect();
    
    this.dragState = {
      isDragging: true,
      canvasId,
      offset: {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      },
      startPosition: {
        x: rect.left - workspaceRect.left,
        y: rect.top - workspaceRect.top
      }
    };
    
    // Update stores
    workspaceActions.startDrag(canvasId, this.dragState.offset);
    workspaceActions.setActiveCanvas(canvasId);
    uiActions.setActiveCanvas(canvasId);
    registryActions.markCanvasActive(canvasId);
    
    // Add dragging class for visual feedback
    canvasElement.classList.add('dragging');
  }

  /**
   * End canvas drag
   */
  endCanvasDrag() {
    if (!this.dragState.isDragging) return;
    
    const canvasElement = this.workspace.querySelector(`[data-canvas-id="${this.dragState.canvasId}"]`);
    if (canvasElement) {
      canvasElement.classList.remove('dragging');
    }
    
    workspaceActions.endDrag();
    
    this.dragState = {
      isDragging: false,
      canvasId: null,
      offset: { x: 0, y: 0 },
      startPosition: { x: 0, y: 0 }
    };
  }

  /**
   * Show canvas context menu
   */
  showCanvasContextMenu(canvasId, x, y) {
    workspaceActions.setActiveCanvas(canvasId);
    uiActions.setActiveCanvas(canvasId);
    registryActions.markCanvasActive(canvasId);
    uiActions.showContextMenu({ x, y }, canvasId);
  }

  /**
   * Show add display menu
   */
  showAddDisplayMenu(x, y) {
    uiActions.showAddDisplayMenu({ x, y });
  }

  /**
   * Delete a canvas
   */
  deleteCanvas(canvasId) {
    workspaceActions.removeCanvas(canvasId);
    registryActions.unregisterCanvas(canvasId);
    uiActions.setActiveCanvas(null);
  }

  /**
   * Get currently active canvas ID
   */
  getActiveSheet() {
    // This is a simplified version - in practice you'd subscribe to the store
    // For now, return null as this method isn't currently used
    return null;
  }

  /**
   * Cleanup event listeners
   */
  destroy() {
    if (!this.isInitialized) return;
    
    this.workspace.removeEventListener('contextmenu', this.handleRightClick);
    this.workspace.removeEventListener('mousedown', this.handleMouseDown);
    document.removeEventListener('mousemove', this.handleMouseMove);
    document.removeEventListener('mouseup', this.handleMouseUp);
    document.removeEventListener('keydown', this.handleKeyDown);
    document.removeEventListener('click', this.handleClickOutside);
    
    this.isInitialized = false;
  }
}

/**
 * Factory function to create and initialize a workspace event manager
 */
export function createWorkspaceEventManager(workspaceElement) {
  if (!workspaceElement) {
    throw new Error('Workspace element is required');
  }
  
  return new WorkspaceEventManager(workspaceElement);
}

/**
 * Utility functions for event handling
 */
export const EventUtils = {
  /**
   * Check if event target is within a canvas
   */
  isWithinCanvas(event) {
    return !!event.target.closest('.floating-canvas');
  },

  /**
   * Get canvas ID from event target
   */
  getCanvasIdFromEvent(event) {
    const canvasElement = event.target.closest('.floating-canvas');
    return canvasElement?.dataset.canvasId || null;
  },

  /**
   * Get relative position within workspace
   */
  getRelativePosition(event, workspaceElement) {
    const rect = workspaceElement.getBoundingClientRect();
    return {
      x: event.clientX - rect.left,
      y: event.clientY - rect.top
    };
  },

  /**
   * Check if position is within workspace bounds
   */
  isWithinBounds(position, workspaceElement, canvasSize = { width: 250, height: 150 }) {
    const rect = workspaceElement.getBoundingClientRect();
    return (
      position.x >= 0 &&
      position.y >= 0 &&
      position.x + canvasSize.width <= rect.width &&
      position.y + canvasSize.height <= rect.height
    );
  }
};
