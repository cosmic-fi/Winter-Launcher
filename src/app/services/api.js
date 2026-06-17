// @ts-nocheck
import axios from 'axios';
import { apiBase, starlightBaseURL } from '../utils/helper.js';

export const baseURL = apiBase;
export const fabricMetaURL = 'https://meta.fabricmc.net/v2/versions';

const starlightBaseUrl = starlightBaseURL;

/**
 * Fetch all posts from the RSS feed (rss.json).
 * @returns {Promise<Object>} The RSS feed object, or {} on error.
 */
export async function fetchNews() {
  const res = await fetch(`${baseURL}/news`, {
    headers: {
      'User-Agent': 'WinterLauncher/1.0.0 (Electron)',
      'Accept': 'application/json',
      'Cache-Control': 'no-cache'
    },
    mode: 'cors'
  });

  const text = await res.text();

  if (!res.ok) {
    throw new Error('Failed to fetch news');
  }

  try {
    return JSON.parse(text);
  } catch (err) {
    console.error('[fetchNews] JSON parse failed:', err);
    return [];
  }
}


// Helper function to add delay between requests
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

// Helper function to validate URL accessibility
async function validateImageUrl(url, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        try {
            const response = await fetch(url, { 
                method: 'HEAD',
                headers: {
                    'User-Agent': 'WinterLauncher/1.0.0 (Electron)',
                    'Accept': '*/*',
                    'Cache-Control': 'no-cache'
                },
                mode: 'cors'
            });
            if (response.ok) {
                return url;
            }
            if (response.status === 404) {
                return null; // Don't retry 404s
            }
        } catch (error) {
            if (attempt === retries) {
                console.warn(`Failed to validate image URL after ${retries + 1} attempts:`, url, error.message);
                return null;
            }
            await delay(1000 * Math.pow(2, attempt)); // Exponential backoff
        }
    }
    return null;
}

// Updated fetchStarlightSkins function - returns URLs instead of base64
async function fetchStarlightSkins(username) {
    const baseUrl = starlightBaseURL;
    const skinTypes = [
        { key: 'face', path: '/face/512' },
        { key: 'rawSkin', path: '/skin' },
        { key: 'default', path: '/default/512' },
        { key: 'lunging', path: '/lunging/512' },
        { key: 'walking', path: '/walking/512' },
        { key: 'running', path: '/running/512' },
        { key: 'crouching', path: '/crouching/512' },
        { key: 'crossed', path: '/crossed/512' },
        { key: 'criss_cross', path: '/criss_cross/512' },
        { key: 'ultimate', path: '/ultimate/512' },
        { key: 'isometric', path: '/isometric/512' },
        { key: 'head', path: '/head/512' },
        { key: 'bust', path: '/bust/512' },
        { key: 'full', path: '/full/512' },
        { key: 'skin', path: '/skin/512' },
        { key: 'processed', path: '/processed/512' },
        { key: 'pixel', path: '/pixel/512' },
        { key: 'orb', path: '/orb/512' },
        { key: 'ornament', path: '/ornament/512' },
        { key: 'christmas', path: '/christmas/512' },
        { key: 'halloween', path: '/halloween/512' }
    ];

    const results = {};
    
    // Sequential downloads with delay to prevent API overload
    for (const skinType of skinTypes) {
        const url = `${baseUrl}${skinType.path}/${username}`;
        const validatedUrl = await validateImageUrl(url);
        
        if (validatedUrl) {
            results[skinType.key] = validatedUrl;
        }
        
        // Add delay between requests
        await delay(150);
    }

    return results;
}

// Updated fetchSkinDataForUser function
async function fetchSkinDataForUser(username) {
    try {
        const skinData = await fetchStarlightSkins(username);
        
        // Validate that we have critical skin data
        if (!skinData.face && !skinData.rawSkin) {
            console.warn(`No critical skin data found for ${username}`);
            return null; // This will trigger MHF_Steve fallback
        }
        
        return skinData;
    } catch (error) {
        console.error('Error fetching skin data:', error);
        return null;
    }
}

/**
 * Fetch available Fabric loader versions for a specific game version.
 * @param {string} gameVersion - The Minecraft game version (e.g., '1.20.1')
 * @returns {Promise<Array>} Array of {value, label} objects for Fabric loader versions
 */
