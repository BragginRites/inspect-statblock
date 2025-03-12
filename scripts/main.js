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

Hooks.once('init', () => {
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
  game.settings.register("inspect-statblock", "hideHPInfo", {
    name: "Hide HP Information",
    hint: "If enabled, HP and temporary HP info will not be shown in the statblock.",
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

const rerenderStatblock = actor => {
  const oldWin = document.getElementById(`statblock-window-${actor.id}`);
  if (oldWin) oldWin.remove();
  createStatblockWindow(actor, actor.token ?? game.user.targets.first());
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
  const { abilities, attributes, traits, details } = actor.system;
  const armorClass = attributes?.ac?.value ?? "Unknown";
  let levelOrCR, typeOrClass;
  if (actor.type === "character") {
    const classes = actor.items.filter(i => i.type === "class");
    if (classes.length) {
      const sortedClasses = classes.sort((a, b) => (b.system.levels || 0) - (a.system.levels || 0));
      typeOrClass = sortedClasses.map(c => `${c.name} ${c.system.levels}`).join('/');
      const totalLevel = sortedClasses.reduce((sum, c) => sum + (c.system.levels || 0), 0);
      levelOrCR = `Level ${totalLevel} - `;
    } else {
      const level = actor.system.details?.level ?? actor.system.attributes?.level ?? "?";
      levelOrCR = `Level ${level}`;
      typeOrClass = "Character";
    }
  } else {
    const cr = details?.cr ?? "?";
    const formattedCR = cr === 0.25 ? "1/4" : cr === 0.125 ? "1/8" : cr === 0.5 ? "1/2" : cr;
    levelOrCR = `CR ${formattedCR}`;
    typeOrClass = details?.type?.value ? details.type.value[0].toUpperCase() + details.type.value.slice(1) : "Unknown";
  }

  const sizeMapping = { tiny: "Tiny", sm: "Small", med: "Medium", lg: "Large", huge: "Huge", grg: "Gargantuan" };
  const creatureSize = traits?.size ? (sizeMapping[traits.size.toLowerCase()] ?? "Unknown") : "Unknown";
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  const damageResistances = Array.from(traits?.dr?.value ?? []).map(capitalize).join(', ') || 'None';
  const damageImmunities = Array.from(traits?.di?.value ?? []).map(capitalize).join(', ') || 'None';
  const damageVulnerabilities = Array.from(traits?.dv?.value ?? []).map(capitalize).join(', ') || 'None';
  const conditionImmunities = Array.from(traits?.ci?.value ?? []).map(capitalize).join(', ') || 'None';

  const passiveFeatures = actor.items.filter(i => i.type === "feat" && !i.system.activation?.type);
  const passiveHTML = passiveFeatures.length ? `
    <div class="info-section">
      <p>Passive Features</p>
      <ul class="passive-features">
        ${passiveFeatures.map(item => `
          <li>
            <a class="passive-feature-link" data-uuid="${item.uuid}">
              <img src="${item.img}" class="passive-feature-icon" alt="${item.name}">
              <span class="passive-feature-name">${item.name}</span>
            </a>
          </li>
        `).join('')}
      </ul>
    </div>` : "";

  const statblockDiv = document.createElement("div");
  statblockDiv.id = `statblock-window-${actor.id}`;
  statblockDiv.classList.add("floating-window", "dark-app-window", "inspect-statblock");

  // Title Bar and Close Handler
  const titleBar = document.createElement("div");
  titleBar.classList.add("floating-title-bar", "inspect-statblock");
  titleBar.innerHTML = `<div style="display: flex; justify-content: flex-end; width: 100%;">
      <span class="floating-close">✕</span>
    </div>`;
  statblockDiv.appendChild(titleBar);

  // Content Area
  const contentArea = document.createElement("div");
  contentArea.classList.add("floating-content", "inspect-statblock");
  contentArea.innerHTML = `
    <div class="creature-info">
      <div class="creature-header">
        <h1 class="open-portrait" data-actor-id="${actor.id}">${actor.name}</h1>
        <h2>${levelOrCR} ${typeOrClass}</h2>
      </div>
      <div class="token-section">
        <img src="${token?.document?.texture?.src || token?.texture?.src}" class="token-image" alt="${actor.name}">
        <div class="ac-section">
          <div class="ac-shield">
            <i class="fa-solid fa-shield"></i>
            <span class="ac-value">${armorClass}</span>
          </div>
          <div class="movement-speeds">
            ${Object.entries(attributes.movement)
              .filter(([type, data]) => {
                const speed = typeof data === 'object' ? data.value : data;
                return speed && speed > 0;
              })
              .map(([type, data]) => {
                const speed = typeof data === 'object' ? data.value : data;
                const icon = type === 'walk' ? 'fa-solid fa-person-walking' :
                             type === 'fly' ? 'fa-solid fa-dove' :
                             type === 'swim' ? 'fa-solid fa-person-swimming' :
                             type === 'climb' ? 'fa-solid fa-person-hiking' :
                             type === 'burrow' ? 'fa-solid fa-worm' : '';
                return `<div class="speed-tag" title="${type[0].toUpperCase() + type.slice(1)}">
                          <i class="${icon}"></i>
                          <span>${speed}</span>
                        </div>`;
              }).join('')}
          </div>
        </div>
      </div>
      <div class="health-section">
        ${(() => {
          const hideHP = game.settings.get("inspect-statblock", "hideHPInfo");
          if (hideHP) return '<div class="current-health hidden">HP Hidden</div>';
          return `
            <div class="current-health ${attributes.hp.tempmax > 0 ? 'increased-max' : attributes.hp.tempmax < 0 ? 'decreased-max' : ''}">
              ${attributes.hp.value}/${attributes.hp.max + (attributes.hp.tempmax || 0)}
            </div>
            ${attributes.hp.temp ? `<div class="temp-health">+${attributes.hp.temp}</div>` : ''}
          `;
        })()}
      </div>
      <div class="ability-scores">
        ${Object.entries(abilities).map(([key, val]) => `
          <div class="ability">
            <div class="ability-name">${key.toUpperCase()}</div>
            <div class="ability-value">${val.value}</div>
            <div class="ability-mod">${val.mod >= 0 ? '+' : ''}${val.mod}</div>
          </div>
        `).join('')}
      </div>
      <div class="active-effects">
        <div class="section-title">Active Effects</div>
        <div class="effects-grid">
          ${actor.effects.filter(e => !e.disabled).map(effect => `
            <div class="effect-tag" title="${effect.name}" data-effect-id="${effect.id}">
              <img src="${effect.icon}" alt="${effect.name}">
              <span>${effect.name}</span>
              ${(() => {
                const { rounds, turns } = effect.duration;
                if (rounds || turns) {
                  const parts = [];
                  if (rounds) parts.push(`${rounds} ${rounds === 1 ? 'Round' : 'Rounds'}`);
                  if (turns) parts.push(`${turns} ${turns === 1 ? 'Turn' : 'Turns'}`);
                  return `<div class="effect-duration">${parts.join(', ')}</div>`;
                }
                return '';
              })()}
            </div>
          `).join('') || '<div class="no-effects">No Active Effects</div>'}
        </div>
      </div>
      <div class="defenses-grid">
        <div class="defense">
          <div class="defense-name">Resistances</div>
          <div class="defense-value">${damageResistances}</div>
        </div>
        <div class="defense">
          <div class="defense-name">Immunities</div>
          <div class="defense-value">${damageImmunities}</div>
        </div>
        <div class="defense">
          <div class="defense-name">Vulnerabilities</div>
          <div class="defense-value">${damageVulnerabilities}</div>
        </div>
        <div class="defense">
          <div class="defense-name">Condition Imm.</div>
          <div class="defense-value">${conditionImmunities}</div>
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

  attachPassiveFeatureTooltips(contentArea);
  attachEffectTooltips(contentArea);

  contentArea.querySelector('.open-portrait').addEventListener('click', () => {
    const existingPortrait = document.getElementById(`portrait-window-${actor.id}`);
    if (existingPortrait) {
      existingPortrait.remove();
    } else {
      createPortraitWindow(actor, statblockDiv);
    }
  });
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

const attachPassiveFeatureTooltips = container => {
  container.querySelectorAll(".passive-feature-link").forEach(link => {
    const uuid = link.getAttribute("data-uuid");
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

const attachEffectTooltips = container => {
  container.querySelectorAll(".effect-tag").forEach(tag => {
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
        iconSrc: effect.icon,
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
