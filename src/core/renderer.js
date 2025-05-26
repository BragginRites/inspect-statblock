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

  // Check if system handler provided a specific layout template
  const templatePath = sidsData.systemSpecificLayoutTemplate || 'modules/inspect-statblock/templates/core_statblock_layout.hbs';
  
  console.log(`InspectStatblock | renderStatblockFromSIDS: Using template: ${templatePath}`);

  try {
    return await renderTemplate(templatePath, sidsData);
  } catch (error) {
    console.error(`InspectStatblock | renderStatblockFromSIDS: Error rendering template ${templatePath}:`, error);
    // Fallback to core template if system template fails
    if (sidsData.systemSpecificLayoutTemplate) {
      console.warn(`InspectStatblock | renderStatblockFromSIDS: Falling back to core template due to error with system template.`);
      return await renderTemplate('modules/inspect-statblock/templates/core_statblock_layout.hbs', sidsData);
    }
    return '<p>Error: Failed to render statblock template.</p>';
  }
}

// All individual _render<SectionName> functions are no longer needed here as their
// logic is either in the specific partials or within core_statblock_layout.hbs (like loops).
