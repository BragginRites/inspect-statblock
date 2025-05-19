/**
 * @file D&D 5e System Handler
 * This file is responsible for transforming D&D 5e specific actor data
 * into the Standardized Intermediate Data Structure (SIDS) for the
 * Inspect Statblock module, and for providing other D&D 5e-specific
 * configurations and functionalities as per the SystemHandler interface.
 */

import { registerDnd5eSettings } from './dnd5e-settings.js';

// Helper functions that might be needed from main.js (e.g., enrichHTMLClean) will eventually be
// either passed in, imported if they become generic utilities, or their equivalents
// will be part of this provider if specific to D&D 5e data handling.


Hooks.once('init', () => {
  if (game.system.id === 'dnd5e') {
      const dnd5eTemplatePaths = [
          'systems/dnd5e/templates/partials/header.hbs',
          'systems/dnd5e/templates/partials/portrait.hbs',
          'systems/dnd5e/templates/partials/ac.hbs',
          'systems/dnd5e/templates/partials/movement.hbs',
          'systems/dnd5e/templates/partials/health.hbs',
          'systems/dnd5e/templates/partials/ability_scores.hbs',
          'systems/dnd5e/templates/partials/defenses.hbs',
          'systems/dnd5e/templates/partials/active-effects.hbs',
          'systems/dnd5e/templates/partials/passive-features.hbs'
      ];

      if (globalThis.InspectStatblockCore && globalThis.InspectStatblockCore.registerSystemTemplatePaths) {
          globalThis.InspectStatblockCore.registerSystemTemplatePaths('dnd5e', dnd5eTemplatePaths);
      } else {
          console.warn(`InspectStatblock | D&D 5e handler attempting to register templates before Core API is ready. Retrying on 'ready'.`);
          Hooks.once('ready', () => {
               if (globalThis.InspectStatblockCore && globalThis.InspectStatblockCore.registerSystemTemplatePaths) {
                  globalThis.InspectStatblockCore.registerSystemTemplatePaths('dnd5e', dnd5eTemplatePaths);
               } else {
                  console.error(`InspectStatblock | D&D 5e handler could not register templates: InspectStatblockCore.registerSystemTemplatePaths not found even on ready.`);
               }
          });
      }
  }
});

/**
 * Helper function to determine if an element should be hidden based on flags or defaults.
 * @param {string} elementKey - The key of the element to check.
 * @param {object} hiddenElements - The current hiddenElements flag state.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {boolean} True if the element should be hidden.
 * @private
 */
function _shouldHideElement(elementKey, hiddenElements, isGM) {
  // GMs always see everything unless explicitly hidden by flag
  if (isGM) return hiddenElements[elementKey] || false;

  // For players:
  // If a flag exists, use it
  if (elementKey in hiddenElements) {
    return hiddenElements[elementKey];
  }

  // No flag exists, check the default setting
  const sectionDefs = getSystemSectionDefinitions();
  // Find the section definition that matches this elementKey
  const matchingDef = Object.values(sectionDefs).find(def => {
    if (def.type === 'single') {
      return def.keyPattern === elementKey;
    } else if (def.type === 'group') {
      return elementKey.startsWith(def.keyPattern);
    }
    return false;
  });

  if (matchingDef?.defaultShowSettingKey) {
    const showByDefault = game.settings.get('inspect-statblock', matchingDef.defaultShowSettingKey);
    return !showByDefault; // If showByDefault is false, we should hide
  }

  return false; // If no matching definition or setting found, show by default
}

/**
 * Fetches and transforms D&D 5e actor data into the StandardizedStatblockData format.
 * Implements the getStandardizedActorData method of the SystemHandler interface.
 *
 * @param {Actor} actor - The D&D 5e actor document.
 * @param {TokenDocument | undefined} token - The linked token document, if any.
 * @param {object} hiddenElements - The current hiddenElements flag state for this actor, 
 *                                  mapping elementKeys to boolean (true if hidden).
 * @param {boolean} isGM - Whether the current user is a Game Master.
 * @returns {Promise<SIDS.StandardizedStatblockData>} A promise that resolves to the
 *                                                    standardized statblock data object.
 */
