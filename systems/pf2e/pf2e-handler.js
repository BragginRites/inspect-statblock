/**
 * @file Pathfinder 2e System Handler
 * Transforms pf2e actor data into the Standardized Intermediate Data Structure
 * (SIDS) and implements the SystemHandler interface. Built against pf2e 7.x.
 */

import { log } from '../../src/core/logger.js';
import { registerPf2eSettings, getPf2eDefaultSettingGroups } from './pf2e-settings.js';
import { registerPf2eAutoRevealHooks } from './pf2e-auto-reveal.js';
import {
    SINGLE_KEY_SETTINGS, DEFENSE_CATEGORIES, isElementHidden,
    getPassiveFeatures, getActiveFeatures, getDisplayedEffects,
    getDefenseEntries, defenseTagKey, getAllKeys, getChildKeys, getDefaultHiddenElements
} from './pf2e-visibility.js';

const MODULE_ROOT = 'modules/inspect-statblock';
const TEMPLATE_ROOT = `${MODULE_ROOT}/systems/pf2e/templates`;

/** Template paths relative to the module root. Shared partials come from the dnd5e folder. */
const TEMPLATE_PATHS = [
    'systems/pf2e/templates/pf2e-statblock-layout.hbs',
    'systems/pf2e/templates/partials/header.hbs',
    'systems/pf2e/templates/partials/attributes.hbs',
    'systems/pf2e/templates/partials/item-section.hbs',
    'systems/dnd5e/templates/partials/portrait.hbs',
    'systems/dnd5e/templates/partials/ac.hbs',
    'systems/dnd5e/templates/partials/movement.hbs',
    'systems/dnd5e/templates/partials/health.hbs',
    'systems/dnd5e/templates/partials/defenses.hbs'
];

const ABILITY_KEYS = ['str', 'dex', 'con', 'int', 'wis', 'cha'];
const SAVE_KEYS = ['fortitude', 'reflex', 'will'];

const MOVEMENT_TYPES = [
    { key: 'land', label: 'INSPECTSTATBLOCK.Pf2e.Speed.land', icon: 'fa-solid fa-person-walking' },
    { key: 'fly', label: 'INSPECTSTATBLOCK.Pf2e.Speed.fly', icon: 'fa-solid fa-dove' },
    { key: 'swim', label: 'INSPECTSTATBLOCK.Pf2e.Speed.swim', icon: 'fa-solid fa-person-swimming' },
    { key: 'climb', label: 'INSPECTSTATBLOCK.Pf2e.Speed.climb', icon: 'fa-solid fa-grip-lines' },
    { key: 'burrow', label: 'INSPECTSTATBLOCK.Pf2e.Speed.burrow', icon: 'fa-solid fa-mountain' }
];

/** Characters of pf2e's action font (class "action-glyph"). */
const ACTION_GLYPHS = { action: { 1: '1', 2: '2', 3: '3' }, reaction: 'R', free: 'F' };

const HIDDEN = '??';

/* -------------------------------------------- */
/*  Registration                                */
/* -------------------------------------------- */

Hooks.once('init', () => {
    if (game.system.id !== 'pf2e') return;
    const core = globalThis.InspectStatblockCore;
    if (!core) {
        log.error('Pathfinder 2e handler could not register: InspectStatblockCore is not loaded.');
        return;
    }
    core.registerSystemHandler('pf2e', Pf2eHandler);
    core.registerSystemTemplatePaths('pf2e', TEMPLATE_PATHS);
    registerPf2eSettings();
    registerPf2eAutoRevealHooks();
});

/* -------------------------------------------- */
/*  Helpers                                     */
/* -------------------------------------------- */

