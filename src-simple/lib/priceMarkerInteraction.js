// Price Marker Interaction System - Crystal Clarity: Simple, Performant, Maintainable
// Framework-first: Direct DOM APIs, no custom libraries

import { workspaceActions, workspaceStore } from '../stores/workspace.js';
import { createMarker, getMarkerAtPosition } from './priceMarkers.js';
import { toPrice, createPriceScale } from './priceMarkerCoordinates.js';
import { showDropdown } from './priceMarkerDropdown.js';
import { formatPriceToPipLevel } from './priceFormat.js';
import { getYCoordinate } from './dayRangeCalculations.js';

export class PriceMarkerInteraction {
  constructor(canvas, displayId, data, scale) {
    this.canvas = canvas;
    this.displayId = displayId;
    this.scale = scale;
    this.data = data;
    this.activeDropdown = null;
    this.init();
  }

  updateData(data) {
    this.data = data;
  }

  init() {
    this.canvas.addEventListener('mousedown', e => this.handleMouseDown(e));
    this.canvas.addEventListener('mousemove', e => this.handleMouseMove(e));
    this.canvas.addEventListener('contextmenu', e => this.handleContextMenu(e));
    document.addEventListener('keydown', e => e.key === 'Escape' && this.hideDropdown());
  }

  handleMouseDown(e) {
    if (!e.altKey || e.button !== 0) return;
    const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
    const price = toPrice(this.canvas, this.scale, this.data, relativeY);
    if (price) {
      const pipSize = this.data?.pipSize || 0.0001;
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

    if (altKey) {
      const relativeY = e.clientY - this.canvas.getBoundingClientRect().top;
      const price = toPrice(this.canvas, this.scale, this.data, relativeY);
      if (this.onHoverPrice) {
        this.onHoverPrice(price);
      }
    } else {
      if (this.onHoverPrice) {
        this.onHoverPrice(null);
      }
    }
  }

  handleContextMenu(e) {
    if (!e.altKey) return;
    e.preventDefault();

    const rect = this.canvas.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const price = toPrice(this.canvas, this.scale, this.data, y);

    if (price) {
      const state = workspaceStore.getState();
      const display = state.displays.get(this.displayId);
      const scale = createPriceScale(this.canvas, this.scale, this.data);
      const marker = getMarkerAtPosition(display?.priceMarkers || [], y, scale);
      if (marker) {
        this.activeDropdown = showDropdown(e.clientX, e.clientY, marker, this.displayId);
      }
    }
  }

  hideDropdown() {
    if (this.activeDropdown) {
      this.activeDropdown.remove();
      this.activeDropdown = null;
    }
  }

  destroy() {
    this.hideDropdown();
    this.canvas.removeEventListener('mousedown', this.handleMouseDown);
    this.canvas.removeEventListener('mousemove', this.handleMouseMove);
    this.canvas.removeEventListener('contextmenu', this.handleContextMenu);
  }
}

export function createPriceMarkerInteraction(canvas, displayId, data, scale) {
  return new PriceMarkerInteraction(canvas, displayId, data, scale);
}