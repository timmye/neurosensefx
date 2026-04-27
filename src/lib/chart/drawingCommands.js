/**
 * Command pattern for drawing undo/redo.
 *
 * DrawingCommandStack manages the undo/redo stacks.
 * CreateDrawingCommand handles creation and persistence.
 * DeleteDrawingCommand is extracted to DeleteDrawingCommand.js.
 *
 * @module drawingCommands
 */

import { writable, derived } from 'svelte/store';
import { DeleteDrawingCommand } from './DeleteDrawingCommand.js';

export { DeleteDrawingCommand };

export class DrawingCommandStack {
  constructor(maxDepth = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxDepth = maxDepth;
    this._update = writable(0);
    this.canUndo = derived(this._update, () => this.undoStack.length > 0);
    this.canRedo = derived(this._update, () => this.redoStack.length > 0);
  }

  _notify() {
    this._update.set(n => n + 1);
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
    this._notify();
  }

  async undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      try {
        await cmd.undo();
        this.redoStack.push(cmd);
      } catch (e) {
        this.undoStack.push(cmd);
        throw e;
      }
      this._notify();
    }
  }

  async redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      try {
        await cmd.execute();
        this.undoStack.push(cmd);
      } catch (e) {
        this.redoStack.push(cmd);
        throw e;
      }
      this._notify();
    }
    return cmd;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
    this._notify();
  }
}

export class CreateDrawingCommand {
  constructor(chart, store, symbol, resolution, overlayType, points, styles, extendData, pinned = false) {
    this.chart = chart;
    this.store = store;
    this.symbol = symbol;
    this.resolution = resolution;
    this.overlayType = overlayType;
    this.points = points;
    this.styles = styles;
    this.extendData = extendData;
    this.pinned = pinned;
    this.overlayId = null;
  }

  execute() {
    if (!this.overlayId) {
      const opts = {
        name: this.overlayType,
        points: this.points,
        styles: this.styles,
        onDrawEnd: null,
      };
      if (this.extendData != null) opts.extendData = this.extendData;
      this.overlayId = this.chart.createOverlay(opts);
    }
  }

  async persist() {
    if (this.overlayId) {
      const data = {
        overlayId: this.overlayId,
        overlayType: this.overlayType,
        points: this.points,
        styles: this.styles,
      };
      if (this.extendData != null) data.extendData = this.extendData;
      if (this.pinned != null) data.pinned = this.pinned;
      await this.store.save(this.symbol, this.resolution, data);
    }
  }

  undo() {
    if (this.overlayId) {
      this.chart.removeOverlay({ id: this.overlayId });
      this.store.remove(this.overlayId);
      this.overlayId = null;
    }
  }
}
