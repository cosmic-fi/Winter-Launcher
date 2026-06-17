/**
 * Instance Creation Service
 * Centralized service for creating and managing instances
 * Provides consistent instance creation across the application
 * 
 * Uses the unified instance data structure from ../types/instance.js
 */

import { 
    createInstance, 
    createVanillaInstance, 
    createManualModdedInstance,
    createImportedInstance,
    instanceToDatabase 
} from '../types/instance.js';
import { logger } from '../utils/logger.js';

/**
 * Creates a new instance with proper validation and defaults
 * @param {Object} instanceData - Instance data
 * @param {Object} options - Creation options
 * @returns {Promise<Object>} Created instance
 */
export async function createNewInstance(instanceData, options = {}) {
    const { 
        type = 'vanilla', // 'vanilla', 'manual_modded', 'imported'
        validate = true,
        generateDefaults = true 
    } = options;
    
    logger.info(`Creating new ${type} instance`, { 
        name: instanceData.name,
        gameVersion: instanceData.gameVersion,
        loader: instanceData.loader 
    });
    
    try {
        let instance;
        
        // Create instance based on type
        switch (type) {
            case 'vanilla':
                instance = createVanillaInstance(instanceData);
                break;
            case 'manual_modded':
                instance = createManualModdedInstance(instanceData);
                break;
            case 'imported':
                instance = createImportedInstance(instanceData);
                break;
            default:
                throw new Error(`Unknown instance type: ${type}`);
        }
        
        // Validate instance data if requested
        if (validate) {
            validateInstance(instance);
        }
        
        // Generate additional defaults if requested
        if (generateDefaults) {
            await generateInstanceDefaults(instance);
        }
        
        logger.info('Instance created successfully', { 
            id: instance.id,
            name: instance.name,
            instanceType: instance.instanceType 
        });
        
        return instance;
        
    } catch (error) {
        logger.error('Failed to create instance', error);
        throw error;
    }
}

/**
 * Validates instance data
 * @param {Object} instance - Instance to validate
 * @throws {Error} If validation fails
 */
function validateInstance(instance) {
    const errors = [];
    
    // Required fields
    if (!instance.name || instance.name.trim().length === 0) {
        errors.push('Instance name is required');
    }
    
    if (!instance.gameVersion) {
        errors.push('Game version is required');
    }
    
    if (!instance.loader) {
        errors.push('Mod loader is required');
    }
    
    // Validate loader type
    const validLoaders = ['vanilla', 'fabric', 'forge', 'quilt', 'neoforge'];
    if (!validLoaders.includes(instance.loader.toLowerCase())) {
        errors.push(`Invalid loader: ${instance.loader}. Must be one of: ${validLoaders.join(', ')}`);
    }
    
    // Validate instance type
    const validTypes = ['vanilla', 'manual_modded', 'imported'];
    if (!validTypes.includes(instance.instanceType)) {
        errors.push(`Invalid instance type: ${instance.instanceType}. Must be one of: ${validTypes.join(', ')}`);
    }
    
    // Type-specific validation
    if (instance.instanceType === 'vanilla' && instance.loader !== 'vanilla') {
        errors.push('Vanilla instances must use vanilla loader');
    }
    
    // Memory validation
    if (instance.memoryMin < 512) {
        errors.push('Minimum memory must be at least 512 MB');
    }
    
    if (instance.memoryMax < instance.memoryMin) {
        errors.push('Maximum memory must be greater than or equal to minimum memory');
    }
    
    if (errors.length > 0) {
        throw new Error(`Instance validation failed: ${errors.join(', ')}`);
    }
}

/**
 * Generates additional defaults for instance
 * @param {Object} instance - Instance to generate defaults for
 */
async function generateInstanceDefaults(instance) {
    // Generate instance ID if not provided
    if (!instance.id) {
        instance.id = generateInstanceId();
    }
    
    // Generate default description if not provided
    if (!instance.description) {
        switch (instance.instanceType) {
            case 'vanilla':
                instance.description = `Vanilla ${instance.gameVersion} instance`;
                break;
            case 'manual_modded':
                instance.description = `${instance.gameVersion} ${instance.loader} modded instance`;
                break;
            case 'imported':
                instance.description = `Imported ${instance.gameVersion} instance`;
                break;
            default:
                instance.description = `${instance.gameVersion} ${instance.loader} instance`;
        }
    }
    
    // Set default icon if not provided
    if (!instance.icon) {
        instance.icon = getDefaultIcon(instance.loader);
    }
    
    // Normalize loader version
    if (instance.loaderVersion === 'latest') {
        // This will be resolved later by the loader version resolution system
        logger.info('Loader version set to "latest", will be resolved during installation');
    }
    
    // Initialize content tracking for manual_modded instances
    if (instance.instanceType === 'manual_modded' && !instance.content) {
        instance.content = {
            mods: [],
            resourcePacks: [],
            shaders: [],
            configs: []
        };
    }
}

/**
 * Generates a unique instance ID
 * @returns {string} Instance ID
 */
function generateInstanceId() {
    return `instance_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Gets default icon for loader type
 * @param {string} loader - Mod loader type
 * @returns {string} Default icon path
 */
function getDefaultIcon(loader) {
    const iconMap = {
        'vanilla': 'vanilla-icon.png',
        'fabric': 'fabric-icon.png',
        'forge': 'forge-icon.png', 
        'quilt': 'quilt-icon.png',
        'neoforge': 'neoforge-icon.png'
    };
    
    return iconMap[loader.toLowerCase()] || 'default-icon.png';
}

/**
 * Prepares instance data for database storage
 * @param {Object} instance - Instance object
 * @returns {Object} Database-ready data
 */
export function prepareInstanceForDatabase(instance) {
    const dbData = instanceToDatabase(instance);
    
    // Add any additional database-specific processing here
    logger.info('Prepared instance data for database', {
        name: dbData.name,
        instance_type: dbData.instance_type
    });
    
    return dbData;
}