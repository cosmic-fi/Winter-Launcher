// @ts-nocheck
import { writable } from 'svelte/store';
import { get } from 'svelte/store';
import { ensureSettingsInitialized } from '../shared/configurations.js';
import { showDialog, uiState } from '../stores/ui.js';
import { initVersionManager } from '../shared/versionManager.js';
import { checkForUpdate } from './updateChecker.js';
import { baseURL } from '../services/api.js';
import { t } from '../stores/i18n.js';
import { getAccounts, updateAccount, removeAccount } from '../shared/user.js';
import { applySystemSettings } from './applySettings.js';
import { settings } from '../stores/settings.js';
import { logger } from './logger.js';

let translate = (key) => key;
t.subscribe(fn => translate = fn);
let bootIndex = 0;
let shouldContinueBoot = true;

// Helper function to automatically download and install updates
async function downloadAndInstallUpdate(updateInfo) {
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
      logger.info('[Boot] No suitable update asset found, opening download page');
      window.electron.openExternal(updateInfo.downloadUrl || 'https://winterlauncher.cosmicfi.dev/download');
      return { success: false, error: 'No suitable update asset found' };
    }
    
    // Step 1: Download the update file
    logger.info('[Boot] Downloading update file...');
    const downloadResult = await window.electron.downloadUpdateFile({ 
      url: asset.browser_download_url, 
      filename: asset.name 
    });
    
    if (!downloadResult.success) {
      logger.error('[Boot] Download failed:', downloadResult.error);
      return { success: false, error: downloadResult.error };
    }
    
    logger.info('[Boot] Download complete, now installing...');
    // Step 2: Install the update
    const installResult = await window.electron.installUpdateFile({ 
      file: downloadResult.file, 
      version: updateInfo.latest 
    });
    
    if (!installResult.success) {
      logger.error('[Boot] Installation failed:', installResult.error);
      return { success: false, error: installResult.error };
    }
    
    logger.info('[Boot] Installation complete!');
    return { success: true, result: installResult };
    
  } catch (error) {
    logger.error('[Boot] Update installation error:', error);
    return { success: false, error: error.message };
  }
}

export const bootStatus = writable({
    step: 0,
    message: `${translate('logs.loading')}`,
    progress: 0
});

// Load settings
async function loadSettingsStep() {
    bootStatus.set({ step: 1, message: translate('logs.loadingSettings'), progress: 10 });
    await new Promise(res => setTimeout(res, 300)); // Simulate delay
    await ensureSettingsInitialized();
    await settings.init(); // Initialize the settings store
    await applySystemSettings();
}

// Check for updates
async function checkForUpdatesStep() {
    const currentSettings = get(settings);
    if (currentSettings.launcher?.updates?.checkForUpdates?.value) {
        bootStatus.set({ step: 2, message: translate('logs.checkingForUpdates'), progress: 25 });
        
        const appInfo = await window.electron.getAppVersion?.();
        try { logger.info('[Boot] isPackaged:', appInfo?.isPackaged, 'version:', appInfo?.version); } catch {}

        // Use our manual version check instead of electron-updater
        const updateInfo = await checkForUpdate();
        
        // Skip update check in development mode
        if (updateInfo?.devMode) {
            logger.info('[Boot] Skipping update installation in development mode');
            return;
        }
        
        if (updateInfo?.available) {
          logger.info(`Update available: ${updateInfo.latest} (current: ${updateInfo.current})`);
          
          const cleanup = window.electron.onUpdateDownloadProgress?.(({ progress, version, downloaded, total }) => {
            const pct = typeof progress === 'number' ? progress : 0;
            const scaled = 25 + Math.round(pct * 0.5); // keep boot bar moving, 25% → 75%
            const displayVersion = version || updateInfo.latest || 'Unknown';
            bootStatus.set({ 
              step: 2, 
              message: `${translate('logs.downloadingUpdate')} (${displayVersion}) ${pct}%`, 
              progress: Math.min(90, scaled) 
            });
            try { logger.info('[Boot] update progress:', { pct, downloaded, total, version: displayVersion }); } catch {}
          });
          const extractedCleanup = window.electron.onUpdateExtracted?.(({ dir, version }) => {
            const displayVersion = version || updateInfo.latest || 'Unknown';
            bootStatus.set({ 
              step: 2, 
              message: `${translate('logs.updateExtracted')} (${displayVersion})`, 
              progress: 95 
            });
            try { logger.info('[Boot] update extracted:', { dir, version: displayVersion }); } catch {}
          });
          
          // Automatically download and install the update without user confirmation
          const result = await downloadAndInstallUpdate(updateInfo);
          
          if (cleanup) cleanup();
          if (extractedCleanup) extractedCleanup();
          
          if (result?.success) {
            // Update has been successfully installed, now show simplified restart dialog
            bootStatus.set({ 
              step: 2, 
              message: translate('logs.updateReadyToInstall'), 
              progress: 100 
            });
            
            // Show simplified restart dialog with only Okay button
            showDialog({
              title: translate('logs.updateReadyToInstall'),
              message: translate('logs.updateReadyMessage'),
              buttons: [
                {
                  label: translate('dialog.ok') || 'OK',
                  type: 'confirm',
                  primary: true,
                  action: async () => {
                    try {
                      logger.info('[Boot] User acknowledged update - restarting app');
                      // Use electron to restart the app
                      await window.electron.invoke('restart-app');
                    } catch (error) {
                      console.error('[Boot] Failed to restart app:', error);
                      // Fallback: show manual restart message
                      showDialog({
                        title: translate('logs.updateReadyToInstall'),
                        message: 'Please restart the launcher manually to complete the update.',
                        buttons: [{ label: 'OK', type: 'default', action: () => {} }]
                      });
                    }
                  }
                }
              ]
            });
            
            // Stop the boot sequence - don't continue to next steps
            shouldContinueBoot = false; // This will stop the loop
            logger.info('[Boot] Boot sequence stopped - update installed, waiting for user acknowledgment');
            
            try { logger.info('[Boot] update installation result:', result); } catch {}
            return;
          }
        } else if (updateInfo) {
          logger.info('Launcher is up to date');
        }
    } else {
        bootStatus.set({ step: 2, message: translate('logs.skippingUpdateCheck'), progress: 25 });
    }
    await new Promise(res => setTimeout(res, 500));
}

