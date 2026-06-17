/**
 * @author Cosmic-fi
 * @description Preload script for the WinterLauncher application.
*/

const { contextBridge, shell, ipcRenderer } = require('electron');

// Add global error handler for unhandled IPC events
ipcRenderer.on('error', (event, error) => {
  console.error('Unhandled IPC error event:', error);
});

// Add handler for console-closed event (must be added early)
ipcRenderer.on('console-closed', (event) => {
  console.log('Console window closed event received');
});

// Catch any other unhandled events
ipcRenderer.on('uncaughtException', (event, error) => {
  console.error('Uncaught exception in renderer:', error);
});

window.addEventListener('DOMContentLoaded', () => {
  console.log('Preload loaded');
});

contextBridge.exposeInMainWorld('electron', {
  // System/Shell methods
  openExternal: (url) => shell.openExternal(url),
  openPath: (path) => shell.openPath(path),
  invoke: (channel, ...args) => ipcRenderer.invoke(channel, ...args),
  on: (channel, listener) => ipcRenderer.on(channel, listener),
  getMemoryInfo: () => process.getSystemMemoryInfo(),
  closeApp: () => ipcRenderer.invoke('quit-app'),
  minimizeApp: () => ipcRenderer.invoke('minimize-app'),
  toggleMaximizeApp: () => ipcRenderer.invoke('toggle-maximize-app'),
  restartApp: () => ipcRenderer.invoke('restart-app'),

  // Dialog methods
  openFolderDialog: () => ipcRenderer.invoke('open-folder-dialog'),
  
  // App info methods
  getAppVersion: () => ipcRenderer.invoke('get-app-version'),
  startAutoUpdate: () => ipcRenderer.invoke('start-auto-update'),
  
  // Account methods
  refreshAccount: (profile) => ipcRenderer.invoke('refresh-account', profile),
  downloadSkin: (skinUrl, filename) => ipcRenderer.invoke('download-skin', skinUrl, filename),
  
  // Game launch methods
  launchGame: async (options) => ipcRenderer.invoke('launch-game', options),
  cancelLaunch: async (event) => ipcRenderer.invoke('cancel-launch', event),
  
  //Network & API
  pingApi: async () => ipcRenderer.invoke('ping-api'),
  
  // Loader version API methods (to avoid CORS issues)
  fetchForgeVersions: (gameVersion) => ipcRenderer.invoke('fetch-forge-versions', gameVersion),
  fetchFabricVersions: (gameVersion) => ipcRenderer.invoke('fetch-fabric-versions', gameVersion),
  fetchQuiltVersions: (gameVersion) => ipcRenderer.invoke('fetch-quilt-versions', gameVersion),
  fetchNeoForgeVersions: (gameVersion) => ipcRenderer.invoke('fetch-neoforge-versions', gameVersion),

  // Launch event listeners
  onLaunchProgress: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-progress', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-progress', wrappedCallback);
  },
  onLaunchExtract: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-extract', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-extract', wrappedCallback);
  },
  onLaunchCheck: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-check', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-check', wrappedCallback);
  },
  onLaunchData: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-data', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-data', wrappedCallback);
  },
  onLaunchClose: (callback) => {
    const wrappedCallback = (event, code) => callback(code);
    ipcRenderer.on('launch-close', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-close', wrappedCallback);
  },
  onLaunchEstimatedTime: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-estimated-time', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-estimated-time', wrappedCallback);
  },
  onLaunchComplete: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-complete', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-complete', wrappedCallback);
  },
  onLaunchWarning: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-warning', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-warning', wrappedCallback);
  },
  
  // Error handling listeners
  onError: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('error', wrappedCallback);
    return () => ipcRenderer.removeListener('error', wrappedCallback);
  },
  onLaunchError: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('launch-error', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-error', wrappedCallback);
  },
  onLaunchCancelled: (callback) => {
    const wrappedCallback = (event, message) => callback(message);
    ipcRenderer.on('launch-cancelled', wrappedCallback);
    return () => ipcRenderer.removeListener('launch-cancelled', wrappedCallback);
  },
  
  // Console window events
  onConsoleClosed: (callback) => {
    const wrappedCallback = (event) => callback();
    ipcRenderer.on('console-closed', wrappedCallback);
    return () => ipcRenderer.removeListener('console-closed', wrappedCallback);
  },
  
  // Launch listener cleanup
  removeAllLaunchListeners: () => {
    const events = ['launch-progress', 'launch-extract', 'launch-check', 'launch-data', 'launch-close', 'launch-estimated-time', 'launch-complete', 'error', 'launch-error', 'launch-cancelled'];
    
    events.forEach(event => {
      const count = ipcRenderer.listenerCount(event);
      if (count > 0) {
        console.log(`[CLEANUP] Removing ${count} listeners for ${event}`);
        ipcRenderer.removeAllListeners(event);
      }
    });
    
    console.log('[CLEANUP] All launch listeners removed');
  },
  
  // Window state events
  onWindowMaximized: (callback) => {
    const wrapped = () => callback();
    ipcRenderer.on('window-maximized', wrapped);
    return () => ipcRenderer.removeListener('window-maximized', wrapped);
  },
  onWindowUnmaximized: (callback) => {
    const wrapped = () => callback();
    ipcRenderer.on('window-unmaximized', wrapped);
    return () => ipcRenderer.removeListener('window-unmaximized', wrapped);
  },
  
  // File system methods
  getAppFolder: () => ipcRenderer.invoke('get-app-path'),
  getMinecraftFolder: () => ipcRenderer.invoke('get-minecraft-path'),
  getBackupFolder: () => ipcRenderer.invoke('get-backup-folder'),
  openFolderInExplorer: (folderPath) => ipcRenderer.invoke('open-folder-in-explorer', folderPath),
  ensureDir: (dirPath) => ipcRenderer.invoke('ensure-dir', dirPath),
  pathJoin: (...paths) => ipcRenderer.invoke('path-join', ...paths),
  pathExists: (path) => ipcRenderer.invoke('path-exists', path),
  readdir: (dirPath) => ipcRenderer.invoke('readdir', dirPath),
  
  // File logging methods
  writeLog: (logEntry) => ipcRenderer.invoke('write-log', logEntry),
  readLogs: (options) => ipcRenderer.invoke('read-logs', options),
  clearLogFiles: () => ipcRenderer.invoke('clear-log-files'),
  
  // Console window methods
  openConsoleWindow: () => ipcRenderer.invoke('open-console-window'),
  closeConsoleWindow: () => ipcRenderer.invoke('close-console-window'),
  getConsoleWindowState: () => ipcRenderer.invoke('get-console-window-state'),
  logToConsole: (logData) => ipcRenderer.invoke('log-to-console', logData),
  
  // Console data listener
  onConsoleData: (callback) => {
    const wrappedCallback = (event, data) => callback(data);
    ipcRenderer.on('console-data', wrappedCallback);
    return () => ipcRenderer.removeListener('console-data', wrappedCallback);
  },
  
  // Console status listener
  onConsoleStatus: (callback) => {
    const wrappedCallback = (event, status) => callback(status);
    ipcRenderer.on('console-status', wrappedCallback);
    return () => ipcRenderer.removeListener('console-status', wrappedCallback);
  },
  
  // Session-based logging methods
  startLogSession: () => ipcRenderer.invoke('start-log-session'),
  endLogSession: () => ipcRenderer.invoke('end-log-session'),
  writeSessionLog: (logEntry) => ipcRenderer.invoke('write-session-log', logEntry),
  readSessionLogs: (options) => ipcRenderer.invoke('read-session-logs', options),
  
  // Discord RPC methods
  discordRPC: {
    init: () => ipcRenderer.invoke('discord-rpc-init'),
    disconnect: () => ipcRenderer.invoke('discord-rpc-disconnect'),
    setIdle: () => ipcRenderer.invoke('discord-rpc-set-idle'),
    setLaunching: (version, variant) => ipcRenderer.invoke('discord-rpc-set-launching', version, variant),
    setPlaying: (version, variant, username) => ipcRenderer.invoke('discord-rpc-set-playing', version, variant, username),
    setDownloading: (progress, version) => ipcRenderer.invoke('discord-rpc-set-downloading', progress, version),
    clear: () => ipcRenderer.invoke('discord-rpc-clear'),
    getStatus: () => ipcRenderer.invoke('discord-rpc-status')
  },
  
  // Notification methods
  showSystemNotification: (options) => ipcRenderer.invoke('show-system-notification', options),
  checkNotificationPermission: () => ipcRenderer.invoke('check-notification-permission'),
  
  downloadAndInstallUpdate: (payload) => ipcRenderer.invoke('download-and-install-update', payload),
  downloadUpdateFile: (payload) => ipcRenderer.invoke('download-update-file', payload),
  installUpdateFile: (payload) => ipcRenderer.invoke('install-update-file', payload),
  
  onUpdateDownloadProgress: (callback) => {
    const wrapped = (event, data) => callback(data)
    ipcRenderer.on('update-download-progress', wrapped)
    return () => ipcRenderer.removeListener('update-download-progress', wrapped)
  },
  onUpdateAvailable: (callback) => {
    const wrapped = (event, data) => callback(data)
    ipcRenderer.on('update-available', wrapped)
    return () => ipcRenderer.removeListener('update-available', wrapped)
  },
  onUpdateDownloaded: (callback) => {
    const wrapped = (event, data) => callback(data)
    ipcRenderer.on('update-downloaded', wrapped)
    return () => ipcRenderer.removeListener('update-downloaded', wrapped)
  },
  
});
