// @ts-nocheck
/**
 * @author Cosmic-fi
 * @description Version utility for the WinterLauncher Front-End application.
 */

import { writable } from 'svelte/store';

export const appVersion = writable('1.0.0');

export async function fetchAppVersion() {
    try {
        const version = await window.electron.invoke('get-app-version');
        appVersion.set(version.version);
        return version.version;
    } catch (error) {
        console.error('Failed to fetch app version:', error);
        return '1.0.0'; // Fallback version
    }
}