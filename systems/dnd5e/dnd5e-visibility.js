/**
 * @fileoverview D&D 5e element keys, feature classification and default visibility.
 *
 * Element keys:
 *   header-name, header-crlevel, header-size, header-type, section-ac, section-hp,
 *   movement-<type>, ability-<abl>,
 *   section-active-effects + effect-<id>,
 *   section-passive-features + feature-<itemId>,
 *   section-active-features + active-feature-<itemId>,
 *   def-<category> + def-tag-<category>-<value>
 *
 * Effective visibility of a key with no flag is inherited: defense tags from their
 * category flag, section items from their section flag, and otherwise from the
 * "default visibility" settings.
 */

import { MODULE_ID } from '../../src/core/constants.js';

/** Single element key → default visibility setting key. */
export const SINGLE_KEY_SETTINGS = {
    'header-name': 'dnd5e-showDefault-headerName',
    'header-crlevel': 'dnd5e-showDefault-headerCrLevel',
    'header-size': 'dnd5e-showDefault-headerSize',
    'header-type': 'dnd5e-showDefault-headerType',
    'section-ac': 'dnd5e-showDefault-ac',
    'movement-walk': 'dnd5e-showDefault-movementWalk',
    'movement-fly': 'dnd5e-showDefault-movementFly',
    'movement-swim': 'dnd5e-showDefault-movementSwim',
    'movement-climb': 'dnd5e-showDefault-movementClimb',
    'movement-burrow': 'dnd5e-showDefault-movementBurrow',
    'section-hp': 'dnd5e-showDefault-health',
    'ability-str': 'dnd5e-showDefault-abilityStr',
    'ability-dex': 'dnd5e-showDefault-abilityDex',
    'ability-con': 'dnd5e-showDefault-abilityCon',
    'ability-int': 'dnd5e-showDefault-abilityInt',
    'ability-wis': 'dnd5e-showDefault-abilityWis',
    'ability-cha': 'dnd5e-showDefault-abilityCha',
    'section-active-effects': 'dnd5e-showDefault-activeEffectsSection',
    'def-resistances': 'dnd5e-showDefault-defenseResistances',
    'def-immunities': 'dnd5e-showDefault-defenseImmunities',
    'def-vulnerabilities': 'dnd5e-showDefault-defenseVulnerabilities',
    'def-conditionimmunities': 'dnd5e-showDefault-defenseConditions',
    'section-passive-features': 'dnd5e-showDefault-passiveFeaturesSection',
    'section-active-features': 'dnd5e-showDefault-activeFeaturesSection'
};

/** Defense categories: id used in keys → trait field on actor.system.traits. */
export const DEFENSE_CATEGORIES = [
    { id: 'resistances', trait: 'dr' },
    { id: 'immunities', trait: 'di' },
    { id: 'vulnerabilities', trait: 'dv' },
    { id: 'conditionimmunities', trait: 'ci' }
];

/** Item-key prefixes and the section header they belong to. */
const ITEM_SECTIONS = [
    { prefix: 'effect-', section: 'section-active-effects' },
    { prefix: 'feature-', section: 'section-passive-features' },
    { prefix: 'active-feature-', section: 'section-active-features' }
];

const DEFENSE_TAG_PATTERN = /^def-tag-(resistances|immunities|vulnerabilities|conditionimmunities)-/;

/** Generic actions that are never listed as features. Compared after toKey(). */
const COMMON_ACTIONS = new Set([
    'attack', 'castaspell', 'dash', 'disengage', 'dodge', 'help', 'hide', 'ready', 'search',
    'useanobject', 'grapple', 'shove', 'improvisedaction',
    'readyaction', 'readyspell', 'squeeze', 'stabilize', 'fall', 'underwater', 'checkcover'
]);

/**
 * Canonical lowercase alphanumeric form used inside element keys.
 * @param {*} value
 * @returns {string}
 */
