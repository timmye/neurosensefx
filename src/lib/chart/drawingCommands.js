export class DrawingCommandStack {
  constructor(maxDepth = 50) {
    this.undoStack = [];
    this.redoStack = [];
    this.maxDepth = maxDepth;
  }

  execute(command) {
    command.execute();
    this.undoStack.push(command);
    this.redoStack = [];
    if (this.undoStack.length > this.maxDepth) this.undoStack.shift();
  }

  undo() {
    const cmd = this.undoStack.pop();
    if (cmd) {
      cmd.undo();
      this.redoStack.push(cmd);
    }
  }

  redo() {
    const cmd = this.redoStack.pop();
    if (cmd) {
      cmd.execute();
      this.undoStack.push(cmd);
    }
  }

  get canUndo() {
    return this.undoStack.length > 0;
  }

  get canRedo() {
    return this.redoStack.length > 0;
  }

  clear() {
    this.undoStack = [];
    this.redoStack = [];
  }
}

export class CreateDrawingCommand {
  constructor(chart, store, symbol, resolution, overlayType, points, styles) {
    this.chart = chart;
    this.store = store;
    this.symbol = symbol;
    this.resolution = resolution;
    this.overlayType = overlayType;
    this.points = points;
    this.styles = styles;
    this.overlayId = null;
    this.dbId = null;
  }

  execute() {
    this.overlayId = this.chart.createOverlay({
      name: this.overlayType,
      points: this.points,
      styles: this.styles,
      onDrawEnd: null,
    });
  }

  async persist() {
    if (this.overlayId) {
      this.dbId = await this.store.save(this.symbol, this.resolution, {
        overlayId: this.overlayId,
        overlayType: this.overlayType,
        points: this.points,
        styles: this.styles,
      });
    }
  }

  undo() {
    if (this.overlayId) {
      this.chart.removeOverlay({ id: this.overlayId });
    }
    if (this.dbId) {
      this.store.remove(this.dbId);
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
    this.chart.createOverlay({
      name: this.serializedOverlay.overlayType,
      id: this.serializedOverlay.overlayId,
      points: this.serializedOverlay.points,
      styles: this.serializedOverlay.styles,
    });
  }
}
