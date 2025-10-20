# Comprehensive System Analysis
## NeuroSense FX - Phase 1: Deep Understanding

**Date:** October 20, 2025  
**Purpose**: Complete understanding of current system before rewrite  
**Status**: 🔄 ANALYSIS IN PROGRESS - NO CODE CHANGES  

---

## 🎯 **Analysis Methodology**

**Rule**: No code changes during this phase. Pure analysis and documentation only.

**Approach**: Systematic analysis of every component, store, and data flow to understand:
- What the system is supposed to do
- How it actually works
- Why it's broken
- What the correct architecture should look like

---

## 📋 **Analysis Framework**

### **Component Analysis Template**
For each component:
```
COMPONENT: [Component Name]
PURPOSE: [What it should do]
INPUTS: [Data it needs]
OUTPUTS: [What it produces]
DEPENDENCIES: [What it depends on]
EVENTS: [Events it handles/dispatches]
INTEGRATION: [How it connects to system]
CURRENT ISSUES: [What's broken]
```

### **Data Flow Analysis Template**
For each data flow:
```
DATA FLOW: [Source → Destination]
PURPOSE: [Why this data moves]
TRANSFORMATIONS: [How data changes]
TIMING: [When this happens]
DEPENDENCIES: [What this depends on]
BREAKING POINTS: [Where it fails]
```

---

## 🔍 **SYSTEM COMPONENTS ANALYSIS**

### **Backend Services**

#### **WebSocketServer.js**
**Purpose**: Backend WebSocket server handling client connections and cTrader data
**Analysis Needed**: 
- How it connects to cTrader API
- How it processes and forwards data
- What message types it handles
- How it manages client connections

#### **CTraderSession.js**
**Purpose**: cTrader API integration and authentication
**Analysis Needed**:
- How it authenticates with cTrader
- How it retrieves market data
- How it manages subscriptions
- What data formats it uses

---

### **Frontend Core**

#### **main.js**
**Purpose**: Application entry point
**Analysis Needed**:
- How application initializes
- What global setup occurs
- How routing and state initialization work

#### **App.svelte**
**Purpose**: Root application component
**Analysis Needed**:
- How it manages global state
- How it renders child components
- How it handles global events
- What the overall component structure looks like

---

### **State Management Layer**

#### **floatingStore.js**
**Purpose**: Intended unified state management
**Analysis Needed**:
- What state it actually manages
- How actions are dispatched
- How components subscribe to changes
- Why it's not working as intended

#### **canvasDataStore.js** (from ConnectionManager)
**Purpose**: Canvas-specific data management
**Analysis Needed**:
- What data it manages
- How it integrates with ConnectionManager
- How components access this data
- Why it exists separately from floatingStore

#### **Legacy Stores** (configStore, uiState, etc.)
**Purpose**: Supposedly removed but may still exist
**Analysis Needed**:
- Do they still exist?
- If so, what do they contain?
- Are any components still using them?
- Why weren't they properly removed?

---

### **Data Layer**

#### **ConnectionManager.js**
**Purpose**: Manages data connections and subscriptions
**Analysis Needed**:
- How it connects to WebSocket
- How it manages symbol subscriptions
- How it processes and stores data
- How it integrates with stores

#### **wsClient.js**
**Purpose**: WebSocket client for frontend
**Analysis Needed**:
- How it establishes connections
- How it handles different message types
- How it integrates with ConnectionManager
- What error handling exists

#### **symbolStore.js**
**Purpose**: Symbol-specific state management
**Analysis Needed**:
- What symbol data it manages
- How it relates to other stores
- How components access symbol data
- Why it exists separately

---

### **UI Components**

#### **FloatingDisplay.svelte**
**Purpose**: Individual trading display component
**Analysis Needed**:
- How it's supposed to render market data
- What data it needs from stores
- How canvas rendering works
- Why displays are not visible

#### **SymbolPalette.svelte**
**Purpose**: Symbol selection interface
**Analysis Needed**:
- How it loads available symbols
- How it creates new displays
- How it integrates with stores
- What events it dispatches

#### **FloatingPanel.svelte**
**Purpose**: Base floating panel component
**Analysis Needed**:
- How drag-and-drop works
- How it manages panel state
- How it integrates with floatingStore
- Why it seems to work when others don't

