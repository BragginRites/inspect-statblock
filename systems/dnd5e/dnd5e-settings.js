import { MODULE_ID } from '../../src/core/constants.js';
import { refreshOpenStatblocks } from '../../src/core/open-apps.js';

/**
 * Registers D&D 5e-specific settings. Per-element default visibility is stored in
 * the core 'defaultVisibilitySettings' object (see the Default Visibility menu).
 */
export function registerDnd5eSettings() {
    game.settings.register(MODULE_ID, 'dnd5e-defensePlaceholderMode', {
        name: 'INSPECTSTATBLOCK.Settings.PlaceholderMode.Name',
        hint: 'INSPECTSTATBLOCK.Settings.PlaceholderMode.Hint',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            individualPlaceholders: 'INSPECTSTATBLOCK.Settings.PlaceholderMode.Individual',
            persistentSinglePlaceholder: 'INSPECTSTATBLOCK.Settings.PlaceholderMode.Persistent'
        },
        default: 'individualPlaceholders',
        onChange: () => refreshOpenStatblocks()
    });
}
