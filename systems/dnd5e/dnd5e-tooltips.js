/**
 * @file D&D 5e Tooltip Manager for Inspect Statblock
 * This file manages enhanced tooltips for active effects and passive features
 * in the inspect-statblock module, providing BG3-inspired rich tooltip functionality.
 */

const MODULE_ID = 'inspect-statblock';

/**
 * Manages enhanced tooltips for the D&D 5e system in inspect-statblock module
 */
export class Dnd5eTooltipManager {
    constructor() {
        this.initialized = false;
        this.originalTemplates = new Map();
    }

    /**
     * Initialize the tooltip manager
     */
    static initialize() {
        if (!game.system || game.system.id !== 'dnd5e') {
            console.warn(`${MODULE_ID} | Tooltip Manager: Not a D&D 5e system, skipping tooltip enhancements.`);
            return;
        }

        console.log(`${MODULE_ID} | Starting tooltip manager initialization...`);
        const manager = new Dnd5eTooltipManager();
        manager._setupHooks();
        manager._registerTemplateOverrides();
        manager.initialized = true;
        
        console.log(`${MODULE_ID} | D&D 5e Tooltip Manager initialized successfully.`);
        console.log(`${MODULE_ID} | Current active modules:`, game.modules.filter(m => m.active).map(m => m.id));
    }

    /**
     * Set up Foundry hooks for tooltip functionality
     * @private
     */
    _setupHooks() {
        // Hook for when the system is ready and we can override templates
        Hooks.once('ready', () => {
            this._applyTemplateOverrides();
        });

        // Hook for rendering tooltips (if we need custom processing)
        Hooks.on('renderTooltip', (tooltip, html, data) => {
            console.log(`${MODULE_ID} | 🔍 TOOLTIP RENDER HOOK TRIGGERED:`);
            console.log(`${MODULE_ID} | - Tooltip object:`, tooltip);
            console.log(`${MODULE_ID} | - HTML element:`, html);
            console.log(`${MODULE_ID} | - Data:`, data);
            console.log(`${MODULE_ID} | - HTML classes:`, html.attr('class'));
            console.log(`${MODULE_ID} | - UUID in data:`, data?.uuid);
            console.log(`${MODULE_ID} | - HTML content preview:`, html.html().substring(0, 200));
            this._onRenderTooltip(tooltip, html, data);
        });
    }

    /**
     * Register our custom tooltip templates with Foundry
     * @private
     */
    _registerTemplateOverrides() {
        // Store original templates before overriding
        if (game.dnd5e?.dataModels?.ItemDataModel?.ITEM_TOOLTIP_TEMPLATE) {
            this.originalTemplates.set('item', game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE);
        }

        // We'll set up the actual overrides in _applyTemplateOverrides once templates are loaded
    }

    /**
     * Apply template overrides once Foundry is fully ready
     * @private
     */
    _applyTemplateOverrides() {
        try {
            console.log(`${MODULE_ID} | 🔧 Applying template overrides...`);
            console.log(`${MODULE_ID} | - game.dnd5e exists:`, !!game.dnd5e);
            console.log(`${MODULE_ID} | - dataModels exists:`, !!game.dnd5e?.dataModels);
            console.log(`${MODULE_ID} | - ItemDataModel exists:`, !!game.dnd5e?.dataModels?.ItemDataModel);
            
            // Store original template before override
            if (game.dnd5e?.dataModels?.ItemDataModel?.ITEM_TOOLTIP_TEMPLATE) {
                const originalTemplate = game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE;
                this.originalTemplates.set('item', originalTemplate);
                console.log(`${MODULE_ID} | - Original item template stored:`, originalTemplate);
            }
            
            // Override item tooltip template for features
            if (game.dnd5e?.dataModels?.ItemDataModel) {
                const newTemplate = `modules/${MODULE_ID}/systems/dnd5e/templates/tooltips/feature-tooltip.hbs`;
                game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE = newTemplate;
                console.log(`${MODULE_ID} | ✅ Overrode D&D 5e item tooltip template to:`, newTemplate);
            } else {
                console.warn(`${MODULE_ID} | ❌ Could not override item tooltip template - ItemDataModel not available`);
            }

            // Check for Active Effect tooltip templates
            console.log(`${MODULE_ID} | - Checking ActiveEffect template options...`);
            console.log(`${MODULE_ID} | - CONFIG.ActiveEffect:`, CONFIG.ActiveEffect);
            
            // Note: ActiveEffect tooltips are handled differently in Foundry
            // We'll handle those through the renderTooltip hook or by modifying the effect data preparation

        } catch (error) {
            console.error(`${MODULE_ID} | ❌ Error applying tooltip template overrides:`, error);
        }
    }

