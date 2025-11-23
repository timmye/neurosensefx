# Web Worker Examples

## Basic Worker Setup

example_createDisplayWithWorker:
    # Create new display with automatic worker creation
    import { displayActions } from '../stores/displayStore.js';

    # Display gets unique ID and worker is created automatically
    displayId = displayActions.addDisplay('EUR/USD', { x: 100, y: 100 })

    # Worker initialization follows sequential pattern
    # to prevent race conditions

    # Expected outcome:
    # - Display created with unique workerKey: "EUR/USD-display-123"
    # - Worker instantiated and ready for initialization

example_workerConfiguration:
    # Global configuration updates propagate to all workers
    import { displayActions } from '../stores/displayStore.js';

    # Update parameter - automatically sent to all workers
    displayActions.updateGlobalConfig('volatilityMode', 'enhanced')

    # Each worker receives: { type: 'updateConfig', payload: {...} }
    # Workers recalculate immediately with new settings

    # Expected outcome:
    # - All displays update with new volatility calculation
    # - Configuration persists across sessions

example_workerCleanup:
    # Worker lifecycle tied to display lifecycle
    import { displayActions } from '../stores/displayStore.js';

    # Removing display automatically cleans up worker
    displayActions.removeDisplay(displayId)

    # Worker termination prevents memory leaks
    # workerKey removed from workers Map

    # Expected outcome:
    # - Worker terminated cleanly
    # - No memory leaks from orphaned workers

## Error Handling Patterns

example_workerErrorHandling:
    # Workers implement defensive programming
    # State validation prevents crashes during initialization

    if (!state || !state.ready) {
        console.warn('[WORKER] Initialization incomplete, skipping operation')
        return
    }

    # Expected outcome:
    # - Graceful handling of race conditions
    # - System stability during rapid state changes