import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';
import os from 'os';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
let consoleWindow = null;

const iconPath = `./public/icons/${os.platform() === "win32" ? "icon.ico" : "icon.png"}`;

/**
 * Creates and manages the console window
 */
export const createConsoleWindow = (parentWindow = null) => {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.focus();
        return consoleWindow;
    }

    consoleWindow = new BrowserWindow({
        title: "WinterLauncher Console",
        width: 800,
        height: 600,
        minWidth: 600,
        minHeight: 400,
        resizable: true,
        closable: true,
        maximizable: true,
        icon: iconPath,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            devTools: false,
            webSecurity: true,
            preload: path.join(__dirname, '../preload.js')
        },
        backgroundColor: '#1e1e1e',
        show: false,
        titleBarStyle: 'hidden'
    });

    // Load the console HTML
    if (isDev) {
        // In development, load from Vite dev server
        const devUrl = 'http://localhost:5173/src/console/view.html';
        consoleWindow.loadURL(devUrl).catch(err => {
            console.error('[ConsoleWindow] Failed to load console from dev server:', err);
        });
    } else {
        const consoleHtmlPath = path.join(__dirname, '../../../dist/src/console/view.html');
        consoleWindow.loadFile(consoleHtmlPath).catch(err => {
            console.error('[ConsoleWindow] Failed to load console from file:', err);
        });
    }
    
    // Listen for load errors
    consoleWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
        console.error('[ConsoleWindow] Failed to load console:', errorCode, errorDescription);
    });

    consoleWindow.once('ready-to-show', () => {
        consoleWindow.show();
        if (isDev) {
            consoleWindow.webContents.openDevTools({ mode: 'detach' });
        }
    });

    consoleWindow.on('closed', () => {
        consoleWindow = null;
        // Notify main window that console is closed
        if (parentWindow && !parentWindow.isDestroyed()) {
            parentWindow.webContents.send('console-closed');
        }
    });

    // Apply current theme from parent window
    if (parentWindow && !parentWindow.isDestroyed()) {
        parentWindow.webContents.executeJavaScript('document.body.getAttribute("data-theme") || "default"')
            .then(theme => {
                if (consoleWindow && !consoleWindow.isDestroyed()) {
                    consoleWindow.webContents.executeJavaScript(`document.body.setAttribute('data-theme', '${theme}')`);
                }
            })
            .catch(err => console.error('Failed to sync theme:', err));
    }

    return consoleWindow;
};

/**
 * Closes the console window
 */
export const closeConsoleWindow = () => {
    if (consoleWindow && !consoleWindow.isDestroyed()) {
        consoleWindow.close();
        consoleWindow = null;
    }
};

/**
 * Gets the console window instance
 */
export const getConsoleWindow = () => {
    return consoleWindow;
};

/**
 * Sends console data to the console window
 */
export const sendConsoleData = (data) => {
    const consoleWin = getConsoleWindow();
    if (consoleWin && !consoleWin.isDestroyed()) {
        consoleWin.webContents.send('console-data', data);
    }
};

/**
 * Sets up logger bridge to forward logger events to console window
 */
export const setupLoggerBridge = () => {
    // Listen for logger events from the main window
    ipcMain.on('logger-bridge', (event, logData) => {
        // Forward logger data to console window
        sendConsoleData(logData);
    });
};

/**
 * Sets up IPC handlers for console window management
 */
export const setupConsoleIpcHandlers = () => {
    // Handle console window creation
    ipcMain.handle('open-console-window', async () => {
        const { getAppWindow } = await import('./appWindow.js');
        const mainWindow = getAppWindow();
        const window = createConsoleWindow(mainWindow);
        return window !== null;
    });

    // Handle console window closing
    ipcMain.handle('close-console-window', async () => {
        closeConsoleWindow();
        return true;
    });

    // Handle console window state
    ipcMain.handle('get-console-window-state', async () => {
        return {
            isOpen: consoleWindow !== null && !consoleWindow.isDestroyed()
        };
    });
};