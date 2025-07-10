// Core application logic for Inspect Statblock module
import { renderStatblockFromSIDS } from './renderer.js';
import { systemRegistry } from './system-registry.js';
import { registerCoreSettings } from './settings.js'; // Import settings registration

const MODULE_ID = 'inspect-statblock';
const APP_ID = 'inspect-statblock-window'; // For Application ID
const HUD_BUTTON_ID = 'inspect-statblock-hud-button';

const systemTemplateRegistry = {};

export const InspectStatblockCore = {
    MODULE_ID,
    
    /**
     * Registers system-specific template paths for loading.
     * @param {string} systemId - The game system ID.
     * @param {Array<string>} paths - Array of template paths to register.
     */
    registerSystemTemplatePaths: function(systemId, paths) {
        if (!Array.isArray(paths)) {
            console.error(`${MODULE_ID} | InspectStatblockCore.registerSystemTemplatePaths: paths must be an array for system ${systemId}.`);
            return;
        }
        systemTemplateRegistry[systemId] = (systemTemplateRegistry[systemId] || []).concat(paths);
        console.log(`${MODULE_ID} | InspectStatblockCore: Registered template paths for ${systemId}:`, paths);
    },
    
    /**
     * Registers a system handler with the core module.
     * @param {string} systemId - The game system ID (e.g., 'dnd5e', 'pf2e').
     * @param {object} handlerClass - The system handler instance implementing the SystemHandler interface.
     */
    registerSystemHandler: function(systemId, handlerClass) {
        if (!handlerClass) {
            console.error(`${MODULE_ID} | InspectStatblockCore.registerSystemHandler: handlerClass must be provided for system ${systemId}.`);
            return;
        }
        
        try {
            systemRegistry.register(systemId, handlerClass);
        } catch (error) {
            console.error(`${MODULE_ID} | InspectStatblockCore.registerSystemHandler: Failed to register handler for ${systemId}:`, error);
        }
    },
    
    /**
     * Gets the system handler registry for advanced use cases.
     * @returns {SystemHandlerRegistry} The system registry instance.
     */
    getSystemRegistry: function() {
        return systemRegistry;
    },
    
    /**
     * Gets a system handler for the specified system ID.
     * @param {string} systemId - The game system ID.
     * @returns {object|null} The system handler, or null if not found.
     */
    getSystemHandler: function(systemId) {
        return systemRegistry.getHandler(systemId);
    }
};

globalThis.InspectStatblockCore = InspectStatblockCore;

console.log(`${MODULE_ID} | Core script loaded. API exposed to globalThis.InspectStatblockCore`);

/**
 * Registers system-specific templates based on the current game system.
 */
async function registerSystemTemplates() {
    const systemId = game.system.id;
    const templatePathsToLoad = systemTemplateRegistry[systemId] || [];

    if (templatePathsToLoad.length > 0) {
        // Paths should be relative to the module root, e.g., 'systems/dnd5e/templates/partials/header.hbs'
        await loadTemplates(templatePathsToLoad.map(path => `modules/${MODULE_ID}/${path}`));
        console.log(`${MODULE_ID} | Loaded system-specific templates for ${systemId} from registry.`);
    } else {
        console.log(`${MODULE_ID} | No templates registered for system ${systemId}. This might be expected if the system doesn\'t use Inspect Statblock specific partials or registers them later.`);
    }
}

/**
 * Main Application class for the Inspect Statblock window.
 */
class InspectStatblockApp extends Application {
    constructor(actor, token, options = {}) {
        super(options);
        this.actor = actor;
        this.token = token;
        this.tokenId = token?.id;
        
        // TODO inspect-statblock: Debug logging for auto-opening bug investigation
        console.log(`${MODULE_ID} | [DEBUG] Creating InspectStatblockApp:`, {
            actorId: actor?.id,
            actorName: actor?.name,
            tokenId: token?.id,
            tokenName: token?.name,
            stackTrace: new Error().stack?.split('\n').slice(1, 5).join('\n') // Get caller stack for tracking source
        });
        
        // Determine the base actor for flag storage
        // If token is linked (actorLink is true), use the base actor
        // If token is not linked, use the token's actor instance
        this.baseActor = this._getBaseActorForFlags(actor, token);
        
        this.hiddenElements = this.baseActor?.getFlag(MODULE_ID, 'hiddenElements') || {};
        this._handleActorUpdateBound = this._handleActorUpdate.bind(this);
    }

