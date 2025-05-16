# Active Effects Analysis for inspect-statblock

This document summarizes where and how "Active Effects" and related terms are used within the `inspect-statblock` module, based on codebase searches.

## 1. General Mentions of "Active Effect" (Case-Insensitive)

- **`TODO.md`**:
  - Line 8: `- [X] Active Effects (individual)`
- **`styles/statblock.css`**:
  - Line 301: `* Active Effects` (Comment for styling section)
- **`scripts/main.js`**:
  - Line 163: `'effects': { name: "Active Effects", keyPattern: "effect-", type: "group" },` (In `SECTIONS_FOR_DEFAULT_VISIBILITY`)
  - Line 732: `<div class="section-title">Active Effects</div>` (HTML for section title)
  - Line 744: `if (effectsToRender.length === 0) return '<div class="no-effects">No Active Effects</div>';` (Fallback display)
- **`README.md`**:
  - Line 46: `5. **Active Effects**: Displays currently active Active Effects. Mouse over for a tooltip.`
- **`CHANGELOG.md`**:
  - Line 33: `#### Active Effects`
  - Line 34: `- Added "Active Effects" section to the statblock`
  - Line 35: `- Added tooltips for active effects with detailed duration information`
  - Line 50: `- Support for Dynamic Active Effects (DAE) special durations`

## 2. "ActiveEffect" Class Name References (Case-Sensitive)

- **`scripts/main.js`**:
  - Line 249: `Hooks.on("createActiveEffect", effect => { ... });`
  - Line 253: `Hooks.on("updateActiveEffect", effect => { ... });`
  - Line 257: `Hooks.on("deleteActiveEffect", effect => { ... });`

  *Observation*: These are standard Foundry VTT hooks used to react to changes in Active Effects on an actor. All of them call `rerenderStatblock(actor)` where `actor` is `effect.parent`.

## 3. Usage of `.effects` Property

- **`scripts/main.js`**:
  - Line 368: `case 'effects': (actor.effects || []).forEach(effect => initialHiddenElements[\`\${config.keyPattern}\${effect.id}\`] = true); break;`
    - *Context*: Inside `createStatblockWindow`, during the initialization of `initialHiddenElements` for GMs if no flags are set. Uses the `actor` parameter.
  - Line 393: `case 'effects': (actor.effects || []).forEach(effect => defaultPlayerViewHiddenElements[\`\${config.keyPattern}\${effect.id}\`] = true); break;`
    - *Context*: Inside `createStatblockWindow`, during the initialization of `defaultPlayerViewHiddenElements` for players if no flags are set by GM. Uses the `actor` parameter.
  - Line 735: `console.log("Inspect Statblock | actor.effects (parameter) before map:", actor?.effects ? JSON.parse(JSON.stringify(actor.effects)) : "undefined or null"); // DEBUG`
    - *Context*: Debugging log in `createStatblockWindow`.
  - Line 736: `console.log("Inspect Statblock | currentActorInstance.effects before map:", currentActorInstance?.effects ? JSON.parse(JSON.stringify(currentActorInstance.effects)) : "undefined or null"); // DEBUG`
    - *Context*: Debugging log in `createStatblockWindow`.
  - Line 739: `const effectsSource = actor.effects; // <-- CHANGED TO actor.effects based on logs`
    - *Context*: Deciding the source for rendering effects in `createStatblockWindow`. Currently uses the `actor` parameter.
  - Line 918: `(actor.effects || []).forEach(effect => { flagsToShowAll[\`\${config.keyPattern}\${effect.id}\`] = false; });`
    - *Context*: Inside the "Show All Elements" title bar button handler, iterating over `actor.effects` (from the `actor` parameter of `createStatblockWindow`) to build `flagsToShowAll`.
  - Line 1017: `const effect = tag.actor ? tag.actor.effects.get(effectId) : null;`
    - *Context*: In `attachEffectTooltips`, trying to get an effect instance. `tag.actor` implies an actor object might be stored on the HTML element itself. If not, it's null.

## Summary of Interactions and Potential Problem Areas:

1.  **Data Sourcing for Rendering**:
    *   The primary rendering loop in `createStatblockWindow` currently uses `actor.effects` (where `actor` is the function parameter).
    *   Logs have shown this `actor` parameter has its `effects` collection populated on initial load (from `token.actor`) and when re-rendered due to `createActiveEffect`/`deleteActiveEffect` hooks (from `effect.parent`).
    *   The problem arises when re-rendering is triggered by `updateActor` hook (e.g., after a flag change for visibility). In this scenario, the `actor` object passed by the `updateActor` hook to `rerenderStatblock`, and subsequently to `createStatblockWindow`, seems to have an empty `effects` collection.
    *   Our attempt to fix this in `rerenderStatblock` by fetching `freshActor = game.actors.get(actor.id)` and passing *that* to `createStatblockWindow` also resulted in `freshActor.effects` being empty (as per your last observation before this analysis request, assuming the logs would have shown `actor.effects (parameter)` as empty during that re-render).

2.  **Data Sourcing for Default Flags**:
    *   When setting up default visibility flags (`initialHiddenElements` for GM, `defaultPlayerViewHiddenElements` for Player), the code iterates over `(actor.effects || [])`. This `actor` is the parameter to `createStatblockWindow`. If this occurs during a problematic re-render where `actor.effects` is empty, no default flags for individual effects would be initialized if the "Active Effects" section *itself* was set to default to hidden.

3.  **Data Sourcing for "Show All"**:
    *   The "Show All" button logic also iterates `(actor.effects || [])` to set all effect visibilities to `false`. If `actor.effects` is empty when "Show All" is clicked (due to a problematic re-render state), it won't correctly flag existing effects as visible.

4.  **Hooks**:
    *   `createActiveEffect`, `updateActiveEffect`, `deleteActiveEffect` all call `rerenderStatblock(effect.parent)`.
    *   The `updateActor` hook also calls `rerenderStatblock(actor)`. This is the one most likely implicated when a flag change (which is an actor update) causes effects to disappear because the `actor` it provides is minimal.

The core issue seems to be the inconsistency of the `effects` collection on the `actor` object received by `createStatblockWindow`, especially when the re-render is triggered by an `updateActor` hook that doesn't pass an actor object with fully populated embedded documents. The fact that `game.actors.get(actor.id).effects` also appears empty in these re-render scenarios is the most puzzling part and points to a deeper issue with data availability or timing in Foundry VTT's actor data lifecycle when accessed immediately after certain updates.

This analysis should give us a good overview. We need to ensure that the `actor` object used for rendering effects *always* has a populated `effects` collection. 