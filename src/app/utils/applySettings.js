// @ts-nocheck
import { get } from 'svelte/store';
import { settings } from '../stores/settings';
import { currentLocale } from '../stores/i18n';

// Add this import at the top
import { discordRPCManager } from './discordRPCManager.js';

// Add import
import { notificationService } from '../services/notificationService.js';

export async function applySystemSettings() {
  const currentSettings = get(settings);

  // === General Appearance ===
  const theme = currentSettings?.general?.appearance?.theme?.value;
  if (theme) {
    document.body.setAttribute('data-theme', theme);
  }
 
  const language = currentSettings?.general?.appearance?.language?.value;
  if (language) {
    currentLocale.set(language);
    console.log("Language set to:", language);
  }


  // === Developer Tools ===
  const isDev = currentSettings?.developer?.isDeveloper;
  const enableDevTools = currentSettings?.developer?.debug?.enableDevTools?.value;
  if (isDev && enableDevTools && window?.electron?.openDevTools) {
    window.electron.openDevTools(); // you'd implement this in Electron preload
  }

  // === Discord Rich Presence ===
  const discordPresence = currentSettings?.launcher?.integration?.discordRichPresence?.value;
  if (discordPresence) {
    console.log("Discord RPC enabled.");
    discordRPCManager.initialize();
  } else {
    discordRPCManager.disconnect();
  }

  // === Notifications ===
  await notificationService.initialize();
  
  const playSound = currentSettings?.launcher?.notification?.playSound?.value;
  if (playSound) {
    console.log("Notification sounds enabled.");
  }

  // === Auto-Start ===
  const autoStart = currentSettings?.general?.startup?.autoStart?.value;
  if (autoStart !== undefined && window.electron?.autoStartSync) {
    try {
      await window.electron.autoStartSync(autoStart);
      console.log("Auto-start setting applied:", autoStart);
    } catch (error) {
      console.error("Failed to apply auto-start setting:", error);
    }
  }
}