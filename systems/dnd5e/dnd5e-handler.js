/**
 * @file D&D 5e System Handler
 * Transforms D&D 5e actor data into the Standardized Intermediate Data Structure
 * (SIDS) and implements the SystemHandler interface. Supports dnd5e 5.x and 6.x.
 */

import { log } from '../../src/core/logger.js';
import { registerDnd5eSettings } from './dnd5e-settings.js';
import { registerAutoRevealHooks } from './dnd5e-auto-reveal.js';
import {
    SINGLE_KEY_SETTINGS, DEFENSE_CATEGORIES, isElementHidden, toKey,
    getPassiveFeatures, getActiveFeatures, getDisplayedEffects,
    getTraitValues, getTraitCustomValues, getAllKeys, getChildKeys, getDefaultHiddenElements
} from './dnd5e-visibility.js';

const TEMPLATE_ROOT = 'modules/inspect-statblock/systems/dnd5e/templates';

const TEMPLATE_PATHS = [
    'systems/dnd5e/templates/dnd5e-statblock-layout.hbs',
    'systems/dnd5e/templates/partials/header.hbs',
    'systems/dnd5e/templates/partials/portrait.hbs',
    'systems/dnd5e/templates/partials/ac.hbs',
    'systems/dnd5e/templates/partials/movement.hbs',
    'systems/dnd5e/templates/partials/health.hbs',
    'systems/dnd5e/templates/partials/ability_scores.hbs',
    'systems/dnd5e/templates/partials/defenses.hbs',
    'systems/dnd5e/templates/partials/active-effects.hbs',
    'systems/dnd5e/templates/partials/passive-features.hbs'
];

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

const MOVEMENT_TYPES = [
    { key: 'walk', label: 'DND5E.MovementWalk', icon: 'fa-solid fa-person-walking' },
    { key: 'fly', label: 'DND5E.MovementFly', icon: 'fa-solid fa-dove' },
    { key: 'swim', label: 'DND5E.MovementSwim', icon: 'fa-solid fa-person-swimming' },
    { key: 'climb', label: 'DND5E.MovementClimb', icon: 'fa-solid fa-grip-lines' },
    { key: 'burrow', label: 'DND5E.MovementBurrow', icon: 'fa-solid fa-mountain' }
];

const DEFENSE_LABELS = {
    resistances: 'DND5E.DamRes',
    immunities: 'DND5E.DamImm',
    vulnerabilities: 'DND5E.DamVuln',
    conditionimmunities: 'DND5E.ConImm'
};

const HIDDEN = '??';

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

Hooks.once('init', () => {
    if (game.system.id !== 'dnd5e') return;
    const core = globalThis.InspectStatblockCore;
    if (!core) {
        log.error('D&D 5e handler could not register: InspectStatblockCore is not loaded.');
        return;
    }
    core.registerSystemHandler('dnd5e', Dnd5eHandler);
    core.registerSystemTemplatePaths('dnd5e', TEMPLATE_PATHS);
    registerDnd5eSettings();
    registerAutoRevealHooks();
});

/* -------------------------------------------- */
/*  Label helpers                               */
/* -------------------------------------------- */

/**
 * Localized label from a CONFIG.DND5E entry, which may be a string or an object with a label.
 * @param {string|{label?: string}|undefined} entry
 * @returns {string|null}
 */
function _configLabel(entry) {
    if (!entry) return null;
    if (typeof entry === 'string') return game.i18n.localize(entry);
    if (typeof entry.label === 'string') return game.i18n.localize(entry.label);
    return null;
}