async function getStandardizedActorData(actor, token, hiddenElements, isGM) {
  // Ensure actor and actor.system are available, crucial for D&D5e data.
  if (!actor || !actor.system) {
    console.warn("Inspect Statblock | Dnd5eHandler.getStandardizedActorData: Actor or actor.system is undefined. Cannot process D&D 5e data.");
    // Return a minimally viable SIDS structure to prevent downstream errors,
    // or throw an error, depending on desired strictness.
    return {
      headerInfo: { name: "Error", nameElementKey: "header-name", actorId: actor?.id || "unknown", levelOrCrText: "??", levelOrCrElementKey: "header-crlevel", sizeText: "??", sizeElementKey: "header-size", typeText: "??", typeElementKey: "header-type" },
      portraitInfo: {},
      ac: { value: "??", elementKey: "section-ac" },
      movement: { speeds: [], elementKey: "section-movement", isEmpty: true },
      health: { current: "??", max: "??", elementKey: "section-hp" },
      abilityScores: [],
      activeEffects: { title: "Active Effects", items: [], isEmpty: true },
      defenses: { title: "Defenses", items: [], isEmpty: true, elementKey: "section-defenses" },
      passiveFeatures: { title: "Passive Features", items: [], isEmpty: true },
    };
  }

  const { details, traits } = actor.system;

  // Define element keys for header section
  const nameElementKey = "header-name";
  const levelOrCrElementKey = "header-crlevel";
  const sizeElementKey = "header-size";
  const typeElementKey = "header-type";

  // Actor Name / Token Name
  let displayedName = actor.name; // Default to actor's name
  if (token && token.name && token.name !== actor.name) {
    displayedName = token.name; // Use token's name if it exists and is different
  }

  const nameIsHidden = _shouldHideElement(nameElementKey, hiddenElements, isGM);
  if (!isGM && nameIsHidden) {
    displayedName = "??";
  }

  // Level/CR, Size, and Type determination
  let levelOrCrText;
  let sizeText;
  let typeText;

  const levelOrCrIsHidden = _shouldHideElement(levelOrCrElementKey, hiddenElements, isGM);
  const sizeIsHidden = _shouldHideElement(sizeElementKey, hiddenElements, isGM);
  const typeIsHidden = _shouldHideElement(typeElementKey, hiddenElements, isGM);

  // Get creature size
  sizeText = traits?.size ? _formatSize(traits.size) : "";

  if (actor.type === "character") {
    const { classString, totalLevel } = _getCharacterClassStringAndLevel(actor);
    levelOrCrText = game.i18n.format("DND5E.Level", { level: totalLevel }); // "Level X"
    typeText = classString; // "Fighter 5 / Rogue 2"
    // Size for characters is usually determined by race, but often not explicitly listed in the same way as NPCs.
    // If sizeText is empty here, it means the character's race didn't provide a standard size trait.
    // It could be left empty or a default like "Medium" could be assumed if not otherwise specified.
    // For now, it will use whatever _formatSize found (or empty string).
  } else { // NPC
    const cr = actor.system.details?.cr;
    let crString;
    if (CONFIG.DND5E && CONFIG.DND5E.CR && cr !== undefined && cr !== null && cr in CONFIG.DND5E.CR) {
        crString = CONFIG.DND5E.CR[cr];
    } else {
        crString = String(_formatCr(cr)); // Fallback to our custom formatter
    }
    
    const crAbbrKey = "DND5E.ChallengeRatingAbbr";
    let crLabel = game.i18n.localize(crAbbrKey);
    if (crLabel === crAbbrKey) { // If localization fails and returns the key itself
        crLabel = "CR"; // Fallback to hardcoded "CR"
    }
    levelOrCrText  = `${crLabel} ${crString}`;
    
    // Type for NPCs (no longer includes size here)
    const creatureType = details?.type?.value ? (details.type.value.charAt(0).toUpperCase() + details.type.value.slice(1)) : "";
    let typeDetails = creatureType;
    if (details?.type?.subtype) {
        typeDetails += ` (${details.type.subtype})`;
    } else if (details?.type?.custom) {
         typeDetails += ` (${details.type.custom})`;
    }
    typeText = typeDetails.trim();
  }

  if (!isGM && levelOrCrIsHidden) {
    levelOrCrText = "??";
  }
  if (!isGM && sizeIsHidden) {
    sizeText = "??";
  }
  if (!isGM && typeIsHidden) {
    typeText = "??";
  }

  // Initialize sidsData.defenses
  const defensesSection = {
    title: "Defenses", // This title will be static in the template
    items: [], // These will be the categories: Resistances, Immunities, etc.
    // elementKey: "section-defenses", // No longer toggleable as a whole block
    isHiddenGM: false, // Not relevant for the section wrapper itself anymore
    isEmpty: true,
    sectionClass: "defenses-grid-layout"
  };

  const defenseCategories = [
    { dataPath: traits?.dr, name: game.i18n.localize("DND5E.DamRes"), keyPrefix: "res", id: "resistances" },
    { dataPath: traits?.di, name: game.i18n.localize("DND5E.DamImm"), keyPrefix: "imm", id: "immunities" },
    { dataPath: traits?.dv, name: game.i18n.localize("DND5E.DamVuln"), keyPrefix: "vuln", id: "vulnerabilities" },
    { dataPath: traits?.ci, name: game.i18n.localize("DND5E.ConImm"), keyPrefix: "condimm", id: "conditionimmunities" }
  ];

  for (const category of defenseCategories) {
    // Check if the specific defense group (e.g. resistances) should be hidden based on a flag for it.
    // This assumes flags like "hiddenElements['def-resistances']" might exist.
    const categoryElementKey = `def-${category.id}`; // e.g., def-resistances
    const isCategoryHiddenByFlag = _shouldHideElement(categoryElementKey, hiddenElements, isGM);

    const defenseCategoryItem = _getSingleDefenseCategoryItem(
      category.dataPath?.value, // Pass the array of strings (e.g., ['fire', 'cold'])
      category.name,            // e.g., "Resistances"
      categoryElementKey,       // e.g., "def-resistances"
      isCategoryHiddenByFlag,   // Pass the specific hidden state for THIS category
      isGM,
      hiddenElements,           // Pass the hiddenElements object down
      category.dataPath?.custom // Pass custom string if available
    );
    
    // The subText from _getSingleDefenseCategoryItem will be "??" if !isGM and isCategoryHiddenByFlag is true.
    // Or it will be "None" if GM and no items.
    // Or it will be the list of items.
    defensesSection.items.push(defenseCategoryItem);
  }
  
  // Determine if the defenses section is effectively empty for display purposes
  // It's empty if all its category items have subText that indicates emptiness for the current user (None for GM, ?? for Player)
  let allCategoriesEffectivelyEmpty = true;
  if (defensesSection.items.length > 0) {
      allCategoriesEffectivelyEmpty = defensesSection.items.every(item => {
          // A category is effectively empty if its name is "??" (player view, category hidden)
          // or if it has no tags (GM view, or player view and category visible but no actual defenses).
          return item.name === "??" || item.tags.length === 0;
      });
  }
  defensesSection.isEmpty = defensesSection.items.length === 0 || allCategoriesEffectivelyEmpty;

  // Placeholder for the SIDS object we will build
  const sidsData = {
    headerInfo: {
      name: displayedName,
      nameElementKey: nameElementKey,
      nameIsHiddenGM: isGM && nameIsHidden,
      levelOrCrText: levelOrCrText,
      levelOrCrElementKey: levelOrCrElementKey,
      levelOrCrIsHiddenGM: isGM && levelOrCrIsHidden,
      sizeText: sizeText,
      sizeElementKey: sizeElementKey,
      sizeIsHiddenGM: isGM && sizeIsHidden,
      typeText: typeText,
      typeElementKey: typeElementKey,
      typeIsHiddenGM: isGM && typeIsHidden,
      actorId: actor.id,
    },
    portraitInfo: {
      displayImgSrc: token?.document?.texture?.src || token?.texture?.src || actor.prototypeToken?.texture?.src || actor.img || "icons/svg/mystery-man.svg",
      tokenImgSrc: token?.document?.texture?.src || token?.texture?.src || actor.prototypeToken?.texture?.src,
      actorImgSrc: actor.img,
    },
    ac: {
      value: (!isGM && _shouldHideElement("section-ac", hiddenElements, isGM)) ? "??" : (actor.system.attributes?.ac?.value ?? "??"),
      elementKey: "section-ac",
      isHiddenGM: isGM && _shouldHideElement("section-ac", hiddenElements, isGM),
    },
    movement: _getMovementData(actor.system.attributes, hiddenElements, isGM),
    health: _getHealthData(actor.system.attributes, _shouldHideElement("section-hp", hiddenElements, isGM), isGM),
    abilityScores: _getAbilityScoresData(actor.system.abilities, hiddenElements, isGM),
    activeEffects: _getActiveEffectsData(actor, hiddenElements, isGM),
    defenses: defensesSection, // Assign the newly constructed defenses section
    passiveFeatures: _getPassiveFeaturesData(actor, hiddenElements, isGM),
  };

  console.log("Inspect Statblock | [Dnd5eHandler.getStandardizedActorData] Processed actor:", actor.name, "SIDS Data (partial):", sidsData);
  return sidsData;
}

