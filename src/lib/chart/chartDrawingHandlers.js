/**
 * Drawing event handlers: create, delete, lock, pin, clear, context menu.
 * Uses a factory pattern — pass chart + state deps at creation time.
 */

import { drawingStore } from './drawingStore.js';
import {
  CreateDrawingCommand,
  DeleteDrawingCommand,
} from './drawingCommands.js';

/**
 * Create drawing event handlers bound to chart state.
 *
 * @param {object} deps
 * @param {object|null} deps.chart - KLineChart instance
 * @param {object} deps.commandStack - DrawingCommandStack instance
 * @param {string} deps.currentSymbol - current symbol
 * @param {string} deps.currentResolution - current resolution
 * @param {object} deps.overlayMeta - overlayMeta instance
 * @param {function} deps.getDbIdForOverlay - (overlayId) => dbId|null
 * @param {function} deps.getOverlayCallbacks - () => { onSelected, onDeselected, onRightClick }
 */
export function createDrawingHandlers(deps) {
  function registerOverlayForInteraction(overlayId, persistPromise) {
    deps.overlayMeta.setPinned(overlayId, false);
    deps.chart.overrideOverlay({ id: overlayId, ...deps.getOverlayCallbacks() });
    if (persistPromise) {
      persistPromise.then(dbId => {
        deps.overlayMeta.setDbId(overlayId, dbId);
        const overlay = deps.chart.getOverlayById(overlayId);
        if (overlay) {
          const ext = overlay.extendData || {};
          deps.chart.overrideOverlay({ id: overlayId, extendData: { ...ext, _dbId: dbId } });
        }
      });
    }
  }

  async function handleDrawingCreated(event) {
    const { overlayId, overlayType, points, styles, extendData } = event.detail;
    const command = new CreateDrawingCommand(
      deps.chart, drawingStore, deps.currentSymbol, deps.currentResolution,
      overlayType, points, styles, extendData
    );
    command.overlayId = overlayId;
    deps.commandStack.execute(command);
    registerOverlayForInteraction(overlayId, command.persist());
  }

  function redoCreateCommand(cmd) {
    if (cmd?.overlayId && cmd.persist) registerOverlayForInteraction(cmd.overlayId, cmd.persist());
  }

  async function handleOverlayDelete(overlayId) {
    const overlay = deps.chart.getOverlayById(overlayId);
    if (!overlay) return;
    const dbId = deps.getDbIdForOverlay(overlayId);
    const serialized = {
      overlayId: overlay.id, overlayType: overlay.name,
      points: overlay.points, styles: overlay.styles, extendData: overlay.extendData,
    };
    const command = new DeleteDrawingCommand(
      deps.chart, drawingStore, deps.currentSymbol, deps.currentResolution,
      overlayId, dbId, serialized
    );
    deps.commandStack.execute(command);
    deps.overlayMeta.delete(overlayId);
  }

  async function handleOverlayToggleLock(overlayId) {
    const overlay = deps.chart.getOverlayById(overlayId);
    if (!overlay) return;
    const newLock = !overlay.lock;
    deps.chart.overrideOverlay({ id: overlayId, lock: newLock });
    const dbId = deps.getDbIdForOverlay(overlayId);
    if (dbId) await drawingStore.update(dbId, { locked: newLock });
    return newLock;
  }

  async function handleContextMenuTogglePin(overlayId, isPinned) {
    const dbId = deps.getDbIdForOverlay(overlayId);
    if (!dbId) return;
    const newPinned = !isPinned;
    await drawingStore.update(dbId, { pinned: newPinned });
    deps.overlayMeta.setPinned(overlayId, newPinned);
    return newPinned;
  }

  async function handleClearDrawings() {
    if (deps.chart) deps.chart.removeOverlay();
    await drawingStore.clearAll(deps.currentSymbol, deps.currentResolution);
    deps.commandStack.clear();
    deps.overlayMeta.clear();
  }

  return {
    registerOverlayForInteraction,
    handleDrawingCreated,
    redoCreateCommand,
    handleOverlayDelete,
    handleOverlayToggleLock,
    handleContextMenuTogglePin,
    handleClearDrawings,
  };
}
