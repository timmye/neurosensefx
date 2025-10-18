/**
 * Unified position persistence utilities for floating elements
 * Provides consistent localStorage-based persistence across all floating panels
 */

import { createLogger } from './debugLogger.js';

const logger = createLogger('PositionPersistence');

export class PositionPersistence {
  /**
   * Save position to localStorage
   * @param {string} elementId - Unique identifier for the element
   * @param {Object} position - Position object with x and y coordinates
   */
  static savePosition(elementId, position) {
    try {
      localStorage.setItem(`floating-${elementId}-position`, JSON.stringify(position));
      logger.debug('Position saved', { elementId, position });
    } catch (e) {
      logger.error('Failed to save position', { elementId, error: e.message });
    }
  }
  
  /**
   * Load position from localStorage
   * @param {string} elementId - Unique identifier for the element
   * @param {Object} defaultPosition - Default position if no saved position exists
   * @returns {Object} Position object with x and y coordinates
   */
  static loadPosition(elementId, defaultPosition = { x: 100, y: 100 }) {
    try {
      const saved = localStorage.getItem(`floating-${elementId}-position`);
      if (saved) {
        const position = JSON.parse(saved);
        logger.debug('Position loaded', { elementId, position });
        return position;
      }
    } catch (e) {
      logger.warn('Failed to parse saved position', { elementId, error: e.message });
    }
    
    logger.debug('Using default position', { elementId, position: defaultPosition });
    return { ...defaultPosition };
  }
  
  /**
   * Save element state (e.g., minimized state) to localStorage
   * @param {string} elementId - Unique identifier for the element
   * @param {Object} state - State object to save
   */
  static saveState(elementId, state) {
    try {
      localStorage.setItem(`floating-${elementId}-state`, JSON.stringify(state));
      logger.debug('State saved', { elementId, state });
    } catch (e) {
      logger.error('Failed to save state', { elementId, error: e.message });
    }
  }
  
  /**
   * Load element state from localStorage
   * @param {string} elementId - Unique identifier for the element
   * @param {Object} defaultState - Default state if no saved state exists
   * @returns {Object} State object
   */
  static loadState(elementId, defaultState = {}) {
    try {
      const saved = localStorage.getItem(`floating-${elementId}-state`);
      if (saved) {
        const state = JSON.parse(saved);
        logger.debug('State loaded', { elementId, state });
        return state;
      }
    } catch (e) {
      logger.warn('Failed to parse saved state', { elementId, error: e.message });
    }
    
    logger.debug('Using default state', { elementId, state: defaultState });
    return { ...defaultState };
  }
  
  /**
   * Clear all persisted data for an element
   * @param {string} elementId - Unique identifier for the element
   */
  static clearElementData(elementId) {
    try {
      localStorage.removeItem(`floating-${elementId}-position`);
      localStorage.removeItem(`floating-${elementId}-state`);
      logger.debug('Element data cleared', { elementId });
    } catch (e) {
      logger.error('Failed to clear element data', { elementId, error: e.message });
    }
  }
  
  /**
   * Clear all floating element data from localStorage
   * Useful for resetting the application state
   */
  static clearAllFloatingData() {
    try {
      const keys = Object.keys(localStorage);
      const floatingKeys = keys.filter(key => key.startsWith('floating-'));
      
      floatingKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      logger.info('Cleared all floating element data', { count: floatingKeys.length });
    } catch (e) {
      logger.error('Failed to clear all floating data', { error: e.message });
    }
  }
  
  /**
   * Get all saved floating element positions
   * @returns {Object} Map of element IDs to their positions
   */
  static getAllPositions() {
    const positions = {};
    
    try {
      const keys = Object.keys(localStorage);
      const positionKeys = keys.filter(key => key.startsWith('floating-') && key.endsWith('-position'));
      
      positionKeys.forEach(key => {
        const elementId = key.replace('floating-', '').replace('-position', '');
        const saved = localStorage.getItem(key);
        if (saved) {
          try {
            positions[elementId] = JSON.parse(saved);
          } catch (e) {
            logger.warn('Failed to parse position', { key, error: e.message });
          }
        }
      });
    } catch (e) {
      logger.error('Failed to get all positions', { error: e.message });
    }
    
    return positions;
  }
}