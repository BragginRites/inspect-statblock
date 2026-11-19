/**
 * @fileoverview Default visibility configuration window (ApplicationV2 form).
 */

import { MODULE_ID } from './constants.js';
import { log } from './logger.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * D&D 5e default-visibility options, grouped as they appear in the form.
 * Labels are localization keys.
 */
const DND5E_SETTING_GROUPS = [
    {
        id: 'header', icon: 'fa-id-card',
        settings: ['headerName', 'headerCrLevel', 'headerSize', 'headerType']
    },
    {
        id: 'combat', icon: 'fa-shield-halved',
        settings: ['ac', 'health']
    },
    {
        id: 'movement', icon: 'fa-person-running',
        settings: ['movementWalk', 'movementFly', 'movementSwim', 'movementClimb', 'movementBurrow']
    },
    {
        id: 'abilities', icon: 'fa-dice-d20',
        settings: ['abilityStr', 'abilityDex', 'abilityCon', 'abilityInt', 'abilityWis', 'abilityCha']
    },
    {
        id: 'defenses', icon: 'fa-shield',
        settings: ['defenseResistances', 'defenseImmunities', 'defenseVulnerabilities', 'defenseConditions']
    },
    {
        id: 'features', icon: 'fa-wand-magic-sparkles',
        settings: ['activeEffectsSection', 'passiveFeaturesSection', 'activeFeaturesSection']
    }
];

export class DefaultVisibilityConfigApp extends HandlebarsApplicationMixin(ApplicationV2) {

    static DEFAULT_OPTIONS = {
        id: 'inspect-statblock-defaults-config',
        tag: 'form',
        classes: [MODULE_ID, 'defaults-config'],
        window: {
            title: 'INSPECTSTATBLOCK.DefaultsConfig.Title',
            icon: 'fa-solid fa-eye',
            resizable: true
        },
        position: {
            width: 600,
            height: 'auto'
        },
        form: {
            handler: DefaultVisibilityConfigApp.#onSubmit,
            closeOnSubmit: true
        },
        actions: {
            toggleChip: DefaultVisibilityConfigApp.#onToggleChip,
            toggleAllOn: DefaultVisibilityConfigApp.#onToggleAllOn,
            toggleAllOff: DefaultVisibilityConfigApp.#onToggleAllOff
        }
    };

    static PARTS = {
        form: {
            template: `modules/${MODULE_ID}/templates/default-visibility-config.hbs`
        }
    };

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        const current = game.settings.get(MODULE_ID, 'defaultVisibilitySettings') || {};
        const isDnd5e = game.system.id === 'dnd5e';

        context.systemId = game.system.id;
        context.groups = isDnd5e ? DND5E_SETTING_GROUPS.map(group => ({
            label: `INSPECTSTATBLOCK.DefaultsConfig.Groups.${group.id}.Label`,
            hint: `INSPECTSTATBLOCK.DefaultsConfig.Groups.${group.id}.Hint`,
            icon: group.icon,
            settings: group.settings.map(id => {
                const key = `dnd5e-showDefault-${id}`;
                return {
                    key,
                    label: `INSPECTSTATBLOCK.DefaultsConfig.Settings.${id}`,
                    enabled: current[key] ?? true
                };
            })
        })) : [];
        context.totalSettings = context.groups.reduce((n, g) => n + g.settings.length, 0);
        return context;
    }

    static #setChip(chip, enabled) {
        chip.classList.toggle('active', enabled);
        chip.setAttribute('aria-pressed', String(enabled));
        const input = chip.querySelector('input[type="hidden"]');
        if (input) input.value = String(enabled);
    }

    static #onToggleChip(event, target) {
        DefaultVisibilityConfigApp.#setChip(target, !target.classList.contains('active'));
    }

    static #onToggleAllOn() {
        this.element.querySelectorAll('.chip').forEach(chip => DefaultVisibilityConfigApp.#setChip(chip, true));
    }

    static #onToggleAllOff() {
        this.element.querySelectorAll('.chip').forEach(chip => DefaultVisibilityConfigApp.#setChip(chip, false));
    }

    static async #onSubmit(event, form, formData) {
        const settings = {};
        for (const [name, value] of Object.entries(formData.object)) {
            if (!name.startsWith('setting-')) continue;
            settings[name.slice('setting-'.length)] = String(value) === 'true';
        }
        try {
            await game.settings.set(MODULE_ID, 'defaultVisibilitySettings', settings);
            ui.notifications.info(game.i18n.localize('INSPECTSTATBLOCK.DefaultsConfig.Saved'));
        } catch (err) {
            log.error('Error saving default visibility settings:', err);
            ui.notifications.error(game.i18n.localize('INSPECTSTATBLOCK.DefaultsConfig.SaveFailed'));
        }
    }
}
