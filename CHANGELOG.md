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
