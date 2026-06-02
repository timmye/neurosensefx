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
    this.pinned = serializedOverlay.pinned ?? false;
    this.locked = serializedOverlay.locked ?? false;
  }

  execute() {
    this.chart.removeOverlay({ id: this.overlayId });
    this.store.remove(this.overlayId);
  }

  async undo() {
    const s = this.serializedOverlay;
    // Validate required fields before re-creating overlay
    if (!s.overlayType || !s.overlayId || !s.points || !Array.isArray(s.points)) {
      const msg = '[DeleteDrawingCommand.undo] Invalid serializedOverlay — missing required fields: ' +
        JSON.stringify({ overlayType: s.overlayType, overlayId: s.overlayId, hasPoints: !!s.points });
      console.warn(msg);
      return;
    }
    const opts = {
      name: s.overlayType,
      id: s.overlayId,
      points: s.points,
      styles: s.styles,
    };
    if (s.extendData != null) opts.extendData = s.extendData;
    this.chart.createOverlay(opts);

    // Attach interaction callbacks (includes onPressedMoveEnd)
    if (this.callbacks) {
      this.chart.overrideOverlay({
        id: s.overlayId,
        ...this.callbacks,
      });
    }

    // Restore pinned/locked state
    if (this.locked) {
      this.chart.overrideOverlay({ id: s.overlayId, lock: true });
    }

    // Re-persist to IndexedDB so overlay has backing data after undo
    if (this.symbol && this.resolution) {
      await this.store.save(
        this.symbol,
        this.resolution,
        {
          overlayId: s.overlayId,
          overlayType: s.overlayType,
          points: s.points,
          styles: s.styles,
          extendData: s.extendData,
          pinned: s.pinned,
          locked: s.locked,
        }
      );
    }
  }
}
