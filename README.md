# Inspect Statblock

A Foundry VTT module that displays creature statblocks in a custom floating window with real-time updates. No more repetitive stat recitations—your players can view the creature's stats at a glance. Passive features provide interactive tooltips, and multiple statblocks can remain open between scenes. Press **Alt+I** to close all open windows.

![image](https://github.com/user-attachments/assets/46e4c6bd-c967-4c21-91e1-df7280dae570)

Coffee helps me stay up to 2am to write these modules. Thank you for supporting the sleepless nights!

[![ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/bragginrites)

## Supported Systems

- **D&D 5e** (dnd5e 5.x and 6.x)
- **Pathfinder 2e** (pf2e 7.x on Foundry v13)

Requires Foundry VTT v13 or v14.

## Other Modules

Check out my other module(s):

- [BG3 Inspired HUD](https://github.com/BragginRites/bg3-inspired-hotbar)
- [Surge Dice - A Narrative Dice Pool](https://github.com/BragginRites/surge-dice)

## Quick Usage

- **Installation**:
  - **Option A**: Through the Foundry VTT Module Directory:
    1. Search for the module on the [Foundry VTT Module Directory](https://foundryvtt.com/packages/inspect-statblock/).
    2. Click **Install**.
  - **Option B**: Through the GitHub Repository:
    1. Copy the manifest URL:
       ```
       https://github.com/BragginRites/inspect-statblock/releases/latest/download/module.json
       ```
    2. Paste the URL into the **Install Module** field in the **Add-on Modules** section of Foundry VTT.
    3. Click **Install**.
- **Core Functionality**:
  - Target a token and press **I** to open its statblock.
  - Drag the statblock window—the position is remembered per actor.
  - Hover over passive features to see item tooltips.  
    - Middle-click a tooltip to pin it.
    - Middle-click a pinned tooltip to unpin it.
  - **GM Feature**: Right-click on statblock elements (like ability scores, HP, defenses, etc.) to toggle their visibility for players.
  - Press **Alt+I** to close all open statblock windows.

## Features

1. **Multiple Windows**: Each actor gets its own statblock window.
2. **Keybindings**:
   - Keybind is customisable from the Configure Controls menu in Foundry.
   - **I** to open and close a statblock.
   - **Alt+I** to close all statblocks.
3. **Player Character Support**: Displays level and class info, including multiclass setups.
4. **Dark Theme**: Sleek, draggable windows with a dark aesthetic.
5. **Active Effects**: Displays currently active Active Effects. Mouse over for a tooltip.
6. **Defense Grid**: Clearly displays resistances, immunities, vulnerabilities, and condition immunities.
7. **Passive Features**: Interactive tooltips for passive abilities. Mouse over for a tooltip.
8. **Auto-Reveal**: Features are revealed when used, and defenses when they affect damage (both can be turned off in settings).

### Pathfinder 2e

- Header with level, rarity, size and creature traits (ancestry and class for characters).
- AC, HP, Perception, Fortitude, Reflex and Will, speeds and attribute modifiers.
- Effects & Conditions (including condition values such as Frightened 2 and remaining duration).
- Immunities, Weaknesses and Resistances, shown with their values and exceptions.
- Passive Abilities and Actions & Reactions (with action cost; NPC strikes included).
- All of it can be hidden or revealed per element, with defaults in **Configure Statblock Defaults**.

## License

MIT
