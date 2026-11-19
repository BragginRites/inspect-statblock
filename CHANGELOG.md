## [Unreleased]
### Added
- **Pathfinder 2e support** (pf2e 7.x, Foundry v13). The statblock shows name, level, rarity, size and traits (ancestry and class for characters), AC, HP, Perception and saves, speeds, attribute modifiers, effects and conditions, immunities/weaknesses/resistances, passive abilities, and actions with their action cost. Every element can be hidden or revealed per actor or token, with the same inheritance and placeholder options as dnd5e.
  - Defaults for every pf2e element in the Default Visibility menu.
  - Auto-reveal: an ability is revealed when it's posted to chat, and an immunity, weakness or resistance is revealed when pf2e applies it to damage.
  - Tooltips show the enriched item description (GM-only secret blocks stay hidden from players), with the usual middle-click pinning.
  - Generic exploration and downtime activities (Search, Treat Wounds, …) aren't listed as abilities. Unidentified effects keep their name hidden from players.
  - Not covered: condition immunities aren't auto-revealed, because pf2e drops a condition the creature is immune to before any hook sees it.
- System handlers can provide their Default Visibility options with `getDefaultSettingGroups()`.

### Changed
- **Foundry v13 and v14**: The statblock window, Default Visibility menu and Clear All dialog now use ApplicationV2/DialogV2. Removed jQuery and deprecated globals (`renderTemplate`, `loadTemplates`, `TooltipManager`, `Dialog`, `FormApplication`). Foundry v12 is no longer supported. Targets dnd5e 5.x and 6.x.
- **Tooltips**: Statblock entries use dnd5e's native rich tooltips. The module no longer replaces dnd5e's item tooltip template or patches tooltip methods for the whole game. Middle-click to pin, drag to move and right-click to dismiss still work.
- **Debug logging**: Console output is off by default. "Enable Debug Logging" (previously a placeholder setting) turns it on.
- **Code layout**: dnd5e-specific code moved out of core. The dnd5e handler is split into data, visibility and auto-reveal files.

