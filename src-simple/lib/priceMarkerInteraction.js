// Price Marker Interaction System - Crystal Clarity: Simple, Performant, Maintainable
// Framework-first: Direct DOM APIs, no custom dropdown libraries

import { workspaceActions, workspaceStore } from '../stores/workspace.js';
import { MARKER_TYPES, createMarker, getMarkerAtPosition } from './priceMarkers.js';
import { getYCoordinate, calculateAdaptiveScale } from './dayRangeCalculations.js';
import { formatPriceToPipLevel } from './priceFormat.js';

export class PriceMarkerInteraction {
  constructor(canvas, displayId, data, scale) {
    this.canvas = canvas;
    this.displayId = displayId;
    this.scale = scale;
    this.data = data; // Store current market data for price calculations
    this.activeDropdown = null;
    this.init();
  }

  // Update method to refresh market data when it changes
  updateData(data) {
    this.data = data;
  }

  init() {
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('contextmenu', e => this.handleContextMenu(e));
    document.addEventListener('keydown', e => e.key === 'Escape' && this.hideDropdown());
  }

  toPrice(y, currentData = null) {
    // Framework-first: Use day range meter's coordinate system
    // This allows markers at ANY price on canvas, not just within ADR range

    const h = this.canvas.height;
    const padding = 5; // CRITICAL: Use 5px padding to match day range meter exactly

    // If we have current market data, use the adaptive scale from day range
    if (currentData && currentData.adrHigh && currentData.adrLow && currentData.current) {
      // Create minimal data object for calculateAdaptiveScale
      const scaleData = {
        adrHigh: currentData.adrHigh,
        adrLow: currentData.adrLow,
        high: currentData.high,
        low: currentData.low,
        current: currentData.current,
        open: currentData.open
      };

      // Use day range's adaptive scale which supports ANY price on canvas
      const config = { scaling: 'adaptive' };
      const adaptiveScale = calculateAdaptiveScale(scaleData, config);

      // Convert Y to price using the day range coordinate system
      const normalized = (h - padding - y) / (h - 2 * padding);
      return adaptiveScale.min + normalized * adaptiveScale.range;
    }

    // Fallback: Use the provided scale if available
    if (this.scale) {
      const { min, max } = this.scale;
      const normalized = (h - padding - y) / (h - 2 * padding);
      return min + normalized * (max - min);
    }

    // Last resort: Create a wide range that allows ANY price placement
    // Using a very wide range to ensure no artificial restrictions
    const defaultMin = 0.50000;
    const defaultMax = 1.50000;
    const normalized = (h - padding - y) / (h - 2 * padding);
    return defaultMin + normalized * (defaultMax - defaultMin);
  }

  handleMouseDown(e) {
    if (!e.altKey || e.button !== 0) return;
    const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
    const price = this.toPrice(relativeY, this.data);
    if (price) {
      // Round to pip level for meaningful marker placement
      const pipSize = this.data?.pipSize || 0.0001; // Default to EURUSD pip size
      const pipPosition = this.data?.pipPosition || 4;
      const roundedPrice = formatPriceToPipLevel(price, pipPosition, pipSize);

      const marker = createMarker('normal', roundedPrice, this.displayId);
      if (marker) {
        workspaceActions.addPriceMarker(this.displayId, marker);
      }
    }
  }

  handleMouseMove(e) {
    const altKey = e.altKey;
    this.canvas.style.cursor = altKey ? 'crosshair' : 'default';

    // If Alt is pressed, calculate hover price for preview line
    if (altKey) {
      const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
      const price = this.toPrice(relativeY, this.data);

      // Emit hover price event for parent components
      if (this.onHoverPrice) {
        this.onHoverPrice(price);
      }
    } else {
      // Clear hover price when Alt is released
      if (this.onHoverPrice) {
        this.onHoverPrice(null);
      }
    }
  }

