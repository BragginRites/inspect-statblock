import { MODULE_ID } from '../../src/core/constants.js';
import { refreshOpenStatblocks } from '../../src/core/open-apps.js';

/**
 * Pathfinder 2e default-visibility options, grouped as they appear in the
 * Default Visibility form. Ids map to `pf2e-showDefault-<id>` keys.
 */
const SETTING_GROUPS = [
    { id: 'header', icon: 'fa-id-card', settings: ['headerName', 'headerLevel', 'headerRarity', 'headerSize', 'headerTraits'] },
    { id: 'combat', icon: 'fa-shield-halved', settings: ['ac', 'health', 'perception', 'saveFortitude', 'saveReflex', 'saveWill'] },
    { id: 'movement', icon: 'fa-person-running', settings: ['movementLand', 'movementFly', 'movementSwim', 'movementClimb', 'movementBurrow'] },
    { id: 'abilities', icon: 'fa-dice-d20', settings: ['abilityStr', 'abilityDex', 'abilityCon', 'abilityInt', 'abilityWis', 'abilityCha'] },
    { id: 'defenses', icon: 'fa-shield', settings: ['defenseImmunities', 'defenseWeaknesses', 'defenseResistances'] },
    { id: 'features', icon: 'fa-wand-magic-sparkles', settings: ['effectsSection', 'passiveFeaturesSection', 'actionsSection'] }
];

/**
 * Groups for the Default Visibility form (SystemHandler.getDefaultSettingGroups).
 * @returns {Array<{id: string, icon: string, label: string, hint: string, settings: Array<{key: string, label: string}>}>}
 */
export function getPf2eDefaultSettingGroups() {
    const root = 'INSPECTSTATBLOCK.Pf2e.DefaultsConfig';
    return SETTING_GROUPS.map(group => ({
        id: group.id,
        icon: group.icon,
        label: `${root}.Groups.${group.id}.Label`,
        hint: `${root}.Groups.${group.id}.Hint`,
        settings: group.settings.map(id => ({ key: `pf2e-showDefault-${id}`, label: `${root}.Settings.${id}` }))
    }));
}

/**
 * Registers Pathfinder 2e-specific settings. Per-element default visibility is stored
 * in the core 'defaultVisibilitySettings' object (see the Default Visibility menu).
 */
export function registerPf2eSettings() {
    game.settings.register(MODULE_ID, 'pf2e-defensePlaceholderMode', {
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
