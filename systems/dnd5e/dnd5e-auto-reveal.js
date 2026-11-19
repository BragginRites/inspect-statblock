/**
 * @fileoverview D&D 5e auto-reveal: show features when they are used, and
 * defenses when they come into play.
 *
 * Which client handles what:
 * - Hooks that fire on every client (createChatMessage, createActiveEffect) are
 *   handled only by the active GM.
 * - Hooks that fire only on the acting client (postUseActivity, calculateDamage/
 *   applyDamage, midi-qol) write only if that user may update the flag document;
 *   updateHiddenElements checks the permission.
 * Writing a value that is already set is a no-op, so overlapping paths are harmless.
 */

import { MODULE_ID } from '../../src/core/constants.js';
import { log } from '../../src/core/logger.js';
import { resolveFlagDocument, getHiddenElements, updateHiddenElements, isResponsibleGM } from '../../src/core/flags.js';
import { isListedFeature, featureKey, traitHas, toKey, getDefenseTagKeys, isElementHidden } from './dnd5e-visibility.js';

/** Damage types captured in dnd5e.calculateDamage, keyed by the options object shared with applyDamage. */
const pendingDamage = new WeakMap();

/** Damage modification flag (on dnd5e damage descriptions) → defense category. */
const ACTIVE_TO_CATEGORY = {
    resistance: 'resistances',
    immunity: 'immunities',
    vulnerability: 'vulnerabilities'
};

const TRAIT_FOR_CATEGORY = {
    resistances: 'dr',
    immunities: 'di',
    vulnerabilities: 'dv'
};

function _setting(key) {
    try {
        return game.settings.get(MODULE_ID, key);
    } catch {
        return false;
    }
}

/* -------------------------------------------- */
/*  Reveal operations                           */
/* -------------------------------------------- */

/**
 * Reveal a feature item on its actor's statblock.
 * @param {Item} item
 */
async function revealFeature(item) {
    if (!isListedFeature(item) || !item.actor) return;
    const doc = resolveFlagDocument(item.actor, item.actor.token);
    if (await updateHiddenElements(doc, { [featureKey(item)]: false })) {
        log.debug(`Revealed feature ${item.name} on ${item.actor.name}`);
    }
}

/**
 * Reveal defense tags. Sibling tags in the same category get explicit flags first,
 * so revealing the category header doesn't reveal tags that were only hidden by
 * inheriting the category state.
 * @param {Actor} actor
 * @param {Array<{category: string, value: string}>} reveals
 */
async function revealDefenses(actor, reveals) {
    if (!actor || !reveals.length) return;
    const doc = resolveFlagDocument(actor, actor.token);
    if (!doc) return;

    const current = getHiddenElements(doc);
    const changes = {};
    for (const { category } of reveals) {
        for (const tagKey of getDefenseTagKeys(actor, category)) {
            if (!(tagKey in current) && !(tagKey in changes)) changes[tagKey] = isElementHidden(tagKey, current);
        }
    }
    for (const { category, value } of reveals) {
        changes[`def-${category}`] = false;
        changes[`def-tag-${category}-${toKey(value)}`] = false;
    }

    if (await updateHiddenElements(doc, changes)) {
        log.debug(`Revealed defenses on ${actor.name}`, reveals);
    }
}

/* -------------------------------------------- */
/*  Extraction helpers                          */
/* -------------------------------------------- */

/**
 * The item a dnd5e chat message was created for, if any.
 * @param {ChatMessage} message
 * @returns {Item|null}
 */
function _itemFromMessage(message) {
    try {
        const item = message.getAssociatedItem?.();
        if (item?.documentName === 'Item') return item;
    } catch (err) {
        log.debug('getAssociatedItem failed:', err);
    }
    const uuid = message.flags?.dnd5e?.item?.uuid ?? message.flags?.dnd5e?.activity?.uuid?.split('.Activity.')[0];
    if (!uuid) return null;
    const doc = fromUuidSync(uuid, { strict: false });
    return doc?.documentName === 'Item' ? doc : null;
}

/**
 * The item from dnd5e activity hook arguments.
 * @param {any[]} args
 * @returns {Item|null}
 */
function _itemFromActivityArgs(args) {
    for (const arg of args) {
        if (!arg) continue;
        if (arg.documentName === 'Item') return arg;
        if (arg.item?.documentName === 'Item') return arg.item;
        if (arg.activity?.item?.documentName === 'Item') return arg.activity.item;
    }
    return null;
}

