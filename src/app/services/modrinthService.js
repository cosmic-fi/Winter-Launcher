//@ts-nocheck

import axios from 'axios';
import { logger } from '../utils/logger';

const MODRINTH_API_BASE = 'https://api.modrinth.com/v2';
const USER_AGENT = 'winterLauncher/1.4.0 (contact@cosmicfi.dev)';

class ModrinthService {
    constructor() {
        this.client = axios.create({
            baseURL: MODRINTH_API_BASE,
            headers: {
                'Accept': 'application/json',
                // Only add User-Agent in non-browser environments to avoid security errors
                ...(typeof window === 'undefined' || !window.navigator ? { 'User-Agent': USER_AGENT } : {})
            },
            timeout: 10000
        });
        
        // Cache for game versions to avoid repeated API calls
        this._gameVersionsCache = null;
        this._gameVersionsCacheTime = 0;
        this._cacheExpiry = 5 * 60 * 1000; // 5 minutes
        
        // Cache for project details
        this._projectCache = new Map();
        this._projectCacheExpiry = 10 * 60 * 1000; // 10 minutes

        // Response interceptor for error handling and rate limiting
        this.client.interceptors.response.use(
            response => response,
            async error => {
                logger.error('Modrinth API error:', error.response?.data || error.message);
                
                // Handle rate limiting (429 errors)
                if (error.response?.status === 429) {
                    const retryAfter = error.response.headers['retry-after'] || 1;
                    logger.warn(`Rate limited, retrying after ${retryAfter} seconds`);
                    
                    // Wait for the specified time
                    await this._delay(retryAfter * 1000);
                    
                    // Retry the request
                    return this.client.request(error.config);
                }
                
                throw error;
            }
        );
    }
    
    /**
     * Delay helper for rate limiting
     * @param {number} ms - Milliseconds to delay
     */
    _delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    
    /**
     * Clean expired cache entries
     */
    _cleanExpiredCache() {
        const now = Date.now();
        for (const [key, entry] of this._projectCache.entries()) {
            if (now - entry.timestamp > this._projectCacheExpiry) {
                this._projectCache.delete(key);
            }
        }
    }

    /**
     * Search for mods/projects on Modrinth
     * @param {Object} options - Search options
     * @param {string} options.query - Search query
     * @param {Array} options.facets - Faceted search filters
     * @param {string} options.index - Sort order (relevance, downloads, follows, newest, updated)
 * @param {number} options.offset - Pagination offset
     * @param {number} options.limit - Number of results (max 100)
     */
    async searchProjects(options = {}) {
        const {
            query = '',
            facets = [],
            index = 'relevance',
            offset = 0,
            limit = 20,
            loaders = undefined
        } = options;

        try {
            const params = { query, index, offset, limit };
            if (facets) {
                if (Array.isArray(facets)) {
                    params.facets = JSON.stringify(facets);
                } else if (typeof facets === 'string') {
                    params.facets = facets;
                }
            }
            if (loaders) params.loaders = loaders;
            const response = await this.client.get('/search', { params });

            return {
                hits: response.data.hits,
                total: response.data.total_hits,
                limit: response.data.limit,
                offset: response.data.offset
            };
        } catch (error) {
            logger.error('Failed to search projects:', error);
            throw new Error('Failed to search for mods');
        }
    }

    /**
     * Get multiple projects by IDs
     * @param {Array<string>} projectIds - Array of Project IDs
     */
    async getProjects(projectIds) {
        // Check cache for each project
        const cachedProjects = [];
        const projectsToFetch = [];
        
        for (const projectId of projectIds) {
            const cachedEntry = this._projectCache.get(projectId);
            if (cachedEntry && (Date.now() - cachedEntry.timestamp) < this._projectCacheExpiry) {
                cachedProjects.push(cachedEntry.data);
            } else {
                projectsToFetch.push(projectId);
            }
        }
        
        // If all projects are cached, return them
        if (projectsToFetch.length === 0) {
            logger.debug(`All ${projectIds.length} projects found in cache`);
            return cachedProjects;
        }
        
        try {
            // Fetch only the projects that aren't cached
            const response = await this.client.get('/projects', { 
                params: { ids: JSON.stringify(projectsToFetch) } 
            });
            
            // Cache the fetched projects
            for (const project of response.data) {
                this._projectCache.set(project.id, {
                    data: project,
                    timestamp: Date.now()
                });
            }
            
            // Combine cached and fetched projects
            return [...cachedProjects, ...response.data];
        } catch (error) {
            logger.error('Failed to get projects batch:', error);
            throw new Error('Failed to get projects batch');
        }
    }

