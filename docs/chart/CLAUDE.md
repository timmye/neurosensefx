# docs/chart/

Chart architecture, drawing system, x-axis design, and debugging documentation.

## Files

| File | What | When to read |
| ---- | ---- | ------------ |
| `kline-knowledge-base.md` | Comprehensive KLineChart library knowledge base | Onboarding to chart system, looking up library behavior |
| `chart-time-windows-and-axis.md` | Time window presets and x-axis architecture | Understanding zoom presets, modifying time windows |
| `x-axis-custom-axis-design.md` | Custom calendar-boundary x-axis design | Understanding x-axis design decisions, modifying tick alignment |
| `indicators.md` | Custom indicator registrations and configuration | Adding or modifying chart indicators |
| `undo-redo-and-drawing-commands.md` | Drawing undo/redo command pattern design | Understanding undo/redo architecture, adding command types |
| `persistence-scope.md` | Drawing persistence scoping rules (symbol+resolution vs pinned) | Modifying drawing scope, debugging persistence |
| `multi-select-drawings.md` | Multi-select drawing interaction design | Implementing multi-select, modifying selection behavior |
| `cross-timeframe-drawing-visibility.md` | Drawing visibility across timeframe switches | Understanding pinned drawing display rules |
| `chart-drawing-system-audit.md` | Drawing system quality audit | Reviewing drawing system architecture, identifying issues |
| `chart-module-quality-audit.md` | Chart module quality audit findings | Assessing chart code quality, planning improvements |
| `timezone-architecture.md` | Timezone handling architecture | Understanding timezone store, formatter caching |
| `timezone-display-change.md` | Timezone display change impact analysis | Changing timezone labels, assessing scope |
| `blurry-render-on-load-diagnosis.md` | Root cause analysis of blurry chart on load | Debugging blurry rendering, understanding resize coalescing |
| `drawing-position-corruption-diagnosis.md` | Root cause analysis of drawing position corruption | Debugging drawing position bugs |
