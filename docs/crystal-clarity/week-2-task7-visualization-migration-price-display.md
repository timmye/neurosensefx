# Week [X] Task [Y]: [Visualization Name] Migration Template
## Crystal Clarity Visualization Migration Framework

**Timeline**: [X] hours across [N] sessions
**Prerequisites**: Crystal Clarity Foundation complete
**Source**: `src/lib/viz/[legacyFile].js` ([XXX] lines)
**Target**: Crystal Clarity compliant implementation (Est. [YYY] lines)

---

## Task Objectives

### Primary Objective
**Complete Visual Migration**: Achieve 100% visual parity of legacy [Visualization Name] with Crystal Clarity compliant implementation.

### Secondary Objectives
1. **Visual Analysis**: Systematic extraction of all visual elements from legacy implementation
2. **Gap Analysis**: Comprehensive comparison between legacy and simple implementations
3. **Translation Strategy**: Framework-first translation of all visual elements
4. **Performance Validation**: Ensure 60fps rendering with sub-100ms latency
5. **Crystal Clarity Compliance**: Maintain simplicity principles throughout implementation

---

## Migration Workflow Structure

### Phase 1: Visual Analysis & Planning (2 hours)
**Focus**: Extract and catalog every visual element from legacy implementation

#### Session 1: Visual Element Extraction
**File to Analyze**: `src/lib/viz/[legacyFile].js`

**Visual Element Categories to Extract**:

##### 1. Structural Elements
```markdown
- [ ] Core layout and positioning system
- [ ] Axis/grid implementation
- [ ] Reference lines and boundaries
- [ ] Dimension and scaling logic
```

##### 2. Data Visualization Elements
```markdown
- [ ] Primary data rendering method
- [ ] Secondary indicators and overlays
- [ ] Interactive/hover states
- [ ] Real-time update mechanisms
```

##### 3. Typography & Text Elements
```markdown
- [ ] Font specifications and styling
- [ ] Text positioning and alignment
- [ ] Label formatting and content
- [ ] Color coding system
```

##### 4. Interactive & Dynamic Elements
```markdown
- [ ] User interaction handling
- [ ] Responsive scaling behavior
- [ ] Configuration-driven features
- [ ] Animation or transition effects
```

##### 5. Color & Styling System
```markdown
- [ ] Complete color palette
- [ ] Line widths and styles
- [ ] Background fills and patterns
- [ ] Opacity and transparency usage
```

#### Session 2: Gap Analysis & Translation Strategy
**Compare Legacy vs Simple Implementation**:

```markdown
## Visual Feature Comparison Matrix

| Visual Element | Legacy Implementation | Simple Implementation | Gap Status |
|---------------|---------------------|----------------------|------------|
| [Element 1] | [Legacy approach] | [Current simple approach] | [Status] |
| [Element 2] | [Legacy approach] | [Current simple approach] | [Status] |
| ... | ... | ... | ... |
```

**Translation Strategy**:
For each visual element, document:
```markdown
## Visual Element: [Element Name]
**Legacy Implementation**: [Complex approach description]
**Simple Translation**: [Framework-first approach using Canvas 2D API]
**Crystal Clarity Compliance**: [How it maintains simplicity principles]
**Function Breakdown**: [Specific functions needed, <15 lines each]
**File Structure**: [Where in simple repo this belongs]
```

### Phase 2: Technical Implementation (3-6 hours)
**Focus**: Implement visual parity enhancements based on Phase 1 analysis

#### Session [N]: [Specific Implementation Focus]
**File**: `[targetFile].js` ([current] → [target] lines [+delta] lines)

**Implementation Examples**:
```javascript
// Crystal Clarity compliant implementation pattern
export function [functionName](ctx, config, [params]) {
  const dpr = window.devicePixelRatio || 1;

  ctx.save();
  // Implementation following Crystal Clarity principles
  ctx.restore();
}
```