    /**
     * Determines which actor to use for flag storage.
     * Checks the flagStorageMode setting to determine whether to use shared (per-actor) 
     * or individual (per-token) flag storage.
     * @param {Actor} actor - The actor instance
     * @param {Token} token - The token instance
     * @returns {Actor} The actor to use for flag storage
     * @private
     */
    _getBaseActorForFlags(actor, token) {
        const flagStorageMode = game.settings.get(MODULE_ID, 'flagStorageMode');
        
        if (flagStorageMode === 'per-token') {
            // Per-token mode: each token has its own flags, even if they share the same base actor
            console.log(`${MODULE_ID} | Using token actor instance for flag storage (per-token mode).`);
            return actor;
        }
        
        // Per-actor mode (default): tokens sharing the same actorId share flags
        if (token && token.document && token.document.actorId) {
            const baseActor = game.actors.get(token.document.actorId);
            if (baseActor) {
                console.log(`${MODULE_ID} | Using base actor (${baseActor.name}) for flag storage (per-actor mode). Token linked: ${token.document.actorLink}`);
                return baseActor;
            }
        }
        
        // Fallback to the actor instance (if no token or base actor not found)
        console.log(`${MODULE_ID} | Using token actor instance for flag storage (fallback).`);
        return actor;
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: APP_ID,
            classes: [MODULE_ID, "inspect-statblock-app"],
            template: `modules/${MODULE_ID}/templates/inspect-statblock-shell.hbs`,
            width: 500,
            height: "1000",
            resizable: true,
            title: "", // Will be set dynamically in get title()
            dataset: {
                "userIsGm": game.user.isGM
            }
        });
    }

    get title() {
        if (!this.actor) return "Inspect Statblock";
        
        // Use token name if available, otherwise use actor name (same logic as D&D 5e handler)
        let displayedName = this.actor.name; // Default to actor's name
        if (this.token && this.token.name && this.token.name !== this.actor.name) {
            displayedName = this.token.name; // Use token's name if it exists and is different
        }
        
        // Check if the name should be hidden for the current user
        if (!game.user.isGM && this.hiddenElements && this.hiddenElements['header-name']) {
            displayedName = "??";
        }
        
        // Just use the name directly, not "Inspect Statblock: name"
        let title = displayedName;
        
        // Add indicator if this token is sharing flags with a base actor
        // For the shared indicator, show the base actor name only if the user is GM or if it's not hidden
        if (this.baseActor && this.baseActor.id !== this.actor.id) {
            let baseActorDisplayName = this.baseActor.name;
            if (!game.user.isGM && this.hiddenElements && this.hiddenElements['header-name']) {
                baseActorDisplayName = "??";
            }
            title += ` (Shared: ${baseActorDisplayName})`;
        }
        
        return title;
    }

    _getHeaderButtons() {
        let buttons = super._getHeaderButtons();
        if (game.user.isGM) {
            buttons = buttons.filter(b => b.class === "close" || b.icon === "fas fa-times"); // Keep only close
            buttons.unshift({
                label: "",
                class: "hide-all-elements",
                icon: "fas fa-eye-slash",
                title: game.i18n.localize("INSPECTSTATBLOCK.ButtonTitleHideAll"),
                onclick: async ev => await this._onHideAllElements(ev)
            });
            buttons.unshift({
                label: "",
                class: "show-all-elements",
                icon: "fas fa-eye",
                title: game.i18n.localize("INSPECTSTATBLOCK.ButtonTitleShowAll"),
                onclick: async ev => await this._onShowAllElements(ev)
            });
        } else {
             buttons = buttons.filter(b => b.class === "close" || b.icon === "fas fa-times"); // Keep only close for players too
        }
        return buttons;
    }

    async getData(options = {}) {
        const data = await super.getData(options);
        data.actor = this.actor;
        data.token = this.token;
        data.moduleId = MODULE_ID;
        data.isGM = game.user.isGM;

        if (!this.actor) {
            console.error(`${MODULE_ID} | InspectStatblockApp.getData: No actor provided.`);
            data.statblockHtml = "<p>Error: No actor data to display.</p>";
            return data;
        }
        
        const systemHandler = await this._getSystemHandler();

        if (!systemHandler) {
            const systemId = this.actor.parent?.system?.id || this.actor.system?.id || game.system.id;
            console.warn(`${MODULE_ID} | No system handler found for system: ${systemId}`);
            ui.notifications.warn(`Inspect Statblock: No system handler configured for game system '${systemId}'.`);
            data.statblockHtml = `<p>Error: No system handler for ${systemId}.</p>`;
            return data;
        }

        try {
            // Store systemHandler on instance for later use in _onToggleVisibility etc.
            this.systemHandler = systemHandler; 

            let currentFlags = this.baseActor.getFlag(MODULE_ID, 'hiddenElements');
            if (data.isGM && (!currentFlags || Object.keys(currentFlags).length === 0)) {
                // TODO inspect-statblock: Debug logging for flag initialization
                console.log(`${MODULE_ID} | [DEBUG] Initializing default visibility flags:`, {
                    actorName: this.baseActor.name,
                    tokenId: this.tokenId,
                    currentFlags
                });
                
                console.log(`${MODULE_ID} | Initializing default visibility flags for GM for actor: ${this.baseActor.name}`);
                const sectionDefinitions = systemHandler.getSystemSectionDefinitions();
                const newFlags = {};

                // Get the visibility settings object instead of individual settings
                const defaultVisibilitySettings = game.settings.get(MODULE_ID, 'defaultVisibilitySettings') || {};

                for (const defKey in sectionDefinitions) {
                    const definition = sectionDefinitions[defKey];
                    if (definition.defaultShowSettingKey) {
                        // Read from the object instead of individual settings
                        const showByDefault = defaultVisibilitySettings[definition.defaultShowSettingKey] ?? true;
                        const isHidden = !showByDefault;

                        if (definition.type === 'single') {
                            newFlags[definition.keyPattern] = isHidden;
                        } else if (definition.type === 'group') {
                            if (definition.keyPattern === 'ability-') {
                                // Delegate to system handler for ability keys
                                const abilityKeys = systemHandler.getDefaultAbilityKeys?.() || [];
                                abilityKeys.forEach(abilKey => {
                                    newFlags[`ability-${abilKey}`] = isHidden;
                                });
                            }
                        }
                    }
                }
                
                // TODO inspect-statblock: Debug logging for flag initialization completion
                console.log(`${MODULE_ID} | [DEBUG] Setting initialized flags:`, {
                    actorName: this.baseActor.name,
                    tokenId: this.tokenId,
                    newFlags
                });
                
                await this.baseActor.setFlag(MODULE_ID, 'hiddenElements', newFlags);
                this.hiddenElements = newFlags;
            } else {
                this.hiddenElements = currentFlags || {};
            }

            const sidsData = await systemHandler.getStandardizedActorData(this.actor, this.token, this.hiddenElements, data.isGM);
            
            if (sidsData) {
                this.sidsData = sidsData; // Store SIDS data on the instance
                data.statblockHtml = await renderStatblockFromSIDS(sidsData);
            } else {
                this.sidsData = null; // Clear if no data
                data.statblockHtml = "<p>Error: Could not retrieve standardized data.</p>";
            }
        } catch (e) {
            console.error(`${MODULE_ID} | Error getting SIDS data or rendering:`, e);
            data.statblockHtml = "<p>Error rendering statblock. Check console.</p>";
        }
        
        return data;
    }
    
    async _getSystemHandler() {
        const systemId = this.actor.parent?.system?.id || this.actor.system?.id || game.system.id;
        return systemRegistry.getHandler(systemId);
    }

    activateListeners(html) {
        super.activateListeners(html);
        Hooks.on('updateActor', this._handleActorUpdateBound);

        if (game.user.isGM) {
            html.find('[data-element-key]').on('contextmenu', this._onToggleVisibility.bind(this));
        }
    }

    _handleActorUpdate(actor, diff, options, userId) {
        // Check if this update affects our display actor or base actor
        const isDisplayActorUpdate = this.actor && actor.id === this.actor.id;
        const isBaseActorUpdate = this.baseActor && actor.id === this.baseActor.id;
        
        if (!isDisplayActorUpdate && !isBaseActorUpdate) {
            return;
        }

        // TODO inspect-statblock: Debug logging for auto-opening bug investigation
        console.log(`${MODULE_ID} | [DEBUG] Actor update received:`, {
            actorId: actor.id,
            actorName: actor.name,
            diff: diff,
            isDisplayActorUpdate,
            isBaseActorUpdate,
            windowTokenId: this.tokenId,
            userId,
            currentlyRendered: this.rendered
        });

        let needsRender = false;

        // Check for changes in our module's visibility flags (only relevant for base actor)
        if (isBaseActorUpdate && foundry.utils.hasProperty(diff, `flags.${MODULE_ID}.hiddenElements`)) {
            const newFlags = actor.getFlag(MODULE_ID, 'hiddenElements');
            const flagsChanged = JSON.stringify(this.hiddenElements) !== JSON.stringify(newFlags);
            
            // TODO inspect-statblock: Debug logging for flag changes
            console.log(`${MODULE_ID} | [DEBUG] Visibility flags update:`, {
                actorName: actor.name,
                flagsChanged,
                oldFlags: this.hiddenElements,
                newFlags,
                windowTokenId: this.tokenId
            });
            
            if (flagsChanged) {
                console.log(`${MODULE_ID} | Visibility flags changed for base actor ${actor.name}.`);
                this.hiddenElements = newFlags || {};
                needsRender = true;
            }
        }

        // Check for other substantive changes if not already flagged for render (for display actor)
        if (isDisplayActorUpdate && !needsRender) {
            const diffKeys = Object.keys(diff);
            if (diffKeys.length > 0) {
                // Exclude updates that only change _stats (often related to actor vision/position, not displayed stats)
                const isOnlyStatsChange = diffKeys.length === 1 && diffKeys[0] === '_stats';
                
                // Exclude if the only change was to flags but not *our* specific hiddenElements flag 
                // (which would have set needsRender = true above if its content actually changed)
                const isOnlyFlagChangeNotOurs = diffKeys.length === 1 && diffKeys[0] === 'flags' && !needsRender;

                if (!isOnlyStatsChange && !isOnlyFlagChangeNotOurs) {
                    console.log(`${MODULE_ID} | Actor data changed for ${actor.name} (keys: ${diffKeys.join(', ')}).`);
                    needsRender = true;
                }
            }
        }

        if (needsRender) {
            // TODO inspect-statblock: CRITICAL BUG FIX for auto-opening statblocks
            // 
            // ROOT CAUSE: When user clicks hide/show all buttons, flags are updated on the base actor.
            // This triggers updateActor hook for ALL InspectStatblockApp instances sharing that actor.
            // Previously, render(true) was called on ALL instances, including ones that were never
            // actually rendered/opened, causing "phantom" statblock windows to appear.
            //
            // FIX: Only call render(true) on windows that are already rendered (this.rendered === true).
            // This prevents the module from auto-opening statblocks when new tokens are placed
            // after using the hide/show all buttons on existing statblocks.
            //
            // BUG REPRODUCTION STEPS (now fixed):
            // 1. Place Token A, open statblock, click Hide/Show All
            // 2. Place Token B (same creature) 
            // 3. Previously: Token B's statblock would auto-open
            // 4. Now: Token B's statblock only opens if manually requested
            if (!this.rendered) {
                console.log(`${MODULE_ID} | [DEBUG] Skipping render for non-rendered window (tokenId: ${this.tokenId})`);
                return;
            }
            
            console.log(`${MODULE_ID} | Re-rendering statblock for ${this.actor.name}.`);
            this.render(true);
        }
    }
    
    async _getAllToggleableKeys(systemHandler) {
        const keys = new Set();
        if (!systemHandler || !this.actor) return [];
        
        // Delegate to system handler for complete key generation
        if (systemHandler.getAllToggleableKeys) {
            try {
                const allKeys = await systemHandler.getAllToggleableKeys(this.actor, this.sidsData);
                return allKeys;
            } catch (error) {
                console.error(`${MODULE_ID} | Error calling systemHandler.getAllToggleableKeys:`, error);
                // Fall back to basic implementation below
            }
        }
        
        // Fallback: Basic implementation for handlers that don't implement getAllToggleableKeys yet
        const sectionDefs = systemHandler.getSystemSectionDefinitions();

        for (const def of Object.values(sectionDefs)) {
            if (def.type === 'single') {
                keys.add(def.keyPattern);
            } else if (def.type === 'group') {
                if (def.keyPattern === 'ability-') {
                    const abilityKeys = systemHandler.getDefaultAbilityKeys?.() || [];
                    abilityKeys.forEach(abKey => keys.add(`ability-${abKey}`));
                }
            }
        }

        if (this.actor.effects) {
            this.actor.effects.filter(e => !e.disabled).forEach(effect => keys.add(`effect-${effect.id}`));
        }

        // Let system handler provide feature keys rather than hardcoding
        if (systemHandler.getInSectionItemKeys) {
            try {
                const featureKeys = await systemHandler.getInSectionItemKeys('section-passive-features', this.actor);
                featureKeys.forEach(key => keys.add(key));
            } catch (error) {
                console.warn(`${MODULE_ID} | Error getting passive feature keys from system handler:`, error);
            }
        }
        
        // Add individual defense tag keys from SIDS data
        if (this.sidsData && this.sidsData.defenses && this.sidsData.defenses.items) {
            this.sidsData.defenses.items.forEach(category => {
                if (category.tags && category.tags.length > 0) {
                    category.tags.forEach(tag => keys.add(tag.elementKey));
                }
            });
        }
        
        return Array.from(keys);
    }

    async _onToggleVisibility(event) {
        event.preventDefault();
        event.stopPropagation();

        if (!game.user.isGM) return;

        const elementKey = event.currentTarget.dataset.elementKey;
        console.log(`${MODULE_ID} | _onToggleVisibility: Clicked elementKey:`, elementKey, "Target element:", event.currentTarget);

        if (!elementKey) {
            console.warn(`${MODULE_ID} | _onToggleVisibility: No elementKey found on target.`);
            return;
        }

        // const systemHandler = await this._getSystemHandler(); // Now available as this.systemHandler
        if (!this.systemHandler) {
            console.warn(`${MODULE_ID} | _onToggleVisibility: No systemHandler available on app instance.`);
            return;
        }
        if (!this.sidsData) { // SIDS data should be available from getData()
            console.warn(`${MODULE_ID} | _onToggleVisibility: No SIDS data available on app instance. Re-rendering to fetch.`);
            this.render(true);
            return;
        }

        const currentActorFlags = foundry.utils.deepClone(this.baseActor.getFlag(MODULE_ID, 'hiddenElements') || {});
        let updatedFlags = currentActorFlags;

        // Check if the clicked element is a defense category header
        const defenseCategoryKeyMatch = elementKey.match(/^def-(resistances|immunities|vulnerabilities|conditionimmunities)$/);

        if (defenseCategoryKeyMatch) {
            const categoryId = defenseCategoryKeyMatch[1]; // e.g., "resistances"
            let categoryObject = null;
            if (this.sidsData && this.sidsData.defenses && this.sidsData.defenses.items) {
                categoryObject = this.sidsData.defenses.items.find(cat => cat.id === elementKey);
            }

            if (categoryObject && categoryObject.tags && categoryObject.tags.length > 0) {
                const tagKeysToToggle = categoryObject.tags.map(tag => tag.elementKey);
                // Determine if we are showing or hiding all tags in this category
                // If any tag in the category is currently shown (flag is false or undefined), then hide all.
                // Otherwise (all tags are hidden - flag is true), show all.
                const shouldHideAllTags = tagKeysToToggle.some(tk => !currentActorFlags[tk]);
                
                tagKeysToToggle.forEach(tk => {
                    updatedFlags[tk] = shouldHideAllTags;
                });
                // Also toggle the state of the category header itself if you want its appearance to change
                // updatedFlags[elementKey] = shouldHideAllTags; // Optional: if category header has its own visual state separate from tags
            } else {
                // If it's a category header but has no tags (e.g. "None"), or SIDS data is missing, just toggle its own state if it exists as a flag.
                 if (Object.prototype.hasOwnProperty.call(updatedFlags, elementKey)) {
                    updatedFlags[elementKey] = !updatedFlags[elementKey];
                } else {
                    // If it's not in flags (e.g. a category with no items from a fresh actor), assume we intend to hide it.
                    updatedFlags[elementKey] = true; 
                }
            }
        } else if (elementKey.startsWith('def-tag-')) { // Individual defense tag
            updatedFlags[elementKey] = !updatedFlags[elementKey];
        } else { // Handle other existing toggleable elements (active effects, features, abilities etc.)
        const batchToggleSectionHeaderKeys = [
            "section-active-effects",
            "section-passive-features"
        ];

        if (batchToggleSectionHeaderKeys.includes(elementKey)) {
                const itemKeys = await this._getInSectionItemKeys(elementKey, this.systemHandler);
            if (!itemKeys || itemKeys.length === 0) {
                    // If it's a section header that could have items but currently doesn't (e.g. no active effects)
                    // and it has its own flag, toggle that. Otherwise, no action if no items.
                if (Object.prototype.hasOwnProperty.call(updatedFlags, elementKey)) {
                    updatedFlags[elementKey] = !updatedFlags[elementKey];
                } else {
                    console.log(`${MODULE_ID} | Section header ${elementKey} clicked, but no items found and header not a flag. No action.`);
                        return; // No return here, proceed to set flag below
                }
            } else {
                    // If any item in the section is currently shown, then hide all.
                    // Otherwise (all items are hidden), show all.
                const isAnyItemShown = itemKeys.some(key => !currentActorFlags[key]);
                if (isAnyItemShown) {
                        itemKeys.forEach(key => updatedFlags[key] = true); // Hide all
                        // Also hide the section header itself if it's a flag
                    if (Object.prototype.hasOwnProperty.call(updatedFlags, elementKey)) updatedFlags[elementKey] = true;
                } else {
                        itemKeys.forEach(key => updatedFlags[key] = false); // Show all
                        // Also show the section header itself if it's a flag
                    if (Object.prototype.hasOwnProperty.call(updatedFlags, elementKey)) updatedFlags[elementKey] = false;
                    }
                }
            } else { // Standard single element toggle
                updatedFlags[elementKey] = !updatedFlags[elementKey];
            }
        }
        
        await this.baseActor.setFlag(MODULE_ID, 'hiddenElements', updatedFlags);
    }

    async _getInSectionItemKeys(sectionHeaderKey, systemHandler) {
        if (!this.actor) return [];

        // Delegate to system handler if available
        if (systemHandler && systemHandler.getInSectionItemKeys) {
            try {
                return await systemHandler.getInSectionItemKeys(sectionHeaderKey, this.actor);
            } catch (error) {
                console.error(`${MODULE_ID} | Error calling systemHandler.getInSectionItemKeys:`, error);
                // Fall back to basic implementation below
            }
        }

        // Fallback: Basic implementation for handlers that don't implement getInSectionItemKeys yet
        const itemKeys = new Set();

        switch (sectionHeaderKey) {
            case "section-active-effects":
                if (this.actor.effects) {
                    this.actor.effects.filter(e => !e.disabled)
                        .forEach(effect => itemKeys.add(`effect-${effect.id}`));
                }
                break;
            case "section-passive-features":
                // Fallback can't provide system-specific logic without hardcoding
                console.warn(`${MODULE_ID} | _getInSectionItemKeys: No system handler method available for ${sectionHeaderKey}. System handler should implement getInSectionItemKeys.`);
                break;
            default:
                console.warn(`${MODULE_ID} | _getInSectionItemKeys called with unhandled sectionHeaderKey: ${sectionHeaderKey}`);
                return [];
        }
        return Array.from(itemKeys);
    }

    async _onShowAllElements() {
        if (!game.user.isGM) return;
        const systemHandler = await this._getSystemHandler();
        if (!systemHandler) return;

        // TODO inspect-statblock: Debug logging for flag updates
        console.log(`${MODULE_ID} | [DEBUG] Show All Elements called:`, {
            actorName: this.baseActor?.name,
            tokenId: this.tokenId,
            currentFlags: this.hiddenElements
        });

        const allKeys = await this._getAllToggleableKeys(systemHandler);
        const newHiddenElements = {};
        allKeys.forEach(key => newHiddenElements[key] = false); // false means visible
        
        await this.baseActor.setFlag(MODULE_ID, 'hiddenElements', newHiddenElements);
    }

    async _onHideAllElements() {
        if (!game.user.isGM) return;
        const systemHandler = await this._getSystemHandler();
        if (!systemHandler) return;

        // TODO inspect-statblock: Debug logging for flag updates
        console.log(`${MODULE_ID} | [DEBUG] Hide All Elements called:`, {
            actorName: this.baseActor?.name,
            tokenId: this.tokenId,
            currentFlags: this.hiddenElements
        });

        const allKeys = await this._getAllToggleableKeys(systemHandler);
        const newHiddenElements = {};
        allKeys.forEach(key => newHiddenElements[key] = true); // true means hidden
        
        await this.baseActor.setFlag(MODULE_ID, 'hiddenElements', newHiddenElements);
    }
    
    async close(options = {}) {
        Hooks.off('updateActor', this._handleActorUpdateBound);
        return super.close(options);
    }
}