// Potential helper functions specific to D&D 5e data processing can go here.

/**
 * Formats Challenge Rating (CR) value.
 * @param {number|string} cr - The raw CR value.
 * @returns {string} Formatted CR string (e.g., "1/2", "5").
 * @private
 */
function _formatCr(cr) {
  if (cr === undefined || cr === null) return "?";
  if (cr === 0.125) return "1/8";
  if (cr === 0.25) return "1/4";
  if (cr === 0.5) return "1/2";
  return String(cr);
}

/**
 * Formats creature size.
 * @param {string} sizeKey - The size key (e.g., "med", "lg").
 * @returns {string} Formatted size string (e.g., "Medium", "Large").
 * @private
 */
function _formatSize(sizeKey) {
    if (!sizeKey) return "";
    const sizeMappings = {
        tiny: game.i18n.localize("DND5E.SizeTiny"),
        sm: game.i18n.localize("DND5E.SizeSmall"),
        med: game.i18n.localize("DND5E.SizeMedium"),
        lg: game.i18n.localize("DND5E.SizeLarge"),
        huge: game.i18n.localize("DND5E.SizeHuge"),
        grg: game.i18n.localize("DND5E.SizeGargantuan"),
    };
    return sizeMappings[sizeKey.toLowerCase()] || (sizeKey.charAt(0).toUpperCase() + sizeKey.slice(1));
}

/**
 * Gets the combined class string and total level for a character actor.
 * E.g., { classString: "Fighter 5 / Rogue 2", totalLevel: 7 }
 * @param {Actor} characterActor - The character actor document.
 * @returns {{classString: string, totalLevel: number}}
 * @private
 */
