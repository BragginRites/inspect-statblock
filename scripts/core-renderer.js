/**
 * @fileoverview Core renderer for the Inspect Statblock module.
 * Takes Standardized Intermediate Data Structure (SIDS) and generates HTML.
 */

/**
 * Generates the HTML content for a statblock display from SIDS data.
 *
 * @param {SIDS.StandardizedStatblockData} sidsData - The standardized data object for the actor.
 * @returns {Promise<string>} A promise that resolves to the HTML string for the statblock content.
 */
export async function renderStatblockFromSIDS(sidsData) {
  if (!sidsData) {
    console.error('InspectStatblock | renderStatblockFromSIDS: sidsData is undefined.');
    return '<p>Error: No data provided to render statblock.</p>';
  }

  // All rendering logic is now deferred to the main layout template,
  // which will in turn call the various partials.
  return await renderTemplate('modules/inspect-statblock/templates/core_statblock_layout.hbs', sidsData);
}

// All individual _render<SectionName> functions are no longer needed here as their
// logic is either in the specific partials or within core_statblock_layout.hbs (like loops).
