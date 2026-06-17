// @ts-nocheck
/**
 * @author Cosmic-fi
 * @description Main entry point for the WinterLauncher application.
*/

import{ app, ipcMain, dialog, Notification, shell } from "electron";
import UpdaterPkg from 'electron-updater';
import msmc, { Auth } from 'msmc';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import os from 'os'
import http from 'https';
import https from 'https';
import { fileURLToPath } from 'url';
import yauzl from 'yauzl';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { HttpProxyAgent } from 'http-proxy-agent';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


import { setAppWindow, getAppWindow, closeAppWindow } from './window/appWindow.js';
import { createConsoleWindow, setupConsoleIpcHandlers, getConsoleWindow, sendConsoleData, setupLoggerBridge } from './window/consoleWindow.js';
import { execSync, spawn } from "child_process";
import { discordRPC } from './utils/discordRPC.js';
import { Launch } from "wintercore-mc";

const { autoUpdater } = UpdaterPkg;

const rootDirectory = process.env.APPDATA || (process.platform === 'darwin' ? `${process.env.APPDATA}/Library/Application Support`: process.env.HOME);


/**
 * @name setupIpcHandlers
 * @description Sets up IPC handlers for communication between the main and renderer processes.
*/
const setupIpcHandlers = async () => {
    console.log('[MAIN] Setting up IPC handlers...');
    // CONSOLE WINDOW HANDLERS
    setupConsoleIpcHandlers();
    
    let consoleLogQueue = [];
    let consoleLogTimer = null;
    const flushConsoleLogs = () => {
        const logs = consoleLogQueue;
        console.log(`[MAIN] Flushing ${logs.length} logs to console window`);
        consoleLogQueue = [];
        consoleLogTimer = null;
        const consoleWin = getConsoleWindow();
        if (consoleWin && !consoleWin.isDestroyed()) {
            for (const log of logs) {
                const logMsg = typeof log.message === 'object' ? JSON.stringify(log.message) : log.message;
                console.log(`[MAIN] Sending log to console: level=${log.level}, message=${logMsg}`);
                consoleWin.webContents.send('console-data', log);
            }
        } else {
            console.log(`[MAIN] Console window not available or destroyed`);
        }
    };
    
    const spawnAsync = (command, args, options = {}) => new Promise((resolve, reject) => {
        try {
            const child = spawn(command, args, { stdio: 'ignore', ...options });
            child.on('error', reject);
            child.on('close', (code) => {
                if (code === 0 || code === null) resolve(true);
                else reject(new Error(`${command} exited with code ${code}`));
            });
        } catch (e) {
            reject(e);
        }
    });
    const extractArchive = async (tempFile, destDir) => {
        try {
            if (process.platform === 'darwin') {
                await spawnAsync('ditto', ['-x', '-k', tempFile, destDir]);
            } else {
                try {
                    await spawnAsync('unzip', ['-o', tempFile, '-d', destDir]);
                } catch (error) {
                    // Handle specific unzip exit codes
                    if (error.message.includes('exited with code 9')) {
                        console.error(`[MAIN] unzip exit code 9 - ZIP file may be corrupted or incomplete: ${tempFile}`);
                        throw new Error(`ZIP extraction failed - file appears to be corrupted or incomplete (exit code 9). This may happen if the download was interrupted or the file is not a valid ZIP archive.`);
                    } else if (error.message.includes('exited with code 2')) {
                        console.error(`[MAIN] unzip exit code 2 - generic error: ${tempFile}`);
                        throw new Error(`ZIP extraction failed with generic error (exit code 2). The file may be corrupted or there may be permission issues.`);
                    } else {
                        throw error;
                    }
                }
            }
        } catch (error) {
            console.error(`[MAIN] extractArchive failed for ${tempFile}:`, error);
            throw error;
        }
    };
    const findFileRecursively = async (rootDir, targetName) => {
        const queue = [rootDir];
        while (queue.length) {
            const dir = queue.shift();
            const entries = await fs.readdir(dir, { withFileTypes: true });
            for (const e of entries) {
                const p = path.join(dir, e.name);
                if (e.isFile() && e.name === targetName) return p;
                if (e.isDirectory()) queue.push(p);
            }
        }
        return null;
    };
    
    // LOGGER BRIDGE - Forward logger events to console window
    ipcMain.handle('log-to-console', async (event, logData) => {
        // Forward logger data to console window via logger bridge
        console.log(`[MAIN] Received log-to-console: level=${logData?.level}, message=${logData?.message}`);
        if (event.sender.id === getAppWindow()?.webContents.id) {
            // Only forward logs from the main window
            const level = (logData?.level || '').toUpperCase();
            // Forward all log levels to console window, not just errors and warnings
            consoleLogQueue.push(logData);
            if (!consoleLogTimer) {
                consoleLogTimer = setTimeout(flushConsoleLogs, 100);
            }
        } else {
            console.log(`[MAIN] Log ignored - not from main window. Sender ID: ${event.sender.id}, Main window ID: ${getAppWindow()?.webContents.id}`);
        }
    });
    
    // Helper function to categorize launch errors
    function categorizeLaunchError(error) {
        const errorMessage = error?.message || '';
        const errorType = error?.name || '';
        
        // Define recoverable error patterns
        const recoverablePatterns = [
            /fetch failed/i,
            /network error/i,
            /timeout/i,
            /connection refused/i,
            /dns/i,
            /socket hang up/i,
            /econnreset/i,
            /certificate/i,
            /asset.*download/i,
            /library.*download/i,
            /resource.*download/i,
            /file.*download/i,
            /http.*5\d\d/i, // Server errors (500-599)
            /http.*4\d\d/i, // Client errors (400-499) - some may be recoverable
        ];
        
        // Define fatal error patterns
        const fatalPatterns = [
            /java.*not found/i,
            /java.*missing/i,
            /java.*error/i,
            /loader.*not found/i,
            /invalid.*loader/i,
            /unsupported.*version/i,
            /corrupt.*file/i,
            /invalid.*configuration/i,
            /insufficient.*memory/i,
            /out of memory/i,
            /permgen space/i,
        ];
        
        // Check for fatal errors first
        for (const pattern of fatalPatterns) {
            if (pattern.test(errorMessage) || pattern.test(errorType)) {
                return { type: 'fatal', severity: 'high', message: errorMessage };
            }
        }
        
        // Check for recoverable errors
        for (const pattern of recoverablePatterns) {
            if (pattern.test(errorMessage) || pattern.test(errorType)) {
                return { type: 'recoverable', severity: 'medium', message: errorMessage };
            }
        }
        
        // Default to recoverable for unknown errors (better to try than fail)
        return { type: 'recoverable', severity: 'low', message: errorMessage };
    }
    
    // GAME LAUNCH HANDLERS
    ipcMain.handle('launch-game', async (event, options) => {
        // Validate and fix loader version if needed
        if (options.loader && options.loader.enable && options.loader.build && options.loader.build !== 'latest') {
            const fixedBuild = validateAndFixLoaderVersion(
                options.version, 
                options.loader.type, 
                options.loader.build
            );
            if (fixedBuild !== options.loader.build) {
                console.log(`Fixed loader build in launch options: ${options.loader.build} -> ${fixedBuild}`);
                options.loader.build = fixedBuild;
            }
        }
        
        // Also fix the loaderVersion field if it exists and is not 'latest'
        if (options.loaderVersion && options.loaderVersion !== 'latest' && options.version && options.loader && (options.loader.type === 'forge' || options.loader.type === 'neoforge')) {
            const fixedLoaderVersion = validateAndFixLoaderVersion(
                options.version,
                options.loader.type,
                options.loaderVersion
            );
            if (fixedLoaderVersion !== options.loaderVersion) {
                console.log(`Fixed loaderVersion in launch options: ${options.loaderVersion} -> ${fixedLoaderVersion}`);
                options.loaderVersion = fixedLoaderVersion;
            }
        }
        
        // Create a new launcher instance for each launch
        const launcher = new Launch();
        let isCancelled = false;
        const currentInstanceId = options.instanceId;
        
        // Store launcher instance for this specific game instance
        if (!global.launcherInstances) {
            global.launcherInstances = new Map();
        }
        global.launcherInstances.set(currentInstanceId, { launcher, isCancelled });
    
        try {
            console.log("======= Starting game launch =======");
            
            launcher.on('progress', (progress, size, element) => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    event.sender.send('launch-progress', { progress, size, element, instanceId: currentInstanceId });
                }
            });
            
            launcher.on('extract', (data) => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    const extractData = typeof data === 'object' ? { ...data, instanceId: currentInstanceId } : { data, instanceId: currentInstanceId };
                    event.sender.send('launch-extract', extractData);
                }
            });
            
            launcher.on('check', (data) => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    const checkData = typeof data === 'object' ? { ...data, instanceId: currentInstanceId } : { data, instanceId: currentInstanceId };
                    event.sender.send('launch-check', checkData);
                }
            });
            
            launcher.on('estimated_time', (data) => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    const timeData = typeof data === 'object' ? { ...data, instanceId: currentInstanceId } : { data, instanceId: currentInstanceId };
                    event.sender.send('launch-estimated-time', timeData);
                }
            });
            
            launcher.on('complete', (data) => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    // Include instance data in the complete event
                    const completeData = {
                        ...data,
                        instanceId: options.instanceId,
                        instanceName: options.instanceName
                    };
                    event.sender.send('launch-complete', completeData);
                }
            });
    
            launcher.on('data', (data) => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    // Standardize data format and include instanceId
                    const logData = {
                        data: data,
                        instanceId: currentInstanceId
                    };
                    event.sender.send('launch-data', logData);
                }
            });
    
            launcher.on('error', (error) => {
                console.log(error);
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    // Categorize the error
                    const errorCategory = categorizeLaunchError(error);
                    
                    // Enhanced error message generation
                    let enhancedMessage = 'Unknown error';
                    if (error && error.message) {
                        enhancedMessage = error.message;
                    } else if (typeof error === 'string') {
                        enhancedMessage = error;
                    } else if (error && error.code) {
                        enhancedMessage = `Error code: ${error.code}`;
                    } else if (error && error.name) {
                        enhancedMessage = `${error.name}: ${error.message || 'No message provided'}`;
                    }
                    
                    // Add context based on error type
                    if (enhancedMessage.includes('fetch failed')) {
                        enhancedMessage = `Network download failed: ${enhancedMessage}. This may be due to internet connectivity issues or server problems.`;
                    } else if (enhancedMessage.includes('Loader') && enhancedMessage.includes('not found')) {
                        enhancedMessage = `Minecraft loader error: ${enhancedMessage}. The requested loader may not be supported or available.`;
                    } else if (enhancedMessage.includes('Java')) {
                        enhancedMessage = `Java runtime error: ${enhancedMessage}. Please check your Java installation.`;
                    } else if (enhancedMessage.includes('timeout')) {
                        enhancedMessage = `Operation timed out: ${enhancedMessage}. The server may be slow or unreachable.`;
                    } else if (enhancedMessage.includes('forge') || enhancedMessage.includes('Forge')) {
                        enhancedMessage = `Forge installation error: ${enhancedMessage}. This may be due to Forge server issues or version incompatibility.`;
                        // Add available versions info if it's a build not found error
                        if (enhancedMessage.includes('Build') && enhancedMessage.includes('not found')) {
                            enhancedMessage += ` Try using a different Forge version or check the available versions in the launcher.`;
                        }
                    } else if (enhancedMessage.includes('asset') || enhancedMessage.includes('library')) {
                        enhancedMessage = `Minecraft file download error: ${enhancedMessage}. Some files may be missing or corrupted.`;
                    }
                    
                    // Handle different error types
                    if (errorCategory.type === 'recoverable') {
                        // For recoverable errors (like network issues), log as warning but don't cancel launch
                        console.warn(`[RECOVERABLE ERROR] ${enhancedMessage} (Severity: ${errorCategory.severity})`);
                        
                        // Send as warning instead of error to prevent launch cancellation
                        const warningWithInstance = {
                            message: enhancedMessage,
                            name: error?.name,
                            stack: error?.stack,
                            code: error?.code,
                            instanceId: currentInstanceId,
                            instanceName: options.instanceName,
                            severity: errorCategory.severity,
                            type: 'warning'
                        };
                        event.sender.send('launch-warning', warningWithInstance);
                        console.log('Warning for instance', currentInstanceId, ':', warningWithInstance);
                    } else {
                        // For fatal errors, send as error to trigger launch cancellation
                        const errorWithInstance = {
                            message: enhancedMessage,
                            name: error?.name,
                            stack: error?.stack,
                            code: error?.code,
                            instanceId: currentInstanceId,
                            instanceName: options.instanceName,
                            severity: errorCategory.severity,
                            type: 'fatal'
                        };
                        event.sender.send('error', errorWithInstance);
                        console.log('Fatal error for instance', currentInstanceId, ':', errorWithInstance);
                    }
                }
            });
    
            launcher.on('close', closeData => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData && !instanceData.isCancelled) {
                    // Enhanced close event with crash detection
                    const enhancedCloseData = {
                        code: closeData.code,
                        signal: closeData.signal,
                        runtime: closeData.runtime,
                        isCrash: closeData.isCrash,
                        timeSinceLastOutput: closeData.timeSinceLastOutput,
                        instanceId: currentInstanceId,
                        instanceName: options.instanceName,
                        timestamp: Date.now()
                    };
                    
                    // Log crash information if detected
                    if (closeData.isCrash) {
                        console.error(`[CRASH DETECTED] Instance ${options.instanceName} (${currentInstanceId}) crashed:`);
                        console.error(`  Exit Code: ${closeData.code}`);
                        console.error(`  Signal: ${closeData.signal}`);
                        console.error(`  Runtime: ${(closeData.runtime / 1000).toFixed(1)}s`);
                        console.error(`  Time since last output: ${(closeData.timeSinceLastOutput / 1000).toFixed(1)}s`);
                        
                        // Store crash information for later analysis
                        if (!global.crashHistory) {
                            global.crashHistory = new Map();
                        }
                        global.crashHistory.set(currentInstanceId, {
                            ...enhancedCloseData,
                            gameVersion: options.version,
                            loader: options.loader?.type,
                            loaderVersion: options.loader?.build,
                            javaVersion: options.java?.version,
                            memory: options.memory,
                            crashCount: (global.crashHistory.get(currentInstanceId)?.crashCount || 0) + 1,
                            lastCrash: Date.now()
                        });
                    }
                    
                    console.log('=================[CRASH MESSAGE]===============\n', closeData);
                    event.sender.send('launch-close', enhancedCloseData);
                }
                console.log('=================[CRASH MESSAGE]===============\n', closeData);
                // Clean up this instance
                global.launcherInstances?.delete(currentInstanceId);
            });
            
            launcher.on('cancelled', message => {
                const instanceData = global.launcherInstances?.get(currentInstanceId);
                if (instanceData) {
                    instanceData.isCancelled = true;
                    // Include instance data in the cancelled event
                    const cancelledData = {
                        message: typeof message === 'object' ? (message.message || JSON.stringify(message)) : message,
                        instanceId: options.instanceId,
                        instanceName: options.instanceName
                    };
                    event.sender.send('launch-cancelled', cancelledData);
                    
                    // Clean up this instance
                    global.launcherInstances?.delete(currentInstanceId);
                }
            });
            
            await launcher.Launch(options);
            console.log('Launch initiated successfully\n',options);
            return { success: true };
        } catch (error) {
            console.log(error);
            console.error('Launch failed:', error);
            // Include instance ID in launch error event
            const errorWithInstance = {
                message: (error && error.message) ? error.message : (typeof error === 'string' ? error : 'Unknown error'),
                name: error?.name,
                stack: error?.stack,
                code: error?.code,
                instanceId: currentInstanceId,
                instanceName: options.instanceName
            };
            event.sender.send('launch-error', errorWithInstance);

            // Clean up this instance on error
            global.launcherInstances?.delete(currentInstanceId);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('cancel-launch', async (event, instanceId) => {
        try {
            console.log('=============Requesting to cancel==============');
            if (instanceId) {
                console.log(`Instance ID to cancel: ${instanceId}`);
            }
            
            // If no instance ID provided, try to cancel the most recent one (fallback)
            if (!instanceId) {
                console.log('No instance ID provided, attempting to cancel first active instance');
                if (global.launcherInstances && global.launcherInstances.size > 0) {
                    instanceId = global.launcherInstances.keys().next().value;
                    console.log(`Found active instance to cancel: ${instanceId}`);
                } else {
                    console.log('No active instances found to cancel');
                    return { success: false, error: 'No active launch found' };
                }
            }
            
            // Find the specific launcher instance
            const instanceData = global.launcherInstances?.get(instanceId);
            if (instanceData && instanceData.launcher) {
                try {
                    // Send cancel signal to the launcher
                    // Note: Depending on the library, this might be async or sync
                    // We're assuming the launcher instance has a cancel method
                    if (typeof instanceData.launcher.cancel === 'function') {
                        await instanceData.launcher.cancel();
                    } else if (typeof instanceData.launcher.kill === 'function') {
                        // Fallback for some process-based launchers
                        instanceData.launcher.kill();
                    } else {
                        console.warn('Launcher instance does not have a cancel or kill method');
                    }
                    
                    instanceData.isCancelled = true;
                    console.log('[ Launcher cancelled successfully ]');
                    
                    // Send cancelled event to frontend to ensure UI updates
                    event.sender.send('launch-cancelled', { 
                        instanceId: instanceId,
                        message: 'Launch cancelled by user'
                    });
                    
                    // Clean up the instance after cancellation
                    global.launcherInstances.delete(instanceId);
                    
                    return { success: true };
                } catch (cancelError) {
                    console.error('Error cancelling launcher:', cancelError);
                    return { success: false, error: cancelError.message };
                }
            } else {
                console.log(`[ No launcher found for instance: ${instanceId} ]`);
                return { success: false, error: 'Instance not found or already closed' };
            }
        } catch (error) {
            console.error('Cancel failed:', error);
            return { success: false, error: error.message };
        }
    });

    // ACCOUNT HANDLERS
    ipcMain.handle('add-account', async () => {
        try {
            const auth = new msmc.Auth('select_account');
            const result = await auth.launch('electron', {
                resizable: false,
                width: 700,
                height: 500,
                title: "Winter Launcher",
                icon: path.join(
                    __dirname,
                    `../../public/icons/${os.platform() === "win32" ? "icon.ico" : "icon.png"}`
                )
            })
            const mc = await result.getMinecraft();

            return JSON.stringify({
                success: true,
                mc: mc.mclc(),
                extra: mc
            });
        } catch (error) {
            console.error("Error during account authentication:", error);
            return JSON.stringify({
                success: false,
                error: error.message || "Authentication process was canceled or failed.",
            });
        }
    });
    ipcMain.handle('refresh-account', async (event, profile) => {
        try {
            if(!profile){
                return {
                    success: false,
                    error: 'Profile is null!'
                }
            }    
            const refreshed = await new msmc.Auth().refresh(profile.refresh_token);
            return {
                success: true,
                mc: (await refreshed.getMinecraft()).mclc(),
                extra: refreshed
            }
        } catch (error) {
            // console.log('Account refresh error: ', error);
            return {
                success: false,
                error: error.message | 'Account refresh failed!'
            }
        }
    });

    // SYSTEM & UTILITY HANDLERS
    ipcMain.handle("open-folder-dialog", async () => {
        const result = await dialog.showOpenDialog(getAppWindow(), {
            properties: ["openDirectory", "dontAddToRecent"],
        });

        return result.filePaths[0] || null;
    });
    ipcMain.handle('open-folder-in-explorer', async (event, folderPath) => {
        console.log(`[MAIN] Request to open folder: ${folderPath}`);
        
        let targetPath = folderPath;
        
        // Resolve path if it's relative
        if (!path.isAbsolute(targetPath)) {
            // Remove leading ./ or .\ if present for cleaner joining
            const cleanPath = targetPath.replace(/^\.[\\/]/, '');
            targetPath = path.join(rootDirectory, '.WinterLauncher', cleanPath);
            console.log(`[MAIN] Resolved relative path to: ${targetPath}`);
        }
        
        try {
            // Check if path exists
            await fs.access(targetPath);
            const error = await shell.openPath(targetPath);
            if (error) {
                console.error(`[MAIN] shell.openPath failed: ${error}`);
                throw new Error(error);
            }
            return { success: true };
        } catch (error) {
            console.error(`[MAIN] Failed to open path ${targetPath}:`, error);
            
            // If folder doesn't exist, try opening the instances directory or parent
            try {
                const parentDir = path.dirname(targetPath);
                console.log(`[MAIN] Attempting to open parent: ${parentDir}`);
                
                await fs.access(parentDir);
                const parentError = await shell.openPath(parentDir);
                
                if (parentError) {
                    console.error(`[MAIN] Parent open failed: ${parentError}`);
                    throw new Error(parentError);
                }
                return { success: true, fallback: true };
            } catch (parentError) {
                console.error(`[MAIN] Failed to open parent path: ${path.dirname(targetPath)}`, parentError);
                throw parentError;
            }
        }
    });
    // Add generic shell-open-path handler for compatibility
    ipcMain.handle('shell-open-path', async (event, path) => {
        await shell.openPath(path);
    });
    ipcMain.handle('get-app-path', () => {
        // Use custom .WinterLauncher folder in AppData instead of default WinterLauncher
        const appDataPath = app.getPath('appData');
        return path.join(appDataPath, '.WinterLauncher');
    });
    ipcMain.handle('get-minecraft-path', () => {
        const appDataPath = app.getPath('appData');
        return path.join(appDataPath, '.WinterLauncher', '.Minecraft');
    });
    ipcMain.handle('get-backup-folder', () => {
        const appDataPath = app.getPath('appData');
        return path.join(appDataPath, '.WinterLauncher', 'backups');
    });

    ipcMain.handle('get-temp-dir', () => {
        return app.getPath('temp');
    });

    ipcMain.handle('fs-rmdir', async (event, dirPath) => {
        try {
            await fs.rm(dirPath, { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            console.error(`[MAIN] Failed to remove directory: ${dirPath}`, error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('file-exists', async (event, filePath) => {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    });

    console.log('[MAIN] Registering stat-file handler...');
    ipcMain.handle('stat-file', async (event, filePath) => {
        console.log(`[MAIN] stat-file handler called for: ${filePath}`);
        try {
            const stats = await fs.stat(filePath);
            console.log(`[MAIN] stat-file success for: ${filePath}`, stats);
            return { success: true, stats: { size: stats.size, isFile: stats.isFile(), isDirectory: stats.isDirectory() } };
        } catch (error) {
            console.error(`[MAIN] Failed to stat file: ${filePath}`, error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('path-exists', async (event, path) => {
        try {
            await fs.access(path);
            return true;
        } catch {
            return false;
        }
    });

    ipcMain.handle('readdir', async (event, dirPath) => {
        try {
            const entries = await fs.readdir(dirPath, { withFileTypes: true });
            return entries.map(entry => ({
                name: entry.name,
                isDirectory: entry.isDirectory(),
                isFile: entry.isFile()
            }));
        } catch (error) {
            console.error(`[MAIN] Failed to read directory: ${dirPath}`, error);
            throw error;
        }
    });

    ipcMain.handle('path-dirname', (event, filePath) => {
        return path.dirname(filePath);
    });
    
    ipcMain.handle('get-app-data-path', () => {
         const appDataPath = app.getPath('appData');
         return path.join(appDataPath, '.WinterLauncher');
    });
    
    ipcMain.handle('path-join', (event, ...paths) => {
        // Validate that all paths are strings
        const validPaths = paths.filter(p => typeof p === 'string');
        if (validPaths.length !== paths.length) {
            console.error(`[MAIN] path-join received invalid arguments:`, paths);
            throw new Error('All path arguments must be strings');
        }
        console.log(`[MAIN] path-join called with:`, validPaths);
        return path.join(...validPaths);
    });
    
    ipcMain.handle('extract-zip', async (event, zipPath, destDir) => {
        try {
            console.log(`[MAIN] Extracting ZIP: ${zipPath} to ${destDir}`);
            
            // Check if ZIP file exists
            try {
                const stats = await fs.stat(zipPath);
                console.log(`[MAIN] ZIP file size: ${stats.size} bytes`);
                if (stats.size === 0) {
                    throw new Error('ZIP file is empty');
                }
            } catch (error) {
                console.error(`[MAIN] ZIP file not accessible: ${zipPath}`, error);
                return { success: false, error: `ZIP file not accessible: ${error.message}` };
            }
            
            // Ensure destination directory exists
            await fs.mkdir(destDir, { recursive: true });
            
            try {
                await extractArchive(zipPath, destDir);
                console.log(`[MAIN] ZIP extraction completed successfully`);
                return { success: true };
            } catch (extractError) {
                console.error(`[MAIN] Primary extraction failed:`, extractError);
                
                // Handle specific ZIP corruption errors
                if (extractError.message.includes('exited with code 9')) {
                    return { 
                        success: false, 
                        error: `ZIP file appears to be corrupted or incomplete (exit code 9). This may happen if the download was interrupted or the file is not a valid ZIP archive.` 
                    };
                } else if (extractError.message.includes('exited with code 2')) {
                    return { 
                        success: false, 
                        error: `ZIP extraction failed with generic error (exit code 2). The file may be corrupted or there may be permission issues.` 
                    };
                }
                
                // Try alternative extraction using Node.js built-in zlib if unzip fails
                if (process.platform !== 'darwin' && extractError.message.includes('exited with code')) {
                    console.log(`[MAIN] Trying alternative extraction method...`);
                    try {
                        const yauzl = require('yauzl');
                        await new Promise((resolve, reject) => {
                            yauzl.open(zipPath, { lazyEntries: true }, (err, zipfile) => {
                                if (err) return reject(err);
                                
                                let entriesProcessed = 0;
                                let entriesTotal = 0;
                                
                                zipfile.on('entry', (entry) => {
                                    entriesTotal++;
                                    
                                    if (entry.fileName.endsWith('/')) {
                                        // Directory entry
                                        const dirPath = path.join(destDir, entry.fileName);
                                        fs.mkdir(dirPath, { recursive: true }).then(() => {
                                            zipfile.readEntry();
                                        }).catch(reject);
                                    } else {
                                        // File entry
                                        const filePath = path.join(destDir, entry.fileName);
                                        const dir = path.dirname(filePath);
                                        
                                        fs.mkdir(dir, { recursive: true }).then(() => {
                                            zipfile.openReadStream(entry, (err, readStream) => {
                                                if (err) return reject(err);
                                                
                                                const writeStream = fsSync.createWriteStream(filePath);
                                                writeStream.on('finish', () => {
                                                    entriesProcessed++;
                                                    if (entriesProcessed === entriesTotal) {
                                                        zipfile.close();
                                                        resolve();
                                                    } else {
                                                        zipfile.readEntry();
                                                    }
                                                });
                                                writeStream.on('error', reject);
                                                readStream.pipe(writeStream);
                                            });
                                        }).catch(reject);
                                    }
                                });
                                
                                zipfile.on('end', () => {
                                    if (entriesTotal === 0) {
                                        zipfile.close();
                                        resolve();
                                    }
                                });
                                
                                zipfile.on('error', reject);
                                zipfile.readEntry();
                            });
                        });
                        
                        console.log(`[MAIN] Alternative extraction completed successfully`);
                        return { success: true };
                    } catch (altError) {
                        console.error(`[MAIN] Alternative extraction also failed:`, altError);
                        return { success: false, error: `Both extraction methods failed. Primary: ${extractError.message}, Alternative: ${altError.message}` };
                    }
                }
                
                return { success: false, error: extractError.message };
            }
        } catch (error) {
            console.error(`[MAIN] Failed to extract ZIP: ${zipPath}`, error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('read-file', async (event, filePath) => {
        try {
            console.log(`[MAIN] Reading file: ${filePath}`);
            const content = await fs.readFile(filePath, 'utf8');
            return { success: true, content };
        } catch (error) {
            console.error(`[MAIN] Failed to read file: ${filePath}`, error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('ensure-dir', async (event, dirPath) => {
        try {
            await fs.mkdir(dirPath, { recursive: true });
            return { success: true };
        } catch (error) {
            console.error('Failed to create directory:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('fs-unlink', async (event, targetPath) => {
        try {
            await fs.unlink(targetPath);
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('fs-stat', async (event, targetPath) => {
        try {
            const stats = await fs.stat(targetPath);
            return { 
                success: true, 
                size: stats.size,
                isFile: stats.isFile(),
                isDirectory: stats.isDirectory(),
                modified: stats.mtime,
                created: stats.birthtime
            };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('copy-dir', async (event, src, dest) => {
        try {
            console.log(`[MAIN] Copying directory from ${src} to ${dest}`);
            await fs.cp(src, dest, { recursive: true, force: true });
            return { success: true };
        } catch (error) {
            console.error(`[MAIN] Failed to copy directory:`, error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle("minimize-app", () => {
        const win = getAppWindow();
        if (win) win.minimize();
    });

    ipcMain.handle("toggle-maximize-app", () => {
        const win = getAppWindow();
        if (!win) return;
        if (win.isMaximized()) {
            win.unmaximize();
        } else {
            win.maximize();
        }
    });
    ipcMain.handle("quit-app", () => {
        app.quit();
    });
    ipcMain.handle("restart-app", () => {
        console.log('[Main] Restarting app after update installation...');
        // Add a small delay to ensure update files are properly replaced
        setTimeout(() => {
            app.relaunch();
            app.exit(0);
        }, 500);
    });
    ipcMain.handle('download-skin', async (event, skinUrl, filename) => {
        try {
            // Show save dialog
            const result = await dialog.showSaveDialog({
                title: 'Save Skin',
                defaultPath: filename || 'skin.png',
                filters: [
                    { name: 'PNG Images', extensions: ['png'] },
                    { name: 'All Files', extensions: ['*'] }
                ]
            });
            
            if (result.canceled) {
                return { success: false, canceled: true };
            }
            
            // Download the skin
            const protocol = skinUrl.startsWith('https:') ? https : http;
            
            return new Promise((resolve) => {
                protocol.get(skinUrl, (response) => {
                    if (response.statusCode === 200) {
                        const chunks = [];
                        
                        response.on('data', (chunk) => {
                            chunks.push(chunk);
                        });
                        
                        response.on('end', async () => {
                            try {
                                const buffer = Buffer.concat(chunks);
                                await fs.writeFile(result.filePath, buffer);
                                resolve({ success: true, filePath: result.filePath });
                            } catch (error) {
                                resolve({ success: false, error: error.message });
                            }
                        });
                    } else {
                        resolve({ success: false, error: `HTTP ${response.statusCode}` });
                    }
                }).on('error', (error) => {
                    resolve({ success: false, error: error.message });
                });
            });
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // LOG HANDLERS
    ipcMain.handle('start-log-session', async () => {
        try {
            const logsDir = path.join(rootDirectory, '.WinterLauncher', 'logs');
            await fs.mkdir(logsDir, { recursive: true });
            
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const sessionFile = path.join(logsDir, `session-${timestamp}.log`);
            
            // Store current session file path
            global.currentLogSession = sessionFile;
            
            const sessionStart = `
            ******************************************************\n
            |   WinterLauncher v${app.getVersion()}\n - by Cosmic-fi
            ******************************************************\n
            === LOG SESSION STARTED: ${new Date().toISOString()} ===\n`;
            await fs.writeFile(sessionFile, sessionStart, 'utf8');
            
            return { success: true, sessionFile };
        } catch (error) {
            console.error('Failed to start log session:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('end-log-session', async () => {
        try {
            if (global.currentLogSession) {
                const sessionEnd = `=============[ LOG SESSION ENDED: ${new Date().toISOString()} ]=============\n`;
                await fs.appendFile(global.currentLogSession, sessionEnd, 'utf8');
                global.currentLogSession = null;
            }
            return { success: true };
        } catch (error) {
            console.error('Failed to end log session:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('write-session-log', async (event, logEntry) => {
        try {
            if (!global.currentLogSession) {
                return { success: false, error: 'No active log session' };
            }
            
            const logLine = `${logEntry.timestamp} [${logEntry.level}] ${logEntry.message}${logEntry.data ? ' ' + JSON.stringify(logEntry.data) : ''}\n`;
            await fs.appendFile(global.currentLogSession, logLine, 'utf8');
            
            return { success: true };
        } catch (error) {
            console.error('Failed to write session log:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('read-session-logs', async (event, options = {}) => {
        try {
            const logsDir = path.join(rootDirectory, '.WinterLauncher', 'logs');
            const { maxSessions = 5, maxLines = 1000 } = options;
            
            const files = await fs.readdir(logsDir);
            const sessionFiles = files
                .filter(file => file.startsWith('session-') && file.endsWith('.log'))
                .sort()
                .slice(-maxSessions);
            
            const logs = [];
            
            for (const file of sessionFiles) {
                const filePath = path.join(logsDir, file);
                try {
                    const content = await fs.readFile(filePath, 'utf8');
                    const lines = content.trim().split('\n').filter(line => line.length > 0);
                    
                    for (const line of lines) {
                        if (line.startsWith('===')) {
                            // Session markers
                            logs.push({
                                timestamp: new Date().toISOString(),
                                level: 'INFO',
                                message: line,
                                data: null
                            });
                        } else {
                            const match = line.match(/^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z) \[([A-Z]+)\] (.+)$/);
                            if (match) {
                                const [, timestamp, level, messageAndData] = match;
                                let message = messageAndData;
                                let data = null;
                                
                                const lastBraceIndex = messageAndData.lastIndexOf('{');
                                if (lastBraceIndex !== -1) {
                                    try {
                                        const potentialJson = messageAndData.substring(lastBraceIndex);
                                        data = JSON.parse(potentialJson);
                                        message = messageAndData.substring(0, lastBraceIndex).trim();
                                    } catch {
                                        // Not valid JSON, keep as message
                                    }
                                }
                                
                                logs.push({ timestamp, level, message, data });
                            }
                        }
                    }
                } catch (error) {
                    console.error(`Failed to read session file ${file}:`, error);
                }
            }
            
            return { success: true, logs: logs.slice(-maxLines) };
        } catch (error) {
            console.error('Failed to read session logs:', error);
            return { success: false, error: error.message, logs: [] };
        }
    });
    ipcMain.handle('clear-log-files', async () => {
        try {
            const logsDir = path.join(rootDirectory, '.WinterLauncher', 'logs');
            const files = await fs.readdir(logsDir);
            
            for (const file of files) {
                if (file.endsWith('.log')) {
                    await fs.unlink(path.join(logsDir, file));
                }
            }
            
            return { success: true };
        } catch (error) {
            console.error('Failed to clear log files:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('get-session-history', async () => {
        try {
            const sessionsFile = path.join(rootDirectory, '.WinterLauncher', 'sessions.json');
            
            try {
                const data = await fs.readFile(sessionsFile, 'utf8');
                const sessions = JSON.parse(data);
                return { success: true, sessions };
            } catch (error) {
                return { success: true, sessions: [] };
            }
        } catch (error) {
            console.error('Failed to get session history:', error);
            return { success: false, error: error.message, sessions: [] };
        }
    });



    // DISCORD RPC HANDLERS
    ipcMain.handle('discord-rpc-init', async () => {
        try {
            await discordRPC.initialize();
            return { success: true };
        } catch (error) {
            console.error('Discord RPC initialization failed:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('discord-rpc-disconnect', async () => {
        try {
            await discordRPC.disconnect();
            return { success: true };
        } catch (error) {
            console.error('Discord RPC disconnect failed:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('discord-rpc-set-idle', () => {
        discordRPC.setIdleActivity();
        return { success: true };
    });
    ipcMain.handle('discord-rpc-set-launching', (event, version, variant) => {
        discordRPC.setLaunchingActivity(version, variant);
        return { success: true };
    });
    ipcMain.handle('discord-rpc-set-playing', (event, version, variant, username) => {
        discordRPC.setPlayingActivity(version, variant, username);
        return { success: true };
    });
    ipcMain.handle('discord-rpc-set-downloading', (event, progress, version) => {
        discordRPC.setDownloadingActivity(progress, version);
        return { success: true };
    });
    ipcMain.handle('discord-rpc-clear', async () => {
        try {
            await discordRPC.clearActivity();
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('discord-rpc-status', () => {
        return discordRPC.getStatus();
    });

    // DATABASE HANDLERS
    const databaseModule = await import('../app/services/database.js');
    const databaseService = databaseModule.default;
    
    // Initialize database when app starts
    databaseService.initialize().catch(error => {
        console.error('Failed to initialize database:', error);
    });

    // Instance-related database operations
    ipcMain.handle('db-get-instances', async () => {
        try {
            const instances = await databaseService.getInstances();
            console.log(`[MAIN PROCESS] db-get-instances returned ${instances.length} instances`);
            return { success: true, instances };
        } catch (error) {
            console.error('Failed to get instances:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-instance', async (event, id) => {
        try {
            const instance = await databaseService.getInstance(id);
            return { success: true, instance };
        } catch (error) {
            console.error('Failed to get instance:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-create-instance', async (event, instanceData) => {
        try {
            const instance = await databaseService.createInstance(instanceData);
            return { success: true, instance };
        } catch (error) {
            console.error('Failed to create instance:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-update-instance', async (event, id, updates) => {
        try {

            
            await databaseService.updateInstance(id, updates);
            return { success: true };
        } catch (error) {
            console.error('Failed to update instance:', error);
            if (error.message && error.message.includes('CHECK constraint failed')) {
                console.error(`[MAIN] CHECK constraint failed. Updates:`, JSON.stringify(updates, null, 2));
            }
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-delete-instance', async (event, id) => {
        try {
            await databaseService.deleteInstance(id);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete instance:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-active-instance', async () => {
        try {
            const instance = await databaseService.getActiveInstance();
            return { success: true, instance };
        } catch (error) {
            console.error('Failed to get active instance:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-set-active-instance', async (event, id) => {
        try {
            await databaseService.setActiveInstance(id);
            return { success: true };
        } catch (error) {
            console.error('Failed to set active instance:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-force-migrate-instance-paths', async () => {
        try {
            await databaseService.forceMigrateInstancePaths();
            return { success: true };
        } catch (error) {
            console.error('Failed to force migrate instance paths:', error);
            return { success: false, error: error.message };
        }
    });

    // Mod-related database operations
    ipcMain.handle('db-get-instance-mods', async (event, instanceId) => {
        try {
            const mods = await databaseService.getInstanceMods(instanceId);
            return { success: true, mods };
        } catch (error) {
            console.error('Failed to get instance mods:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-instance-resource-packs', async (event, instanceId) => {
        try {
            const resourcePacks = await databaseService.getInstanceResourcePacks(instanceId);
            return { success: true, resourcePacks };
        } catch (error) {
            console.error('Failed to get instance resource packs:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-add-resource-pack', async (event, resourcePackData) => {
        try {
            const resourcePack = await databaseService.addResourcePack(resourcePackData);
            return { success: true, resourcePack };
        } catch (error) {
            console.error('Failed to add resource pack:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-update-resource-pack', async (event, id, updates) => {
        try {
            await databaseService.updateResourcePack(id, updates);
            return { success: true };
        } catch (error) {
            console.error('Failed to update resource pack:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-resource-pack', async (event, id) => {
        try {
            const resourcePack = await databaseService.getResourcePack(id);
            return { success: true, resourcePack };
        } catch (error) {
            console.error('Failed to get resource pack:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-delete-resource-pack', async (event, id) => {
        try {
            await databaseService.deleteResourcePack(id);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete resource pack:', error);
            return { success: false, error: error.message };
        }
    });

    // Shader-related database operations
    ipcMain.handle('db-get-instance-shaders', async (event, instanceId) => {
        try {
            const shaders = await databaseService.getInstanceShaders(instanceId);
            return { success: true, shaders };
        } catch (error) {
            console.error('Failed to get instance shaders:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-add-shader', async (event, shaderData) => {
        try {
            const shader = await databaseService.addShader(shaderData);
            return { success: true, shader };
        } catch (error) {
            console.error('Failed to add shader:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-update-shader', async (event, id, updates) => {
        try {
            await databaseService.updateShader(id, updates);
            return { success: true };
        } catch (error) {
            console.error('Failed to update shader:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-shader', async (event, id) => {
        try {
            const shader = await databaseService.getShader(id);
            return { success: true, shader };
        } catch (error) {
            console.error('Failed to get shader:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-delete-shader', async (event, id) => {
        try {
            await databaseService.deleteShader(id);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete shader:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-add-mod', async (event, modData) => {
        try {
            console.log('[MAIN PROCESS] db-add-mod called with:', JSON.stringify(modData, null, 2));
            const mod = await databaseService.addMod(modData);
            return { success: true, mod };
        } catch (error) {
            console.error('Failed to add mod:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-update-mod', async (event, id, updates) => {
        try {
            await databaseService.updateMod(id, updates);
            return { success: true };
        } catch (error) {
            console.error('Failed to update mod:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-get-mod', async (event, id) => {
        try {
            const mod = await databaseService.getMod(id);
            return { success: true, mod };
        } catch (error) {
            console.error('Failed to get mod:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-delete-mod', async (event, id) => {
        try {
            await databaseService.deleteMod(id);
            return { success: true };
        } catch (error) {
            console.error('Failed to delete mod:', error);
            return { success: false, error: error.message };
        }
    });

    // CLEAR INSTANCE DATA HANDLERS
    ipcMain.handle('db-clear-instance-mods', async (event, instanceId) => {
        try {
            await databaseService.clearInstanceMods(instanceId);
            return { success: true };
        } catch (error) {
            console.error('Failed to clear instance mods:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-clear-instance-resource-packs', async (event, instanceId) => {
        try {
            await databaseService.clearInstanceResourcePacks(instanceId);
            return { success: true };
        } catch (error) {
            console.error('Failed to clear instance resource packs:', error);
            return { success: false, error: error.message };
        }
    });

    ipcMain.handle('db-clear-instance-shader-packs', async (event, instanceId) => {
        try {
            await databaseService.clearInstanceShaderPacks(instanceId);
            return { success: true };
        } catch (error) {
            console.error('Failed to clear instance shader packs:', error);
            return { success: false, error: error.message };
        }
    });

    // SYSTEM NOTIFICATION HANDLERS
    ipcMain.handle('show-system-notification', async (_, { title, body, icon, actions, silent = true }) => {
        try {
            const notification = new Notification({
                title,
                body,
                icon: icon || path.join(__dirname, '../../public/icons/default.png'),
                actions: actions || [],
                silent: silent // This disables the default Windows notification sound
            });

            notification.show();
            
            return { success: true };
        } catch (error) {
            console.error('Failed to show system notification:', error);
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('check-notification-permission', async () => {
        // On Windows/Linux, notifications are always available
        // On macOS, we might need to check system preferences
        return { permission: 'granted' };
    });
    ipcMain.handle('get-app-version', async () => {
        return {
            version: app.getVersion(),
            isPackaged: app.isPackaged
        };
    });
    ipcMain.handle('start-auto-update', async () => {
        try {
            if (!app.isPackaged) return { success: false, message: 'dev' };
            const result = await autoUpdater.checkForUpdates();
            return { success: true, info: result?.updateInfo };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });
    ipcMain.handle('get-user-data-path', () => {
        return app.getPath('userData');
    });
    ipcMain.handle('get-install-path', () => {
        return path.dirname(app.getPath('exe'));
    });
    ipcMain.handle('get-resources-path', () => {
        return process.resourcesPath;
    });

    // Download update file only (no installation)
    ipcMain.handle('download-update-file', async (event, { url, filename }) => {
        try {
            const tempDir = os.tmpdir();
            const fileName = filename || path.basename(new URL(url).pathname);
            const tempFile = path.join(tempDir, fileName);
            await fs.mkdir(tempDir, { recursive: true });
            const headers = {
                'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                'Accept': 'application/octet-stream'
            };
            const maxRedirects = 5;
            let currentUrl = url;
            
            // Handle redirects
            for (let i = 0; i <= maxRedirects; i++) {
                const protocol = currentUrl.startsWith('https:') ? https : http;
                const response = await new Promise((resolve, reject) => {
                    const request = protocol.get(currentUrl, { headers }, resolve);
                    request.on('error', reject);
                    request.setTimeout(30000, () => reject(new Error('Download timeout')));
                });
                
                if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                    currentUrl = response.headers.location;
                    continue;
                }
                
                if (response.statusCode !== 200) {
                    throw new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`);
                }
                
                // Download the file
                const totalSize = parseInt(response.headers['content-length'] || '0', 10);
                let downloadedSize = 0;
                
                const writeStream = fsSync.createWriteStream(tempFile);
                response.on('data', (chunk) => {
                    downloadedSize += chunk.length;
                    const progress = totalSize > 0 ? Math.round((downloadedSize / totalSize) * 100) : 0;
                    event.sender.send('update-download-progress', { progress, downloaded: downloadedSize, total: totalSize });
                });
                
                await new Promise((resolve, reject) => {
                    writeStream.on('finish', resolve);
                    writeStream.on('error', reject);
                    response.pipe(writeStream);
                });
                
                return { success: true, file: tempFile };
            }
            
            throw new Error('Too many redirects');
        } catch (error) {
            return { success: false, error: error.message };
        }
    });


    
    // Custom updater: download asset, apply update, and restart
    ipcMain.handle('download-and-install-update', async (event, { url, filename, version }) => {
        try {
            const tempDir = os.tmpdir();
            const fileName = filename || path.basename(new URL(url).pathname);
            const tempFile = path.join(tempDir, fileName);
            await fs.mkdir(tempDir, { recursive: true });
            const headers = {
                'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                'Accept': 'application/octet-stream'
            };
            const maxRedirects = 5;
            let currentUrl = url;
            for (let i = 0; i <= maxRedirects; i++) {
                const protocol = currentUrl.startsWith('https:') ? https : http;
                const ok = await new Promise((resolve, reject) => {
                    try {
                        const request = protocol.request(currentUrl, { method: 'GET', headers }, (res) => {
                            if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                                const nextUrl = new URL(res.headers.location, currentUrl).href;
                                currentUrl = nextUrl;
                                resolve(false);
                                return;
                            }
                            if (res.statusCode !== 200) {
                                reject(new Error(`HTTP ${res.statusCode}`));
                                return;
                            }
                            const total = parseInt(res.headers['content-length'] || '0', 10);
                            let downloaded = 0;
                            const out = fsSync.createWriteStream(tempFile);
                            res.on('data', (chunk) => {
                                downloaded += chunk.length;
                                const progress = total > 0 ? Math.round((downloaded / total) * 100) : 0;
                                event.sender.send('update-download-progress', { progress, downloaded, total, version });
                            });
                            res.pipe(out);
                            out.on('finish', () => resolve(true));
                            out.on('error', reject);
                        });
                        request.on('error', reject);
                        request.end();
                    } catch (e) {
                        reject(e);
                    }
                });
                if (ok) break;
                if (i === maxRedirects) throw new Error('Too many redirects');
            }

            if (process.platform === 'win32' && fileName.toLowerCase().endsWith('.exe')) {
                const installer = spawn(tempFile, ['/S', '/NORESTART'], { detached: true, stdio: 'ignore' });
                installer.on('close', async (code) => {
                    console.log(`[Main] Windows installer completed with code: ${code}`);
                    // Don't restart automatically - let the user decide
                    event.sender.send('update-extracted', { dir: tempFile, version });
                    
                    // Wait a moment for the installer to finish, then trigger restart
                    setTimeout(() => {
                        console.log('[Main] Triggering app restart after Windows update installation');
                        app.relaunch();
                        app.exit(0);
                    }, 2000);
                });
                installer.unref();
                return { success: true, file: tempFile };
            }

            const isZip = fileName.toLowerCase().endsWith('.zip');
            if ((process.platform === 'darwin' && isZip) || (process.platform !== 'win32' && isZip)) {
                const destDir = path.join(os.tmpdir(), `winterlauncher-update-${version || 'latest'}`);
                await fs.mkdir(destDir, { recursive: true });
                try {
                    await extractArchive(tempFile, destDir);
                    let found = await findFileRecursively(destDir, 'app.asar');
                    if (!found) return { success: false, error: 'app.asar not found in zip' };
                    const targetAsar = path.join(process.resourcesPath, 'app.asar');
                    try {
                        await fs.access(targetAsar);
                        await fs.rename(targetAsar, path.join(process.resourcesPath, 'app.asar.bak'));
                    } catch {}
                    await fs.copyFile(found, targetAsar);
                    event.sender.send('update-extracted', { dir: destDir, version });
                    // Don't restart automatically - let the user decide
                    return { success: true, extractedTo: destDir };
                } catch (exErr) {
                    return { success: false, error: exErr.message };
                }
            }

            if (process.platform === 'linux' && fileName.toLowerCase().endsWith('.appimage')) {
                await shell.openPath(tempFile);
                event.sender.send('update-extracted', { dir: tempFile, version });
                
                // Wait a moment for the AppImage to launch, then trigger restart
                setTimeout(() => {
                    console.log('[Main] Triggering app restart after Linux AppImage update installation');
                    app.relaunch();
                    app.exit(0);
                }, 2000);
                
                return { success: true, file: tempFile };
            }

            return { success: true, file: tempFile };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Install update from downloaded file
    ipcMain.handle('install-update-file', async (event, { file, version }) => {
        try {
            const fileName = path.basename(file);
            const tempFile = file;
            
            if (process.platform === 'win32' && fileName.toLowerCase().endsWith('.exe')) {
                const installer = spawn(tempFile, ['/S'], { detached: true, stdio: 'ignore' });
                installer.on('close', async () => {
                    // Don't restart automatically - let the user decide
                    event.sender.send('update-extracted', { dir: tempFile, version });
                });
                installer.unref();
                return { success: true, file: tempFile };
            }

            const isZip = fileName.toLowerCase().endsWith('.zip');
            if ((process.platform === 'darwin' && isZip) || (process.platform !== 'win32' && isZip)) {
                const destDir = path.join(os.tmpdir(), `winterlauncher-update-${version || 'latest'}`);
                await fs.mkdir(destDir, { recursive: true });
                try {
                    await extractArchive(tempFile, destDir);
                    let found = await findFileRecursively(destDir, 'app.asar');
                    if (!found) return { success: false, error: 'app.asar not found in zip' };
                    const targetAsar = path.join(process.resourcesPath, 'app.asar');
                    try {
                        await fs.access(targetAsar);
                        await fs.rename(targetAsar, path.join(process.resourcesPath, 'app.asar.bak'));
                    } catch {}
                    await fs.copyFile(found, targetAsar);
                    event.sender.send('update-extracted', { dir: destDir, version });
                    
                    // Wait a moment for the extraction to complete, then trigger restart
                    setTimeout(() => {
                        console.log('[Main] Triggering app restart after Mac/Linux update installation');
                        app.relaunch();
                        app.exit(0);
                    }, 1000);
                    
                    return { success: true, extractedTo: destDir };
                } catch (exErr) {
                    return { success: false, error: exErr.message };
                }
            }

            if (process.platform === 'linux' && fileName.toLowerCase().endsWith('.appimage')) {
                await shell.openPath(tempFile);
                // Don't quit automatically - let the user decide
                event.sender.send('update-extracted', { dir: tempFile, version });
                return { success: true, file: tempFile };
            }

            return { success: true, file: tempFile };
        } catch (error) {
            return { success: false, error: error.message };
        }
    });

    // Network & API
    ipcMain.handle('ping-api', async () => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 3000);

        try {
            const res = await fetch('https://api.cosmicfi.dev/winterlauncher', {
            method: 'GET',
            headers: {
                'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            },
            signal: controller.signal
            });

            clearTimeout(timeout);
            if (!res.ok) throw new Error('API not OK');

            const data = await res.json();
            if (!data.status || !data.status.includes('Online')) // your actual API says "Online", not "Alive"
            throw new Error('Bad ping response');

            return true;
        } catch (e) {
            clearTimeout(timeout);
            console.log(e);
            console.error('Ping failed:', e.message);
            return false;
        }
    });

    // Download mod file from URL to specified path
    // Active downloads map for cancellation
    const activeDownloads = new Map();

    ipcMain.handle('cancel-download', (event, instanceId) => {
        if (activeDownloads.has(instanceId)) {
            const download = activeDownloads.get(instanceId);
            if (download.request) {
                download.request.destroy();
            }
            if (download.response) {
                download.response.destroy();
            }
            activeDownloads.delete(instanceId);
            console.log(`[MAIN] Cancelled download for instance ${instanceId}`);
            return { success: true };
        }
        return { success: false, error: 'No active download found' };
    });

    // Enhanced download function with retry logic and better error handling
    function getProxyAgent(url) {
        const proxyUrl = process.env.HTTPS_PROXY || process.env.https_proxy || 
                        process.env.HTTP_PROXY || process.env.http_proxy;
        
        if (!proxyUrl) {
            return null;
        }
        
        try {
            const isHttps = url.startsWith('https:');
            console.log(`[PROXY] Using proxy: ${proxyUrl} for ${isHttps ? 'HTTPS' : 'HTTP'} request`);
            
            if (isHttps) {
                return new HttpsProxyAgent(proxyUrl);
            } else {
                return new HttpProxyAgent(proxyUrl);
            }
        } catch (error) {
            console.error('[PROXY] Failed to create proxy agent:', error);
            return null;
        }
    }
    
    async function downloadWithRetry(url, filePath, instanceId, event, maxRetries = 3) {
        let lastError;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            try {
                console.log(`[DOWNLOAD] Attempt ${attempt}/${maxRetries} for: ${url}`);
                
                // Ensure directory exists
                const dir = path.dirname(filePath);
                await fs.mkdir(dir, { recursive: true });
                
                const headers = {
                    'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                    'Accept': 'application/octet-stream',
                    'Connection': 'keep-alive',
                    'Keep-Alive': 'timeout=30, max=5'
                };
                
                const maxRedirects = 5;
                let currentUrl = url;
                
                // Handle redirects
                for (let i = 0; i <= maxRedirects; i++) {
                    console.log(`[DOWNLOAD] Attempting download from: ${currentUrl}`);
                    const protocol = currentUrl.startsWith('https:') ? https : http;
                    
                    // Get proxy agent if configured
                    const proxyAgent = getProxyAgent(currentUrl);
                    
                    const result = await new Promise((resolve, reject) => {
                        const requestOptions = {
                            headers,
                            timeout: 60000, // 60 seconds timeout
                            family: 0 // Allow both IPv4 and IPv6
                        };
                        
                        // Add proxy agent if available
                        if (proxyAgent) {
                            requestOptions.agent = proxyAgent;
                        }
                        
                        const request = protocol.get(currentUrl, requestOptions, (response) => {
                            if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
                                resolve({ redirect: true, location: response.headers.location });
                                return;
                            }
                            
                            if (response.statusCode !== 200) {
                                reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage}`));
                                return;
                            }
                            
                            resolve({ response, request });
                        });
                        
                        request.on('error', (error) => {
                            // Enhanced error handling for network issues
                            if (error.code === 'ETIMEDOUT' || error.code === 'ENETUNREACH' || error.code === 'ECONNREFUSED') {
                                console.error(`[DOWNLOAD] Network error on attempt ${attempt}:`, error.code);
                                reject(new Error(`Network connectivity issue: ${error.code}. Please check your internet connection.`));
                            } else {
                                reject(error);
                            }
                        });
                        
                        request.on('timeout', () => {
                            request.destroy();
                            reject(new Error('Download timeout - server took too long to respond'));
                        });
                        
                        // Register for cancellation if instanceId provided
                        if (instanceId) {
                            activeDownloads.set(instanceId, { request });
                        }
                    });
                    
                    // Handle redirect
                    if (result.redirect) {
                        currentUrl = result.location;
                        if (!currentUrl.startsWith('http')) {
                            const parsedUrl = new URL(url);
                            currentUrl = `${parsedUrl.protocol}//${parsedUrl.host}${currentUrl}`;
                        }
                        console.log(`[MAIN] Redirecting to: ${currentUrl}`);
                        continue;
                    }
                    
                    // Handle download
                    const { response, request } = result;
                    
                    if (instanceId) {
                        activeDownloads.set(instanceId, { request, response });
                    }
                    
                    const totalBytes = parseInt(response.headers['content-length'] || 0);
                    let receivedBytes = 0;
                    let lastUpdate = Date.now();
                    
                    const writeStream = fsSync.createWriteStream(filePath);
                    
                    await new Promise((resolve, reject) => {
                        response.on('data', (chunk) => {
                            receivedBytes += chunk.length;
                            
                            if (instanceId && totalBytes > 0) {
                                const now = Date.now();
                                if (now - lastUpdate > 100) {
                                    const percentage = Math.round((receivedBytes / totalBytes) * 100);
                                    event.sender.send('download-progress', {
                                        instanceId,
                                        current: receivedBytes,
                                        total: totalBytes,
                                        percentage
                                    });
                                    lastUpdate = now;
                                }
                            }
                        });
                        
                        writeStream.on('finish', () => {
                            if (instanceId) activeDownloads.delete(instanceId);
                            resolve();
                        });
                        
                        writeStream.on('error', (err) => {
                            if (instanceId) activeDownloads.delete(instanceId);
                            reject(err);
                        });
                        
                        response.on('error', (err) => {
                            if (instanceId) activeDownloads.delete(instanceId);
                            reject(err);
                        });
                        
                        request.on('abort', () => {
                            writeStream.destroy();
                            fsSync.unlink(filePath, () => {});
                            reject(new Error('Download cancelled'));
                        });
                        
                        response.pipe(writeStream);
                    });
                    
                    console.log(`[DOWNLOAD] Successfully downloaded on attempt ${attempt}`);
                    return { success: true, filePath };
                }
                
                throw new Error('Too many redirects');
                
            } catch (error) {
                lastError = error;
                console.error(`[DOWNLOAD] Attempt ${attempt} failed:`, error.message);
                
                // Clean up partial file on error
                try {
                    if (fsSync.existsSync(filePath)) {
                        fsSync.unlinkSync(filePath);
                    }
                } catch (cleanupError) {
                    console.error('[DOWNLOAD] Failed to clean up partial file:', cleanupError.message);
                }
                
                // Clear active download on error
                if (instanceId) {
                    activeDownloads.delete(instanceId);
                }
                
                // Don't retry on cancellation
                if (error.message === 'Download cancelled') {
                    throw error;
                }
                
                // Wait before retry with exponential backoff
                if (attempt < maxRetries) {
                    const waitTime = Math.min(1000 * Math.pow(2, attempt - 1), 10000); // Max 10 seconds
                    console.log(`[DOWNLOAD] Waiting ${waitTime}ms before retry...`);
                    await new Promise(resolve => setTimeout(resolve, waitTime));
                }
            }
        }
        
        // All retries failed
        throw lastError;
    }

    ipcMain.handle('download-mod-file', async (event, { url, filePath, instanceId }) => {
        try {
            console.log(`[IPC] download-mod-file called with: url=${url}, filePath=${filePath}, instanceId=${instanceId}`);
            const result = await downloadWithRetry(url, filePath, instanceId, event);
            console.log(`[IPC] download-mod-file completed successfully for: ${url}`);
            return result;
        } catch (error) {
            console.log('====================================\n', error, '\n======================================')
            
            if (error.message === 'Download cancelled') {
                console.log(`[IPC] Download was cancelled for: ${url}`);
                return { success: false, cancelled: true };
            }
            
            console.error('Failed to download mod file after retries:', error);
            
            // Provide more user-friendly error messages
            let errorMessage = error?.message || 'Unknown error occurred during download';
            
            if (errorMessage.includes('ETIMEDOUT')) {
                errorMessage = 'Connection timed out. The download server may be slow or unreachable. Please try again later.';
            } else if (errorMessage.includes('ENETUNREACH')) {
                errorMessage = 'Network unreachable. Please check your internet connection and try again.';
            } else if (errorMessage.includes('ECONNREFUSED')) {
                errorMessage = 'Connection refused. The download server may be temporarily unavailable.';
            } else if (errorMessage.includes('timeout')) {
                errorMessage = 'Download timed out. The server is taking too long to respond.';
            }
            
            console.log(`[IPC] Returning error for download-mod-file: ${errorMessage}`);
            return { success: false, error: errorMessage };
        }
    });

    // Helper function to validate and fix loader versions
    function validateAndFixLoaderVersion(gameVersion, loaderType, loaderVersion) {
        console.log(`[VALIDATE] Input: gameVersion=${gameVersion}, loaderType=${loaderType}, loaderVersion=${loaderVersion}`);
        if (!loaderVersion || !gameVersion || loaderVersion === 'latest') {
            console.log(`[VALIDATE] Returning early: missing loaderVersion or gameVersion, or using 'latest'`);
            return loaderVersion;
        }

        // Handle Forge
        if (loaderType === 'forge') {
            // Check if the version is already in the correct format (gameVersion-buildVersion)
            if (loaderVersion.startsWith(gameVersion + '-')) {
                return loaderVersion;
            }

            // If it's just a build number like "60.1.0", prepend the game version
            if (/^\d+\.\d+\.\d+$/.test(loaderVersion)) {
                const fixedVersion = `${gameVersion}-${loaderVersion}`;
                console.log(`Fixed Forge loader version: ${loaderVersion} -> ${fixedVersion}`);
                return fixedVersion;
            }

            // Handle cases where game version might have different format (e.g., 1.21 vs 1.21.1)
            // Try to find a matching version by looking for the build number in available versions
            if (loaderVersion.includes('-')) {
                const parts = loaderVersion.split('-');
                const buildNumber = parts[parts.length - 1];
                
                if (/^\d+\.\d+\.\d+$/.test(buildNumber)) {
                    // This looks like a build number, try to construct a valid version
                    const baseVersion = gameVersion;
                    const potentialVersion = `${baseVersion}-${buildNumber}`;
                    console.log(`Attempting to fix Forge version format: ${loaderVersion} -> ${potentialVersion}`);
                    return potentialVersion;
                }
            }
        }
        
        // Handle NeoForge
        else if (loaderType === 'neoforge') {
            console.log(`[VALIDATE] Processing NeoForge version: ${loaderVersion}`);
            // NeoForge versions should be in the format of just the version number (e.g., "21.0.109-beta")
            // The external library expects this format, not the gameVersion-prefixed format
            
            // If it's already in the correct format (just version number), return as-is
            if (/^\d+\.\d+\.\d+(-beta|-alpha)?$/.test(loaderVersion)) {
                console.log(`[VALIDATE] NeoForge version already correct: ${loaderVersion}`);
                return loaderVersion;
            }
            
            // If it's in the gameVersion-version format, extract just the version part
            if (loaderVersion.startsWith(gameVersion + '-')) {
                const versionPart = loaderVersion.substring(gameVersion.length + 1);
                console.log(`[VALIDATE] Fixed NeoForge loader version: ${loaderVersion} -> ${versionPart}`);
                return versionPart;
            }
            
            // For NeoForge, we want to keep the version as-is since the external library
            // expects the raw NeoForge version number
            return loaderVersion;
        }

        return loaderVersion;
    }

    // Helper to parse Maven metadata XML using regex (since no XML parser is available)
    async function fetchMavenVersions(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                'Accept': 'application/xml',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Maven API responded with ${response.status}`);
        }

        const xml = await response.text();
        const versionMatches = xml.match(/<version>(.*?)<\/version>/g);
        
        if (!versionMatches) {
            return [];
        }

        // Extract version strings and reverse to show newest first
        return versionMatches
            .map(v => v.replace(/<\/?version>/g, ''))
            .reverse();
    }

    // Helper to fetch Forge metadata JSON (different from Maven XML format)
    async function fetchForgeMetadata(url) {
        const response = await fetch(url, {
            method: 'GET',
            headers: {
                'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache'
            }
        });

        if (!response.ok) {
            throw new Error(`Forge API responded with ${response.status}`);
        }

        const data = await response.json();
        return data;
    }

    // Helper to fetch NeoForge versions using API endpoint (like Ori-MCC)
    async function fetchNeoForgeAPIVersions(gameVersion) {
        try {
            // Use the same API as Ori-MCC for consistency
            const response = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', {
                method: 'GET',
                headers: {
                    'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (response.ok) {
                const data = await response.json();
                if (data.versions && Array.isArray(data.versions)) {
                    // Filter out snapshot/development versions and versions that don't match the game version
                    const filteredVersions = data.versions.filter(version => {
                        // Skip snapshot/development versions like "0.25w14craftmine.3-beta"
                        if (version.includes('w') || version.startsWith('0.')) {
                            return false;
                        }
                        
                        // Map Minecraft version to NeoForge version format
                        // Minecraft 1.21.10 -> NeoForge 21.10.x
                        // Minecraft 1.20.4 -> NeoForge 20.4.x
                        // Minecraft 1.20.1 -> NeoForge 20.1.x
                        const versionParts = gameVersion.split('.');
                        if (versionParts.length >= 2) {
                            const major = versionParts[1];
                            const minor = versionParts[2] || '0';
                            const neoForgeVersionPrefix = `${major}.${minor}`;
                            
                            // Check if this NeoForge version matches the Minecraft version
                            return version.startsWith(neoForgeVersionPrefix + '.');
                        }
                        
                        return false;
                    });
                    
                    return filteredVersions;
                }
            }
        } catch (error) {
            console.warn('NeoForge API failed, falling back to Maven metadata:', error.message);
        }
        
        // Fallback to Maven metadata XML
        const mavenVersions = await fetchMavenVersions('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
        
        // Filter Maven versions too
        return mavenVersions.filter(version => {
            // Skip snapshot/development versions
            if (version.includes('w') || version.startsWith('0.')) {
                return false;
            }
            
            // Map Minecraft version to NeoForge version format
            // Minecraft 1.21.10 -> NeoForge 21.10.x
            // Minecraft 1.20.4 -> NeoForge 20.4.x
            // Minecraft 1.20.1 -> NeoForge 20.1.x
            const versionParts = gameVersion.split('.');
            if (versionParts.length >= 2) {
                const major = versionParts[1];
                const minor = versionParts[2] || '0';
                const neoForgeVersionPrefix = `${major}.${minor}`;
                
                // Check if this NeoForge version matches the Minecraft version
                return version.startsWith(neoForgeVersionPrefix + '.');
            }
            
            return false;
        });
    }

    // Generic handler to fetch supported game versions for a loader
    ipcMain.handle('fetch-loader-game-versions', async (event, loader) => {
        try {
            if (loader === 'vanilla') {
                // Vanilla supports all versions, frontend already has the list
                return { success: true, versions: 'all' };
            }

            if (loader === 'fabric') {
                const response = await fetch('https://meta.fabricmc.net/v2/versions/game', {
                    headers: { 'User-Agent': 'WinterLauncher/2.0.0 (Electron)' }
                });
                if (!response.ok) throw new Error('Fabric meta API failed');
                const data = await response.json();
                const versions = data.filter(v => v.stable).map(v => v.version);
                return { success: true, versions };
            }

            if (loader === 'quilt') {
                const response = await fetch('https://meta.quiltmc.org/v3/versions/game', {
                    headers: { 'User-Agent': 'WinterLauncher/2.0.0 (Electron)' }
                });
                if (!response.ok) throw new Error('Quilt meta API failed');
                const data = await response.json();
                const versions = data.filter(v => v.stable).map(v => v.version);
                return { success: true, versions };
            }

            if (loader === 'neoforge') {
                try {
                    // Try the new API endpoint first (like Ori-MCC)
                    const response = await fetch('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge', {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache'
                        }
                    });

                    if (response.ok) {
                        const data = await response.json();
                        if (data.versions && Array.isArray(data.versions)) {
                            const gameVersions = new Set();
                            data.versions.forEach(v => {
                                // Extract game version (e.g. 1.20.1-47.1.0 -> 1.20.1)
                                // Or new format 20.4.80 -> 1.20.4 (This is tricky, NeoForge 20.4 targets 1.20.4)
                                
                                if (v.includes('-')) {
                                    // Old format: 1.20.1-47.1.0
                                    const parts = v.split('-');
                                    if (parts.length > 0 && parts[0].includes('.')) {
                                        gameVersions.add(parts[0]);
                                    }
                                } else {
                                    // New format: 20.4.80 -> 1.20.4
                                    // 21.0.0 -> 1.21
                                    const parts = v.split('.');
                                    if (parts.length >= 2) {
                                        const major = parseInt(parts[0]);
                                        const minor = parseInt(parts[1]);
                                        if (!isNaN(major) && !isNaN(minor)) {
                                            // Map 20.4 -> 1.20.4, 21.0 -> 1.21
                                            // NeoForge versioning: Major version matches Minecraft minor version (20 -> 1.20)
                                            // Minor version matches Minecraft patch version (4 -> .4)
                                            // So 20.4 -> 1.20.4
                                            // 21.0 -> 1.21.0
                                            // 21.1 -> 1.21.1
                                            const mcMajor = 1;
                                            const mcMinor = major;
                                            const mcPatch = minor;
                                            const mcVersion = mcPatch === 0 ? `${mcMajor}.${mcMinor}` : `${mcMajor}.${mcMinor}.${mcPatch}`;
                                            gameVersions.add(mcVersion);
                                            
                                            // Also handle cases like 1.21 vs 1.21.0 (Mojang uses 1.21)
                                            if (mcPatch === 0) {
                                                gameVersions.add(`${mcMajor}.${mcMinor}.0`); // Just in case
                                            }
                                        }
                                    }
                                }
                            });
                            return { success: true, versions: Array.from(gameVersions) };
                        }
                    }
                } catch (apiError) {
                    console.warn('NeoForge API failed for game versions, falling back to Maven metadata:', apiError.message);
                }
                
                // Fallback to Maven metadata XML
                const allVersions = await fetchMavenVersions('https://maven.neoforged.net/releases/net/neoforged/neoforge/maven-metadata.xml');
                const gameVersions = new Set();
                allVersions.forEach(v => {
                    // Extract game version (e.g. 1.20.1-47.1.0 -> 1.20.1)
                    // Or new format 20.4.80 -> 1.20.4 (This is tricky, NeoForge 20.4 targets 1.20.4)
                    
                    if (v.includes('-')) {
                        // Old format: 1.20.1-47.1.0
                        const parts = v.split('-');
                        if (parts.length > 0 && parts[0].includes('.')) {
                            gameVersions.add(parts[0]);
                        }
                    } else {
                        // New format: 20.4.80 -> 1.20.4
                        // 21.0.0 -> 1.21
                        const parts = v.split('.');
                        if (parts.length >= 2) {
                            const major = parseInt(parts[0]);
                            const minor = parseInt(parts[1]);
                            if (!isNaN(major) && !isNaN(minor)) {
                                // Map 20.4 -> 1.20.4, 21.0 -> 1.21
                                // NeoForge versioning: Major version matches Minecraft minor version (20 -> 1.20)
                                // Minor version matches Minecraft patch version (4 -> .4)
                                // So 20.4 -> 1.20.4
                                // 21.0 -> 1.21.0
                                // 21.1 -> 1.21.1
                                const mcMajor = 1;
                                const mcMinor = major;
                                const mcPatch = minor;
                                const mcVersion = mcPatch === 0 ? `${mcMajor}.${mcMinor}` : `${mcMajor}.${mcMinor}.${mcPatch}`;
                                gameVersions.add(mcVersion);
                                
                                // Also handle cases like 1.21 vs 1.21.0 (Mojang uses 1.21)
                                if (mcPatch === 0) {
                                    gameVersions.add(`${mcMajor}.${mcMinor}.0`); // Just in case
                                }
                            }
                        }
                    }
                });
                return { success: true, versions: Array.from(gameVersions) };
            }

            if (loader === 'forge') {
                const response = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', {
                    headers: { 'User-Agent': 'WinterLauncher/2.0.0 (Electron)' }
                });
                if (!response.ok) throw new Error('Forge promotions API failed');
                const data = await response.json();
                const promos = data.promos;
                const gameVersions = new Set();
                Object.keys(promos).forEach(key => {
                    // Keys are like "1.20.1-recommended" or "1.20.1-latest"
                    const parts = key.split('-');
                    if (parts.length >= 2) {
                        // The game version is everything before the last part (recommended/latest)
                        // But wait, key is strictly "GAME_VERSION-TAG"
                        // e.g. "1.7.10-latest"
                        const tag = parts.pop(); // latest/recommended
                        const version = parts.join('-'); // 1.7.10
                        if (version) gameVersions.add(version);
                    }
                });
                return { success: true, versions: Array.from(gameVersions) };
            }

            return { success: false, error: 'Unknown loader' };
        } catch (error) {
            console.error(`Error fetching game versions for ${loader}:`, error);
            return { success: false, error: error.message, versions: [] };
        }
    });

    // LOADER VERSION API HANDLERS - Handle external API calls to avoid CORS issues
    ipcMain.handle('fetch-forge-versions', async (event, gameVersion) => {
        try {
            // Use Forge metadata API like Ori-MCC does (this returns JSON, not XML)
            const metadata = await fetchForgeMetadata('https://files.minecraftforge.net/net/minecraftforge/forge/maven-metadata.json');
            
            // Get versions for the specific Minecraft version (like Ori-MCC does: json[gameVersion])
            const versions = metadata[gameVersion];
            
            if (!versions || versions.length === 0) {
                // Try fallback to promotions API like Ori-MCC does
                console.log(`No versions found for ${gameVersion} in metadata, trying promotions API...`);
                
                const promotionsResponse = await fetch('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json', {
                    headers: { 'User-Agent': 'WinterLauncher/2.0.0 (Electron)' }
                });
                
                if (promotionsResponse.ok) {
                    const promotions = await promotionsResponse.json();
                    const promos = promotions.promos;
                    
                    // Look for promotions like "1.21.11-latest" or "1.21.11-recommended"
                    const latestKey = `${gameVersion}-latest`;
                    const recommendedKey = `${gameVersion}-recommended`;
                    
                    let promoVersion = null;
                    if (promos[latestKey]) {
                        promoVersion = promos[latestKey];
                    } else if (promos[recommendedKey]) {
                        promoVersion = promos[recommendedKey];
                    }
                    
                    if (promoVersion) {
                        console.log(`Found promotion version: ${promoVersion}`);
                        return {
                            success: true,
                            versions: [{
                                value: promoVersion,
                                label: `Forge ${promoVersion}`
                            }]
                        };
                    }
                }
                
                // If still no versions, try to find similar versions
                const allVersions = Object.keys(metadata).filter(v => v.startsWith('1.21'));
                console.log(`Available 1.21.x versions:`, allVersions);
                
                throw new Error(`No Forge versions found for Minecraft ${gameVersion}. Available versions: ${allVersions.join(', ')}`);
            }
            
            console.log(`Found ${versions.length} versions for ${gameVersion}`);
            
            // Sort versions (newest first) and format them
            const sortedVersions = versions.sort((a, b) => {
                const aBuild = a.split('-')[1];
                const bBuild = b.split('-')[1];
                return bBuild.localeCompare(aBuild, undefined, { numeric: true });
            });
            
            const versionOptions = sortedVersions.slice(0, 10).map(version => ({
                value: version,
                label: `Forge ${version}`
            }));
            
            return {
                success: true,
                versions: versionOptions
            };
        } catch (error) {
            console.error('Error fetching Forge versions:', error);
            return {
                success: false,
                error: error.message
            };
        }
    });

    ipcMain.handle('fetch-fabric-versions', async (event, gameVersion) => {
        try {
            const response = await fetch(`https://meta.fabricmc.net/v2/versions/loader/${gameVersion}`, {
                method: 'GET',
                headers: {
                    'User-Agent': 'WinterLauncher/2.0.0 (Electron)',
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            if (!response.ok) {
                throw new Error(`Fabric API responded with ${response.status}`);
            }

            const data = await response.json();
            
            if (!data || !Array.isArray(data)) {
                throw new Error('Invalid Fabric loader versions response');
            }

            const versions = data.map(loader => ({
                value: loader.loader.version,
                label: `Fabric Loader ${loader.loader.version}`
            }));

            // Sort versions newest first (semver comparison)
            versions.sort((a, b) => {
                const aParts = a.value.split('.').map(Number);
                const bParts = b.value.split('.').map(Number);
                
                // Compare major version
                if (bParts[0] !== aParts[0]) return bParts[0] - aParts[0];
                // Compare minor version
                if (bParts[1] !== aParts[1]) return bParts[1] - aParts[1];
                // Compare patch version
                return (bParts[2] || 0) - (aParts[2] || 0);
            });

            return { success: true, versions };
        } catch (error) {
            console.error('Error fetching Fabric versions:', error);
            return { success: true, versions: [] };
        }
    });

    ipcMain.handle('fetch-quilt-versions', async (event, gameVersion) => {
        try {
            const allVersions = await fetchMavenVersions('https://maven.quiltmc.org/repository/release/org/quiltmc/quilt-loader/maven-metadata.xml');
            
            const versions = allVersions.map(version => ({
                value: version,
                label: `Quilt ${version}`
            }));

            // Sort versions newest first (semver comparison)
            versions.sort((a, b) => {
                const aParts = a.value.split('.').map(Number);
                const bParts = b.value.split('.').map(Number);
                
                // Compare major version
                if (bParts[0] !== aParts[0]) return bParts[0] - aParts[0];
                // Compare minor version
                if (bParts[1] !== aParts[1]) return bParts[1] - aParts[1];
                // Compare patch version
                return (bParts[2] || 0) - (aParts[2] || 0);
            });

            return { success: true, versions };
        } catch (error) {
            console.error('Error fetching Quilt versions:', error);
            return { success: true, versions: [] };
        }
    });

    ipcMain.handle('fetch-neoforge-versions', async (event, gameVersion) => {
        try {
            // Get all available NeoForge versions - let Ori-MCC handle the selection
            const allVersions = await fetchNeoForgeAPIVersions(gameVersion);
            
            // Return all versions - Ori-MCC will automatically select the best one
            const versions = allVersions.map(version => ({
                value: version,
                label: `NeoForge ${version}`
            }));

            // Sort versions newest first (semver comparison)
            versions.sort((a, b) => {
                const aParts = a.value.split('.').map(Number);
                const bParts = b.value.split('.').map(Number);
                
                // Compare major version
                if (bParts[0] !== aParts[0]) return bParts[0] - aParts[0];
                // Compare minor version
                if (bParts[1] !== aParts[1]) return bParts[1] - aParts[1];
                // Compare patch version
                return (bParts[2] || 0) - (aParts[2] || 0);
            });

            return { success: true, versions };
        } catch (error) {
            console.error('Error fetching NeoForge versions:', error);
            return { success: false, error: error.message, versions: [] };
        }
    });
    
    // Crash analysis and recovery handlers
    ipcMain.handle('store-crash-analysis', async (event, instanceId, crashAnalysis) => {
        try {
            if (!global.crashAnalysisStore) {
                global.crashAnalysisStore = new Map();
            }
            global.crashAnalysisStore.set(instanceId, {
                ...crashAnalysis,
                timestamp: Date.now()
            });
            return { success: true };
        } catch (error) {
            console.error('Error storing crash analysis:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('get-crash-analysis', async (event, instanceId) => {
        try {
            if (!global.crashAnalysisStore) {
                return { success: true, analysis: null };
            }
            const analysis = global.crashAnalysisStore.get(instanceId);
            return { success: true, analysis };
        } catch (error) {
            console.error('Error getting crash analysis:', error);
            return { success: false, error: error.message };
        }
    });
    
    ipcMain.handle('clear-crash-analysis', async (event, instanceId) => {
        try {
            if (global.crashAnalysisStore) {
                global.crashAnalysisStore.delete(instanceId);
            }
            return { success: true };
        } catch (error) {
            console.error('Error clearing crash analysis:', error);
            return { success: false, error: error.message };
        }
    });
};


async function copyDirectory(src, dest) {
    await fs.mkdir(dest, { recursive: true });
    const items = await fs.readdir(src, { withFileTypes: true });
    
    for (const item of items) {
        const srcPath = path.join(src, item.name);
        const destPath = path.join(dest, item.name);
        
        if (item.isDirectory()) {
            await copyDirectory(srcPath, destPath);
        } else {
            await fs.copyFile(srcPath, destPath);
        }
    }
}
async function ensureLogDir() {
  try {
    const appDataPath = app.getPath('appData');
    const logDir = path.join(appDataPath, '.WinterLauncher', 'logs');
    await fs.mkdir(logDir, { recursive: true });
  } catch {}
}
function formatEntry(entry) {
  const { timestamp, level, message, data } = entry;
  const payload = data !== null && data !== undefined ? ` | ${JSON.stringify(data)}` : '';
  return `[${timestamp}] [${level}] ${message}${payload}\n`;
}

/**
 * Initializes the application.
*/
const initializeApp = async () => {
    const gotTheLock = app.requestSingleInstanceLock();
    if (!gotTheLock) {
        app.quit();
        return;
    }

    app.disableHardwareAcceleration();
    
    app.on("second-instance", () => {
        const mainWindow = getAppWindow();
        if (mainWindow) {
            if (mainWindow.isMinimized()) mainWindow.restore();
            mainWindow.focus();
        }
    });

    app.on("window-all-closed", () => {
        if (process.platform !== "darwin") app.quit();
    });

    app.on("activate", () => {
        if (!getAppWindow()) setAppWindow();
    });

    try {
        await app.whenReady();
        initAutoUpdater();
        await setupIpcHandlers();
        setAppWindow();
        setupLoggerBridge(); // Set up logger bridge for console window
    } catch (error) {
        console.error("Error during app initialization:", error);
        app.quit();
    }
};
function initAutoUpdater() {
    if (!app.isPackaged) return;
    autoUpdater.autoDownload = true;
    autoUpdater.on('update-available', (info) => {
        const win = getAppWindow();
        if (win) win.webContents.send('update-available', info);
    });
    autoUpdater.on('download-progress', (p) => {
        const win = getAppWindow();
        const progress = Math.round(p.percent || 0);
        if (win) win.webContents.send('update-download-progress', { progress, downloaded: p.transferred, total: p.total });
    });
    autoUpdater.on('update-downloaded', (info) => {
        const win = getAppWindow();
        if (win) win.webContents.send('update-downloaded', info);
        autoUpdater.quitAndInstall();
    });
    autoUpdater.on('error', (err) => {
        const win = getAppWindow();
        if (win) win.webContents.send('update-error', { message: err?.message });
    });
}

// Start the application
initializeApp();
