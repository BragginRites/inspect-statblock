const MODULE_ID = 'inspect-statblock';

// Import the settings menu FormApplication
import { DefaultVisibilityConfigApp } from './settings-menu.js';

/**
 * Simple FormApplication for the Clear All Flags button
 */
class ClearAllFlagsApp extends FormApplication {
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'clear-all-flags-dialog',
            title: 'Clear All Statblock Flags',
            width: 400,
            height: 'auto',
            classes: ['dialog'],
            submitOnChange: false,
            closeOnSubmit: true
        });
    }

    async render(force = false, options = {}) {
        // Skip the normal render process and show confirmation dialog directly
        const confirmed = await Dialog.confirm({
            title: "Clear All Statblock Flags",
            content: `
                <div style="margin-bottom: 1rem;">
                    <p><strong>⚠️ WARNING:</strong> This will permanently remove ALL visibility flags from ALL actors in your world.</p>
                    <p>This means:</p>
                    <ul style="margin-left: 1rem;">
                        <li>All statblock elements will return to their default visibility</li>
                        <li>Any custom hide/show settings will be lost</li>
                        <li>This action cannot be undone</li>
                    </ul>
                </div>
                <p><strong>Are you sure you want to continue?</strong></p>
            `,
            yes: () => true,
            no: () => false,
            defaultYes: false
        });
        
        if (confirmed) {
            await _clearAllInspectStatblockFlags();
        }
        
        return this;
    }
}

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

    // Clear all flags button - for testing and resetting module state
    game.settings.registerMenu(MODULE_ID, 'clearAllFlagsMenu', {
        name: 'Clear All Statblock Flags',
        label: 'Clear All Flags',
        hint: '⚠️ WARNING: This will remove ALL visibility flags from ALL actors. This action cannot be undone!',
        icon: 'fas fa-trash',
        type: ClearAllFlagsApp,
        restricted: true // GM only
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

/**
 * Clears all visibility flags from all actors in the world.
 * This is a utility function for resetting the module state.
 */
async function _clearAllInspectStatblockFlags() {
    console.log(`${MODULE_ID} | Starting to clear all visibility flags from all actors`);
    
    const actors = game.actors.contents;
    let clearedCount = 0;
    
    try {
        for (const actor of actors) {
            const currentFlags = actor.getFlag(MODULE_ID, 'hiddenElements');
            if (currentFlags && Object.keys(currentFlags).length > 0) {
                await actor.unsetFlag(MODULE_ID, 'hiddenElements');
                clearedCount++;
                console.log(`${MODULE_ID} | Cleared flags for actor: ${actor.name}`);
            }
        }
        
        console.log(`${MODULE_ID} | Successfully cleared flags from ${clearedCount} actors`);
        
        // Show success notification
        ui.notifications.info(`Cleared visibility flags from ${clearedCount} actors. All statblocks have been reset to default visibility.`);
        
        // Refresh all open statblock windows
        Object.values(ui.windows).forEach(app => {
            if (app.constructor.name === 'InspectStatblockApp') {
                console.log(`${MODULE_ID} | Refreshing open statblock window after flag clear`);
                app.render(true);
            }
        });
        
    } catch (error) {
        console.error(`${MODULE_ID} | Error clearing flags:`, error);
        ui.notifications.error(`Error clearing flags: ${error.message}`);
    }
} 