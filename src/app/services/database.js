// @ts-nocheck
import sqlite3 from 'sqlite3';
import path from 'path';
import fs from 'fs/promises';
import { logger } from '../utils/logger.js';
import { instanceToDatabase } from '../types/instance.js';

class DatabaseService {
    constructor() {
        this.db = null;
        this.dbPath = null; // Will be set during initialization
    }

    /**
     * Get the correct WinterLauncher app data path (.WinterLauncher instead of WinterLauncher)
     */
    async getAppDataPath() {
        try {
            const { app } = await import('electron');
            const appDataPath = app.getPath('appData');
            return path.join(appDataPath, '.WinterLauncher');
        } catch (error) {
            logger.error('Failed to get app data path:', error);
            // Fallback to default userData path if electron is not available
            const { app } = await import('electron');
            return app.getPath('userData');
        }
    }

    async initialize() {
        try {
            // Get the correct app data path
            const winterLauncherPath = await this.getAppDataPath();
            
            // Ensure the directory exists
            await fs.mkdir(winterLauncherPath, { recursive: true });
            
            // Set the database path
            this.dbPath = path.join(winterLauncherPath, 'winterlauncher.db');
            
            this.db = new sqlite3.Database(this.dbPath);
            await this.createTables();
            // this.migrateResourcePacksAndShadersTables();
            logger.info('Database initialized successfully');
        } catch (error) {
            logger.error('Failed to initialize database:', error);
            throw error;
        }
    }

