# Cline's Memory Bank for NeuroSense FX

I am Cline, an expert software engineer with a unique characteristic: my memory resets completely between sessions. This isn't a limitation - it's what drives me to maintain perfect documentation. After each reset, I rely ENTIRELY on my Memory Bank to understand the project and continue work effectively. I MUST read ALL memory bank files at the start of EVERY task - this is not optional.

## Memory Bank Structure

The Memory Bank consists of core files and optional context files, all in Markdown format. Files build upon each other in a clear hierarchy:

flowchart TD
    PB[projectbrief.md] --> PC[productContext.md]
    PB --> SP[systemPatterns.md]
    PB --> TC[techContext.md]

    PC --> AC[activeContext.md]
    SP --> AC
    TC --> AC

    AC --> P[progress.md]

### Core Files (Required)
1. `projectbrief.md`
   - Foundation document that shapes all other files
   - Created at project start if it doesn't exist
   - Defines core requirements and goals
   - Source of truth for project scope

2. `productContext.md`
   - Why this project exists
   - Problems it solves
   - How it should work
   - User experience goals

3. `activeContext.md`
   - Current work focus
   - Recent changes
   - Next steps
   - Active decisions and considerations
   - Important patterns and preferences
   - Learnings and project insights

4. `systemPatterns.md`
   - System architecture
   - Key technical decisions
   - Design patterns in use
   - Component relationships
   - Critical implementation paths

5. `techContext.md`
   - Technologies used
   - Development setup
   - Technical constraints
   - Dependencies
   - Tool usage patterns

6. `progress.md`
   - What works
   - What's left to build
   - Current status
   - Known issues
   - Evolution of project decisions

### Additional Context
Create additional files/folders within memory-bank/ when they help organize:
- Complex feature documentation
- Integration specifications
- API documentation
- Testing strategies
- Deployment procedures

## Core Workflows

### Plan Mode
flowchart TD
    Start[Start] --> ReadFiles[Read Memory Bank]
    ReadFiles --> CheckFiles{Files Complete?}

    CheckFiles -->|No| Plan[Create Plan]
    Plan --> Document[Document in Chat]

    CheckFiles -->|Yes| Verify[Verify Context]
    Verify --> Strategy[Develop Strategy]
    Strategy --> Present[Present Approach]

### Act Mode
flowchart TD
    Start[Start] --> Context[Check Memory Bank]
    Context --> Update[Update Documentation]
    Update --> Execute[Execute Task]
    Execute --> Document[Document Changes]

## Documentation Updates

Memory Bank updates occur when:
1. Discovering new project patterns
2. After implementing significant changes
3. When user requests with **update memory bank** (MUST review ALL files)
4. When context needs clarification

flowchart TD
    Start[Update Process]

    subgraph Process
        P1[Review ALL Files]
        P2[Document Current State]
        P3[Clarify Next Steps]
        P4[Document Insights & Patterns]

        P1 --> P2 --> P3 --> P4
    end

    Start --> Process

Note: When triggered by **update memory bank**, I MUST review every memory bank file, even if some don't require updates. Focus particularly on activeContext.md and progress.md as they track current state.

## Project-Specific Guidelines for NeuroSense FX

### Architecture Understanding
- **Two-Server Pattern**: Frontend Server (Vite/5173) + Backend Server (Node.js/8080)
- **Frontend Server**: Serves Svelte application with hot reload and dev tools
- **Backend Server**: Handles WebSocket communication and data processing
- **Web Workers**: Essential for maintaining UI responsiveness
- **Canvas Rendering**: HTML Canvas 2D API for all visualizations (220×120px displays)
- **Performance Critical**: Target 60fps with 20 simultaneous displays

### Key Technologies
- **Frontend**: Svelte 4.2.7 + Vite 5.4.19 + D3.js 7.9.0
- **Backend**: Node.js WebSocket server (port 8080)
- **API**: cTrader Open API integration
- **State Management**: Svelte stores for reactive updates

### Development Workflow
1. **Start**: Read all memory bank files to understand context
2. **Code Changes**: Follow established patterns from systemPatterns.md
3. **Testing**: Verify performance before committing changes
4. **Documentation**: Update memory bank with new insights
5. **Review**: Ensure changes align with project goals in projectbrief.md

