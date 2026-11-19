/**
 * @fileoverview Entry point for Inspect Statblock: public API, keybindings,
 * Token HUD button and world-level hooks.
 */

import { MODULE_ID, APP_ID } from './constants.js';
import { log, setDebugEnabled } from './logger.js';
import { systemRegistry } from './system-registry.js';
import { registerCoreSettings } from './settings.js';
import { InspectStatblockApp } from './statblock-app.js';
import { getStatblockApps } from './open-apps.js';
import { ensureDefaultFlags, isResponsibleGM, resolveFlagDocument, toTokenDocument } from './flags.js';

const HUD_BUTTON_CLASS = 'inspect-statblock-hud-button';

const systemTemplateRegistry = {};

export const InspectStatblockCore = {
    MODULE_ID,

    /**
     * Registers system-specific template paths for loading.
     * @param {string} systemId - The game system ID.
     * @param {string[]} paths - Template paths relative to the module root.
     */
    registerSystemTemplatePaths(systemId, paths) {
        if (!Array.isArray(paths)) {
            log.error(`registerSystemTemplatePaths: paths must be an array for system ${systemId}.`);
            return;
        }
        systemTemplateRegistry[systemId] = (systemTemplateRegistry[systemId] || []).concat(paths);
    },

    /**
     * Registers a system handler with the core module.
     * @param {string} systemId - The game system ID (e.g. 'dnd5e').
     * @param {object} handler - Object implementing the SystemHandler interface.
     */
    registerSystemHandler(systemId, handler) {
        if (!handler) {
            log.error(`registerSystemHandler: a handler must be provided for system ${systemId}.`);
            return;
        }
        try {
            systemRegistry.register(systemId, handler);
        } catch (err) {
            log.error(`registerSystemHandler: failed to register handler for ${systemId}:`, err);
        }
    },

    /** @returns {SystemHandlerRegistry} */
    getSystemRegistry() {
        return systemRegistry;
    },

    /**
     * @param {string} systemId
     * @returns {object|null}
     */
    getSystemHandler(systemId) {
        return systemRegistry.getHandler(systemId);
    }
};

globalThis.InspectStatblockCore = InspectStatblockCore;

/* -------------------------------------------- */
/*  Opening and closing windows                 */
/* -------------------------------------------- */

/**
 * Window id for a token. Includes the scene so tokens on different scenes never collide.
 * @param {TokenDocument} tokenDoc
 */
function _appIdForToken(tokenDoc) {
    return `${APP_ID}-${tokenDoc.parent?.id ?? 'none'}-${tokenDoc.id}`;
}

/**
 * Opens the statblock for a token, or closes it if it is already open.
 * Shared by the HUD button and keybindings.
 * @param {Token|TokenDocument} token
 */
export function _openInspectStatblockForToken(token) {
    const tokenDoc = toTokenDocument(token);
    if (!tokenDoc?.actor) {
        ui.notifications.warn(game.i18n.localize('INSPECTSTATBLOCK.Notifications.NoActor'));
        return;
    }

    const id = _appIdForToken(tokenDoc);
    const existing = foundry.applications.instances.get(id);
    if (existing) {
        existing.close();
        return;
    }

    new InspectStatblockApp(tokenDoc.actor, tokenDoc, { id }).render({ force: true });
}

/**
 * Opens the statblock for the hovered token, falling back to the first targeted token.
 */
export function _openInspectStatblockForHoveredOrTargetedToken() {
    const hovered = canvas.tokens?.hover;
    if (hovered?.actor) {
        _openInspectStatblockForToken(hovered);
        return;
    }

    const target = game.user.targets.first();
    if (target?.actor) {
        _openInspectStatblockForToken(target);
        return;
    }

    ui.notifications.warn(game.i18n.localize('INSPECTSTATBLOCK.Notifications.NoToken'));
}

/**
 * Opens the statblock for the first targeted token, falling back to the hovered token.
 */
export function _openInspectStatblockForTargetedToken() {
    const target = game.user.targets.first();
    if (target?.actor) _openInspectStatblockForToken(target);
    else _openInspectStatblockForHoveredOrTargetedToken();
}

export function _closeAllInspectStatblockApps() {
    for (const app of getStatblockApps()) app.close();
}

/* -------------------------------------------- */
/*  Hooks                                       */
/* -------------------------------------------- */

