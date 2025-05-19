// Core application logic for Inspect Statblock module
import { renderStatblockFromSIDS } from './core-renderer.js';
import { Dnd5eHandler } from '../systems/dnd5e/dnd5e-handler.js'; // Adjusted path
import { registerCoreSettings } from './settings.js'; // Import settings registration

const MODULE_ID = 'inspect-statblock';
const APP_ID = 'inspect-statblock-window'; // For Application ID
const HUD_BUTTON_ID = 'inspect-statblock-hud-button';

const systemTemplateRegistry = {};

export const InspectStatblockCore = {
    MODULE_ID,
    registerSystemTemplatePaths: function(systemId, paths) {
        if (!Array.isArray(paths)) {
            console.error(`${MODULE_ID} | InspectStatblockCore.registerSystemTemplatePaths: paths must be an array for system ${systemId}.`);
            return;
        }
        systemTemplateRegistry[systemId] = (systemTemplateRegistry[systemId] || []).concat(paths);
        console.log(`${MODULE_ID} | InspectStatblockCore: Registered template paths for ${systemId}:`, paths);
    },
    // TODO: Add system handler registration here later
    // registerSystemHandler: function(systemId, handlerClass) { ... }
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
        this.hiddenElements = actor?.getFlag(MODULE_ID, 'hiddenElements') || {};
        this._handleActorUpdateBound = this._handleActorUpdate.bind(this);
    }

    static get defaultOptions() {
        return foundry.utils.mergeObject(super.defaultOptions, {
            id: APP_ID,
            classes: [MODULE_ID, "inspect-statblock-app"],
            template: `modules/${MODULE_ID}/templates/inspect-statblock-shell.hbs`,
            width: 500,
            height: "1000",
            resizable: true,
            title: "", // Minimal header
            dataset: {
                "userIsGm": game.user.isGM
            }
        });
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

            let currentFlags = this.actor.getFlag(MODULE_ID, 'hiddenElements');
            if (data.isGM && (!currentFlags || Object.keys(currentFlags).length === 0)) {
                console.log(`${MODULE_ID} | Initializing default visibility flags for GM for actor: ${this.actor.name}`);
                const sectionDefinitions = systemHandler.getSystemSectionDefinitions();
                const newFlags = {};
                const dnd5eAbilities = ['str', 'dex', 'con', 'int', 'wis', 'cha'];

                for (const defKey in sectionDefinitions) {
                    const definition = sectionDefinitions[defKey];
                    if (definition.defaultShowSettingKey) {
                        const showByDefault = game.settings.get(MODULE_ID, definition.defaultShowSettingKey);
                        const isHidden = !showByDefault;

                        if (definition.type === 'single') {
                            newFlags[definition.keyPattern] = isHidden;
                        } else if (definition.type === 'group') {
                            if (definition.keyPattern === 'ability-') { // DnD5e specific handling
                                dnd5eAbilities.forEach(abilKey => {
                                    newFlags[`ability-${abilKey}`] = isHidden;
                                });
                            }
                        }
                    }
                }
                await this.actor.setFlag(MODULE_ID, 'hiddenElements', newFlags);
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
        if (systemId === 'dnd5e') {
            return Dnd5eHandler;
        }
        return null;
    }

    activateListeners(html) {
        super.activateListeners(html);
        Hooks.on('updateActor', this._handleActorUpdateBound);

        if (game.user.isGM) {
            html.find('[data-element-key]').on('contextmenu', this._onToggleVisibility.bind(this));
        }
    }

    _handleActorUpdate(actor, diff, options, userId) {
        if (!this.actor || actor.id !== this.actor.id) {
            return;
        }

        let needsRender = false;

        // Check for changes in our module's visibility flags
        if (foundry.utils.hasProperty(diff, `flags.${MODULE_ID}.hiddenElements`)) {
            const newFlags = actor.getFlag(MODULE_ID, 'hiddenElements');
            if (JSON.stringify(this.hiddenElements) !== JSON.stringify(newFlags)) {
                console.log(`${MODULE_ID} | Visibility flags changed for ${actor.name}.`);
                this.hiddenElements = newFlags || {};
                needsRender = true;
            }
        }

        // Check for other substantive changes if not already flagged for render
        if (!needsRender) {
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
            console.log(`${MODULE_ID} | Re-rendering statblock for ${actor.name}.`);
            this.render(true);
        }
    }
    
    async _getAllToggleableKeys(systemHandler) {
        const keys = new Set();
        if (!systemHandler || !this.actor) return [];
        
        const sectionDefs = systemHandler.getSystemSectionDefinitions();
        const sidsData = this.sidsData; // Use cached SIDS data

        for (const def of Object.values(sectionDefs)) {
            if (def.type === 'single') {
                keys.add(def.keyPattern);
            } else if (def.type === 'group') {
                if (def.keyPattern === 'ability-') {
                    ['str', 'dex', 'con', 'int', 'wis', 'cha'].forEach(abKey => keys.add(`ability-${abKey}`));
                }
            }
        }

        if (this.actor.effects) {
            this.actor.effects.filter(e => !e.disabled).forEach(effect => keys.add(`effect-${effect.id}`));
        }

        if (this.actor.items && systemHandler.SYSTEM_ID === 'dnd5e') {
            this.actor.items.filter(item => item.type === "feat" && (item.system.activation?.type === "" || !item.system.activation?.type))
                .forEach(item => keys.add(`feature-${item.id}`));
        }
        
        // Add individual defense tag keys from SIDS data
        if (sidsData && sidsData.defenses && sidsData.defenses.items) {
            sidsData.defenses.items.forEach(category => {
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

        const currentActorFlags = foundry.utils.deepClone(this.actor.getFlag(MODULE_ID, 'hiddenElements') || {});
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
                const itemKeys = await this._getInSectionItemKeys(elementKey, this.systemHandler, this.actor);
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
        
        await this.actor.setFlag(MODULE_ID, 'hiddenElements', updatedFlags);
    }

    async _getInSectionItemKeys(sectionHeaderKey, systemHandler) {
        const itemKeys = new Set();
        if (!this.actor) return []; // this.actor should be available

        switch (sectionHeaderKey) {
            case "section-active-effects":
                if (this.actor.effects) {
                    this.actor.effects.filter(e => !e.disabled)
                        .forEach(effect => itemKeys.add(`effect-${effect.id}`));
                }
                break;
            case "section-passive-features":
                // Assuming DnD5e specific logic for now, this might need to be abstracted further via systemHandler
                if (this.actor.items && systemHandler && systemHandler.SYSTEM_ID === 'dnd5e') {
                    this.actor.items.filter(item => item.type === "feat" && 
                                                (item.system.activation?.type === "" || !item.system.activation?.type))
                        .forEach(item => itemKeys.add(`feature-${item.id}`));
                }
                // TODO: For other systems, systemHandler might need a method like `getPassiveFeatureItemKeys(actor)`
                break;
            default:
                console.warn(`${MODULE_ID} | _getInSectionItemKeys called with unhandled sectionHeaderKey: ${sectionHeaderKey}`);
                return []; // Return empty for unhandled keys
        }
        return Array.from(itemKeys);
    }

    async _onShowAllElements() {
        if (!game.user.isGM) return;
        const systemHandler = await this._getSystemHandler();
        if (!systemHandler) return;

        const allKeys = await this._getAllToggleableKeys(systemHandler);
        const newHiddenElements = {};
        allKeys.forEach(key => newHiddenElements[key] = false); // false means visible
        
        await this.actor.setFlag(MODULE_ID, 'hiddenElements', newHiddenElements);
    }

    async _onHideAllElements() {
        if (!game.user.isGM) return;
        const systemHandler = await this._getSystemHandler();
        if (!systemHandler) return;

        const allKeys = await this._getAllToggleableKeys(systemHandler);
        const newHiddenElements = {};
        allKeys.forEach(key => newHiddenElements[key] = true); // true means hidden
        
        await this.actor.setFlag(MODULE_ID, 'hiddenElements', newHiddenElements);
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

    const existingWindow = Object.values(ui.windows).find(w => 
        w instanceof InspectStatblockApp &&
        w.tokenId === token.id
    );

    if (existingWindow) {
        existingWindow.close();
        return;
    }
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

    const systemId = game.system.id;
    let systemHandler;
    if (systemId === 'dnd5e') {
        systemHandler = Dnd5eHandler;
    }

    if (systemHandler && typeof systemHandler.registerSystemSpecificSettings === 'function') {
        systemHandler.registerSystemSpecificSettings();
    }
    
    _registerHandlebarsHelpers();
    await registerSystemTemplates();
    
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

// Expose for other modules or debugging if needed.
// e.g., globalThis.InspectStatblock = { InspectStatblockApp, _openInspectStatblockForTargetedToken, _closeAllInspectStatblockApps }; 