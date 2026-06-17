// @ts-nocheck
import { writable, derived } from 'svelte/store';
import databaseService from '../services/databaseIPC';
import modrinthService from '../services/modrinthService';
import { logger } from '../utils/logger';
import { generateHexUUID } from '../utils/helper';
import { databaseToInstance } from '../types/instance';

// Create the main instance store
function createInstanceStore() {
    const { subscribe, set, update } = writable({
        instances: [],
        activeInstance: null,
        loading: false,
        error: null
    });

    return {
        subscribe,
        
        // Load all instances from database
        async loadInstances() {
            update(state => ({ ...state, loading: true, error: null }));
            
            try {
                const instances = await databaseService.getInstances();
                const activeInstance = await databaseService.getActiveInstance();
                
                // Fetch contents for each instance to ensure UI has all data
                console.log(`[INSTANCES STORE] Starting enrichment of ${instances.length} instances`);
                const enrichedInstances = await Promise.all(instances.map(async (inst) => {
                    console.log(`[INSTANCES STORE] Processing instance ${inst.id}`);
                    try {
                        const [mods, resourcePacks, shaders] = await Promise.all([
                            databaseService.getInstanceMods(inst.id).catch(() => []),
                            databaseService.getInstanceResourcePacks(inst.id).catch(() => []),
                            databaseService.getInstanceShaders(inst.id).catch(() => [])
                        ]);
                        
                        const enriched = {
                            ...inst,
                            mods: mods || [],
                            resourcePacks: resourcePacks || [],
                            shaders: shaders || []
                        };
                        console.log(`[INSTANCES STORE] Enriched instance ${inst.id}`);
                        return enriched;
                    } catch (e) {
                        console.warn(`Failed to load contents for instance ${inst.id}`, e);
                        return inst;
                    }
                }));

                update(state => ({
                    ...state,
                    instances: enrichedInstances,
                    activeInstance: activeInstance ? enrichedInstances.find(i => i.id === activeInstance.id) || activeInstance : null,
                    loading: false
                }));
            } catch (error) {
                logger.error('Failed to load instances:', error);
                update(state => ({
                    ...state,
                    loading: false,
                    error: error.message
                }));
            }
        },

        // Create a new instance
        async createInstance(instanceData) {
            try {
                // Generate ID if not provided
                const instanceId = instanceData.id || generateHexUUID();
                console.log(`[INSTANCE STORE] Generated instance ID: ${instanceId}`);
                
                // Set the correct instance path using app data directory
                const appFolder = await window.electron.getAppFolder();
                const instancePath = await window.electron.pathJoin(appFolder, 'instances', instanceId);
                
                // Ensure the instance directory exists
                try {
                    await window.electron.ensureDir(instancePath);
                    console.log(`[INSTANCE STORE] Created instance directory: ${instancePath}`);
                    
                    // Create standard subdirectories
                    const modsPath = await window.electron.pathJoin(instancePath, 'mods');
                    const resourcePacksPath = await window.electron.pathJoin(instancePath, 'resourcepacks');
                    const shaderPacksPath = await window.electron.pathJoin(instancePath, 'shaderpacks');
                    
                    await window.electron.ensureDir(modsPath);
                    await window.electron.ensureDir(resourcePacksPath);
                    await window.electron.ensureDir(shaderPacksPath);
                    
                    console.log(`[INSTANCE STORE] Created standard subdirectories: mods, resourcepacks, shaderpacks`);
                } catch (dirError) {
                    console.error('[INSTANCE STORE] Failed to create instance directory:', dirError);
                    throw new Error(`Failed to create instance directory: ${dirError.message}`);
                }
                
                const instanceDataWithPath = {
                    ...instanceData,
                    id: instanceId,
                    path: instancePath
                };
                
                console.log('[INSTANCE STORE] Creating instance with data:', JSON.stringify(instanceDataWithPath, null, 2));
                const dbInstance = await databaseService.createInstance(instanceDataWithPath);
                console.log('[INSTANCE STORE] Database instance created:', JSON.stringify(dbInstance, null, 2));
                
                // Check if database instance was created successfully
                if (!dbInstance || !dbInstance.id) {
                    console.error('[INSTANCE STORE] Database instance creation failed - no instance returned');
                    throw new Error('Failed to create instance in database');
                }
                
                // Convert database format to frontend format
                const newInstance = databaseToInstance(dbInstance);
                console.log('[INSTANCE STORE] Converted to frontend format:', JSON.stringify(newInstance, null, 2));
                
                update(state => ({
                    ...state,
                    instances: [newInstance, ...state.instances]
                }));

                return newInstance;
            } catch (error) {
                logger.error('Failed to create instance:', error);
                throw error;
            }
        },



        // Update an existing instance
        async updateInstance(id, updates) {
            try {
                await databaseService.updateInstance(id, updates);
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(instance =>
                        instance.id === id ? { ...instance, ...updates } : instance
                    ),
                    activeInstance: state.activeInstance?.id === id 
                        ? { ...state.activeInstance, ...updates } 
                        : state.activeInstance
                }));

            } catch (error) {
                logger.error('Failed to update instance:', error);
                throw error;
            }
        },

        // Delete an instance
        async deleteInstance(id) {
            try {
                // Get instance name for toast message
                const instance = await databaseService.getInstance(id);
                
                await databaseService.deleteInstance(id);
                
                update(state => {
                    const newInstances = state.instances.filter(i => i.id !== id);
                    const newActiveInstance = state.activeInstance?.id === id 
                        ? (newInstances.length > 0 ? newInstances[0] : null)
                        : state.activeInstance;

                    return {
                        ...state,
                        instances: newInstances,
                        activeInstance: newActiveInstance
                    };
                });
            } catch (error) {
                logger.error('Failed to delete instance:', error);
                throw error;
            }
        },

        // Set active instance
        async setActiveInstance(id) {
            try {
                await databaseService.setActiveInstance(id);
                const instance = await databaseService.getInstance(id);
                
                update(state => ({
                    ...state,
                    activeInstance: instance
                }));
            } catch (error) {
                logger.error('Failed to set active instance:', error);
                throw error;
            }
        },

        // Update last played timestamp
        async updateLastPlayed(id) {
            try {
                const now = new Date().toISOString();
                await databaseService.updateInstance(id, { last_played: now });
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(instance =>
                        instance.id === id ? { ...instance, last_played: now } : instance
                    ),
                    activeInstance: state.activeInstance?.id === id 
                        ? { ...state.activeInstance, last_played: now } 
                        : state.activeInstance
                }));
            } catch (error) {
                logger.error('Failed to update last played:', error);
            }
        },

        // Clear error state
        clearError() {
            update(state => ({ ...state, error: null }));
        },

        // Install mod to instance
        async installMod(instanceId, modData, options = {}) {
            try {
                logger.info(`Installing mod ${modData.title} to instance ${instanceId}`);
                
                // Get the instance details to determine compatible versions
                const instance = await databaseService.getInstance(instanceId);
                logger.info(`Instance details: ${instance.name}, version: ${instance.gameVersion}, loader: ${instance.loader}`);
                
                // Fetch complete project data
                logger.info(`Fetching complete project data for ${modData.project_id || modData.id} from Modrinth`);
                const projectId = modData.project_id || modData.id;
                const project = await modrinthService.getProject(projectId);
                
                let latestVersion = null;
                
                // Use explicit version if provided (for dependencies)
                if (options.explicitVersion) {
                    latestVersion = options.explicitVersion;
                } else if (modData.latest_version) {
                    // If latest_version is a string (version ID), fetch the full version details
                    if (typeof modData.latest_version === 'string') {
                        logger.info(`Fetching version details for ${modData.latest_version}`);
                        latestVersion = await modrinthService.getVersion(modData.latest_version);
                    } else {
                        // Use the version object if already available
                        latestVersion = modData.latest_version;
                    }
                }
                if (!latestVersion) {
                    logger.info(`Fetching versions for project ${projectId} from Modrinth`);
                    const versions = await modrinthService.getProjectVersions(projectId, {
                        gameVersion: instance.gameVersion,
                        loader: instance.loader
                    });
                    logger.info(`Found ${versions.length} compatible versions`);
                    if (versions.length === 0) {
                        throw new Error('No compatible version found for this mod');
                    }
                    const selected = modrinthService.getLatestCompatibleVersion(versions, instance.gameVersion, instance.loader, 'release');
                    if (!selected) {
                        throw new Error('No compatible version found for this mod');
                    }
                    latestVersion = selected;
                }
                // Validate that we have a valid version with files
                if (!latestVersion || !latestVersion.files || !Array.isArray(latestVersion.files)) {
                    throw new Error('Invalid or missing version data - no files found');
                }
                
                logger.info(`Using version: ${latestVersion.version_number}`);
                
                // Get the primary file
                const primaryFile = latestVersion.files.find(file => file.primary) || latestVersion.files[0];
                if (!primaryFile) {
                    throw new Error('No download files found for this version');
                }
                
                logger.info(`Using file: ${primaryFile.filename} from ${primaryFile.url}`);

                // Create the target directory path for this instance
                let instancePath;
                if (instance.path) {
                    instancePath = instance.path;
                } else {
                    const appFolder = await window.electron.getAppFolder();
                    instancePath = await window.electron.pathJoin(appFolder, 'instances', instanceId);
                }

                // Determine target directory based on project type
                const projectType = project.project_type;
                logger.info(`Installing item with Project Type: ${projectType}`);

                let targetDir = 'mods';
                if (projectType === 'resourcepack') {
                    targetDir = 'resourcepacks';
                } else if (projectType === 'shader') {
                    targetDir = 'shaderpacks';
                }
                
                // Ensure target directory exists
                const targetDirPath = await window.electron.pathJoin(instancePath, targetDir);
                await window.electron.invoke('ensure-dir', targetDirPath);

                const modFilePath = await window.electron.pathJoin(targetDirPath, primaryFile.filename);

                // Download the file
                logger.info(`Downloading file to: ${modFilePath}`);
                try {
                    await modrinthService.downloadFile(primaryFile.url, modFilePath);
                    logger.info('File downloaded successfully');
                } catch (downloadError) {
                    logger.error('Failed to download file:', downloadError);
                    throw new Error(`Failed to download file: ${downloadError.message}`);
                }

                // Add to database
                logger.info(`Adding item to database (Type: ${projectType})`);
                
                let installedItem;
                let classId = 6;

                if (projectType === 'resourcepack') {
                    classId = 12;
                    installedItem = await databaseService.addResourcePack({
                        instanceId: instanceId,
                        modrinthId: projectId,
                        name: project.title,
                        version: latestVersion.version_number,
                        fileName: primaryFile.filename,
                        filePath: modFilePath,
                        enabled: true
                    });
                } else if (projectType === 'shader') {
                    classId = 6552;
                    installedItem = await databaseService.addShader({
                        instanceId: instanceId,
                        modrinthId: projectId,
                        name: project.title,
                        version: latestVersion.version_number,
                        fileName: primaryFile.filename,
                        filePath: modFilePath,
                        enabled: true
                    });
                } else {
                    // Standard Mod
                    classId = 6;
                    installedItem = await databaseService.addMod({
                        instanceId: instanceId,
                        modrinthId: projectId,
                        name: project.title,
                        version: latestVersion.version_number,
                        fileName: primaryFile.filename,
                        filePath: modFilePath,
                        enabled: true,
                        dependencies: JSON.stringify(latestVersion.dependencies || []),
                        classId: 6
                    });
                }
                
                logger.info('Item added to database successfully');

                // Install required dependencies automatically (only for mods usually, but kept for completeness)
                const dependencies = latestVersion.dependencies || [];
                let installedDependencies = [];
                if (dependencies.length > 0) {
                    logger.info(`Installing ${dependencies.length} dependencies for ${project.title}`);
                    // Modrinth dependencies don't have slugs usually, just project_id
                    logger.info('Dependencies found:', dependencies.map(d => `${d.project_id} - ${d.dependency_type}`).join(', '));
                    try {
                        installedDependencies = await this.installModDependencies(
                            instanceId, 
                            dependencies,
                            options.installedModsSet ? options.installedModsSet : new Set([projectId])
                        );
                        
                        if (installedDependencies.length > 0) {
                            logger.info(`Successfully installed ${installedDependencies.length} dependencies`);
                        } else {
                            logger.warn('No dependencies were installed (they may already be installed or be optional)');
                        }
                    } catch (depError) {
                        logger.error('Failed to install dependencies:', depError);
                    }
                } else {
                    logger.info(`No dependencies found for ${project.title}`);
                }

                // Update instance's content list based on classId
                if (classId === 12) {
                    const currentResourcePacks = await databaseService.getInstanceResourcePacks(instanceId);
                    update(state => ({
                        ...state,
                        instances: state.instances.map(inst =>
                            inst.id === instanceId ? { ...inst, resourcePacks: currentResourcePacks } : inst
                        ),
                        activeInstance: state.activeInstance?.id === instanceId
                            ? { ...state.activeInstance, resourcePacks: currentResourcePacks }
                            : state.activeInstance
                    }));
                } else if (classId === 6552) {
                    const currentShaders = await databaseService.getInstanceShaders(instanceId);
                    update(state => ({
                        ...state,
                        instances: state.instances.map(inst =>
                            inst.id === instanceId ? { ...inst, shaders: currentShaders } : inst
                        ),
                        activeInstance: state.activeInstance?.id === instanceId
                            ? { ...state.activeInstance, shaders: currentShaders }
                            : state.activeInstance
                    }));
                } else {
                    const currentMods = await databaseService.getInstanceMods(instanceId);
                    update(state => ({
                        ...state,
                        instances: state.instances.map(inst =>
                            inst.id === instanceId ? { ...inst, mods: currentMods } : inst
                        ),
                        activeInstance: state.activeInstance?.id === instanceId
                            ? { ...state.activeInstance, mods: currentMods }
                            : state.activeInstance
                    }));
                }

                // Add to installed mods set if provided (for dependency tracking)
                if (options.installedModsSet) {
                    options.installedModsSet.add(projectId);
                }

                return installedItem;
            } catch (error) {
                logger.error('Failed to install mod:', error);
                throw error;
            }
        },

        /**
         * Install mod dependencies recursively
         * @param {string} instanceId - Instance ID
         * @param {Array} dependencies - Array of dependency objects
         * @param {Set} installedMods - Set of already installed mod IDs to prevent circular dependencies
         */
        async installModDependencies(instanceId, dependencies, installedMods = new Set()) {
            const installedDependencies = [];
            
            for (const dependency of dependencies) {
                // Skip if already installed or being processed
                if (installedMods.has(dependency.project_id)) {
                    continue;
                }
                
                // Only install required dependencies
                const depType = dependency.dependency_type || dependency.type;
                if (depType !== 'required') {
                    continue;
                }
                
                try {
                    logger.info(`Installing required dependency: ${dependency.project_id}`);
                    
                    // Check if this dependency is already installed in the instance
                    const existingMods = await databaseService.getInstanceMods(instanceId);
                    const isAlreadyInstalled = existingMods.some(mod => 
                        mod.modrinth_id === dependency.project_id
                    );
                    
                    if (isAlreadyInstalled) {
                        logger.info(`Dependency ${dependency.project_id} is already installed, skipping`);
                        installedMods.add(dependency.project_id);
                        continue;
                    }
                    
                    const depModData = await modrinthService.getProject(dependency.project_id);
                    if (!depModData) {
                        logger.warn(`Could not find dependency mod data for ${dependency.project_id}`);
                        continue;
                    }
                    
                    let explicitVersion = null;
                    if (dependency.version_id) {
                        explicitVersion = await modrinthService.getVersion(dependency.version_id);
                    }
                    const installedDep = await this.installMod(instanceId, depModData, { explicitVersion, installedModsSet: installedMods });
                    installedDependencies.push(installedDep);
                    installedMods.add(dependency.project_id);
                    
                    logger.info(`Successfully installed dependency: ${dependency.project_id}`);
                } catch (error) {
                    logger.error(`Failed to install dependency ${dependency.project_id}:`, error);
                    // Continue with other dependencies even if one fails
                }
            }
            
            return installedDependencies;
        },

        // Remove mod from instance
        async removeMod(modId) {
            try {
                const mod = await databaseService.getMod(modId);
                
                // Try to delete the mod (will gracefully handle if it doesn't exist)
                await databaseService.deleteMod(modId);
                
                // Update instance's mod list
                if (mod && mod.instance_id) {
                    const currentMods = await databaseService.getInstanceMods(mod.instance_id);
                    
                    update(state => ({
                        ...state,
                        instances: state.instances.map(inst =>
                            inst.id === mod.instance_id ? { ...inst, mods: currentMods } : inst
                        ),
                        activeInstance: state.activeInstance?.id === mod.instance_id
                            ? { ...state.activeInstance, mods: currentMods }
                            : state.activeInstance
                    }));
                    
                }
            } catch (error) {
                logger.error('Failed to remove mod:', error);
                throw error;
            }
        },

        // Toggle mod enabled/disabled state
        async toggleMod(modId, enabled) {
            try {
                await databaseService.updateMod(modId, { enabled });
                
                // Update local state
                update(state => {
                    const updateMods = (mods) => mods.map(mod =>
                        mod.id === modId ? { ...mod, enabled } : mod
                    );
                    
                    return {
                        ...state,
                        instances: state.instances.map(inst => ({
                            ...inst,
                            mods: updateMods(inst.mods || [])
                        })),
                        activeInstance: state.activeInstance ? {
                            ...state.activeInstance,
                            mods: updateMods(state.activeInstance.mods || [])
                        } : null
                    };
                });

            } catch (error) {
                logger.error('Failed to toggle mod:', error);
                throw error;
            }
        },

        // Load instance mods
        async loadInstanceMods(instanceId) {
            try {
                const mods = await databaseService.getInstanceMods(instanceId);
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(inst =>
                        inst.id === instanceId ? { ...inst, mods } : inst
                    ),
                    activeInstance: state.activeInstance?.id === instanceId
                        ? { ...state.activeInstance, mods }
                        : state.activeInstance
                }));

                return mods;
            } catch (error) {
                logger.error('Failed to load instance mods:', error);
                throw error;
            }
        },

        // Get instance mods (without updating store)
        async getInstanceMods(instanceId) {
            try {
                return await databaseService.getInstanceMods(instanceId);
            } catch (error) {
                logger.error('Failed to get instance mods:', error);
                throw error;
            }
        },

        // Get instance resource packs
        async getInstanceResourcePacks(instanceId) {
            try {
                return await databaseService.getInstanceResourcePacks(instanceId);
            } catch (error) {
                logger.error('Failed to get instance resource packs:', error);
                throw error;
            }
        },

        // Add resource pack to instance
        async addResourcePack(instanceId, resourcePackData) {
            try {
                const instance = await databaseService.getInstance(instanceId);
                
                // Create the resource packs directory path for this instance
                let instancePath;
                if (instance.path) {
                    instancePath = instance.path;
                } else {
                    const appFolder = await window.electron.getAppFolder();
                    instancePath = await window.electron.invoke('path-join', appFolder, 'instances', instanceId);
                }
                
                const resourcePackFileName = resourcePackData.fileName || `${resourcePackData.name}.zip`;
                const resourcePackFilePath = await window.electron.invoke('path-join', instancePath, 'resourcepacks', resourcePackFileName);

                // Add resource pack to database
                const resourcePack = await databaseService.addResourcePack({
                    instanceId: instanceId,
                    modrinthId: resourcePackData.modrinthId || null,
                    name: resourcePackData.name,
                    version: resourcePackData.version || '1.0.0',
                    fileName: resourcePackFileName,
                    filePath: resourcePackFilePath,
                    enabled: true
                });

                // Update instance's resource pack list
                const currentResourcePacks = await databaseService.getInstanceResourcePacks(instanceId);
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(inst =>
                        inst.id === instanceId ? { ...inst, resourcePacks: currentResourcePacks } : inst
                    ),
                    activeInstance: state.activeInstance?.id === instanceId
                        ? { ...state.activeInstance, resourcePacks: currentResourcePacks }
                        : state.activeInstance
                }));

                return resourcePack;
            } catch (error) {
                logger.error('Failed to add resource pack:', error);
                throw error;
            }
        },

        // Remove resource pack from instance
        async removeResourcePack(resourcePackId) {
            try {
                const resourcePack = await databaseService.getResourcePack(resourcePackId);
                await databaseService.deleteResourcePack(resourcePackId);
                
                // Update instance's resource pack list
                if (resourcePack.instance_id) {
                    const currentResourcePacks = await databaseService.getInstanceResourcePacks(resourcePack.instance_id);
                    
                    update(state => ({
                        ...state,
                        instances: state.instances.map(inst =>
                            inst.id === resourcePack.instance_id ? { ...inst, resourcePacks: currentResourcePacks } : inst
                        ),
                        activeInstance: state.activeInstance?.id === resourcePack.instance_id
                            ? { ...state.activeInstance, resourcePacks: currentResourcePacks }
                            : state.activeInstance
                    }));
                }
            } catch (error) {
                logger.error('Failed to remove resource pack:', error);
                throw error;
            }
        },

        // Toggle resource pack enabled/disabled state
        async toggleResourcePack(resourcePackId, enabled) {
            try {
                await databaseService.updateResourcePack(resourcePackId, { enabled });
                
                // Update local state
                update(state => {
                    const updateResourcePacks = (resourcePacks) => resourcePacks.map(rp =>
                        rp.id === resourcePackId ? { ...rp, enabled } : rp
                    );
                    
                    return {
                        ...state,
                        instances: state.instances.map(inst => ({
                            ...inst,
                            resourcePacks: updateResourcePacks(inst.resourcePacks || [])
                        })),
                        activeInstance: state.activeInstance ? {
                            ...state.activeInstance,
                            resourcePacks: updateResourcePacks(state.activeInstance.resourcePacks || [])
                        } : null
                    };
                });

            } catch (error) {
                logger.error('Failed to toggle resource pack:', error);
                throw error;
            }
        },

        // Load instance resource packs
        async loadInstanceResourcePacks(instanceId) {
            try {
                const resourcePacks = await databaseService.getInstanceResourcePacks(instanceId);
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(inst =>
                        inst.id === instanceId ? { ...inst, resourcePacks } : inst
                    ),
                    activeInstance: state.activeInstance?.id === instanceId
                        ? { ...state.activeInstance, resourcePacks }
                        : state.activeInstance
                }));

                return resourcePacks;
            } catch (error) {
                logger.error('Failed to load instance resource packs:', error);
                throw error;
            }
        },

        // Get instance shaders
        async getInstanceShaders(instanceId) {
            try {
                return await databaseService.getInstanceShaders(instanceId);
            } catch (error) {
                logger.error('Failed to get instance shaders:', error);
                throw error;
            }
        },

        // Add shader to instance
        async addShader(instanceId, shaderData) {
            try {
                const instance = await databaseService.getInstance(instanceId);
                
                // Create the shaders directory path for this instance
                let instancePath;
                if (instance.path) {
                    instancePath = instance.path;
                } else {
                    const appFolder = await window.electron.getAppFolder();
                    instancePath = await window.electron.invoke('path-join', appFolder, 'instances', instanceId);
                }
                
                const shaderFileName = shaderData.fileName || `${shaderData.name}.zip`;
                const shaderFilePath = await window.electron.invoke('path-join', instancePath, 'shaderpacks', shaderFileName);

                // Add shader to database
                const shader = await databaseService.addShader({
                    instanceId: instanceId,
                    modrinthId: shaderData.modrinthId || null,
                    name: shaderData.name,
                    version: shaderData.version || '1.0.0',
                    fileName: shaderFileName,
                    filePath: shaderFilePath,
                    enabled: true
                });

                // Update instance's shader list
                const currentShaders = await databaseService.getInstanceShaders(instanceId);
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(inst =>
                        inst.id === instanceId ? { ...inst, shaders: currentShaders } : inst
                    ),
                    activeInstance: state.activeInstance?.id === instanceId
                        ? { ...state.activeInstance, shaders: currentShaders }
                        : state.activeInstance
                }));

                return shader;
            } catch (error) {
                logger.error('Failed to add shader:', error);
                throw error;
            }
        },

        // Remove shader from instance
        async removeShader(shaderId) {
            try {
                const shader = await databaseService.getShader(shaderId);
                await databaseService.deleteShader(shaderId);
                
                // Update instance's shader list
                if (shader.instance_id) {
                    const currentShaders = await databaseService.getInstanceShaders(shader.instance_id);
                    
                    update(state => ({
                        ...state,
                        instances: state.instances.map(inst =>
                            inst.id === shader.instance_id ? { ...inst, shaders: currentShaders } : inst
                        ),
                        activeInstance: state.activeInstance?.id === shader.instance_id
                            ? { ...state.activeInstance, shaders: currentShaders }
                            : state.activeInstance
                    }));
                }
            } catch (error) {
                logger.error('Failed to remove shader:', error);
                throw error;
            }
        },

        // Toggle shader enabled/disabled state
        async toggleShader(shaderId, enabled) {
            try {
                await databaseService.updateShader(shaderId, { enabled });
                
                // Update local state
                update(state => {
                    const updateShaders = (shaders) => shaders.map(s =>
                        s.id === shaderId ? { ...s, enabled } : s
                    );
                    
                    return {
                        ...state,
                        instances: state.instances.map(inst => ({
                            ...inst,
                            shaders: updateShaders(inst.shaders || [])
                        })),
                        activeInstance: state.activeInstance ? {
                            ...state.activeInstance,
                            shaders: updateShaders(state.activeInstance.shaders || [])
                        } : null
                    };
                });
            } catch (error) {
                logger.error('Failed to toggle shader:', error);
                throw error;
            }
        },

        // Load instance shaders
        async loadInstanceShaders(instanceId) {
            try {
                const shaders = await databaseService.getInstanceShaders(instanceId);
                
                update(state => ({
                    ...state,
                    instances: state.instances.map(inst =>
                        inst.id === instanceId ? { ...inst, shaders } : inst
                    ),
                    activeInstance: state.activeInstance?.id === instanceId
                        ? { ...state.activeInstance, shaders }
                        : state.activeInstance
                }));

                return shaders;
            } catch (error) {
                logger.error('Failed to load instance shaders:', error);
                throw error;
            }
        },

        // Sync instance content with filesystem
        async syncInstanceContent(instanceId) {
            try {
                console.log(`[SYNC] Starting content sync for instance ${instanceId}`);
                
                // Skip checking local store for now - just get from database
                console.log(`[SYNC] Fetching instance from database...`);
                
                // Add a delay to ensure database transaction completes
                console.log(`[SYNC] Waiting for database transaction to complete...`);
                await new Promise(resolve => setTimeout(resolve, 500));
                
                // Get instance path from database with retry
                console.log(`[SYNC] Fetching instance from database...`);
                let instance = await databaseService.getInstance(instanceId);
                
                // Retry if instance not found (up to 3 times with increasing delays)
                let retryCount = 0;
                const maxRetries = 3;
                while (!instance && retryCount < maxRetries) {
                    retryCount++;
                    console.log(`[SYNC] Instance not found, retry ${retryCount}/${maxRetries}...`);
                    await new Promise(resolve => setTimeout(resolve, retryCount * 500));
                    instance = await databaseService.getInstance(instanceId);
                }
                
                console.log(`[SYNC] Database instance result:`, instance);
                if (!instance) {
                    console.error(`[SYNC] Instance ${instanceId} not found in database after ${maxRetries} retries. This might indicate a database transaction issue.`);
                    throw new Error(`Instance ${instanceId} not found`);
                }
                
                console.log(`[SYNC] Instance from database:`, instance);
                
                let instancePath;
                if (instance.path) {
                    instancePath = instance.path;
                    console.log(`[SYNC] Using instance.path: ${instancePath}`);
                } else {
                    const appDataPath = await window.electron.invoke('get-app-data-path');
                    console.log(`[SYNC] App data path: ${appDataPath}`);
                    instancePath = await window.electron.invoke('path-join', appDataPath, 'instances', instanceId);
                    console.log(`[SYNC] Constructed instance path: ${instancePath}`);
                }
                
                // Sync mods
                await this.syncMods(instanceId, instancePath);
                
                // Sync resource packs
                console.log(`[SYNC] Starting resource pack sync...`);
                await this.syncResourcePacks(instanceId, instancePath);
                
                // Sync shaders
                await this.syncShaders(instanceId, instancePath);
                
                console.log(`[SYNC] Content sync completed for instance ${instanceId}`);
                
                // Reload the instance data
                console.log(`[SYNC] Reloading instance content...`);
                const content = await this.loadInstanceContent(instanceId);
                console.log(`[SYNC] Loaded content:`, content);
                
            } catch (error) {
                logger.error('Failed to sync instance content:', error);
                throw error;
            }
        },

        // Read mods directly from filesystem (filesystem is source of truth)
        async readModsFromFilesystem(instanceId, instancePath) {
            try {
                console.log(`[READ] readModsFromFilesystem called with instanceId: ${instanceId}, instancePath: ${instancePath}, type: ${typeof instancePath}`);
                const modsPath = await window.electron.invoke('path-join', instancePath, 'mods');
                
                console.log(`[READ] Reading mods from filesystem: ${modsPath}`);
                
                // Check if mods directory exists
                const modsExists = await window.electron.invoke('path-exists', modsPath);
                if (!modsExists) {
                    console.log(`[READ] Mods directory does not exist: ${modsPath}`);
                    return [];
                }
                
                // Get files from filesystem
                let fsFiles;
                try {
                    fsFiles = await window.electron.invoke('readdir', modsPath);
                    console.log(`[READ] Found files in mods:`, fsFiles);
                } catch (error) {
                    console.error(`[READ] Error reading mods directory:`, error);
                    return [];
                }
                
                // Filter mod files (.jar and .disabled)
                const mods = [];
                for (const fileEntry of fsFiles) {
                    // fileEntry is an object with name, isDirectory, isFile properties
                    const filename = fileEntry.name;
                    
                    // Skip directories - mods should be files only
                    if (fileEntry.isDirectory) {
                        console.log(`[READ] Skipped directory: ${filename}`);
                        continue;
                    }
                    
                    const filePath = await window.electron.invoke('path-join', modsPath, filename);
                    
                    // Check if it's a valid mod file
                    const isJar = filename.endsWith('.jar');
                    const isDisabled = filename.endsWith('.disabled');
                    
                    if (isJar || isDisabled) {
                        const isEnabled = !filename.endsWith('.disabled');
                        const cleanName = filename.replace('.disabled', '').replace('.jar', '');
                        
                        mods.push({
                            id: `${instanceId}-${filename}`, // Generate ID
                            instanceId: instanceId,
                            name: cleanName,
                            file_name: filename,
                            file_path: filePath,
                            version: 'unknown',
                            enabled: isEnabled,
                            description: 'Mod from filesystem'
                        });
                        console.log(`[READ] Found mod: ${filename}, enabled: ${isEnabled}`);
                    } else {
                        console.log(`[READ] Skipped file (not a mod): ${filename}`);
                    }
                }
                
                console.log(`[READ] Total mods found: ${mods.length}`);
                return mods;
                
            } catch (error) {
                console.error(`[READ] Failed to read mods for instance ${instanceId}:`, error);
                return [];
            }
        },

        // Sync mods with filesystem (database is just a record keeper)
        async syncMods(instanceId, instancePath) {
            try {
                // Read mods directly from filesystem
                const filesystemMods = await this.readModsFromFilesystem(instanceId, instancePath);
                
                // Get current database entries
                const dbMods = await databaseService.getInstanceMods(instanceId);
                
                // Update database to match filesystem (filesystem is source of truth)
                
                // Add missing mods to database
                for (const mod of filesystemMods) {
                    const existsInDb = dbMods.some(dbMod => dbMod.file_name === mod.file_name);
                    if (!existsInDb) {
                        try {
                            await databaseService.addMod({
                                instanceId: instanceId,
                                name: mod.name,
                                fileName: mod.file_name,
                                filePath: mod.file_path,
                                version: mod.version,
                                enabled: mod.enabled,
                                modrinthId: null,
                                curseforgeId: null
                            });
                            console.log(`[SYNC] Added mod to database: ${mod.file_name}`);
                        } catch (dbError) {
                            console.error(`[SYNC] Failed to add mod ${mod.file_name} to database:`, dbError);
                        }
                    }
                }
                
                // Remove mods from database that don't exist in filesystem
                for (const dbMod of dbMods) {
                    const existsInFs = filesystemMods.some(fsMod => fsMod.file_name === dbMod.file_name);
                    if (!existsInFs) {
                        await databaseService.deleteMod(dbMod.id);
                        console.log(`[SYNC] Removed mod from database: ${dbMod.file_name}`);
                    }
                }
                
                console.log(`[SYNC] Mod sync completed. Filesystem: ${filesystemMods.length}, Database: ${dbMods.length}`);
                
            } catch (error) {
                console.error(`[SYNC] Failed to sync mods for instance ${instanceId}:`, error);
                throw error;
            }
        },

        // Read resource packs directly from filesystem (filesystem is source of truth)
        async readResourcePacksFromFilesystem(instanceId, instancePath) {
            try {
                console.log(`[READ] readResourcePacksFromFilesystem called with instanceId: ${instanceId}, instancePath: ${instancePath}, type: ${typeof instancePath}`);
                const resourcePacksPath = await window.electron.invoke('path-join', instancePath, 'resourcepacks');
                
                console.log(`[READ] Reading resource packs from filesystem: ${resourcePacksPath}`);
                
                // Check if resource packs directory exists
                const rpExists = await window.electron.invoke('path-exists', resourcePacksPath);
                if (!rpExists) {
                    console.log(`[READ] Resource packs directory does not exist: ${resourcePacksPath}`);
                    return [];
                }
                
                // Get files from filesystem
                let fsFiles;
                try {
                    fsFiles = await window.electron.invoke('readdir', resourcePacksPath);
                    console.log(`[READ] Found files in resourcepacks:`, fsFiles);
                } catch (error) {
                    console.error(`[READ] Error reading resourcepacks directory:`, error);
                    return [];
                }
                
                // Filter resource pack files (zip files and folders)
                const resourcePacks = [];
                for (const fileEntry of fsFiles) {
                    // fileEntry is an object with name, isDirectory, isFile properties
                    const filename = fileEntry.name;
                    const filePath = await window.electron.invoke('path-join', resourcePacksPath, filename);
                    
                    // Check if it's a valid resource pack (zip file or folder)
                    const isZip = filename.endsWith('.zip');
                    const isFolder = fileEntry.isDirectory; // Use the proper directory check
                    
                    if (isZip || fileEntry.isDirectory) {
                        resourcePacks.push({
                            id: `${instanceId}-${filename}`, // Generate ID
                            instanceId: instanceId,
                            name: filename.replace('.zip', ''),
                            file_name: filename,
                            file_path: filePath,
                            version: 'unknown',
                            enabled: true, // Default to enabled
                            description: 'Resource pack from filesystem'
                        });
                        console.log(`[READ] Found resource pack: ${filename}`);
                    } else {
                        console.log(`[READ] Skipped file (not a resource pack): ${filename}`);
                    }
                }
                
                console.log(`[READ] Total resource packs found: ${resourcePacks.length}`);
                return resourcePacks;
                
            } catch (error) {
                console.error(`[READ] Failed to read resource packs for instance ${instanceId}:`, error);
                return [];
            }
        },

        // Sync resource packs with filesystem (database is just a record keeper)
        async syncResourcePacks(instanceId, instancePath) {
            try {
                // Read resource packs directly from filesystem
                const filesystemResourcePacks = await this.readResourcePacksFromFilesystem(instanceId, instancePath);
                
                // Get current database entries
                const dbResourcePacks = await databaseService.getInstanceResourcePacks(instanceId);
                
                // Update database to match filesystem (filesystem is source of truth)
                
                // Add missing resource packs to database
                for (const rp of filesystemResourcePacks) {
                    const existsInDb = dbResourcePacks.some(dbRp => dbRp.file_name === rp.file_name);
                    if (!existsInDb) {
                        try {
                            await databaseService.addResourcePack({
                                instanceId: instanceId,
                                name: rp.name,
                                fileName: rp.file_name,
                                filePath: rp.file_path,
                                version: rp.version,
                                enabled: rp.enabled,
                                modrinthId: null
                            });
                            console.log(`[SYNC] Added resource pack to database: ${rp.file_name}`);
                        } catch (dbError) {
                            console.error(`[SYNC] Failed to add resource pack ${rp.file_name} to database:`, dbError);
                        }
                    }
                }
                
                // Remove resource packs from database that don't exist in filesystem
                for (const dbRp of dbResourcePacks) {
                    const existsInFs = filesystemResourcePacks.some(fsRp => fsRp.file_name === dbRp.file_name);
                    if (!existsInFs) {
                        await databaseService.deleteResourcePack(dbRp.id);
                        console.log(`[SYNC] Removed resource pack from database: ${dbRp.file_name}`);
                    }
                }
                
                console.log(`[SYNC] Resource pack sync completed. Filesystem: ${filesystemResourcePacks.length}, Database: ${dbResourcePacks.length}`);
                
            } catch (error) {
                console.error(`[SYNC] Failed to sync resource packs for instance ${instanceId}:`, error);
                throw error;
            }
        },

        // Read shaders directly from filesystem (filesystem is source of truth)
        async readShadersFromFilesystem(instanceId, instancePath) {
            try {
                console.log(`[READ] readShadersFromFilesystem called with instanceId: ${instanceId}, instancePath: ${instancePath}, type: ${typeof instancePath}`);
                const shadersPath = await window.electron.invoke('path-join', instancePath, 'shaderpacks');
                
                console.log(`[READ] Reading shaders from filesystem: ${shadersPath}`);
                
                // Check if shaders directory exists
                const shadersExists = await window.electron.invoke('path-exists', shadersPath);
                if (!shadersExists) {
                    console.log(`[READ] Shaders directory does not exist: ${shadersPath}`);
                    return [];
                }
                
                // Get files from filesystem
                let fsFiles;
                try {
                    fsFiles = await window.electron.invoke('readdir', shadersPath);
                    console.log(`[READ] Found files in shaderpacks:`, fsFiles);
                } catch (error) {
                    console.error(`[READ] Error reading shaderpacks directory:`, error);
                    return [];
                }
                
                // Filter shader files (zip files)
                const shaders = [];
                for (const fileEntry of fsFiles) {
                    // fileEntry is an object with name, isDirectory, isFile properties
                    const filename = fileEntry.name;
                    
                    // Skip directories - shaders should be files only
                    if (fileEntry.isDirectory) {
                        console.log(`[READ] Skipped directory: ${filename}`);
                        continue;
                    }
                    
                    const filePath = await window.electron.invoke('path-join', shadersPath, filename);
                    
                    // Check if it's a valid shader file
                    const isZip = filename.endsWith('.zip');
                    
                    if (isZip) {
                        shaders.push({
                            id: `${instanceId}-${filename}`, // Generate ID
                            instanceId: instanceId,
                            name: filename.replace('.zip', ''),
                            file_name: filename,
                            file_path: filePath,
                            version: 'unknown',
                            enabled: true, // Default to enabled
                            description: 'Shader from filesystem'
                        });
                        console.log(`[READ] Found shader: ${filename}`);
                    } else {
                        console.log(`[READ] Skipped file (not a shader): ${filename}`);
                    }
                }
                
                console.log(`[READ] Total shaders found: ${shaders.length}`);
                return shaders;
                
            } catch (error) {
                console.error(`[READ] Failed to read shaders for instance ${instanceId}:`, error);
                return [];
            }
        },

        // Sync shaders with filesystem (database is just a record keeper)
        async syncShaders(instanceId, instancePath) {
            try {
                // Read shaders directly from filesystem
                const filesystemShaders = await this.readShadersFromFilesystem(instanceId, instancePath);
                
                // Get current database entries
                const dbShaders = await databaseService.getInstanceShaders(instanceId);
                
                // Update database to match filesystem (filesystem is source of truth)
                
                // Add missing shaders to database
                for (const shader of filesystemShaders) {
                    const existsInDb = dbShaders.some(dbShader => dbShader.file_name === shader.file_name);
                    if (!existsInDb) {
                        try {
                            await databaseService.addShader({
                                instanceId: instanceId,
                                name: shader.name,
                                fileName: shader.file_name,
                                filePath: shader.file_path,
                                version: shader.version,
                                enabled: shader.enabled,
                                modrinthId: null
                            });
                            console.log(`[SYNC] Added shader to database: ${shader.file_name}`);
                        } catch (dbError) {
                            console.error(`[SYNC] Failed to add shader ${shader.file_name} to database:`, dbError);
                        }
                    }
                }
                
                // Remove shaders from database that don't exist in filesystem
                for (const dbShader of dbShaders) {
                    const existsInFs = filesystemShaders.some(fsShader => fsShader.file_name === dbShader.file_name);
                    if (!existsInFs) {
                        await databaseService.deleteShader(dbShader.id);
                        console.log(`[SYNC] Removed shader from database: ${dbShader.file_name}`);
                    }
                }
                
                console.log(`[SYNC] Shader sync completed. Filesystem: ${filesystemShaders.length}, Database: ${dbShaders.length}`);
                
            } catch (error) {
                console.error(`[SYNC] Failed to sync shaders for instance ${instanceId}:`, error);
                throw error;
            }
        },

        // Force refresh instance content (for reactive updates)
        async forceRefreshInstance(instanceId) {
            console.log(`[FORCE] Force refreshing instance ${instanceId}`);
            try {
                const content = await this.loadInstanceContent(instanceId);
                
                // Update reactive store to trigger component updates
                instanceContentUpdates.update(updates => ({
                    ...updates,
                    [instanceId]: {
                        timestamp: Date.now(),
                        mods: content.mods.length,
                        resourcePacks: content.resourcePacks.length,
                        shaders: content.shaders.length
                    }
                }));
                
                console.log(`[FORCE] Force refresh completed for instance ${instanceId}`);
                return content;
            } catch (error) {
                console.error(`[FORCE] Force refresh failed for instance ${instanceId}:`, error);
                throw error;
            }
        },

        // Load instance content directly from filesystem (filesystem is source of truth)
        async loadInstanceContent(instanceId) {
            try {
                // Get instance path first
                const instance = await databaseService.getInstance(instanceId);
                if (!instance) {
                    throw new Error(`Instance ${instanceId} not found`);
                }
                
                console.log(`[LOAD] Instance data from database:`, instance);
                
                let instancePath;
                if (instance.path) {
                    console.log(`[LOAD] Using instance.path:`, instance.path, `type:`, typeof instance.path);
                    // Ensure it's a string
                    if (typeof instance.path !== 'string') {
                        console.error(`[LOAD] instance.path is not a string!`, instance.path);
                        throw new Error(`Invalid instance path: expected string, got ${typeof instance.path}`);
                    }
                    instancePath = instance.path;
                } else {
                    const appDataPath = await window.electron.invoke('get-app-data-path');
                    console.log(`[LOAD] Building path from appDataPath:`, appDataPath);
                    instancePath = await window.electron.invoke('path-join', appDataPath, 'instances', instanceId);
                }
                
                console.log(`[LOAD] Loading content directly from filesystem for instance ${instanceId} at path: ${instancePath}`);
                
                // Read all content directly from filesystem
                const [mods, resourcePacks, shaders] = await Promise.all([
                    this.readModsFromFilesystem(instanceId, instancePath),
                    this.readResourcePacksFromFilesystem(instanceId, instancePath),
                    this.readShadersFromFilesystem(instanceId, instancePath)
                ]);

                console.log(`[LOAD] Loaded from filesystem - Mods: ${mods.length}, Resource Packs: ${resourcePacks.length}, Shaders: ${shaders.length}`);

                update(state => ({
                    ...state,
                    instances: state.instances.map(inst =>
                        inst.id === instanceId ? { ...inst, mods, resourcePacks, shaders } : inst
                    ),
                    activeInstance: state.activeInstance?.id === instanceId
                        ? { ...state.activeInstance, mods, resourcePacks, shaders }
                        : state.activeInstance
                }));

                return { mods, resourcePacks, shaders };
            } catch (error) {
                logger.error('Failed to load instance content from filesystem:', error);
                throw error;
            }
        },

        // Reset store
        reset() {
            set({
                instances: [],
                activeInstance: null,
                loading: false,
                error: null
            });
        }
    };
}

// Create the store
export const instanceStore = createInstanceStore();

// Reactive store for instance content updates
export const instanceContentUpdates = writable({});

// Derived stores for convenience
export const instances = derived(instanceStore, $store => $store.instances);
export const activeInstance = derived(instanceStore, $store => $store.activeInstance);
export const instancesLoading = derived(instanceStore, $store => $store.loading);
export const instancesError = derived(instanceStore, $store => $store.error);

// Store with instance count
export const instanceCount = derived(instances, $instances => $instances.length);

// Store for instances sorted by last played
export const instancesByLastPlayed = derived(instances, $instances => {
    return [...$instances].sort((a, b) => {
        if (!a.last_played && !b.last_played) return 0;
        if (!a.last_played) return 1;
        if (!b.last_played) return -1;
        return new Date(b.last_played) - new Date(a.last_played);
    });
});

// Store for instances sorted by creation date
export const instancesRecentlyAdded = derived(instances, $instances => {
    return [...$instances].sort((a, b) => {
        if (!a.created_at && !b.created_at) return 0;
        if (!a.created_at) return 1;
        if (!b.created_at) return -1;
        return new Date(b.created_at) - new Date(a.created_at);
    });
});