Hooks.on('renderTokenHUD', (hud, element) => {
    const token = hud.object;
    if (!token?.actor) return;

    const root = element instanceof HTMLElement ? element : element?.[0];
    const column = root?.querySelector('.col.left');
    if (!column || column.querySelector(`.${HUD_BUTTON_CLASS}`)) return;

    const label = game.i18n.localize('INSPECTSTATBLOCK.HudButton');
    const button = document.createElement('button');
    button.type = 'button';
    button.classList.add('control-icon', HUD_BUTTON_CLASS);
    button.dataset.tooltip = label;
    button.setAttribute('aria-label', label);
    button.innerHTML = '<i class="fa-solid fa-magnifying-glass" inert></i>';
    button.addEventListener('click', event => {
        event.preventDefault();
        _openInspectStatblockForToken(token);
    });
    column.append(button);
});

Hooks.once('init', () => {
    registerCoreSettings();
    setDebugEnabled(game.settings.get(MODULE_ID, 'enableDebugMode'));

    game.keybindings.register(MODULE_ID, 'openInspectStatblock', {
        name: 'INSPECTSTATBLOCK.Keybindings.Open.Name',
        hint: 'INSPECTSTATBLOCK.Keybindings.Open.Hint',
        editable: [{ key: 'KeyI' }],
        onDown: () => { _openInspectStatblockForHoveredOrTargetedToken(); return true; },
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });

    game.keybindings.register(MODULE_ID, 'closeAllInspectStatblocks', {
        name: 'INSPECTSTATBLOCK.Keybindings.CloseAll.Name',
        hint: 'INSPECTSTATBLOCK.Keybindings.CloseAll.Hint',
        editable: [{ key: 'KeyI', modifiers: ['Alt'] }],
        onDown: () => { _closeAllInspectStatblockApps(); return true; },
        restricted: false,
        precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
});

Hooks.once('ready', async () => {
    const module = game.modules.get(MODULE_ID);
    module.api = Object.assign(module.api ?? {}, {
        InspectStatblockApp,
        openForToken: _openInspectStatblockForToken,
        closeAll: _closeAllInspectStatblockApps
    });

    const paths = systemTemplateRegistry[game.system.id] ?? [];
    if (paths.length) {
        await foundry.applications.handlebars.loadTemplates(paths.map(p => `modules/${MODULE_ID}/${p}`));
    }
});

/* -------------------------------------------- */
/*  Default visibility snapshot                 */
/* -------------------------------------------- */
/*
 * Defaults are written as flags when a token is placed so later changes to the
 * default settings don't retroactively reveal or hide things on existing creatures.
 * New elements (items, effects, defenses) get defaults once the actor already has
 * flags. These hooks fire on every client, so only the active GM writes.
 */

function _handler() {
    return systemRegistry.getHandler(game.system.id);
}

function _hasFlags(actor) {
    const doc = resolveFlagDocument(actor);
    return !!doc?.getFlag(MODULE_ID, 'hiddenElements');
}

async function _safeEnsureDefaults(actor, token = null) {
    try {
        await ensureDefaultFlags(_handler(), actor, token);
    } catch (err) {
        log.error(`Failed to write default visibility for ${actor?.name}:`, err);
    }
}

function _actorOf(doc) {
    let parent = doc?.parent;
    while (parent) {
        if (parent.documentName === 'Actor') return parent;
        parent = parent.parent;
    }
    return null;
}

Hooks.on('createToken', tokenDoc => {
    if (!isResponsibleGM() || !tokenDoc.actor) return;
    _safeEnsureDefaults(tokenDoc.actor, tokenDoc);
});

Hooks.on('updateActor', (actor, changes) => {
    if (!isResponsibleGM() || !_hasFlags(actor)) return;
    // Our own flag writes don't add elements; skip them to avoid redundant work.
    const keys = Object.keys(changes ?? {}).filter(k => k !== '_id' && k !== '_stats');
    if (keys.length === 1 && keys[0] === 'flags' && Object.keys(changes.flags).every(k => k === MODULE_ID)) return;
    _safeEnsureDefaults(actor);
});

for (const hook of ['createItem', 'createActiveEffect']) {
    Hooks.on(hook, doc => {
        if (!isResponsibleGM()) return;
        const actor = _actorOf(doc);
        if (actor && _hasFlags(actor)) _safeEnsureDefaults(actor);
    });
}
