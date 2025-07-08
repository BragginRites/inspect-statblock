## Tooltip System Architecture

### 1. Foundry VTT's Tooltip Foundation

The tooltip system builds on Foundry VTT's core tooltip functionality, which uses data attributes on HTML elements to trigger tooltip rendering. When Foundry detects elements with `data-tooltip` attributes containing `data-uuid` values, it automatically calls the `richTooltip()` method on the referenced document.

### 2. Component Tooltip Setup

For your Greataxe tooltip, the process starts in the component system. Looking at `component.js`:

```88:116:scripts/components/component.js
async setTooltip() {
    if(this.dataTooltip) {
        switch (this.dataTooltip.type) {
            case 'basic':
                this.element.title = this.dataTooltip.content;
                break;    
            case 'simple':
                this.element.dataset.tooltip = this.dataTooltip.content;
                this.element.dataset.tooltipDirection = this.dataTooltip.direction ?? 'UP';
                break;   
            case 'advanced':
                const uuid = this.data?.uuid ?? this.data?.item?.uuid;
                if(uuid) {
                    // const exclude = uuid.includes('.Activity.') || uuid.includes('Macro.');
                    const exclude = false;
                    if(exclude) break;
                    const targetElement = this.element.firstElementChild ?? this.element;
                    targetElement.dataset.tooltip = `<section class="loading" data-uuid="${this.data?.uuid ?? this.data?.item?.uuid}"><i class="fas fa-spinner fa-spin-pulse"></i></section>`;
                    targetElement.dataset.tooltipClass = `dnd5e2 dnd5e-tooltip item-tooltip bg3-tooltip`;
                    targetElement.dataset.tooltipDirection="UP";
                }
                break;        
            default:
                break;
        }
    } else return;
}
```

The Greataxe uses an "advanced" tooltip type, which sets up the element with:
- `data-tooltip`: Contains a loading section with the item's UUID
- `data-tooltip-class`: Specifies CSS classes including `bg3-tooltip`
- `data-tooltip-direction`: Sets tooltip position to "UP"

### 3. Template Override System

The BG3TooltipManager overrides Foundry's default item tooltip template:

```8:8:scripts/managers/TooltipManager.js
game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE = `modules/${BG3CONFIG.MODULE_NAME}/templates/tooltips/item-tooltip.hbs`;
```

This tells Foundry to use the BG3 custom template instead of the system default.

### 4. Data Preparation

When the tooltip is triggered, Foundry calls the `richTooltip()` method on the item, which internally calls `getCardData()`. The BG3 module doesn't override this for items (only for activities and macros), so it uses Foundry's default data preparation which includes:

- Basic item info: name, type, img, subtitle
- Price and weight information
- Labels for attacks, damage, reach
- Description and properties
- Uses/charges data

### 5. Template Rendering

The main tooltip template (`item-tooltip.hbs`) renders the structure:

```1:62:templates/tooltips/item-tooltip.hbs
<section class="content overrided-tooltip">
    <section class="header">
        {{#if school}}
        <div class="school">
            {{#with (lookup @root.config.spellSchools school) as |schoolConfig|}}
            <dnd5e-icon src="{{ schoolConfig.icon }}"></dnd5e-icon>
            {{/with}}
        </div>
        {{/if}}
        <div class="top">
            <img src="{{ img }}" alt="{{ name }}">
            <div class="name name-stacked">
                <span class="title">{{ name }}</span>
                <span class="subtitle">{{{ subtitle }}}</span>
            </div>
        </div>
        <div class="bottom">
            <div class="price">
                {{#if price}}
                <i class="currency {{ price.denomination }}"></i>
                <span>{{ dnd5e-numberFormat price.value }}</span>
                {{/if}}
            </div>

            <div class="charges">
                {{#if uses.max}}
                <span class="value">{{ uses.value }}</span>
                <span class="separator">&sol;</span>
                <span class="max">{{ uses.max }}</span>
                <span>{{ localize "DND5E.Charges" }}</span>
                {{/if}}
            </div>
            <div class="weight">
                {{#if weight}}
                <i class="fas fa-weight-hanging"></i>
                <span>{{ weight.value }}</span>
                {{/if}}
            </div>
        </div>
    </section>
    {{#if isSpell}}
        {{> "dnd5e.spell-block" }}
    {{/if}}
    {{#if (eq type "weapon")}}
        {{> "bg3hotbar.weapon-block" }}
    {{/if}}
    <section class="description">{{{ description.value }}}</section>
    <ul class="pills">
        {{#each properties}}
        <li class="pill transparent">
            <span class="label">{{ this }}</span>
        </li>
        {{/each}}
    </ul>
    {{#if controlHints}}
    <div class="control-hint lock-hint">
        <img src="systems/dnd5e/icons/svg/mouse-middle.svg" alt="{{ localize "DND5E.Controls.MiddleClick" }}">
        <span>{{ localize "DND5E.Controls.LockHint" }}</span>
    </div>
    {{/if}}
</section>
```

