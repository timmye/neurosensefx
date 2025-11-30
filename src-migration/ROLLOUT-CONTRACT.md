# Rollout Phase Contract

## For All Claude Code Sessions During Migration Rollout (Weeks 1-5)

**READ THIS BEFORE ROLLOUT TASKS. ACKNOWLEDGE UNDERSTANDING BEFORE PROCEEDING.**

---

## Context: We've Completed Shadow Implementation

✅ **Simple implementation complete**: src-simple/ contains 400 lines achieving three MUST HAVEs  
✅ **Principles validated**: Simple, Performant, Maintainable  
✅ **Ready for rollout**: Now we migrate users from old → new implementation

---

## Rollout Phase Principles

### The Goal Has Changed

**Implementation Phase** (Session 1-5):
- Build the simplest possible code
- Strict line limits
- Zero abstractions

**Rollout Phase** (Week 1-5):  
- Safely migrate users to simple implementation
- Temporary infrastructure for migration
- Acceptable to add complexity that gets deleted in Week 5

### New Principles for Rollout

**Safe**
- No data loss during migration
- Instant rollback capability
- Gradual exposure to reduce risk

**Observable**
- Track what's working and what's not
- Compare old vs new behavior
- Evidence-based decision making

**Temporary**
- Migration code will be deleted in Week 5
- Don't over-engineer, it's temporary
- Good enough > perfect (it's getting deleted anyway)

---

## Directory Structure During Rollout

```
neurosense-fx/
├── src/                    ← OLD implementation (read-only)
│   └── [30,000+ lines]
│
├── src-simple/             ← NEW implementation (protected)
│   └── [400 lines]         ← STILL follows original CONTRACT.md
│
├── src-migration/          ← ROLLOUT infrastructure (work here)
│   ├── FeatureRouter.svelte
│   ├── FeatureFlags.js
│   ├── StateBridge.js
│   ├── CanaryController.js
│   ├── MetricsCollector.js
│   ├── ErrorTracker.js
│   ├── ComparisonView.svelte
│   └── AnalyticsDashboard.svelte
│
└── docs/crystal-clarity/   ← DOCUMENTATION (generate here)
    └── [task reports]
```

### Working Rules for Rollout

**src-simple/** (PROTECTED)
- ❌ DO NOT MODIFY during rollout
- If bugs found → note in docs, fix AFTER rollout complete
- Original CONTRACT.md still applies here
- Line limits still enforced

**src-migration/** (ACTIVE WORK)
- ✅ Build migration infrastructure here
- ✅ Monitoring, metrics, error tracking allowed
- ✅ Abstractions acceptable (temporary)
- ⚠️ Keep reasonable - it gets deleted Week 5

**src/** (READ-ONLY)
- ❌ DO NOT MODIFY old implementation
- Only read for integration points
- Will be archived in Week 5

**docs/crystal-clarity/** (REQUIRED)
- ✅ Generate report after every task
- Document decisions, metrics, issues
- Evidence trail for rollout decisions

---

## Line Count Guidelines for Rollout

### No Hard Limits, But Keep Reasonable

**Migration files should be:**
- Under 200 lines each (guideline, not hard limit)
- Single responsibility per file
- Simple enough to delete without regret in Week 5

**If you're writing 500+ line migration files:**
- Stop and ask: "Is this temporary or permanent?"
- If temporary → probably over-engineering
- If permanent → belongs in src-simple, not src-migration

### Acceptable Complexity for Migration

**These are OK during rollout:**
```javascript
// ✅ OK: Metrics collection (temporary)
class MetricsCollector {
  trackInteraction(action, latency) { /* ... */ }
  trackError(error, context) { /* ... */ }
  flush() { /* ... */ }
}

// ✅ OK: User cohort assignment (temporary)
class CanaryController {
  shouldUseNewImplementation(userId) { /* ... */ }
  hashUserId(userId) { /* ... */ }
}

// ✅ OK: State migration (temporary)
class StateBridge {
  migrateOldToNew(oldState) { /* ... */ }
  migrateNewToOld(newState) { /* ... */ }
}