// --- Helper functions for Keybindings & HUD --- //
export function _openInspectStatblockForTargetedToken() {
    const targets = Array.from(game.user.targets);
    if (!targets.length) {
        ui.notifications.warn("Inspect Statblock: Please target a token.");
        return;
    }
    const token = targets[0];
    if (!token.actor) {
        ui.notifications.warn("Inspect Statblock: The targeted token does not have an actor associated.");
        return;
    }

    // TODO inspect-statblock: Debug logging for manual statblock opening
    console.log(`${MODULE_ID} | [DEBUG] Manual statblock opening requested:`, {
        tokenId: token.id,
        tokenName: token.name,
        actorId: token.actor.id,
        actorName: token.actor.name,
        stackTrace: new Error().stack?.split('\n').slice(1, 3).join('\n') // Get caller for tracking source
    });

    const existingWindow = Object.values(ui.windows).find(w => 
        w instanceof InspectStatblockApp &&
        w.tokenId === token.id
    );

    if (existingWindow) {
        console.log(`${MODULE_ID} | [DEBUG] Closing existing window for token ${token.id}`);
        existingWindow.close();
        return;
    }
    
    console.log(`${MODULE_ID} | [DEBUG] Creating new statblock window for token ${token.id}`);
    new InspectStatblockApp(token.actor, token, { id: `${APP_ID}-${token.id}` }).render(true);
}

