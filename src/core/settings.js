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

    // Auto-reveal behavior toggles
    game.settings.register(MODULE_ID, "autoRevealOnDamage", {
        name: "Auto-Reveal Defenses on Damage",
        hint: "When enabled, taking damage of a type will automatically reveal matching defenses (resistance, immunity, vulnerability).",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
    });

    game.settings.register(MODULE_ID, "autoRevealOnFeatureUse", {
        name: "Auto-Reveal Feature on Use",
        hint: "When enabled, using a feature will automatically reveal it in the statblock.",
        scope: "world",
        config: true,
        type: Boolean,
        default: true,
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
    console.log(`${MODULE_ID} | Starting to clear ALL Inspect Statblock data (actors + tokens)`);

    const actors = game.actors?.contents ?? [];
    const scenes = game.scenes?.contents ?? [];
    let actorsCleared = 0;
    let tokensCleared = 0;

    try {
        // Clear on all Actor documents: remove the entire module flag object
        for (const actor of actors) {
            // actor.flags is a plain object; ensure the module namespace exists by either
            // reading flags[MODULE_ID] or getFlag (which initializes proxy accessors in v13)
            const moduleFlags = actor.flags?.[MODULE_ID] ?? actor.getFlag(MODULE_ID);
            if (moduleFlags && Object.keys(moduleFlags).length > 0) {
                await actor.update({ [`flags.${MODULE_ID}`]: null }, { diff: false });
                // As a fallback for some versions, also try unsetting known sub-keys
                await actor.unsetFlag(MODULE_ID, 'hiddenElements');
                actorsCleared++;
                console.log(`${MODULE_ID} | Cleared module data for actor: ${actor.name}`);
            }
        }

        // Clear on all TokenDocuments across all scenes (per-token storage)
        for (const scene of scenes) {
            const tokenDocs = scene.tokens?.contents ?? [];
            for (const token of tokenDocs) {
                const moduleFlags = token.flags?.[MODULE_ID] ?? token.getFlag?.(MODULE_ID);
                if (moduleFlags && Object.keys(moduleFlags).length > 0) {
                    await token.update({ [`flags.${MODULE_ID}`]: null }, { diff: false });
                    await token.unsetFlag?.(MODULE_ID, 'hiddenElements');
                    tokensCleared++;
                    console.log(`${MODULE_ID} | Cleared module data for token: ${token.name} (scene: ${scene.name})`);
                }
            }
        }

        console.log(`${MODULE_ID} | Cleared Inspect Statblock data from ${actorsCleared} actors and ${tokensCleared} tokens.`);

        ui.notifications.info(`Inspect Statblock: Cleared data for ${actorsCleared} actors and ${tokensCleared} tokens.`);

        // Refresh all open statblock windows
        Object.values(ui.windows).forEach(app => {
            if (app.constructor.name === 'InspectStatblockApp') {
                app.render(true);
            }
        });

    } catch (error) {
        console.error(`${MODULE_ID} | Error clearing Inspect Statblock data:`, error);
        ui.notifications.error(`Error clearing data: ${error.message}`);
    }
}