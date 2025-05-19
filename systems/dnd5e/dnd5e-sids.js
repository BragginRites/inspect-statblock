/**
 * @namespace SIDS_DND5E
 * @description D&D 5e specific extensions and expected structures for SIDS.
 */

/**
 * @typedef {Object} SIDS_DND5E.DnD5eSystemSpecificData
 * @property {SIDS_DND5E.ACObject} [ac]
 * @property {SIDS_DND5E.HealthObject} [health]
 * @property {SIDS_DND5E.AbilityScore[]} [abilityScores]
 * @property {SIDS_DND5E.MovementObject} [movement]
 * @property {SIDS_DND5E.DefenseSection} [defenses]
 * @property {SIDS_DND5E.PassiveFeatureSection} [passiveFeatures]
 * // ...other D&D 5e specific sections as needed
 */

/**
 * @typedef {Object} SIDS_DND5E.ACObject
 * @property {string|number} value
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 */

/**
 * @typedef {Object} SIDS_DND5E.HealthObject
 * @property {string|number} current
 * @property {string|number} max
 * @property {string|number} temp
 * @property {string|number} tempMax
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 * @property {boolean} [increasedMax]
 * @property {boolean} [decreasedMax]
 */

/**
 * @typedef {Object} SIDS_DND5E.AbilityScore
 * @property {string} key
 * @property {string} label
 * @property {string|number} value
 * @property {string|number} mod
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 */

/**
 * @typedef {Object} SIDS_DND5E.MovementObject
 * @property {SIDS_DND5E.MovementSpeedItem[]} speeds
 * @property {boolean} isEmpty
 */

/**
 * @typedef {Object} SIDS_DND5E.MovementSpeedItem
 * @property {string} type
 * @property {string|number} value
 * @property {string} icon
 * @property {boolean} [isNumericValue]
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 */

/**
 * @typedef {Object} SIDS_DND5E.DefenseSection
 * @property {string} title
 * @property {SIDS_DND5E.DefenseCategory[]} items
 * @property {boolean} isEmpty
 * @property {string} [sectionClass]
 */

/**
 * @typedef {Object} SIDS_DND5E.DefenseCategory
 * @property {string} id
 * @property {string} name
 * @property {SIDS_DND5E.DefenseTag[]} tags
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 */

/**
 * @typedef {Object} SIDS_DND5E.DefenseTag
 * @property {string} id
 * @property {string} name
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 * @property {boolean} [isPlaceholder]
 */

/**
 * @typedef {Object} SIDS_DND5E.PassiveFeatureSection
 * @property {string} title
 * @property {SIDS_DND5E.PassiveFeature[]} items
 * @property {boolean} isEmpty
 * @property {string} [sectionClasses]
 */

/**
 * @typedef {Object} SIDS_DND5E.PassiveFeature
 * @property {string} id
 * @property {string} name
 * @property {string} [icon]
 * @property {string} [descriptionHTML]
 * @property {string} elementKey
 * @property {boolean} [isHiddenGM]
 * @property {string} [uuid]
 * @property {string} [nativeTooltipText]
 */ 