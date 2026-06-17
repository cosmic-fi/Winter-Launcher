import { app, BrowserWindow, screen } from 'electron';
import path from "path";
import os from "os";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isDev = !app.isPackaged;
let window = undefined;

const iconPath = `./public/icons/${os.platform() === "win32" ? "icon.ico" : "icon.png"}`;

/**
 * Creates and sets up the main application window.
 */
const setAppWindow = () => {
    window = new BrowserWindow({
        title: "WinterLauncher",
        width: 1024,
        height: 600,
        minWidth: 1024,
        minHeight: 600,
        resizable: true,
        closable: true,
        maximizable: true,
        icon: iconPath,
        frame: false,
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: true,
            devTools: true,
            webSecurity: false,
            preload: path.join(__dirname, '../preload.js')
        },
        backgroundColor: '#2F2F37',
    });
    
    // Load the main HTML file
    if (isDev) {
        console.log("isDev: ", isDev);
        window.webContents.openDevTools({mode: 'detach'});
        window.loadURL('http://localhost:5173');
    } else {
        window.loadFile(path.join(__dirname, '../../../dist/index.html'));
    }

   
    // Show the window once it's ready
    window.once('ready-to-show', () => {
        window.show();
    });

    // Forward maximize/restore events to renderer so UI can update icons
    window.on('maximize', () => {
        if (!window.isDestroyed()) {
            window.webContents.send('window-maximized');
        }
    });

    window.on('unmaximize', () => {
        if (!window.isDestroyed()) {
            window.webContents.send('window-unmaximized');
        }
    });

    // Remove the default menu
    window.removeMenu();
};

/**
 * Returns the current application window instance.
 * @returns {BrowserWindow | undefined} The application window instance.
 */
const getAppWindow = () => {
    return window;
};

/**
 * Closes the application window and cleans up the instance.
 */
const closeAppWindow = () => {
    if (!window) return;

    window.close();
    window = undefined;
};

export {
    setAppWindow,
    getAppWindow,
    closeAppWindow
};
