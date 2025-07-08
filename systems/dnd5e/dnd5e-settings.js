const MODULE_ID = 'inspect-statblock';

/**
 * Registers all DnD5e-specific settings for the Inspect Statblock module.
 * Note: Individual visibility settings are now managed through the chip interface
 * and stored in the 'defaultVisibilitySettings' object setting.
 */
export function registerDnd5eSettings() {
    console.log(`${MODULE_ID} | Registering DnD5e-specific settings.`);

    // Defense tag placeholder mode setting
    game.settings.register(MODULE_ID, "dnd5e-defensePlaceholderMode", {
        name: "Defense Placeholders",
        hint: "Controls how hidden defense tags are represented to players. 'Individual': a '??' for each hidden tag. 'Persistent Single': one '??' at the end if any tags are present or hidden.",
        scope: "world",
        config: true,
        type: String,
        choices: {
            "individualPlaceholders": "Individual Placeholders (?? per hidden tag)",
            "persistentSinglePlaceholder": "Persistent Single Placeholder (One ?? at end)"
        },
        default: "individualPlaceholders",
        onChange: value => { 
            // Force refresh of open statblocks when this setting changes
            Object.values(ui.windows).forEach(app => {
                if (app.constructor.name === 'InspectStatblockApp' && app.actor?.system?.id === 'dnd5e') {
                    app.render(true);
                }
            });
        }
    });

    console.log(`${MODULE_ID} | DnD5e settings registration complete.`);
} 