/**
 * @namespace InspectStatblockAPI
 * @description API exposed by the core inspect-statblock module for managing
 * and interacting with system-specific data adapters.
 */

/**
 * @interface SystemHandler
 * @description Defines the methods that a system-specific handler must implement
 *              to provide data and functionality to the core Inspect Statblock module.
 *              System handlers are internal components, typically located in `systems/{systemId}/`,
 *              and are dynamically loaded by the core module based on the active `game.system.id`.
 */

/**
 * A unique ID for the game system this adapter supports (e.g., "dnd5e", "pf2e").
 * This should match the `game.system.id`.
 * @name SYSTEM_ID
 * @type {string}
 * @memberof InspectStatblockAPI.SystemAdapter#
 */

/**
 * Checks if this adapter is suitable for the given actor.
 * Typically checks `actor.parent?.system?.id` or similar.
 * @function canHandleActor
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {Actor} actor - The actor document.
 * @returns {boolean} True if this adapter can handle the actor.
 */

/**
 * Transforms a system-specific actor object into the StandardizedStatblockData format.
 * @function getStandardizedActorData
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {Actor} actor - The actor document.
 * @param {TokenDocument | undefined} [token] - The linked token document, if any.
 * @param {object} hiddenElements - The current hiddenElements flag state for this actor.
 * @param {boolean} isGM - Whether the current user is a Game Master.
 * @returns {Promise<SIDS.StandardizedStatblockData>} A promise that resolves to the SIDS object.
 */

/**
 * Provides the definitions for toggleable sections specific to this system,
 * used for initializing flags and "Show/Hide All" functionality.
 * This corresponds to the old `SECTIONS_FOR_DEFAULT_VISIBILITY` concept.
 * @function getSystemSectionDefinitions
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @returns {Record<string, InspectStatblockAPI.SystemSectionDefinition>}
 *   An object where keys are section identifiers (e.g., 'abilities', 'features')
 *   and values are their definitions.
 */

/**
 * Gets all possible toggleable element keys for the given actor and SIDS data.
 * Used by core for "Show All" and "Hide All" functionality.
 * @function getAllToggleableKeys
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {Actor} actor - The actor document.
 * @param {SIDS.StandardizedStatblockData} [sidsData] - The SIDS data for the actor (optional optimization).
 * @returns {Promise<Array<string>>} Array of all possible element keys that can be toggled.
 */

/**
 * Gets the child element keys of a group element (a section header such as
 * "section-active-effects", or a defense category such as "def-resistances").
 * Used by core when the GM right-clicks a group: all children are shown or hidden together.
 * Return an empty array for keys that are not groups.
 * @function getInSectionItemKeys
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {string} sectionHeaderKey - The group element key.
 * @param {Actor} actor - The actor document.
 * @param {SIDS.StandardizedStatblockData} [sidsData] - The last rendered SIDS data.
 * @returns {Promise<Array<string>>} Child element keys.
 */

/**
 * Effective hidden state of an element for players, including any inheritance
 * (e.g. an unflagged item inheriting its section) and default settings.
 * Optional; without it core treats only an explicit `true` flag as hidden.
 * @function isElementHidden
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {string} elementKey
 * @param {Record<string, boolean>} hiddenElements - The stored flags.
 * @returns {boolean}
 */

/**
 * Default hidden state for every element of an actor that has no flag yet.
 * Optional; used to snapshot defaults when a token is placed and when new
 * elements (items, effects, defenses) appear. Without it no defaults are written.
 * @function getDefaultHiddenElements
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {Actor} actor
 * @param {Record<string, boolean>} current - Flags already stored.
 * @returns {Record<string, boolean>} Element key → hidden.
 */

/**
 * Option groups for the Default Visibility form. Optional; without it the form
 * shows the built-in D&D 5e list on dnd5e and nothing on other systems.
 * Each setting key is stored in the core 'defaultVisibilitySettings' object
 * (true = visible to players by default).
 * @function getDefaultSettingGroups
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @returns {Array<{id: string, icon: string, label: string, hint: string,
 *   settings: Array<{key: string, label: string}>}>} Labels and hints are localization keys.
 */

/**
 * Gets the default ability keys for this system (e.g., ['str', 'dex', 'con', 'int', 'wis', 'cha'] for D&D 5e).
 * Used by core for initializing ability-related visibility flags.
 * @function getDefaultAbilityKeys
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @returns {Array<string>} Array of ability key strings.
 */

/**
 * @typedef {Object} SystemSectionDefinition
 * @memberof InspectStatblockAPI
 * @property {string} name - User-friendly name for the section (e.g., "Ability Scores").
 *                           This can be a localization key.
 * @property {'single'|'group'} type - Defines if the section refers to a single toggleable element
 *                                   or a group of dynamically generated elements.
 *                                   'single': `keyPattern` is the direct elementKey.
 *                                   'group': `keyPattern` is a prefix; individual items are derived
 *                                            (e.g., from `actorPath` or SIDS).
 * @property {string} keyPattern - Base key or key prefix for visibility toggling
 *                                (e.g., "section-ac", "ability-").
 * @property {string} [actorPath] - For 'group' type, an optional path on the actor document
 *                                  to retrieve items from (e.g., "system.traits.dr.value").
 *                                  Used by the core to help identify all possible elements for a "Show All".
 * @property {string} [defaultShowSettingKey] - The module setting key (scoped to the adapter module)
 *                                             that determines the default visibility for this section.
 *                                             e.g., "myadapter-defaultShowSection-abilities".
 */

/**
 * (Optional) Handles specific HTML enrichment, event listener setup, or other
 * DOM manipulations required for system-specific elements after the core
 * inspect-statblock module has rendered the statblock from SIDS.
 * @function postRenderSetup
 * @memberof InspectStatblockAPI.SystemAdapter#
 * @param {HTMLElement} statblockElement - The rendered statblock DOM element.
 * @param {SIDS.StandardizedStatblockData} standardizedData - The SIDS object used for rendering.
 * @param {Actor} actor - The actor document.
 * @param {object} hiddenElements - Current hidden elements flags for this actor.
 * @param {boolean} isGM - If the current user is a GM.
 * @returns {void}
 */

// Conceptual: How the core `inspect-statblock` module will expose its API
// This is not part of the adapter interface itself, but for context.
/*
class InspectStatblockAPI {
  /**
   * Registers a system adapter with the core inspect-statblock module.
   * @param {string} systemId - The game system ID (e.g., "dnd5e").
   * @param {InspectStatblockAPI.SystemAdapter} adapter - An instance of the system adapter.
   * @static
   * /
  static registerSystemAdapter(systemId, adapter) {
    // ... implementation in inspect-statblock ...
  }

  /**
   * Retrieves the appropriate system adapter for a given actor.
   * @param {Actor} actor - The actor document.
   * @returns {InspectStatblockAPI.SystemAdapter | undefined} The adapter, or undefined if none found.
   * @static
   * /
  static getAdapterForActor(actor) {
    // ... implementation in inspect-statblock ...
  }
}
*/ 