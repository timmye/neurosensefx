// Market Profile Renderer - Crystal Clarity Compliant
// Orchestrator facade: delegates to specialized modules
// Maintains backward compatibility with original renderMarketProfile() signature

import { renderMarketProfile as renderMarketProfileOrchestrated, renderMarketProfileError } from './marketProfile/orchestrator.js';

export function renderMarketProfile(ctx, data, config) {
  renderMarketProfileOrchestrated(ctx, data, config);
}

export { renderMarketProfileError };