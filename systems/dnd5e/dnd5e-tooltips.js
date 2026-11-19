/**
 * @fileoverview Pinned tooltips for statblock entries.
 *
 * Statblock entries use dnd5e's own rich tooltips (data-tooltip with a loading
 * section and the document uuid), so content always matches the installed dnd5e
 * version. This file only adds:
 * - middle-click to pin a tooltip (or take over the one core/dnd5e locked),
 * - drag to move a pinned tooltip,
 * - right-click to dismiss it.
 * Pinned tooltips survive core's "dismiss locked tooltips" (e.g. clicking the canvas).
 */

import { log } from '../../src/core/logger.js';

const TOOLTIP_CLASS = 'inspect-statblock-tooltip';
const PIN_CLASS = 'inspect-statblock-pinned';

/** Time of the last pin, to avoid pinning twice when core/dnd5e also locks on middle-click. */
let lastPinAt = 0;

/**
 * Turn a tooltip element into a free-floating pinned copy at the same position.
 * @param {HTMLElement} source - #tooltip or a core locked tooltip.
 * @param {boolean} replace - Replace the source element instead of copying it.
 */
function _pin(source, replace) {
    const rect = source.getBoundingClientRect();
    const pinned = source.cloneNode(true);
    pinned.removeAttribute('id');
    pinned.classList.remove('active');
    pinned.classList.add('locked-tooltip', PIN_CLASS);
    Object.assign(pinned.style, {
        position: 'fixed',
        left: `${rect.left}px`,
        top: `${rect.top}px`,
        right: 'auto',
        bottom: 'auto',
        margin: '0',
        transform: 'none'
    });
    if (replace) source.replaceWith(pinned);
    else document.body.append(pinned);
    lastPinAt = performance.now();
}

function _onPointerDown(event) {
    // Middle-click while one of our tooltips is showing: pin it, unless core or
    // dnd5e locks it themselves (the observer then takes that copy over).
    if (event.button === 1) {
        const tooltip = document.getElementById('tooltip');
        if (!tooltip?.classList.contains(TOOLTIP_CLASS) || !tooltip.classList.contains('active')) return;
        event.preventDefault();
        setTimeout(() => {
            if (performance.now() - lastPinAt > 100) _pin(tooltip, false);
        }, 0);
        return;
    }

    // Left-drag a pinned tooltip.
    if (event.button !== 0) return;
    const pinned = event.target.closest?.(`.${PIN_CLASS}`);
    if (!pinned || event.target.closest('a, button, input, select, textarea')) return;
    event.preventDefault();

    const startX = event.clientX;
    const startY = event.clientY;
    const startLeft = parseFloat(pinned.style.left) || pinned.getBoundingClientRect().left;
    const startTop = parseFloat(pinned.style.top) || pinned.getBoundingClientRect().top;

    const onMove = moveEvent => {
        pinned.style.left = `${startLeft + moveEvent.clientX - startX}px`;
        pinned.style.top = `${startTop + moveEvent.clientY - startY}px`;
    };
    const onUp = () => {
        document.removeEventListener('pointermove', onMove);
        document.removeEventListener('pointerup', onUp);
    };
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
}

function _onContextMenu(event) {
    const pinned = event.target.closest?.(`.${PIN_CLASS}`);
    if (!pinned) return;
    event.preventDefault();
    event.stopPropagation();
    pinned.remove();
}

/**
 * Take over locked tooltips that core/dnd5e create from our tooltips, so they get
 * drag and right-click handling and aren't removed by dismissLockedTooltips.
 */
function _observeLockedTooltips() {
    const observer = new MutationObserver(mutations => {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (!(node instanceof HTMLElement)) continue;
                const { classList } = node;
                if (classList.contains('locked-tooltip') && classList.contains(TOOLTIP_CLASS) && !classList.contains(PIN_CLASS)) {
                    _pin(node, true);
                }
            }
        }
    });
    observer.observe(document.body, { childList: true });
}

/**
 * Keep pinned tooltips when core dismisses locked tooltips. Wraps the method on the
 * game.tooltip instance only (no prototype patching), hiding our pins from it.
 */
function _protectPinsFromDismissal() {
    const manager = game.tooltip;
    if (typeof manager?.dismissLockedTooltips !== 'function') return;
    const original = manager.dismissLockedTooltips;
    manager.dismissLockedTooltips = function (...args) {
        const pins = Array.from(document.querySelectorAll(`.${PIN_CLASS}`));
        pins.forEach(pin => pin.classList.remove('locked-tooltip'));
        try {
            return original.apply(this, args);
        } finally {
            pins.forEach(pin => {
                if (!pin.isConnected) document.body.append(pin);
                pin.classList.add('locked-tooltip');
            });
        }
    };
}

export const Dnd5eTooltipManager = {
    initialize() {
        document.addEventListener('pointerdown', _onPointerDown, { capture: true });
        document.addEventListener('contextmenu', _onContextMenu, { capture: true });
        _observeLockedTooltips();
        _protectPinsFromDismissal();
        log.debug('Tooltip pinning initialized.');
    }
};

Hooks.once('ready', () => {
    // The pinning code is system-neutral; pf2e statblock tooltips use it too.
    if (['dnd5e', 'pf2e'].includes(game.system.id)) Dnd5eTooltipManager.initialize();
});

export default Dnd5eTooltipManager;
