const MODULE_ID = 'inspect-statblock';

/**
 * Hardcoded D&D 5e settings for initial testing.
 */
const HARDCODED_DND5E_SETTINGS = [
    { keySuffix: "dnd5e-showDefault-headerName", name: "Name", hint: "Show creature name by default" },
    { keySuffix: "dnd5e-showDefault-headerCrLevel", name: "CR/Level", hint: "Show CR or level by default" },
    { keySuffix: "dnd5e-showDefault-headerSize", name: "Size", hint: "Show creature size by default" },
    { keySuffix: "dnd5e-showDefault-headerType", name: "Type/Class", hint: "Show type or class by default" },
    { keySuffix: "dnd5e-showDefault-ac", name: "Armor Class", hint: "Show AC by default" },
    { keySuffix: "dnd5e-showDefault-movementWalk", name: "Walk Speed", hint: "Show walk speed by default" },
    { keySuffix: "dnd5e-showDefault-movementFly", name: "Fly Speed", hint: "Show fly speed by default" },
    { keySuffix: "dnd5e-showDefault-movementSwim", name: "Swim Speed", hint: "Show swim speed by default" },
    { keySuffix: "dnd5e-showDefault-movementClimb", name: "Climb Speed", hint: "Show climb speed by default" },
    { keySuffix: "dnd5e-showDefault-movementBurrow", name: "Burrow Speed", hint: "Show burrow speed by default" },
    { keySuffix: "dnd5e-showDefault-health", name: "Health", hint: "Show health by default" },
    // Ability scores (split per ability)
    { keySuffix: "dnd5e-showDefault-abilityStr", name: "Strength", hint: "Show Strength by default" },
    { keySuffix: "dnd5e-showDefault-abilityDex", name: "Dexterity", hint: "Show Dexterity by default" },
    { keySuffix: "dnd5e-showDefault-abilityCon", name: "Constitution", hint: "Show Constitution by default" },
    { keySuffix: "dnd5e-showDefault-abilityInt", name: "Intelligence", hint: "Show Intelligence by default" },
    { keySuffix: "dnd5e-showDefault-abilityWis", name: "Wisdom", hint: "Show Wisdom by default" },
    { keySuffix: "dnd5e-showDefault-abilityCha", name: "Charisma", hint: "Show Charisma by default" },
    { keySuffix: "dnd5e-showDefault-activeEffectsSection", name: "Active Effects", hint: "Show active effects section by default" },

    { keySuffix: "dnd5e-showDefault-defenseResistances", name: "Resistances", hint: "Show damage resistances by default" },
    { keySuffix: "dnd5e-showDefault-defenseImmunities", name: "Immunities", hint: "Show damage immunities by default" },
    { keySuffix: "dnd5e-showDefault-defenseVulnerabilities", name: "Vulnerabilities", hint: "Show damage vulnerabilities by default" },
    { keySuffix: "dnd5e-showDefault-defenseConditions", name: "Condition Immunities", hint: "Show condition immunities by default" },
    { keySuffix: "dnd5e-showDefault-passiveFeaturesSection", name: "Passive Features", hint: "Show passive features by default" },
    { keySuffix: "dnd5e-showDefault-activeFeaturesSection", name: "Active Features", hint: "Show active features by default" }
];

/**
 * FormApplication for configuring default visibility settings with chip interface.
 */
export class DefaultVisibilityConfigApp extends FormApplication {
    
    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: 'inspect-statblock-defaults-config',
            title: 'Configure Default Visibility',
            template: 'modules/inspect-statblock/templates/default-visibility-config.hbs',
            width: 600,
            height: 'auto',
            classes: ['inspect-statblock', 'defaults-config'],
            closeOnSubmit: true,
            submitOnChange: false,
            resizable: true
        });
    }

    /**
     * Prepare data for the template.
     */
    async getData(options = {}) {
        const currentDefaults = game.settings.get(MODULE_ID, 'defaultVisibilitySettings') || {};
        
        // Map hardcoded settings to template data
        const settings = HARDCODED_DND5E_SETTINGS.map(setting => ({
            key: setting.keySuffix,
            name: setting.name,
            hint: setting.hint,
            enabled: currentDefaults[setting.keySuffix] ?? true // Default to true if not set
        }));

        // Calculate toggle all states
        const hasAllEnabled = settings.every(s => s.enabled);
        const hasAllDisabled = settings.every(s => !s.enabled);

        return {
            systemId: game.system.id,
            settings: settings,
            hasAllEnabled: hasAllEnabled,
            hasAllDisabled: hasAllDisabled,
            totalSettings: settings.length
        };
    }

    /**
     * Activate event listeners.
     */
    activateListeners(html) {
        super.activateListeners(html);
        
        // Handle chip clicks - exactly like bg3-hotbar
        html.find('.chip').on('click', event => {
            event.preventDefault();
            const chip = event.currentTarget;
            chip.classList.toggle('active');
            
            // Update the hidden input value
            const hiddenInput = chip.querySelector('input[type="hidden"]');
            if (hiddenInput) {
                hiddenInput.value = chip.classList.contains('active');
            }
        });
        
        // Toggle all buttons
        html.find('[data-action="toggle-all-on"]').on('click', this._onToggleAllOn.bind(this));
        html.find('[data-action="toggle-all-off"]').on('click', this._onToggleAllOff.bind(this));
    }

    /**
     * Toggle all settings on.
     */
    _onToggleAllOn(event) {
        event.preventDefault();
        
        const chips = this.element.find('.chip');
        chips.each((i, chip) => {
            chip.classList.add('active');
            const input = chip.querySelector('input[type="hidden"]');
            if (input) input.value = 'true';
        });
        
        console.log(`${MODULE_ID} | Toggled all settings ON`);
    }

    /**
     * Toggle all settings off.
     */
    _onToggleAllOff(event) {
        event.preventDefault();
        
        const chips = this.element.find('.chip');
        chips.each((i, chip) => {
            chip.classList.remove('active');
            const input = chip.querySelector('input[type="hidden"]');
            if (input) input.value = 'false';
        });
        
        console.log(`${MODULE_ID} | Toggled all settings OFF`);
    }

    /**
     * Handle form submission to save settings.
     */
    async _updateObject(event, formData) {
        const settings = {};
        
        // Convert form data to settings object
        for (const [key, value] of Object.entries(formData)) {
            if (key.startsWith('setting-')) {
                const settingKey = key.replace('setting-', '');
                settings[settingKey] = value === 'true';
            }
        }
        
        console.log(`${MODULE_ID} | Saving default visibility settings:`, settings);
        
        try {
            await game.settings.set(MODULE_ID, 'defaultVisibilitySettings', settings);
            ui.notifications.info('Default visibility settings saved successfully!');
        } catch (error) {
            console.error(`${MODULE_ID} | Error saving settings:`, error);
            ui.notifications.error('Failed to save settings. See console for details.');
        }
    }
} 