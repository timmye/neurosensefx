# Migration Layer

This directory contains the integration layer for gradually migrating from the complex implementation to the simple implementation.

## Purpose

- Test simple implementation alongside existing system
- Validate feature parity
- Enable gradual rollout with instant rollback

## Strategy

1. Feature flags control which implementation renders
2. Both implementations can run simultaneously
3. Compare behavior side-by-side
4. Switch production traffic gradually

## Files

- `FeatureFlags.js`: Configuration for feature toggles
- `FeatureRouter.svelte`: Routes to old/new implementation