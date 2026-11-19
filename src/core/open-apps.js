/**
 * @fileoverview Lookup of open statblock windows (ApplicationV2 instances live in
 * foundry.applications.instances, not ui.windows).
 */

/**
 * @returns {ApplicationV2[]} All InspectStatblockApp instances currently tracked by Foundry.
 */
export function getStatblockApps() {
    const instances = foundry.applications?.instances;
    if (!instances) return [];
    return Array.from(instances.values()).filter(app => app?.constructor?.isInspectStatblockApp);
}

/**
 * Re-render open statblock windows.
 * @param {(app: ApplicationV2) => boolean} [predicate] - Only refresh apps that match.
 */
export function refreshOpenStatblocks(predicate = () => true) {
    for (const app of getStatblockApps()) {
        if (app.rendered && predicate(app)) app.render();
    }
}