**Configuration Integration**:
```javascript
// Enhanced configuration based on Phase 1 analysis
export const defaultConfig = {
  colors: {
    // Complete color palette from Phase 1 catalog
  },
  fonts: {
    // Typography specifications
  },
  positioning: {
    // Layout and alignment parameters
  },
  features: {
    // Feature toggles and settings
  }
};
```

#### Critical Issue Resolution Pattern
If blocking issues arise during implementation:

```markdown
### **BLOCKING ISSUE RESOLVED: [Issue Name]**

**Issue**: [Clear description of the problem]

**Root Cause**: [Technical root cause analysis]

**Crystal Clarity Compliant Solution**: [Framework-first solution approach]

**Implementation Pattern**:
- [Code solution pattern]

**Compliance Analysis**:
- **SIMPLE** ✅: [How it maintains simplicity]
- **PERFORMANT** ✅: [How it maintains performance]
- **MAINTAINABLE** ✅: [How it improves maintainability]

**Anti-Pattern Documentation**:
**Before (Non-compliant)**: [What not to do]
**After (Compliant)**: [Correct approach]
```

---

## Success Criteria

### Phase 1 Success Criteria
- [ ] Complete catalog of all visual elements from legacy implementation
- [ ] Comprehensive gap analysis identifying all missing features
- [ ] Translation strategy for each visual element using Crystal Clarity methods
- [ ] Documentation of visual complexity vs simple implementation approach

### Phase 2 Success Criteria
- [ ] All visual elements implemented with Crystal Clarity compliance
- [ ] Configuration system integrated for all features
- [ ] Performance targets met (60fps, <100ms latency)
- [ ] Files maintain compliance (<120 lines each, functions <15 lines)

---

## Deliverables

### Documentation Created:
1. **`visual-element-analysis.md`** - Complete catalog of legacy visual elements
2. **`gap-analysis-matrix.md`** - Detailed comparison of legacy vs simple implementations
3. **`translation-strategy.md`** - Framework-first translation methodology
4. **`implementation-progress.md`** - Session-by-session implementation tracking

### Implementation Files:
- **`/lib/[vizName]Config.js`** ([XX] lines) - Configuration system
- **`/lib/[vizName]Core.js`** ([XX] lines) - Core rendering functions
- **`/lib/[vizName]Markers.js`** ([XX] lines) - Markers and labels
- **`/lib/visualizers.js`** ([XX] lines) - Integration with main system

---

## Crystal Clarity Compliance Verification

### Code Standards Compliance:
```javascript
// Verify all compliance standards
function validateCrystalClarityCompliance() {
  const files = [
    { name: '[configFile].js', path: '/lib/[configFile].js', maxLines: 120 },
    { name: '[coreFile].js', path: '/lib/[coreFile].js', maxLines: 120 },
    { name: '[markersFile].js', path: '/lib/[markersFile].js', maxLines: 120 },
    { name: 'visualizers.js', path: '/lib/visualizers.js', maxLines: 120 }
  ];

  files.forEach(file => {
    const lineCount = getLineCount(file.path);
    const compliant = lineCount <= file.maxLines;
    console.log(`${compliant ? '✅' : '❌'} ${file.name}: ${lineCount}/${file.maxLines} lines`);
  });
}
```

### Performance Validation:
```javascript
// Execute performance testing framework
function validatePerformance() {
  const startTime = performance.now();

  // Create multiple displays for stress testing
  for (let i = 0; i < 10; i++) {
    createDisplay(`TEST-${i}`, '[visualizationType]');
  }

  const creationTime = performance.now() - startTime;
  console.log(`✅ Created 10 displays in ${creationTime.toFixed(2)}ms`);

  // Monitor frame rate during rapid updates
  let frameCount = 0;
  const monitorFrames = () => {
    frameCount++;
    if (frameCount % 60 === 0) {
      console.log(`✅ Maintained 60fps for ${frameCount} frames`);
    }
    requestAnimationFrame(monitorFrames);
  };
  monitorFrames();
}
```