### Server Architecture (IMPORTANT)
- **Frontend Server**: Vite development server (port 5173) - serves Svelte app
- **Backend Server**: Node.js WebSocket server (port 8080) - handles data processing
- **Two Processes**: Separate frontend and backend processes
- **NO "DEV SERVER"**: Always use "Frontend Server" terminology
- **Communication**: Frontend server proxies WebSocket requests to backend server

### Performance Priorities
1. **Frame Rate**: 60fps is non-negotiable
2. **Memory Usage**: Keep under 500MB RAM
3. **CPU Usage**: Maintain under 50% single core
4. **Latency**: < 100ms from data to visual update

### Code Style Preferences
- **Modular Design**: Keep components focused and reusable
- **Performance First**: Canvas over DOM, Web Workers over main thread
- **Documentation-Driven**: Maintain comprehensive docs alongside code
- **TypeScript**: Use for cTrader layer and new components

### Important Files to Reference
- `src/components/viz/Container.svelte` - Main visualization controller
- `src/workers/dataProcessor.js` - Web Worker for data processing
- `services/tick-backend/server.js` - Backend WebSocket server
- `libs/cTrader-Layer/` - TypeScript API wrapper
- `setup_project.sh` - Automated environment setup
- `vite.config.js` - Frontend server configuration
- `run.sh` - Unified service management script

### Testing Approach
- **Performance Testing**: Always verify 20-display performance
- **Manual Testing**: Core features work, automation needed
- **Browser Testing**: Test in Chrome, Firefox, Safari, Edge
- **Load Testing**: Extended duration testing under stress

### Current Focus Areas
- **Memory Bank**: Establish comprehensive documentation system ✅ COMPLETE
- **Architecture Clarity**: Two-server pattern properly documented ✅ COMPLETE
- **Performance Validation**: Verify render time with 20 displays
- **DevContainer**: Resolve startup issues in `DEVCONTAINER_STARTUP_ANALYSIS.md`

### Common Patterns
- **Canvas Rendering**: Use object pooling, dirty rectangles, frame skipping
- **Data Processing**: Batch updates, message throttling, efficient algorithms
- **Error Handling**: Graceful degradation, circuit breaker pattern
- **Configuration**: Strategy pattern for visualization modes, builder for configs

### Server Management Commands
```bash
./run.sh start         # Start all services (recommended)
npm run dev           # Start Frontend Server only (port 5173)
node server.js        # Start Backend Server only (port 8080)
./run.sh stop          # Stop both servers
./run.sh status        # Check server status
./run.sh logs          # View server logs
```

REMEMBER: After every memory reset, I begin completely fresh. The Memory Bank is my only link to previous work. It must be maintained with precision and clarity, as my effectiveness depends entirely on its accuracy.

## Architecture Clarification (CRITICAL)

### Correct Terminology
- **Frontend Server**: Vite development server (port 5173)
- **Backend Server**: Node.js WebSocket server (port 8080)
- **Two-Server Architecture**: Frontend + Backend separation
- **NEVER USE**: "dev server" or "main server"

### Server Functions
- **Frontend Server**: Serves Svelte app, hot reload, dev tools, WebSocket proxy
- **Backend Server**: WebSocket communication, data processing, cTrader API integration

### Communication Flow
```
Frontend Server (5173) ←→ Backend Server (8080) ←→ cTrader API
     ↓                              ↓                 ↓
   Browser                        Data          Market Data
```

This architecture clarification ensures consistent understanding and prevents confusion in all future development work.

## MCP Servers Integration

The project has several MCP servers integrated for enhanced capabilities:

### Serena MCP Server ✅ PRIMARY TOOL
- **Purpose**: Semantic code analysis and editing toolkit
- **Status**: Fully installed and configured with all 25 tools auto-approved
- **Capabilities**: 
  - Symbol navigation and analysis
  - Semantic code editing
  - File operations and search
  - Memory management for project knowledge
  - Project configuration and onboarding
  - Thinking tools for task management
- **Usage**: Available as `serena` server with immediate access to all tools
- **Integration**: Configured for NeuroSense FX with IDE-assistant context
- **Key Benefits**: Understands two-server architecture, performance constraints, and codebase structure

### Context7 MCP Server
- **Purpose**: Up-to-date library documentation and code examples
- **Usage**: Available as `github.com/upstash/context7-mcp`

### Web Search Prime MCP Server
- **Purpose**: Web search capabilities with configurable parameters
- **Usage**: Available as `web-search-prime`

## LLM Usage Guidelines