export function _closeAllInspectStatblockApps() {
    for (const app of Object.values(ui.windows)) {
        if (app instanceof InspectStatblockApp || app.options.id === APP_ID) {
            app.close();
        }
    }
}

// --- Handlebars Helpers --- //
function _registerHandlebarsHelpers() {
    Handlebars.registerHelper('test', function (string, regexString) {
        if (typeof string !== 'string' || typeof regexString !== 'string') return false;
        try {
            const regex = new RegExp(regexString.slice(1, -1), 'i');
            return regex.test(string);
        } catch (e) {
            console.error("Error in Handlebars 'test' helper regex:", e);
            return false;
        }
    });

    Handlebars.registerHelper('sum', function (a, b) {
        if (a === "??" || b === "??") return "??";
        return (Number(a) || 0) + (Number(b) || 0);
    });
}

// --- Hooks --- //
Hooks.on('renderTokenHUD', (app, html, data) => {
    const token = canvas.tokens.get(data._id);
    if (!token || !token.actor) return;

    const buttonId = `${HUD_BUTTON_ID}-${data._id}`;
    if (html.find(`#${buttonId}`).length > 0) return;

    const inspectButton = $(`
        <div class="control-icon ${HUD_BUTTON_ID}" id="${buttonId}" title="Inspect Statblock (I)">
            <i class="fas fa-search"></i>
        </div>
    `);

    html.find('.col.left').append(inspectButton);
    inspectButton.on('click', (event) => {
        event.preventDefault();
        _openInspectStatblockForTargetedToken(); 
    });
});

