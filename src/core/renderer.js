/**
 * @fileoverview Core renderer for the Inspect Statblock module.
 * Takes Standardized Intermediate Data Structure (SIDS) and generates HTML.
 */

import { MODULE_ID } from './constants.js';
import { log } from './logger.js';

const CORE_TEMPLATE = `modules/${MODULE_ID}/templates/core_statblock_layout.hbs`;

/**
 * Generates the HTML content for a statblock from SIDS data.
 * @param {SIDS.StandardizedStatblockData} sidsData
 * @returns {Promise<string>}
 */
export async function renderStatblockFromSIDS(sidsData) {
    const { renderTemplate } = foundry.applications.handlebars;
    if (!sidsData) return '<p>Error: No data provided to render statblock.</p>';

    const templatePath = sidsData.systemSpecificLayoutTemplate || CORE_TEMPLATE;
    try {
        return await renderTemplate(templatePath, sidsData);
    } catch (err) {
        log.error(`Error rendering template ${templatePath}:`, err);
        if (sidsData.systemSpecificLayoutTemplate) {
            return await renderTemplate(CORE_TEMPLATE, sidsData);
        }
        return '<p>Error: Failed to render statblock template.</p>';
    }
}