    /**
     * Get multiple versions by IDs
     * @param {Array<string>} versionIds - Array of Version IDs
     */
    async getVersions(versionIds) {
        try {
            const response = await this.client.get('/versions', { 
                params: { ids: JSON.stringify(versionIds) } 
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to get versions batch:', error);
            throw new Error('Failed to get versions batch');
        }
    }

    /**
     * Get version details from file hashes
     * @param {Array<string>} hashes - Array of file hashes
     * @param {string} algorithm - Hash algorithm (sha1 or sha512)
     */
    async getVersionsFromHashes(hashes, algorithm = 'sha1') {
        try {
            const response = await this.client.post('/version_files', {
                hashes,
                algorithm
            });
            return response.data;
        } catch (error) {
            logger.error('Failed to get versions from hashes:', error);
            // Don't throw here, just return empty object to allow partial success
            return {};
        }
    }

    /**
     * Search for modpacks
     * @param {Object} options - Search options
     */
    async searchModpacks(options = {}) {
        const {
            query = '',
            gameVersion = null,
            loader = null,
            category = null,
            sort = 'relevance',
            offset = 0,
            limit = 20
        } = options;

        const facets = [['project_type:modpack']];
        if (gameVersion) {
            facets.push([`versions:${gameVersion}`]);
        }
        if (loader) {
            facets.push([`categories:${loader}`]);
        }
        if (category) {
            facets.push([`categories:${category}`]);
        }

        try {
            const response = await this.searchProjects({
                query,
                facets: facets,
                index: sort,
                offset,
                limit
            });

            return {
                hits: response.hits,
                total_hits: response.total,
                limit: response.limit,
                offset: response.offset
            };
        } catch (error) {
            logger.error('Failed to search modpacks:', error);
            throw new Error('Failed to search for modpacks');
        }
    }

    /**
     * Get project details by ID or slug
     * @param {string} projectId - Project ID or slug
     */
    async getProject(projectId) {
        // Check cache first
        const cacheKey = projectId;
        const cachedEntry = this._projectCache.get(cacheKey);
        
        if (cachedEntry && (Date.now() - cachedEntry.timestamp) < this._projectCacheExpiry) {
            logger.debug(`Using cached project details for ${projectId}`);
            return cachedEntry.data;
        }
        
        try {
            const response = await this.client.get(`/project/${projectId}`);
            
            // Cache the result
            this._projectCache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });
            
            // Clean expired cache entries periodically
            if (this._projectCache.size > 100) {
                this._cleanExpiredCache();
            }
            
            return response.data;
        } catch (error) {
            logger.error(`Failed to get project ${projectId}:`, error);
            throw new Error('Failed to get project details');
        }
    }

    /**
     * Get project versions
     * @param {string} projectId - Project ID or slug
     * @param {Object} filters - Version filters
     */
    async getProjectVersions(projectId, filters = {}) {
        const {
            gameVersion = null,
            loader = null,
            versionType = null
        } = filters;

        try {
            const params = {};
            if (gameVersion) params.game_version = gameVersion;
            if (loader) params.loader = loader;
            if (versionType) params.version_type = versionType;

            const response = await this.client.get(`/project/${projectId}/version`, { params });
            return response.data;
        } catch (error) {
            logger.error(`Failed to get versions for project ${projectId}:`, error);
            throw new Error('Failed to get project versions');
        }
    }

    /**
     * Get specific version details
     * @param {string} versionId - Version ID
     */
    async getVersion(versionId) {
        try {
            const response = await this.client.get(`/version/${versionId}`);
            return response.data;
        } catch (error) {
            logger.error(`Failed to get version ${versionId}:`, error);
            throw new Error('Failed to get version details');
        }
    }

    /**
     * Download file from Modrinth
     * @param {string} url - File URL
     * @param {string} filePath - Local file path to save
     * @param {string} [instanceId] - Optional instance ID for download tracking and cancellation
     */
    async downloadFile(url, filePath, instanceId) {
        try {
            // Use Electron IPC for file downloads if available
            if (typeof window !== 'undefined' && window.electron && window.electron.invoke) {
                const result = await window.electron.invoke('download-mod-file', { url, filePath, instanceId });
                if (!result.success) {
                    if (result.cancelled) {
                        throw new Error('Download cancelled');
                    }
                    throw new Error(result.error || 'Failed to download file');
                }
                return result;
            } else {
                // Fallback for non-Electron environments (won't work in production)
                logger.warn('Electron IPC not available, using fallback download method');
                throw new Error('File download requires Electron environment');
            }
        } catch (error) {
            logger.error(`Failed to download file from ${url}:`, error);
            throw new Error(`Failed to download file: ${error.message}`);
        }
    }

