import { writable } from 'svelte/store';

// This function will manage the state of user-placed price markers.
function createMarkerStore() {
  const { subscribe, set, update } = writable([]);

  return {
    subscribe,
    // Adds a new marker at a specific price.
    // A simple unique ID is generated using the timestamp.
    add: (price) => {
      const newMarker = {
        id: Date.now(),
        price: price,
      };
      update(markers => [...markers, newMarker]);
    },
    // Removes a marker by its ID.
    remove: (id) => {
      update(markers => markers.filter(marker => marker.id !== id));
    },
    // Clears all markers from the store.
    clear: () => {
      set([]);
    }
  };
}

export const markerStore = createMarkerStore();
