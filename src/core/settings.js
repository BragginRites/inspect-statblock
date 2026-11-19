/**
 * @fileoverview Core settings registration.
 */

import { MODULE_ID, FLAG_KEY } from './constants.js';
import { log, setDebugEnabled } from './logger.js';
import { refreshOpenStatblocks } from './open-apps.js';
import { DefaultVisibilityConfigApp } from './settings-menu.js';

const { ApplicationV2, DialogV2 } = foundry.applications.api;

/**
 * Settings-menu entry that only shows a confirmation dialog.
 * Foundry instantiates the menu type and calls render(), so render is replaced.
 */
class ClearAllFlagsApp extends ApplicationV2 {
    /** @override */
    async render() {
        const confirmed = await DialogV2.confirm({
            window: { title: game.i18n.localize('INSPECTSTATBLOCK.ClearFlags.Title') },
            content: game.i18n.localize('INSPECTSTATBLOCK.ClearFlags.Content'),
            modal: true,
            rejectClose: false,
            no: { default: true }
        });
        if (confirmed) await _clearAllInspectStatblockFlags();
        return this;
    }
}

/**
 * Registers all core settings for the Inspect Statblock module.
 */
export function registerCoreSettings() {
    game.settings.registerMenu(MODULE_ID, 'defaultVisibilityMenu', {
        name: 'INSPECTSTATBLOCK.Settings.DefaultVisibility.Name',
        label: 'INSPECTSTATBLOCK.Settings.DefaultVisibility.Label',
        hint: 'INSPECTSTATBLOCK.Settings.DefaultVisibility.Hint',
        icon: 'fa-solid fa-eye',
        type: DefaultVisibilityConfigApp,
        restricted: true
    });

    // Hidden setting holding all default visibility choices as one object.
    game.settings.register(MODULE_ID, 'defaultVisibilitySettings', {
        scope: 'world',
        config: false,
        type: Object,
        default: {},
        onChange: () => refreshOpenStatblocks()
    });

    game.settings.register(MODULE_ID, 'flagStorageMode', {
        name: 'INSPECTSTATBLOCK.Settings.FlagStorageMode.Name',
        hint: 'INSPECTSTATBLOCK.Settings.FlagStorageMode.Hint',
        scope: 'world',
        config: true,
        type: String,
        choices: {
            'per-actor': 'INSPECTSTATBLOCK.Settings.FlagStorageMode.PerActor',
            'per-token': 'INSPECTSTATBLOCK.Settings.FlagStorageMode.PerToken'
        },
        default: 'per-actor',
        onChange: () => refreshOpenStatblocks()
    });

    game.settings.registerMenu(MODULE_ID, 'clearAllFlagsMenu', {
        name: 'INSPECTSTATBLOCK.Settings.ClearFlags.Name',
        label: 'INSPECTSTATBLOCK.Settings.ClearFlags.Label',
        hint: 'INSPECTSTATBLOCK.Settings.ClearFlags.Hint',
        icon: 'fa-solid fa-trash',
        type: ClearAllFlagsApp,
        restricted: true
    });

    game.settings.register(MODULE_ID, 'autoRevealOnDamage', {
        name: 'INSPECTSTATBLOCK.Settings.AutoRevealOnDamage.Name',
        hint: 'INSPECTSTATBLOCK.Settings.AutoRevealOnDamage.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'autoRevealOnFeatureUse', {
        name: 'INSPECTSTATBLOCK.Settings.AutoRevealOnFeatureUse.Name',
        hint: 'INSPECTSTATBLOCK.Settings.AutoRevealOnFeatureUse.Hint',
        scope: 'world',
        config: true,
        type: Boolean,
        default: true
    });

    game.settings.register(MODULE_ID, 'enableDebugMode', {
        name: 'INSPECTSTATBLOCK.Settings.DebugMode.Name',
        hint: 'INSPECTSTATBLOCK.Settings.DebugMode.Hint',
        scope: 'client',
        config: true,
        type: Boolean,
        default: false,
        onChange: value => setDebugEnabled(value)
    });
}

/**
 * Removes visibility flags everywhere they can be stored: world actors,
 * unlinked token actors (ActorDelta), and legacy flags on TokenDocuments.
 */
async function _clearAllInspectStatblockFlags() {
    let actorsCleared = 0;
    let tokensCleared = 0;
    const hasFlags = doc => !!doc?.getFlag(MODULE_ID, FLAG_KEY);

    try {
        for (const actor of game.actors) {
            if (!hasFlags(actor)) continue;
            await actor.unsetFlag(MODULE_ID, FLAG_KEY);
            actorsCleared++;
        }

        for (const scene of game.scenes) {
            for (const tokenDoc of scene.tokens) {
                let cleared = false;
                // Older versions wrote per-token reveals onto the TokenDocument itself.
                if (hasFlags(tokenDoc)) {
                    await tokenDoc.unsetFlag(MODULE_ID, FLAG_KEY);
                    cleared = true;
                }
                // Unlinked tokens keep per-token flags in their synthetic actor.
                if (!tokenDoc.actorLink && tokenDoc.delta?.flags?.[MODULE_ID]?.[FLAG_KEY]) {
                    await tokenDoc.actor?.unsetFlag(MODULE_ID, FLAG_KEY);
                    cleared = true;
                }
                if (cleared) tokensCleared++;
            }
        }

        ui.notifications.info(game.i18n.format('INSPECTSTATBLOCK.ClearFlags.Done', {
            actors: actorsCleared, tokens: tokensCleared
        }));
        refreshOpenStatblocks();
    } catch (err) {
        log.error('Error clearing visibility flags:', err);
        ui.notifications.error(game.i18n.format('INSPECTSTATBLOCK.ClearFlags.Failed', { error: err.message }));
    }
}