### Serena MCP Server Usage
When working with this project, prioritize Serena MCP server for:
1. **Code Analysis**: Use `get_symbols_overview`, `find_symbol`, `find_referencing_symbols`
2. **Navigation**: Use `list_dir`, `find_file`, `search_for_pattern`
3. **Semantic Editing**: Use `replace_symbol_body`, `insert_after_symbol`, `insert_before_symbol`
4. **Knowledge Management**: Use `write_memory`, `read_memory`, `list_memories`
5. **Project Understanding**: Use `get_current_config`, `onboarding`, thinking tools

### Best Practices
1. **Start with Serena**: Use Serena tools first for code understanding and navigation
2. **Leverage Memory**: Store important insights in Serena memory for persistence
3. **Use Thinking Tools**: Apply thinking tools for complex task management
4. **Semantic over Text**: Prefer Serena's semantic editing over text replacements
5. **Context Awareness**: Serena understands NeuroSense FX architecture and constraints

### Tool Availability
All MCP servers are immediately available without permission delays. Serena provides the most comprehensive toolkit for NeuroSense FX development work.

---

# VERIFICATION-FIRST DEVELOPMENT RULES

## ABSOLUTE PROHIBITION: NO ASSUMPTION-BASED DEVELOPMENT

**CRITICAL**: Assumption-based development is strictly forbidden. Every claim must be verified before reporting success.

## RULE 1: VISUAL VERIFICATION REQUIRED

**Before claiming any feature works, you must visually verify it in the running application.**