// ✅ OK: Analytics dashboard (temporary)
<AnalyticsDashboard>
  {#each metrics as metric}
    <MetricCard {metric} />
  {/each}
</AnalyticsDashboard>
```

**These are NOT OK even during rollout:**
```javascript
// ❌ NOT OK: Building new features in migration code
class AdvancedLayoutEngine { /* ... */ }

// ❌ NOT OK: Modifying simple implementation
// In src-simple/components/FloatingDisplay.svelte
+ import { PerformanceMonitor } from '../../migration/...';

// ❌ NOT OK: Permanent infrastructure in migration
// This should be in src-simple if it's staying
class PermanentUserService { /* ... */ }
```

---

## Decision Framework for Rollout Tasks

Before writing rollout code, answer:

### 1. Is This Migration Infrastructure?
- User cohort assignment → YES (src-migration/)
- Metrics collection → YES (src-migration/)
- Side-by-side comparison → YES (src-migration/)
- New feature for displays → NO (wrong phase, defer)

### 2. Will This Be Deleted in Week 5?
- If YES → src-migration/ (acceptable complexity)
- If NO → src-simple/ (follows original CONTRACT.md)
- If UNSURE → Ask before implementing

### 3. Does This Risk User Data?
- State migration → HIGH RISK (test thoroughly)
- Metrics collection → LOW RISK (fails safely)
- Feature flags → MEDIUM RISK (test switching)

### 4. Can This Block Rollback?
- FeatureRouter → If broken, can't rollback (CRITICAL)
- Analytics dashboard → Broken doesn't block rollback (LOW PRIORITY)
- ErrorTracker → Broken is ironic but not blocking (MEDIUM PRIORITY)

---

## Testing Requirements for Rollout

### Every Migration File Must Be Testable

**Manual testing minimum:**
```javascript
// Example: FeatureFlags.js
// Manual test cases:
// 1. Set ?impl=old → old implementation loads
// 2. Set ?impl=new → new implementation loads
// 3. Set ?impl=both → side-by-side loads
// 4. localStorage override works
// 5. User cohort assignment deterministic
```

**Document testing in task .md:**
```markdown
## Testing Performed

### FeatureFlags.js
- [x] URL parameters work
- [x] localStorage override works
- [x] Default behavior correct
- [ ] Edge case: malformed userId (ISSUE: crashes, deferred)

### Issues Found
- BLOCKING: None
- NON-BLOCKING: Edge case crash with malformed userId
- Status: Documented, deferred to post-rollout
```

---

## Rollout-Specific Patterns

### Pattern 1: Feature Flags (Control Implementation)

```javascript
// src-migration/FeatureFlags.js
export class FeatureFlags {
  getImplementation() {
    // Priority: URL > localStorage > cohort assignment
    const urlParam = new URLSearchParams(window.location.search).get('impl');
    if (urlParam) return urlParam;
    
    const forced = localStorage.getItem('force-impl');
    if (forced) return forced;
    
    return this.assignCohort();
  }
}
```

**Guidelines:**
- Always have manual override (localStorage)
- Always have testing override (URL param)
- Deterministic cohort assignment (same user → same implementation)

### Pattern 2: State Bridge (Compatibility Layer)

```javascript
// src-migration/StateBridge.js
export class StateBridge {
  loadState() {
    const version = localStorage.getItem('impl-version');
    const state = JSON.parse(localStorage.getItem('workspace-state'));
    
    // Migrate if needed
    if (version === 'old') {
      return this.migrateOldToNew(state);
    }
    return state;
  }
  
  migrateOldToNew(oldState) {
    // Extract ONLY what simple implementation needs
    // Drop all the over-engineered stuff
  }
}
```

**Guidelines:**
- Bidirectional migration (old↔new)
- Test data loss scenarios
- Handle missing/corrupt data gracefully

### Pattern 3: Metrics Collection (Observability)

```javascript
// src-migration/MetricsCollector.js
export class MetricsCollector {
  record(metric) {
    metric.implementation = this.implementation; // 'old' or 'new'
    metric.timestamp = Date.now();
    this.metrics.push(metric);
    
    // Batch to avoid overwhelming storage
    if (this.metrics.length >= 10) {
      this.flush();
    }
  }
}
```

**Guidelines:**
- Tag everything with implementation version
- Batch to avoid performance impact
- Fail silently (metrics shouldn't break app)

### Pattern 4: Error Tracking (Safety Net)

```javascript
// src-migration/ErrorTracker.js
export class ErrorTracker {
  setupGlobalHandler() {
    window.addEventListener('error', (event) => {
      this.captureError({
        message: event.message,
        implementation: this.implementation,
        userId: this.getUserId()
      });
    });
  }
}
```

**Guidelines:**
- Always tag with implementation version
- Never throw errors from error tracker (ironic)
- Store locally AND send to backend if available

---

## Documentation Requirements

### Every Task Must Generate a Report

**Required sections in every task .md file:**

```markdown
# [Week X - Task Y]: [Task Name]

## Task Completed
- [x] File 1 created
- [x] File 2 created
- [ ] File 3 (ISSUE: blocked by X)

## Files Created/Modified
- src-migration/FeatureFlags.js (87 lines)
- src-migration/FeatureRouter.svelte (45 lines)

## Testing Performed
- [x] Manual test 1
- [x] Manual test 2
- [ ] Manual test 3 (FAILED: reason)

## Issues Found
### Blocking
- None

### Non-Blocking
- Issue 1: [description]
- Issue 2: [description]

## Decisions Made
1. Decision: [what]
   Rationale: [why]

## Metrics/Results
[If applicable: performance numbers, error counts, etc.]

## Next Steps
- Ready for next task: YES/NO
- If NO, what needs fixing: [description]

## Status
READY / BLOCKED / NEEDS_DEBUG
```

---

## Decision Points (Go/No-Go)

### Week 1 Task 6: Ready for Canary?

**Required for GO:**
- ✅ Side-by-side comparison works
- ✅ State migration works bidirectionally
- ✅ No data loss in testing
- ✅ Three MUST HAVEs work in new implementation
- ✅ Performance meets targets

**NO-GO if:**
- ❌ Critical bugs in new implementation
- ❌ Data loss occurring
- ❌ Performance regression >50ms
- ❌ State migration broken

### Week 2 Task 5: Ready to Expand?

**Required for GO:**
- ✅ Error rates similar or lower (new vs old)
- ✅ No critical bugs in canary cohort
- ✅ Performance stable
- ✅ No user complaints

**NO-GO if:**
- ❌ Error rate spike in new implementation
- ❌ Critical bugs affecting users
- ❌ Data corruption detected
- ❌ Performance degradation

### Weeks 3-4: Ready to Expand Each Stage?

**Same criteria as Week 2, but at scale**

### Week 5 Task 1: Ready for Cleanup?

**Required for GO:**
- ✅ 100% rollout stable for 3+ days
- ✅ No critical bugs reported
- ✅ Error rates acceptable
- ✅ Team consensus: safe to cleanup

**NO-GO if:**
- ❌ Any instability
- ❌ Error rate concerns
- ❌ Team not confident

---

## Emergency Procedures

### If Critical Issue During Rollout

**1. Immediate Rollback (Don't investigate first)**
```javascript
// In browser console or via deployment
localStorage.setItem('force-impl', 'old');
// Or update CanaryController to 0%
```

**2. Document Incident**
```markdown
# INCIDENT: [Date/Time]

## What Happened
[Description of issue]

## Impact
- Users affected: [number/%]
- Severity: CRITICAL / HIGH / MEDIUM
- Data loss: YES / NO

## Response
- Rollback executed: [timestamp]
- Time to rollback: [minutes]
- Users restored: [timestamp]

## Root Cause
[Investigation results]

## Prevention
[What we'll do differently]
```

**3. Fix and Re-attempt**
- Fix in src-simple/
- Re-run validation
- Attempt rollout again

---

## Week 5 Cleanup Principles

### When Deleting Migration Code

**Delete completely:**
- src-migration/ entire directory
- All feature flag conditionals
- All metrics collection code
- All error tracking specific to rollout
- All canary/cohort assignment code

**Keep/migrate to src-simple:**
- Bug fixes discovered during rollout
- Performance improvements discovered
- Any "permanent" features accidentally built in migration

**Archive for reference:**
- docs/crystal-clarity/ → docs/archive/crystal-clarity/
- Migration code → reference if needed again
- Metrics/reports → historical record

---

## Acknowledgment for Rollout Tasks

**Before starting any rollout task, respond with:**

```
I acknowledge the Rollout Phase Contract:
- I will work in src-migration/ for temporary infrastructure
- I will NOT modify src-simple/ (protected during rollout)
- I will generate documentation in docs/crystal-clarity/
- I understand migration code will be deleted in Week 5
- I will test thoroughly (user data is at risk)
- I will document all decisions and issues

Current task: [describe task]
Phase: Week [X] Task [Y]
Working directory: src-migration/
Expected files: [list]
Documentation output: docs/crystal-clarity/[filename]
```

---

## The Golden Rules for Rollout

> **1. Protect src-simple/** - It's proven to work. Don't break it.
> 
> **2. Migration code is temporary** - Don't over-engineer what you'll delete.
> 
> **3. User data is sacred** - Test state migration thoroughly.
> 
> **4. Document everything** - Decisions need evidence trail.
> 
> **5. When in doubt, rollback** - Safety over progress.

---

## Summary: Two Contracts for Two Phases

**Implementation Phase** (Sessions 1-5):
- Use: src-simple/CONTRACT.md
- Goal: Build the simplest possible code
- Rules: Strict line limits, zero abstractions

**Rollout Phase** (Weeks 1-5):
- Use: src-migration/ROLLOUT-CONTRACT.md (this file)
- Goal: Safely migrate users to simple implementation
- Rules: Temporary infrastructure, protect src-simple, document everything

Both phases share the core principle: **Simple, Performant, Maintainable**  
But rollout adds: **Safe, Observable, Temporary**

---

**This contract exists because**: Rollout requires different trade-offs than implementation. We accept temporary complexity (metrics, monitoring, migration) to safely transition users. In Week 5, we delete it all and return to crystal clarity.