/**
 * Defenses that applied to a set of dnd5e damage descriptions.
 * Prefers dnd5e's own record of which modifications applied (damage.active), which
 * respects bypasses such as magical weapons; falls back to matching damage types
 * against the actor's traits.
 * @param {Actor} actor
 * @param {object[]} damages
 * @returns {Array<{category: string, value: string}>}
 */
function _revealsFromDamages(actor, damages) {
    const traits = actor?.system?.traits;
    if (!traits || !Array.isArray(damages)) return [];
    const reveals = [];
    for (const damage of damages) {
        const type = damage?.type;
        if (!type || type === 'none') continue;
        if (damage.active && typeof damage.active === 'object') {
            // dnd5e 5.x records applied modifications under active.type; older versions at the top level.
            const applied = (damage.active.type && typeof damage.active.type === 'object') ? damage.active.type : damage.active;
            for (const [flag, category] of Object.entries(ACTIVE_TO_CATEGORY)) {
                if (applied[flag]) reveals.push({ category, value: type });
            }
        } else {
            for (const [category, trait] of Object.entries(TRAIT_FOR_CATEGORY)) {
                if (traitHas(traits[trait], type)) reveals.push({ category, value: type });
            }
        }
    }
    return reveals;
}

/**
 * Defenses matching a list of damage type ids (used for midi-qol).
 * @param {Actor} actor
 * @param {string[]} types
 */
function _revealsFromTypes(actor, types) {
    return _revealsFromDamages(actor, types.map(type => ({ type })));
}

/* -------------------------------------------- */
/*  Hook registration                           */
/* -------------------------------------------- */

export function registerAutoRevealHooks() {
    // Condition immunity: a condition the actor is immune to was applied.
    Hooks.on('createActiveEffect', async effect => {
        if (!isResponsibleGM()) return;
        const actor = effect.parent;
        if (actor?.documentName !== 'Actor') return;
        const reveals = [];
        for (const status of effect.statuses ?? []) {
            if (traitHas(actor.system?.traits?.ci, status)) reveals.push({ category: 'conditionimmunities', value: status });
        }
        try {
            await revealDefenses(actor, reveals);
        } catch (err) {
            log.warn('Condition immunity reveal failed:', err);
        }
    });

    // Feature use, seen by the GM through the chat card every client receives.
    Hooks.on('createChatMessage', async message => {
        if (!isResponsibleGM() || !_setting('autoRevealOnFeatureUse')) return;
        const item = _itemFromMessage(message);
        if (!item) return;
        try {
            await revealFeature(item);
        } catch (err) {
            log.warn('Feature reveal (chat message) failed:', err);
        }
    });

    // Feature use on the acting client, for uses that create no chat card.
    Hooks.on('dnd5e.postUseActivity', async (...args) => {
        if (!_setting('autoRevealOnFeatureUse')) return;
        const item = _itemFromActivityArgs(args);
        if (!item) return;
        try {
            await revealFeature(item);
        } catch (err) {
            log.warn('Feature reveal (activity) failed:', err);
        }
    });

    // Damage: calculateDamage also runs for previews, so only reveal once damage is applied.
    Hooks.on('dnd5e.calculateDamage', (actor, damages, options) => {
        if (!options || typeof options !== 'object' || !_setting('autoRevealOnDamage')) return;
        pendingDamage.set(options, _revealsFromDamages(actor, damages));
    });

    Hooks.on('dnd5e.applyDamage', async (actor, amount, options) => {
        if (!options || typeof options !== 'object') return;
        const reveals = pendingDamage.get(options);
        pendingDamage.delete(options);
        if (!reveals?.length || !_setting('autoRevealOnDamage')) return;
        try {
            await revealDefenses(actor, reveals);
        } catch (err) {
            log.warn('Damage reveal failed:', err);
        }
    });

    // midi-qol applies damage through its own workflow.
    Hooks.on('midi-qol.RollComplete', async workflow => {
        if (!_setting('autoRevealOnDamage')) return;
        const details = [workflow?.damageDetail, workflow?.damageDetails, workflow?.rawDamageDetail]
            .find(d => Array.isArray(d) && d.length) ?? [];
        const types = [...new Set(details.flat().map(d => d?.type).filter(t => t && t !== 'none'))];
        if (!types.length || !workflow?.targets?.size) return;

        for (const target of workflow.targets) {
            const actor = target?.actor;
            if (!actor) continue;
            try {
                await revealDefenses(actor, _revealsFromTypes(actor, types));
            } catch (err) {
                log.warn('midi-qol damage reveal failed:', err);
            }
        }
    });
}