    createTables() {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                // Instances table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS instances (
                        id TEXT PRIMARY KEY,
                        name TEXT NOT NULL,
                        path TEXT,
                        icon TEXT,
                        game_version TEXT NOT NULL,
                        loader TEXT NOT NULL CHECK(loader IN ('vanilla', 'forge', 'fabric', 'quilt', 'neoforge')),
                        loader_version TEXT,
                        java_path TEXT,
                        memory_min INTEGER DEFAULT 2048,
                        memory_max INTEGER DEFAULT 4096,
                        jvm_args TEXT,
                        game_args TEXT,
                        description TEXT,
                        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        last_played DATETIME,
                        is_active BOOLEAN DEFAULT 0,
                        modpack_installation_status TEXT DEFAULT 'none' CHECK(modpack_installation_status IN ('none', 'pending', 'installing', 'completed', 'failed', 'cancelled')),
                        modpack_id TEXT,
                        modpack_name TEXT,
                        modpack_version_id TEXT,
                        modpack_version_name TEXT
                    )
                `);

                // Check if path column exists, add it if it doesn't
                try {
                    this.db.get("SELECT name FROM PRAGMA_TABLE_INFO('instances') WHERE name = 'path'", (error, row) => {
                        if (error) {
                            console.error('Error checking for path column:', error);
                            return;
                        }
                        
                        if (!row) {
                            console.log('Adding path column to instances table');
                            this.db.run("ALTER TABLE instances ADD COLUMN path TEXT", (alterError) => {
                                if (alterError) {
                                    console.error('Error adding path column:', alterError);
                                } else {
                                    console.log('Successfully added path column to instances table');
                                }
                            });
                        } else {
                            console.log('Path column already exists in instances table');
                        }
                    });
                } catch (error) {
                    console.error('Error in path column migration:', error);
                }

                // Mods table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS mods (
                        id TEXT PRIMARY KEY,
                        instance_id TEXT NOT NULL,
                        modrinth_id TEXT,
                        name TEXT NOT NULL,
                        version TEXT NOT NULL,
                        file_name TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        enabled BOOLEAN DEFAULT 1,
                        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
                    )
                `);

                // Resource packs table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS resource_packs (
                        id TEXT PRIMARY KEY,
                        instance_id TEXT NOT NULL,
                        modrinth_id TEXT,
                        name TEXT NOT NULL,
                        version TEXT,
                        file_name TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        enabled BOOLEAN DEFAULT 1,
                        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
                    )
                `);

                // Shaders table
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS shaders (
                        id TEXT PRIMARY KEY,
                        instance_id TEXT NOT NULL,
                        modrinth_id TEXT,
                        name TEXT NOT NULL,
                        version TEXT,
                        file_name TEXT NOT NULL,
                        file_path TEXT NOT NULL,
                        enabled BOOLEAN DEFAULT 1,
                        installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                        FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
                    )
                `);

                // Mod dependencies table (for tracking mod dependencies)
                this.db.run(`
                    CREATE TABLE IF NOT EXISTS mod_dependencies (
                        id TEXT PRIMARY KEY,
                        mod_id TEXT NOT NULL,
                        dependency_modrinth_id TEXT NOT NULL,
                        dependency_type TEXT CHECK(dependency_type IN ('required', 'optional')),
                        installed BOOLEAN DEFAULT 0,
                        FOREIGN KEY (mod_id) REFERENCES mods(id) ON DELETE CASCADE
                    )
                `);

                // Create indexes for better performance
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_instances_active ON instances(is_active)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_mods_instance ON mods(instance_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_mods_enabled ON mods(enabled)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_resource_packs_instance ON resource_packs(instance_id)`);
                this.db.run(`CREATE INDEX IF NOT EXISTS idx_shaders_instance ON shaders(instance_id)`);

                // Migrate existing instances to add paths if missing
                this.migrateInstances();
                
                // Fix Forge loader versions that are missing game version prefix
                this.migrateForgeLoaderVersions();
                
                // Migrate instances table to support NeoForge
                this.migrateLoaderConstraint();
                
                // Migrate mods table to add curseforge_id column
                // this.migrateModsTable();

                // Migrate instances table to add description column
                this.migrateDescriptionColumn();
                
                // Migrate instances table to add is_modpack column
                this.migrateIsModpackColumn();
                
                // Migrate instances table to add all modpack-related columns
                this.migrateModpackColumns();
                
                // Migrate mods table to add dependencies column
                this.migrateModsDependenciesColumn();

                // Migrate mods table to support 3rd party mods (remove modrinth_id constraint)
                this.migrateModsTableForThirdPartySupport();

                // Migrate resource packs and shaders to add curseforge_id
                // this.migrateResourcePacksAndShadersTables();

            }, (error) => {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    // Instance methods
    async createInstance(instance) {
        console.log(instance, '\n===============================')
        // Use existing ID if provided, otherwise generate a new one
        const id = instance.id || this.generateId();
        
        console.log('[DATABASE] Creating instance with universal structure:', JSON.stringify(instance, null, 2));
        console.log(`[DATABASE] Instance isModpack: ${instance.isModpack} (type: ${typeof instance.isModpack})`);
        console.log(`[DATABASE] Instance modpackId: ${instance.modpackId}`);
        console.log(`[DATABASE] Instance modpackData: ${instance.modpackData ? 'exists' : 'null'}`);
        console.log(`[DATABASE] Raw instance object keys:`, Object.keys(instance));
        
        // Convert to database format using universal structure
        const dbData = instanceToDatabase(instance);
        console.log('[DATABASE] Converted to database format:', JSON.stringify(dbData, null, 2));

        // Handle icon copying
        if (dbData.icon) {
            try {
                const appDataPath = await this.getAppDataPath();
                const instanceDir = path.join(appDataPath, 'instances', id);
                
                // Create instance directory if it doesn't exist
                await fs.mkdir(instanceDir, { recursive: true });

                if (dbData.icon.startsWith('data:image')) {
                    // Handle base64 image
                    const matches = dbData.icon.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                        const base64Data = matches[2];
                        const buffer = Buffer.from(base64Data, 'base64');
                        const destIconPath = path.join(instanceDir, `icon.${ext}`);
                        
                        await fs.writeFile(destIconPath, buffer);
                        console.log(`Saved base64 icon to ${destIconPath}`);
                        
                        // Update icon path to the persistent location
                        dbData.icon = destIconPath.replace(/\\/g, '/');
                    }
                } else {
                    // Check if icon is a file path (and not a http url or something else, though currently it is only file path)
                    // Also check if file exists
                    const stats = await fs.stat(dbData.icon);
                    if (stats.isFile()) {
                        const iconExt = path.extname(dbData.icon);
                        const destIconPath = path.join(instanceDir, `icon${iconExt}`);
                        
                        await fs.copyFile(dbData.icon, destIconPath);
                        console.log(`Copied icon from ${dbData.icon} to ${destIconPath}`);
                        
                        // Update icon path to the persistent location
                        dbData.icon = destIconPath.replace(/\\/g, '/');
                    }
                }
            } catch (err) {
                console.error('Failed to copy/save instance icon:', err);
                // Keep original icon path/data if copy fails
            }
        }

        return new Promise((resolve, reject) => {
            // Debug log to see what dbData contains
            console.log('[DATABASE SERVICE] createInstance called with dbData:', JSON.stringify(dbData, null, 2));
            console.log('[DATABASE SERVICE] Creating instance with ID:', dbData.id);
            
            // Extract variables from dbData with fallbacks for missing properties
            const name = dbData.name || '';
            const instancePath = dbData.path || dbData.instancePath || null;
            const icon = dbData.icon || null;
            const gameVersion = dbData.game_version || dbData.gameVersion || '';
            const loader = dbData.loader || 'vanilla';
            const loaderVersion = dbData.loader_version || dbData.loaderVersion || '';
            const javaPath = dbData.java_path || dbData.javaPath || null;
            const memoryMin = dbData.memory_min || dbData.memoryMin || 1024;
            const memoryMax = dbData.memory_max || dbData.memoryMax || 4096;
            const jvmArgs = dbData.jvm_args || dbData.jvmArgs || '';
            const gameArgs = dbData.game_args || dbData.gameArgs || '';
            const description = dbData.description || '';
            const isModpack = dbData.is_modpack || dbData.isModpack || false;
            const modpackId = dbData.modpack_id || dbData.modpackId || null;
            const modpackName = dbData.modpack_name || dbData.modpackName || null;
            const modpackVersionId = dbData.modpack_version_id || dbData.modpackVersionId || null;
            const modpackVersionName = dbData.modpack_version_name || dbData.modpackVersionName || null;
            const modpackDataJson = dbData.modpack_data || dbData.modpackData || null;

            console.log(`[DATABASE SERVICE] Extracted data for instance ${dbData.id}:`, {
                name, instancePath, icon, gameVersion, loader, loaderVersion,
                isModpack, modpackId, modpackName, modpackVersionId, modpackVersionName
            });

            // Prepare modpack data as JSON string if provided
            const finalModpackDataJson = modpackDataJson || null;

            // Validate and fix Forge loader version if needed (skip if 'latest')
            if (loader === 'forge' && loaderVersion && loaderVersion !== 'latest' && gameVersion) {
                // Check if the version needs fixing (e.g., "60.1.0" should be "1.21.10-60.1.0")
                if (!loaderVersion.startsWith(gameVersion + '-') && /^\d+\.\d+\.\d+$/.test(loaderVersion)) {
                    const fixedVersion = `${gameVersion}-${loaderVersion}`;
                    console.log(`Fixed Forge loader version during creation: ${loaderVersion} -> ${fixedVersion}`);
                    dbData.loader_version = fixedVersion;
                }
            }

            // Try with path column first
            this.db.run(
                `INSERT INTO instances (id, name, path, icon, game_version, loader, loader_version, java_path, memory_min, memory_max, jvm_args, game_args, description, is_modpack, modpack_id, modpack_name, modpack_version_id, modpack_version_name, modpack_data)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, name, instancePath, icon, gameVersion, loader, loaderVersion, javaPath, memoryMin, memoryMax, jvmArgs, gameArgs, description, isModpack, modpackId, modpackName, modpackVersionId, modpackVersionName, finalModpackDataJson],
                function(error) {
                    if (error) {
                        console.error('[DATABASE SERVICE] First insert failed:', error.message);
                        console.error('[DATABASE SERVICE] Full error details:', error);
                        
                        // Check which columns exist and build a dynamic query
                        this.db.all("PRAGMA table_info(instances)", (pragmaError, columns) => {
                            if (pragmaError) {
                                console.error('[DATABASE SERVICE] Failed to get table info:', pragmaError);
                                reject(error);
                                return;
                            }
                            
                            const existingColumns = columns.map(col => col.name);
                            console.log('[DATABASE SERVICE] Existing columns:', existingColumns);
                            
                            // Build dynamic insert query with only existing columns
                            const insertColumns = [];
                            const insertValues = [];
                            const valuePlaceholders = [];
                            
                            const columnMapping = {
                                'id': id,
                                'name': name,
                                'path': instancePath,
                                'icon': icon,
                                'game_version': gameVersion,
                                'loader': loader,
                                'loader_version': loaderVersion,
                                'java_path': javaPath,
                                'memory_min': memoryMin,
                                'memory_max': memoryMax,
                                'jvm_args': jvmArgs,
                                'game_args': gameArgs,
                                'description': description,
                                'is_modpack': isModpack,
                                'modpack_id': modpackId,
                                'modpack_name': modpackName,
                                'modpack_version_id': modpackVersionId,
                                'modpack_version_name': modpackVersionName,
                                'modpack_data': finalModpackDataJson
                            };
                            
                            for (const [colName, value] of Object.entries(columnMapping)) {
                                if (existingColumns.includes(colName)) {
                                    insertColumns.push(colName);
                                    insertValues.push(value);
                                    valuePlaceholders.push('?');
                                }
                            }
                            
                            console.log(`[DATABASE SERVICE] Dynamic insert columns:`, insertColumns);
                            console.log(`[DATABASE SERVICE] Dynamic insert values:`, insertValues);
                            
                            const dynamicQuery = `INSERT INTO instances (${insertColumns.join(', ')}) VALUES (${valuePlaceholders.join(', ')})`;
                            console.log('[DATABASE SERVICE] Dynamic query:', dynamicQuery);
                            console.log('[DATABASE SERVICE] Dynamic values:', insertValues);
                            
                            this.db.run(dynamicQuery, insertValues, function(dynamicError) {
                                if (dynamicError) {
                                    console.error('[DATABASE SERVICE] Dynamic insert failed:', dynamicError);
                                    reject(dynamicError);
                                } else {
                                    console.log('[DATABASE SERVICE] Dynamic insert successful');
                                    // Return the created instance in database format for mapping
                                    const createdInstance = { id, ...dbData };
                                    console.log('[DATABASE SERVICE] Created instance (database format):', JSON.stringify(createdInstance, null, 2));
                                    resolve(createdInstance);
                                }
                            });
                        });
                    } else {
                        console.log('[DATABASE SERVICE] First insert successful');
                        // Return the created instance in database format for mapping
                        const createdInstance = { id, ...dbData };
                        console.log('[DATABASE SERVICE] Created instance (database format):', JSON.stringify(createdInstance, null, 2));
                        console.log(`[DATABASE SERVICE] Instance ${id} created successfully in database`);
                        resolve(createdInstance);
                    }
                }.bind(this)
            );
        });
    }

    async getInstances() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT * FROM instances ORDER BY created_at DESC', (error, rows) => {
                if (error) {
                    reject(error);
                } else {
                    console.log(`[getInstances] Found ${rows.length} instances from database`);
                    // Map database column names to frontend property names
                    const mappedRows = rows.map(row => {
                        console.log(`[getInstances] Raw row ${row.id}: is_modpack=${row.is_modpack} (type: ${typeof row.is_modpack}), modpack_id=${row.modpack_id}, modpack_data=${row.modpack_data ? 'exists' : 'null'}`);
                        console.log(`[getInstances] Processing instance ${row.id}: modpack_data = ${row.modpack_data?.substring(0, 50)}...`);
                        const mapped = this.mapInstanceRow(row);
                        console.log(`[getInstances] Mapped instance ${mapped.id}: isModpack=${mapped.isModpack}, modpackData = ${mapped.modpackData ? 'object' : 'null'}`);
                        return mapped;
                    });
                    resolve(mappedRows);
                }
            });
        });
    }

    async getInstance(id) {
        console.log(`[DATABASE] getInstance called with id: ${id}`);
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM instances WHERE id = ?', [id], (error, row) => {
                if (error) {
                    console.error(`[DATABASE] Error getting instance ${id}:`, error);
                    reject(error);
                } else {
                    console.log(`[DATABASE] Raw database row for instance ${id}:`, row ? 'found' : 'not found');
                    if (row) {
                        console.log(`[getInstance] Processing instance ${row.id}: modpack_data = ${row.modpack_data?.substring(0, 50)}...`);
                        const mapped = this.mapInstanceRow(row);
                        console.log(`[getInstance] Mapped instance ${mapped.id}: modpackData = ${mapped.modpackData ? 'object' : 'null'}`);
                        resolve(mapped);
                    } else {
                        console.log(`[DATABASE] Instance ${id} not found in database`);
                        resolve(null);
                    }
                }
            });
        });
    }

    async updateInstance(id, updates) {
        // Handle icon update
        if (updates.icon) {
            try {
                const appDataPath = await this.getAppDataPath();
                const instanceDir = path.join(appDataPath, 'instances', id);
                
                // Ensure directory exists
                await fs.mkdir(instanceDir, { recursive: true });

                if (updates.icon.startsWith('data:image')) {
                    // Handle base64 image
                    const matches = updates.icon.match(/^data:image\/([a-zA-Z+]+);base64,(.+)$/);
                    if (matches && matches.length === 3) {
                        const ext = matches[1] === 'jpeg' ? 'jpg' : matches[1];
                        const base64Data = matches[2];
                        const buffer = Buffer.from(base64Data, 'base64');
                        const destIconPath = path.join(instanceDir, `icon.${ext}`);
                        
                        await fs.writeFile(destIconPath, buffer);
                        console.log(`Saved updated base64 icon to ${destIconPath}`);
                        
                        updates.icon = destIconPath.replace(/\\/g, '/');
                    }
                } else {
                    // Check if file exists and is a file
                    const stats = await fs.stat(updates.icon);
                    if (stats.isFile()) {
                        // Check if the icon is already in the instance directory
                        // Normalize paths for comparison
                        const normalizedIconPath = path.resolve(updates.icon).toLowerCase();
                        const normalizedInstanceDir = path.resolve(instanceDir).toLowerCase();
                        
                        if (!normalizedIconPath.startsWith(normalizedInstanceDir)) {
                            const iconExt = path.extname(updates.icon);
                            const destIconPath = path.join(instanceDir, `icon${iconExt}`);
                            
                            await fs.copyFile(updates.icon, destIconPath);
                            console.log(`Copied updated icon from ${updates.icon} to ${destIconPath}`);
                            
                            updates.icon = destIconPath.replace(/\\/g, '/');
                        }
                    }
                }
            } catch (err) {
                console.error('Failed to copy/save updated instance icon:', err);
                // Continue with original path if copy fails
            }
        }

        return new Promise((resolve, reject) => {
            const allowedFields = ['name', 'path', 'icon', 'java_path', 'memory_min', 'memory_max', 'jvm_args', 'game_args', 'description', 'last_played', 'is_active', 'is_modpack', 'modpack_installation_status', 'modpack_id', 'modpack_name', 'modpack_version_id', 'modpack_version_name', 'modpack_data', 'loader_version'];
            
            // Validate modpack_installation_status if it's being updated
            if (updates.modpack_installation_status) {
                const status = updates.modpack_installation_status;
                const allowedStatuses = ['none', 'pending', 'installing', 'completed', 'failed', 'cancelled'];
                console.log(`[DATABASE SERVICE] Validating modpack_installation_status: "${status}"`);
                if (!allowedStatuses.includes(status)) {
                    console.error(`[DATABASE SERVICE] INVALID STATUS DETECTED: "${status}" is not in allowed list:`, allowedStatuses);
                    console.error(`[DATABASE SERVICE] Full updates object:`, JSON.stringify(updates, null, 2));
                    console.error(`[DATABASE SERVICE] Stack trace:`, new Error().stack);
                    reject(new Error(`Invalid modpack_installation_status: "${status}". Must be one of: ${allowedStatuses.join(', ')}`));
                    return;
                }
            }
            
            // Handle modpack_data serialization if provided
            const processedUpdates = { ...updates };
            if (processedUpdates.modpack_data && typeof processedUpdates.modpack_data === 'object') {
                try {
                    processedUpdates.modpack_data = JSON.stringify(processedUpdates.modpack_data);
                    console.log(`[DATABASE SERVICE] Serialized modpack_data for update, length: ${processedUpdates.modpack_data.length}`);
                } catch (e) {
                    console.error(`[DATABASE SERVICE] Failed to serialize modpack_data:`, e);
                    delete processedUpdates.modpack_data; // Remove it to avoid storing invalid data
                }
            }
            
            // Debug modpack_id update
            if (processedUpdates.modpack_id !== undefined) {
                console.log(`[DATABASE SERVICE] Processing modpack_id update: "${processedUpdates.modpack_id}"`);
            }
            
            // Debug is_modpack update
            if (processedUpdates.is_modpack !== undefined) {
                console.log(`[DATABASE SERVICE] Processing is_modpack update: ${processedUpdates.is_modpack} (type: ${typeof processedUpdates.is_modpack})`);
            }
            
            const fields = Object.keys(processedUpdates).filter(key => allowedFields.includes(key));
            const values = fields.map(field => processedUpdates[field]);
            
            if (fields.length === 0) {
                resolve();
                return;
            }

            const setClause = fields.map(field => `${field} = ?`).join(', ');
            values.push(id);
            
            console.log(`[DATABASE SERVICE] UPDATE instances SET ${setClause} WHERE id = ?`);
            console.log(`[DATABASE SERVICE] Values:`, values);

            this.db.run(
                `UPDATE instances SET ${setClause} WHERE id = ?`,
                values,
                function(error) {
                    if (error) {
                        console.error(`[DATABASE SERVICE] UPDATE FAILED:`, error);
                        reject(error);
                    } else {
                        console.log(`[DATABASE SERVICE] UPDATE SUCCESS: ${this.changes} rows changed`);
                        resolve();
                    }
                }
            );
        });
    }

    async deleteInstance(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM instances WHERE id = ?', [id], function(error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async setActiveInstance(id) {
        return new Promise((resolve, reject) => {
            this.db.serialize(() => {
                this.db.run('UPDATE instances SET is_active = 0 WHERE is_active = 1');
                this.db.run('UPDATE instances SET is_active = 1 WHERE id = ?', [id], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        });
    }

    async getActiveInstance() {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM instances WHERE is_active = 1', (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row ? this.mapInstanceRow(row) : null);
                }
            });
        });
    }

    // Mod methods
    async addMod(mod) {
        return new Promise((resolve, reject) => {
            console.log('[DATABASE SERVICE] addMod called with:', JSON.stringify(mod, null, 2));
            const id = this.generateId();
            const {
                instanceId,
                modrinthId = null,
                name,
                version,
                fileName,
                filePath,
                enabled = true,
                dependencies = '[]'
            } = mod;
            
            console.log('[DATABASE SERVICE] Extracted instanceId:', instanceId);
            
            // Validate required fields
            if (!instanceId) {
                console.error('[DATABASE SERVICE] instanceId is null or undefined in addMod:', mod);
                reject(new Error('instanceId is required for adding a mod'));
                return;
            }
            if (!name) {
                console.error('[DATABASE SERVICE] name is null or undefined in addMod:', mod);
                reject(new Error('name is required for adding a mod'));
                return;
            }
            if (!fileName) {
                console.error('[DATABASE SERVICE] fileName is null or undefined in addMod:', mod);
                reject(new Error('fileName is required for adding a mod'));
                return;
            }

            this.db.run(
                `INSERT INTO mods (id, instance_id, modrinth_id, name, version, file_name, file_path, enabled, dependencies)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, instanceId, modrinthId, name, version, fileName, filePath, enabled, dependencies],
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ id, ...mod });
                    }
                }
            );
        });
    }

    async getInstanceMods(instanceId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM mods WHERE instance_id = ? ORDER BY name ASC',
                [instanceId],
                (error, rows) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async getMod(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM mods WHERE id = ?', [id], (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async updateMod(id, updates) {
        return new Promise((resolve, reject) => {
            const allowedFields = ['enabled', 'version', 'updated_at'];
            const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
            const values = fields.map(field => updates[field]);
            
            if (fields.length === 0) {
                resolve();
                return;
            }

            const setClause = fields.map(field => `${field} = ?`).join(', ');
            values.push(id);

            this.db.run(
                `UPDATE mods SET ${setClause} WHERE id = ?`,
                values,
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async removeMod(id) {
        return new Promise((resolve, reject) => {
            this.db.run('DELETE FROM mods WHERE id = ?', [id], function(error) {
                if (error) {
                    reject(error);
                } else {
                    resolve();
                }
            });
        });
    }

    async deleteMod(id) {
        try {
            // First get the mod details to find the file path
            const mod = await this.getMod(id);
            if (!mod) {
                logger.warn(`Mod ${id} not found in database, skipping deletion`);
                return; // Return early if mod doesn't exist
            }

            logger.info(`Attempting to delete mod: ${mod.name} (ID: ${id})`);
            logger.info(`Mod file path: ${mod.file_path}`);
            logger.info(`Mod file name: ${mod.file_name}`);
            logger.info(`Instance ID: ${mod.instance_id}`);

            // Delete the actual file if it exists
            if (mod.file_path) {
                try {
                    // Normalize the path first (convert forward slashes to backslashes on Windows)
                    const normalizedPath = path.resolve(mod.file_path);
                    logger.info(`Using normalized path: ${normalizedPath}`);
                    
                    // Check if file exists first
                    try {
                        await fs.access(normalizedPath);
                        logger.info(`File exists and will be deleted: ${normalizedPath}`);
                        
                        // Also check file stats for more info
                        const stats = await fs.stat(normalizedPath);
                        logger.info(`File stats: size=${stats.size}, isFile=${stats.isFile()}`);
                        
                        // Try to delete the file
                        await fs.unlink(normalizedPath);
                        logger.info(`Successfully deleted mod file: ${normalizedPath}`);
                    } catch (accessError) {
                        logger.warn(`File does not exist or is not accessible: ${normalizedPath}`);
                        logger.warn(`Access error: ${accessError.message}`);
                        logger.warn(`Error code: ${accessError.code}`);
                        
                        // Try to get more info about the directory
                        const dirPath = path.dirname(normalizedPath);
                        logger.info(`Directory path: ${dirPath}`);
                        
                        try {
                            const dirContents = await fs.readdir(dirPath);
                            logger.info(`Directory contents: ${dirContents.join(', ')}`);
                        } catch (dirError) {
                            logger.error(`Cannot read directory: ${dirError.message}`);
                        }
                        
                        throw accessError;
                    }
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        logger.warn(`Mod file not found for deletion: ${mod.file_path}`);
                    } else {
                        logger.error(`Failed to delete mod file: ${mod.file_path}`, fileError);
                        logger.error(`Error details: ${fileError.message}`);
                        logger.error(`Error code: ${fileError.code}`);
                        // Continue with database deletion even if file deletion fails
                    }
                }
            } else {
                logger.warn(`No file_path found for mod: ${mod.name}`);
            }

            // Remove from database
            return this.removeMod(id);
        } catch (error) {
            logger.error('Failed to delete mod:', error);
            throw error;
        }
    }

    async removeModsByInstance(instanceId) {
        try {
            // First get all mods for this instance to delete their files
            const mods = await this.getInstanceMods(instanceId);
            
            // Delete all mod files
            for (const mod of mods) {
                if (mod.file_path) {
                    try {
                        // Normalize the path first
                        const normalizedPath = path.resolve(mod.file_path);
                        logger.info(`Deleting mod file: ${normalizedPath}`);
                        
                        await fs.unlink(normalizedPath);
                        logger.info(`Deleted mod file: ${normalizedPath}`);
                    } catch (fileError) {
                        if (fileError.code === 'ENOENT') {
                            logger.warn(`Mod file not found for deletion: ${mod.file_path}`);
                        } else {
                            logger.error(`Failed to delete mod file: ${mod.file_path}`, fileError);
                        }
                    }
                }
            }
            
            // Remove from database
            return new Promise((resolve, reject) => {
                this.db.run('DELETE FROM mods WHERE instance_id = ?', [instanceId], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger.error('Failed to remove mods by instance:', error);
            throw error;
        }
    }

    // Add clear methods for modpack repair functionality
    async clearInstanceMods(instanceId) {
        try {
            logger.info(`Clearing mods for instance: ${instanceId}`);
            
            // Just delete from database - files are already handled by repair function
            return new Promise((resolve, reject) => {
                this.db.run('DELETE FROM mods WHERE instance_id = ?', [instanceId], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        logger.info(`Cleared ${this.changes} mods from database for instance: ${instanceId}`);
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger.error('Failed to clear instance mods:', error);
            throw error;
        }
    }

    async clearInstanceResourcePacks(instanceId) {
        try {
            logger.info(`Clearing resource packs for instance: ${instanceId}`);
            
            return new Promise((resolve, reject) => {
                this.db.run('DELETE FROM resource_packs WHERE instance_id = ?', [instanceId], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        logger.info(`Cleared ${this.changes} resource packs from database for instance: ${instanceId}`);
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger.error('Failed to clear instance resource packs:', error);
            throw error;
        }
    }

    async clearInstanceShaderPacks(instanceId) {
        try {
            logger.info(`Clearing shader packs for instance: ${instanceId}`);
            
            return new Promise((resolve, reject) => {
                this.db.run('DELETE FROM shaders WHERE instance_id = ?', [instanceId], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        logger.info(`Cleared ${this.changes} shader packs from database for instance: ${instanceId}`);
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger.error('Failed to clear instance shader packs:', error);
            throw error;
        }
    }

    // Resource pack methods
    async addResourcePack(resourcePack) {
        return new Promise((resolve, reject) => {
            const id = this.generateId();
            const {
                instanceId,
                modrinthId = null,
                name,
                version = null,
                fileName,
                filePath,
                enabled = true
            } = resourcePack;

            this.db.run(
                `INSERT INTO resource_packs (id, instance_id, modrinth_id, name, version, file_name, file_path, enabled)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, instanceId, modrinthId, name, version, fileName, filePath, enabled],
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ id, ...resourcePack });
                    }
                }
            );
        });
    }

    async getInstanceResourcePacks(instanceId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM resource_packs WHERE instance_id = ? ORDER BY name ASC',
                [instanceId],
                (error, rows) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async updateResourcePack(id, updates) {
        return new Promise((resolve, reject) => {
            const allowedFields = ['enabled', 'version', 'updated_at'];
            const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
            const values = fields.map(field => updates[field]);
            
            if (fields.length === 0) {
                resolve();
                return;
            }

            const setClause = fields.map(field => `${field} = ?`).join(', ');
            values.push(id);

            this.db.run(
                `UPDATE resource_packs SET ${setClause} WHERE id = ?`,
                values,
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getResourcePack(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM resource_packs WHERE id = ?', [id], (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async deleteResourcePack(id) {
        try {
            // Get resource pack details first to delete the file
            const resourcePack = await this.getResourcePack(id);
            if (resourcePack && resourcePack.file_path) {
                const normalizedPath = path.normalize(resourcePack.file_path);
                // Check if file exists before trying to delete
                try {
                    await fs.access(normalizedPath);
                    await fs.unlink(normalizedPath);
                    logger.info(`Deleted resource pack file: ${normalizedPath}`);
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        logger.warn(`Resource pack file not found for deletion: ${resourcePack.file_path}`);
                    } else {
                        logger.error(`Failed to delete resource pack file: ${resourcePack.file_path}`, fileError);
                    }
                }
            }

            return new Promise((resolve, reject) => {
                this.db.run('DELETE FROM resource_packs WHERE id = ?', [id], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger.error('Failed to delete resource pack:', error);
            throw error;
        }
    }

    // Shader methods
    async addShader(shader) {
        return new Promise((resolve, reject) => {
            const id = this.generateId();
            const {
                instanceId,
                modrinthId = null,
                name,
                version = null,
                fileName,
                filePath,
                enabled = true
            } = shader;

            this.db.run(
                `INSERT INTO shaders (id, instance_id, modrinth_id, name, version, file_name, file_path, enabled)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [id, instanceId, modrinthId, name, version, fileName, filePath, enabled],
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve({ id, ...shader });
                    }
                }
            );
        });
    }

    async getInstanceShaders(instanceId) {
        return new Promise((resolve, reject) => {
            this.db.all(
                'SELECT * FROM shaders WHERE instance_id = ? ORDER BY name ASC',
                [instanceId],
                (error, rows) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(rows);
                    }
                }
            );
        });
    }

    async updateShader(id, updates) {
        return new Promise((resolve, reject) => {
            const allowedFields = ['enabled', 'version', 'updated_at'];
            const fields = Object.keys(updates).filter(key => allowedFields.includes(key));
            const values = fields.map(field => updates[field]);
            
            if (fields.length === 0) {
                resolve();
                return;
            }

            const setClause = fields.map(field => `${field} = ?`).join(', ');
            values.push(id);

            this.db.run(
                `UPDATE shaders SET ${setClause} WHERE id = ?`,
                values,
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async getShader(id) {
        return new Promise((resolve, reject) => {
            this.db.get('SELECT * FROM shaders WHERE id = ?', [id], (error, row) => {
                if (error) {
                    reject(error);
                } else {
                    resolve(row);
                }
            });
        });
    }

    async deleteShader(id) {
        try {
            // Get shader details first to delete the file
            const shader = await this.getShader(id);
            if (shader && shader.file_path) {
                const normalizedPath = path.normalize(shader.file_path);
                // Check if file exists before trying to delete
                try {
                    await fs.access(normalizedPath);
                    await fs.unlink(normalizedPath);
                    logger.info(`Deleted shader file: ${normalizedPath}`);
                } catch (fileError) {
                    if (fileError.code === 'ENOENT') {
                        logger.warn(`Shader file not found for deletion: ${shader.file_path}`);
                    } else {
                        logger.error(`Failed to delete shader file: ${shader.file_path}`, fileError);
                    }
                }
            }

            return new Promise((resolve, reject) => {
                this.db.run('DELETE FROM shaders WHERE id = ?', [id], function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            });
        } catch (error) {
            logger.error('Failed to delete shader:', error);
            throw error;
        }
    }


    // Migrate existing instances to add paths if missing or incorrect
    async migrateInstances() {
        return new Promise((resolve, reject) => {
            // Get instances without paths or with relative paths
            this.db.all('SELECT id, name, path FROM instances WHERE path IS NULL OR path = "" OR path LIKE "./instances/%"', async (error, rows) => {
                if (error) {
                    logger.error('Failed to migrate instances:', error);
                    reject(error);
                    return;
                }

                if (rows.length === 0) {
                    resolve();
                    return;
                }

                logger.info(`Migrating ${rows.length} instances to fix paths`);

                try {
                    // Get the correct app data path
                    const appDataPath = await this.getAppDataPath();
                    
                    // Update each instance with a path using the proper app data directory
                    for (const instance of rows) {
                        const instancePath = path.join(appDataPath, 'instances', instance.id);
                        this.db.run('UPDATE instances SET path = ? WHERE id = ?', [instancePath, instance.id], (updateError) => {
                            if (updateError) {
                                logger.error(`Failed to update path for instance ${instance.id}:`, updateError);
                            } else {
                                logger.info(`Updated path for instance ${instance.id}: ${instancePath}`);
                            }
                        });
                    }
                } catch (appError) {
                    logger.error('Failed to get app data path:', appError);
                    reject(appError);
                    return;
                }

                resolve();
            });
        });
    }

    // Force migrate all instance paths to use correct app data directory
    async forceMigrateInstancePaths() {
        return new Promise((resolve, reject) => {
            this.db.all('SELECT id, name, path FROM instances', async (error, rows) => {
                if (error) {
                    logger.error('Failed to get instances for migration:', error);
                    reject(error);
                    return;
                }

                if (rows.length === 0) {
                    resolve();
                    return;
                }

                logger.info(`Force migrating ${rows.length} instance paths`);

                try {
                    const appDataPath = await this.getAppDataPath();
                    
                    for (const instance of rows) {
                        const correctPath = path.join(appDataPath, 'instances', instance.id);
                        
                        // Only update if the path is different from the correct path
                        if (instance.path !== correctPath) {
                            this.db.run('UPDATE instances SET path = ? WHERE id = ?', [correctPath, instance.id], (updateError) => {
                                if (updateError) {
                                    logger.error(`Failed to update path for instance ${instance.id}:`, updateError);
                                } else {
                                    logger.info(`Updated path for instance ${instance.id}: ${instance.path} -> ${correctPath}`);
                                }
                            });
                        }
                    }
                } catch (appError) {
                    logger.error('Failed to get app data path:', appError);
                    reject(appError);
                    return;
                }

                resolve();
            });
        });
    }

    // Migrate instances table to support NeoForge (add 'neoforge' to CHECK constraint)
    async migrateLoaderConstraint() {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='instances'", (error, row) => {
                if (error) {
                    logger.error('Failed to check instances table schema:', error);
                    resolve();
                    return;
                }

                if (row && row.sql && !row.sql.includes("'neoforge'")) {
                    logger.info('Migrating instances table to support NeoForge...');
                    
                    this.db.serialize(() => {
                        this.db.run("PRAGMA foreign_keys=off");
                        this.db.run("BEGIN TRANSACTION");
                        
                        // 1. Rename old table
                        this.db.run("ALTER TABLE instances RENAME TO instances_old");
                        
                        // 2. Create new table with updated constraint
                        this.db.run(`
                            CREATE TABLE instances (
                                id TEXT PRIMARY KEY,
                                name TEXT NOT NULL,
                                path TEXT,
                                icon TEXT,
                                game_version TEXT NOT NULL,
                                loader TEXT NOT NULL CHECK(loader IN ('vanilla', 'forge', 'fabric', 'quilt', 'neoforge')),
                                loader_version TEXT,
                                java_path TEXT,
                                memory_min INTEGER DEFAULT 2048,
                                memory_max INTEGER DEFAULT 4096,
                                jvm_args TEXT,
                                game_args TEXT,
                                created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                last_played DATETIME,
                                is_active BOOLEAN DEFAULT 0,
                                modpack_installation_status TEXT DEFAULT 'none' CHECK(modpack_installation_status IN ('none', 'pending', 'installing', 'completed', 'failed', 'cancelled'))
                            )
                        `);
                        
                        // 3. Copy data
                        this.db.run(`
                            INSERT INTO instances (
                                id, name, path, icon, game_version, loader, loader_version, 
                                java_path, memory_min, memory_max, jvm_args, game_args, 
                                created_at, last_played, is_active, modpack_installation_status,
                                modpack_id, modpack_name, modpack_version_id, modpack_version_name
                            )
                            SELECT 
                                id, name, path, icon, game_version, loader, loader_version, 
                                java_path, memory_min, memory_max, jvm_args, game_args, 
                                created_at, last_played, is_active, 'none',
                                NULL, NULL, NULL, NULL
                            FROM instances_old
                        `);
                        
                        // 4. Drop old table
                        this.db.run("DROP TABLE instances_old");
                        
                        this.db.run("COMMIT", (err) => {
                            if (err) {
                                logger.error('Failed to commit NeoForge migration:', err);
                                this.db.run("ROLLBACK");
                            } else {
                                this.db.run("PRAGMA foreign_keys=on");
                                logger.info('Successfully migrated instances table for NeoForge');
                            }
                            resolve();
                        });
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    // Fix Forge loader versions that are missing game version prefix
    async migrateForgeLoaderVersions() {
        return new Promise((resolve, reject) => {
            // Get Forge instances with potentially problematic loader versions
            this.db.all('SELECT id, game_version, loader, loader_version FROM instances WHERE loader = "forge" AND loader_version IS NOT NULL', async (error, rows) => {
                if (error) {
                    logger.error('Failed to check Forge loader versions:', error);
                    reject(error);
                    return;
                }

                if (rows.length === 0) {
                    resolve();
                    return;
                }

                logger.info(`Checking ${rows.length} Forge instances for loader version issues`);

                // Update instances with problematic loader versions
                let fixedCount = 0;
                for (const instance of rows) {
                    const { id, game_version, loader_version } = instance;
                    
                    // Check if the version needs fixing (e.g., "60.1.0" should be "1.21.10-60.1.0")
                    if (loader_version && !loader_version.startsWith(game_version + '-') && /^\d+\.\d+\.\d+$/.test(loader_version)) {
                        const fixedVersion = `${game_version}-${loader_version}`;
                        
                        this.db.run('UPDATE instances SET loader_version = ? WHERE id = ?', [fixedVersion, id], (updateError) => {
                            if (updateError) {
                                logger.error(`Failed to fix loader version for instance ${id}:`, updateError);
                            } else {
                                logger.info(`Fixed Forge loader version for instance ${id}: ${loader_version} -> ${fixedVersion}`);
                                fixedCount++;
                            }
                        });
                    }
                }

                if (fixedCount > 0) {
                    logger.info(`Fixed ${fixedCount} Forge instances with incorrect loader versions`);
                }

                resolve();
            });
        });
    }

    // Migrate mods table to add curseforge_id column
    async migrateModsTable() {
        return new Promise((resolve, reject) => {
            // Check if curseforge_id column exists
            this.db.get("SELECT * FROM pragma_table_info('mods') WHERE name = 'curseforge_id'", (checkError, row) => {
                if (checkError) {
                    logger.error('Failed to check curseforge_id column:', checkError);
                    reject(checkError);
                    return;
                }

                if (row) {
                    logger.info('curseforge_id column already exists in mods table');
                    resolve();
                    return;
                }

                // Add curseforge_id column
                logger.info('Adding curseforge_id column to mods table');
                this.db.run("ALTER TABLE mods ADD COLUMN curseforge_id TEXT", (alterError) => {
                    if (alterError) {
                        logger.error('Error adding curseforge_id column:', alterError);
                        reject(alterError);
                        return;
                    }

                    logger.info('Successfully added curseforge_id column to mods table');
                    resolve();
                });
            });
        });
    }

    // Migrate instances table to add description column
    async migrateDescriptionColumn() {
        return new Promise((resolve, reject) => {
            // Check if description column exists
            this.db.get("SELECT * FROM pragma_table_info('instances') WHERE name = 'description'", (checkError, row) => {
                if (checkError) {
                    logger.error('Failed to check description column:', checkError);
                    reject(checkError);
                    return;
                }

                if (row) {
                    logger.info('description column already exists in instances table');
                    resolve();
                    return;
                }

                // Add description column
                logger.info('Adding description column to instances table');
                this.db.run("ALTER TABLE instances ADD COLUMN description TEXT", (alterError) => {
                    if (alterError) {
                        logger.error('Error adding description column:', alterError);
                        reject(alterError);
                        return;
                    }

                    logger.info('Successfully added description column to instances table');
                    resolve();
                });
            });
        });
    }

    // Migrate instances table to add is_modpack column
    async migrateIsModpackColumn() {
        return new Promise((resolve, reject) => {
            // Check if is_modpack column exists
            this.db.get("SELECT * FROM pragma_table_info('instances') WHERE name = 'is_modpack'", (checkError, row) => {
                if (checkError) {
                    logger.error('Failed to check is_modpack column:', checkError);
                    reject(checkError);
                    return;
                }

                if (row) {
                    logger.info('is_modpack column already exists in instances table');
                    resolve();
                    return;
                }

                // Add is_modpack column
                logger.info('Adding is_modpack column to instances table');
                this.db.run("ALTER TABLE instances ADD COLUMN is_modpack BOOLEAN DEFAULT 0", (alterError) => {
                    if (alterError) {
                        logger.error('Error adding is_modpack column:', alterError);
                        reject(alterError);
                        return;
                    }

                    logger.info('Successfully added is_modpack column to instances table');
                    resolve();
                });
            });
        });
    }

    // Migrate instances table to add all modpack-related columns
    async migrateModpackColumns() {
        return new Promise((resolve, reject) => {
            const modpackColumns = [
                {
                    name: 'modpack_installation_status',
                    definition: "TEXT DEFAULT 'none' CHECK(modpack_installation_status IN ('none', 'pending', 'installing', 'completed', 'failed', 'cancelled'))"
                },
                {
                    name: 'modpack_id',
                    definition: 'TEXT'
                },
                {
                    name: 'modpack_name',
                    definition: 'TEXT'
                },
                {
                    name: 'modpack_version_id',
                    definition: 'TEXT'
                },
                {
                    name: 'modpack_version_name',
                    definition: 'TEXT'
                },
                {
                    name: 'modpack_data',
                    definition: 'TEXT'  // Will store JSON string of complete modpack data
                }
            ];

            let completedMigrations = 0;
            const totalMigrations = modpackColumns.length;

            if (totalMigrations === 0) {
                resolve();
                return;
            }

            modpackColumns.forEach(column => {
                // Check if column exists
                this.db.get(`SELECT * FROM pragma_table_info('instances') WHERE name = '${column.name}'`, (checkError, row) => {
                    if (checkError) {
                        logger.error(`Failed to check ${column.name} column:`, checkError);
                        completedMigrations++;
                        if (completedMigrations === totalMigrations) {
                            resolve();
                        }
                        return;
                    }

                    if (row) {
                        logger.info(`${column.name} column already exists in instances table`);
                        completedMigrations++;
                        if (completedMigrations === totalMigrations) {
                            resolve();
                        }
                        return;
                    }

                    // Add the column
                    logger.info(`Adding ${column.name} column to instances table`);
                    this.db.run(`ALTER TABLE instances ADD COLUMN ${column.name} ${column.definition}`, (alterError) => {
                        if (alterError) {
                            logger.error(`Error adding ${column.name} column:`, alterError);
                        } else {
                            logger.info(`Successfully added ${column.name} column to instances table`);
                        }
                        completedMigrations++;
                        if (completedMigrations === totalMigrations) {
                            resolve();
                        }
                    });
                });
            });
        });
    }

    // Migrate mods table to add dependencies column
    async migrateModsDependenciesColumn() {
        return new Promise((resolve, reject) => {
            // Check if dependencies column exists
            this.db.get("SELECT * FROM pragma_table_info('mods') WHERE name = 'dependencies'", (checkError, row) => {
                if (checkError) {
                    logger.error('Failed to check dependencies column:', checkError);
                    reject(checkError);
                    return;
                }

                if (row) {
                    logger.info('dependencies column already exists in mods table');
                    resolve();
                    return;
                }

                // Add dependencies column
                logger.info('Adding dependencies column to mods table');
                this.db.run("ALTER TABLE mods ADD COLUMN dependencies TEXT DEFAULT '[]'", (alterError) => {
                    if (alterError) {
                        logger.error('Error adding dependencies column:', alterError);
                        reject(alterError);
                        return;
                    }

                    logger.info('Successfully added dependencies column to mods table');
                    resolve();
                });
            });
        });
    }

    // Migrate mods table to remove modrinth_id constraint (support 3rd party mods)
    async migrateModsTableForThirdPartySupport() {
        return new Promise((resolve, reject) => {
            this.db.get("SELECT sql FROM sqlite_master WHERE type='table' AND name='mods'", (error, row) => {
                if (error) {
                    logger.error('Failed to check mods table schema:', error);
                    resolve();
                    return;
                }

                if (row && row.sql && row.sql.includes('modrinth_id IS NOT NULL')) {
                    logger.info('Migrating mods table to support 3rd party mods...');
                    
                    this.db.serialize(() => {
                        this.db.run("PRAGMA foreign_keys=off");
                        this.db.run("BEGIN TRANSACTION");
                        
                        // 1. Rename old table
                        this.db.run("ALTER TABLE mods RENAME TO mods_old");
                        
                        // 2. Create new table without constraint
                        this.db.run(`
                            CREATE TABLE mods (
                                id TEXT PRIMARY KEY,
                                instance_id TEXT NOT NULL,
                                modrinth_id TEXT,
                                name TEXT NOT NULL,
                                version TEXT NOT NULL,
                                file_name TEXT NOT NULL,
                                file_path TEXT NOT NULL,
                                enabled BOOLEAN DEFAULT 1,
                                installed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                                dependencies TEXT DEFAULT '[]',
                                FOREIGN KEY (instance_id) REFERENCES instances(id) ON DELETE CASCADE
                            )
                        `);
                        
                        // 3. Copy data
                        this.db.run(`
                            INSERT INTO mods (
                                id, instance_id, modrinth_id, name, version, 
                                file_name, file_path, enabled, installed_at, updated_at, dependencies
                            )
                            SELECT 
                                id, instance_id, modrinth_id, name, version, 
                                file_name, file_path, enabled, installed_at, updated_at, dependencies
                            FROM mods_old
                        `);
                        
                        // 4. Drop old table
                        this.db.run("DROP TABLE mods_old");
                        
                        this.db.run("COMMIT", (err) => {
                            if (err) {
                                logger.error('Failed to commit mods table migration:', err);
                                this.db.run("ROLLBACK");
                            } else {
                                this.db.run("PRAGMA foreign_keys=on");
                                logger.info('Successfully migrated mods table to support 3rd party mods');
                            }
                            resolve();
                        });
                    });
                } else {
                    resolve();
                }
            });
        });
    }

    // Migrate resource packs and shaders to add curseforge_id
    migrateResourcePacksAndShadersTables() {
        const tables = ['resource_packs', 'shaders'];
        
        tables.forEach(table => {
            this.db.get(`SELECT name FROM PRAGMA_TABLE_INFO('${table}') WHERE name = 'curseforge_id'`, (error, row) => {
                if (!error && !row) {
                    logger.info(`Adding curseforge_id column to ${table} table`);
                    this.db.run(`ALTER TABLE ${table} ADD COLUMN curseforge_id TEXT`);
                }
            });
        });
    }

    // Utility methods
    generateId() {
        return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    }

    mapInstanceRow(row) {
        // Convert snake_case database columns to camelCase frontend properties
        console.log('[mapInstanceRow] Mapping database row:', JSON.stringify(row, null, 2));
        console.log(`[mapInstanceRow] Raw is_modpack value: ${row.is_modpack} (type: ${typeof row.is_modpack})`);
        console.log(`[mapInstanceRow] Mapped isModpack value: ${Boolean(row.is_modpack)}`);
        
        let loaderVersion = row.loader_version;
        
        // Fix Forge loader version if needed (e.g., "60.1.0" should be "1.21.10-60.1.0") - skip if 'latest'
        if (row.loader === 'forge' && loaderVersion && loaderVersion !== 'latest' && row.game_version) {
            if (!loaderVersion.startsWith(row.game_version + '-') && /^\d+\.\d+\.\d+$/.test(loaderVersion)) {
                const fixedVersion = `${row.game_version}-${loaderVersion}`;
                console.log(`Fixed Forge loader version during mapping: ${loaderVersion} -> ${fixedVersion}`);
                loaderVersion = fixedVersion;
            }
        }
        
        const mapped = {
            id: row.id,
            name: row.name,
            path: row.path,
            icon: row.icon,
            gameVersion: row.game_version,
            loader: row.loader,
            loaderVersion: loaderVersion,
            javaPath: row.java_path,
            memory: {
                min: row.memory_min ? `${row.memory_min}M` : '2048M',
                max: row.memory_max ? `${row.memory_max}M` : '4096M'
            },
            jvmArgs: row.jvm_args ? row.jvm_args.split(',').filter(arg => arg.trim()) : [],
            gameArgs: row.game_args ? row.game_args.split(',').filter(arg => arg.trim()) : [],
            description: row.description || '',
            createdAt: row.created_at,
            lastPlayed: row.last_played,
            isActive: Boolean(row.is_active),
            isModpack: Boolean(row.is_modpack),
            modpackInstallationStatus: row.modpack_installation_status || 'none',
            modpackId: row.modpack_id,
            modpackName: row.modpack_name,

            modpackVersionId: row.modpack_version_id,
            modpackVersionName: row.modpack_version_name,
            modpackData: row.modpack_data ? (() => {
                try {
                    console.log(`[mapInstanceRow] Attempting to parse modpack_data for instance ${row.id}:`, row.modpack_data?.substring(0, 100));
                    const parsed = JSON.parse(row.modpack_data);
                    console.log(`[mapInstanceRow] Successfully parsed modpack_data for instance ${row.id}:`, parsed ? 'object' : 'null');
                    return parsed;
                } catch (e) {
                    console.error(`[mapInstanceRow] Failed to parse modpack_data for instance ${row.id}:`, e);
                    console.error(`[mapInstanceRow] Raw modpack_data:`, row.modpack_data);
                    return null;
                }
            })() : null
        };
        console.log(`[mapInstanceRow] Debug mapping for ${row.id}: is_modpack=${row.is_modpack} (${typeof row.is_modpack}), modpack_id=${row.modpack_id} (${typeof row.modpack_id})`);
        console.log(`[mapInstanceRow] Mapped instance ${row.id}: lastPlayed = ${row.last_played}`);
        return mapped;
    }

    // Get resource pack by ID
    async getResourcePack(resourcePackId) {
        return new Promise((resolve, reject) => {
            this.db.get(
                'SELECT * FROM resource_packs WHERE id = ?',
                [resourcePackId],
                (error, row) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve(row);
                    }
                }
            );
        });
    }

    // Update resource pack
    async updateResourcePack(resourcePackId, updates) {
        return new Promise((resolve, reject) => {
            const fields = [];
            const values = [];
            
            if (updates.enabled !== undefined) {
                fields.push('enabled = ?');
                values.push(updates.enabled);
            }
            if (updates.name !== undefined) {
                fields.push('name = ?');
                values.push(updates.name);
            }
            if (updates.version !== undefined) {
                fields.push('version = ?');
                values.push(updates.version);
            }
            
            if (fields.length === 0) {
                resolve();
                return;
            }
            
            values.push(resourcePackId);
            
            this.db.run(
                `UPDATE resource_packs SET ${fields.join(', ')} WHERE id = ?`,
                values,
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    // Delete resource pack
    async deleteResourcePack(resourcePackId) {
        return new Promise((resolve, reject) => {
            this.db.run(
                'DELETE FROM resource_packs WHERE id = ?',
                [resourcePackId],
                function(error) {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                }
            );
        });
    }

    async close() {
        return new Promise((resolve, reject) => {
            if (this.db) {
                this.db.close((error) => {
                    if (error) {
                        reject(error);
                    } else {
                        resolve();
                    }
                });
            } else {
                resolve();
            }
        });
    }
}

// Create singleton instance
const databaseService = new DatabaseService();

export default databaseService;