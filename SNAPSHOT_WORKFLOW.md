# NeuroSense FX Snapshot Workflow

Simple git-based system for creating stable, immutable versions.

## Core Commands

```bash
./run.sh snapshot_save      # Create stable version from current build
./run.sh snapshot_show      # List all available snapshots
./run.sh snapshot_use <tag> # Switch to specific snapshot
./run.sh back_to_work       # Return to development
```

## When to Use Snapshots

**✅ Use Snapshots For:**
- Client demonstrations and presentations
- Production deployments
- Stable testing environments
- Known-good configurations for debugging

**🔄 Use Regular Development For:**
- Active coding and feature development
- Experimentation and prototyping
- Debugging with frequent changes
- Learning and exploration

## Complete Workflow Example

```bash
# 1. Prepare stable version
npm run build:prod
./run.sh snapshot_save
# Output: ✅ Saved as: stable-20251119-031607

# 2. Deploy for demo
./run.sh start

# 3. When done, return to development
./run.sh back_to_work
./run.sh dev
```

## Quick Reference

- **Snapshots are immutable** git tags - can't be accidentally overwritten
- **Build artifacts persist** across container rebuilds
- **Instant rollback** - `git checkout` back to any snapshot
- **Zero storage overhead** - uses git compression

## Troubleshooting

**No build found:**
```bash
npm run build:prod
```

**Invalid snapshot:**
```bash
./run.sh snapshot_show  # List available snapshots
```

**Can't return to work:**
```bash
git checkout main       # Fallback method
```

That's it. Simple, fast, reliable.