---

## Task Status Report

### Task Completed (Checklist)
#### Visual Analysis (Phase 1):
- [ ] Visual element catalog completed
- [ ] Gap analysis matrix created
- [ ] Translation strategy documented
- [ ] Implementation roadmap established

#### Technical Implementation (Phase 2):
- [ ] Core rendering functions implemented
- [ ] Configuration system integrated
- [ ] All visual elements translated
- [ ] Performance validation passed
- [ ] Crystal Clarity compliance verified

### Files Created/Modified (with line counts)
- **New Files**:
  - `/lib/[vizName]Config.js`: [XX] lines - Configuration system
  - `/lib/[vizName]Core.js`: [XX] lines - Core rendering functions
  - `/lib/[vizName]Markers.js`: [XX] lines - Markers and labels
- **Modified Files**:
  - `/lib/visualizers.js`: [XX] lines ([+XX] lines) - Integration
  - `/components/displays/DisplayCanvas.svelte`: [XX] lines ([+XX] lines) - Container updates

**Total Implementation**: [XXX] lines (vs [YYY]+ legacy) = [ZZ]% reduction

### Testing Performed (Results)
#### Visual Accuracy Testing:
- [ ] Side-by-side comparison with legacy implementation
- [ ] All visual elements verified for pixel-perfect accuracy
- [ ] Professional trading workflow validation

#### Performance Testing:
- [ ] 10+ concurrent displays without degradation
- [ ] 60fps rendering stability maintained
- [ ] Sub-100ms latency for data-to-visual updates
- [ ] DPR-aware rendering verified across devices

#### Compliance Testing:
- [ ] All files <120 lines compliance
- [ ] All functions <15 lines compliance
- [ ] Framework-first approach verified
- [ ] No abstraction layers introduced

### Issues Found (Blocking/Non-blocking)
#### Blocking Issues:
- [ ] [Issue description]: [Resolution status]
- [ ] [Issue description]: [Resolution status]

#### Non-blocking Issues:
- [ ] [Issue description]: [Resolution status]
- [ ] [Issue description]: [Resolution status]

### Decisions Made (with Rationale)
1. **Decision**: [Specific decision made]
   - **Rationale**: [Why this decision was made]
   - **Impact**: [Effect on implementation]

2. **Decision**: [Specific decision made]
   - **Rationale**: [Why this decision was made]
   - **Impact**: [Effect on implementation]

### Status
**[READY/BLOCKED/NEEDS_DEBUG]**

---

## Success Metrics

### Technical Implementation:
- ✅ All visual elements implemented with Crystal Clarity compliance
- ✅ [XX]% code reduction achieved ([XXX] lines vs [YYY]+ legacy)
- ✅ Professional trading-grade display quality achieved
- ✅ Framework-first translation patterns established

### Performance Validation:
- ✅ <100ms data-to-visual latency
- ✅ 60fps rendering stability
- ✅ Multi-display performance ([XX]+ concurrent)
- ✅ DPR-aware crisp rendering on all devices

### Crystal Clarity Compliance:
- ✅ All files maintain <120 line compliance
- ✅ All functions maintain <15 line compliance
- ✅ Framework-first approach applied throughout
- ✅ Simplified patterns established for future migrations

---

## Ready for Next Visualization

With [Visualization Name] migration complete:
- **Translation Methodology Proven**: Crystal Clarity patterns successfully applied
- **Visual Replication Achieved**: 100% parity with complex implementation
- **Framework Established**: Reusable patterns documented and validated
- **Ready for Scaling**: Foundation prepared for [Next Visualization] implementation

**This template provides a systematic approach to migrate any legacy visualization to Crystal Clarity compliant implementation while maintaining professional trading display quality and establishing reusable patterns for future migrations.**