  handleContextMenu(e) {
    if (!e.altKey) return; e.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const price = this.toPrice(y, this.data);
    if (price) {
      const state = workspaceStore.getState();
      const display = state.displays.get(this.displayId);

      // Use the same coordinate system as toPrice for consistency
      const h = this.canvas.height;
      const padding = 20;

      // Create scale function matching the toPrice implementation
      let scaleFunc;
      if (this.data && this.data.adrHigh && this.data.adrLow && this.data.current) {
        const scaleData = {
          adrHigh: this.data.adrHigh,
          adrLow: this.data.adrLow,
          high: this.data.high,
          low: this.data.low,
          current: this.data.current,
          open: this.data.open
        };
        const config = { scaling: 'adaptive' };
        const adaptiveScale = calculateAdaptiveScale(scaleData, config);
        scaleFunc = (price) => {
          const normalized = (price - adaptiveScale.min) / adaptiveScale.range;
          return h - padding - normalized * (h - 2 * padding);
        };
      } else if (this.scale) {
        const { min, max } = this.scale;
        scaleFunc = (price) => {
          const normalized = (price - min) / (max - min);
          return h - padding - normalized * (h - 2 * padding);
        };
      } else {
        // Use the same wide range as toPrice fallback
        const defaultMin = 0.50000;
        const defaultMax = 1.50000;
        scaleFunc = (price) => {
          const normalized = (price - defaultMin) / (defaultMax - defaultMin);
          return h - padding - normalized * (h - 2 * padding);
        };
      }

      const marker = getMarkerAtPosition(display?.priceMarkers || [], y, scaleFunc);
      if (marker) this.showDropdown(e.clientX, e.clientY, marker);
    }
  }

  showDropdown(x, y, marker) {
    this.hideDropdown();
    const d = document.createElement('div');
    d.className = 'price-marker-dropdown';
    d.style.cssText = `position:fixed;left:${x}px;top:${y}px;background:#1a1a1a;border:1px solid #333;border-radius:4px;padding:4px 0;z-index:10000;box-shadow:0 2px 8px rgba(0,0,0,0.3);min-width:120px;`;

    const opts = [{ l: 'Big', t: 'big' }, { l: 'Normal', t: 'normal' }, { l: 'Small', t: 'small' }, { l: 'Delete', t: 'delete' }];

    opts.forEach(o => {
      const i = document.createElement('div'); i.textContent = o.l;
      const c = o.t === marker.type.name ? '#4a9eff' : (o.t === 'delete' ? '#ff6b35' : '#fff');
      i.style.cssText = `padding:8px 16px;cursor:pointer;color:${c};font-size:13px;background:${o.t === marker.type.name ? '#4a9eff' : 'transparent'};`;
      i.onmouseenter = () => { if (o.t !== marker.type.name) i.style.backgroundColor = '#333'; };
      i.onmouseleave = () => { if (o.t !== marker.type.name) i.style.backgroundColor = 'transparent'; };
      i.onclick = () => { this.action(o.t, marker); this.hideDropdown(); }; d.appendChild(i);
    });

    document.body.appendChild(d); this.activeDropdown = d;
    const r = d.getBoundingClientRect(); if (r.right > window.innerWidth) d.style.left = `${x - r.width}px`;
    if (r.bottom > window.innerHeight) d.style.top = `${y - r.height}px`;
  }

  action(type, marker) {
    if (type === 'delete') workspaceActions.removePriceMarker(this.displayId, marker.id);
    else { const t = MARKER_TYPES[type.toUpperCase()]; if (t) workspaceActions.updatePriceMarker(this.displayId, marker.id, { type: t }); }
  }

  hideDropdown() { if (this.activeDropdown) { this.activeDropdown.remove(); this.activeDropdown = null; } }

  destroy() {
    this.hideDropdown();
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }
}

export function createPriceMarkerInteraction(canvas, displayId, data, scale) { return new PriceMarkerInteraction(canvas, displayId, data, scale); }