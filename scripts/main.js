const DEFAULT_SIZE_KEY = "inspect-statblock-default-size";
const TOOLTIP_GAP = 10;

// -------------------------
// Helper Functions
// -------------------------

/**
 * Enriches HTML using Foundry's TextEditor, then removes inline styles.
 * This preserves interactive functionality like dice roll bindings.
 * @param {string} text - The raw description text.
 * @param {Object} rollData - The roll data context.
 * @returns {Promise<string>} The cleaned enriched HTML.
 */
const enrichHTMLClean = async (text, rollData = {}) => {
  const rawHTML = await TextEditor.enrichHTML(text, {
    rollData,
    secrets: false,
    entities: true,
    async: true
  });
  const tempContainer = document.createElement("div");
  tempContainer.innerHTML = rawHTML;
  // Remove inline styles while preserving classes and data attributes
  tempContainer.querySelectorAll("[style]").forEach(el => el.removeAttribute("style"));
  return tempContainer.innerHTML;
};

/**
 * Creates a tooltip element with common styling and behavior.
 * @param {Object} options - Configuration for the tooltip.
 * @param {string} options.iconSrc - URL for the tooltip icon.
 * @param {string} options.nameText - Title text for the tooltip.
 * @param {string} options.descriptionHTML - HTML content for the tooltip description.
 * @param {string} [options.durationText] - Optional duration text.
 * @returns {HTMLElement} The tooltip element.
 */
const createCustomTooltip = ({ iconSrc, nameText, descriptionHTML, durationText }) => {
  const tooltip = document.createElement("div");
  tooltip.classList.add("custom-tooltip", "dnd5e", "sheet", "inspect-statblock");
  tooltip._pinned = false;

  const icon = document.createElement("img");
  icon.src = iconSrc;
  icon.classList.add("tooltip-icon");

  const contentDiv = document.createElement("div");
  contentDiv.classList.add("tooltip-content", "inspect-statblock");

  const nameEl = document.createElement("div");
  nameEl.classList.add("tooltip-name", "inspect-statblock");
  nameEl.textContent = nameText;

  contentDiv.appendChild(nameEl);
  if (durationText) {
    const durationEl = document.createElement("div");
    durationEl.classList.add("tooltip-duration", "inspect-statblock");
    durationEl.textContent = durationText;
    contentDiv.appendChild(durationEl);
  }

  const descEl = document.createElement("div");
  descEl.classList.add("tooltip-description", "inspect-statblock");
  descEl.innerHTML = descriptionHTML;
  contentDiv.appendChild(descEl);

  tooltip.appendChild(icon);
  tooltip.appendChild(contentDiv);
  document.body.appendChild(tooltip);

  return tooltip;
};

/**
 * Attaches common tooltip behavior: positioning, dragging, and cleanup.
 * @param {HTMLElement} triggerEl - The element that triggers the tooltip.
 * @param {HTMLElement} tooltip - The tooltip element.
 * @param {MouseEvent} initialEvent - The event that triggered the tooltip.
 */
const setupTooltipBehavior = (triggerEl, tooltip, initialEvent) => {
  // Initial position
  tooltip.style.left = `${initialEvent.pageX + TOOLTIP_GAP}px`;
  tooltip.style.top = `${initialEvent.pageY + TOOLTIP_GAP}px`;

  const onMouseMove = evt => {
    if (!tooltip._pinned) {
      tooltip.style.left = `${evt.pageX + TOOLTIP_GAP}px`;
      tooltip.style.top = `${evt.pageY + TOOLTIP_GAP}px`;
    }
  };

  const cleanupTooltip = () => {
    triggerEl.removeEventListener("mousemove", onMouseMove);
    triggerEl.removeEventListener("mouseleave", onMouseLeave);
    triggerEl.removeEventListener("mousedown", onMiddleClick);
    tooltip.removeEventListener("mousedown", onTooltipMiddleClick);
    tooltip.removeEventListener("mousedown", onDragStart);
    tooltip.remove();
    triggerEl._customTooltip = null;
  };

  const onMouseLeave = () => {
    if (!tooltip._pinned) cleanupTooltip();
  };

  const onMiddleClick = evt => {
    if (evt.button === 1) {
      evt.preventDefault();
      if (!tooltip._pinned) {
        tooltip._pinned = true;
        tooltip.style.left = `${evt.pageX + TOOLTIP_GAP}px`;
        tooltip.style.top = `${evt.pageY + TOOLTIP_GAP}px`;
        triggerEl.removeEventListener("mousemove", onMouseMove);
        triggerEl.removeEventListener("mouseleave", onMouseLeave);
        tooltip.addEventListener("mousedown", onTooltipMiddleClick);
        tooltip.addEventListener("mousedown", onDragStart);
      }
    }
  };

  const onTooltipMiddleClick = evt => {
    if (evt.button === 1) {
      evt.preventDefault();
      cleanupTooltip();
    }
  };

  const onDragStart = evt => {
    if (evt.button !== 0) return;
    evt.preventDefault();
    const startX = evt.clientX;
    const startY = evt.clientY;
    const origLeft = parseInt(tooltip.style.left, 10);
    const origTop = parseInt(tooltip.style.top, 10);
    const onDragMove = e => {
      tooltip.style.left = `${origLeft + e.clientX - startX}px`;
      tooltip.style.top = `${origTop + e.clientY - startY}px`;
    };
    const onDragEnd = () => {
      window.removeEventListener("mousemove", onDragMove);
      window.removeEventListener("mouseup", onDragEnd);
    };
    window.addEventListener("mousemove", onDragMove);
    window.addEventListener("mouseup", onDragEnd);
  };

  triggerEl.addEventListener("mousemove", onMouseMove);
  triggerEl.addEventListener("mouseleave", onMouseLeave);
  triggerEl.addEventListener("mousedown", onMiddleClick);
};

// -------------------------
// Foundry Initialization
// -------------------------

const SECTIONS_FOR_DEFAULT_VISIBILITY = {
  'name': { name: "Name", keyPattern: "header-name", type: "single" },
  'crlevel': { name: "CR/Level", keyPattern: "header-crlevel", type: "single" },
  'type': { name: "Creature Type", keyPattern: "header-type", type: "single" },
  'ac': { name: "Armor Class", keyPattern: "section-ac", type: "single" },
  'movement': { name: "Movement Speeds", keyPattern: "section-movement", type: "single" },
  'hp': { name: "Health Points", keyPattern: "section-hp", type: "single" },
  'abilities': { name: "Ability Scores", keyPattern: "ability-", type: "group" },
  'effects': { name: "Active Effects", keyPattern: "effect-", type: "group" },
  'features': { name: "Passive Features", keyPattern: "feature-", type: "group" },
  'resistances': { name: "Damage Resistances", keyPattern: "res-", type: "group", actorPath: "system.traits.dr.value" },
  'immunities': { name: "Damage Immunities", keyPattern: "imm-", type: "group", actorPath: "system.traits.di.value" },
  'vulnerabilities': { name: "Damage Vulnerabilities", keyPattern: "vuln-", type: "group", actorPath: "system.traits.dv.value" },
  'condimmunities': { name: "Condition Immunities", keyPattern: "condimm-", type: "group", actorPath: "system.traits.ci.value" }
};

