## Issues Found
Template:
### Issue N: [Description]
- Severity: BLOCKING / NON-BLOCKING
- Impact: [What doesn't work]
- Next task affected: YES / NO
- Status: FIXED / DEFERRED / DOCUMENTED
- Logs/Behavior: 
---

## Issues Found

### Issue 1: [Visualisaions broken/missing]
- Severity: BLOCKING /
- Impact: [Traders cannot trade without complete or accuarate visualisations]
- Next task affected: YES 
- Status: FIXED
- Logs/Behavior: 
Issue -1-: dayRangeMeter:When resizing, canvas visible area does not update to show entire container - stays at the initialised size. Note: visualisation elements do scale accurately, but get cut off/not rendered outside of intial size. 


### Issue 2: [Visualisaions broken/missing]
- Severity: BLOCKING /
- Impact: [Traders cannot trade without complete or accuarate visualisations]
- Next task affected: YES 
- Status: FIXED
- Logs/Behavior: 
Issue -1-: dayRangeMeter: High and low markers not plotting. Check accuracy of all plots using OHLC to ensure total accuracy and reliability. 

### Issue 3: [Visualisaions broken/missing]
- Severity: BLOCKING /
- Impact: [Traders cannot trade without complete or accuarate visualisations]
- Next task affected: YES 
- Status: FIXED
- Logs/Behavior: 
Issue -1-: dayRangeMeter: Symbols other than FX do not show Low or Close. They do show Open and High. Unsure consistency and accuracy for all dispalys in simple front end and compliance to our principles and ptactices,


### Issue 4: [Visualisaions broken/missing]
- Severity: BLOCKING /
- Impact: [Traders cannot trade without complete or accuarate visualisations]
- Next task affected: YES 
- Status: DOCUMENTED
- Logs/Behavior: 
Issue -1-: canvas display area does not match container on resize. Previously we had a fix for this - so recently introduced. 
    -2-: dayRangeMeter: Initial rendering shows total 125% ADR height, not starting at 50%ADR height with progressive disclosure. 
    -3-: red 50%ADR borders do not cover full width of canvas.

### Issue 5: [Visualisaions broken/missing]
- Severity: BLOCKING /
- Impact: [Traders cannot trade without complete or accuarate visualisations]
- Next task affected: YES 
- Status: DOCUMENTED
- Logs/Behavior: 
Issue -1-: canvas display area does not match container on resize. Previously we had a fix for this - so recently introduced. 
    -2-: dayRangeMeter: Initial rendering shows total 125% ADR height, not starting at 50%ADR height with progressive disclosure. 
    -3-: red 50%ADR borders do not cover full width of canvas.


### Issue 6: [Market profile implementation incomplete]
- Severity: BLOCKING / 
- Impact: [Traders cannot trade without market profile]
- Next task affected: YES 
- Status: DOCUMENTED
- Logs/Behavior: 
    -1- MARKET PROFILE AND DAY RANGE METER yscale not matching. 
        - Day range meter look compressed in y axis
        - Market profile unclear, possible also compressed into narrow y range. 

    DESIRED BEHAVIOUR: Day Range meter is the standard and basis for all other displays.Desired: all displays use the same functions as market profile for yaxis. 
    
    LOGS:
  ---
 BUG: Behaviour: Canvas loads showing market profile (incorrect y scale plotting) _> alt + M switch to day range meter _> day range
  meter showing incorrect yaxis ADR plotting (possibly only showing live tick data and not ADR data) _> browser reload _> day range
  meter plotting correct _> alt+M to show market profile _> "WAITING FOR DATA:".  

  Evaluate and explain back to me the data pipeline, it's intialisation and state management now we have implemented market profile. It is broken after market profile implementation.  

  Evaluate market profile data methods and patterns for complaince to our principles. If needed track day range meter file changes/refer to commited versions - as they must be great, complian examples for market profile to be reused. Use agents.
---
  BUG: Market profile rendering does not match day range meter. Resulting in non compliant rendering of market profile - it does not use the same rendering as day range meter. 

    Evaluate and explain back to me the rendering and yaxis plotting of day range meter.  It is the standard for this project and all other visualisations must use it. 
    THen analyse market profile and it's rendering  - it must exaclty match day range meter's y axis plotting and all other display element methods. 

    This ensures total compliance and consistency between displays for traders . 

---
    PROBLEM:
    We have implemented the market profile recently, and it has rendering issues.
    We need this TO BE display intialisation and rendering workflow: 
    -1- original canvas initialisation (pre market profile):  symbol creation -> only day range meter initilises and shows -> trader 'alt+M', turns market profile on. Market profile shows along with day range meter in exact same canvas and plotting. 

    We have issues with market profile visualisation by itself, so we re-instate day range meter as the default, then market profile will plot along with it using exact same price coordinates, y scale, everything. 
    MARKET PROFILE Display specification: Market profile. Uses the same adraxis config as day range meter, and extends to the right filling to canvas edge. (no padding) 
    
    Evaluate and explain to me the initialisation and canvas rendering intended state, and how you will use agents to ensure it is compliant to our philosophy. 
    Use agents. 

    ---

    Required - new implementation and rendering design for market profile.
    New state: symbol creation _> day range meter starts as singlular display for traders setting price ylocations and adr locations etc._> trader switches on market profile, and it *ADDS* to day range meter display, extending right from adr axis. 

    If this is the ACTUAL reality or not, it your architechtural choice. 

    EXACT Market Profile rendering Specifications: each market profile line is intialised and plotted on the exact adraxis and it's y values. Literally every market profile line's origin is on the axis (x location) and at the exact same price as  the day range meter's price. It then extends right towards the edge of canvas, widest market profile line (highest volume)  touches the exact right edge of the canvas/container.  

    Conecptually I don't see why the architeture is this: 
    Isolated - Market profile calculations (volume at price) 
    Isolated - Day range meter establishes canvas:  calculations and intialisation of canvas and adr axis and ylocations etc.
    Market profile data is then plotted using the day range meter canva and all of it's config (adraxis location, etc, price ylocation) 
    Simple. 
    Explain to me and evaluate against our current architecture and this target state. 
    I see this as a simple 2 step implementation: 
    -1- reinstate original day range meter canvas intialisation etc.
    -2- figure out how to plot the market profile data to match it. 
    We should have existing patterns, functions etc that are compliant and that we can utilise.  

    