    /**
     * Handle tooltip rendering for custom processing
     * @private
     */
    _onRenderTooltip(tooltip, html, data) {
        console.log(`${MODULE_ID} | 📝 Processing tooltip render...`);
        
        // Check if this is our tooltip or someone else's
        const currentClasses = html.attr('class') || '';
        const hasInspectClass = currentClasses.includes('inspect-statblock-tooltip');
        const hasDnd5eClass = currentClasses.includes('dnd5e-tooltip');
        const isBG3Tooltip = currentClasses.includes('bg3-tooltip');
        
        console.log(`${MODULE_ID} | - Has inspect class: ${hasInspectClass}`);
        console.log(`${MODULE_ID} | - Has dnd5e class: ${hasDnd5eClass}`);
        console.log(`${MODULE_ID} | - Is BG3 tooltip: ${isBG3Tooltip}`);
        console.log(`${MODULE_ID} | - Current classes: ${currentClasses}`);
        
        // ONLY process tooltips that already have our inspect-statblock-tooltip class
        // This prevents us from affecting other modules like BG3 hotbar
        if (!hasInspectClass) {
            console.log(`${MODULE_ID} | ⚠️ Skipping tooltip - not ours (no inspect-statblock-tooltip class)`);
            return;
        }
        
        console.log(`${MODULE_ID} | ✅ Processing our tooltip...`);

        // Handle Active Effects specifically since they don't use item templates
        if (data?.uuid && data.uuid.includes('ActiveEffect')) {
            console.log(`${MODULE_ID} | 🎭 Detected Active Effect tooltip: ${data.uuid}`);
            this._enhanceActiveEffectTooltip(html, data);
        } else if (data?.uuid) {
            console.log(`${MODULE_ID} | 📋 Detected Item tooltip: ${data.uuid}`);
        }

        // Handle any post-render processing here if needed
        this._enhanceTooltipContent(html, data);
    }

    /**
     * Enhance tooltip content after rendering
     * @private
     */
    _enhanceTooltipContent(html, data) {
        // Add loading states, enhance content, etc.
        // This is where we can add BG3-style enhancements
        
        // For now, just ensure our CSS classes are applied
        if (data?.uuid) {
            html.addClass('inspect-statblock-enhanced-tooltip');
        }
    }

    /**
     * Enhance Active Effect tooltips specifically
     * @private
     */
    _enhanceActiveEffectTooltip(html, data) {
        console.log(`${MODULE_ID} | 🎭 Enhancing Active Effect tooltip...`);
        console.log(`${MODULE_ID} | - Data UUID:`, data.uuid);
        
        // Active effects need special handling since they don't use the item template system
        try {
            const effect = fromUuidSync(data.uuid);
            console.log(`${MODULE_ID} | - Found effect:`, effect);
            console.log(`${MODULE_ID} | - Effect document name:`, effect?.documentName);
            
            if (effect && effect.documentName === 'ActiveEffect') {
                console.log(`${MODULE_ID} | ✅ Valid Active Effect - rendering enhanced tooltip`);
                // Replace the content with our enhanced template
                this._renderEnhancedEffectTooltip(html, effect);
            } else {
                console.warn(`${MODULE_ID} | ⚠️ Not a valid Active Effect:`, effect);
            }
        } catch (error) {
            console.error(`${MODULE_ID} | ❌ Error enhancing Active Effect tooltip:`, error);
        }
    }

    /**
     * Render enhanced effect tooltip content
     * @private
     */
    async _renderEnhancedEffectTooltip(html, effect) {
        try {
            console.log(`${MODULE_ID} | 🎨 Rendering enhanced effect tooltip for:`, effect.name);
            
            // Prepare data for our effect template
            const templateData = {
                name: effect.name,
                img: effect.icon,
                description: effect.description,
                duration: effect.duration,
                origin: effect.origin,
                changes: effect.changes,
                flags: effect.flags,
                controlHints: true
            };

            console.log(`${MODULE_ID} | - Template data prepared:`, templateData);

            // Render our custom template
            const templatePath = `modules/${MODULE_ID}/systems/dnd5e/templates/tooltips/effect-tooltip.hbs`;
            console.log(`${MODULE_ID} | - Rendering template:`, templatePath);
            
            const content = await renderTemplate(templatePath, templateData);
            
            console.log(`${MODULE_ID} | - Rendered content length:`, content.length);
            console.log(`${MODULE_ID} | - Content preview:`, content.substring(0, 200));

            // Replace the tooltip content
            html.html(content);
            html.addClass('inspect-statblock-tooltip effect-tooltip');
            
            console.log(`${MODULE_ID} | ✅ Enhanced effect tooltip rendered successfully`);
            
        } catch (error) {
            console.error(`${MODULE_ID} | ❌ Error rendering enhanced effect tooltip:`, error);
            console.error(`${MODULE_ID} | - Effect:`, effect);
            console.error(`${MODULE_ID} | - HTML element:`, html);
        }
    }

    /**
     * Restore original templates (for cleanup if needed)
     */
    restoreOriginalTemplates() {
        try {
            if (this.originalTemplates.has('item') && game.dnd5e?.dataModels?.ItemDataModel) {
                game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE = this.originalTemplates.get('item');
            }
            console.log(`${MODULE_ID} | Restored original tooltip templates.`);
        } catch (error) {
            console.error(`${MODULE_ID} | Error restoring original templates:`, error);
        }
    }
}

// Export for module use
export default Dnd5eTooltipManager; 