function _getCharacterClassStringAndLevel(characterActor) {
  const classes = characterActor.items.filter(i => i.type === "class");
  let classString = "";
  let totalLevel = 0;

  if (classes.length) {
    // Sort by level (descending) then by name for consistent output
    const sortedClasses = classes.sort((a, b) => {
        const levelA = a.system.levels || 0;
        const levelB = b.system.levels || 0;
        if (levelB !== levelA) {
            return levelB - levelA;
        }
        return a.name.localeCompare(b.name);
    });
    classString = sortedClasses.map(c => `${c.name} ${c.system.levels || 0}`).join(' / ');
    totalLevel = sortedClasses.reduce((sum, c) => sum + (c.system.levels || 0), 0);
  } else { // Fallback if no class items found (e.g. manually created character)
    totalLevel = characterActor.system.details?.level ?? characterActor.system.attributes?.level ?? 0;
    classString = game.i18n.localize("DND5E.Character"); // Or some default "Character" string
    if (totalLevel === 0 && !classString) classString = game.i18n.localize("TYPES.Actor.character");
  }
  if (totalLevel === 0 && classes.length === 0) totalLevel = characterActor.system.details?.level || 0;

  return { classString: classString || game.i18n.localize("Unknown"), totalLevel };
}

/**
 * Processes actor movement data for SIDS.
 * @param {object} attributes - The actor.system.attributes object.
 * @param {object} hiddenElements - The hiddenElements flag object.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {SIDS.MovementInfo}
 * @private
 */
function _getMovementData(attributes, hiddenElements, isGM) {
  const movementInfo = {
    speeds: [],
    isEmpty: true,
  };

  const actorMovementData = attributes?.movement || {};

  const STANDARD_MOVEMENT_TYPES = [
    { key: 'walk', label: game.i18n.localize("DND5E.MovementWalk") || "Walk", icon: "fas fa-walking" },
    { key: 'fly', label: game.i18n.localize("DND5E.MovementFly") || "Fly", icon: "fas fa-dove" },
    { key: 'swim', label: game.i18n.localize("DND5E.MovementSwim") || "Swim", icon: "fas fa-swimmer" },
    { key: 'climb', label: game.i18n.localize("DND5E.MovementClimb") || "Climb", icon: "fas fa-grip-lines" },
    { key: 'burrow', label: game.i18n.localize("DND5E.MovementBurrow") || "Burrow", icon: "fas fa-mountain" }
  ];

  let hasAnyPossessedSpeedForGM = false;

  for (const stdType of STANDARD_MOVEMENT_TYPES) {
    const elementKey = `movement-${stdType.key}`;
    const isSpeedHiddenByFlag = _shouldHideElement(elementKey, hiddenElements, isGM);

    let rawSpeedData = actorMovementData[stdType.key];
    let possessedSpeedValue = 0;
    let isNumeric = false;

    if (typeof rawSpeedData === 'number') {
      possessedSpeedValue = rawSpeedData;
    } else if (typeof rawSpeedData === 'object' && rawSpeedData !== null && typeof rawSpeedData.value === 'number') {
      possessedSpeedValue = rawSpeedData.value;
    }

    let displayedValue;

    if (isGM) {
      displayedValue = String(possessedSpeedValue > 0 ? possessedSpeedValue : "0");
      isNumeric = possessedSpeedValue > 0;
      if (possessedSpeedValue > 0) {
        hasAnyPossessedSpeedForGM = true;
      }
    } else { // Player view
      if (possessedSpeedValue > 0) { // Creature possesses this speed type
        if (isSpeedHiddenByFlag) { // GM hid this specific speed
          displayedValue = "??";
          isNumeric = false;
        } else { // Speed is visible, show actual speed
          displayedValue = String(possessedSpeedValue);
          isNumeric = true;
        }
      } else { // Creature does not possess this speed type
        displayedValue = "??";
        isNumeric = false;
      }
    }

    movementInfo.speeds.push({
      type: stdType.label,
      value: displayedValue,
      icon: stdType.icon,
      isNumericValue: isNumeric,
      elementKey: elementKey,
      isHiddenGM: isGM && isSpeedHiddenByFlag,
    });
  }

  if (isGM) {
    movementInfo.isEmpty = !hasAnyPossessedSpeedForGM;
  } else {
    movementInfo.isEmpty = false; 
  }
  
  return movementInfo;
}

/**
 * Processes actor health data for SIDS.
 * @param {object} attributes - The actor.system.attributes object.
 * @param {boolean} isSectionHidden - Whether the whole health section is hidden for the player.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {SIDS.HealthInfo}
 * @private
 */