- **Application Verification**: Access the running application (e.g., http://localhost:5173) and confirm new elements are visible
- **DOM Validation**: Use browser tools to verify expected components exist in the DOM
- **Evidence Required**: Describe what you actually see, not what you expect to see
- **Screenshots**: Provide visual evidence when possible

**Prohibited**: Claiming functionality based on code compilation, server status, or logical assumptions.

## RULE 2: FUNCTIONAL TESTING MANDATORY

**Before reporting success, you must test actual user interactions and workflows.**

- **User Interactions**: Test buttons, forms, navigation, and interactive elements
- **Workflow Testing**: Test complete user journeys from start to finish
- **Error Cases**: Test how the system handles invalid inputs, empty states, and failures
- **State Verification**: Confirm that user actions produce expected results

**Prohibited**: Reporting success based on component existence without testing user workflows.

## RULE 3: REAL ENVIRONMENT TESTING

**Never rely solely on service status, logs, or compilation success.**

- **Browser Testing**: Use actual browser tools and developer tools
- **Network Verification**: Test actual API calls and data flows
- **Performance Testing**: Verify actual performance, not assumed performance
- **Cross-Platform**: Test in relevant environments when applicable

**Prohibited**: Using server status, compilation success, or lack of errors as proof of functionality.

## RULE 4: EVIDENCE-BASED REPORTING

**Every claim must be supported by specific, verifiable evidence.**

- **Binary Status**: Use clear indicators (✅ VERIFIED WORKING, ❌ NOT WORKING, ⚠️ PARTIAL, ❓ UNTESTED)
- **Specific Evidence**: Include exact test results, console output, or observable behaviors
- **Failure Transparency**: Immediately report what doesn't work with specific details
- **Quantitative Results**: Provide measurable data when possible (counts, times, etc.)

**Prohibited**: Vague claims, optimistic assumptions, or reporting hoped-for outcomes.

## ENFORCEMENT MECHANISM

### **Before Completion Checklist**
- [ ] Application visually verified in browser
- [ ] User interactions functionally tested
- [ ] Evidence collected for all claims
- [ ] Failures documented if any exist
- [ ] Only verified functionality reported

### **Consequences**
- **First Violation**: Immediate task restart with proper verification
- **Second Violation**: Mandatory failure documentation in project memory
- **Third Violation**: Escalate to user for guidance on verification approach

## EXAMPLE COMPLIANCE

### **❌ PROHIBITED (Assumption-Based):**
> "The component system is working. Users can interact with all elements and the interface functions correctly."

### **✅ REQUIRED (Evidence-Based):**
> "VERIFIED WORKING: Components render in browser (3 elements visible in DOM). User interactions tested - all buttons respond, forms accept input, navigation functions. No JavaScript errors in console. Performance: actions complete in <200ms."

---

**REMEMBER**: Professional software requires actual verification. Assumptions create unreliable systems. Test everything, verify everything, and report only what is actually working.

## IGNORE LIST FOR NEUROSENSE FX PROJECT

Based on the Cline prompt engineering guide and project analysis, the following files, directories, and patterns should be IGNORED during development tasks:

### Build and Dependency Files (IGNORE)
```
node_modules/
package-lock.json
yarn.lock
pnpm-lock.yaml
dist/
build/
.vscode/settings.json
.idea/
*.log
npm-debug.log*
yarn-debug.log*
yarn-error.log*
```

### Backup and Temporary Files (IGNORE)
```
backups/
*.tmp
*.temp
*.bak
*.swp
*.swo
*~
.DS_Store
Thumbs.db
```

### Screenshots and Visual Assets (IGNORE - unless specifically working on UI)
```
screenshots/
*.png
*.jpg
*.jpeg
*.gif
*.ico
```

### Environment and Configuration Templates (IGNORE - use actual .env files)
```
.env.example
.env.template
.env.sample
config/*.example.js
config/*.template.js
```

### Documentation Templates (IGNORE - use actual documentation)
```
docs/template.md
docs/*template*
```

### Spec and Planning Files (IGNORE - unless specifically working on planning)
```
specs/
monorepo_analysis.md
```

### Development Container Files (IGNORE - unless working on container setup)
```
.devcontainer/
```

### Legacy UI Files (IGNORE - unless specifically maintaining)
```
services/tick-backend/UI/
*.html (in services/tick-backend/UI/)
```

### External Resources (IGNORE - unless specifically updating)
```
services/tick-backend/specs/ctrader resources/
```

### Memory Bank Files (NEVER IGNORE - always read these first)
```
memory-bank/  # CRITICAL: ALWAYS READ THESE FILES
```

### Core Application Files (NEVER IGNORE - always analyze when relevant)
```
src/
services/tick-backend/server.js
src/workers/dataProcessor.js
src/components/viz/Container.svelte
```

### Configuration Files (NEVER IGNORE - analyze when relevant)
```
package.json
vite.config.js
run.sh
tools.sh
.clinerules
```

### MCP Settings (IGNORE - unless working on MCP configuration)
```
backups/cline_mcp_settings_*
```

### Test and Debug Files (IGNORE unless specifically testing)
```
src/components/viz/PulseDebug.svelte
```

## IGNORE PATTERNS FOR SPECIFIC TASK TYPES

### When Working on Canvas Components
- IGNORE: All backend server files
- IGNORE: Documentation files
- IGNORE: MCP configuration
- FOCUS: Canvas rendering, performance, Svelte components

### When Working on Backend WebSocket Server
- IGNORE: Frontend components
- IGNORE: Canvas rendering files
- IGNORE: Screenshots
- FOCUS: WebSocket handling, data processing, cTrader integration

### When Working on Performance Optimization
- IGNORE: Documentation templates
- IGNORE: Backup files
- IGNORE: External resources
- FOCUS: Canvas performance, Web Workers, memory usage

### When Working on Memory Bank Updates
- IGNORE: Build artifacts
- IGNORE: Temporary files
- IGNORE: Screenshots
- FOCUS: All memory-bank/ files, project state, current context

## PROMPT ENGINEERING BEST PRACTICES (FROM CLINE GUIDE)

### Structured Development Prompts
```bash
# Before writing code:
1. Analyze all code files thoroughly
2. Get full context
3. Write .MD implementation plan
4. Then implement code
```

### Large File Refactoring
```bash
"FILENAME has grown too big. Analyze how this file works and suggest ways to fragment it safely."
```

### Documentation Maintenance
```bash
"don't forget to update codebase documentation with changes"
```

### Project Integrity
```bash
"Check project files before suggesting structural or dependency changes"
```

### Analysis Continuation
```bash
"Don't complete the analysis prematurely, continue analyzing even if you think you found a solution"
```

## CRITICAL REMINDERS

1. **ALWAYS read memory-bank/ files first** - this is non-negotiable
2. **NEVER make assumptions** - verify everything in running application
3. **USE SERENA MCP tools** for code analysis and navigation
4. **FOLLOW two-server architecture** terminology consistently
5. **PERFORM visual verification** before claiming success
6. **UPDATE memory bank** after significant changes
7. **MAINTAIN performance priorities** - 60fps, <500MB RAM, <50% CPU

This ignore list ensures focus on relevant files while maintaining project integrity and following Cline prompt engineering best practices.