export async function fetchFabricLoaderVersions(gameVersion) {
    try {
        // Use Electron IPC to avoid CORS issues
        if (window.electron && window.electron.fetchFabricVersions) {
            const result = await window.electron.fetchFabricVersions(gameVersion);
            if (result.success) {
                return result.versions;
            } else {
                console.warn('Electron API failed, using fallback');
            }
        } else {
            console.warn('Electron API not available, using fallback');
        }

        // Fallback: direct API call if Electron not available
        const response = await axios.get(`${fabricMetaURL}/loader/${gameVersion}`);
        
        if (!response.data || !Array.isArray(response.data)) {
            console.warn('Invalid Fabric loader versions response:', response.data);
            return [];
        }

        // Map Fabric loader versions to the format expected by CustomOptions
        return response.data.map(loader => ({
            value: loader.loader.version,
            label: `Fabric Loader ${loader.loader.version}`
        }));
    } catch (error) {
        console.error('Error fetching Fabric loader versions:', error);
        return [];
    }
}

/**
 * Fetch supported game versions for a specific loader.
 * @param {string} loader - The loader type ('fabric', 'quilt', 'neoforge', 'forge', 'vanilla')
 * @returns {Promise<Array<string>|string>} Array of supported game versions, or 'all' for vanilla
 */
export async function fetchLoaderGameVersions(loader) {
    try {
        if (window.electron && window.electron.invoke) {
            const result = await window.electron.invoke('fetch-loader-game-versions', loader);
            if (result.success) {
                return result.versions;
            } else {
                console.warn(`Electron API failed to fetch game versions for ${loader}`);
            }
        } else {
            console.warn('Electron API not available');
        }
        return [];
    } catch (error) {
        console.error(`Error fetching game versions for ${loader}:`, error);
        return [];
    }
}

/**
 * Fetch available Forge loader versions for a specific game version.
 * @param {string} gameVersion - The Minecraft game version (e.g., '1.20.1')
 * @returns {Promise<Array>} Array of {value, label} objects for Forge loader versions
 */
/**
 * Fetch available Quilt loader versions for a specific game version.
 * @param {string} gameVersion - The Minecraft game version (e.g., '1.20.1')
 * @returns {Promise<Array>} Array of {value, label} objects for Quilt loader versions
 */
export async function fetchQuiltLoaderVersions(gameVersion) {
    try {
        // Use Electron IPC to avoid CORS issues
        if (window.electron && window.electron.fetchQuiltVersions) {
            const result = await window.electron.fetchQuiltVersions(gameVersion);
            if (result.success) {
                return result.versions;
            } else {
                console.warn('Electron API failed');
            }
        } else {
            console.warn('Electron API not available');
        }

        return [];
    } catch (error) {
        console.error('Error fetching Quilt loader versions:', error);
        return [];
    }
}

/**
 * Resolve the specific loader version for a given loader type and game version.
 * Handles 'latest', 'recommended', or specific versions.
 * @param {string} loaderType - 'forge', 'neoforge', 'fabric', 'quilt', 'vanilla'
 * @param {string} gameVersion - Minecraft version
 * @param {string} preferredVersion - 'latest', 'recommended', or specific version
 * @returns {Promise<string>} Resolved version string
 */
export async function resolveLoaderVersion(loaderType, gameVersion, preferredVersion = 'latest') {
    if (!loaderType || loaderType === 'vanilla') return null;
    
    // If preferredVersion is already a specific version (not latest/recommended), try to keep it
    // But we might want to validate it exists? For now, let's trust the manifest if it's specific.
    // UNLESS the user explicitly wants to force latest supported.
    
    const isDynamic = preferredVersion === 'latest' || preferredVersion === 'recommended';
    if (!isDynamic && preferredVersion) {
        return preferredVersion;
    }
    
    let fetchFunc;
    switch (loaderType) {
        case 'forge': fetchFunc = fetchForgeLoaderVersions; break;
        case 'neoforge': fetchFunc = fetchNeoForgeLoaderVersions; break;
        case 'fabric': fetchFunc = fetchFabricLoaderVersions; break;
        case 'quilt': fetchFunc = fetchQuiltLoaderVersions; break;
        default: return preferredVersion;
    }
    
    try {
        const versions = await fetchFunc(gameVersion);
        
        if (!versions || versions.length === 0) {
            console.warn(`No versions found for ${loaderType} on ${gameVersion}, using ${preferredVersion}`);
            return preferredVersion;
        }
        
        // Return the latest version (first in the list)
        console.log(`Resolved ${loaderType} ${preferredVersion} to ${versions[0].value} for MC ${gameVersion}`);
        return versions[0].value;
    } catch (e) {
        console.error(`Failed to resolve loader version: ${e.message}`);
        return preferredVersion;
    }
}