### Fixed
- Unlinked tokens showed the world actor's HP instead of the token's own HP.
- HP of 0 was not displayed.
- Auto-reveal on feature use never worked for features with activities (they use a different element key). It now also works when a player uses the feature.
- Auto-reveal on use ignored the "Auto-Reveal Features on Use" setting.
- Auto-reveal on damage revealed resistances that a bypass (e.g. magical weapons) had ignored. It now uses dnd5e's record of which defenses actually applied.
- Automation hooks ran on every connected client, causing permission errors for players and duplicate writes with several GMs. World-level automation now runs on the active GM only.
- "Per Token" storage wrote auto-reveals somewhere the statblock never read, so they didn't show.
- Defense tags appeared visible to the GM while players saw them as hidden (category inheritance was applied to players only).
- Right-clicking an element hidden only by default did nothing on the first click.
- Right-clicking the Active Features header didn't toggle its features. Passive Features header used a different rule than the list it toggled.
- New features never received default visibility (the check failed on dnd5e's item collection), and active features ignored the Active Features default.
- The statblock didn't refresh when items or effects were added, changed or removed.
- Show All / Hide All buttons had no tooltip text (missing localization keys).
- "None" never appeared for the GM on empty sections and defense categories.
- Temporary effects from items (e.g. Rage) were missing from Active Effects.
- Clear All missed per-token data stored on unlinked tokens.
- Removed generic global Handlebars helpers (`test`, `sum`) that could clash with other modules.
- Auto-reveal on damage never revealed anything on dnd5e 5.x, which records the applied defenses under a different key.

## [1.0.2] - 2025-08-16
### Fixed
- **Visibility Defaults**: Can now set for individual ability scores. Also fixed the bugs generally across the board
- **Auto Reveal**: Can now as a setting turn on auto-reveal when the actor recieves damage or a condition that they are resistant, vulnerable or immune to
- **Passive vs Active Features**: Added a two sections for these

## [1.0.1] - 2025-07-10
### Fixed
- **Visibility Defaults**: Fixed an issue where the default visibility settings were not being applied correctly. Now visibilities for new base actors are set when they are created on the canvas rather than when first inspected. (Related issue: #10)



## [1.0.0] - 2025-07-10
Complete rewrite of the module to support multiple systems via a new System Adapter API.

## [0.4.2] - 2025-05-16

### Changed
- Updated DnD5e system minimum version to `3.3.1`.
- Removed maximum Foundry VTT version compatibility for testing purposes.

## [0.4.1] - 2025-05-16

### Fixed
- **HP Display**: Corrected an issue where Health Points (current, temporary, and max HP modifiers) on the statblock might not update immediately or could revert to a base state after other interactions (like toggling visibility of elements or changes to active effects). The statblock now more reliably sources the latest HP data for display during re-renders.

## [0.4.0] - 2025-05-16

### Added
#### Element Visibility Controls (GM Feature)
- **Individual Toggling**: GMs can now right-click most elements within a statblock (like ability scores, HP, AC, passive features, active effects, defenses, etc.) to toggle their visibility for players.
- **Visual Indicators for GM**: When an element is hidden from players, GMs will see it with a distinct purple dashed border and reduced opacity.
- **Player View of Hidden Elements**: Players will see "???" in place of any information the GM has chosen to hide.
- **"Show All" / "Hide All" Buttons**: Quick controls have been added to the statblock title bar for GMs to reveal or hide all toggleable elements at once.
- **Default Visibility Settings**: New module settings allow GMs to define the default visibility (shown or hidden) for major sections of the statblock when it's first opened for an actor or when new elements (like new active effects) appear.

### Removed
- Removed the global "Hide HP Information" setting, as HP visibility is now controllable per-actor via the new right-click toggle and default section visibility settings.

## [0.3.2] - 2025-04-21

### Changed
- changed system requirmenet to dnd5e 4.0.0 or higher

## [0.3.1] - 2025-04-16

### Fixed
#### Path to module download
- Fixed the path to the module download in the module.json file

## [0.3.0] - 2025-03-13

### Added
#### Portrait Window
- Added a portrait popout to the statblock when you click on the creature
- Added toggle button to portrait window to manually switch sides
- Portrait window appears to the left of the statblock when clicking the creature name
- Closing the statblock will also close the portrait window

### Improved
#### Statblock Window
- Statblock window now defaults to appearing on the right side of the screen near the chat tab rather than the center of screen
- Pressing the keybind while targeting an actor whose statblock is already open will now close that statblock
- Removed resizer from the statblock window. It wasn't fitting my aesthetic

#### Tooltips
- Fixed tooltip enrichers to properly handle inline rolls, links, and other Foundry content
- Underlined them to make them more readable like a clickable link

## [0.2.0] - 2025-03-12

### Added
#### Active Effects
- Added "Active Effects" section to the statblock
- Added tooltips for active effects with detailed duration information

#### Settings
- Added GM privacy settings:
  - Option to hide special duration conditions
  - Option to hide HP information (current HP, temporary HP, and temporary max HP)

### Improved
#### Display Formatting
- Improved Challenge Rating display:
  - Fractional CR values now show in traditional format (e.g., "1/4" instead of "0.25")
- Increased Armor Class font size to 32px for better readability

#### Effect Display
- Enhanced effect duration display:
  - Support for Dynamic Active Effects (DAE) special durations
  - Improved wording for special conditions (e.g. "Expires when the target makes a Dexterity saving throw")
  - Clear distinction between time-based events (e.g. "Expires when the next day begins") and target-based conditions
  - Combined duration display for effects with multiple conditions

### [0.1.0] (2025-03-12)

- Initial release
- Multiple statblock window support
- Player character level and class display
- Defense grid showing resistances, immunities, vulnerabilities and condition immunities
- Interactive tooltips for passive features
- Window position memory per actor
- Dark theme and draggable windows
- Alt+I shortcut to close all windows
