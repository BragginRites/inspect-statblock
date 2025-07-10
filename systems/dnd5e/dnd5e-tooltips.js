const MODULE_ID = 'inspect-statblock';

/**
 * Manages enhanced tooltips for the D&D 5e system in inspect-statblock module
 */
export class Dnd5eTooltipManager {
    constructor() {
        this.initialized = false;
        this.savedMethods = {};
        this._init();
    }

    _init() {       
        game.dnd5e.dataModels.ItemDataModel.ITEM_TOOLTIP_TEMPLATE = 
            `modules/${MODULE_ID}/systems/dnd5e/templates/tooltips/item-tooltip.hbs`;
        
        // Override richTooltip method with context detection (v4.x style)
        this._overrideItemTooltip();
        
        // Override ActiveEffect tooltip if available
        this._overrideActiveEffectTooltip();
        
        this._overrideDismissLockedTooltips();
        
        this._setupBodyEventHandlers();
        
        this.initialized = true;
    }

    _overrideItemTooltip() {
        // Save original method
        this.savedMethods.itemRichTooltip = CONFIG.Item.documentClass.prototype.richTooltip;
        
        // Override with context detection - use original tooltip but add our class
        CONFIG.Item.documentClass.prototype.richTooltip = async function(enrichmentOptions = {}) {
            const manager = game.modules.get(MODULE_ID)?.api?.tooltipManager;
            
            if (manager && manager._isFromInspectStatblock(this)) {
                // Use original tooltip but add our class for inspect-statblock tooltips
                try {
                    const originalTooltip = await manager.savedMethods.itemRichTooltip.call(this, enrichmentOptions);
                    
                    // Just add our class to the original tooltip
                    return {
                        content: originalTooltip.content,
                        classes: [...(originalTooltip.classes || []), "inspect-statblock-tooltip"]
                    };
                } catch (error) {
                    console.error(`${MODULE_ID} | Error rendering enhanced tooltip:`, error);
                    // Fallback to original
                    return manager.savedMethods.itemRichTooltip.call(this, enrichmentOptions);
                }
            }
            
            // Use original for non-inspect-statblock tooltips
            return manager.savedMethods.itemRichTooltip.call(this, enrichmentOptions);
        };
    }

    _overrideActiveEffectTooltip() {
        // Check if ActiveEffect has richTooltip method
        if (CONFIG.ActiveEffect?.documentClass?.prototype?.richTooltip) {
            this.savedMethods.effectRichTooltip = CONFIG.ActiveEffect.documentClass.prototype.richTooltip;
            
            CONFIG.ActiveEffect.documentClass.prototype.richTooltip = async function(enrichmentOptions = {}) {
                const manager = game.modules.get(MODULE_ID)?.api?.tooltipManager;
                
                if (manager && manager._isFromInspectStatblock(this)) {
                    // Use enhanced template for inspect-statblock tooltips
                    try {
                        const data = {
                            effect: {
                                name: this.name,
                                img: this.icon,
                                description: this.description || this.name,
                                duration: this.duration,
                                origin: this.origin,
                                changes: this.changes
                            },
                            controlHints: true,
                            isInspectStatblock: true,
                            config: CONFIG.DND5E
                        };
                        
                        const content = await renderTemplate(
                            `modules/${MODULE_ID}/systems/dnd5e/templates/tooltips/effect-tooltip.hbs`, 
                            data
                        );
                        
                        return {
                            content,
                            classes: ["dnd5e2", "dnd5e-tooltip", "inspect-statblock-tooltip"]
                        };
        } catch (error) {
                        console.error(`${MODULE_ID} | Error rendering enhanced effect tooltip:`, error);
                        // Fallback to original
                        return manager.savedMethods.effectRichTooltip.call(this, enrichmentOptions);
                    }
                }
                
                // Use original for non-inspect-statblock tooltips
                return manager.savedMethods.effectRichTooltip.call(this, enrichmentOptions);
            };
        }
    }

    _overrideDismissLockedTooltips() {
        const oldDismiss = TooltipManager.prototype.dismissLockedTooltips;
        TooltipManager.prototype.dismissLockedTooltips = function() {
            if(!this.tooltip.classList.contains('inspect-statblock-tooltip')) {
                oldDismiss.bind(this)();
            }
            // If it contains inspect-statblock-tooltip, do nothing (don't dismiss)
        };
    }

    _setupBodyEventHandlers() {
        $('body').on('mousedown', '.locked-tooltip.inspect-statblock-tooltip', this._handleMouseDown.bind(this));
        
        $('body').on('contextmenu', '.locked-tooltip.inspect-statblock-tooltip', (e) => {
            e.preventDefault();
            $(e.currentTarget).fadeOut(200, () => {
                $(e.currentTarget).remove();
            });
            return false;
        });

        // Middle-click to pin - add to regular tooltips
        $('body').on('mousedown', '.dnd5e-tooltip.inspect-statblock-tooltip:not(.locked-tooltip)', (e) => {
            if (e.which === 2) { // Middle click
                e.preventDefault();
                e.stopPropagation();
                this._pinTooltip($(e.currentTarget));
            }
        });
    }

