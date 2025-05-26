/**
 * @fileoverview System Handler Registry for Inspect Statblock module.
 * Manages registration and discovery of system-specific handlers.
 */

const MODULE_ID = 'inspect-statblock';

/**
 * Registry for managing system-specific handlers.
 * Provides a centralized way to register and retrieve handlers for different game systems.
 */
export class SystemHandlerRegistry {
    constructor() {
        /**
         * Map of system IDs to their corresponding handler instances.
         * @type {Map<string, object>}
         * @private
         */
        this.handlers = new Map();
    }

    /**
     * Registers a system handler for a specific game system.
     * @param {string} systemId - The game system ID (e.g., 'dnd5e', 'pf2e').
     * @param {object} handler - The system handler instance implementing the SystemHandler interface.
     * @throws {Error} If systemId or handler is invalid.
     */
    register(systemId, handler) {
        if (!systemId || typeof systemId !== 'string') {
            throw new Error(`${MODULE_ID} | SystemHandlerRegistry.register: systemId must be a non-empty string.`);
        }

        if (!handler || typeof handler !== 'object') {
            throw new Error(`${MODULE_ID} | SystemHandlerRegistry.register: handler must be a valid object.`);
        }

        // Validate that handler implements required methods
        const requiredMethods = ['getStandardizedActorData', 'getSystemSectionDefinitions'];
        const missingMethods = requiredMethods.filter(method => typeof handler[method] !== 'function');
        
        if (missingMethods.length > 0) {
            throw new Error(`${MODULE_ID} | SystemHandlerRegistry.register: handler for ${systemId} is missing required methods: ${missingMethods.join(', ')}`);
        }

        if (this.handlers.has(systemId)) {
            console.warn(`${MODULE_ID} | SystemHandlerRegistry: Overwriting existing handler for system '${systemId}'.`);
        }

        this.handlers.set(systemId, handler);
        console.log(`${MODULE_ID} | SystemHandlerRegistry: Successfully registered handler for system '${systemId}'.`);
    }

    /**
     * Retrieves the handler for a specific game system.
     * @param {string} systemId - The game system ID to get the handler for.
     * @returns {object|null} The handler instance, or null if not found.
     */
    getHandler(systemId) {
        if (!systemId || typeof systemId !== 'string') {
            console.warn(`${MODULE_ID} | SystemHandlerRegistry.getHandler: Invalid systemId provided.`);
            return null;
        }

        const handler = this.handlers.get(systemId);
        if (!handler) {
            console.log(`${MODULE_ID} | SystemHandlerRegistry: No handler registered for system '${systemId}'.`);
        }
        
        return handler || null;
    }

    /**
     * Gets all registered handlers.
     * @returns {Array<{systemId: string, handler: object}>} Array of registered system handlers.
     */
    getAllHandlers() {
        return Array.from(this.handlers.entries()).map(([systemId, handler]) => ({
            systemId,
            handler
        }));
    }

    /**
     * Checks if a handler is registered for the given system.
     * @param {string} systemId - The game system ID to check.
     * @returns {boolean} True if a handler is registered, false otherwise.
     */
    hasHandler(systemId) {
        return this.handlers.has(systemId);
    }

    /**
     * Unregisters a system handler.
     * @param {string} systemId - The game system ID to unregister.
     * @returns {boolean} True if the handler was unregistered, false if it wasn't registered.
     */
    unregister(systemId) {
        const wasRegistered = this.handlers.delete(systemId);
        if (wasRegistered) {
            console.log(`${MODULE_ID} | SystemHandlerRegistry: Unregistered handler for system '${systemId}'.`);
        }
        return wasRegistered;
    }

    /**
     * Gets the count of registered handlers.
     * @returns {number} Number of registered handlers.
     */
    getHandlerCount() {
        return this.handlers.size;
    }

    /**
     * Gets a list of all registered system IDs.
     * @returns {Array<string>} Array of registered system IDs.
     */
    getRegisteredSystems() {
        return Array.from(this.handlers.keys());
    }
}

/**
 * Singleton instance of the SystemHandlerRegistry.
 * This should be used throughout the module for all system handler registration and retrieval.
 * @type {SystemHandlerRegistry}
 */
export const systemRegistry = new SystemHandlerRegistry();

// Log registry creation for debugging
console.log(`${MODULE_ID} | SystemHandlerRegistry: Registry initialized.`); 