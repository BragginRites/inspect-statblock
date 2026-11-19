/**
 * @fileoverview Pathfinder 2e element keys, ability classification and default visibility.
 *
 * Element keys:
 *   header-name, header-level, header-rarity, header-size, header-traits,
 *   section-ac, section-hp, stat-perception, save-<fortitude|reflex|will>,
 *   movement-<land|fly|swim|climb|burrow>, ability-<str|dex|con|int|wis|cha>,
 *   section-effects + effect-<itemId>            (effect, condition and affliction items),
 *   section-passive-features + feature-<itemId>  (passive abilities),
 *   section-actions + action-<itemId>            (actions, reactions, free actions, NPC strikes),
 *   def-<immunities|weaknesses|resistances> + def-tag-<category>-<type>
 *
 * Effective visibility of a key with no flag is inherited: defense tags from their
 * category flag, section items from their section flag, and otherwise from the
 * "default visibility" settings.
 */

import { MODULE_ID } from '../../src/core/constants.js';

/** Single element key → default visibility setting key. */
export const SINGLE_KEY_SETTINGS = {
    'header-name': 'pf2e-showDefault-headerName',
    'header-level': 'pf2e-showDefault-headerLevel',
    'header-rarity': 'pf2e-showDefault-headerRarity',
    'header-size': 'pf2e-showDefault-headerSize',
    'header-traits': 'pf2e-showDefault-headerTraits',
    'section-ac': 'pf2e-showDefault-ac',
    'section-hp': 'pf2e-showDefault-health',
    'stat-perception': 'pf2e-showDefault-perception',
    'save-fortitude': 'pf2e-showDefault-saveFortitude',
    'save-reflex': 'pf2e-showDefault-saveReflex',
    'save-will': 'pf2e-showDefault-saveWill',
    'movement-land': 'pf2e-showDefault-movementLand',
    'movement-fly': 'pf2e-showDefault-movementFly',
    'movement-swim': 'pf2e-showDefault-movementSwim',
    'movement-climb': 'pf2e-showDefault-movementClimb',
    'movement-burrow': 'pf2e-showDefault-movementBurrow',
    'ability-str': 'pf2e-showDefault-abilityStr',
    'ability-dex': 'pf2e-showDefault-abilityDex',
    'ability-con': 'pf2e-showDefault-abilityCon',
    'ability-int': 'pf2e-showDefault-abilityInt',
    'ability-wis': 'pf2e-showDefault-abilityWis',
    'ability-cha': 'pf2e-showDefault-abilityCha',
    'def-immunities': 'pf2e-showDefault-defenseImmunities',
    'def-weaknesses': 'pf2e-showDefault-defenseWeaknesses',
    'def-resistances': 'pf2e-showDefault-defenseResistances',
    'section-effects': 'pf2e-showDefault-effectsSection',
    'section-passive-features': 'pf2e-showDefault-passiveFeaturesSection',
    'section-actions': 'pf2e-showDefault-actionsSection'
};

/** Defense categories: id used in keys → array on actor.system.attributes. */
export const DEFENSE_CATEGORIES = [
    { id: 'immunities', attribute: 'immunities' },
    { id: 'weaknesses', attribute: 'weaknesses' },
    { id: 'resistances', attribute: 'resistances' }
];

/** Item-key prefixes and the section header they belong to. */
const ITEM_SECTIONS = [
    { prefix: 'effect-', section: 'section-effects' },
    { prefix: 'feature-', section: 'section-passive-features' },
    { prefix: 'action-', section: 'section-actions' }
];

const DEFENSE_TAG_PATTERN = /^def-tag-(immunities|weaknesses|resistances)-/;
const DEFENSE_CATEGORY_PATTERN = /^def-(immunities|weaknesses|resistances)$/;

/** Traits of generic exploration and downtime activities, which aren't listed as abilities. */
const GENERIC_ACTIVITY_TRAITS = ['exploration', 'downtime'];

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
 * Whether an item is listed as an ability at all: feats, actions (except generic
 * exploration/downtime activities) and NPC strikes.
 * @param {Item} item
 */
export function isListedFeature(item) {
    if (!item) return false;
    if (item.type === 'feat') return true;
    if (item.type === 'melee') return item.actor?.type === 'npc';
    if (item.type !== 'action') return false;
    const traits = item.system?.traits?.value ?? [];
    return !GENERIC_ACTIVITY_TRAITS.some(t => traits.includes(t));
}

/**
 * Strikes and anything with an action cost (action, reaction, free action) are "actions";
 * the rest are passive abilities.
 * @param {Item} item
 */
export function isActiveFeature(item) {
    if (item?.type === 'melee') return true;
    const actionType = item?.system?.actionType?.value ?? 'passive';
    return actionType !== 'passive';
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
 * Element key for an ability item.
 * @param {Item} item
 */
export function featureKey(item) {
    return `${isActiveFeature(item) ? 'action' : 'feature'}-${item.id}`;
}

/**
 * Items shown in the Effects section: effects, active conditions and afflictions.
 * In pf2e these are all items, not Active Effects.
 * @param {Actor} actor
 * @returns {Item[]}
 */
export function getDisplayedEffects(actor) {
    if (!actor?.items) return [];
    return actor.items.filter(item => {
        if (item.type === 'effect' || item.type === 'affliction') return !item.isExpired;
        if (item.type === 'condition') return item.active !== false;
        return false;
    });
}

/* -------------------------------------------- */
/*  IWR                                         */
/* -------------------------------------------- */

/**
 * IWR entries of one category.
 * @param {Actor} actor
 * @param {string} categoryId - e.g. "weaknesses"
 * @returns {object[]} pf2e Immunity/Weakness/Resistance instances
 */
export function getDefenseEntries(actor, categoryId) {
    const category = DEFENSE_CATEGORIES.find(c => c.id === categoryId);
    const entries = actor?.system?.attributes?.[category?.attribute];
    return Array.isArray(entries) ? entries : [];
}

/**
 * Element key for one IWR entry. Custom entries are keyed by their label.
 * @param {string} categoryId
 * @param {object} entry
 */
export function defenseTagKey(categoryId, entry) {
    const type = entry?.type === 'custom' ? (entry.typeLabel ?? entry.label ?? 'custom') : entry?.type;
    return `def-tag-${categoryId}-${toKey(type)}`;
}

/**
 * Tag keys for one defense category on an actor.
 * @param {Actor} actor
 * @param {string} categoryId
 * @returns {string[]}
 */
export function getDefenseTagKeys(actor, categoryId) {
    return [...new Set(getDefenseEntries(actor, categoryId).map(e => defenseTagKey(categoryId, e)))];
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
        case 'section-effects':
            return getDisplayedEffects(actor).map(e => `effect-${e.id}`);
        case 'section-passive-features':
            return getPassiveFeatures(actor).map(i => `feature-${i.id}`);
        case 'section-actions':
            return getActiveFeatures(actor).map(i => `action-${i.id}`);
    }
    const categoryMatch = DEFENSE_CATEGORY_PATTERN.exec(key);
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
    for (const section of ['section-effects', 'section-passive-features', 'section-actions']) {
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