function _capitalize(value) {
    const s = String(value ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Localize a key, falling back to a literal if the key is missing.
 * @param {string} key
 * @param {string} fallback
 */
function _localizeOr(key, fallback) {
    const result = game.i18n.localize(key);
    return result === key ? fallback : result;
}

function _formatCr(cr) {
    if (cr === undefined || cr === null) return '?';
    const formatted = globalThis.dnd5e?.utils?.formatCR?.(cr);
    if (formatted) return formatted;
    return { 0.125: '1/8', 0.25: '1/4', 0.5: '1/2' }[cr] ?? String(cr);
}

function _formatSize(sizeKey) {
    if (!sizeKey) return '';
    return _configLabel(CONFIG.DND5E?.actorSizes?.[sizeKey]) ?? _capitalize(sizeKey);
}

function _defenseValueLabel(value) {
    const cfg = CONFIG.DND5E ?? {};
    return _configLabel(cfg.damageTypes?.[value])
        ?? _configLabel(cfg.damageResistanceTypes?.[value])
        ?? _configLabel(cfg.conditionTypes?.[value])
        ?? _capitalize(value);
}

/* -------------------------------------------- */
/*  SIDS builders                               */
/* -------------------------------------------- */

/**
 * @param {Actor} actor
 * @returns {{classString: string, totalLevel: number}}
 */
function _getCharacterClassStringAndLevel(actor) {
    const classes = actor.items.filter(i => i.type === 'class')
        .sort((a, b) => ((b.system.levels || 0) - (a.system.levels || 0)) || a.name.localeCompare(b.name));
    if (classes.length) {
        return {
            classString: classes.map(c => `${c.name} ${c.system.levels || 0}`).join(' / '),
            totalLevel: classes.reduce((sum, c) => sum + (c.system.levels || 0), 0)
        };
    }
    return {
        classString: _localizeOr('TYPES.Actor.character', 'Character'),
        totalLevel: actor.system.details?.level ?? 0
    };
}

function _getNpcTypeText(details) {
    const type = details?.type;
    if (!type) return '';
    let text = _configLabel(CONFIG.DND5E?.creatureTypes?.[type.value])
        ?? (type.value === 'custom' ? type.custom : _capitalize(type.value));
    if (type.subtype) text += ` (${type.subtype})`;
    return (text ?? '').trim();
}

function _getHeaderInfo(actor, tokenDoc, hiddenElements, isGM) {
    const hidden = key => isElementHidden(key, hiddenElements);
    const nameHidden = hidden('header-name');
    const crHidden = hidden('header-crlevel');
    const sizeHidden = hidden('header-size');
    const typeHidden = hidden('header-type');

    let levelOrCrText;
    let typeText;
    if (actor.type === 'character') {
        const { classString, totalLevel } = _getCharacterClassStringAndLevel(actor);
        levelOrCrText = game.i18n.format('INSPECTSTATBLOCK.Dnd5e.Level', { level: totalLevel });
        typeText = classString;
    } else {
        const crLabel = _localizeOr('DND5E.AbbreviationCR', 'CR');
        levelOrCrText = `${crLabel} ${_formatCr(actor.system.details?.cr)}`;
        typeText = _getNpcTypeText(actor.system.details);
    }
    const sizeText = _formatSize(actor.system.traits?.size);
    const show = (value, isHidden) => (!isGM && isHidden) ? HIDDEN : value;

    return {
        name: show(tokenDoc?.name || actor.name, nameHidden),
        nameElementKey: 'header-name',
        nameIsHiddenGM: isGM && nameHidden,
        levelOrCrText: show(levelOrCrText, crHidden),
        levelOrCrElementKey: 'header-crlevel',
        levelOrCrIsHiddenGM: isGM && crHidden,
        sizeText: sizeText ? show(sizeText, sizeHidden) : '',
        sizeElementKey: 'header-size',
        sizeIsHiddenGM: isGM && sizeHidden,
        typeText: typeText ? show(typeText, typeHidden) : '',
        typeElementKey: 'header-type',
        typeIsHiddenGM: isGM && typeHidden,
        actorId: actor.id
    };
}

function _getMovementData(attributes, hiddenElements, isGM) {
    const movement = attributes?.movement ?? {};
    const speeds = [];
    let hasAnySpeed = false;

    for (const { key, label, icon } of MOVEMENT_TYPES) {
        const elementKey = `movement-${key}`;
        const isHidden = isElementHidden(elementKey, hiddenElements);
        const raw = movement[key];
        const speed = typeof raw === 'number' ? raw : (typeof raw?.value === 'number' ? raw.value : 0);
        if (speed > 0) hasAnySpeed = true;

        // Players see "??" both for hidden speeds and speeds the creature lacks,
        // so the absence of a speed doesn't give anything away.
        const visibleToPlayer = speed > 0 && !isHidden;
        speeds.push({
            type: _localizeOr(label, _capitalize(key)),
            value: isGM ? String(speed) : (visibleToPlayer ? String(speed) : HIDDEN),
            icon,
            isNumericValue: isGM ? speed > 0 : visibleToPlayer,
            elementKey,
            isHiddenGM: isGM && isHidden
        });
    }

    return { speeds, isEmpty: isGM ? !hasAnySpeed : false };
}

function _getHealthData(actor, hiddenElements, isGM) {
    const isHidden = isElementHidden('section-hp', hiddenElements);
    const hp = actor.system.attributes?.hp;
    if (!isGM && isHidden) {
        return { current: HIDDEN, max: HIDDEN, elementKey: 'section-hp', isHiddenGM: false };
    }
    return {
        current: hp?.value ?? 0,
        max: hp?.max ?? 0,
        elementKey: 'section-hp',
        isHiddenGM: isGM && isHidden
    };
}

function _getAcData(actor, hiddenElements, isGM) {
    const isHidden = isElementHidden('section-ac', hiddenElements);
    return {
        value: (!isGM && isHidden) ? HIDDEN : (actor.system.attributes?.ac?.value ?? HIDDEN),
        elementKey: 'section-ac',
        isHiddenGM: isGM && isHidden
    };
}

function _getAbilityScoresData(abilities, hiddenElements, isGM) {
    if (!abilities) return [];
    return Object.entries(abilities).map(([key, ability]) => {
        const elementKey = `ability-${key}`;
        const isHidden = !isGM && isElementHidden(elementKey, hiddenElements);
        const abbreviation = CONFIG.DND5E?.abilities?.[key]?.abbreviation;
        const mod = Number(ability.mod) || 0;
        return {
            key,
            label: (abbreviation ? game.i18n.localize(abbreviation) : key).toUpperCase(),
            value: isHidden ? HIDDEN : ability.value,
            mod: isHidden ? HIDDEN : (mod >= 0 ? `+${mod}` : String(mod)),
            elementKey,
            isHiddenGM: isGM && isElementHidden(elementKey, hiddenElements)
        };
    });
}

/**
 * Short duration text for an Active Effect. Prefers core's prepared label and
 * falls back to raw rounds/turns so it keeps working if the duration shape changes.
 * @param {ActiveEffect} effect
 */
function _formatEffectDuration(effect) {
    const duration = effect.duration ?? {};
    if (duration.type !== 'none' && typeof duration.label === 'string' && duration.label) {
        return duration.label;
    }
    const parts = [];
    if (duration.rounds) parts.push(game.i18n.format('INSPECTSTATBLOCK.Dnd5e.Rounds', { n: duration.rounds }));
    if (duration.turns) parts.push(game.i18n.format('INSPECTSTATBLOCK.Dnd5e.Turns', { n: duration.turns }));
    if (parts.length) return parts.join(', ');

    const special = effect.flags?.dae?.specialDuration;
    if (Array.isArray(special) && special.length) return game.i18n.localize('INSPECTSTATBLOCK.Dnd5e.SpecialDuration');
    return '';
}

function _getSectionShell(key, titleKey, sectionClasses, hiddenElements, isGM) {
    return {
        title: game.i18n.localize(titleKey),
        items: [],
        isEmpty: true,
        sectionClasses,
        elementKey: key,
        isHiddenGM: isGM && isElementHidden(key, hiddenElements)
    };
}

function _getActiveEffectsData(actor, hiddenElements, isGM) {
    const section = _getSectionShell('section-active-effects', 'INSPECTSTATBLOCK.Sections.ActiveEffects',
        'active-effects-section', hiddenElements, isGM);

    for (const effect of getDisplayedEffects(actor)) {
        const elementKey = `effect-${effect.id}`;
        const isHidden = isElementHidden(elementKey, hiddenElements);
        const hideForPlayer = !isGM && isHidden;
        section.items.push({
            id: effect.id,
            name: hideForPlayer ? HIDDEN : effect.name,
            icon: hideForPlayer ? '' : effect.img,
            subText: hideForPlayer ? '' : _formatEffectDuration(effect),
            elementKey,
            isHiddenGM: isGM && isHidden,
            uuid: effect.uuid
        });
    }
    section.isEmpty = section.items.length === 0;
    return section;
}

function _getFeaturesData(items, keyPrefix, sectionKey, titleKey, sectionClasses, hiddenElements, isGM) {
    const section = _getSectionShell(sectionKey, titleKey, sectionClasses, hiddenElements, isGM);
    for (const item of items) {
        const elementKey = `${keyPrefix}-${item.id}`;
        const isHidden = isElementHidden(elementKey, hiddenElements);
        const hideForPlayer = !isGM && isHidden;
        section.items.push({
            id: item.id,
            name: hideForPlayer ? HIDDEN : item.name,
            icon: hideForPlayer ? '' : item.img,
            elementKey,
            isHiddenGM: isGM && isHidden,
            uuid: item.uuid
        });
    }
    section.isEmpty = section.items.length === 0;
    return section;
}

/**
 * One defense category (e.g. Resistances) with its tags.
 */
function _getDefenseCategory(actor, category, hiddenElements, isGM, placeholderMode) {
    const field = actor.system.traits?.[category.trait];
    const categoryKey = `def-${category.id}`;
    const name = game.i18n.localize(DEFENSE_LABELS[category.id]);

    const allTags = [
        ...getTraitValues(field).map(v => ({ name: _defenseValueLabel(v), elementKey: `def-tag-${category.id}-${toKey(v)}` })),
        ...getTraitCustomValues(field).map(v => ({ name: v, elementKey: `def-tag-${category.id}-${toKey(v)}` }))
    ];

    const tags = [];
    const tooltipParts = [];
    for (const tag of allTags) {
        const isHidden = isElementHidden(tag.elementKey, hiddenElements);
        if (isGM) {
            tags.push({ id: tag.elementKey, name: tag.name, elementKey: tag.elementKey, isHiddenGM: isHidden });
            tooltipParts.push(tag.name);
        } else if (placeholderMode === 'persistentSinglePlaceholder') {
            if (!isHidden) {
                tags.push({ id: tag.elementKey, name: tag.name, elementKey: tag.elementKey, isHiddenGM: false });
                tooltipParts.push(tag.name);
            }
        } else {
            tags.push({ id: tag.elementKey, name: isHidden ? HIDDEN : tag.name, elementKey: tag.elementKey, isHiddenGM: false });
            tooltipParts.push(isHidden ? HIDDEN : tag.name);
        }
    }

    // In "persistent single" mode players always see one trailing "??", whether or
    // not anything is hidden, so an empty category looks the same as a hidden one.
    if (!isGM && placeholderMode === 'persistentSinglePlaceholder') {
        const placeholderKey = `${categoryKey}-persistent-placeholder`;
        tags.push({ id: placeholderKey, name: HIDDEN, elementKey: placeholderKey, isPlaceholder: true, isHiddenGM: false });
        tooltipParts.push(HIDDEN);
    }

    const none = game.i18n.localize('None');
    return {
        id: categoryKey,
        name,
        tags,
        subText: (isGM && tags.length === 0) ? none : '',
        elementKey: categoryKey,
        isHiddenGM: isGM && isElementHidden(categoryKey, hiddenElements),
        nativeTooltipText: `${name}: ${tooltipParts.join(', ') || (isGM ? none : HIDDEN)}`
    };
}

function _getDefensesData(actor, hiddenElements, isGM) {
    const placeholderMode = game.settings.get('inspect-statblock', 'dnd5e-defensePlaceholderMode');
    return {
        title: game.i18n.localize('INSPECTSTATBLOCK.Sections.Defenses'),
        items: DEFENSE_CATEGORIES.map(c => _getDefenseCategory(actor, c, hiddenElements, isGM, placeholderMode)),
        isEmpty: false,
        isHiddenGM: false,
        sectionClass: 'defenses-grid-layout'
    };
}

/**
 * Fetches and transforms D&D 5e actor data into the StandardizedStatblockData format.
 * @param {Actor} actor - The actor (synthetic for unlinked tokens, so HP etc. are the token's own).
 * @param {TokenDocument|Token|null} token - The token, if any.
 * @param {Record<string, boolean>} hiddenElements - Visibility flags.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {Promise<SIDS.StandardizedStatblockData>}
 */
async function getStandardizedActorData(actor, token, hiddenElements = {}, isGM = false) {
    if (!actor?.system) {
        log.warn('getStandardizedActorData: actor or actor.system is missing.');
        return null;
    }
    const tokenDoc = token?.documentName === 'Token' ? token : (token?.document ?? null);
    const tokenSrc = tokenDoc?.texture?.src || actor.prototypeToken?.texture?.src;

    return {
        systemSpecificLayoutTemplate: `${TEMPLATE_ROOT}/dnd5e-statblock-layout.hbs`,
        systemId: 'dnd5e',
        isGM,
        headerInfo: _getHeaderInfo(actor, tokenDoc, hiddenElements, isGM),
        portraitInfo: {
            displayImgSrc: tokenSrc || actor.img || 'icons/svg/mystery-man.svg',
            tokenImgSrc: tokenSrc,
            actorImgSrc: actor.img
        },
        ac: _getAcData(actor, hiddenElements, isGM),
        movement: _getMovementData(actor.system.attributes, hiddenElements, isGM),
        health: _getHealthData(actor, hiddenElements, isGM),
        abilityScores: _getAbilityScoresData(actor.system.abilities, hiddenElements, isGM),
        activeEffects: _getActiveEffectsData(actor, hiddenElements, isGM),
        defenses: _getDefensesData(actor, hiddenElements, isGM),
        passiveFeatures: _getFeaturesData(getPassiveFeatures(actor), 'feature', 'section-passive-features',
            'INSPECTSTATBLOCK.Sections.PassiveFeatures', 'passive-features-section', hiddenElements, isGM),
        activeFeatures: _getFeaturesData(getActiveFeatures(actor), 'active-feature', 'section-active-features',
            'INSPECTSTATBLOCK.Sections.ActiveFeatures', 'active-features-section', hiddenElements, isGM)
    };
}

/**
 * Section definitions for visibility defaults (SystemHandler interface).
 * @returns {Record<string, SystemSectionDefinition>}
 */
function getSystemSectionDefinitions() {
    return Object.fromEntries(Object.entries(SINGLE_KEY_SETTINGS).map(([key, settingKey]) => [
        settingKey.replace('dnd5e-showDefault-', ''),
        { name: key, type: 'single', keyPattern: key, defaultShowSettingKey: settingKey }
    ]));
}

/**
 * D&D 5e System Handler implementing the SystemHandler interface.
 */
export const Dnd5eHandler = {
    SYSTEM_ID: 'dnd5e',

    getStandardizedActorData,
    getSystemSectionDefinitions,

    getDefaultAbilityKeys() {
        return [...ABILITY_KEYS];
    },

    /**
     * Effective hidden state of an element, including inherited defaults.
     * @param {string} key
     * @param {Record<string, boolean>} hiddenElements
     */
    isElementHidden(key, hiddenElements) {
        return isElementHidden(key, hiddenElements);
    },

    /**
     * All toggleable element keys for an actor.
     * @param {Actor} actor
     * @returns {Promise<string[]>}
     */
    async getAllToggleableKeys(actor) {
        return actor ? getAllKeys(actor) : [];
    },

    /**
     * Child keys of a group element (section header or defense category).
     * @param {string} key
     * @param {Actor} actor
     * @returns {Promise<string[]>}
     */
    async getInSectionItemKeys(key, actor) {
        return actor ? getChildKeys(key, actor) : [];
    },

    /**
     * Default hidden state for every key not already in `current`.
     * @param {Actor} actor
     * @param {Record<string, boolean>} [current]
     */
    getDefaultHiddenElements(actor, current = {}) {
        return getDefaultHiddenElements(actor, current);
    }
};