function _getHealthData(attributes, isSectionHidden, isGM) {
  const hpData = attributes?.hp;
  const elementKey = "section-hp";
  const tempMax = parseInt(hpData?.tempmax, 10) || 0;

  if (!isGM && isSectionHidden) {
    return {
      current: "??",
      max: "??",
      temp: hpData?.temp ? "??" : "0", 
      tempMax: hpData?.tempmax ? "??" : "0", // Though likely not shown if main HP is ??
      elementKey: elementKey,
      isHiddenGM: false, // Player view, so this flag isn't relevant for element-hidden-to-players class here
      increasedMax: false,
      decreasedMax: false,
    };
  }

  return {
    current: hpData?.value ?? "0",
    max: hpData?.max ?? "0",
    temp: hpData?.temp ?? "0",
    tempMax: String(tempMax), // Ensure it's a string for template
    elementKey: elementKey,
    isHiddenGM: isGM && isSectionHidden,
    increasedMax: tempMax > 0,
    decreasedMax: tempMax < 0,
  };
}

/**
 * Processes actor ability score data for SIDS.
 * @param {object} abilities - The actor.system.abilities object.
 * @param {object} hiddenElements - The hiddenElements flag object.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {SIDS.AbilityScore[]}
 * @private
 */
function _getAbilityScoresData(abilities, hiddenElements, isGM) {
  const scores = [];
  if (!abilities) return scores;

  for (const [key, ability] of Object.entries(abilities)) {
    const elementKey = `ability-${key}`;
    const isHidden = _shouldHideElement(elementKey, hiddenElements, isGM);
    scores.push({
      key: key,
      label: ability.label?.toUpperCase() || key.toUpperCase(), // Ensure uppercase, fallback to key if label is missing
      value: (!isGM && isHidden) ? "??" : ability.value,
      mod: (!isGM && isHidden) ? "??" : (ability.mod >= 0 ? `+${ability.mod}` : ability.mod),
      elementKey: elementKey,
      isHiddenGM: isGM && isHidden,
    });
  }
  return scores;
}

/**
 * Processes actor active effects data for SIDS.
 * @param {Actor} actor - The D&D 5e actor document.
 * @param {object} hiddenElements - The hiddenElements flag object.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {SIDS.StatblockSection}
 * @private
 */
function _getActiveEffectsData(actor, hiddenElements, isGM) {
  const sectionElementKey = "section-active-effects";
  const effectsSection = {
    title: "Active Effects",
    items: [],
    isEmpty: true,
    sectionClasses: "active-effects-section",
    elementKey: sectionElementKey,
    isHiddenGM: isGM && _shouldHideElement(sectionElementKey, hiddenElements, isGM)
  };

  const effectsToRender = (actor.effects || []).filter(e => !e.disabled);

  if (effectsToRender.length === 0) {
    return effectsSection; // isEmpty remains true
  }

  effectsSection.isEmpty = false;

  for (const effect of effectsToRender) {
    const elementKey = `effect-${effect.id}`;
    const isEffectHiddenForPlayer = !isGM && _shouldHideElement(elementKey, hiddenElements, isGM);
    const effectIsHiddenByGM = isGM && hiddenElements[elementKey];

    // DEBUG LOG:
    if (isGM) {
        console.log(`Inspect Statblock | DEBUG: Effect: ${effect.name} (key: ${elementKey}), hiddenElements[elementKey]: ${hiddenElements[elementKey]}, calculated isHiddenGM: ${effectIsHiddenByGM}`);
    }

    let subText = "";
    const { rounds, turns } = effect.duration;
    if (rounds || turns) {
      const parts = [];
      if (rounds) parts.push(`${rounds} ${game.i18n.format(rounds === 1 ? "DND5E.Round" : "DND5E.Rounds")}`);
      if (turns) parts.push(`${turns} ${game.i18n.format(turns === 1 ? "DND5E.Turn" : "DND5E.Turns")}`);
      subText = parts.join(", ");
    } else if (effect.duration.type === "permanent") {
        subText = game.i18n.localize("DND5E.DurationPermanent");
    } else if (effect.flags?.dae?.specialDuration) {
        // Basic indication of special duration, complex string can be built by adapter's postRenderSetup if needed
        subText = game.i18n.localize("DND5E.EffectDurationSpecial"); 
    }

    effectsSection.items.push({
      id: effect.id,
      name: isEffectHiddenForPlayer ? "??" : effect.name,
      icon: isEffectHiddenForPlayer ? "" : effect.img,
      // descriptionHTML: can be populated here if simple, or by adapter postRender if complex enrichment needed
      subText: isEffectHiddenForPlayer ? "" : subText, // Don't show subtext like duration if item is hidden to player
      elementKey: elementKey,
      isHiddenGM: effectIsHiddenByGM,
      uuid: effect.uuid || `Actor.${actor.id}.ActiveEffect.${effect.id}`,
      rawEffectDuration: { rounds: effect.duration.rounds, turns: effect.duration.turns },
      nativeTooltipText: isEffectHiddenForPlayer ? "" : effect.name,
    });
  }
  
  // Add sectionClasses for styling
  effectsSection.sectionClasses = "active-effects-section";

  // If all effects were hidden for player, the section might appear empty to them
  if (!isGM && effectsSection.items.every(item => item.name === "??")) {
      // This is tricky. The section isn't technically empty of items, but items are all ??.
      // The renderer will handle not showing item details. `isEmpty` should reflect if there are processable items.
      // If all items are hidden, the renderer will just show a list of "??" if it iterates.
      // Or, the renderer could check if all items are "??" and then show a generic "??" message.
      // For now, `isEmpty` remains false if there were effects, even if all hidden.
  }

  return effectsSection;
}

