/**
 * @namespace SIDS
 * @description Truly generic Standardized Intermediate Data Structure for Inspect Statblock.
 * System handlers should extend this with their own system-specific SIDS files.
 */

/**
 * @typedef {Object} SIDS.StandardizedStatblockData
 * @property {string} [systemSpecificLayoutTemplate] - Path to system-specific layout template (e.g., "modules/my-module/systems/dnd5e/templates/layout.hbs").
 * @property {SIDS.HeaderInfo} headerInfo - Information for the top section.
 * @property {SIDS.PortraitInfo} portraitInfo - Token and actor image details.
 * @property {string} systemId - The system ID this data is for (e.g., 'dnd5e').
 * @property {SIDS.StatblockSection[]} genericSections - Array of generic or system-specific sections to render.
 * @property {Object} [systemSpecific] - System-specific data container (not interpreted by the core renderer; for use by system-specific partials only).
 */

/**
 * @typedef {Object} SIDS.HeaderInfo
 * @property {string} name - Creature's name.
 * @property {string} nameElementKey - e.g., "header-name"
 * @property {boolean} [nameIsHiddenGM] - True if the name is hidden and the user is a GM (for styling purposes).
 * @property {string} identifierText - e.g., "CR 5", "Level 10", "Threat 3", etc. (system-specific meaning)
 * @property {string} identifierElementKey - e.g., "header-identifier"
 * @property {boolean} [identifierIsHiddenGM] - True if identifier is hidden and user is GM.
 * @property {string} typeText - e.g., "humanoid (elf)", "Fighter 5 / Rogue 2", "Android", etc.
 * @property {string} typeElementKey - e.g., "header-type"
 * @property {boolean} [typeIsHiddenGM] - True if Type is hidden and user is GM.
 * @property {string} actorId - The actor's ID.
 */

/**
 * @typedef {Object} SIDS.PortraitInfo
 * @property {string} displayImgSrc - Path to the primary image to display (token, then actor, then default).
 * @property {string} [tokenImgSrc] - Path to token image (if available, for reference or specific use).
 * @property {string} [actorImgSrc] - Path to actor portrait image (if available, for reference or specific use).
 */

/**
 * @typedef {Object} SIDS.StatblockSection
 * @property {string} title - Section title (e.g., "Active Effects", "Defenses", "Attributes").
 * @property {SIDS.StatblockItem[]} items - Array of items in this section.
 * @property {boolean} isEmpty - If there are no items to display (for showing "None" or "??").
 * @property {string} [sectionClasses] - Additional CSS classes for the section wrapper.
 * @property {string} [systemSpecificPartialPath] - If set, the core renderer will use this partial to render this section.
 * @property {string} [displayType] - Optional hint for generic rendering (e.g., "tag", "keyValue", "attribute").
 */

/**
 * @typedef {Object} SIDS.StatblockItem
 * @property {string} id - Unique ID for the item (e.g., item.id, effect.id, sanitized trait name).
 * @property {string} name - Display name (e.g., "Fireball", "Pack Tactics", "Cold").
 * @property {string} [icon] - Image path or icon class.
 * @property {string} [descriptionHTML] - Enriched HTML for tooltips (preferred to be prepared by adapter).
 * @property {string} [subText] - e.g., duration for effects, modifier for saves, or value for key-value pairs.
 * @property {string} elementKey - Full key for visibility toggling (e.g., "feature-itemId", "effect-effectId", "res-cold").
 * @property {boolean} [isHiddenGM] - True if this specific item is hidden and user is GM.
 * @property {string} [uuid] - For items that can be looked up via `fromUuid` (passive features).
 * @property {object} [rawEffectDuration] - For active effects, to reconstruct duration text if needed: { rounds, turns }
 * @property {string} [nativeTooltipText] - Text for native browser `title` attribute (e.g. for effects).
 * @property {string} [displayType] - Optional hint for generic rendering (e.g., "tag", "keyValue", "attribute").
 * @property {string} [systemSpecificPartialPath] - If set, the core renderer will use this partial to render this item.
 */ 