/**
 * Fetch available NeoForge loader versions for a specific game version.
 * @param {string} gameVersion - The Minecraft game version (e.g., '1.20.1')
 * @returns {Promise<Array>} Array of {value, label} objects for NeoForge loader versions
 */
export async function fetchNeoForgeLoaderVersions(gameVersion) {
    try {
        // Use Electron IPC to avoid CORS issues
        if (window.electron && window.electron.fetchNeoForgeVersions) {
            const result = await window.electron.fetchNeoForgeVersions(gameVersion);
            if (result.success) {
                return result.versions;
            } else {
                console.warn('Electron API failed');
            }
        } else {
            console.warn('Electron API not available');
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching NeoForge loader versions:', error);
        return [];
    }
}

/**
 * Fetch available Forge loader versions for a specific game version.
 * @param {string} gameVersion - The Minecraft game version (e.g., '1.20.1')
 * @returns {Promise<Array>} Array of {value, label} objects for Forge loader versions
 */
export async function fetchForgeLoaderVersions(gameVersion) {
    try {
        
        // Use Electron IPC to avoid CORS issues
        if (window.electron && window.electron.fetchForgeVersions) {
            const result = await window.electron.fetchForgeVersions(gameVersion);
            if (result.success) {
                return result.versions;
            } else {
                console.warn('Electron API failed');
            }
        } else {
            console.warn('Electron API not available');
        }
        
        return [];
    } catch (error) {
        console.error('Error fetching Forge loader versions:', error);
        return [];
    }
}


// Updated fetchFaceAndSkin function - now returns URLs
async function fetchFaceAndSkin(username, accountType = 'online') {
    console.log(`Fetching skin data for ${username} (${accountType})`);
    
    try {
        // Try Starlight Skins API for all account types
        const skinData = await fetchSkinDataForUser(username);
        
        if (skinData && (skinData.face || skinData.rawSkin)) {
            console.log(`Successfully fetched skin data for ${username}`);
            return {
                face: skinData.face || null,
                skin: skinData.rawSkin || null,
                renders: skinData // All render types
            };
        }
        
        // Fallback to MHF_Steve if no valid skin data
        console.log(`Falling back to MHF_Steve for ${username}`);
        const steveSkinData = await fetchSkinDataForUser('MHF_Steve');
        
        if (steveSkinData) {
            return {
                face: steveSkinData.face || null,
                skin: steveSkinData.rawSkin || null,
                renders: steveSkinData
            };
        }
        
        // Final hardcoded fallback URLs
        const starlightBaseUrl = starlightBaseURL;
        return {
            face: `${starlightBaseUrl}/face/512/MHF_Steve`,
            skin: `${starlightBaseUrl}/skin/MHF_Steve`,
            renders: {
                face: `${starlightBaseUrl}/face/512/MHF_Steve`,
                rawSkin: `${starlightBaseUrl}/skin/MHF_Steve`,
                default: `${starlightBaseUrl}/default/512/MHF_Steve`,
                bust: `${starlightBaseUrl}/bust/512/MHF_Steve`,
                full: `${starlightBaseUrl}/full/512/MHF_Steve`
            }
        };
        
    } catch (error) {
        console.error(`Error in fetchFaceAndSkin for ${username}:`, error);
        
        // Final hardcoded fallback URLs
        const starlightBaseUrl = 'https://starlightskins.lunareclipse.studio/render/ultimate';
        return {
            face: `${starlightBaseUrl}/face/512/MHF_Steve`,
            skin: `${starlightBaseUrl}/skin/MHF_Steve`,
            renders: {
                face: `${starlightBaseUrl}/face/512/MHF_Steve`,
                rawSkin: `${starlightBaseUrl}/skin/MHF_Steve`,
                default: `${starlightBaseUrl}/default/512/MHF_Steve`,
                bust: `${starlightBaseUrl}/bust/512/MHF_Steve`,
                full: `${starlightBaseUrl}/full/512/MHF_Steve`
            }
        };
    }
}