/**
 * Prepares a single defense category item for the SIDS.defenses.items array.
 * @param {string[]} defenseValuesArray - Array of raw defense values (e.g., ["fire", "bludgeoning"]).
 * @param {string} categoryName - The display name for this category (e.g., "Resistances").
 * @param {string} categoryElementKey - The unique element key for this category (e.g., "def-resistances").
 * @param {boolean} isCategoryHiddenByFlag - Whether this specific category is flagged as hidden.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @param {object} hiddenElements - The actor's hiddenElements flag object.
 * @param {string} [customString] - Custom string from actor.system.traits.dx.custom.
 * @returns {SIDS.StatblockItem}
 * @private
 */
function _getSingleDefenseCategoryItem(defenseValuesObjectOrArray, categoryName, categoryElementKey, isCategoryHiddenByFlag, isGM, hiddenElements, customStringFromActorTraits) {
  let processedTraitValues = []; // e.g., ["fire", "cold"]
  if (defenseValuesObjectOrArray instanceof Set) {
    processedTraitValues = Array.from(defenseValuesObjectOrArray);
  } else if (Array.isArray(defenseValuesObjectOrArray)) {
    processedTraitValues = defenseValuesObjectOrArray;
  } else if (defenseValuesObjectOrArray && typeof defenseValuesObjectOrArray === 'object') {
    processedTraitValues = Object.entries(defenseValuesObjectOrArray)
      .filter(([, enabled]) => enabled === true)
      .map(([type]) => type);
  }

  const individualTagItems = []; // This will be an array of SIDS.StatblockItem for tags
  const rawTagStrings = []; // For the category's native tooltip
  const tagKeyPrefix = categoryElementKey.replace(/^def-/, 'def-tag-') + '-';

  // Read the new setting
  const placeholderMode = game.settings.get('inspect-statblock', 'dnd5e-defensePlaceholderMode');

  // Store all original tags before filtering for player view. This helps determine if a persistent placeholder is needed.
  const allPotentialGmTags = [];

  // First, build the list of all potential tags with their real names and keys (as GM would see them)
  const populateAllPotentialTags = (valueArray, isCustom) => {
    if (valueArray.length > 0) {
        valueArray.forEach(val => {
            let tagName = val.charAt(0).toUpperCase() + val.slice(1);
            const currentTagElementKey = tagKeyPrefix + (isCustom ? val : val).toLowerCase().replace(/[^a-z0-9]/gi, '');
            if (!isCustom) {
      const dmgConfigVal = CONFIG.DND5E.damageResistanceTypes?.[val];
      const condConfigVal = CONFIG.DND5E.conditionTypes?.[val];
                if (typeof dmgConfigVal === 'string') tagName = game.i18n.localize(dmgConfigVal);
                else if (condConfigVal) {
                    if (typeof condConfigVal === 'string') tagName = game.i18n.localize(condConfigVal);
                    else if (typeof condConfigVal === 'object' && condConfigVal.label) tagName = game.i18n.localize(condConfigVal.label);
          }
        }
            allPotentialGmTags.push({ name: tagName, elementKey: currentTagElementKey });
    });
  }
  };

  populateAllPotentialTags(processedTraitValues, false);
  if (customStringFromActorTraits && typeof customStringFromActorTraits === 'string') {
      const customItems = customStringFromActorTraits.split(';').map(s => s.trim()).filter(s => s.length > 0);
      populateAllPotentialTags(customItems, true);
  }

  // Now, process for display based on GM/Player and placeholderMode
  if (isGM) {
    allPotentialGmTags.forEach(gmTag => {
        const isTagHiddenByGM = _shouldHideElement(gmTag.elementKey, hiddenElements, true);
        individualTagItems.push({
            id: gmTag.elementKey,
            name: gmTag.name, // GM always sees real name
            elementKey: gmTag.elementKey,
            isHiddenGM: isTagHiddenByGM, // For GM styling if they hid it
        });
        rawTagStrings.push(gmTag.name);
    });
  } else { // Player view
    if (placeholderMode === "individualPlaceholders") {
        allPotentialGmTags.forEach(gmTag => {
            const isTagHiddenForPlayer = _shouldHideElement(gmTag.elementKey, hiddenElements, false);
            individualTagItems.push({
                id: gmTag.elementKey, 
                name: isTagHiddenForPlayer ? "??" : gmTag.name,
                elementKey: gmTag.elementKey, 
                isHiddenGM: false, // Player view should not use this flag for styling themselves
            });
            if (!isTagHiddenForPlayer) rawTagStrings.push(gmTag.name);
            else rawTagStrings.push("??"); 
      });
    } else if (placeholderMode === "persistentSinglePlaceholder") {
        allPotentialGmTags.forEach(gmTag => {
            const isTagHiddenForPlayer = _shouldHideElement(gmTag.elementKey, hiddenElements, false);
            if (!isTagHiddenForPlayer) {
                individualTagItems.push({
                    id: gmTag.elementKey,
                    name: gmTag.name,
                    elementKey: gmTag.elementKey,
                    isHiddenGM: false, // It's visible to player
                });
                rawTagStrings.push(gmTag.name);
            }
        });
        // Add persistent "??" if there were any potential tags originally, or if any are currently shown
        if (allPotentialGmTags.length > 0) {
            individualTagItems.push({
                id: categoryElementKey + "-persistent-placeholder",
                name: "??",
                elementKey: categoryElementKey + "-persistent-placeholder", // Non-interactive key
                isPlaceholder: true, // For template styling/logic
                isHiddenGM: false, // Not relevant for GM styling, always visible to player in this mode
            });
            rawTagStrings.push("??"); // For tooltip
        }
    }
  }
 
  // Category name is always its real name now, not "??"
  const displayedCategoryName = categoryName; 
  // isCategoryHiddenByFlag is still used for the category SIDS item's isHiddenGM, for GM styling of the category header

  return {
    id: categoryElementKey,
    name: displayedCategoryName,
    tags: individualTagItems, 
    subText: (individualTagItems.length === 0 && displayedCategoryName !== "??" && isGM) ? game.i18n.localize("None") : "", // Show "None" for GM if category is empty
    elementKey: categoryElementKey,
    isHiddenGM: isGM && isCategoryHiddenByFlag, 
    nativeTooltipText: isGM ? `${categoryName}: ${rawTagStrings.join(', ') || game.i18n.localize("None")}` : `${categoryName}: ${rawTagStrings.join(', ') || "??"}` // Player tooltip shows ?? if empty
  };
}

