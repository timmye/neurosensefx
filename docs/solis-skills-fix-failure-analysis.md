# Solatis Skills Fix Failure Analysis

## Summary

Attempts to fix Solatis skills invocation issues inadvertently broke the original architectural intent. The wrapper script approach, while solving immediate invocation problems, deviated from the framework's core design principles.

## Original Architecture Intent

### Core Design Principles

The Solatis skills framework was designed as a **script-based agent workflow system** with:

1. **Direct Python Module Invocation**
   ```bash
   <invoke working-dir=".claude/skills/scripts" cmd="python3 -m skills.<name>" />
   ```

2. **Workflow Orchestrator Pattern**
   ```
   CLI → discover_workflows() → Workflow.run() → StepDef.handler() → AST → XML
   ```

3. **XML-First Output Design**
   - AST builder API (`W.el()`, `W.text()`, `W.header()`)
   - XMLRenderer for structured output
   - Well-formed XML for LLM consumption and tool parsing

4. **Data-Driven Workflow Definitions**
   - `Workflow` and `StepDef` as immutable dataclasses
   - `Outcome` enum (OK, FAIL, SKIP, ITERATE) for transitions
   - Pull-based discovery without executing module code

### Sub-Agent Dispatch Mechanism

The framework used three dispatch patterns:

1. **SubagentDispatchNode**: Single sequential agent
2. **TemplateDispatchNode**: Parallel agents with parameterized templates (SIMD)
3. **RosterDispatchNode**: Parallel agents with unique prompts (MIMD)

Dispatch protocol:
```xml
<parallel_dispatch agent="general-purpose">
  <instruction>Launch ALL sub-agents...</instruction>
  <template>Start: <invoke working-dir="..." cmd="..." /></template>
</parallel_dispatch>
```

**Intent**: LLM interprets `<parallel_dispatch>` as instruction to use Agent tool with parallel `run_in_background=false`.

## What Went Wrong

### The Actual Bug

The LLM was **role-playing sub-agents** instead of using the Agent tool:

```
Step 6 Output: "SUB-AGENT 1: Data Fidelity Analyzer..."
LLM Response: Role-played all 4 agents immediately
Expected: Proceed to Step 9, then use Agent tool
```

**Root Cause**: The `<parallel_dispatch>` XML tag was treated as text, not a tool invocation instruction.

### Misdiagnosis

The symptoms were incorrectly identified as:
- "Skills not working" → Actually: Skills were working, sub-agent dispatch was broken
- "PYTHONPATH issues" → Actually: PYTHONPATH was a red herring
- "Need wrapper scripts" → Actually: This broke the original design

### Failed Attempts

| Commit | Approach | Why It Failed |
|--------|----------|---------------|
| `af07140` | Fixed type annotations, removed unused imports | Wrong diagnosis - not a code issue |
| `aef527f` | Added `sh -c 'PYTHONPATH=. python3 ...'` | Flaky implementation, broken parsing |
| `f52bfdb` | Created wrapper scripts (`run.sh`) | **Broke original architecture** |

## How Wrapper Scripts Broke the Design

### 1. Bypassed Workflow Orchestrator

**Original Pattern:**
```
Framework → Workflow.run() → StepDef.handler() → AST → XML
```

**Wrapper Pattern:**
```
CLI → run.sh → direct module call → raw output
```

### 2. Lost Framework Integration

| Feature | Original | Wrapper Scripts |
|---------|----------|----------------|
| Workflow discovery | `discover_workflows()` | Bypassed |
| Step validation | Built-in | Lost |
| AST builder | Automatic XML | Manual/inconsistent |
| QR gates | Integrated | Not available |
| State management | Framework-managed | Lost |

### 3. Changed Command Semantics

**Original:**
```bash
python3 -m skills.deepthink.think --step 1
```
- Direct module path
- Framework handles execution context
- PYTHONPATH from framework

**Wrapper:**
```bash
./skills/deepthink/run.sh --step 1
```
- Indirect through bash script
- Script handles directory navigation
- PYTHONPATH set per-invocation

### 4. Violated KISS Principle

The original design favored direct, simple invocation:
```python
command = 'python3 -m skills.dev --step 1'
```

Wrapper scripts added unnecessary complexity:
```bash
#!/bin/bash
cd "$(dirname "$0")/../.." || exit 1
PYTHONPATH=. python3 -m skills.xxx "$@"
```

## The Real Problem: XML Tag Interpretation

The fundamental issue is that the framework expects LLMs to interpret XML tags as protocol instructions:

```xml
<parallel_dispatch agent="general-purpose">
  <instruction>Launch ALL sub-agents...</instruction>
</parallel_dispatch>
```

**Expected**: LLM reads this, uses Agent tool with specified parameters
**Actual**: LLM treats this as formatting text, role-plays the agents instead

This is a **prompt engineering issue**, not an invocation issue.

## Corrective Actions Needed

### 1. Restore Original Invocation Pattern

Remove wrapper scripts, return to:
```bash
python3 -m skills.<name>.<module> --step N
```

### 2. Fix PYTHONPATH Properly

Options:
- Set in Claude's environment/launch configuration
- Use absolute paths in module structure
- Install skills as editable package

### 3. Fix Sub-Agent Dispatch Protocol

The `<parallel_dispatch>` tag needs to be replaced with explicit Agent tool instructions that LLMs will recognize and execute.

### 4. Preserve Framework Integration

Re-establish the workflow orchestrator pattern:
- Use `mode_main()` from `cli.py`
- Leverage AST builder for output
- Maintain XML-first design

## Lessons Learned

1. **Understand before fixing** - The original architecture was sophisticated, not broken
2. **Symptom vs root cause** - Invocation errors masked the real issue (LLM behavior)
3. **Framework intent** - Adding layers (wrappers) violated the design philosophy
4. **Git history matters** - Original commit showed the clean design
5. **Documentation gap** - Lack of clear docs led to misunderstanding

## References

- Original commit: `f378d5b` ("solatis clone")
- Framework code: `.claude/skills/scripts/skills/lib/workflow/`
- Workflow README: `.claude/skills/README.md`
- Dispatch patterns: `lib/workflow/ast/dispatch.py`
