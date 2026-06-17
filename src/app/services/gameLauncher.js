// @ts-nocheck
import { get } from 'svelte/store';
import { instanceStore } from '../stores/instances';
import { launchActions, runningInstancesList, instanceLaunchStates, isLaunching } from '../stores/launch';
import { showToast, uiState } from '../stores/ui';
import { getSelectedAccount } from '../shared/user';
import { settings } from '../stores/settings';
import { logger } from '../utils/logger';
import { discordRPCManager } from '../utils/discordRPCManager.js';
import { notificationService } from './notificationService';
import { crashRecoveryService } from './crashRecovery.js';
import { t } from '../stores/i18n';

export const gameLauncher = {
    // Store cleanup functions for listeners
    cleanupFunctions: [],
    // Store active instance launches for error handling
    activeLaunches: new Map(),

    /**
     * Setup all launch event listeners
     * @returns {Array} Array of cleanup functions
     */
    setupLaunchListeners() {
        this.cleanupFunctions = []; // Reset cleanup functions

        // Data handler
        const dataHandler = (data) => {
            if (logger && logger.info) {
                // If data.data is a string, log it directly as the message, otherwise stringify it
                const message = data && data.data ? (typeof data.data === 'string' ? data.data : JSON.stringify(data.data)) : JSON.stringify(data);
                logger.info(message);
            }
        };
        const dataCleanup = window.electron.onLaunchData?.(dataHandler);
        if (dataCleanup) this.cleanupFunctions.push(dataCleanup);

        // Progress handler
        const progressHandler = (progress) => {
            if (logger && logger.warn) {
                logger.warn(
                    `▽ ${get(t)("mainContent.launch.launchStatus.downloading")} ${progress.element}.... ${((progress.progress / progress.size) * 100).toFixed(2)}%`,
                );
            }
            
            if (progress) {
                launchActions.setInstanceStatus(progress.instanceId, "downloading");
                launchActions.setInstanceLaunching(progress.instanceId, true);
                
                // Set download progress for UI display
                const percentage = ((progress.progress / progress.size) * 100).toFixed(0);
                const progressText = `${get(t)("mainContent.launch.launchStatus.downloading")} ${progress.element} ${percentage}%`;
                launchActions.setDownloadProgress(progress.instanceId, percentage, progressText);
            }
            
            if (discordRPCManager) {
                discordRPCManager.setDownloadingActivity(
                    progress.percentage || 0,
                );
            }
        };
        const progressCleanup = window.electron.onLaunchProgress?.(progressHandler);
        if (progressCleanup) this.cleanupFunctions.push(progressCleanup);

        // Estimated time handler
        const estimatedTimeHandler = (data) => {
            if (data && data.instanceId) {
                if (logger && logger.info) {
                    // logger.info(`⏱️ Estimated time remaining: ${data} for instance ${data.instanceId}`);
                }
            }
        };
        const estimatedTimeCleanup = window.electron.onLaunchEstimatedTime?.(estimatedTimeHandler);
        if (estimatedTimeCleanup) this.cleanupFunctions.push(estimatedTimeCleanup);

        // Complete handler
        const completeHandler = (message) => {
            const instanceData = message && (message.instanceId || message.instanceName) ? {
                id: message.instanceId,
                name: message.instanceName
            } : null;
            
            if (instanceData && instanceData.id) {
                launchActions.setInstanceStatus(instanceData.id, "running");
                launchActions.setInstanceLaunching(instanceData.id, false);
                // Remove from active launches on successful completion
                this.activeLaunches.delete(instanceData.id);
            }
            
            // Log performance metrics if available
            if (message?.performance) {
                const perf = message.performance;
                logger.debug(`[Performance] Launch completed in ${perf.launchTime}ms`);
                logger.debug(`[Performance] Download time: ${perf.downloadTime}ms`);
                logger.debug(`[Performance] Average download speed: ${(perf.averageDownloadSpeed / 1024 / 1024).toFixed(2)} MB/s`);
                logger.debug(`[Performance] Peak memory usage: ${(perf.peakMemoryUsage / 1024 / 1024).toFixed(2)} MB`);
                logger.debug(`[Performance] Memory efficiency: ${(perf.memoryEfficiency * 100).toFixed(1)}%`);
            }
            
            launchActions.instanceStarted(instanceData);
            if (discordRPCManager) {
                discordRPCManager.setPlayingActivity();
            }
            
            const version = get(settings)?.game?.version;
        };
        const completeCleanup = window.electron.onLaunchComplete?.(completeHandler);
        if (completeCleanup) this.cleanupFunctions.push(completeCleanup);

        // Warning handler (for recoverable errors like network issues)
        const warningHandler = async (warning) => {
            // Enhanced warning message
            let warningMessage = warning?.message || 'Unknown warning occurred';
            
            // Add context based on warning type
            if (warningMessage.includes('fetch failed')) {
                warningMessage = `Network download issue: ${warningMessage}. Some files may not be available, but the game should still launch.`;
            } else if (warningMessage.includes('asset') || warningMessage.includes('library')) {
                warningMessage = `File download warning: ${warningMessage}. The game may launch with missing assets.`;
            } else if (warningMessage.includes('timeout')) {
                warningMessage = `Connection timeout: ${warningMessage}. The server may be slow, but the game should still launch.`;
            }
            
            if (logger && logger.warn) {
                logger.warn(`⚠ ${warningMessage}`, warning);
            }
            logger.debug('Launch warning:', warning);
            logger.debug('Warning details:', warningMessage);
            
            // Show a non-intrusive toast for warnings
            // showToast(warningMessage, 'warning');
        };
        const warningCleanup = window.electron.onLaunchWarning?.(warningHandler);
        if (warningCleanup) this.cleanupFunctions.push(warningCleanup);

        // Error handler (for fatal errors only)
        const errorHandler = async (error) => {
            // Only handle fatal errors - recoverable errors are handled by warning handler
            if (error?.type !== 'fatal') {
                logger.debug('Ignoring non-fatal error (will be handled by warning handler):', error);
                return;
            }
            
            // Enhanced error message
            let errorMessage = error?.message || 'Unknown error occurred';
            
            // Add context based on error type
            if (errorMessage.includes('fetch failed')) {
                errorMessage = `Network download failed: ${errorMessage}. Check your internet connection and try again.`;
            } else if (errorMessage.includes('Loader') && errorMessage.includes('not found')) {
                errorMessage = `Minecraft loader error: ${errorMessage}. The requested loader may not be supported.`;
            } else if (errorMessage.includes('Java')) {
                errorMessage = `Java runtime error: ${errorMessage}. Please check your Java installation.`;
            } else if (errorMessage.includes('timeout')) {
                errorMessage = `Operation timed out: ${errorMessage}. The server may be slow or unreachable.`;
            } else if (errorMessage === 'Unknown error' || !errorMessage) {
                errorMessage = 'An unexpected error occurred during launch. Please check the logs for details.';
            }
            
            if (logger && logger.error) {
                logger.error(`※ ${errorMessage}`, error);
            }
            logger.debug('Launch error:', error);
            logger.debug('Error details:', errorMessage)
            
            // Try to get instance ID from error data first, then check active launches
            let instanceId = error && error.instanceId ? error.instanceId : null;
            
            // If no instance ID in error, try to find it from active launches
            if (!instanceId && this.activeLaunches.size > 0) {
                // Use the most recent active launch as fallback
                const activeIds = Array.from(this.activeLaunches.keys());
                instanceId = activeIds[activeIds.length - 1]; // Most recent
                logger.debug('No instance ID in error, using most recent active:', instanceId);
            }
            
            logger.debug('Error handler - Instance ID:', instanceId);
            logger.debug('Error handler - Full error object:', error);
            logger.debug('Error handler - Active launches:', Array.from(this.activeLaunches.keys()));
            
            if (instanceId) {
                logger.debug('Attempting to cancel launch for instance:', instanceId);
                await window.electron.cancelLaunch(instanceId);
                // Remove from active launches
                this.activeLaunches.delete(instanceId);
                logger.debug('Removed failed instance from active launches:', instanceId);
                // Clear download progress
                launchActions.clearDownloadProgress(instanceId);
            } else {
                logger.debug('No instance ID available, attempting global cancel');
                await window.electron.cancelLaunch();
            }
        };
        const errorCleanup = window.electron.onError?.(errorHandler);
        if (errorCleanup) this.cleanupFunctions.push(errorCleanup);

        // Launch error handler
        const launchErrorHandler = async (error) => {
            logger.debug('Launch error handler received:', error);
            
            // Only handle fatal errors - recoverable errors are handled by warning handler
            if (error?.type !== 'fatal') {
                logger.debug('Ignoring non-fatal launch error (will be handled by warning handler):', error);
                return;
            }
            
            // Try to get instance ID from error data first, then check active launches
            let instanceId = error && error.instanceId ? error.instanceId : null;
            
            // If no instance ID in error, try to find it from active launches
            if (!instanceId && this.activeLaunches.size > 0) {
                // Use the most recent active launch as fallback
                const activeIds = Array.from(this.activeLaunches.keys());
                instanceId = activeIds[activeIds.length - 1]; // Most recent
                logger.debug('No instance ID in launch error, using most recent active:', instanceId);
            }
            
            logger.debug('Launch error handler - Instance ID:', instanceId);
            
            // Reset instance status to error state
            if (instanceId) {
                logger.debug('Setting error status for instance:', instanceId);
                launchActions.setInstanceStatus(instanceId, 'error');
                launchActions.setInstanceLaunching(instanceId, false);
            }
            
            // Set global error state
            launchActions.setError(error.message);

            // Cancel launch and reset global state immediately
            if (get(isLaunching)) {
                // Cancel the specific instance if we have an ID, otherwise cancel globally
                if (instanceId) {
                    logger.debug('Attempting to cancel launch for instance:', instanceId);
                    await window.electron.cancelLaunch(instanceId);
                } else {
                    logger.debug('No instance ID available, attempting global cancel');
                    await window.electron.cancelLaunch();
                }
                
                // Reset the specific instance that failed
                if (instanceId) {
                    launchActions.setInstanceStatus(instanceId, 'error');
                    launchActions.setInstanceLaunching(instanceId, false);
                    // Remove from active launches
                    this.activeLaunches.delete(instanceId);
                    logger.debug('Removed failed instance from active launches:', instanceId);
                }
                
                // Reset global launch state immediately
                launchActions.reset();
                
                // Reset all other launching instances to ready state
                const states = get(instanceLaunchStates);
                Object.keys(states).forEach(id => {
                    if (states[id].isLaunching && id !== instanceId) {
                        this.resetInstanceState(id);
                    }
                });
                
                await logger.endSession();
            }
        };
        const launchErrorCleanup = window.electron.onLaunchError?.(launchErrorHandler);
        if (launchErrorCleanup) this.cleanupFunctions.push(launchErrorCleanup);

        // Extract handler
        const extractHandler = (data) => {
            if (logger && logger.warn) {
                logger.warn(`※ ${$t("mainContent.launch.launchStatus.extracting")} ...`, data);
            }
            if (data && data.instanceId) {
                launchActions.setInstanceStatus(data.instanceId, "extracting");
            }
        };
        const extractCleanup = window.electron.onLaunchExtract?.(extractHandler);
        if (extractCleanup) this.cleanupFunctions.push(extractCleanup);

        // Check handler
        const checkHandler = (data) => {
            if (logger && logger.warn) {
                logger.warn(`⁂ ${$t("mainContent.launch.launchStatus.verifying")} ...`, data);
            }
            if (data && data.instanceId) {
                launchActions.setInstanceStatus(data.instanceId, "verifying");
            }
        };
        const checkCleanup = window.electron.onLaunchCheck?.(checkHandler);
        if (checkCleanup) this.cleanupFunctions.push(checkCleanup);

        // Close handler
        const closeHandler = async (data) => {
            logger.debug('Close handler - received data:', data);
            logger.debug('Close handler - active launches:', Array.from(this.activeLaunches.keys()));
            
            // Try to get instance ID from data first, then check active launches
            let instanceId = data && data.instanceId ? data.instanceId : null;
            
            // If no instance ID in data, try to find it from active launches
            if (!instanceId && this.activeLaunches.size > 0) {
                // Use the most recent active launch as fallback
                const activeIds = Array.from(this.activeLaunches.keys());
                instanceId = activeIds[activeIds.length - 1]; // Most recent
                logger.debug('No instance ID in close data, using most recent active:', instanceId);
            }
            
            logger.debug('Close handler - resolved instanceId:', instanceId);
            
            // Handle crashes specifically
            if (data && data.isCrash) {
                console.error(`[CRASH DETECTED] Instance ${data.instanceName} (${instanceId}) crashed!`);
                console.error(`  Exit Code: ${data.code}, Signal: ${data.signal}`);
                console.error(`  Runtime: ${(data.runtime / 1000).toFixed(1)}s`);
                
                // Log crash information
                if (logger && logger.error) {
                    logger.error(`[CRASH] Instance "${data.instanceName}" crashed after ${(data.runtime / 1000).toFixed(1)}s`);
                    logger.error(`[CRASH] Exit code: ${data.code}, Signal: ${data.signal}`);
                    logger.error(`[CRASH] Time since last output: ${(data.timeSinceLastOutput / 1000).toFixed(1)}s`);
                }
                
                // Set instance status to crashed
                if (instanceId) {
                    launchActions.setInstanceStatus(instanceId, 'crashed');
                    launchActions.setInstanceLaunching(instanceId, false);
                    launchActions.clearDownloadProgress(instanceId);
                }
                
                // Analyze crash and provide recovery suggestions
                try {
                    const instance = get(instanceStore).instances.find(i => i.id === instanceId);
                    logger.debug('Found instance for crash analysis:', instance);
                    if (instance) {
                        const crashAnalysis = crashRecoveryService.analyzeCrash(instanceId, data);
                        
                        // Store crash analysis for UI components to access
                        if (window.electron && window.electron.storeCrashAnalysis) {
                            window.electron.storeCrashAnalysis(instanceId, crashAnalysis);
                        }
                        
                        // Show crash recovery notification with action button
                        if (window.electron.showNotification) {
                            window.electron.showNotification({
                                title: 'Game Crashed - Recovery Available',
                                body: `${crashAnalysis.strategy.name}: ${crashAnalysis.suggestions[0]}`,
                                type: 'error',
                                actions: [{
                                    text: 'View Recovery Options',
                                    type: 'button'
                                }]
                            }).then(result => {
                                if (result && result.action === 'View Recovery Options') {
                                    logger.debug('Dispatching show-crash-recovery event from notification:', { instance, crashData: data, crashAnalysis });
                                    // Dispatch event to show crash recovery modal
                                    window.dispatchEvent(new CustomEvent('show-crash-recovery', {
                                        detail: { instance, crashData: data, crashAnalysis }
                                    }));
                                    logger.debug('show-crash-recovery event dispatched from notification successfully');
                                }
                            });
                        }
                        
                        // Also dispatch the event immediately so the modal shows up
                        logger.debug('Dispatching show-crash-recovery event immediately:', { instance, crashData: data, crashAnalysis });
                        window.dispatchEvent(new CustomEvent('show-crash-recovery', {
                            detail: { instance, crashData: data, crashAnalysis }
                        }));
                        logger.debug('show-crash-recovery event dispatched immediately successfully');
                    }
                } catch (analysisError) {
                    console.error('Failed to analyze crash:', analysisError);
                }
                
                // Show crash notification to user
                if (window.electron.showNotification) {
                    window.electron.showNotification({
                        title: 'Game Crashed',
                        body: `Instance "${data.instanceName}" has crashed. Exit code: ${data.code}`,
                        type: 'error'
                    });
                }
                
                // Store crash info for potential recovery suggestions
                if (instanceId) {
                    const crashInfo = {
                        instanceId: instanceId,
                        instanceName: data.instanceName,
                        exitCode: data.code,
                        signal: data.signal,
                        runtime: data.runtime,
                        timestamp: data.timestamp || Date.now(),
                        crashCount: (window.electron.getCrashHistory?.(instanceId)?.crashCount || 0) + 1
                    };
                    
                    // Store in local storage for persistence
                    try {
                        const existingCrashes = JSON.parse(localStorage.getItem('crashHistory') || '[]');
                        existingCrashes.push(crashInfo);
                        localStorage.setItem('crashHistory', JSON.stringify(existingCrashes.slice(-10))); // Keep last 10 crashes
                    } catch (error) {
                        console.error('Failed to store crash history:', error);
                    }
                }
            } else {
                // Normal close - reset the closed instance
                if (instanceId) {
                    launchActions.setInstanceStatus(instanceId, 'ready');
                    launchActions.setInstanceLaunching(instanceId, false);
                    launchActions.clearDownloadProgress(instanceId);
                }
            }
            
            // Reset global launch state if this was the only launching instance
            const states = get(instanceLaunchStates);
            const hasOtherLaunchingInstances = Object.values(states).some(state => state.isLaunching && state.status !== 'error' && state.status !== 'ready');
            if (!hasOtherLaunchingInstances && get(isLaunching)) {
                launchActions.reset();
            }
            
            launchActions.instanceClosed(instanceId);
            if (logger && logger.endSession) {
                await logger.endSession();
            }
            if (discordRPCManager) {
                discordRPCManager.setIdleActivity();
            }
        };
        const closeCleanup = window.electron.onLaunchClose?.(closeHandler);
        if (closeCleanup) this.cleanupFunctions.push(closeCleanup);

        // Cancel handler
        const cancelHandler = (data) => {
            const msg = data && data.message ? (typeof data.message === 'object' ? JSON.stringify(data.message) : data.message) : 'Cancelled';
            if (logger && logger.info) {
                logger.info(`ൠ ${msg}`);
            }
            // Try to get instance ID from data first, then check active launches
            let instanceId = data && data.instanceId ? data.instanceId : null;
            
            // If no instance ID in data, try to find it from active launches
            if (!instanceId && this.activeLaunches.size > 0) {
                // Use the most recent active launch as fallback
                const activeIds = Array.from(this.activeLaunches.keys());
                instanceId = activeIds[activeIds.length - 1]; // Most recent
                logger.debug('No instance ID in cancel data, using most recent active:', instanceId);
            }
            
            // Reset the cancelled instance
            if (instanceId) {
                launchActions.setInstanceStatus(instanceId, 'ready');
                launchActions.setInstanceLaunching(instanceId, false);
            }
            
            // Reset global launch state if this was the only launching instance
            const states = get(instanceLaunchStates);
            const hasOtherLaunchingInstances = Object.values(states).some(state => state.isLaunching && state.status !== 'error' && state.status !== 'ready');
            if (!hasOtherLaunchingInstances && get(isLaunching)) {
                launchActions.reset();
            }
            
            launchActions.instanceClosed(instanceId);
        };
        const cancelCleanup = window.electron.onLaunchCancelled?.(cancelHandler);
        if (cancelCleanup) this.cleanupFunctions.push(cancelCleanup);

        // Homepage launch event listener
        const homepageLaunchHandler = (event) => {
            const instance = event.detail;
            if (instance && instance.id) {
                logger.debug(`[GAME LAUNCHER] Homepage launch request for instance: ${instance.name}`);
                this.launchInstance(instance);
            }
        };
        document.addEventListener('launchInstance', homepageLaunchHandler);
        this.cleanupFunctions.push(() => {
            document.removeEventListener('launchInstance', homepageLaunchHandler);
        });

        logger.debug(`[GAME LAUNCHER] Setup ${this.cleanupFunctions.length} launch listeners`);
        return this.cleanupFunctions;
    },

    /**
     * Reset all instance launch states to ready
     */
    resetAllInstanceStates() {
        const states = get(instanceLaunchStates);
        Object.keys(states).forEach(instanceId => {
            launchActions.setInstanceStatus(instanceId, 'ready');
            launchActions.setInstanceLaunching(instanceId, false);
        });
        logger.debug('[GAME LAUNCHER] Reset all instance states to ready');
    },

    /**
     * Reset instance state to ready (useful for error recovery)
     * @param {string} instanceId - The instance ID to reset
     */
    resetInstanceState(instanceId) {
        if (instanceId) {
            launchActions.setInstanceStatus(instanceId, 'ready');
            launchActions.setInstanceLaunching(instanceId, false);
            logger.debug(`[GAME LAUNCHER] Reset instance ${instanceId} state to ready`);
        }
    },

    /**
     * Cleanup all launch listeners
     */
    cleanupLaunchListeners() {
        this.cleanupFunctions.forEach(cleanup => cleanup());
        this.cleanupFunctions = [];
        logger.debug('[GAME LAUNCHER] Cleaned up launch listeners');
    },

    /**
     * Cancel a running launch
     * @param {string} instanceId - The ID of the instance to cancel
     * @returns {Promise<void>}
     */
    async cancelLaunch(instanceId) {
        if (!instanceId) {
            console.warn('[GAME LAUNCHER] No instance ID provided for cancellation');
            return;
        }

        logger.debug(`[GAME LAUNCHER] Cancelling launch for instance: ${instanceId}`);
        
        try {
            // Call the backend to cancel the launch
            const result = await window.electron.invoke('cancel-launch', instanceId);
            
            if (result && result.success) {
                logger.debug(`[GAME LAUNCHER] Successfully cancelled launch for ${instanceId}`);
                
                // Update frontend state immediately
                launchActions.setInstanceStatus(instanceId, 'ready');
                launchActions.setInstanceLaunching(instanceId, false);
                launchActions.instanceClosed(instanceId);
                
                // Remove from active launches
                this.activeLaunches.delete(instanceId);
                
                // Reset global launch state if needed
                const states = get(instanceLaunchStates);
                const hasOtherLaunchingInstances = Object.values(states).some(
                    state => state.isLaunching && state.status !== 'error' && state.status !== 'ready'
                );
                
                if (!hasOtherLaunchingInstances && get(isLaunching)) {
                    launchActions.reset();
                    await logger.endSession();
                }
                
                showToast('Launch cancelled', 'normal');
            } else {
                console.error(`[GAME LAUNCHER] Failed to cancel launch: ${result?.error || 'Unknown error'}`);
                showToast(`Failed to cancel launch: ${result?.error || 'Unknown error'}`, 'error');
            }
        } catch (error) {
            console.error('[GAME LAUNCHER] Error cancelling launch:', error);
            showToast('Error cancelling launch', 'error');
        }
    },

    /**
     * Launch a Minecraft instance
     * @param {Object} instance - The instance to launch
     * @returns {Promise<void>}
     */
    async launchInstance(instance) {
        if (!instance) {
            throw new Error('No instance provided');
        }

        // Register this instance as an active launch
        this.activeLaunches.set(instance.id, {
            instanceId: instance.id,
            instanceName: instance.name,
            startTime: Date.now()
        });

        logger.debug('Launching instance:', instance);
        logger.debug('Instance data structure:', JSON.stringify(instance, null, 2));
        logger.debug('Active launches:', Array.from(this.activeLaunches.keys()));

        try {
            // Check if an account is selected
            const account = getSelectedAccount();
            if (!account) {
                uiState.toggleModel.set('accountadder');
                return;
            }

            // Update last played timestamp
            await instanceStore.updateLastPlayed(instance.id);

            // Load instance mods
            logger.info('Loading mods for instance:', instance.id);
            const mods = await instanceStore.loadInstanceMods(instance.id);
            logger.info('Loaded mods:', mods);
            const enabledMods = mods.filter(mod => mod.enabled);
            logger.info('Enabled mods:', enabledMods);

            // Load instance resource packs
            logger.info('Loading resource packs for instance:', instance.id);
            const resourcePacks = await instanceStore.getInstanceResourcePacks(instance.id);
            logger.info('Loaded resource packs:', resourcePacks);
            const enabledResourcePacks = resourcePacks.filter(rp => rp.enabled);
            logger.info('Enabled resource packs:', enabledResourcePacks);

            const loaderConfig = instance.loader && instance.loader !== 'vanilla' ? {
                enable: true,
                type: instance.loader,
                build: instance.loaderVersion
            } : { enable: false, type: null, build: null };

            logger.info('Settings:', get(settings));
            logger.info(instance, 'instanceee')
            // Safely get settings with fallbacks
            const runDetached = get(settings)?.game?.runtime?.runDetached?.value ?? false;

            // Determine the instance path - use instance.path if available, otherwise create a default path
            let instancePath;
            if (instance.path) {
                instancePath = instance.path;
            } else {
                // Create a default instance path in the app data folder
                const appFolder = await window.electron.getAppFolder();
                instancePath = await window.electron.pathJoin(appFolder, 'instances', instance.id);
            }

            // Ensure the instance directory and mods folder exist
            try {
                await window.electron.ensureDir(instancePath);
                const modsPath = await window.electron.pathJoin(instancePath, 'mods');
                await window.electron.ensureDir(modsPath);
                logger.info(`Ensured instance directory exists: ${instancePath}`);
                logger.info(`Ensured mods directory exists: ${modsPath}`);
            } catch (dirError) {
                logger.error('Failed to create instance directories:', dirError);
            }

            const launchOptions = {
                url: null,
                instanceId: instance.id,
                instanceName: instance.name,
                authenticator: account,
                version: instance.gameVersion,
                path: instancePath,
                detached: runDetached,
                loader: loaderConfig,
                loaderVersion: instance.loaderVersion,
                javaPath: instance.javaPath || null,
                downloadFileMultiple: 20,
			    bypassOffline: false,
                intelEnabledMac: false,
                memory: {
                    min: instance.memory?.min || '2048M',
                    max: instance.memory?.max || '4096M'
                },
                jvmArgs: instance.jvmArgs || [],
                gameArgs: instance.gameArgs || [],
                mods: enabledMods.map(mod => ({
                    name: mod.name,
                    fileName: mod.file_name,
                    downloadUrl: mod.download_url,
                    dependencies: JSON.parse(mod.dependencies || '[]')
                })),
                resourcePacks: enabledResourcePacks.map(rp => ({
                    name: rp.name,
                    fileName: rp.file_name,
                    filePath: rp.file_path
                }))
            };

            logger.debug('Launching with options:', launchOptions);

            // Set per-instance launch status and open console
            launchActions.setInstanceLaunching(instance.id, true);
            launchActions.setInstanceStatus(instance.id, 'preparing');

            // Launch the game with instance-specific configuration
            await window.electron.launchGame(launchOptions);
        } catch (error) {
            console.error('Failed to launch instance:', error);
            launchActions.setInstanceStatus(instance.id, 'error');
            launchActions.setInstanceLaunching(instance.id, false);
            
            // Remove from active launches on failure
            this.activeLaunches.delete(instance.id);
            logger.debug('Removed failed instance from active launches:', instance.id);
            
            // Reset global launch state if this was the only launching instance
            const states = get(instanceLaunchStates);
            const hasOtherLaunchingInstances = Object.values(states).some(state => state.isLaunching && state.status !== 'error');
            if (!hasOtherLaunchingInstances) {
                launchActions.reset();
            }
            
            showToast(`Failed to launch instance: ${error.message}`, 'error');
            throw error;
        }
    },

    /**
     * Check if an instance can be launched
     * @param {Object} instance - The instance to check
     * @returns {Object} - { canLaunch: boolean, reason: string|null }
     */
    canLaunchInstance(instance) {
        if (!instance) {
            return { canLaunch: false, reason: 'No instance selected' };
        }

        const account = getSelectedAccount();
        if (!account) {
            return { canLaunch: false, reason: 'No Minecraft account selected' };
        }

        return { canLaunch: true, reason: null };
    },

    /**
     * Cancel an active launch
     * @param {string} instanceId - The instance ID to cancel
     */
    async cancelLaunch(instanceId) {
        if (!instanceId) return;
        
        logger.debug(`[GAME LAUNCHER] Cancelling launch for instance: ${instanceId}`);
        try {
            const result = await window.electron.cancelLaunch(instanceId);
            if (result.success) {
                logger.debug(`[GAME LAUNCHER] Cancel successful for instance: ${instanceId}`);
                
                // Update local state
                launchActions.setInstanceStatus(instanceId, 'ready');
                launchActions.setInstanceLaunching(instanceId, false);
                
                // Remove from active launches
                this.activeLaunches.delete(instanceId);
                
                showToast('Launch cancelled', 'normal');
            } else {
                console.error(`[GAME LAUNCHER] Cancel failed: ${result.error}`);
                // Even if backend says failed (maybe already finished?), we should reset UI
                launchActions.setInstanceStatus(instanceId, 'ready');
                launchActions.setInstanceLaunching(instanceId, false);
                this.activeLaunches.delete(instanceId);
            }
        } catch (error) {
            console.error(`[GAME LAUNCHER] Cancel exception:`, error);
        }
    },

    /**
     * Get the launch status for an instance
     * @param {string} instanceId - The instance ID
     * @returns {Object} - Launch status information
     */
    getInstanceLaunchStatus(instanceId) {
        // This would integrate with the existing launch status system
        // Implementation would depend on how the launch stores are structured
        return {
            isLaunching: false, // This would come from launchActions
            status: 'ready',    // This would come from launchActions
            isRunning: false    // This would check runningInstancesList
        };
    }
};

export default gameLauncher;
