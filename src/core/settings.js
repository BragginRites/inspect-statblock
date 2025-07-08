const MODULE_ID = 'inspect-statblock';

// Import the settings menu FormApplication
import { DefaultVisibilityConfigApp } from './settings-menu.js';

/**
 * Registers all core settings for the Inspect Statblock module.
 */
export function registerCoreSettings() {
    console.log(`${MODULE_ID} | Registering core settings.`);

    // Register the settings menu button
    game.settings.registerMenu(MODULE_ID, 'defaultVisibilityMenu', {
        name: 'Default Visibility Settings',
        label: 'Configure Statblock Defaults',
        hint: 'Set which elements show by default in new statblocks',
        icon: 'fas fa-eye',
        type: DefaultVisibilityConfigApp,
        restricted: true // GM only
    });

    // Hidden setting to store all default visibility settings as an object
    game.settings.register(MODULE_ID, 'defaultVisibilitySettings', {
        scope: 'world',
        config: false,  // Hidden from normal settings UI
        type: Object,
        default: {},
        onChange: (value) => {
            console.log(`${MODULE_ID} | Default visibility settings updated:`, value);
            
            // Refresh all open statblock windows when defaults change
            Object.values(ui.windows).forEach(app => {
                if (app.constructor.name === 'InspectStatblockApp') {
                    console.log(`${MODULE_ID} | Refreshing open statblock window`);
                    app.render(true);
                }
            });
        }
    });

    // Flag storage mode: per-actor (shared) vs per-token (individual)
    game.settings.register(MODULE_ID, "flagStorageMode", {
        name: "Visibility Flag Storage Mode",
        hint: "Controls whether visibility flags are shared between tokens of the same actor (Per Actor) or stored individually per token (Per Token).",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "per-actor": "Per Actor (Shared - Default)",
            "per-token": "Per Token (Individual)"
        },
        default: "per-actor",
    });

    // Example setting (can be removed or repurposed later)
    game.settings.register(MODULE_ID, "enableDebugMode", {
        name: "Enable Debug Mode (Example)",
        hint: "Currently does nothing. Placeholder for future debug options.",
        scope: "client", // Changed to client as it's a debug option often per user
        config: true,
        type: Boolean,
        default: false,
    });
} 