    _pinTooltip($tooltipContent) {
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] === PINNING TOOLTIP DEBUG START ===`);
        
        // Get the current tooltip wrapper
        const $currentWrapper = $tooltipContent.closest('#tooltip');
        if (!$currentWrapper.length) {
            console.log(`${MODULE_ID} | [TOOLTIP DEBUG] No tooltip wrapper found`);
            return;
        }

        // EXTENSIVE DEBUGGING - let's see what's happening
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Current wrapper element:`, $currentWrapper[0]);
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Current wrapper CSS:`, $currentWrapper.css(['position', 'left', 'top', 'bottom', 'right', 'transform', 'margin']));
        
        // Store current position BEFORE cloning
        const currentPosition = $currentWrapper.offset();
        const currentCSS = $currentWrapper.css(['position', 'left', 'top', 'bottom', 'right', 'transform', 'margin-top', 'margin-left']);
        
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Current position via offset():`, currentPosition);
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Current wrapper computed CSS:`, currentCSS);
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Viewport position:`, $currentWrapper.position());
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Window scroll:`, { scrollTop: $(window).scrollTop(), scrollLeft: $(window).scrollLeft() });
        
        // Clone the tooltip wrapper
        const $clonedWrapper = $currentWrapper.clone(true, true);
        
        // Modify the clone to make it a locked tooltip
        $clonedWrapper.removeAttr('id');
        $clonedWrapper.addClass('locked-tooltip');
        $clonedWrapper.attr('data-locked', 'true');
        
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Cloned wrapper classes:`, $clonedWrapper.attr('class'));
        
        // CRITICAL: Clear ALL positioning styles first, then set our own
        $clonedWrapper.css({
            position: '',
            left: '',
            top: '',
            bottom: '',
            right: '',
            transform: '',
            'margin-top': '',
            'margin-left': '',
            'margin-bottom': '',
            'margin-right': ''
        });
        
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] After clearing styles:`, $clonedWrapper.css(['position', 'left', 'top', 'bottom', 'right', 'transform', 'margin']));
        
        // Now set the position to match the current position
        $clonedWrapper.css({
            position: 'fixed',
            left: currentPosition.left + 'px',
            top: currentPosition.top + 'px',
            zIndex: 1000
        });
        
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] After setting position:`, $clonedWrapper.css(['position', 'left', 'top', 'bottom', 'right', 'transform', 'margin']));
        
        // Append to body
        $('body').append($clonedWrapper);
        
        // Check the final position after appending
        setTimeout(() => {
            const finalPosition = $clonedWrapper.offset();
            const finalCSS = $clonedWrapper.css(['position', 'left', 'top', 'bottom', 'right', 'transform', 'margin']);
            console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Final position after appending:`, finalPosition);
            console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Final CSS after appending:`, finalCSS);
            console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Position difference:`, {
                leftDiff: finalPosition.left - currentPosition.left,
                topDiff: finalPosition.top - currentPosition.top
            });
        }, 100);
        
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] === PINNING TOOLTIP DEBUG END ===`);
    }

    _handleMouseDown(e) {
        if (e.which !== 1) return; // Only left click for dragging
        
            e.preventDefault();
            const tooltip = {};
            tooltip.pageX0 = e.pageX;
            tooltip.pageY0 = e.pageY;
        tooltip.elem = e.currentTarget;
        tooltip.offset0 = $(e.currentTarget).offset();
            tooltip.moved = false;

        const handleDragging = (e) => {
                e.preventDefault();
                const left = tooltip.offset0.left + (e.pageX - tooltip.pageX0);
                const top = tooltip.offset0.top + (e.pageY - tooltip.pageY0);
                if (!tooltip.moved) {
                    tooltip.elem.style.removeProperty('bottom');
                    tooltip.moved = true;
                }
                $(tooltip.elem).offset({ top: top, left: left });
        };

        const handleMouseUp = (e) => {
                e.preventDefault();
            $(document)
                .off('mousemove.tooltip-drag')
                .off('mouseup.tooltip-drag');
        };

        $(document)
            .on('mouseup.tooltip-drag', handleMouseUp)
            .on('mousemove.tooltip-drag', handleDragging);
    }

    _isFromInspectStatblock(document) {
        // Check if the document's actor is currently being displayed in an inspect-statblock
        if (!document.actor) return false;
        
        // Look for inspect-statblock applications that contain this actor
        const inspectApps = Object.values(ui.windows).filter(app => 
            app.constructor.name === 'InspectStatblockApp' && app.actor?.id === document.actor.id
        );
        
        return inspectApps.length > 0;
    }

    /**
     * Initialize the tooltip manager
     */
    static initialize() {
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Dnd5eTooltipManager.initialize() called.`);
        if (!game.system || game.system.id !== 'dnd5e') {
            console.log(`${MODULE_ID} | [TOOLTIP DEBUG] System is not dnd5e. Aborting initialization.`);
            return;
        }

        const manager = new Dnd5eTooltipManager();
        
        // Expose manager globally for access from overridden methods
        if (!game.modules.get(MODULE_ID).api) {
            game.modules.get(MODULE_ID).api = {};
        }
        game.modules.get(MODULE_ID).api.tooltipManager = manager;
        
        console.log(`${MODULE_ID} | [TOOLTIP DEBUG] Dnd5eTooltipManager initialized successfully.`);
    }

    /**
     * Restore original methods (for cleanup if needed)
     */
    restoreOriginalMethods() {
        try {
            if (this.savedMethods.itemRichTooltip) {
                CONFIG.Item.documentClass.prototype.richTooltip = this.savedMethods.itemRichTooltip;
            }
            
            if (this.savedMethods.effectRichTooltip) {
                CONFIG.ActiveEffect.documentClass.prototype.richTooltip = this.savedMethods.effectRichTooltip;
            }
        } catch (error) {
            console.error(`${MODULE_ID} | Error restoring original tooltip methods:`, error);
        }
    }
}

// Export for module use
export default Dnd5eTooltipManager; 