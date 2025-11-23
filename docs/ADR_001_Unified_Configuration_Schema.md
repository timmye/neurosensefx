# ADR: Unified Configuration Schema Architecture

## Status
Accepted - 2025-11-23

## Context
NeuroSense FX had 85+ configuration parameters across multiple visualization components with inconsistent validation, no standardization, and complex inheritance patterns. Adding new features required changes in multiple files with no centralized parameter management.

## Decision
We implemented a unified configuration schema with 31 essential parameters using percentage-based scaling, group organization, and runtime inheritance. The system uses Zod validation, environment-aware persistence, and automatic defaults for new displays.

## Consequences
**Benefits:**
- 63% reduction in parameter complexity (85+ → 31 parameters)
- Standardized percentage-based scaling eliminates magic numbers
- Runtime inheritance provides consistent behavior for new displays
- Group-based organization enables logical UI organization
- Schema validation prevents configuration errors

**Tradeoffs:**
- Centralized schema requires careful parameter selection
- Percentage scaling requires mental conversion for pixel values
- Single global config per display (removed per-display overrides)

## Implementation
1. Created visualizationSchema.js with ESSENTIAL_PARAMETERS and CONFIG_GROUPS
2. Implemented configDefaults.js for factory defaults and user modifications
3. Extended displayStore.js to use getEssentialDefaultConfig()
4. Added environment-aware persistence in workspacePersistence.js
5. Validated all parameters against Zod schemas for type safety

The configuration system now provides predictable, validated, and consistent parameter management across all visualization components.