function _capitalize(value) {
    const s = String(value ?? '');
    return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Localize a key, falling back to a literal if the key is missing.
 * @param {string|undefined} key
 * @param {string} fallback
 */
function _localizeOr(key, fallback) {
    if (typeof key !== 'string' || !key) return fallback;
    const result = game.i18n.localize(key);
    return result === key ? fallback : result;
}

function _signed(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return HIDDEN;
    return n >= 0 ? `+${n}` : String(n);
}

function _traitLabel(trait) {
    const cfg = CONFIG.PF2E ?? {};
    const key = cfg.creatureTraits?.[trait] ?? cfg.monsterTraits?.[trait] ?? cfg.actionTraits?.[trait];
    return _localizeOr(key, _capitalize(trait));
}

/**
 * Localized description of an item for its tooltip.
 * @param {Item} item
 * @param {boolean} isGM - GMs also see secret blocks.
 */
async function _describe(item, isGM) {
    try {
        const raw = item.system?.description?.value ?? '';
        if (!raw) return '';
        const TextEditor = foundry.applications.ux.TextEditor.implementation;
        const body = await TextEditor.enrichHTML(raw, {
            rollData: item.getRollData?.() ?? {},
            relativeTo: item,
            secrets: isGM
        });
        return `<div class="inspect-statblock-description"><h4>${foundry.utils.escapeHTML(item.name)}</h4>${body}</div>`;
    } catch (err) {
        log.debug(`Could not enrich description of ${item?.name}:`, err);
        return '';
    }
}

/* -------------------------------------------- */
/*  SIDS builders                               */
/* -------------------------------------------- */

function _getTypeText(actor) {
    if (actor.type === 'character') {
        const parts = [actor.ancestry?.name, actor.class?.name].filter(Boolean);
        return parts.length ? parts.join(' ') : _localizeOr('TYPES.Actor.character', 'Character');
    }
    const traits = actor.system.traits?.value ?? [];
    return traits.map(_traitLabel).join(', ');
}

function _getHeaderInfo(actor, tokenDoc, hiddenElements, isGM) {
    const part = (key, text) => {
        if (!text) return null;
        const isHidden = isElementHidden(key, hiddenElements);
        return { text: (!isGM && isHidden) ? HIDDEN : text, elementKey: key, isHiddenGM: isGM && isHidden };
    };

    const rarity = actor.system.traits?.rarity;
    const rarityText = rarity && rarity !== 'common' ? _localizeOr(CONFIG.PF2E?.rarityTraits?.[rarity], _capitalize(rarity)) : '';
    const size = actor.system.traits?.size?.value;
    const sizeText = size ? _localizeOr(CONFIG.PF2E?.actorSizes?.[size], _capitalize(size)) : '';
    const level = actor.level ?? actor.system.details?.level?.value ?? 0;

    const nameHidden = isElementHidden('header-name', hiddenElements);
    return {
        name: (!isGM && nameHidden) ? HIDDEN : (tokenDoc?.name || actor.name),
        nameElementKey: 'header-name',
        nameIsHiddenGM: isGM && nameHidden,
        parts: [
            part('header-level', game.i18n.format('INSPECTSTATBLOCK.Pf2e.Level', { level })),
            part('header-rarity', rarityText),
            part('header-size', sizeText),
            part('header-traits', _getTypeText(actor))
        ].filter(Boolean),
        actorId: actor.id
    };
}

function _getMovementData(actor, hiddenElements, isGM) {
    const speeds = actor.system.movement?.speeds ?? {};
    const result = [];
    let hasAnySpeed = false;

    for (const { key, label, icon } of MOVEMENT_TYPES) {
        const elementKey = `movement-${key}`;
        const isHidden = isElementHidden(elementKey, hiddenElements);
        const raw = speeds[key];
        const speed = typeof raw === 'number' ? raw : (Number(raw?.value) || 0);
        if (speed > 0) hasAnySpeed = true;

        // Players see "??" both for hidden speeds and speeds the creature lacks.
        const visibleToPlayer = speed > 0 && !isHidden;
        result.push({
            type: _localizeOr(label, _capitalize(key)),
            value: isGM ? String(speed) : (visibleToPlayer ? String(speed) : HIDDEN),
            icon,
            isNumericValue: isGM ? speed > 0 : visibleToPlayer,
            elementKey,
            isHiddenGM: isGM && isHidden
        });
    }
    return { speeds: result, isEmpty: isGM ? !hasAnySpeed : false };
}

function _getHealthData(actor, hiddenElements, isGM) {
    const isHidden = isElementHidden('section-hp', hiddenElements);
    const hp = actor.system.attributes?.hp;
    if (!isGM && isHidden) return { current: HIDDEN, max: HIDDEN, elementKey: 'section-hp', isHiddenGM: false };
    return { current: hp?.value ?? 0, max: hp?.max ?? 0, elementKey: 'section-hp', isHiddenGM: isGM && isHidden };
}

function _getAcData(actor, hiddenElements, isGM) {
    const isHidden = isElementHidden('section-ac', hiddenElements);
    return {
        value: (!isGM && isHidden) ? HIDDEN : (actor.system.attributes?.ac?.value ?? HIDDEN),
        elementKey: 'section-ac',
        isHiddenGM: isGM && isHidden
    };
}

/**
 * One cell of an attribute row.
 * @param {string} elementKey
 * @param {string} label
 * @param {number|undefined} mod
 */
function _cell(elementKey, label, mod, hiddenElements, isGM) {
    const isHidden = isElementHidden(elementKey, hiddenElements);
    return {
        label,
        value: (!isGM && isHidden) ? HIDDEN : _signed(mod),
        elementKey,
        isHiddenGM: isGM && isHidden
    };
}

function _getAbilityData(actor, hiddenElements, isGM) {
    const abilities = actor.system.abilities;
    if (!abilities) return [];
    return ABILITY_KEYS.filter(k => k in abilities).map(key =>
        _cell(`ability-${key}`, key.toUpperCase(), abilities[key]?.mod, hiddenElements, isGM));
}

function _getDefenseStatData(actor, hiddenElements, isGM) {
    const cells = [];
    const perception = actor.perception?.mod ?? actor.system.perception?.mod;
    cells.push(_cell('stat-perception', game.i18n.localize('INSPECTSTATBLOCK.Pf2e.Perception'), perception, hiddenElements, isGM));
    for (const key of SAVE_KEYS) {
        const mod = actor.saves?.[key]?.mod ?? actor.system.saves?.[key]?.value;
        cells.push(_cell(`save-${key}`, game.i18n.localize(`INSPECTSTATBLOCK.Pf2e.Save.${key}`), mod, hiddenElements, isGM));
    }
    return cells;
}

function _getSectionShell(key, titleKey, hiddenElements, isGM) {
    return {
        title: game.i18n.localize(titleKey),
        items: [],
        isEmpty: true,
        elementKey: key,
        isHiddenGM: isGM && isElementHidden(key, hiddenElements)
    };
}

/**
 * Remaining duration text for an effect item.
 * @param {Item} item
 */
function _formatEffectDuration(item) {
    if (item.type === 'condition') return '';
    const unit = item.system?.duration?.unit;
    if (unit === 'encounter') return game.i18n.localize('INSPECTSTATBLOCK.Pf2e.Duration.Encounter');
    if (!unit || unit === 'unlimited') return '';
    const remaining = item.remainingDuration?.remaining;
    if (typeof remaining !== 'number' || !Number.isFinite(remaining) || remaining <= 0) return '';
    if (unit === 'rounds' || remaining < 60) {
        return game.i18n.format('INSPECTSTATBLOCK.Pf2e.Duration.Rounds', { n: Math.ceil(remaining / 6) });
    }
    if (remaining < 3600) return game.i18n.format('INSPECTSTATBLOCK.Pf2e.Duration.Minutes', { n: Math.ceil(remaining / 60) });
    if (remaining < 86400) return game.i18n.format('INSPECTSTATBLOCK.Pf2e.Duration.Hours', { n: Math.ceil(remaining / 3600) });
    return game.i18n.format('INSPECTSTATBLOCK.Pf2e.Duration.Days', { n: Math.ceil(remaining / 86400) });
}

/**
 * pf2e action-font glyph for an ability, or ''.
 * @param {Item} item
 */
function _actionGlyph(item) {
    if (item.type === 'melee') return ACTION_GLYPHS.action[1];
    const type = item.system?.actionType?.value;
    if (type === 'action') return ACTION_GLYPHS.action[item.system?.actions?.value] ?? '';
    return ACTION_GLYPHS[type] ?? '';
}

async function _getEffectsData(actor, hiddenElements, isGM) {
    const section = _getSectionShell('section-effects', 'INSPECTSTATBLOCK.Pf2e.Sections.Effects', hiddenElements, isGM);
    for (const item of getDisplayedEffects(actor)) {
        const elementKey = `effect-${item.id}`;
        const isHidden = isElementHidden(elementKey, hiddenElements);
        const hideForPlayer = !isGM && isHidden;
        // Unidentified effects keep their real name hidden from players, as pf2e does.
        const unidentified = !isGM && item.type === 'effect' && item.system?.unidentified;
        const name = unidentified ? game.i18n.localize('INSPECTSTATBLOCK.Pf2e.UnidentifiedEffect') : item.name;
        section.items.push({
            id: item.id,
            name: hideForPlayer ? HIDDEN : name,
            icon: hideForPlayer ? '' : item.img,
            subText: hideForPlayer ? '' : _formatEffectDuration(item),
            descriptionHTML: (hideForPlayer || unidentified) ? '' : await _describe(item, isGM),
            elementKey,
            isHiddenGM: isGM && isHidden
        });
    }
    section.isEmpty = section.items.length === 0;
    return section;
}

async function _getFeaturesData(items, keyPrefix, sectionKey, titleKey, hiddenElements, isGM) {
    const section = _getSectionShell(sectionKey, titleKey, hiddenElements, isGM);
    const sorted = [...items].sort((a, b) => (a.sort ?? 0) - (b.sort ?? 0) || a.name.localeCompare(b.name));
    for (const item of sorted) {
        const elementKey = `${keyPrefix}-${item.id}`;
        const isHidden = isElementHidden(elementKey, hiddenElements);
        const hideForPlayer = !isGM && isHidden;
        section.items.push({
            id: item.id,
            name: hideForPlayer ? HIDDEN : item.name,
            icon: hideForPlayer ? '' : item.img,
            actionGlyph: hideForPlayer ? '' : _actionGlyph(item),
            descriptionHTML: hideForPlayer ? '' : await _describe(item, isGM),
            elementKey,
            isHiddenGM: isGM && isHidden
        });
    }
    section.isEmpty = section.items.length === 0;
    return section;
}

/**
 * One defense category (e.g. Weaknesses) with its tags.
 */
function _getDefenseCategory(actor, categoryId, hiddenElements, isGM, placeholderMode) {
    const categoryKey = `def-${categoryId}`;
    const name = game.i18n.localize(`INSPECTSTATBLOCK.Pf2e.Defense.${categoryId}`);

    const seen = new Set();
    const allTags = [];
    for (const entry of getDefenseEntries(actor, categoryId)) {
        const elementKey = defenseTagKey(categoryId, entry);
        if (seen.has(elementKey)) continue;
        seen.add(elementKey);
        allTags.push({ name: entry.label ?? entry.typeLabel ?? _capitalize(entry.type), elementKey });
    }

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

    // In "persistent single" mode players always see one trailing "??", so an
    // empty category looks the same as a hidden one.
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
    const placeholderMode = game.settings.get('inspect-statblock', 'pf2e-defensePlaceholderMode');
    return {
        title: game.i18n.localize('INSPECTSTATBLOCK.Sections.Defenses'),
        items: DEFENSE_CATEGORIES.map(c => _getDefenseCategory(actor, c.id, hiddenElements, isGM, placeholderMode)),
        isEmpty: false,
        isHiddenGM: false
    };
}

/**
 * Fetches and transforms pf2e actor data into the StandardizedStatblockData format.
 * @param {Actor} actor - The actor (synthetic for unlinked tokens).
 * @param {TokenDocument|Token|null} token
 * @param {Record<string, boolean>} hiddenElements
 * @param {boolean} isGM
 * @returns {Promise<SIDS.StandardizedStatblockData>}
 */
async function getStandardizedActorData(actor, token, hiddenElements = {}, isGM = false) {
    if (!actor?.system) {
        log.warn('getStandardizedActorData: actor or actor.system is missing.');
        return null;
    }
    const tokenDoc = token?.documentName === 'Token' ? token : (token?.document ?? null);
    const tokenSrc = tokenDoc?.texture?.src || actor.prototypeToken?.texture?.src;
    const isCreature = !!actor.system.attributes?.ac;

    const [effects, passiveFeatures, actions] = await Promise.all([
        _getEffectsData(actor, hiddenElements, isGM),
        _getFeaturesData(getPassiveFeatures(actor), 'feature', 'section-passive-features',
            'INSPECTSTATBLOCK.Pf2e.Sections.PassiveAbilities', hiddenElements, isGM),
        _getFeaturesData(getActiveFeatures(actor), 'action', 'section-actions',
            'INSPECTSTATBLOCK.Pf2e.Sections.Actions', hiddenElements, isGM)
    ]);

    return {
        systemSpecificLayoutTemplate: `${TEMPLATE_ROOT}/pf2e-statblock-layout.hbs`,
        systemId: 'pf2e',
        isGM,
        headerInfo: _getHeaderInfo(actor, tokenDoc, hiddenElements, isGM),
        portraitInfo: {
            displayImgSrc: tokenSrc || actor.img || 'icons/svg/mystery-man.svg',
            tokenImgSrc: tokenSrc,
            actorImgSrc: actor.img
        },
        ac: isCreature ? _getAcData(actor, hiddenElements, isGM) : null,
        movement: _getMovementData(actor, hiddenElements, isGM),
        health: actor.system.attributes?.hp ? _getHealthData(actor, hiddenElements, isGM) : null,
        defenseStats: isCreature ? _getDefenseStatData(actor, hiddenElements, isGM) : [],
        abilityScores: _getAbilityData(actor, hiddenElements, isGM),
        effects,
        defenses: _getDefensesData(actor, hiddenElements, isGM),
        passiveFeatures,
        actions
    };
}

/**
 * Section definitions for visibility defaults (SystemHandler interface).
 * @returns {Record<string, SystemSectionDefinition>}
 */
function getSystemSectionDefinitions() {
    return Object.fromEntries(Object.entries(SINGLE_KEY_SETTINGS).map(([key, settingKey]) => [
        settingKey.replace('pf2e-showDefault-', ''),
        { name: key, type: 'single', keyPattern: key, defaultShowSettingKey: settingKey }
    ]));
}

/**
 * Pathfinder 2e System Handler implementing the SystemHandler interface.
 */
export const Pf2eHandler = {
    SYSTEM_ID: 'pf2e',

    getStandardizedActorData,
    getSystemSectionDefinitions,

    getDefaultAbilityKeys() {
        return [...ABILITY_KEYS];
    },

    /** Groups for the Default Visibility form. */
    getDefaultSettingGroups() {
        return getPf2eDefaultSettingGroups();
    },

    isElementHidden(key, hiddenElements) {
        return isElementHidden(key, hiddenElements);
    },

    async getAllToggleableKeys(actor) {
        return actor ? getAllKeys(actor) : [];
    },

    async getInSectionItemKeys(key, actor) {
        return actor ? getChildKeys(key, actor) : [];
    },

    getDefaultHiddenElements(actor, current = {}) {
        return getDefaultHiddenElements(actor, current);
    }
};
