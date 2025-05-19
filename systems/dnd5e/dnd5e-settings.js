const MODULE_ID = 'inspect-statblock'; // Assuming settings are still namespaced under the main module ID

/**
 * Registers all DnD5e-specific settings for the Inspect Statblock module.
 */
export function registerDnd5eSettings() {
    console.log(`${MODULE_ID} | Registering DnD5e-specific settings.`);

    const dnd5eVisibilitySettings = [
        { keySuffix: "dnd5e-showDefault-headerName", name: "D5E Default: Show Name", hint: "Show the creature's name by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-headerCrLevel", name: "D5E Default: Show CR/Level", hint: "Show CR (for NPCs) or Level (for PCs) by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-headerSize", name: "D5E Default: Show Size", hint: "Show creature size (e.g., Large, Medium) by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-headerType", name: "D5E Default: Show Type/Class", hint: "Show creature type (e.g., Ooze, Humanoid) or class information by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-ac", name: "D5E Default: Show Armor Class", hint: "Show Armor Class section by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-movementWalk", name: "D5E Default: Show Walk Speed", hint: "Show Walk speed by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-movementFly", name: "D5E Default: Show Fly Speed", hint: "Show Fly speed by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-movementSwim", name: "D5E Default: Show Swim Speed", hint: "Show Swim speed by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-movementClimb", name: "D5E Default: Show Climb Speed", hint: "Show Climb speed by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-movementBurrow", name: "D5E Default: Show Burrow Speed", hint: "Show Burrow speed by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-health", name: "D5E Default: Show Health", hint: "Show Health section by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-abilities", name: "D5E Default: Show Ability Scores", hint: "Show all Ability Scores by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-activeEffectsSection", name: "D5E Default: Show Active Effects Section", hint: "Show the entire Active Effects section by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-defensesSection", name: "D5E Default: Show Defenses Section", hint: "Show the entire Defenses section wrapper by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-defenseResistances", name: "D5E Default: Show Damage Resistances", hint: "Show the Damage Resistances category by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-defenseImmunities", name: "D5E Default: Show Damage Immunities", hint: "Show the Damage Immunities category by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-defenseVulnerabilities", name: "D5E Default: Show Damage Vulnerabilities", hint: "Show the Damage Vulnerabilities category by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-defenseConditions", name: "D5E Default: Show Condition Immunities", hint: "Show the Condition Immunities category by default for D&D5e actors." },
        { keySuffix: "dnd5e-showDefault-passiveFeaturesSection", name: "D5E Default: Show Features Section", hint: "Show the entire Features section by default for D&D5e actors." },
    ];

    for (const setting of dnd5eVisibilitySettings) {
        game.settings.register(MODULE_ID, setting.keySuffix, {
            name: setting.name, 
            hint: setting.hint, 
            scope: "world",
            config: true,
            type: Boolean,
            default: true,
        });
    }

    // New setting for defense tag placeholder mode
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
            // Optional: Force a refresh of open statblocks if needed, though typically re-opening is fine.
            Object.values(ui.windows).forEach(app => {
                if (app.constructor.name === 'InspectStatblockApp' && app.actor?.system?.id === 'dnd5e') {
                    app.render(true);
                }
            });
        }
    });
} 