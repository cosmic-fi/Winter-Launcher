//@ts-nocheck
/**
 * Universal Instance Data Structure
 * Standardizes instance creation for both regular instances
 * Provides default values and type safety
 * 
 * This implementation follows the unified design from UNIFIED_INSTANCE_DESIGN.md
 */

/**
 * Default values for instance properties
 */
export const INSTANCE_DEFAULTS = {
    // Basic Info
    id: '',
    name: '',
    path: null,
    icon: null,
    description: '',
    
    // Game Configuration
    gameVersion: '',
    loader: '', // vanilla, forge, fabric, quilt, neoforge
    loaderVersion: '',
    
    // Java Configuration
    javaPath: null,
    memoryMin: 1024,
    memoryMax: 4096,
    jvmArgs: '',
    gameArgs: '',
    
    // Status
    isActive: false,
    createdAt: null,
    lastPlayed: null,
    
    // Unified Type System - replaces isModpack boolean
    instanceType: 'vanilla', // vanilla, manual_modded, imported
    
    // Content Tracking
    content: {
        mods: [],
        resourcePacks: [],
        shaders: [],
        configs: []
    }
};

/**
 * Instance type definitions for better IDE support
 */

/**
 * @typedef {Object} ContentData
 * @property {Array} mods - List of installed mods
 * @property {Array} resourcePacks - List of installed resource packs
 * @property {Array} shaders - List of installed shaders
 * @property {Array} configs - List of configuration files
 */

/**
 * @typedef {Object} BaseInstance
 * @property {string} id - Unique instance identifier
 * @property {string} name - Instance name
 * @property {string|null} path - Instance directory path
 * @property {string|null} icon - Path to icon file
 * @property {string} description - Instance description
 * @property {string} gameVersion - Minecraft version
 * @property {string} loader - Mod loader (vanilla, forge, fabric, quilt, neoforge)
 * @property {string} loaderVersion - Loader version
 * @property {string|null} javaPath - Java executable path
 * @property {number} memoryMin - Minimum memory allocation (MB)
 * @property {number} memoryMax - Maximum memory allocation (MB)
 * @property {string} jvmArgs - JVM arguments
 * @property {string} gameArgs - Game arguments
 * @property {boolean} isActive - Whether instance is currently active
 * @property {Date|null} createdAt - Creation timestamp
 * @property {Date|null} lastPlayed - Last played timestamp
 * @property {'vanilla'|'manual_modded'|'imported'} instanceType - Instance type
 * @property {ContentData} content - Content tracking
 */

/**
 * Creates a validated instance object with default values
 * @param {Partial<BaseInstance>} instanceData - Instance data to create
 * @returns {BaseInstance} Validated instance with defaults applied
 */
export function createInstance(instanceData = {}) {
    // Start with all defaults
    const instance = { ...INSTANCE_DEFAULTS };
    
    // Apply provided data
    Object.keys(instanceData).forEach(key => {
        if (key in instance) {
            instance[key] = instanceData[key];
        } else {
            console.warn(`Unknown instance property: ${key}`);
        }
    });
    
    // Generate ID if not provided
    if (!instance.id) {
        instance.id = generateInstanceId();
    }
    
    // Set timestamps
    if (!instance.createdAt) {
        instance.createdAt = new Date();
    }
    
    return instance;
}

/**
 * Creates a vanilla instance
 * @param {Object} data - Instance data
 * @returns {BaseInstance} Vanilla instance
 */
export function createVanillaInstance(data) {
    return createInstance({
        ...data,
        instanceType: 'vanilla',
        content: {
            mods: [],
            resourcePacks: [],
            shaders: [],
            configs: []
        }
    });
}

/**
 * Creates a manual modded instance
 * @param {Object} data - Instance data
 * @returns {BaseInstance} Manual modded instance
 */
export function createManualModdedInstance(data) {
    return createInstance({
        ...data,
        instanceType: 'manual_modded'
    });
}

/**
 * Creates an imported instance
 * @param {Object} data - Instance data
 * @returns {BaseInstance} Imported instance
 */
export function createImportedInstance(data) {
    return createInstance({
        ...data,
        instanceType: 'imported'
    });
}



/**
 * Converts instance data for database storage (camelCase to snake_case)
 * @param {BaseInstance} instance - Instance object
 * @returns {Object} Database-ready instance data
 */
export function instanceToDatabase(instance) {
    return {
        id: instance.id,
        name: instance.name,
        path: instance.path,
        icon: instance.icon,
        game_version: instance.gameVersion,
        loader: instance.loader,
        loader_version: instance.loaderVersion,
        description: instance.description,
        java_path: instance.javaPath,
        memory_min: instance.memoryMin,
        memory_max: instance.memoryMax,
        jvm_args: instance.jvmArgs,
        game_args: instance.gameArgs,
        is_active: instance.isActive,
        last_played: instance.lastPlayed,
        created_at: instance.createdAt,
        instance_type: instance.instanceType,
        content_data: JSON.stringify(instance.content)
    };
}

/**
 * Converts database data to instance object (snake_case to camelCase)
 * @param {Object} dbData - Database instance data
 * @returns {BaseInstance} Instance object
 */
export function databaseToInstance(dbData) {
    const instance = {
        id: dbData.id,
        name: dbData.name,
        path: dbData.path,
        icon: dbData.icon,
        gameVersion: dbData.game_version,
        loader: dbData.loader,
        loaderVersion: dbData.loader_version,
        description: dbData.description,
        javaPath: dbData.java_path,
        memoryMin: dbData.memory_min,
        memoryMax: dbData.memory_max,
        jvmArgs: dbData.jvm_args,
        gameArgs: dbData.game_args,
        isActive: Boolean(dbData.is_active),
        lastPlayed: dbData.last_played,
        createdAt: dbData.created_at,
        instanceType: dbData.instance_type || 'vanilla',
        content: dbData.content_data ? JSON.parse(dbData.content_data) : {
            mods: [],
            resourcePacks: [],
            shaders: [],
            configs: []
        }
    };
    
    return createInstance(instance);
}

/**
 * Generates a unique instance ID
 * @returns {string} Instance ID
 */
function generateInstanceId() {
    return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}