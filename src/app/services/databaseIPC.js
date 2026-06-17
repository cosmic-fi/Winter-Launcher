// @ts-nocheck
/**
 * IPC-based database service for renderer process
 * Communicates with main process database service via IPC
 */

class DatabaseIPCService {
    constructor() {
        // Ensure we're in a browser environment with electron IPC
        if (typeof window !== 'undefined' && window.electron) {
            this.ipc = window.electron;
        } else {
            console.warn('Electron IPC not available');
        }
    }

    /**
     * Call IPC method with error handling
     * @param {string} method - IPC method name
     * @param {...any} args - Method arguments
     * @returns {Promise<any>} - Result data
     */
    async callIPC(method, ...args) {
        if (!this.ipc) {
            throw new Error('IPC not available');
        }



        try {
            const result = await this.ipc.invoke(method, ...args);
            if (result.success) {
                return result;
            } else {
                throw new Error(result.error || 'IPC call failed');
            }
        } catch (error) {
            console.error(`IPC call ${method} failed:`, error);
            throw error;
        }
    }

    // Instance methods
    async getInstances() {
        const result = await this.callIPC('db-get-instances');
        return result.instances;
    }

    async getInstance(id) {
        const result = await this.callIPC('db-get-instance', id);
        return result.instance;
    }

    async createInstance(instanceData) {
        const result = await this.callIPC('db-create-instance', instanceData);
        return result.instance;
    }

    async updateInstance(id, updates) {
        await this.callIPC('db-update-instance', id, updates);
    }

    async deleteInstance(id) {
        await this.callIPC('db-delete-instance', id);
    }

    async getActiveInstance() {
        const result = await this.callIPC('db-get-active-instance');
        return result.instance;
    }

    async setActiveInstance(id) {
        await this.callIPC('db-set-active-instance', id);
    }

    // Mod methods
    async getInstanceMods(instanceId) {
        const result = await this.callIPC('db-get-instance-mods', instanceId);
        return result.mods;
    }

    async addMod(modData) {
        console.log('[DATABASE IPC] addMod called with:', JSON.stringify(modData, null, 2));
        const result = await this.callIPC('db-add-mod', modData);
        return result.mod;
    }

    async updateMod(id, updates) {
        await this.callIPC('db-update-mod', id, updates);
    }

    async getMod(id) {
        const result = await this.callIPC('db-get-mod', id);
        return result.mod;
    }

    async deleteMod(id) {
        await this.callIPC('db-delete-mod', id);
    }

    // Resource pack methods
    async getInstanceResourcePacks(instanceId) {
        const result = await this.callIPC('db-get-instance-resource-packs', instanceId);
        return result.resourcePacks;
    }

    async addResourcePack(resourcePackData) {
        const result = await this.callIPC('db-add-resource-pack', resourcePackData);
        return result.resourcePack;
    }

    async updateResourcePack(id, updates) {
        await this.callIPC('db-update-resource-pack', id, updates);
    }

    async getResourcePack(id) {
        const result = await this.callIPC('db-get-resource-pack', id);
        return result.resourcePack;
    }

    async deleteResourcePack(id) {
        await this.callIPC('db-delete-resource-pack', id);
    }

    // Shader methods
    async getInstanceShaders(instanceId) {
        const result = await this.callIPC('db-get-instance-shaders', instanceId);
        return result.shaders;
    }

    async addShader(shaderData) {
        const result = await this.callIPC('db-add-shader', shaderData);
        return result.shader;
    }

    async updateShader(id, updates) {
        await this.callIPC('db-update-shader', id, updates);
    }

    async getShader(id) {
        const result = await this.callIPC('db-get-shader', id);
        return result.shader;
    }

    async deleteShader(id) {
        await this.callIPC('db-delete-shader', id);
    }

    // Clear instance modpack data methods
    async clearInstanceMods(instanceId) {
        const result = await this.callIPC('db-clear-instance-mods', instanceId);
        return result;
    }

    async clearInstanceResourcePacks(instanceId) {
        const result = await this.callIPC('db-clear-instance-resource-packs', instanceId);
        return result;
    }

    async clearInstanceShaderPacks(instanceId) {
        const result = await this.callIPC('db-clear-instance-shader-packs', instanceId);
        return result;
    }

    // Generate unique ID (same as original)
    generateId() {
        return Date.now().toString(36) + Math.random().toString(36).substr(2);
    }

    // Force migrate instance paths to correct app data directory
    async forceMigrateInstancePaths() {
        const result = await this.callIPC('db-force-migrate-instance-paths');
        return result;
    }
}

// Create singleton instance
const databaseIPCService = new DatabaseIPCService();

export default databaseIPCService;