export function toKey(value) {
    return String(value).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/* -------------------------------------------- */
/*  Defaults                                    */
/* -------------------------------------------- */

function _defaultSettings() {
    try {
        return game.settings.get(MODULE_ID, 'defaultVisibilitySettings') || {};
    } catch {
        return {};
    }
}

/**
 * Effective hidden state of an element for players.
 * @param {string} key
 * @param {Record<string, boolean>} hiddenElements
 * @param {object} [defaults] - Default visibility settings (read from settings if omitted).
 * @returns {boolean}
 */
export function isElementHidden(key, hiddenElements = {}, defaults = _defaultSettings()) {
    if (key in hiddenElements) return !!hiddenElements[key];

    const tagMatch = DEFENSE_TAG_PATTERN.exec(key);
    if (tagMatch) return isElementHidden(`def-${tagMatch[1]}`, hiddenElements, defaults);

    for (const { prefix, section } of ITEM_SECTIONS) {
        if (key.startsWith(prefix)) return isElementHidden(section, hiddenElements, defaults);
    }

    const settingKey = SINGLE_KEY_SETTINGS[key];
    if (settingKey) return (defaults[settingKey] ?? true) === false;
    return false;
}

/* -------------------------------------------- */
/*  Classification                              */
/* -------------------------------------------- */

/**
 * Number of activities on an item. Activities are a Collection (Map) in dnd5e 4+.
 * @param {Item} item
 */
function _activityCount(item) {
    const activities = item?.system?.activities;
    if (!activities) return 0;
    if (typeof activities.size === 'number') return activities.size;
    return Object.keys(activities).length;
}

/**
 * Whether an item is listed as a feature at all.
 * @param {Item} item
 */
export function isListedFeature(item) {
    return item?.type === 'feat' && !COMMON_ACTIONS.has(toKey(item.name));
}

/**
 * Features with at least one activity are "active"; the rest are "passive".
 * @param {Item} item
 */
export function isActiveFeature(item) {
    return _activityCount(item) > 0;
}

/** @param {Actor} actor */
export function getPassiveFeatures(actor) {
    return (actor?.items ?? []).filter(i => isListedFeature(i) && !isActiveFeature(i));
}

/** @param {Actor} actor */
export function getActiveFeatures(actor) {
    return (actor?.items ?? []).filter(i => isListedFeature(i) && isActiveFeature(i));
}

/**
 * Element key for a feature item.
 * @param {Item} item
 */
export function featureKey(item) {
    return `${isActiveFeature(item) ? 'active-feature' : 'feature'}-${item.id}`;
}

/**
 * Effects shown in the Active Effects section: active effects on the actor itself,
 * plus temporary effects coming from its items (e.g. a toggled Rage effect).
 * @param {Actor} actor
 * @returns {ActiveEffect[]}
 */
export function getDisplayedEffects(actor) {
    if (!actor) return [];
    const isActive = e => !e.disabled && !e.isSuppressed;
    const effects = new Map();
    for (const effect of actor.effects ?? []) {
        if (isActive(effect)) effects.set(effect.id, effect);
    }
    for (const effect of actor.temporaryEffects ?? []) {
        if (effect.parent !== actor && isActive(effect) && !effects.has(effect.id)) effects.set(effect.id, effect);
    }
    return Array.from(effects.values());
}

/* -------------------------------------------- */
/*  Traits                                      */
/* -------------------------------------------- */

/**
 * Raw values of a trait field (Set, array or legacy flag object).
 * @param {object} field - e.g. actor.system.traits.dr
 * @returns {string[]}
 */
export function getTraitValues(field) {
    const value = field?.value;
    if (!value) return [];
    if (value instanceof Set) return Array.from(value);
    if (Array.isArray(value)) return value;
    if (typeof value === 'object') return Object.entries(value).filter(([, on]) => on === true).map(([k]) => k);
    return [];
}

/**
 * Custom entries of a trait field (semicolon separated).
 * @param {object} field
 * @returns {string[]}
 */
export function getTraitCustomValues(field) {
    if (typeof field?.custom !== 'string') return [];
    return field.custom.split(';').map(s => s.trim()).filter(Boolean);
}

/**
 * Whether a trait field contains a value (compared by toKey).
 * @param {object} field
 * @param {string} value
 */
export function traitHas(field, value) {
    const wanted = toKey(value);
    return getTraitValues(field).some(v => toKey(v) === wanted);
}

/**
 * Tag keys for one defense category on an actor.
 * @param {Actor} actor
 * @param {string} categoryId - e.g. "resistances"
 * @returns {string[]}
 */
export function getDefenseTagKeys(actor, categoryId) {
    const category = DEFENSE_CATEGORIES.find(c => c.id === categoryId);
    const field = actor?.system?.traits?.[category?.trait];
    if (!field) return [];
    const values = [...getTraitValues(field), ...getTraitCustomValues(field)];
    return [...new Set(values.map(v => `def-tag-${categoryId}-${toKey(v)}`))];
}

/* -------------------------------------------- */
/*  Key collections                             */
/* -------------------------------------------- */

/**
 * Child keys of a group key (section header or defense category).
 * @param {string} key
 * @param {Actor} actor
 * @returns {string[]}
 */
export function getChildKeys(key, actor) {
    switch (key) {
        case 'section-active-effects':
            return getDisplayedEffects(actor).map(e => `effect-${e.id}`);
        case 'section-passive-features':
            return getPassiveFeatures(actor).map(i => `feature-${i.id}`);
        case 'section-active-features':
            return getActiveFeatures(actor).map(i => `active-feature-${i.id}`);
    }
    const categoryMatch = /^def-(resistances|immunities|vulnerabilities|conditionimmunities)$/.exec(key);
    if (categoryMatch) return getDefenseTagKeys(actor, categoryMatch[1]);
    return [];
}

/**
 * Every toggleable key for an actor.
 * @param {Actor} actor
 * @returns {string[]}
 */
export function getAllKeys(actor) {
    const keys = new Set(Object.keys(SINGLE_KEY_SETTINGS));
    for (const section of ['section-active-effects', 'section-passive-features', 'section-active-features']) {
        getChildKeys(section, actor).forEach(k => keys.add(k));
    }
    for (const { id } of DEFENSE_CATEGORIES) {
        getDefenseTagKeys(actor, id).forEach(k => keys.add(k));
    }
    return Array.from(keys);
}

/**
 * Default hidden state for every key that isn't in `current`, resolved the same
 * way the statblock resolves unflagged keys.
 * @param {Actor} actor
 * @param {Record<string, boolean>} [current]
 * @returns {Record<string, boolean>}
 */
export function getDefaultHiddenElements(actor, current = {}) {
    const defaults = _defaultSettings();
    const result = {};
    // Resolve group keys first so their children inherit the new values.
    const working = { ...current };
    const keys = getAllKeys(actor).sort((a, b) => _depth(a) - _depth(b));
    for (const key of keys) {
        if (key in current) continue;
        const hidden = isElementHidden(key, working, defaults);
        result[key] = hidden;
        working[key] = hidden;
    }
    return result;
}

function _depth(key) {
    return (DEFENSE_TAG_PATTERN.test(key) || ITEM_SECTIONS.some(s => key.startsWith(s.prefix))) ? 1 : 0;
}
