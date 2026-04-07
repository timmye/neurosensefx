import { writable, derived } from 'svelte/store';

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

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
      this._notify();
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
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
    this.dbId = null;
  }

  execute() {
    // During initial creation the overlay already exists (created by user drawing).
    // execute() is only called by redo(), which needs to re-create it.
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
      return this.dbId = await this.store.save(this.symbol, this.resolution, data);
    }
  }

  undo() {
    if (this.overlayId) {
      this.chart.removeOverlay({ id: this.overlayId });
      this.overlayId = null; // clear so redo() knows to re-create
    }
    if (this.dbId) {
      this.store.remove(this.dbId);
      this.dbId = null;
    }
  }
}

export class DeleteDrawingCommand {
  constructor(chart, store, overlayId, dbId, serializedOverlay) {
    this.chart = chart;
    this.store = store;
    this.overlayId = overlayId;
    this.dbId = dbId;
    this.serializedOverlay = serializedOverlay;
  }

  execute() {
    this.chart.removeOverlay({ id: this.overlayId });
    if (this.dbId) {
      this.store.remove(this.dbId);
    }
  }

  undo() {
    const opts = {
      name: this.serializedOverlay.overlayType,
      id: this.serializedOverlay.overlayId,
      points: this.serializedOverlay.points,
      styles: this.serializedOverlay.styles,
    };
    if (this.serializedOverlay.extendData != null) opts.extendData = this.serializedOverlay.extendData;
    this.chart.createOverlay(opts);
  }
}
