const MODULE_ID = 'inspect-statblock';

/**
 * Registers all core settings for the Inspect Statblock module.
 */
export function registerCoreSettings() {
    console.log(`${MODULE_ID} | Registering core settings.`);

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