/**
 * Processes actor passive features (feats with no activation cost) for SIDS.
 * @param {Actor} actor - The D&D 5e actor document.
 * @param {object} hiddenElements - The hiddenElements flag object.
 * @param {boolean} isGM - Whether the current user is a GM.
 * @returns {SIDS.StatblockSection}
 * @private
 */
function _getPassiveFeaturesData(actor, hiddenElements, isGM) {
  const sectionElementKey = "section-passive-features";
  const featuresSection = {
    title: "Features",
    items: [],
    isEmpty: true,
    sectionClasses: "passive-features-section",
    elementKey: sectionElementKey,
    isHiddenGM: isGM && _shouldHideElement(sectionElementKey, hiddenElements, isGM)
  };

  const passiveFeatureItems = (actor.items || []).filter(item => 
    item.type === "feat" && 
    (item.system.activation?.type === "" || !item.system.activation?.type)
  );

  if (passiveFeatureItems.length === 0) {
    return featuresSection; // isEmpty remains true
  }

  featuresSection.isEmpty = false;

  for (const item of passiveFeatureItems) {
    const elementKey = `feature-${item.id}`;
    const isFeatureHiddenForPlayer = !isGM && _shouldHideElement(elementKey, hiddenElements, isGM);
    const featureIsHiddenByGM = isGM && hiddenElements[elementKey];

    // DEBUG LOG:
    if (isGM) {
        console.log(`Inspect Statblock | DEBUG: Feature: ${item.name} (key: ${elementKey}), hiddenElements[elementKey]: ${hiddenElements[elementKey]}, calculated isHiddenGM: ${featureIsHiddenByGM}`);
    }

    featuresSection.items.push({
      id: item.id,
      name: isFeatureHiddenForPlayer ? "??" : item.name,
      icon: isFeatureHiddenForPlayer ? "" : item.img,
      descriptionHTML: item.system.description?.value || "", // Raw description for now
      // subText: typically not used for passive features in this context
      elementKey: elementKey,
      isHiddenGM: featureIsHiddenByGM,
      uuid: item.uuid || `Actor.${actor.id}.Item.${item.id}`,
      nativeTooltipText: isFeatureHiddenForPlayer ? "" : item.name,
    });
  }
  
  // sectionClasses is already set on featuresSection init

  // isEmpty reflects original presence of items. Player view of all "??" is handled by template.
  if (featuresSection.items.length === 0) featuresSection.isEmpty = true; 

  return featuresSection;
}

/**
 * Provides D&D 5e specific section definitions for visibility toggling.
 * Implements the getSystemSectionDefinitions method of the SystemHandler interface.
 * @returns {Record<string, SystemSectionDefinition>}
 */
