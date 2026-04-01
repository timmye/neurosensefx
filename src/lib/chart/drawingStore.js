import Dexie from 'dexie';

const db = new Dexie('NeuroSenseDrawings');
db.version(1).stores({
  drawings: '++id, [symbol+resolution], overlayType, createdAt',
});

export const drawingStore = {
  async save(symbol, resolution, drawing) {
    return db.drawings.add({
      ...drawing,
      symbol,
      resolution,
      schemaVersion: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },

  async load(symbol, resolution) {
    return db.drawings
      .where({ symbol, resolution })
      .toArray();
  },

  async update(id, changes) {
    return db.drawings.update(id, { ...changes, updatedAt: Date.now() });
  },

  async remove(id) {
    return db.drawings.delete(id);
  },

  async clearAll(symbol, resolution) {
    return db.drawings.where({ symbol, resolution }).delete();
  },
};
