{
  "plan_id": "394a5ed3-89b1-4fe1-931d-cf137b608a1f",
  "created_at": "2026-03-28T21:08:38.735560",
  "frozen_at": null,
  "overview": {
    "problem": "Clean up legacy, unused, and duplicate files/directories in the NeuroSense FX repo to improve LLM developer experience by reducing noise",
    "approach": "Harden .gitignore first (add src/dist/, root public/ patterns), then delete in parallel waves: (1) ghost directories (tests/, src/docs/, skills/), (2) dead code + build artifacts + stray root files. Keep all CLAUDE.md files except src/docs/CLAUDE.md (user override). No code changes."
  },
  "planning_context": {
    "decisions": [
      {
        "id": "DL-001",
        "version": 1,
        "decision": "Delete root tests/ entirely",
        "reasoning": "playwright.config.cjs testDir=./src/tests -> root tests/ not referenced by test runner -> user confirmed delete all"
      },
      {
        "id": "DL-002",
        "version": 1,
        "decision": "Delete src/docs/ entirely (all files including CLAUDE.md)",
        "reasoning": "User explicitly chose: delete all of src/docs/ including CLAUDE.md -> src/docs/ is ghost from side-by-side migration -> canonical docs in docs/ -> user override of keep-CLAUDE.md constraint"
      },
      {
        "id": "DL-003",
        "version": 1,
        "decision": "Delete non-CLAUDE.md files from services/tick-backend/UI/",
        "reasoning": "UI/ has 11 design exploration files -> not imported by code -> .gitignore already has services/*/UI/*.html -> user confirmed delete non-CLAUDE only -> keep CLAUDE.md"
      },
      {
        "id": "DL-004",
        "version": 1,
        "decision": "Delete skills/ directory entirely (duplicate of .claude/skills/)",
        "reasoning": "skills/ is byte-for-byte duplicate of .claude/skills/ -> .claude/skills/ is canonical -> skills/ pollutes grep with duplicates"
      },
      {
        "id": "DL-005",
        "version": 1,
        "decision": "Delete src/lib/symbolData.js (zero imports)",
        "reasoning": "Grep for from/import/require of symbolData -> zero code matches -> file exports createSymbolData() but no consumer"
      },
      {
        "id": "DL-006",
        "version": 1,
        "decision": "Delete build artifacts: src/dist/ and root vite timestamp files",
        "reasoning": "src/dist/ is stale build output -> timestamp files already gitignored -> delete tracked artifacts"
      },
      {
        "id": "DL-007",
        "version": 1,
        "decision": "Delete stray root files: index.html, public/, runtime logs",
        "reasoning": "Root index.html has no script tag (vite uses src/index.html) -> root public/ only has favicon (vite root is src/) -> logs are runtime artifacts"
      },
      {
        "id": "DL-008",
        "version": 1,
        "decision": "Keep src/composables/ as-is (CLAUDE.md + README.md only)",
        "reasoning": "Only 2 docs remain, both documenting deprecation -> keep-CLAUDE.md constraint applies -> no code to delete"
      },
      {
        "id": "DL-009",
        "version": 1,
        "decision": "Order: .gitignore hardening first, then parallel deletion waves",
        "reasoning": "gitignore must cover patterns before deletion -> prevents future tracked artifacts"
      }
    ],
    "rejected_alternatives": [
      {
        "id": "RA-001",
        "alternative": "Merge tests/ into src/tests/",
        "rejection_reason": "Tests are never run (playwright points to src/tests/) and are market-profile debug variants",
        "decision_ref": "DL-001"
      },
      {
        "id": "RA-002",
        "alternative": "Move src/docs/ to docs/archive/",
        "rejection_reason": "All src/docs/ content is either duplicated in docs/ or is historical session output with no reference value",
        "decision_ref": "DL-002"
      },
      {
        "id": "RA-003",
        "alternative": "Keep skills/ as symlink to .claude/skills/",
        "rejection_reason": "Adds complexity; CLAUDE.md can simply list .claude/skills/ as the canonical path",
        "decision_ref": "DL-004"
      },
      {
        "id": "RA-004",
        "alternative": "Delete src/composables/ entirely",
        "rejection_reason": "Contains CLAUDE.md + README.md documenting migration; keep-CLAUDE.md constraint applies",
        "decision_ref": "DL-008"
      }
    ],
    "constraints": [
      "Keep all CLAUDE.md files as-is (overridden by user for src/docs/CLAUDE.md)",
      "Do not modify working code (no refactoring, no splitting)",
      "Do not break builds or tests",
      "Preserve all source files that are actually imported/used",
      "formatPriceWithPipPosition is DEPRECATED but imported by 5 files - cannot remove without code changes (out of scope)"
    ],
    "risks": [
      {
        "id": "R-001",
        "risk": "symbolData.js may be dynamically imported",
        "mitigation": "Grep confirmed zero static imports. Dynamic import would use string literal - also zero matches.",
        "anchor": null,
        "decision_ref": "DL-005"
      },
      {
        "id": "R-002",
        "risk": "CLAUDE.md references to tests/ or skills/ become stale",
        "mitigation": "CLAUDE.md modifications are out of scope per constraints; flag for follow-up doc-sync",
        "anchor": null,
        "decision_ref": "DL-001"
      }
    ]
  },
  "invisible_knowledge": {
    "system": "NeuroSense FX is a Svelte frontend + Node.js WebSocket backend for FX trading visualization. Vite config sets root:'src', making src/index.html the entry point. Playwright config sets testDir:'./src/tests'. The .claude/ directory contains the canonical skills installation.",
    "invariants": [
      "vite.config.js root is 'src' - all paths resolve from src/",
      "playwright.config.cjs testDir is './src/tests' - root tests/ is not discovered",
      ".claude/skills/ is the canonical skills directory - skills/ at root is a duplicate",
      "CLAUDE.md files are navigation indexes generated by doc-sync skill"
    ],
    "tradeoffs": [
      "Deleting src/docs/ loses historical session documentation that may have future reference value, but eliminates major LLM noise source (38 files)",
      "Keeping src/composables/ (2 files) preserves deprecation documentation at cost of ghost directory entry in src/CLAUDE.md"
    ]
  },
  "milestones": [
    {
      "id": "M-001",
      "version": 1,
      "number": 1,
      "name": "Harden .gitignore",
      "files": [
        ".gitignore"
      ],
      "flags": [],
      "requirements": ["Add src/dist/ to .gitignore so nested build artifacts are ignored"],
      "acceptance_criteria": ["src/dist/ pattern present in .gitignore", "Existing patterns for timestamp-*, *.log, services/*/UI/*.html still present"],
      "tests": [],
      "code_intents": [
        {
          "id": "CI-M-001-001",
          "version": 1,
          "file": ".gitignore",
          "function": null,
          "behavior": "Add src/dist/ to ignore patterns (currently only top-level dist/ is gitignored). Verify timestamp-*, *.log, and services/*/UI/*.html patterns already exist. No patterns need adding for root public/ since the entire public/ directory is being deleted.",
          "decision_refs": [
            "DL-006",
            "DL-007"
          ]
        }
      ],
      "code_changes": [],
      "documentation": {
        "module_comment": null,
        "docstrings": [],
        "function_blocks": [],
        "inline_comments": []
      },
      "is_documentation_only": false,
      "delegated_to": null
    },
    {
      "id": "M-002",
      "version": 1,
      "number": 2,
      "name": "Delete ghost directories",
      "files": [
        "tests/",
        "src/docs/",
        "skills/"
      ],
      "flags": [],
      "requirements": ["Remove tests/ (9 files, not referenced by playwright config)", "Remove src/docs/ (38 files, ghost from side-by-side migration)", "Remove skills/ (duplicate of .claude/skills/)"],
      "acceptance_criteria": ["git status shows tests/, src/docs/, skills/ as deleted", "No import errors in build", "docs/ directory at root still intact"],
      "tests": [],
      "code_intents": [
        {
          "id": "CI-M-002-001",
          "version": 1,
          "file": "tests/",
          "function": null,
          "behavior": "Delete entire tests/ directory at repo root. Contains 7 test files (market-profile variants) + 2 CLAUDE.md files. Playwright config does not reference this path.",
          "decision_refs": [
            "DL-001"
          ]
        },
        {
          "id": "CI-M-002-002",
          "version": 1,
          "file": "src/docs/",
          "function": null,
          "behavior": "Delete entire src/docs/ directory. Contains 38 files: 14 price-formatting docs, 24 crystal-clarity session docs, 1 previous-day-ohlc design doc. All are historical session output or duplicates of docs/ content.",
          "decision_refs": [
            "DL-002"
          ]
        },
        {
          "id": "CI-M-002-003",
          "version": 1,
          "file": "skills/",
          "function": null,
          "behavior": "Delete entire skills/ directory at repo root. Byte-for-byte duplicate of .claude/skills/ which is the canonical installation.",
          "decision_refs": [
            "DL-004"
          ]
        }
      ],
      "code_changes": [],
      "documentation": {
        "module_comment": null,
        "docstrings": [],
        "function_blocks": [],
        "inline_comments": []
      },
      "is_documentation_only": false,
      "delegated_to": null
    },
    {
      "id": "M-003",
      "version": 1,
      "number": 3,
      "name": "Delete dead code and build artifacts",
      "files": [
        "src/lib/symbolData.js",
        "src/dist/"
      ],
      "flags": [],
      "requirements": ["Remove src/lib/symbolData.js (zero imports confirmed)", "Remove src/dist/ (stale build output)"],
      "acceptance_criteria": ["grep -r 'symbolData' src/ returns zero import matches", "src/dist/ directory no longer exists", "vite build still succeeds"],
      "tests": [],
      "code_intents": [
        {
          "id": "CI-M-003-001",
          "version": 1,
          "file": "src/lib/symbolData.js",
          "function": null,
          "behavior": "Delete symbolData.js. Exports createSymbolData() and createSymbolDataWithDimensions(). Zero import statements reference this file across the entire codebase.",
          "decision_refs": [
            "DL-005"
          ]
        },
        {
          "id": "CI-M-003-002",
          "version": 1,
          "file": "src/dist/",
          "function": null,
          "behavior": "Delete entire src/dist/ directory. Contains stale Vite build output (CSS, JS, favicon.ico, index.html). Build artifacts should not be tracked.",
          "decision_refs": [
            "DL-006"
          ]
        }
      ],
      "code_changes": [],
      "documentation": {
        "module_comment": null,
        "docstrings": [],
        "function_blocks": [],
        "inline_comments": []
      },
      "is_documentation_only": false,
      "delegated_to": null
    },
    {
      "id": "M-004",
      "version": 1,
      "number": 4,
      "name": "Delete UI prototypes and stray root files",
      "files": [
        "services/tick-backend/UI/",
        "index.html",
        "public/",
        "backend.log",
        "frontend.log",
        "frontend_prod.log",
        "vite.config.js.timestamp-1774081942818-a2e652e15e7bc8.mjs",
        "vite.config.js.timestamp-1774591903057-f9d3046427499.mjs",
        "vite.config.js.timestamp-1774672708095-0c686319230ff.mjs",
        "vite.config.js.timestamp-1774673402009-37abbb74a89238.mjs"
      ],
      "flags": [],
      "requirements": ["Remove 11 non-CLAUDE.md files from services/tick-backend/UI/", "Remove root index.html (empty shell)", "Remove root public/ directory", "Remove 3 runtime log files", "Remove 4 Vite timestamp files"],
      "acceptance_criteria": ["services/tick-backend/UI/CLAUDE.md still exists", "Root index.html gone", "Root public/ gone", "No .log or .timestamp- files at root"],
      "tests": [],
      "code_intents": [
        {
          "id": "CI-M-004-001",
          "version": 1,
          "file": "services/tick-backend/UI/",
          "function": null,
          "behavior": "Delete all files in services/tick-backend/UI/ EXCEPT CLAUDE.md. Remove: 7 HTML files (ADR dist concept variants, GPT designs, Gemini design, ticker bars), 2 TXT files (Concept llm prompt, New Text Document), 1 duplicate ticker bars_0.1.html. Keep CLAUDE.md.",
          "decision_refs": [
            "DL-003"
          ]
        },
        {
          "id": "CI-M-004-002",
          "version": 1,
          "file": "index.html",
          "function": null,
          "behavior": "Delete root index.html. Contains empty shell with no script tag. Vite uses src/index.html (configured via root:src in vite.config.js).",
          "decision_refs": [
            "DL-007"
          ]
        },
        {
          "id": "CI-M-004-003",
          "version": 1,
          "file": "public/",
          "function": null,
          "behavior": "Delete root public/ directory. Contains only favicon.ico. Vite root is src/, so src/public/ is the active static asset directory.",
          "decision_refs": [
            "DL-007"
          ]
        },
        {
          "id": "CI-M-004-004",
          "version": 1,
          "file": "backend.log,frontend.log,frontend_prod.log",
          "function": null,
          "behavior": "Delete runtime log files at repo root. These are generated by run.sh and already covered by *.log gitignore pattern.",
          "decision_refs": [
            "DL-007"
          ]
        },
        {
          "id": "CI-M-004-005",
          "version": 1,
          "file": "vite.config.js.timestamp-*.mjs",
          "function": null,
          "behavior": "Delete 4 Vite timestamp files at repo root. These are ephemeral Vite build artifacts already covered by *.timestamp-* gitignore pattern.",
          "decision_refs": [
            "DL-006"
          ]
        }
      ],
      "code_changes": [],
      "documentation": {
        "module_comment": null,
        "docstrings": [],
        "function_blocks": [],
        "inline_comments": []
      },
      "is_documentation_only": false,
      "delegated_to": null
    },
    {
      "id": "M-005",
      "version": 1,
      "number": 5,
      "name": "Verify build and test integrity",
      "files": [],
      "flags": [],
      "requirements": ["Run vite build with no errors", "List playwright tests from src/tests/ only", "Confirm git status shows only expected deletions"],
      "acceptance_criteria": ["npx vite build exits 0", "npx playwright test --list shows tests from src/tests/ only", "git status shows no unexpected modified files"],
      "tests": [],
      "code_intents": [
        {
          "id": "CI-M-005-001",
          "version": 1,
          "file": "package.json",
          "function": null,
          "behavior": "Run verification commands: (1) npx vite build to confirm no build errors, (2) npx playwright test --list to verify tests resolve from src/tests/ only, (3) git status to confirm only expected deletions appear. No file changes in this milestone.",
          "decision_refs": [
            "DL-009"
          ]
        }
      ],
      "code_changes": [],
      "documentation": {
        "module_comment": null,
        "docstrings": [],
        "function_blocks": [],
        "inline_comments": []
      },
      "is_documentation_only": false,
      "delegated_to": null
    }
  ],
  "waves": [
    {"id": "W-001", "wave": 1, "milestones": ["M-001"]},
    {"id": "W-002", "wave": 2, "milestones": ["M-002", "M-003", "M-004"]},
    {"id": "W-003", "wave": 3, "milestones": ["M-005"]}
  ],
  "diagram_graphs": [],
  "readme_entries": []
}