function getSystemSectionDefinitions() {
  const i18n = game.i18n; // Alias for convenience
  return {
    headerName: {
      name: i18n.localize("DND5E.Name"),
      type: 'single',
      keyPattern: "header-name",
      defaultShowSettingKey: "dnd5e-showDefault-headerName"
    },
    headerCrLevel: {
      name: i18n.localize("DND5E.CR") + "/" + i18n.localize("DND5E.Level"),
      type: 'single',
      keyPattern: "header-crlevel",
      defaultShowSettingKey: "dnd5e-showDefault-headerCrLevel"
    },
    headerSize: {
      name: i18n.localize("DND5E.Size"),
      type: 'single',
      keyPattern: "header-size",
      defaultShowSettingKey: "dnd5e-showDefault-headerSize"
    },
    headerType: {
      name: i18n.localize("DND5E.CreatureType") + " / " + i18n.localize("DND5E.Class"),
      type: 'single',
      keyPattern: "header-type",
      defaultShowSettingKey: "dnd5e-showDefault-headerType"
    },
    ac: {
      name: i18n.localize("DND5E.ArmorClass"),
      type: 'single',
      keyPattern: "section-ac",
      defaultShowSettingKey: "dnd5e-showDefault-ac"
    },
    movementWalk: {
      name: i18n.localize("DND5E.MovementWalk") || "Walk Speed",
      type: 'single',
      keyPattern: "movement-walk",
      defaultShowSettingKey: "dnd5e-showDefault-movementWalk"
    },
    movementFly: {
      name: i18n.localize("DND5E.MovementFly") || "Fly Speed",
      type: 'single',
      keyPattern: "movement-fly",
      defaultShowSettingKey: "dnd5e-showDefault-movementFly"
    },
    movementSwim: {
      name: i18n.localize("DND5E.MovementSwim") || "Swim Speed",
      type: 'single',
      keyPattern: "movement-swim",
      defaultShowSettingKey: "dnd5e-showDefault-movementSwim"
    },
    movementClimb: {
      name: i18n.localize("DND5E.MovementClimb") || "Climb Speed",
      type: 'single',
      keyPattern: "movement-climb",
      defaultShowSettingKey: "dnd5e-showDefault-movementClimb"
    },
    movementBurrow: {
      name: i18n.localize("DND5E.MovementBurrow") || "Burrow Speed",
      type: 'single',
      keyPattern: "movement-burrow",
      defaultShowSettingKey: "dnd5e-showDefault-movementBurrow"
    },
    health: {
      name: i18n.localize("DND5E.HitPoints"),
      type: 'single',
      keyPattern: "section-hp",
      defaultShowSettingKey: "dnd5e-showDefault-health"
    },
    abilities: {
      name: i18n.localize("DND5E.Abilities"),
      type: 'group',
      keyPattern: "ability-",
      defaultShowSettingKey: "dnd5e-showDefault-abilities"
    },
    activeEffectsSection: {
        name: i18n.localize("DND5E.Effects"),
        type: 'single',
        keyPattern: "section-active-effects",
        defaultShowSettingKey: "dnd5e-showDefault-activeEffectsSection"
    },
    // defensesSection is no longer needed here as the main "Defenses" title is not toggleable.
    // Individual categories below are toggleable.
    // defensesSection: {
    //     name: i18n.localize("DND5E.Defenses"),
    //     type: 'single',
    //     keyPattern: "section-defenses",
    //     defaultShowSettingKey: "dnd5e-showDefault-defensesSection"
    // },
    defenseResistances: {
        name: i18n.localize("DND5E.DamRes"),
        type: 'single',
        keyPattern: "def-resistances",
        defaultShowSettingKey: "dnd5e-showDefault-defenseResistances"
    },
    defenseImmunities: {
        name: i18n.localize("DND5E.DamImm"),
        type: 'single',
        keyPattern: "def-immunities",
        defaultShowSettingKey: "dnd5e-showDefault-defenseImmunities"
    },
    defenseVulnerabilities: {
        name: i18n.localize("DND5E.DamVuln"),
        type: 'single',
        keyPattern: "def-vulnerabilities",
        defaultShowSettingKey: "dnd5e-showDefault-defenseVulnerabilities"
    },
    defenseConditions: {
        name: i18n.localize("DND5E.ConImm"),
        type: 'single',
        keyPattern: "def-conditionimmunities",
        defaultShowSettingKey: "dnd5e-showDefault-defenseConditions"
    },
    passiveFeaturesSection: {
        name: i18n.localize("DND5E.Features") + " Section",
        type: 'single',
        keyPattern: "section-passive-features",
        defaultShowSettingKey: "dnd5e-showDefault-passiveFeaturesSection"
    }
  };
}

/**
 * D&D 5e System Handler
 * An object implementing the SystemHandler interface for the D&D 5th Edition game system.
 */
export const Dnd5eHandler = {
  SYSTEM_ID: "dnd5e",

  getStandardizedActorData,
  getSystemSectionDefinitions,
  registerSystemSpecificSettings() {
    registerDnd5eSettings();
  },

  /**
   * Accessor for the DND5E config labels on the global CONFIG object.
   */
  get DND5E_CONFIG_LABELS() {
    return CONFIG.DND5E;
  },

  /**
   * Hides the detailed console log for the entire SIDS object unless a specific debug flag is enabled.
   *
   * @param {string} message
   * @param {*} data
   */
  SIDS_DEBUG_LOG(message, data) {
    const sidsDebug = CONFIG.debug.SIDS_DEBUG || false;
    if (sidsDebug || CONFIG.debug.hooks) {
      console.log(message, data);
    }
  },
};