    /**
     * Search for mods with specific filters
     * @param {Object} filters - Search filters
     */
    async searchMods({
        query = '',
        gameVersion = null,
        loader = null,
        environment = null,
        category = null,
        sort = 'relevance',
        offset = 0,
        limit = 20,
        }) {
        const facets = [
            ['project_type:mod'],
        ];

        if (loader) {
            facets.push([`categories:${loader}`]);
        }

        if (category) {
            facets.push([`categories:${category}`]);
        }

        if (gameVersion && /^\d+\.\d+\.\d+$/.test(gameVersion)) {
            facets.push([`versions:${gameVersion}`]);
        }

        if (environment) {
            if (environment === 'client') {
                facets.push(['client_side:required', 'client_side:optional']);
            } else if (environment === 'server') {
                facets.push(['server_side:required', 'server_side:optional']);
            }
        }

        const validIndexes = new Set(['relevance', 'downloads', 'follows', 'newest', 'updated']);
        let index = sort;
        if (index === 'popularity') {
            index = 'downloads';
        } else if (!validIndexes.has(index)) {
            index = 'relevance';
        }

        const params = {
            query,
            index,
            offset,
            limit,
            facets: JSON.stringify(facets),
        };

        const response = await this.client.get('/search', { params });
        return {
            hits: response.data.hits,
            total_hits: response.data.total_hits,
            limit: response.data.limit,
            offset: response.data.offset,
        };
    }

    /**
     * Get mod categories
     */
    async getCategories() {
        try {
            const response = await this.client.get('/tag/category');
            return response.data;
        } catch (error) {
            logger.error('Failed to get categories:', error);
            throw new Error('Failed to get mod categories');
        }
    }

    /**
     * Get available game versions
     */
    async getGameVersions() {
        // Check if cache is still valid
        const now = Date.now();
        if (this._gameVersionsCache && (now - this._gameVersionsCacheTime) < this._cacheExpiry) {
            return this._gameVersionsCache;
        }

        try {
            const response = await this.client.get('/tag/game_version');
            this._gameVersionsCache = response.data;
            this._gameVersionsCacheTime = now;
            return response.data;
        } catch (error) {
            logger.error('Failed to get game versions:', error);
            throw new Error('Failed to get game versions');
        }
    }

    /**
     * Get available loaders
     */
    async getLoaders() {
        try {
            const response = await this.client.get('/tag/loader');
            return response.data;
        } catch (error) {
            logger.error('Failed to get loaders:', error);
            throw new Error('Failed to get loaders');
        }
    }

    /**
     * Check if a mod version is compatible with game version and loader
     * @param {Object} version - Version object from Modrinth
     * @param {string} gameVersion - Target game version
     * @param {string} loader - Target loader
     */
    isVersionCompatible(version, gameVersion, loader) {
        if (!version || !version.game_versions || !version.loaders) {
            return false;
        }

        const gameVersionCompatible = version.game_versions.includes(gameVersion);
        const loaderCompatible = version.loaders.includes(loader);

        return gameVersionCompatible && loaderCompatible;
    }

    /**
     * Get the latest compatible version of a mod
     * @param {Array} versions - Array of version objects
     * @param {string} gameVersion - Target game version
     * @param {string} loader - Target loader
     * @param {string} versionType - Version type preference (release, beta, alpha)
     */
    getLatestCompatibleVersion(versions, gameVersion, loader, versionType = 'release') {
        const compatibleVersions = versions.filter(version => 
            this.isVersionCompatible(version, gameVersion, loader)
        );

        if (compatibleVersions.length === 0) {
            return null;
        }

        // Sort by version type priority and date
        const versionTypePriority = { release: 3, beta: 2, alpha: 1 };
        
        return compatibleVersions.sort((a, b) => {
            // First by version type
            const typeDiff = versionTypePriority[b.version_type] - versionTypePriority[a.version_type];
            if (typeDiff !== 0) return typeDiff;
            
            // Then by date (newer first)
            return new Date(b.date_published) - new Date(a.date_published);
        })[0];
    }
}

// Create singleton instance
const modrinthService = new ModrinthService();

export default modrinthService;
