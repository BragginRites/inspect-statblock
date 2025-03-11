const defaultSizeKey = "inspect-statblock-default-size";

Hooks.once('init', () => {
  console.log("Inspect Statblock module initializing...");

  // Register the new setting to allow/disallow inspection of player characters.
  game.settings.register("inspect-statblock", "allowPlayerInspection", {
    name: "Allow Player Characters to be Inspected",
    hint: "If disabled, the statblock viewer will not open for player characters.",
    scope: "world",
    config: true,
    type: Boolean,
    default: true
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
  console.log("Inspect Statblock module loaded (Auto-Update, UUID Tooltips).");

  // Auto-update statblocks when actor or items change.
  Hooks.on("updateActor", (actor, data, options, userId) => {
    if (openStatblocks[actor.id]) {
      console.log(`Actor ${actor.name} updated. Re-rendering statblock...`);
      rerenderStatblock(actor);
    }
  });
  Hooks.on("createItem", (item, options, userId) => {
    const actor = item.actor;
    if (actor && openStatblocks[actor.id]) {
      console.log(`Item created for ${actor.name}. Re-rendering statblock...`);
      rerenderStatblock(actor);
    }
  });
  Hooks.on("updateItem", (item, diff, options, userId) => {
    const actor = item.actor;
    if (actor && openStatblocks[actor.id]) {
      console.log(`Item updated for ${actor.name}. Re-rendering statblock...`);
      rerenderStatblock(actor);
    }
  });
  Hooks.on("deleteItem", (item, options, userId) => {
    const actor = item.actor;
    if (actor && openStatblocks[actor.id]) {
      console.log(`Item deleted for ${actor.name}. Re-rendering statblock...`);
      rerenderStatblock(actor);
    }
  });
});

/*******************************
 * Global: Track open statblocks
 *******************************/
const openStatblocks = {};

/*******************************
 * Close All Statblocks
 *******************************/
function closeAllStatblockWindows() {
  console.log("Closing all statblock windows...");
  for (let actorId in openStatblocks) {
    const statblockDiv = document.getElementById(`statblock-window-${actorId}`);
    if (statblockDiv) {
      // Clean up any tooltips in this statblock before removal.
      const links = statblockDiv.querySelectorAll(".passive-feature-link");
      links.forEach(link => {
        if (link._customTooltip) {
          link._customTooltip.remove();
          link._customTooltip = null;
        }
      });
      statblockDiv.remove();
    }
  }
  for (let actorId in openStatblocks) {
    delete openStatblocks[actorId];
  }
}

/*******************************
 * Rerender Statblock
 *******************************/
function rerenderStatblock(actor) {
  console.log(`Re-rendering statblock for ${actor.name} (actorId=${actor.id})`);
  const oldWin = document.getElementById(`statblock-window-${actor.id}`);
  if (oldWin) oldWin.remove();
  createStatblockWindow(actor, actor.token ?? game.user.targets.first());
}

/*******************************
 * openStatblockViewer
 *******************************/
async function openStatblockViewer() {
  console.log("openStatblockViewer() called.");
  const targets = Array.from(game.user.targets);
  if (targets.length === 0) {
    ui.notifications.warn("Please target a token.");
    return;
  }
  const token = targets[0];
  if (!token.actor) {
    ui.notifications.warn("The targeted token does not have an actor associated.");
    return;
  }
  const actor = token.actor;

  // Check if this actor is a player character and if inspection is allowed.
  if (actor.type === "character" && !game.settings.get("inspect-statblock", "allowPlayerInspection")) {
    ui.notifications.warn("Inspecting player characters is disabled by module settings.");
    return;
  }

  console.log("Token found. Actor:", actor.name);

  if (openStatblocks[actor.id]) {
    console.log(`Statblock for ${actor.name} is already open. Re-rendering...`);
    rerenderStatblock(actor, token);
  } else {
    createStatblockWindow(actor, token);
  }
}

/*******************************
 * createStatblockWindow
 *******************************/
function createStatblockWindow(actor, token) {
  openStatblocks[actor.id] = true;

  const { abilities, attributes, traits, details } = actor.system;
  const armorClass = attributes?.ac?.value ?? "Unknown";
  
  // Get level/CR and type/class based on actor type
  let levelOrCR, typeOrClass;
  if (actor.type === "character") {
    // For player characters, get their level and class(es)
    const classes = actor.items.filter(i => i.type === "class");
    if (classes.length > 0) {
      // Sort classes by level in descending order
      const sortedClasses = classes.sort((a, b) => 
        (b.system.levels || 0) - (a.system.levels || 0)
      );
      
      // Create class string like "Fighter 3/Warlock 2"
      typeOrClass = sortedClasses
        .map(c => `${c.name} ${c.system.levels}`)
        .join('/');
      
      // Total level is sum of all class levels
      const totalLevel = sortedClasses.reduce((sum, c) => 
        sum + (c.system.levels || 0), 0);
      levelOrCR = `Level ${totalLevel} - `;
    } else {
      // Fallback if no classes found
      const level = actor.system.details?.level ?? actor.system.attributes?.level ?? "?";
      levelOrCR = `Level ${level}`;
      typeOrClass = "Character";
    }
  } else {
    // For NPCs/monsters, get their CR and type
    const cr = details?.cr ?? "?";
    levelOrCR = `CR ${cr}`;
    typeOrClass = details?.type?.value 
      ? details.type.value.charAt(0).toUpperCase() + details.type.value.slice(1)
      : "Unknown";
  }

  const creatureType = details?.type?.value 
    ? details.type.value.charAt(0).toUpperCase() + details.type.value.slice(1)
    : "Unknown";
  const sizeMapping = {
    "tiny": "Tiny",
    "sm": "Small",
    "med": "Medium",
    "lg": "Large",
    "huge": "Huge",
    "grg": "Gargantuan"
  };
  const creatureSize = traits?.size 
    ? (sizeMapping[traits.size.toLowerCase()] ?? "Unknown")
    : "Unknown";
  const capitalize = s => s.charAt(0).toUpperCase() + s.slice(1);
  const damageResistances = Array.from(traits?.dr?.value ?? []).map(capitalize).join(', ') || 'None';
  const damageImmunities = Array.from(traits?.di?.value ?? []).map(capitalize).join(', ') || 'None';
  const damageVulnerabilities = Array.from(traits?.dv?.value ?? []).map(capitalize).join(', ') || 'None';
  const conditionImmunities = Array.from(traits?.ci?.value ?? []).map(capitalize).join(', ') || 'None';

  const passiveFeatures = actor.items.filter(i => 
    i.type === "feat" && !i.system.activation?.type
  );
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
    </div>
  ` : "";

  let abilityRows = "";
  for (const [key, val] of Object.entries(abilities)) {
    const mod = (val.mod >= 0 ? "+" : "") + val.mod;
    abilityRows += `<tr>
      <td><strong>${key.toUpperCase()}</strong></td>
      <td>${val.value}</td>
      <td>(${mod})</td>
    </tr>`;
  }

  const statblockDiv = document.createElement("div");
  statblockDiv.id = `statblock-window-${actor.id}`;
  statblockDiv.classList.add("floating-window", "dark-app-window", "inspect-statblock");

  // Create and append content first
  const titleBar = document.createElement("div");
  titleBar.classList.add("floating-title-bar", "inspect-statblock");
  titleBar.innerHTML = `
    <div style="display: flex; justify-content: flex-end; width: 100%;">
      <span class="floating-close">✕</span>
    </div>
  `;
  statblockDiv.appendChild(titleBar);

  const contentArea = document.createElement("div");
  contentArea.classList.add("floating-content", "inspect-statblock");
  contentArea.innerHTML = `
    <div class="creature-info">
      <div class="creature-header">
        <h1>${actor.name}</h1>
        <h2>${levelOrCR} ${typeOrClass}</h2>
      </div>

      <div class="token-section">
        <img src="${token?.document?.texture?.src || token?.texture?.src || actor.img}" class="token-image" alt="${actor.name}">
        <div class="ac-section">
          <div class="ac-shield">
            <i class="fa-solid fa-shield"></i>
            <span class="ac-value">${armorClass}</span>
          </div>
          <div class="movement-speeds">
            ${(() => {
              console.log('Movement data:', attributes.movement);
              return Object.entries(attributes.movement)
                .filter(([type, data]) => {
                  const speed = typeof data === 'object' ? data.value : data;
                  return speed && speed > 0;
                })
                .map(([type, data]) => {
                  console.log(`Movement type ${type}:`, data);
                  const speed = typeof data === 'object' ? data.value : data;
                  const icon = type === 'walk' ? 'fa-solid fa-person-walking' :
                              type === 'fly' ? 'fa-solid fa-dove' :
                              type === 'swim' ? 'fa-solid fa-person-swimming' :
                              type === 'climb' ? 'fa-solid fa-person-hiking' :
                              type === 'burrow' ? 'fa-solid fa-worm' : '';
                  return `
                    <div class="speed-tag" title="${type.charAt(0).toUpperCase() + type.slice(1)}">
                      <i class="${icon}"></i>
                      <span>${speed}</span>
                    </div>`;
                }).join('');
            })()}
          </div>
        </div>
      </div>

      <div class="health-section">
        <div class="current-health ${attributes.hp.tempmax > 0 ? 'increased-max' : attributes.hp.tempmax < 0 ? 'decreased-max' : ''}">${attributes.hp.value}/${attributes.hp.max + (attributes.hp.tempmax || 0)}</div>
        ${attributes.hp.temp ? `<div class="temp-health">+${attributes.hp.temp}</div>` : ''}
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
    </div>
  `;
  statblockDiv.appendChild(contentArea);
  document.body.appendChild(statblockDiv);

  // Set initial position to center of the screen
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;
  
  // Let the window calculate its natural size first
  const naturalHeight = statblockDiv.offsetHeight;
  
  // Then apply any saved size
  let savedSize = localStorage.getItem(defaultSizeKey);
  if (savedSize) {
    try {
      const { width, height } = JSON.parse(savedSize);
      // Only apply saved size if it's larger than the natural height
      if (height >= naturalHeight) {
        statblockDiv.classList.add('custom-size');
        statblockDiv.style.setProperty('--window-width', `${width}px`);
        statblockDiv.style.setProperty('--window-height', `${height}px`);
      }
    } catch (e) {
      console.warn('Failed to parse saved size:', e);
    }
  }

  // Position the window
  const width = statblockDiv.offsetWidth;
  const height = statblockDiv.offsetHeight;
  statblockDiv.style.left = `${(viewportWidth - width) / 2}px`;
  statblockDiv.style.top = `${(viewportHeight - height) / 2}px`;

  // Check for saved position
  const savedPosKey = `inspect-statblock-position-${actor.id}`;
  const savedPos = localStorage.getItem(savedPosKey);
  if (savedPos) {
    try {
      const { left, top } = JSON.parse(savedPos);
      if (left >= 0 && left <= viewportWidth - width &&
          top >= 0 && top <= viewportHeight - height) {
        statblockDiv.style.left = `${left}px`;
        statblockDiv.style.top = `${top}px`;
      }
    } catch(e) {
      console.warn('Failed to apply saved position:', e);
    }
  }

  // Enable dragging and resizing
  makeElementDraggable(statblockDiv, titleBar, "statblock", actor.id);
  makeElementResizable(statblockDiv);

  // When closing the statblock, also remove any active tooltips.
  titleBar.querySelector(".floating-close").addEventListener("click", () => {
    const links = statblockDiv.querySelectorAll(".passive-feature-link");
    links.forEach(link => {
      if (link._customTooltip) {
        link._customTooltip.remove();
        link._customTooltip = null;
      }
    });
    statblockDiv.remove();
    delete openStatblocks[actor.id];
  });

  attachPassiveFeatureTooltips(contentArea, actor);
}

/*******************************
 * makeElementResizable
 *******************************/
function makeElementResizable(el) {
  const resizer = document.createElement('div');
  resizer.classList.add('resizer');
  el.appendChild(resizer);

  let startX, startY, startWidth, startHeight;
  resizer.addEventListener('mousedown', function(e) {
    e.preventDefault();
    startX = e.clientX;
    startY = e.clientY;
    startWidth = parseInt(window.getComputedStyle(el).width, 10);
    startHeight = parseInt(window.getComputedStyle(el).height, 10);
    window.addEventListener('mousemove', resize, false);
    window.addEventListener('mouseup', stopResize, false);
  });

  function resize(e) {
    const newWidth = Math.max(300, startWidth + e.clientX - startX);
    const newHeight = Math.max(el.scrollHeight, Math.min(1000, startHeight + e.clientY - startY));
    
    if (!el.classList.contains('custom-size')) {
      el.classList.add('custom-size');
    }
    
    el.style.setProperty('--window-width', `${newWidth}px`);
    el.style.setProperty('--window-height', `${newHeight}px`);
  }

  function stopResize() {
    window.removeEventListener('mousemove', resize, false);
    window.removeEventListener('mouseup', stopResize, false);
    
    const width = parseInt(window.getComputedStyle(el).width, 10);
    const height = parseInt(window.getComputedStyle(el).height, 10);
    localStorage.setItem(defaultSizeKey, JSON.stringify({ width, height }));
  }
}

/*******************************
 * makeElementDraggable
 *******************************/
function makeElementDraggable(el, handle, type, actorId) {
  let isDragging = false;
  let currentX;
  let currentY;
  let initialX;
  let initialY;

  handle.addEventListener("mousedown", dragStart);
  window.addEventListener("mousemove", drag);
  window.addEventListener("mouseup", dragEnd);

  function dragStart(e) {
    if (e.target.classList.contains("floating-close")) return;
    
    const rect = el.getBoundingClientRect();
    initialX = e.clientX - rect.left;
    initialY = e.clientY - rect.top;

    if (e.target === handle || e.target.parentNode === handle) {
      isDragging = true;
    }
  }

  function drag(e) {
    if (isDragging) {
      e.preventDefault();

      const newX = e.clientX - initialX;
      const newY = e.clientY - initialY;

      el.style.left = newX + "px";
      el.style.top = newY + "px";

      // Save position
      const savedPosKey = `inspect-statblock-position-${actorId}`;
      localStorage.setItem(savedPosKey, JSON.stringify({
        left: newX,
        top: newY
      }));
    }
  }

  function dragEnd() {
    isDragging = false;
  }
}

/*******************************
 * attachPassiveFeatureTooltips (Custom Tooltip)
 *******************************/
function attachPassiveFeatureTooltips(container, actor) {
  const links = container.querySelectorAll(".passive-feature-link");

  links.forEach(link => {
    const uuid = link.getAttribute("data-uuid");

    link.addEventListener("mouseenter", async (e) => {
      if (link._customTooltip) return;

      const item = await fromUuid(uuid);
      if (!item) return;

      const tooltip = document.createElement("div");
      tooltip.classList.add("custom-tooltip", "dnd5e", "sheet", "inspect-statblock");
      tooltip._pinned = false;

      const icon = document.createElement("img");
      icon.src = item.img;
      icon.classList.add("tooltip-icon");

      const contentDiv = document.createElement("div");
      contentDiv.classList.add("tooltip-content", "inspect-statblock");

      const nameEl = document.createElement("div");
      nameEl.classList.add("tooltip-name", "inspect-statblock");
      nameEl.textContent = item.name;

      const enrichedDescription = await TextEditor.enrichHTML(
        item.system.description?.value || "",
        {
          rollData: item.getRollData?.() || {},
          secrets: false,
          entities: true,
          async: true
        }
      );
      const descEl = document.createElement("div");
      descEl.classList.add("tooltip-description", "inspect-statblock");
      descEl.innerHTML = enrichedDescription;

      contentDiv.appendChild(nameEl);
      contentDiv.appendChild(descEl);
      tooltip.appendChild(icon);
      tooltip.appendChild(contentDiv);

      document.body.appendChild(tooltip);
      tooltip.style.left = `${e.pageX + 10}px`;
      tooltip.style.top = `${e.pageY + 10}px`;

      link._customTooltip = tooltip;

      function onMouseMove(evt) {
        if (!tooltip._pinned) {
          tooltip.style.left = `${evt.pageX + 10}px`;
          tooltip.style.top = `${evt.pageY + 10}px`;
        }
      }

      function onLinkMouseLeave() {
        if (!tooltip._pinned) {
          cleanupTooltip();
        }
      }

      function onLinkMiddleClick(evt) {
        if (evt.button === 1) {
          evt.preventDefault();
          if (!tooltip._pinned) {
            tooltip._pinned = true;
            tooltip.style.left = `${evt.pageX + 10}px`;
            tooltip.style.top = `${evt.pageY + 10}px`;
            link.removeEventListener("mousemove", onMouseMove);
            link.removeEventListener("mouseleave", onLinkMouseLeave);
            tooltip.addEventListener("mousedown", onTooltipMiddleClick);
            tooltip.addEventListener("mousedown", onDragStart);
          }
        }
      }

      function onTooltipMiddleClick(evt) {
        if (evt.button === 1) {
          evt.preventDefault();
          cleanupTooltip();
        }
      }

      function onDragStart(evt) {
        if (evt.button !== 0) return;
        evt.preventDefault();
        const startX = evt.clientX;
        const startY = evt.clientY;
        const origLeft = parseInt(tooltip.style.left, 10);
        const origTop = parseInt(tooltip.style.top, 10);
        function onDragMove(e) {
          tooltip.style.left = `${origLeft + e.clientX - startX}px`;
          tooltip.style.top = `${origTop + e.clientY - startY}px`;
        }
        function onDragEnd(e) {
          window.removeEventListener("mousemove", onDragMove);
          window.removeEventListener("mouseup", onDragEnd);
        }
        window.addEventListener("mousemove", onDragMove);
        window.addEventListener("mouseup", onDragEnd);
      }

      function cleanupTooltip() {
        link.removeEventListener("mousemove", onMouseMove);
        link.removeEventListener("mouseleave", onLinkMouseLeave);
        link.removeEventListener("mousedown", onLinkMiddleClick);
        tooltip.removeEventListener("mousedown", onTooltipMiddleClick);
        tooltip.removeEventListener("mousedown", onDragStart);
        tooltip.remove();
        link._customTooltip = null;
      }

      link.addEventListener("mousemove", onMouseMove);
      link.addEventListener("mouseleave", onLinkMouseLeave);
      link.addEventListener("mousedown", onLinkMiddleClick);
    });

    link.addEventListener("mouseleave", () => {
      if (link._customTooltip && !link._customTooltip._pinned) {
        link._customTooltip.remove();
        link._customTooltip = null;
      }
    });
  });
}