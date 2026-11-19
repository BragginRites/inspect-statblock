/**
 * @fileoverview Pathfinder 2e auto-reveal: show abilities when they are used, and
 * immunities, weaknesses and resistances when they affect damage.
 *
 * Both are read from chat messages, which every client receives, so only the
 * active GM writes:
 * - Ability use: the message's item (pf2e resolves strikes, actions and feats).
 * - Damage: pf2e's "damage-taken" message lists the IWR it applied, by label.
 *
 * Condition immunities are not revealed automatically: pf2e drops a condition the
 * actor is immune to before it is created, so no hook sees it.
 */

import { MODULE_ID } from '../../src/core/constants.js';
import { log } from '../../src/core/logger.js';
import { resolveFlagDocument, getHiddenElements, updateHiddenElements, isResponsibleGM } from '../../src/core/flags.js';
import {
    isListedFeature, featureKey, getDefenseEntries, defenseTagKey, getDefenseTagKeys, isElementHidden
} from './pf2e-visibility.js';

/** pf2e IWR application category → defense category id. */
const APPLICATION_TO_CATEGORY = {
    immunity: 'immunities',
    weakness: 'weaknesses',
    resistance: 'resistances'
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
 * Reveal an ability item on its actor's statblock.
 * @param {Item} item
 */
async function revealFeature(item) {
    if (!isListedFeature(item) || !item.actor) return;
    const doc = resolveFlagDocument(item.actor, item.actor.token);
    if (await updateHiddenElements(doc, { [featureKey(item)]: false })) {
        log.debug(`Revealed ${item.name} on ${item.actor.name}`);
    }
}

/**
 * Reveal defense tags. Sibling tags in the same category get explicit flags first,
 * so revealing the category header doesn't reveal tags that were only hidden by
 * inheriting the category state.
 * @param {Actor} actor
 * @param {Array<{category: string, tagKey: string}>} reveals
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
    for (const { category, tagKey } of reveals) {
        changes[`def-${category}`] = false;
        changes[tagKey] = false;
    }

    if (await updateHiddenElements(doc, changes)) {
        log.debug(`Revealed defenses on ${actor.name}`, reveals);
    }
}

/* -------------------------------------------- */
/*  Extraction helpers                          */
/* -------------------------------------------- */

/**
 * IWR applications recorded on a pf2e damage-taken message.
 * @param {ChatMessage} message
 * @returns {Array<{category: string, type: string}>}
 */
function _applicationsFromMessage(message) {
    const content = message?.content;
    if (typeof content !== 'string' || !content.includes('data-applications')) return [];
    const doc = new DOMParser().parseFromString(content, 'text/html');
    const results = [];
    for (const el of doc.querySelectorAll('[data-applications]')) {
        try {
            const parsed = JSON.parse(el.dataset.applications ?? 'null');
            if (Array.isArray(parsed)) results.push(...parsed.filter(a => typeof a?.category === 'string' && typeof a?.type === 'string'));
        } catch (err) {
            log.debug('Could not parse IWR applications:', err);
        }
    }
    return results;
}

/**
 * Match applied IWR (identified by label) to the actor's entries.
 * @param {Actor} actor
 * @param {Array<{category: string, type: string}>} applications
 * @returns {Array<{category: string, tagKey: string}>}
 */
function _revealsFromApplications(actor, applications) {
    const reveals = [];
    for (const application of applications) {
        const category = APPLICATION_TO_CATEGORY[application.category];
        if (!category) continue;
        const label = application.type.trim().toLowerCase();
        for (const entry of getDefenseEntries(actor, category)) {
            const labels = [entry.typeLabel, entry.applicationLabel, entry.label]
                .filter(l => typeof l === 'string')
                .map(l => l.trim().toLowerCase());
            if (labels.includes(label)) reveals.push({ category, tagKey: defenseTagKey(category, entry) });
        }
    }
    return reveals;
}

/* -------------------------------------------- */
/*  Hook registration                           */
/* -------------------------------------------- */

export function registerPf2eAutoRevealHooks() {
    Hooks.on('createChatMessage', async message => {
        if (!isResponsibleGM()) return;
        const context = message.flags?.pf2e?.context;

        if (context?.type === 'damage-taken') {
            if (!_setting('autoRevealOnDamage')) return;
            const actor = message.actor ?? message.token?.actor;
            try {
                await revealDefenses(actor, _revealsFromApplications(actor, _applicationsFromMessage(message)));
            } catch (err) {
                log.warn('Damage reveal failed:', err);
            }
            return;
        }

        if (!_setting('autoRevealOnFeatureUse')) return;
        let item = null;
        try {
            item = message.item;
        } catch (err) {
            log.debug('message.item failed:', err);
        }
        if (item?.documentName !== 'Item') return;
        try {
            await revealFeature(item);
        } catch (err) {
            log.warn('Ability reveal failed:', err);
        }
    });
}