For weapons like your Greataxe, it includes the weapon-block partial on line 44.

### 6. Weapon Stats Rendering

The weapon-specific stats come from the `weapon-block.hbs` partial:

```1:46:templates/tooltips/weapon-block.hbs
<ul class="weapon-block unlist {{#if fullWidth}}full-width{{/if}}">
    <li>
        <strong>{{ localize "DND5E.ItemActionType" }}:</strong>
        <span class="value">{{ labels.activation }}</span>
    </li>
    {{#if labels.attacks.length}}
    <li>
        <strong>{{ localize "DND5E.Attack" }}:</strong>
        <span class="value">
            {{#each labels.attacks as | attack |}}
                {{ attack.toHit }}
                {{#unless @last}}|{{/unless}}
            {{/each}}
        </span>
    </li>
    {{/if}}
    {{#if enrichDamage}}
    <li>
        <strong>{{ localize "DND5E.Damage" }}:</strong>
        <span class="value">
            {{{enrichDamage.value}}}
            {{!-- {{#each labels.damages as | damage |}}
                [[/damage {{damage.formula}}{{#if damage.damageType}} type={{damage.damageType}}{{/if}}]]
                {{#unless @last}}|{{/unless}}
            {{/each}} --}}
        </span>
    </li>
    {{/if}}
    {{#if labels.reach}}
        <li>
            <strong>{{ localize "DND5E.Item.Property.Reach" }}:</strong>
            <span class="value">{{ labels.reach }}</span>
        </li>
    {{/if}}
    {{#if labels.range}}
        <li>
            <strong>{{ localize "DND5E.Range" }}:</strong>
            <span class="value">{{ labels.range }}</span>
        </li>
    {{/if}}
    {{!-- <li>
        <strong>{{ localize "DND5E.Price" }}:</strong>
        <span class="value">{{ price.value }}{{ price.denomination }}</span>
    </li> --}}
</ul>
```

This generates the Action Type, Attack, Damage, and Reach sections you see in your tooltip.

### 7. Enhanced Damage Display

The module includes special handling for damage ranges when enabled:

```150:179:scripts/managers/TooltipManager.js
_tooltipRangeDamage() {        
    const stringNames = [
        "attack", "award", "check", "concentration", "damage", "heal", "healing", "item", "save", "skill", "tool"
    ],
    pattern = new RegExp(`\\[\\[/(?<type>${stringNames.join("|")})(?<config> .*?)?]](?!])(?:{(?<label>[^}]+)})?`, "gi"),
    damageEnricher = this.enrichers.find(e => e.pattern.toString() == pattern.toString());
    if(damageEnricher) {
        const prevEnricher = damageEnricher.enricher;
        damageEnricher.id = 'damageEnricher';
        damageEnricher.enricher = async function(match, options) {
            const formatted = await prevEnricher(match, options);
            let { type, config, label } = match.groups;
            if(['damage', 'heal', 'healing'].includes(type)) {
                const rollLink = formatted.querySelector('.roll-link');
                if(rollLink) {
                    const dataFormulas = formatted.dataset.formulas;
                    if(dataFormulas) {
                        const minRoll = Roll.create(dataFormulas).evaluate({ minimize: true }),
                            maxRoll = Roll.create(dataFormulas).evaluate({ maximize: true }),
                            textContent = `${Math.floor((await minRoll).total)}-${Math.ceil((await maxRoll).total)}`;
                        rollLink.innerHTML = rollLink.innerHTML.replace(dataFormulas, textContent)
                    }
                }
            }
            return formatted;
        }
    }
}
```

This can replace damage dice with min-max ranges when the setting is enabled.

### 8. CSS Styling

The tooltip styling comes from:

```1:72:styles/components/tooltip.css
:is(#tooltip, .locked-tooltip).dnd5e-tooltip.bg3-tooltip {
    /* background-color: var(--bg3-background-color);
    color: var(--bg3-text-color);
    border-color: var(--bg3-border-color);
    border-width: var(--bg3-border-size); */
}
```

Plus responsive styles based on settings like light tooltip mode.

### Complete Flow Summary

1. **Component Setup**: ItemButton/GridCell sets `dataTooltip: {type: 'advanced'}`
2. **Element Preparation**: `setTooltip()` adds `data-tooltip` with UUID and CSS classes
3. **Foundry Trigger**: User hovers, Foundry detects `data-uuid` in tooltip content
4. **Template Override**: BG3 template is used instead of default
5. **Data Preparation**: Item's `getCardData()` prepares all tooltip data
6. **Template Rendering**: Main template renders with weapon-block partial for weapons
7. **Enrichment**: Damage formulas are enriched with clickable roll links
8. **Final Display**: CSS styling creates the BG3-themed appearance