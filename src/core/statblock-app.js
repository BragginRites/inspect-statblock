/**
 * @fileoverview The statblock window (ApplicationV2).
 */

import { MODULE_ID } from './constants.js';
import { log } from './logger.js';
import { systemRegistry } from './system-registry.js';
import { renderStatblockFromSIDS } from './renderer.js';
import { resolveFlagDocument, getHiddenElements, updateHiddenElements, toTokenDocument, getStorageMode } from './flags.js';

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** Hooks that mean "something on an actor changed" for embedded documents. */
const EMBEDDED_HOOKS = [
    'createItem', 'updateItem', 'deleteItem',
    'createActiveEffect', 'updateActiveEffect', 'deleteActiveEffect'
];

export class InspectStatblockApp extends HandlebarsApplicationMixin(ApplicationV2) {

    /** Marker used by open-apps.js to find statblock windows. */
    static isInspectStatblockApp = true;

    static DEFAULT_OPTIONS = {
        classes: [MODULE_ID, 'inspect-statblock-app'],
        window: {
            resizable: true
        },
        position: {
            width: 500
        },
        actions: {
            showAll: InspectStatblockApp.#onShowAll,
            hideAll: InspectStatblockApp.#onHideAll
        }
    };

    static PARTS = {
        body: {
            template: `modules/${MODULE_ID}/templates/inspect-statblock-shell.hbs`,
            scrollable: ['']
        }
    };

    /**
     * @param {Actor} actor - The actor to display (a synthetic actor for unlinked tokens).
     * @param {Token|TokenDocument|null} token - The token being inspected.
     * @param {object} [options] - ApplicationV2 options.
     */
    constructor(actor, token, options = {}) {
        options.position ??= {};
        options.position.height ??= Math.min(1000, Math.floor(window.innerHeight * 0.85));
        super(options);

        this.actor = actor;
        this.tokenDocument = toTokenDocument(token);
        this.tokenId = this.tokenDocument?.id ?? null;
        this.systemHandler = systemRegistry.getHandler(game.system.id);
        this.sidsData = null;

        this._hookIds = [];
        this._debouncedRender = foundry.utils.debounce(() => {
            if (this.rendered) this.render();
        }, 50);
    }

    /**
     * The document holding this window's visibility flags. Resolved on demand so a
     * change to the storage mode setting is picked up without reopening.
     * @type {Actor|null}
     */
    get flagDocument() {
        return resolveFlagDocument(this.actor, this.tokenDocument);
    }

    /** @deprecated Use flagDocument. Kept for external callers of the 1.x API. */
    get baseActor() {
        return this.flagDocument;
    }

    /** @override */
    get title() {
        if (!this.actor) return game.i18n.localize('INSPECTSTATBLOCK.WindowTitle');

        let title = this.sidsData?.headerInfo?.name
            ?? this.tokenDocument?.name
            ?? this.actor.name;

        // Tell the GM when an unlinked token shares its flags with the world actor.
        const flagDoc = this.flagDocument;
        if (game.user.isGM && getStorageMode() === 'per-actor' && flagDoc && flagDoc !== this.actor) {
            title += ` (${game.i18n.format('INSPECTSTATBLOCK.SharedWith', { name: flagDoc.name })})`;
        }
        return title;
    }

    /* -------------------------------------------- */
    /*  Rendering                                   */
    /* -------------------------------------------- */

    /** @override */
    async _prepareContext(options) {
        const context = await super._prepareContext(options);
        context.statblockHtml = await this.#buildStatblockHtml();
        return context;
    }

    async #buildStatblockHtml() {
        if (!this.actor) return `<p>${game.i18n.localize('INSPECTSTATBLOCK.Errors.NoActor')}</p>`;

        if (!this.systemHandler) {
            const message = game.i18n.format('INSPECTSTATBLOCK.Errors.NoHandler', { system: game.system.id });
            ui.notifications.warn(message);
            return `<p>${message}</p>`;
        }

