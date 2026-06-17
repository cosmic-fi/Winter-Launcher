import { writable } from 'svelte/store';
import { baseURL } from '../services/api';

export const isOnline = writable(navigator.onLine);

let intervalId;

export function startConnectionDaemon(onLost, onRestored, pingUrl = `${baseURL}/ping`, interval = 5000) {
    let lastStatus = navigator.onLine;

    async function checkConnection() {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);

            const res = await fetch(pingUrl, {
                method: 'GET',
                cache: 'no-store',
                signal: controller.signal,
                headers: {
                    'User-Agent': 'WinterLauncher/1.0.0 (Electron)',
                    'Accept': '*/*',
                    'Cache-Control': 'no-cache'
                },
                mode: 'cors'
            });
            clearTimeout(timeout);

            if (res.ok) {
                if (!lastStatus) {
                    isOnline.set(true);
                    if (onRestored) onRestored();
                }
                lastStatus = true;
            } else {
                if (lastStatus) {
                    isOnline.set(false);
                    if (onLost) onLost();
                }
                lastStatus = false;
            }
        } catch {
            if (lastStatus) {
                isOnline.set(false);
                if (onLost) onLost();
            }
            lastStatus = false;
        }
    }

    // Listen to browser events as fallback
    window.addEventListener('offline', () => {
        isOnline.set(false);
        if (onLost) onLost();
        lastStatus = false;
    });
    window.addEventListener('online', () => {
        isOnline.set(true);
        if (onRestored) onRestored();
        lastStatus = true;
    });

    // Start periodic check
    clearInterval(intervalId);
    intervalId = setInterval(checkConnection, interval);
    checkConnection(); // Initial check
}

export function stopConnectionDaemon() {
    clearInterval(intervalId);
}