async function checkForVersions() {
    bootStatus.set({ step: 3, message: translate('logs.buildingVersions'), progress: 40 });
    initVersionManager();
}

// Validate accounts
async function validateAccountsStep() {
    bootStatus.set({ step: 4, message: translate('logs.validatingAccounts'), progress: 60 });
    
    const accounts = getAccounts();
    const onlineAccounts = accounts.filter(account => account.type === 'online');
    
    if (onlineAccounts.length === 0) {
        await new Promise(res => setTimeout(res, 200));
        return;
    }
    bootStatus.set({ step: 4, message: translate('logs.refreshingAccounts'), progress: 65 });
    
    let refreshedCount = 0;
    let failedCount = 0;
    
    for (const account of onlineAccounts) {
        try {
            await window.electron.invoke('refresh-account', account)
            .then(async (result) => {
              if(result.success){
                let _mAccount = {
                    ...account,
                    access_token: result.mc.access_token,
                    refresh_token: result.extra.msToken.refresh_token,
                    client_id: result.mc.client_id,
                    user_properties: result.mc.user_properties,
                    profile: result.extra.profile
                };
                updateAccount(account.uuid || account.name, _mAccount);
                refreshedCount++;
              }else{
                console.warn(`⚠ Failed to refresh account: ${account.name} - ${result.error || 'Unknown error'}`);
                failedCount++;
              }
            });
        } catch (error) {
            console.error(`✗ Error refreshing account: ${account.name}`, error);
            failedCount++;
        }
        
        // Update progress for each account processed
        const progress = 65 + (refreshedCount + failedCount) / onlineAccounts.length * 10;
        bootStatus.set({ 
            step: 4, 
            message: `${translate('logs.refreshingAccounts')} (${refreshedCount + failedCount}/${onlineAccounts.length})`, 
            progress 
        });
    }
    
    // Final status update
    if (failedCount > 0) {
        logger.info(`Account refresh completed: ${refreshedCount} successful, ${failedCount} failed`);
    } else {
        logger.info(`All ${refreshedCount} accounts refreshed successfully`);
    }
    
    bootStatus.set({ step: 4, message: translate('logs.accountsValidated'), progress: 75 });
    await new Promise(res => setTimeout(res, 300));
}


// --- Boot Sequence Runner ---
const steps = [
    loadSettingsStep,
    checkForUpdatesStep,
    // checkApiStatusStep,
    checkForVersions,
    // validateAccountsStep,
];

export async function runBootSequence(startIndex = 0) {
    uiState.isBootReady.set(false);
    shouldContinueBoot = true;

    for (bootIndex = startIndex; bootIndex < steps.length && shouldContinueBoot; bootIndex++) {
        const stepFn = steps[bootIndex];
        try {
            await stepFn();
        } catch (err) {
            logger.error('Step failed:', err);
            break;
        }
    }

    if (bootIndex >= steps.length && shouldContinueBoot) {
        bootStatus.set({ step: steps.length, message: translate('logs.ready'), progress: 100 });
        uiState.isBootReady.set(true);
    } else if (!shouldContinueBoot) {
        logger.info('[Boot] Boot sequence stopped - update ready to install');
        // Don't set boot ready when stopped for update
    }
}