#### **ContextMenu.svelte**
**Purpose**: Context menu system
**Analysis Needed**:
- How it's triggered and displayed
- What menu items it shows
- How it handles menu actions
- How it integrates with stores

---

### **Visualization Components**

#### **Market Profile Visualization**
**Files**: marketProfile.js, related viz components
**Analysis Needed**:
- How market profile data is calculated
- How it's rendered to canvas
- What data format it expects
- How it integrates with displays

#### **Other Visualizations**
**Files**: dayRangeMeter, volatilityOrb, priceFloat, etc.
**Analysis Needed**:
- What each visualization shows
- How they calculate their data
- How they render to canvas
- How they integrate with display components

---

## 🔄 **DATA FLOW ANALYSIS**

### **Primary Data Flow: WebSocket to UI**
```
cTrader API → Backend WebSocket → Frontend WebSocket → ConnectionManager → Stores → Components → Canvas
```

**Analysis Points**:
- Where does this flow break?
- What transformations happen at each step?
- What are the timing and synchronization issues?
- How should this flow ideally work?

### **User Interaction Flow**
```
User Action → Component Event → Store Update → Component React → UI Update
```

**Analysis Points**:
- How are user actions captured?
- How are events dispatched?
- How do stores react to events?
- How do components react to store changes?

### **Display Creation Flow**
```
Symbol Selection → Display Creation → Data Subscription → Canvas Rendering → Display Visible
```

**Analysis Points**:
- Where does this flow fail?
- What data is needed at each step?
- How are displays managed in the system?
- Why don't displays appear visible?

---

## 🎯 **CRITICAL QUESTIONS TO ANSWER**

### **System Understanding**
1. **What is the complete data journey from cTrader to canvas?**
2. **How are displays supposed to be created and managed?**
3. **What is the intended role of each store?**
4. **How should components communicate with each other?**

### **Breakdown Analysis**
1. **Why are displays not visible despite data flowing?**
2. **Why do some components work (FloatingPanel) while others don't (FloatingDisplay)?**
3. **Why are reactive statements not firing properly?**
4. **What is the root cause of the store integration issues?**

### **Architecture Assessment**
1. **What would a clean architecture for this system look like?**
2. **What are the essential vs. non-essential components?**
3. **What patterns should be kept vs. discarded?**
4. **What are the performance requirements and constraints?**

---

## 📊 **ANALYSIS PROGRESS**

### **Completed Analysis**
- [x] Migration failure documentation
- [x] Architecture gap analysis
- [x] Recovery planning (now superseded by comprehensive approach)

### **Current Analysis In Progress**
- [ ] Backend services analysis
- [ ] Frontend core components analysis
- [ ] State management layer analysis
- [ ] Data layer analysis
- [ ] UI components analysis
- [ ] Visualization components analysis
- [ ] Data flow mapping
- [ ] User workflow analysis

### **Analysis Deliverables**
- [ ] Complete component responsibility matrix
- [ ] End-to-end data flow diagrams
- [ ] User workflow documentation
- [ ] Architecture requirements specification
- [ ] Performance analysis
- [ ] Clean architecture design requirements

---

## 🚨 **ANALYSIS RULES**

### **DO NOT**
- ❌ Make any code changes
- ❌ Assume how things work without verification
- ❌ Skip any component or file
- ❌ Jump to solutions without complete understanding

### **DO**
- ✅ Read every component file
- ✅ Document actual behavior vs. intended behavior
- ✅ Map all data flows and dependencies
- ✅ Ask questions about anything unclear
- ✅ Document all findings systematically

---

## 📝 **NEXT STEPS**

1. **Systematic File Reading**: Read every component, store, and service file
2. **Component Analysis**: Document each component using the template
3. **Data Flow Mapping**: Trace complete data journeys
4. **Integration Analysis**: Understand how everything connects
5. **Requirements Definition**: Define what the new architecture must do
6. **Clean Architecture Design**: Phase 2 - Design the new system

---

**Analysis Started**: October 20, 2025  
**Methodology**: Comprehensive understanding before any changes  
**Success**: Complete system understanding and clean architecture requirements