// --- Initialization --- //
Hooks.once('init', async function() {
    console.log(`${MODULE_ID} | Initializing module`);
    
    registerCoreSettings();
    
    _registerHandlebarsHelpers();
    // Moved template loading to 'ready' hook to allow system handlers to register first
    
    game.keybindings.register(MODULE_ID, 'openInspectStatblock', {
        name: 'Inspect Statblock: Open',
        hint: 'Opens the Inspect Statblock window for the currently targeted token.',
        editable: [{ key: 'KeyI' }],
        onDown: () => { _openInspectStatblockForTargetedToken(); return true; },
        restricted: false, precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });

    game.keybindings.register(MODULE_ID, 'closeAllInspectStatblocks', {
        name: 'Inspect Statblock: Close All',
        hint: 'Closes all open Inspect Statblock windows.',
        editable: [{ key: 'KeyI', modifiers: ['Alt'] }],
        onDown: () => { _closeAllInspectStatblockApps(); return true; },
        restricted: false, precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
    });
});

// Load system templates after all modules have initialized
Hooks.once('ready', async function() {
    await registerSystemTemplates();
});

// Expose for other modules or debugging if needed.
// e.g., globalThis.InspectStatblock = { InspectStatblockApp, _openInspectStatblockForTargetedToken, _closeAllInspectStatblockApps }; 