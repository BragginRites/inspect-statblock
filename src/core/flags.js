/**
 * @fileoverview Visibility flag storage.
 *
 * All reads and writes of the hiddenElements map go through this file so the
 * statblock window, auto-reveal and default initialization agree on where the
 * data lives:
 *
 * - "per-actor": the world (base) Actor. Every token of that actor shares flags.
 * - "per-token": the token's own actor. For unlinked tokens this is the
 *   synthetic actor (stored in the token's ActorDelta); linked tokens share the
 *   world Actor anyway.
 */

import { MODULE_ID, FLAG_KEY } from './constants.js';
import { log } from './logger.js';

/**
 * @returns {"per-actor"|"per-token"}
 */
export function getStorageMode() {
    try {
        return game.settings.get(MODULE_ID, 'flagStorageMode') || 'per-actor';
    } catch {
        return 'per-actor';
    }
}

/**
 * Normalize a Token placeable or TokenDocument to a TokenDocument.
 * @param {Token|TokenDocument|null|undefined} token
 * @returns {TokenDocument|null}
 */
export function toTokenDocument(token) {
    if (!token) return null;
    if (token.documentName === 'Token') return token;
    return token.document ?? null;
}

/**
 * Resolve the document whose flags hold visibility state for an actor/token.
 * @param {Actor} actor - The displayed actor (may be synthetic).
 * @param {Token|TokenDocument|null} [token] - The token, if known.
 * @returns {Actor|null}
 */
export function resolveFlagDocument(actor, token = null) {
    if (!actor) return null;
    const tokenDoc = toTokenDocument(token) ?? actor.token ?? null;

    if (getStorageMode() === 'per-token') {
        return tokenDoc?.actor ?? actor;
    }

    if (actor.isToken || (tokenDoc && !tokenDoc.actorLink)) {
        const baseId = tokenDoc?.actorId ?? actor.id;
        return game.actors.get(baseId) ?? actor;
    }
    return actor;
}

/**
 * Get a copy of the hiddenElements map stored on a document.
 * @param {Document|null} doc
 * @returns {Record<string, boolean>}
 */
export function getHiddenElements(doc) {
    return foundry.utils.deepClone(doc?.getFlag(MODULE_ID, FLAG_KEY) ?? {});
}

/**
 * Merge changes into a document's hiddenElements map. Writes only keys whose
 * value actually changes, and only if the current user may update the document.
 * @param {Document|null} doc
 * @param {Record<string, boolean>} changes
 * @returns {Promise<boolean>} True if an update was sent.
 */
export async function updateHiddenElements(doc, changes) {
    if (!doc || !changes) return false;
    const current = doc.getFlag(MODULE_ID, FLAG_KEY) ?? {};
    const diff = {};
    for (const [key, value] of Object.entries(changes)) {
        if (current[key] !== value) diff[key] = value;
    }
    if (foundry.utils.isEmpty(diff)) return false;

    if (!doc.canUserModify(game.user, 'update')) {
        log.debug(`No permission to update visibility flags on ${doc.name}; skipped.`, diff);
        return false;
    }

    await doc.update({ [`flags.${MODULE_ID}.${FLAG_KEY}`]: diff });
    return true;
}

/**
 * Whether the current user should handle world-wide automation (hooks that fire
 * on every client). Exactly one connected GM returns true.
 * @returns {boolean}
 */
export function isResponsibleGM() {
    return game.users?.activeGM?.isSelf ?? false;
}

/**
 * Write default visibility for any element that has no flag yet.
 * Uses the system handler's getDefaultHiddenElements(actor).
 * @param {object} handler - The system handler.
 * @param {Actor} actor
 * @param {Token|TokenDocument|null} [token]
 * @returns {Promise<boolean>} True if an update was sent.
 */
export async function ensureDefaultFlags(handler, actor, token = null) {
    if (!actor || typeof handler?.getDefaultHiddenElements !== 'function') return false;
    const doc = resolveFlagDocument(actor, token);
    if (!doc) return false;

    const current = doc.getFlag(MODULE_ID, FLAG_KEY) ?? {};
    const defaults = handler.getDefaultHiddenElements(actor, current);
    const missing = {};
    for (const [key, hidden] of Object.entries(defaults)) {
        if (!(key in current)) missing[key] = hidden;
    }
    return updateHiddenElements(doc, missing);
}
