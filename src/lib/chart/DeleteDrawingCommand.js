/**
 * Delete drawing command for the undo/redo stack.
 *
 * Removes an overlay from the chart and its persisted record from the store.
 * Undo re-creates the overlay from the serialized snapshot and re-persists it.
 *
 * @module DeleteDrawingCommand
 */

export class DeleteDrawingCommand {
  constructor(chart, store, symbol, resolution, overlayId, serializedOverlay, callbacks) {
    this.chart = chart;
    this.store = store;
    this.symbol = symbol;
    this.resolution = resolution;
    this.overlayId = overlayId;
    this.serializedOverlay = serializedOverlay;
    this.callbacks = callbacks;
  }

  execute() {
    this.chart.removeOverlay({ id: this.overlayId });
    this.store.remove(this.overlayId);
  }

  async undo() {
    const opts = {
      name: this.serializedOverlay.overlayType,
      id: this.serializedOverlay.overlayId,
      points: this.serializedOverlay.points,
      styles: this.serializedOverlay.styles,
    };
    if (this.serializedOverlay.extendData != null) opts.extendData = this.serializedOverlay.extendData;
    this.chart.createOverlay(opts);

    // Attach interaction callbacks (includes onPressedMoveEnd)
    if (this.callbacks) {
      this.chart.overrideOverlay({
        id: this.serializedOverlay.overlayId,
        ...this.callbacks,
      });
    }

    // Re-persist to IndexedDB so overlay has backing data after undo
    if (this.symbol && this.resolution) {
      await this.store.save(
        this.symbol,
        this.resolution,
        {
          overlayId: this.serializedOverlay.overlayId,
          overlayType: this.serializedOverlay.overlayType,
          points: this.serializedOverlay.points,
          styles: this.serializedOverlay.styles,
          extendData: this.serializedOverlay.extendData,
          pinned: this.serializedOverlay.pinned,
          locked: this.serializedOverlay.locked,
        }
      );
    }
  }
}
