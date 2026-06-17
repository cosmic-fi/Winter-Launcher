// @ts-nocheck
/**
 * @author Cosmic-fi
 * @description Update checker utility for the WinterLauncher Front-End application.
 */

import { t } from '../stores/i18n.js';
import { showDialog } from '../stores/ui.js';

let translate = (key) => key;
t.subscribe(fn => translate = fn);

// Manual version check from GitHub releases
export async function checkForUpdate() {
  try {
    const currentVersion = await window.electron.invoke('get-app-version');
    
    // Skip updates in development environment
    if (!currentVersion.isPackaged) {
      console.log('[UpdateChecker] Skipping update check in development mode');
      return { available: false, current: currentVersion.version, latest: currentVersion.version, devMode: true };
    }
    const response = await fetch('https://api.github.com/repos/cosmic-fi/WinterLauncher/releases/latest', {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'WinterLauncher/2.0.0'
      }
    });
    if (!response.ok) {
      return null;
    }
    const releaseData = await response.json();
    const latestVersion = (releaseData.tag_name || '').replace(/^v/, '');
    if (latestVersion && latestVersion !== currentVersion.version) {
      return {
        available: true,
        current: currentVersion.version,
        latest: latestVersion,
        releaseNotes: releaseData.body,
        downloadUrl: releaseData.html_url,
        assets: releaseData.assets
      };
    }
    return { available: false, current: currentVersion.version, latest: latestVersion || currentVersion.version };
  } catch (error) {
    console.log('Version check failed:', error.message);
    return null;
  }
}



// Automatically download and install update without user confirmation
export async function downloadAndInstallUpdateAutomatic(updateInfo, onProgress = null) {
  try {
    const assets = updateInfo.assets || [];
    const platform = navigator.platform.toLowerCase();
    const isWin = platform.includes('win');
    const isMac = platform.includes('mac') || platform.includes('darwin');
    const isLinux = platform.includes('linux');
    
    let asset = (isWin ? assets.find(a => a.name.endsWith('.exe')) : null)
      || (isMac ? assets.find(a => a.name.endsWith('.zip')) : null)
      || (isLinux ? assets.find(a => a.name.endsWith('.AppImage')) : null)
      || assets.find(a => a.name.endsWith('.zip'));
      
    if (!asset?.browser_download_url) {
      window.electron.openExternal(updateInfo.downloadUrl || 'https://winterlauncher.cosmicfi.dev/download');
      return { success: false, error: 'No suitable update asset found' };
    }
    
    // Set up progress tracking if callback provided
    let cleanup = null;
    let extractedCleanup = null;
    
    if (onProgress) {
      cleanup = window.electron.onUpdateDownloadProgress?.(({ progress, version, downloaded, total }) => {
        const pct = typeof progress === 'number' ? progress : 0;
        const displayVersion = version || updateInfo.latest || 'Unknown';
        onProgress({
          type: 'download',
          progress: pct,
          version: displayVersion,
          downloaded,
          total
        });
      });
      
      extractedCleanup = window.electron.onUpdateExtracted?.(({ dir, version }) => {
        const displayVersion = version || updateInfo.latest || 'Unknown';
        onProgress({
          type: 'extracted',
          version: displayVersion
        });
      });
    }
    
    // Step 1: Download the update file
    console.log('[UpdateChecker] Downloading update file...');
    const downloadResult = await window.electron.downloadUpdateFile({ 
      url: asset.browser_download_url, 
      filename: asset.name 
    });
    
    if (cleanup) cleanup();
    if (extractedCleanup) extractedCleanup();
    
    if (!downloadResult.success) {
      console.error('[UpdateChecker] Download failed:', downloadResult.error);
      return { success: false, error: downloadResult.error };
    }
    
    console.log('[UpdateChecker] Download complete, now installing...');
    // Step 2: Install the update
    const installResult = await window.electron.installUpdateFile({ 
      file: downloadResult.file, 
      version: updateInfo.latest 
    });
    
    if (!installResult.success) {
      console.error('[UpdateChecker] Installation failed:', installResult.error);
      return { success: false, error: installResult.error };
    }
    
    console.log('[UpdateChecker] Installation complete!');
    return { success: true, result: installResult };
    
  } catch (error) {
    console.error('[UpdateChecker] Update installation error:', error);
    return { success: false, error: error.message };
  }
}

// Check for updates with optional notification
export async function checkForUpdatesWithNotification(showNotification = true) {
  const updateInfo = await checkForUpdate();
  
  if (updateInfo?.available && showNotification) {
    await showUpdateNotification(updateInfo);
  }
  
  return updateInfo;
}