Hooks.once('init', () => {
  // Register settings for default visibility of sections
  for (const [sectionId, config] of Object.entries(SECTIONS_FOR_DEFAULT_VISIBILITY)) {
    game.settings.register("inspect-statblock", `defaultShowSection-${sectionId}`, {
      name: `Default to SHOW ${config.name}`,
      hint: `If checked, the ${config.name} section/elements will be shown by default for players on new tokens. Otherwise, they default to hidden.`,
      scope: "world",
      config: true,
      type: Boolean,
      default: false // Default is to HIDE sections unless this is checked
    });
  }

  game.settings.register("inspect-statblock", "allowPlayerInspection", {
    name: "Allow Player Characters to be Inspected",
    hint: "If disabled, the statblock viewer will not open for player characters.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });
  game.settings.register("inspect-statblock", "hideSpecialDurations", {
    name: "Hide Special Duration Conditions",
    hint: "If enabled, special duration conditions will not be shown in effect tooltips.",
    scope: "world",
    config: true,
    type: Boolean,
    default: false
  });

  game.keybindings.register("inspect-statblock", "openStatblock", {
    name: "Open Statblock Viewer",
    hint: "Opens the statblock viewer for the currently targeted token.",
    editable: [{ key: "KeyI" }],
    onDown: () => {
      openStatblockViewer();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
  game.keybindings.register("inspect-statblock", "closeAllStatblocks", {
    name: "Close All Statblock Windows",
    hint: "Closes all open statblock windows and their portraits.",
    editable: [{ key: "KeyI", modifiers: ["ALT"] }],
    onDown: () => {
      closeAllStatblockWindows();
      return true;
    },
    restricted: false,
    precedence: CONST.KEYBINDING_PRECEDENCE.NORMAL
  });
});

Hooks.once('ready', () => {
  Hooks.on("updateActor", actor => {
    if (openStatblocks[actor.id]) rerenderStatblock(actor);
  });
  Hooks.on("createItem", item => {
    const { actor } = item;
    if (actor && openStatblocks[actor.id]) rerenderStatblock(actor);
  });
  Hooks.on("updateItem", item => {
    const { actor } = item;
    if (actor && openStatblocks[actor.id]) rerenderStatblock(actor);
  });
  Hooks.on("deleteItem", item => {
    const { actor } = item;
    if (actor && openStatblocks[actor.id]) rerenderStatblock(actor);
  });
  Hooks.on("createActiveEffect", effect => {
    const { parent: actor } = effect;
    if (actor && openStatblocks[actor.id]) rerenderStatblock(actor);
  });
  Hooks.on("updateActiveEffect", effect => {
    const { parent: actor } = effect;
    if (actor && openStatblocks[actor.id]) rerenderStatblock(actor);
  });
  Hooks.on("deleteActiveEffect", effect => {
    const { parent: actor } = effect;
    if (actor && openStatblocks[actor.id]) rerenderStatblock(actor);
  });
});

// -------------------------
// Global Variables
// -------------------------
const openStatblocks = {};

// -------------------------
// Core Module Functions
// -------------------------

const closeAllStatblockWindows = () => {
  Object.keys(openStatblocks).forEach(actorId => {
    const statblockDiv = document.getElementById(`statblock-window-${actorId}`);
    const portraitWindow = document.getElementById(`portrait-window-${actorId}`);
    if (statblockDiv) {
      statblockDiv.querySelectorAll(".passive-feature-link, .effect-tag").forEach(link => {
        if (link._customTooltip) {
          link._customTooltip.remove();
          link._customTooltip = null;
        }
      });
      statblockDiv.remove();
    }
    if (portraitWindow) portraitWindow.remove();
    delete openStatblocks[actorId];
  });
};

const rerenderStatblock = actorFromHook => { 
  // Keep freshActor check to ensure actor still exists and for token
  const freshActorCheck = game.actors.get(actorFromHook.id); 
  if (!freshActorCheck) {
    console.warn(`Inspect Statblock | rerenderStatblock: Could not find actor with ID ${actorFromHook.id}`);
    const oldWin = document.getElementById(`statblock-window-${actorFromHook.id}`);
    if (oldWin) oldWin.remove();
    delete openStatblocks[actorFromHook.id];
    return;
  }

  const oldWin = document.getElementById(`statblock-window-${actorFromHook.id}`);
  if (oldWin) oldWin.remove();

  // Use actorFromHook for its data, freshActorCheck for token as a fallback source
  const tokenForWindow = freshActorCheck.token ?? actorFromHook.token ?? game.user.targets.first(); 
  
  // Pass the actorFromHook (which has the latest update data) to createStatblockWindow
  createStatblockWindow(actorFromHook, tokenForWindow); 
};

const openStatblockViewer = async () => {
  const targets = Array.from(game.user.targets);
  if (!targets.length) {
    ui.notifications.warn("Please target a token.");
    return;
  }
  const token = targets[0];
  if (!token.actor) {
    ui.notifications.warn("The targeted token does not have an actor associated.");
    return;
  }
  const actor = token.actor;
  if (actor.type === "character" && !game.settings.get("inspect-statblock", "allowPlayerInspection")) {
    ui.notifications.warn("Inspecting player characters is disabled by module settings.");
    return;
  }
  if (openStatblocks[actor.id]) {
    const statblockDiv = document.getElementById(`statblock-window-${actor.id}`);
    const portraitWindow = document.getElementById(`portrait-window-${actor.id}`);
    statblockDiv?.querySelectorAll(".passive-feature-link, .effect-tag").forEach(link => {
      if (link._customTooltip) {
        link._customTooltip.remove();
        link._customTooltip = null;
      }
    });
    statblockDiv?.remove();
    portraitWindow?.remove();
    delete openStatblocks[actor.id];
    return;
  }
  createStatblockWindow(actor, token);
};

const createStatblockWindow = async (actor, token) => {
  openStatblocks[actor.id] = true;
  const isGM = game.user.isGM;

  // Use the authoritative actor from game.actors for initial flag read
  const currentActorInstance = game.actors.get(actor.id);
  console.log("Inspect Statblock | currentActorInstance:", currentActorInstance); // DEBUG
  if (!currentActorInstance) {
      // console.warn(`Inspect Statblock | Could not find actor with ID ${actor.id} when trying to create window.`);
      // Attempt to remove any orphaned window reference
      const existingWindow = document.getElementById(`statblock-window-${actor.id}`);
      if(existingWindow) existingWindow.remove();
      delete openStatblocks[actor.id];
      return; // Cannot proceed
  }

  let hiddenElements = currentActorInstance.getFlag("inspect-statblock", "hiddenElements");
  const gmShouldInitializeDefaults = (hiddenElements === undefined);

  if (isGM) {
    if (gmShouldInitializeDefaults) {
      const initialHiddenElements = {};
      for (const [sectionId, config] of Object.entries(SECTIONS_FOR_DEFAULT_VISIBILITY)) {
        const defaultShowThisSection = game.settings.get("inspect-statblock", `defaultShowSection-${sectionId}`);
        const hideThisSection = !defaultShowThisSection;
        if (config.type === "single") {
          initialHiddenElements[config.keyPattern] = hideThisSection;
        } else if (config.type === "group" && hideThisSection) {
          switch (sectionId) {
            case 'abilities': Object.keys(actor.system.abilities || {}).forEach(key => initialHiddenElements[`${config.keyPattern}${key}`] = true); break;
            case 'effects': (actor.effects || []).forEach(effect => initialHiddenElements[`${config.keyPattern}${effect.id}`] = true); break;
            case 'features': (actor.items || []).filter(i => i.type === "feat" && !i.system.activation?.type).forEach(item => initialHiddenElements[`${config.keyPattern}${item.id}`] = true); break;
            case 'resistances': case 'immunities': case 'vulnerabilities': case 'condimmunities':
              (getProperty(actor, config.actorPath) || []).forEach(item => {
                const sanitizedItem = String(item).toLowerCase().replace(/[^a-z0-9_\\-]+/g, '-').replace(/-$/, '').replace(/^-/, '');
                initialHiddenElements[`${config.keyPattern}${sanitizedItem}`] = true;
              }); break;
          }
        }
      }
      // Use currentActorInstance for setFlag
      await currentActorInstance.setFlag("inspect-statblock", "hiddenElements", initialHiddenElements);
      hiddenElements = initialHiddenElements; 
    }
  } else { 
    if (hiddenElements === undefined) { 
      const defaultPlayerViewHiddenElements = {};
      for (const [sectionId, config] of Object.entries(SECTIONS_FOR_DEFAULT_VISIBILITY)) {
        const defaultShowThisSection = game.settings.get("inspect-statblock", `defaultShowSection-${sectionId}`);
        const hideThisSection = !defaultShowThisSection;
        if (config.type === "single") {
          defaultPlayerViewHiddenElements[config.keyPattern] = hideThisSection;
        } else if (config.type === "group" && hideThisSection) {
          switch (sectionId) {
            case 'abilities': Object.keys(actor.system.abilities || {}).forEach(key => defaultPlayerViewHiddenElements[`${config.keyPattern}${key}`] = true); break;
            case 'effects': (actor.effects || []).forEach(effect => defaultPlayerViewHiddenElements[`${config.keyPattern}${effect.id}`] = true); break;
            case 'features': (actor.items || []).filter(i => i.type === "feat" && !i.system.activation?.type).forEach(item => defaultPlayerViewHiddenElements[`${config.keyPattern}${item.id}`] = true); break;
            case 'resistances': case 'immunities': case 'vulnerabilities': case 'condimmunities':
              (getProperty(actor, config.actorPath) || []).forEach(item => {
                const sanitizedItem = String(item).toLowerCase().replace(/[^a-z0-9_\\-]+/g, '-').replace(/-$/, '').replace(/^-/, '');
                defaultPlayerViewHiddenElements[`${config.keyPattern}${sanitizedItem}`] = true;
              }); break;
          }
        }
      }
      hiddenElements = defaultPlayerViewHiddenElements;
    }
  }

  if (typeof hiddenElements !== 'object' || hiddenElements === null) {
    hiddenElements = {};
  }

  // Determine the most reliable source for system data, especially dynamic values like HP
  let systemDataSource = actor; // Default to the passed actor (actorFromHook on re-renders)
  if (token && token.actor && token.actor.system) {
    console.log("Inspect Statblock | Attempting to use token.actor.system as systemDataSource for dynamic values like HP.");
    // Further check if token.actor's HP data seems more complete/current if actor's is default
    // This is a heuristic: if main actor shows value=max and no temp, but token has different, token is likely more current.
    if (actor.system.attributes.hp.value === actor.system.attributes.hp.max && 
        actor.system.attributes.hp.temp === 0 && 
        (token.actor.system.attributes.hp.value !== token.actor.system.attributes.hp.max || 
         token.actor.system.attributes.hp.temp !== 0)) {
      console.log("Inspect Statblock | Using token.actor.system as systemDataSource based on HP data heuristic.");
      systemDataSource = token.actor;
    } else if (!actor.system.attributes.hp.value) { // If main actor HP value is missing, prefer token
        console.log("Inspect Statblock | Main actor HP value missing, preferring token.actor.system");
        systemDataSource = token.actor;
    } else {
        console.log("Inspect Statblock | Sticking with passed actor.system as systemDataSource. Token HP not significantly different or main actor HP seems valid.");
    }
  } else {
    console.log("Inspect Statblock | No token or token.actor.system available, using passed actor.system as systemDataSource.");
  }

  const { abilities, attributes, traits, details } = systemDataSource.system;
  const armorClassValue = attributes?.ac?.value ?? "Unknown";
  
  // Original Level/CR and Type/Class determination
  let originalLevelOrCR, originalTypeOrClass;
  if (actor.type === "character") {
    const classes = actor.items.filter(i => i.type === "class");
    if (classes.length) {
      const sortedClasses = classes.sort((a, b) => (b.system.levels || 0) - (a.system.levels || 0));
      originalTypeOrClass = sortedClasses.map(c => `${c.name} ${c.system.levels}`).join('/');
      const totalLevel = sortedClasses.reduce((sum, c) => sum + (c.system.levels || 0), 0);
      originalLevelOrCR = `Level ${totalLevel} - `;
    } else {
      const level = actor.system.details?.level ?? actor.system.attributes?.level ?? "?";
      originalLevelOrCR = `Level ${level}`;
      originalTypeOrClass = "Character";
    }
  } else {
    const cr = details?.cr ?? "?";
    const formattedCR = cr === 0.25 ? "1/4" : cr === 0.125 ? "1/8" : cr === 0.5 ? "1/2" : cr;
    originalLevelOrCR = `CR ${formattedCR}`;
    originalTypeOrClass = details?.type?.value ? details.type.value[0].toUpperCase() + details.type.value.slice(1) : "Unknown";
  }

  const sizeMapping = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };
  const creatureSize = traits?.size ? (sizeMapping[traits.size.toLowerCase()] ?? "Unknown") : "Unknown";
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);

  // Helper function to generate HTML for lists with toggleable items
  const generateToggleableListHTML = (itemsArray, baseKeyPrefix, hiddenElements, isGM) => {
    if (!itemsArray || itemsArray.length === 0) {
        return isGM ? 'None' : '???';
    }

    return itemsArray.map(item => {
        const capitalizedItem = capitalize(item);
        // Sanitize item for key: lowercase, replace non-alphanum with dash.
        const sanitizedItem = String(item).toLowerCase().replace(/[^a-z0-9_\\-]+/g, '-').replace(/-$/, '').replace(/^-/, '');
        const elementKey = `${baseKeyPrefix}-${sanitizedItem}`;
        const isHidden = hiddenElements[elementKey];

        let displayedText = capitalizedItem;
        let spanClasses = "is-toggleable-visibility individual-trait-item";

        if (isHidden) {
            if (isGM) {
                spanClasses += ' element-hidden-to-players';
            } else {
                displayedText = "???";
            }
        }
        return `<span class="${spanClasses}" data-element-key="${elementKey}">${displayedText}</span>`;
    }).join(', ');
  };

  const damageResistancesHTML = generateToggleableListHTML(Array.from(traits?.dr?.value ?? []), 'res', hiddenElements, game.user.isGM);
  const damageImmunitiesHTML = generateToggleableListHTML(Array.from(traits?.di?.value ?? []), 'imm', hiddenElements, game.user.isGM);
  const damageVulnerabilitiesHTML = generateToggleableListHTML(Array.from(traits?.dv?.value ?? []), 'vuln', hiddenElements, game.user.isGM);
  const conditionImmunitiesHTML = generateToggleableListHTML(Array.from(traits?.ci?.value ?? []), 'condimm', hiddenElements, game.user.isGM);

  const passiveFeatures = actor.items.filter(i => i.type === "feat" && !i.system.activation?.type);
  const passiveHTML = passiveFeatures.length ? `
    <div class="info-section">
      <p>Passive Features</p>
      <ul class="passive-features">
        ${passiveFeatures.map(item => {
          const elementKey = `feature-${item.id}`;
          const isHidden = hiddenElements[elementKey];
          let featureName = item.name;
          let liClass = "is-toggleable-visibility";
          let iconHTML = `<img src="${item.img}" class="passive-feature-icon" alt="${item.name}">`;

          if (isHidden) {
            if (game.user.isGM) {
              liClass += ' element-hidden-to-players';
            } else {
              featureName = "???";
              iconHTML = "";
            }
          }
          return `
          <li class="${liClass}" data-element-key="${elementKey}">
            <a class="passive-feature-link" data-uuid="${item.uuid}">
              ${iconHTML}
              <span class="passive-feature-name">${featureName}</span>
            </a>
          </li>
        `;}).join('')}
      </ul>
    </div>` : "";

  const statblockDiv = document.createElement("div");
  statblockDiv.id = `statblock-window-${actor.id}`;
  statblockDiv.classList.add("floating-window", "dark-app-window", "inspect-statblock");

  // Title Bar and Close Handler
  const titleBar = document.createElement("div");
  titleBar.classList.add("floating-title-bar", "inspect-statblock");
  
  let titleBarControls = '<div class="title-bar-buttons">';
  if (game.user.isGM) {
    titleBarControls += '<a class="statblock-visibility-control" title="Hide All Elements" data-action="hide-all"><i class="fas fa-eye-slash"></i></a>';
    titleBarControls += '<a class="statblock-visibility-control" title="Show All Elements" data-action="show-all"><i class="fas fa-eye"></i></a>';
  }
  titleBarControls += '</div><span class="floating-close">✕</span>';
  titleBar.innerHTML = titleBarControls;

  statblockDiv.appendChild(titleBar);

  // Content Area
  const contentArea = document.createElement("div");
  contentArea.classList.add("floating-content", "inspect-statblock");

  // AC Section
  const acElementKey = "section-ac";
  const acIsHidden = hiddenElements[acElementKey];
  let acSpecificWrapperClass = "ac-display-wrapper is-toggleable-visibility";
  let displayedAcValue = armorClassValue;
  if (acIsHidden) {
    if (isGM) {
      acSpecificWrapperClass += ' element-hidden-to-players';
    } else {
      displayedAcValue = "??";
    }
  }

  // Movement Speed Section
  const movementElementKey = "section-movement";
  const movementIsHidden = hiddenElements[movementElementKey];
  let movementClass = "movement-speeds is-toggleable-visibility";
  let movementContent = "";

  // Always build the structure, but change content if hidden for player
  movementContent = Object.entries(attributes.movement)
    .filter(([type, data]) => {
      const speed = typeof data === 'object' ? data.value : data;
      return speed && speed > 0; // Keep rendering the structure even if speed is 0 for potential icons
    })
    .map(([type, data]) => {
      let speed = typeof data === 'object' ? data.value : data;
      const icon = type === 'walk' ? 'fa-solid fa-person-walking' :
                   type === 'fly' ? 'fa-solid fa-dove' :
                   type === 'swim' ? 'fa-solid fa-person-swimming' :
                   type === 'climb' ? 'fa-solid fa-person-hiking' :
                   type === 'burrow' ? 'fa-solid fa-worm' : '';
      
      if (movementIsHidden && !game.user.isGM) {
        speed = "??";
      }
      if (!speed && (movementIsHidden && !game.user.isGM)) speed = "??"; // if speed was 0, still show ?? for player
      else if (!speed) speed = "0"; // Show 0 if not hidden and speed is 0

      return `<div class="speed-tag" title="${type[0].toUpperCase() + type.slice(1)}">
                <i class="${icon}"></i>
                <span>${speed}</span>
              </div>`;
    }).join('');
  
  if (!movementContent && movementIsHidden && !game.user.isGM) { // If no speeds at all, and hidden for player
      movementContent = `<span class="hidden-placeholder">???</span>`;
  }

  if (movementIsHidden && game.user.isGM) {
    movementClass += ' element-hidden-to-players';
  }

  // Health Section
  const healthElementKey = "section-hp";
  const healthIsHiddenByFlag = hiddenElements[healthElementKey];
  let healthClass = "health-section is-toggleable-visibility";
  let healthContent = "";

  if (healthIsHiddenByFlag) {
    if (game.user.isGM) {
      healthClass += ' element-hidden-to-players';
      healthContent = `
        <div class="current-health ${attributes.hp.tempmax > 0 ? 'increased-max' : attributes.hp.tempmax < 0 ? 'decreased-max' : ''}">
          ${attributes.hp.value}/${attributes.hp.max + (attributes.hp.tempmax || 0)}
        </div>
        ${attributes.hp.temp ? `<div class="temp-health">+${attributes.hp.temp}</div>` : ''}
      `;
    } else { // Player, hidden by flag
      healthContent = `
        <div class="current-health">?? / ??</div>
        ${attributes.hp.temp ? '<div class="temp-health">+??</div>' : ''} 
      `;
    }
  } else { // Not hidden by flag - should be visible to everyone
    healthContent = `
      <div class="current-health ${attributes.hp.tempmax > 0 ? 'increased-max' : attributes.hp.tempmax < 0 ? 'decreased-max' : ''}">
        ${attributes.hp.value}/${attributes.hp.max + (attributes.hp.tempmax || 0)}
      </div>
      ${attributes.hp.temp ? `<div class="temp-health">+${attributes.hp.temp}</div>` : ''}
    `;
  }

  // Header elements - Name
  const nameElementKey = "header-name";
  const nameIsHidden = hiddenElements[nameElementKey];
  let displayedName = actor.name;
  let nameH1Class = "open-portrait is-toggleable-visibility";
  if (nameIsHidden) {
    if (isGM) {
      nameH1Class += ' element-hidden-to-players';
    } else {
      displayedName = "???";
    }
  }

  // Header elements - CR/Level
  const crLevelElementKey = "header-crlevel";
  const crLevelIsHidden = hiddenElements[crLevelElementKey];
  let displayedCrLevelText = originalLevelOrCR.trim();
  let crLevelSpanClass = "is-toggleable-visibility header-crlevel-span";
  if (crLevelIsHidden) {
    if (isGM) {
      crLevelSpanClass += ' element-hidden-to-players';
    } else {
      displayedCrLevelText = "CR ??"; 
    }
  }

  // Header elements - Type/Class
  const typeElementKey = "header-type";
  const typeIsHidden = hiddenElements[typeElementKey];
  let displayedTypeText = originalTypeOrClass;
  let typeSpanClass = "is-toggleable-visibility header-type-span";
  if (typeIsHidden) {
    if (isGM) {
      typeSpanClass += ' element-hidden-to-players';
    } else {
      displayedTypeText = "???";
    }
  }
  
  let h2CrLevelSpan = ``;
  if (originalLevelOrCR.trim()) {
      h2CrLevelSpan = `<span class="${crLevelSpanClass}" data-element-key="${crLevelElementKey}">${displayedCrLevelText}</span>`;
  }

  let h2TypeSpan = ``;
  if (originalTypeOrClass) {
      h2TypeSpan = `<span class="${typeSpanClass}" data-element-key="${typeElementKey}">${displayedTypeText}</span>`;
  }

  let h2Content = "";
  if ((crLevelIsHidden && !isGM) && (typeIsHidden && !isGM)) {
    h2Content = `<span class="is-toggleable-visibility" data-element-key="${crLevelElementKey}">???</span>`;
  } else {
    let finalCrLevelPart = (originalLevelOrCR.trim()) ? h2CrLevelSpan : "";
    let finalTypePart = (originalTypeOrClass) ? h2TypeSpan : "";

    if (finalCrLevelPart && finalTypePart) {
      h2Content = `${finalCrLevelPart} ${finalTypePart}`;
    } else if (finalCrLevelPart) {
      h2Content = finalCrLevelPart;
    } else if (finalTypePart) {
      h2Content = finalTypePart;
    } else {
      h2Content = `<span class="is-toggleable-visibility" data-element-key="${nameElementKey}"> </span>`;
    }
  }

  contentArea.innerHTML = `
    <div class="creature-info">
      <div class="creature-header">
        <h1 class="${nameH1Class}" data-actor-id="${actor.id}" data-element-key="${nameElementKey}">${displayedName}</h1>
        <h2>${h2Content}</h2>
      </div>
      <div class="token-section">
        <img src="${token?.document?.texture?.src || token?.texture?.src}" class="token-image" alt="${actor.name}">
        <div class="ac-and-movement-container">
          <div class="${acSpecificWrapperClass}" data-element-key="${acElementKey}">
            <div class="ac-shield">
              <i class="fa-solid fa-shield"></i>
              <span class="ac-value">${displayedAcValue}</span>
            </div>
          </div>
          <div class="${movementClass}" data-element-key="${movementElementKey}">
            ${movementContent}
          </div>
        </div>
      </div>
      <div class="${healthClass}" data-element-key="${healthElementKey}">
        ${healthContent}
      </div>
      <div class="ability-scores">
        ${Object.entries(abilities).map(([key, val]) => {
          const elementKey = `ability-${key}`;
          const isHidden = hiddenElements[elementKey];
          let abilityName = key.toUpperCase();
          let abilityValue = val.value;
          let abilityMod = `${val.mod >= 0 ? '+' : ''}${val.mod}`;
          let divClass = "ability is-toggleable-visibility";

          if (isHidden) {
            if (game.user.isGM) {
              divClass += ' element-hidden-to-players';
            } else {
              abilityValue = "??";
              abilityMod = "?";
            }
          }
          return `
          <div class="${divClass}" data-element-key="${elementKey}">
            <div class="ability-name">${abilityName}</div>
            <div class="ability-value">${abilityValue}</div>
            <div class="ability-mod">${abilityMod}</div>
          </div>
        `;}).join('')}
      </div>
      <div class="active-effects">
        <div class="section-title">Active Effects</div>
        <div class="effects-grid">
          ${(() => { // Wrap in IIFE to allow logging
            console.log("Inspect Statblock | actor.effects (parameter) before map:", actor?.effects ? JSON.parse(JSON.stringify(actor.effects)) : "undefined or null"); // DEBUG
            console.log("Inspect Statblock | currentActorInstance.effects before map:", currentActorInstance?.effects ? JSON.parse(JSON.stringify(currentActorInstance.effects)) : "undefined or null"); // DEBUG
            
            let effectsSourceToUse = actor.effects;
            // Fallback if actor.effects is empty, and we have a token
            if ((!effectsSourceToUse || effectsSourceToUse.size === 0) && token && token.actor) {
                console.warn("Inspect Statblock | actor.effects (parameter) is empty. Attempting fallback to token.actor.effects for this render.");
                const tokenActorInstance = canvas.tokens.get(token.id)?.actor; // Get actor directly from the token on canvas
                if (tokenActorInstance && tokenActorInstance.effects && tokenActorInstance.effects.size > 0) {
                    effectsSourceToUse = tokenActorInstance.effects;
                    console.log("Inspect Statblock | Using token.actor.effects as fallback:", JSON.parse(JSON.stringify(effectsSourceToUse)));
                } else {
                    console.warn("Inspect Statblock | Fallback to token.actor.effects also empty or token actor not found.");
                }
            }

            console.log("Inspect Statblock | Chosen effectsSource for rendering:", effectsSourceToUse ? JSON.parse(JSON.stringify(effectsSourceToUse)) : "undefined or null"); // DEBUG

            const effectsToRender = (effectsSourceToUse || []).filter(e => !e.disabled);
            console.log("Inspect Statblock | effectsToRender (after filter):", JSON.parse(JSON.stringify(effectsToRender))); // DEBUG

            // Item 2: Ensure new effects get a default visibility based on settings
            let flagsWereUpdatedByNewEffectDefaults = false;
            if (effectsSourceToUse) { // Only proceed if we have effects
                const defaultShowEffects = game.settings.get("inspect-statblock", "defaultShowSection-effects");
                (effectsSourceToUse || []).forEach(effect => {
                    const elementKey = `effect-${effect.id}`;
                    if (hiddenElements[elementKey] === undefined) { // If no flag exists for this effect
                        console.log(`Inspect Statblock | No flag for effect ${effect.name} (${elementKey}). Applying default: ${defaultShowEffects ? 'SHOW' : 'HIDE'}.`);
                        hiddenElements[elementKey] = !defaultShowEffects; // true if default is HIDE, false if default is SHOW
                        flagsWereUpdatedByNewEffectDefaults = true;
                    }
                });
            }
            // Persist if GM and flags were changed by applying defaults to new effects
            if (isGM && flagsWereUpdatedByNewEffectDefaults) {
                console.log("Inspect Statblock | Saving updated hiddenElements after applying defaults to new effects.");
                currentActorInstance.setFlag("inspect-statblock", "hiddenElements", hiddenElements).catch(err => console.error("Error saving flags for new effect defaults:", err));
            }

            if (effectsToRender.length === 0) return '<div class="no-effects">No Active Effects</div>'; // Explicitly return if no effects

            return effectsToRender.map(effect => {
              console.log("Inspect Statblock | Processing effect in map:", JSON.parse(JSON.stringify(effect))); // DEBUG
              const elementKey = `effect-${effect.id}`;
              const isHidden = hiddenElements[elementKey];
              let effectName = effect.name;
              let divClass = "effect-tag is-toggleable-visibility";
              let durationHTML = "";
              let titleAttributeText = effect.name; // Default to full name
              let imageHTML = `<img src="${effect.img}" alt="${effect.name}">`; // Default to showing image

              if (isHidden) {
                if (game.user.isGM) {
                  divClass += ' element-hidden-to-players';
                  // GM still sees normal duration if applicable and full title
                   const { rounds, turns } = effect.duration;
                  if (rounds || turns) {
                    const parts = [];
                    if (rounds) parts.push(`${rounds} ${rounds === 1 ? 'Round' : 'Rounds'}`);
                    if (turns) parts.push(`${turns} ${turns === 1 ? 'Turn' : 'Turns'}`);
                    durationHTML = `<div class="effect-duration">${parts.join(', ')}</div>`;
                  }
                } else {
                  effectName = "???";
                  titleAttributeText = ""; // No title for hidden effects for players
                  imageHTML = ""; // No image for hidden effects for players
                  // No duration shown for players if hidden
                }
              } else {
                // Normal duration rendering if not hidden
                const { rounds, turns } = effect.duration;
                if (rounds || turns) {
                  const parts = [];
                  if (rounds) parts.push(`${rounds} ${rounds === 1 ? 'Round' : 'Rounds'}`);
                  if (turns) parts.push(`${turns} ${turns === 1 ? 'Turn' : 'Turns'}`);
                  durationHTML = `<div class="effect-duration">${parts.join(', ')}</div>`;
                }
              }
              return `
              <div class="${divClass}" title="${titleAttributeText}" data-element-key="${elementKey}" data-effect-id="${effect.id}">
                ${imageHTML}
                <span>${effectName}</span>
                ${durationHTML}
              </div>
            `;}).join('') /* Removed fallback here as it's handled inside IIFE */
          })()}
        </div>
      </div>
      <div class="defenses-grid">
        <div class="defense">
          <div class="defense-name">Resistances</div>
          <div class="defense-value">${damageResistancesHTML}</div>
        </div>
        <div class="defense">
          <div class="defense-name">Immunities</div>
          <div class="defense-value">${damageImmunitiesHTML}</div>
        </div>
        <div class="defense">
          <div class="defense-name">Vulnerabilities</div>
          <div class="defense-value">${damageVulnerabilitiesHTML}</div>
        </div>
        <div class="defense">
          <div class="defense-name">Condition Imm.</div>
          <div class="defense-value">${conditionImmunitiesHTML}</div>
        </div>
      </div>
    </div>
    ${passiveHTML}
  `;
  statblockDiv.appendChild(contentArea);
  document.body.appendChild(statblockDiv);

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  const { offsetWidth: width, offsetHeight: height } = statblockDiv;
  const padding = 150;
  statblockDiv.style.left = `${viewportWidth - width - padding}px`;
  statblockDiv.style.top = `${(viewportHeight - height) / 2}px`;
  const savedPosKey = `inspect-statblock-position-${actor.id}`;
  const savedPos = localStorage.getItem(savedPosKey);
  if (savedPos) {
    try {
      const { left, top } = JSON.parse(savedPos);
      if (left >= 0 && left <= viewportWidth - width && top >= 0 && top <= viewportHeight - height) {
        statblockDiv.style.left = `${left}px`;
        statblockDiv.style.top = `${top}px`;
      }
    } catch(e) { /* silently fail */ }
  }

  makeElementDraggable(statblockDiv, titleBar, "statblock", actor.id);

  titleBar.querySelector(".floating-close").addEventListener("click", () => {
    statblockDiv.querySelectorAll(".passive-feature-link, .effect-tag").forEach(link => {
      if (link._customTooltip) {
        link._customTooltip.remove();
        link._customTooltip = null;
      }
    });
    const portraitWindow = document.getElementById(`portrait-window-${actor.id}`);
    if (portraitWindow) portraitWindow.remove();
    statblockDiv.remove();
    delete openStatblocks[actor.id];
  });

  attachPassiveFeatureTooltips(contentArea, hiddenElements, isGM);
  attachEffectTooltips(contentArea, hiddenElements, isGM);

  contentArea.querySelector('.open-portrait').addEventListener('click', () => {
    const existingPortrait = document.getElementById(`portrait-window-${actor.id}`);
    if (existingPortrait) {
      existingPortrait.remove();
    } else {
      createPortraitWindow(actor, statblockDiv);
    }
  });

  // Added: Right-click listener for toggling visibility - GM ONLY
  if (game.user.isGM) {
    contentArea.addEventListener('contextmenu', async (event) => {
      const targetElement = event.target.closest('.is-toggleable-visibility');
      if (!targetElement) return;

      event.preventDefault();

      // Check for and remove any active custom tooltip on child elements before DOM manipulation
      const passiveFeatureLinkWithTooltip = targetElement.querySelector('.passive-feature-link');
      if (passiveFeatureLinkWithTooltip && passiveFeatureLinkWithTooltip._customTooltip) {
        passiveFeatureLinkWithTooltip._customTooltip.remove();
        passiveFeatureLinkWithTooltip._customTooltip = null;
      }
      // Potentially add checks for other types of tooltips if they can be on targetElement directly
      if (targetElement._customTooltip) { // e.g. if effect tags themselves get tooltips directly on them
          targetElement._customTooltip.remove();
          targetElement._customTooltip = null;
      }

      const elementKey = targetElement.dataset.elementKey;
      if (!elementKey) return;

      const currentActor = game.actors.get(actor.id); // Get fresh actor instance
      if (!currentActor) return;

      const currentHiddenElements = currentActor.getFlag("inspect-statblock", "hiddenElements") || {};
      const newHiddenState = !currentHiddenElements[elementKey];
      const updatedHiddenElements = { ...currentHiddenElements, [elementKey]: newHiddenState };

      await currentActor.setFlag("inspect-statblock", "hiddenElements", updatedHiddenElements);
      targetElement.classList.toggle("element-hidden-to-players", newHiddenState);
    });

    // Event delegation for Show/Hide All buttons on the titleBar
    titleBar.addEventListener('click', async (event) => {
      const target = event.target.closest('.statblock-visibility-control');
      if (!target) return;

      const currentActor = game.actors.get(actor.id); // Get fresh actor instance
      if (!currentActor) return;

      const action = target.dataset.action;
      let hiddenFlags = currentActor.getFlag("inspect-statblock", "hiddenElements") || {};

      if (action === 'hide-all') {
        const newFlags = { ...hiddenFlags }; // Operate on a new object
        contentArea.querySelectorAll('.is-toggleable-visibility').forEach(el => {
          const key = el.dataset.elementKey;
          if (key) {
            newFlags[key] = true;
            el.classList.add('element-hidden-to-players');
          }
        });
        await currentActor.setFlag("inspect-statblock", "hiddenElements", newFlags);
      } else if (action === 'show-all') {
        contentArea.querySelectorAll('.is-toggleable-visibility').forEach(el => {
          el.classList.remove('element-hidden-to-players');
        });

        const flagsToShowAll = {};
        console.log("Inspect Statblock | [Show All] currentActor.effects before building flags:", currentActor?.effects ? JSON.parse(JSON.stringify(currentActor.effects)) : "undefined or null"); // DEBUG
        // Iterate through all defined sections and their potential elements, setting them to false (visible)
        for (const [sectionId, config] of Object.entries(SECTIONS_FOR_DEFAULT_VISIBILITY)) {
          if (config.type === "single") {
            flagsToShowAll[config.keyPattern] = false;
          } else if (config.type === "group") {
            switch (sectionId) {
              case 'abilities':
                Object.keys(currentActor.system.abilities || {}).forEach(key => {
                  flagsToShowAll[`${config.keyPattern}${key}`] = false;
                });
                break;
              case 'effects':
                let effectsForShowAll = currentActor.effects;
                if (!effectsForShowAll || effectsForShowAll.size === 0) {
                  console.warn("Inspect Statblock | [Show All] currentActor.effects is empty. Trying actor param.");
                  effectsForShowAll = actor.effects; // actor is from createStatblockWindow scope
                }
                if ((!effectsForShowAll || effectsForShowAll.size === 0) && token && token.actor) {
                  console.warn("Inspect Statblock | [Show All] actor.effects (param) also empty. Trying token.actor.effects.");
                  const tokenActorInstance = canvas.tokens.get(token.id)?.actor;
                  if (tokenActorInstance && tokenActorInstance.effects && tokenActorInstance.effects.size > 0) {
                    effectsForShowAll = tokenActorInstance.effects;
                  }
                }
                console.log("Inspect Statblock | [Show All] effectsForShowAll chosen:", effectsForShowAll ? JSON.parse(JSON.stringify(effectsForShowAll)) : "undefined/null");
                (effectsForShowAll || []).forEach(effect => {
                  flagsToShowAll[`${config.keyPattern}${effect.id}`] = false;
                });
                break;
              case 'features':
                (currentActor.items || []).filter(i => i.type === "feat" && !i.system.activation?.type).forEach(item => {
                  flagsToShowAll[`${config.keyPattern}${item.id}`] = false;
                });
                break;
              case 'resistances':
              case 'immunities':
              case 'vulnerabilities':
              case 'condimmunities':
                (getProperty(currentActor, config.actorPath) || []).forEach(item => {
                  const sanitizedItem = String(item).toLowerCase().replace(/[^a-z0-9_\\-]+/g, '-').replace(/-$/, '').replace(/^-/, '');
                  flagsToShowAll[`${config.keyPattern}${sanitizedItem}`] = false;
                });
                break;
            }
          }
        }
        console.log("Inspect Statblock | [Show All] flagsToShowAll before setFlag:", JSON.parse(JSON.stringify(flagsToShowAll))); // DEBUG
        await currentActor.setFlag("inspect-statblock", "hiddenElements", flagsToShowAll); 
      }
    });
  }
};

const makeElementDraggable = (el, handle, type, actorId) => {
  let isDragging = false, initialX, initialY;
  handle.addEventListener("mousedown", e => {
    if (e.target.classList.contains("floating-close")) return;
    const rect = el.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;
    if (e.target === handle || e.target.parentNode === handle) isDragging = true;
  });
  window.addEventListener("mousemove", e => {
    if (isDragging) {
      e.preventDefault();
      const newX = e.clientX - initialX;
      const newY = e.clientY - initialY;
      el.style.left = newX + "px";
      el.style.top = newY + "px";
      localStorage.setItem(`inspect-statblock-position-${actorId}`, JSON.stringify({ left: newX, top: newY }));
      if (type === "statblock") {
        const portraitWindow = document.getElementById(`portrait-window-${actorId}`);
        if (portraitWindow) {
          const statblockRect = el.getBoundingClientRect();
          const portraitRect = portraitWindow.getBoundingClientRect();
          let portraitLeft = portraitWindow.dataset.currentSide === "right" ?
            statblockRect.right + TOOLTIP_GAP : statblockRect.left - portraitRect.width - TOOLTIP_GAP;
          portraitLeft = Math.max(0, Math.min(portraitLeft, window.innerWidth - portraitRect.width));
          portraitWindow.style.left = `${portraitLeft}px`;
          portraitWindow.style.top = `${statblockRect.top}px`;
        }
      }
    }
  });
  window.addEventListener("mouseup", () => { isDragging = false; });
};

const attachPassiveFeatureTooltips = (container, hiddenElements, isGM) => {
  container.querySelectorAll(".passive-feature-link").forEach(link => {
    const uuid = link.getAttribute("data-uuid");
    
    // Check if feature should be hidden for player before attaching tooltip logic
    const listItem = link.closest('li.is-toggleable-visibility');
    if (listItem) {
        const elementKey = listItem.dataset.elementKey;
        if (elementKey && hiddenElements && hiddenElements[elementKey] && !isGM) {
            return; // Skip tooltip attachment for this hidden feature for players
        }
    }

    link.addEventListener("mouseenter", async e => {
      if (link._customTooltip) return;
      const item = await fromUuid(uuid);
      if (!item) return;
      const enrichedDescription = await enrichHTMLClean(item.system.description?.value || "", item.getRollData?.() || {});
      const tooltip = createCustomTooltip({
        iconSrc: item.img,
        nameText: item.name,
        descriptionHTML: enrichedDescription
      });
      link._customTooltip = tooltip;
      setupTooltipBehavior(link, tooltip, e);
    });
    link.addEventListener("mouseleave", () => {
      if (link._customTooltip && !link._customTooltip._pinned) {
        link._customTooltip.remove();
        link._customTooltip = null;
      }
    });
  });
};

const attachEffectTooltips = (container, hiddenElements, isGM) => {
  container.querySelectorAll(".effect-tag").forEach(tag => {
    const elementKey = tag.dataset.elementKey;
    if (!isGM && hiddenElements && hiddenElements[elementKey]) {
      return; // Skip tooltip attachment for this hidden effect for players
    }

    const effectId = tag.getAttribute("data-effect-id");
    const effect = tag.actor ? tag.actor.effects.get(effectId) : null;
    if (!effect) return;
    tag.addEventListener("mouseenter", async e => {
      if (tag._customTooltip) return;
      let durationText = "";
      const { duration } = effect;
      const hasTimeBased = duration.rounds || duration.turns;
      const hideSpecial = game.settings.get("inspect-statblock", "hideSpecialDurations");
      if (effect.flags?.dae?.specialDuration && !hideSpecial) {
        let specialDurations = Array.isArray(effect.flags.dae.specialDuration) ?
          effect.flags.dae.specialDuration : [effect.flags.dae.specialDuration];
        const specialDurationMap = {
          isDamaged: 'the target takes any damage',
          isAttacked: 'the target is attacked',
          isHit: 'the target is hit by an attack',
          isSave: 'the target makes any saving throw',
          isSaveSuccess: 'the target succeeds on any saving throw',
          isSaveFail: 'the target fails any saving throw',
          isSaveStr: 'the target makes a Strength saving throw',
          isSaveDex: 'the target makes a Dexterity saving throw',
          isSaveCon: 'the target makes a Constitution saving throw',
          isSaveInt: 'the target makes an Intelligence saving throw',
          isSaveWis: 'the target makes a Wisdom saving throw',
          isSaveCha: 'the target makes a Charisma saving throw',
          isCheck: 'the target makes any ability check',
          isSkill: 'the target makes any skill check',
          longRest: 'a long rest is taken',
          shortRest: 'a short rest is taken',
          newDay: 'the next day begins',
          newRound: 'the next round begins',
          turnStart: 'their turn starts',
          turnEnd: 'their turn ends'
        };
        const damageTypeMap = {
          acid: 'acid',
          bludgeoning: 'bludgeoning',
          cold: 'cold',
          fire: 'fire',
          force: 'force',
          lightning: 'lightning',
          necrotic: 'necrotic',
          piercing: 'piercing',
          poison: 'poison',
          psychic: 'psychic',
          radiant: 'radiant',
          slashing: 'slashing',
          thunder: 'thunder'
        };
        const formatted = specialDurations.map(dur => {
          if (typeof dur === 'string') {
            const parts = dur.split('.');
            if (parts.length > 1) {
              const [cond, type] = parts;
              if (cond === 'isSave') {
                const abilityNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
                return `the target makes a ${abilityNames[type] || type} saving throw`;
              }
              if (cond === 'isCheck') {
                const abilityNames = { str: 'Strength', dex: 'Dexterity', con: 'Constitution', int: 'Intelligence', wis: 'Wisdom', cha: 'Charisma' };
                return `the target makes a ${abilityNames[type] || type} ability check`;
              }
              if (cond === 'isSkill') {
                return `the target makes a ${type.charAt(0).toUpperCase() + type.slice(1)} check`;
              }
              if (cond === 'isDamaged') {
                const dmg = damageTypeMap[type.toLowerCase()];
                return dmg ? `the target takes ${dmg} damage` : `the target takes ${type} damage`;
              }
            }
            return specialDurationMap[dur] || dur;
          }
          return dur;
        });
        durationText = `Expires when ${formatted.join(' or ')}`;
        if (hasTimeBased) {
          const parts = [];
          if (duration.rounds) parts.push(`${duration.rounds} ${duration.rounds === 1 ? 'Round' : 'Rounds'}`);
          if (duration.turns) parts.push(`${duration.turns} ${duration.turns === 1 ? 'Turn' : 'Turns'}`);
          durationText += ` or after ${parts.join(' or ')}`;
        }
      } else if (hasTimeBased) {
        const parts = [];
        if (duration.rounds) parts.push(`${duration.rounds} ${duration.rounds === 1 ? 'Round' : 'Rounds'}`);
        if (duration.turns) parts.push(`${duration.turns} ${duration.turns === 1 ? 'Turn' : 'Turns'}`);
        durationText = `Expires after ${parts.join(' or ')}`;
      } else if (duration.type === "permanent") {
        durationText = "Duration: Permanent";
      } else {
        durationText = "Duration: -";
      }
      const enrichedDescription = await enrichHTMLClean(effect.description || "", {});
      const tooltip = createCustomTooltip({
        iconSrc: effect.img,
        nameText: effect.name,
        descriptionHTML: enrichedDescription,
        durationText
      });
      tag._customTooltip = tooltip;
      setupTooltipBehavior(tag, tooltip, e);
    });
    tag.addEventListener("mouseleave", () => {
      if (tag._customTooltip && !tag._customTooltip._pinned) {
        tag._customTooltip.remove();
        tag._customTooltip = null;
      }
    });
  });
};

const createPortraitWindow = (actor, statblockDiv) => {
  const existingPortrait = document.getElementById(`portrait-window-${actor.id}`);
  if (existingPortrait) existingPortrait.remove();

  const portraitDiv = document.createElement("div");
  portraitDiv.id = `portrait-window-${actor.id}`;
  portraitDiv.classList.add("floating-window", "dark-app-window", "inspect-statblock", "portrait-window");

  const titleBar = document.createElement("div");
  titleBar.classList.add("floating-title-bar", "inspect-statblock");
  titleBar.innerHTML = `<div style="display: flex; justify-content: flex-end; width: 100%;">
      <span class="floating-close">✕</span>
    </div>`;
  portraitDiv.appendChild(titleBar);

  const contentArea = document.createElement("div");
  contentArea.classList.add("floating-content", "inspect-statblock", "portrait-content");
  contentArea.innerHTML = `
    <div class="portrait-container">
      <img src="${actor.img}" class="portrait-image" alt="${actor.name}'s Portrait">
    </div>`;
  portraitDiv.appendChild(contentArea);

  document.body.appendChild(portraitDiv);

  const positionPortrait = () => {
    const statblockRect = statblockDiv.getBoundingClientRect();
    const portraitRect = portraitDiv.getBoundingClientRect();
    const newLeft = Math.max(0, statblockRect.left - portraitRect.width);
    portraitDiv.style.left = `${newLeft}px`;
    portraitDiv.style.top = `${statblockRect.top}px`;
  };

  const img = contentArea.querySelector('.portrait-image');
  img.onload = () => {
    portraitDiv.style.display = 'none';
    portraitDiv.offsetHeight; // force reflow
    portraitDiv.style.display = '';
    positionPortrait();
  };
  positionPortrait();

  const resizeObserver = new ResizeObserver(() => positionPortrait());
  resizeObserver.observe(portraitDiv);
  resizeObserver.observe(statblockDiv);

  const closeHandler = () => {
    resizeObserver.disconnect();
    portraitDiv.remove();
  };
  titleBar.querySelector(".floating-close").addEventListener("click", closeHandler);
};
