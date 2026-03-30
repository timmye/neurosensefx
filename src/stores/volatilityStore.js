import { writable } from 'svelte/store';

export const volatilityStore = writable({
  sigma: 0,
  maxZone: 0,
  ewmaVelocity: 0,
  range: 0,
  smoothedSigma: 0,
  smoothedMaxZone: 0,
  smoothedVelocity: 0,
  smoothedRange: 0,
  perBasket: {},
  ready: false
});
