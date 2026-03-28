# Housekeeping Cleanup Plan

**Status**: READY FOR EXECUTION
**Created**: 2026-03-28
**Objective**: Remove legacy, unused, and duplicate files/directories to improve LLM developer experience
**Constraints**: Keep all CLAUDE.md files. No code refactoring. No breaking changes.

---

## Wave 1: Verify .gitignore (no changes expected)

**M-001**: Verify `.gitignore` already covers artifact paths

- `dist/` on line 15 already covers `src/dist/` at any depth
- `*.timestamp-*`, `*.log`, `services/*/UI/*.html` patterns already exist
- Confirm `git ls-files src/dist/` returns 0 (untracked)
- **Action**: Verification only, no edits needed

---

## Wave 2: Delete Ghost Directories

### M-002: Delete `tests/` (root)

10 files: 7 spec files + 2 CLAUDE.md + 1 JSON fixture

- Playwright config (`testDir: './src/tests'`) does not discover root `tests/`
- Zero code imports from this path
- **Action**: `rm -rf tests/`

### M-003: Delete `src/docs/` (39 files)

14 price-formatting design docs + 25 crystal-clarity session docs + CLAUDE.md

- Ghost from side-by-side migration — canonical docs live in `docs/`
- Zero code references
- **Action**: `rm -rf src/docs/`

### M-004: Delete `skills/` (duplicate of `.claude/skills/`)

- `diff -rq skills/ .claude/skills/ --exclude='__pycache__'` shows only 1 diff: stray `=2.0` npm artifact
- All tracked content files are identical
- `.claude/skills/` is canonical
- **Action**: `rm -rf skills/`

---

## Wave 3: Delete Dead Code & Build Artifacts

### M-005: Delete dead source file

- `src/lib/symbolData.js` — zero imports found (`grep -rn 'symbolData' src/` confirms all matches are variable names, not file imports)
- **Action**: `rm src/lib/symbolData.js`

### M-006: Delete build artifacts

- `src/dist/` — stale build output, already gitignored
- Root `vite.config.js.timestamp-*.mjs` (4 files) — Vite HMR artifacts
- **Action**: `rm -rf src/dist/` and `rm vite.config.js.timestamp-*.mjs`

---

## Wave 4: Delete UI Prototypes & Stray Root Files

### M-007: Clean `services/tick-backend/UI/`

Keep CLAUDE.md, delete everything else (9 HTML prototypes + text files):
- `ADR dist concept_01.html`, `_01_gpt iterate.html`, `_01_horizontal.html`, `_01_horizontal_happy accident.html`
- `ADR dist concept_02_price.html`
- `Concept llm prompt.txt`, `Gemini design.html`, `GPT designs.html`
- `New Text Document.txt`, `ticker bars.html`, `ticker bars_0.1.html`
- **Action**: Delete all non-CLAUDE.md files in `services/tick-backend/UI/`

### M-008: Delete stray root artifacts (15 files)

| File | Reason |
|------|--------|
| `=2.0` | Empty npm artifact |
| `neurosense-fx@0.1.0` | Empty npm artifact |
| `npx` | Empty npm artifact |
| `backend.log` | Runtime log |
| `frontend.log` | Runtime log |
| `frontend_prod.log` | Runtime log |
| `DEBUG_REPORT.md` | One-off debug report |
| `test_debug_websocket.html` | Debug artifact |
| `test-workspace.json` | Debug artifact |
| `.wslconfig` | System config (not project file) |
| `.mcp.json` | Empty `{}` |
| `DEBUG_REPORT.md` | One-off debug report |
| `test_debug_websocket.html` | Debug artifact |
| `test-workspace.json` | Debug artifact |
| `.wslconfig` | System config (not project file) |
| `.mcp.json` | Empty `{}` |

**KEPT (needed by Vite build despite root:'src')**: `index.html` (root), `public/` (root)

**Action**: Delete listed files only. DO NOT delete root `index.html` or root `public/`

---

## Wave 5: Docker Config Updates (addresses QR findings)

### M-009: Update Docker configs to remove stale path references

These Docker configs reference paths being deleted. Update them to avoid broken mounts:

| File | Current Reference | Fix |
|------|-------------------|-----|
| `docker-compose.yml` line 23-24 | `./public:/app/public:ro` | Remove volume mount (root `public/` deleted) |
| `docker-compose.dev.yml` line 26 | `./public:/app/public` | Remove volume mount |
| `docker-compose.perf.yml` line 12 | `./tests/performance:/scripts` | Remove volume mount (`tests/` deleted) |
| `Dockerfile.performance` line 33 | `WORKDIR /app/tests/performance` | Update or remove (`tests/` deleted) |
| `services/tick-backend/Dockerfile` line 44 | `COPY --from=builder ... /build/UI ./UI` | Remove UI copy step (UI files deleted) |

**Action**: Edit each file to remove/update stale references

---

## Wave 6: Verification

### M-010: Verify build integrity

- `npx vite build` — confirms no breakage
- `git status` — review what was deleted
- `git diff` — review Docker config changes
- Run doc-sync after to update CLAUDE.md references (skills/, tests/ rows)

---

## Summary

| Wave | What | Items deleted |
|------|------|--------------|
| 1 | Verify .gitignore | 0 (verification) |
| 2 | Ghost directories | ~50 files (3 dirs) |
| 3 | Dead code + artifacts | ~7 items |
| 4 | UI prototypes + stray root | ~25 items |
| 5 | Docker config fixes | 5 file edits |
| 6 | Verification | 0 |

**Total**: ~82 files/dirs removed, 5 Docker configs updated, 0 source code modifications
