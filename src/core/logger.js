/**
 * @fileoverview Small logger. Debug output is only printed when the
 * "Enable Debug Logging" client setting is on.
 */

import { MODULE_ID } from './constants.js';

const PREFIX = `${MODULE_ID} |`;
let debugEnabled = false;

/**
 * Turn debug logging on or off.
 * @param {boolean} enabled
 */
export function setDebugEnabled(enabled) {
    debugEnabled = !!enabled;
}

export const log = {
    debug: (...args) => { if (debugEnabled) console.debug(PREFIX, ...args); },
    info: (...args) => console.info(PREFIX, ...args),
    warn: (...args) => console.warn(PREFIX, ...args),
    error: (...args) => console.error(PREFIX, ...args)
};