        try {
            const hiddenElements = getHiddenElements(this.flagDocument);
            this.sidsData = await this.systemHandler.getStandardizedActorData(
                this.actor, this.tokenDocument, hiddenElements, game.user.isGM
            );
            if (!this.sidsData) return `<p>${game.i18n.localize('INSPECTSTATBLOCK.Errors.NoData')}</p>`;
            return await renderStatblockFromSIDS(this.sidsData);
        } catch (err) {
            log.error('Error building statblock:', err);
            return `<p>${game.i18n.localize('INSPECTSTATBLOCK.Errors.RenderFailed')}</p>`;
        }
    }

    /**
     * Add Show All / Hide All buttons to the header for GMs.
     * @override
     */
    async _renderFrame(options) {
        const frame = await super._renderFrame(options);
        if (!game.user.isGM || !this.hasFrame) return frame;

        const header = frame.querySelector('.window-header');
        const closeButton = header?.querySelector('[data-action="close"]');
        const buttons = [
            { action: 'showAll', icon: 'fa-eye', label: 'INSPECTSTATBLOCK.ButtonTitleShowAll' },
            { action: 'hideAll', icon: 'fa-eye-slash', label: 'INSPECTSTATBLOCK.ButtonTitleHideAll' }
        ];
        for (const { action, icon, label } of buttons) {
            const button = document.createElement('button');
            button.type = 'button';
            button.className = `header-control icon fa-solid ${icon}`;
            button.dataset.action = action;
            button.dataset.tooltip = game.i18n.localize(label);
            button.setAttribute('aria-label', game.i18n.localize(label));
            if (closeButton) closeButton.before(button);
            else header?.append(button);
        }
        return frame;
    }

    /** @override */
    async _onFirstRender(context, options) {
        await super._onFirstRender(context, options);
        this.element.dataset.userIsGm = String(game.user.isGM);

        if (game.user.isGM) {
            this.element.addEventListener('contextmenu', this.#onContextMenu.bind(this));
        }

        this.#registerHook('updateActor', (actor, changes) => {
            if (!this.#isRelevantActor(actor)) return;
            const keys = Object.keys(changes ?? {}).filter(k => k !== '_id' && k !== '_stats');
            if (keys.length) this._debouncedRender();
        });

        for (const hook of EMBEDDED_HOOKS) {
            this.#registerHook(hook, doc => {
                if (this.#isOwnedByRelevantActor(doc)) this._debouncedRender();
            });
        }

        this.#registerHook('updateToken', doc => {
            if (doc === this.tokenDocument) this._debouncedRender();
        });

        this.#registerHook('deleteToken', doc => {
            if (doc === this.tokenDocument) this.close();
        });
    }

    /** @override */
    _onClose(options) {
        for (const [hook, id] of this._hookIds) Hooks.off(hook, id);
        this._hookIds = [];
        super._onClose(options);
    }

    #registerHook(hook, fn) {
        this._hookIds.push([hook, Hooks.on(hook, fn)]);
    }

    /**
     * Whether an actor is the displayed actor or the one holding our flags.
     * Compared by uuid so a synthetic token actor and its world actor are distinct.
     */
    #isRelevantActor(actor) {
        if (!actor || !this.actor) return false;
        return actor.uuid === this.actor.uuid || actor.uuid === this.flagDocument?.uuid;
    }

    #isOwnedByRelevantActor(doc) {
        let parent = doc?.parent;
        while (parent) {
            if (parent.documentName === 'Actor') return this.#isRelevantActor(parent);
            parent = parent.parent;
        }
        return false;
    }

    /* -------------------------------------------- */
    /*  Visibility toggling (GM)                    */
    /* -------------------------------------------- */

    /**
     * Effective hidden state of an element, including inherited defaults.
     * @param {string} key
     * @param {Record<string, boolean>} hiddenElements
     */
    #isHidden(key, hiddenElements) {
        if (typeof this.systemHandler?.isElementHidden === 'function') {
            return this.systemHandler.isElementHidden(key, hiddenElements);
        }
        return !!hiddenElements[key];
    }

    async #onContextMenu(event) {
        const target = event.target.closest('[data-element-key]');
        if (!target || !this.element.contains(target)) return;
        event.preventDefault();
        event.stopPropagation();

        if (!game.user.isGM || !this.systemHandler) return;
        const key = target.dataset.elementKey;
        if (!key) return;

        const flagDoc = this.flagDocument;
        const hiddenElements = getHiddenElements(flagDoc);

        // Group headers (sections, defense categories) toggle all of their children together.
        let children = [];
        if (typeof this.systemHandler.getInSectionItemKeys === 'function') {
            try {
                children = await this.systemHandler.getInSectionItemKeys(key, this.actor, this.sidsData) ?? [];
            } catch (err) {
                log.error(`Error getting child keys for ${key}:`, err);
            }
        }

        const changes = {};
        if (children.length) {
            const hide = children.some(k => !this.#isHidden(k, hiddenElements));
            changes[key] = hide;
            for (const k of children) changes[k] = hide;
        } else {
            changes[key] = !this.#isHidden(key, hiddenElements);
        }

        log.debug(`Toggling ${key}`, changes);
        await updateHiddenElements(flagDoc, changes);
    }

    static async #onShowAll() {
        await this.#setAllHidden(false);
    }

    static async #onHideAll() {
        await this.#setAllHidden(true);
    }

    async #setAllHidden(hidden) {
        if (!game.user.isGM || typeof this.systemHandler?.getAllToggleableKeys !== 'function') return;
        try {
            const keys = await this.systemHandler.getAllToggleableKeys(this.actor, this.sidsData);
            const changes = Object.fromEntries(keys.map(k => [k, hidden]));
            await updateHiddenElements(this.flagDocument, changes);
        } catch (err) {
            log.error('Error updating all elements:', err);
        }
    }
}
