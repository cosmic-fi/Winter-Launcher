import { writable } from 'svelte/store';
import {
    loadSettings,
    saveSettings,
    updateSetting,
    getSetting,
    resetSettings,
    ensureSettingsInitialized,
    defaultSettings
} from '../shared/configurations.js';
import { applySystemSettings } from '../utils/applySettings.js';

function createSettingsStore() {
    const { subscribe, set, update } = writable({});
    let initialized = false;

    // Initialize the store asynchronously
    const init = async () => {
        if (!initialized) {
            await ensureSettingsInitialized();
            const settings = await loadSettings();
            set(settings);
            initialized = true;
        }
    };

    // Keep localStorage in sync on every change
    subscribe(value => {
        if (initialized && Object.keys(value).length > 0) {
            saveSettings(value);
        }
    });

    return {
        subscribe,
        init,
        set: (val) => {
            set(val);
            saveSettings(val);
        },
        update: (fn) => {
            update(current => {
                const updated = fn(structuredClone(current));
                saveSettings(updated);
                return updated;
            });
        },
        // Update a single nested setting by path (e.g. "general.appearance.theme")
        updatePath: async (path, value) => {
            await updateSetting(path, value);
            const settings = await loadSettings();
            set(settings);
        },
        // Get a single nested setting by path
        getPath: async (path) => await getSetting(path),
        reset: async () => {
            await resetSettings();
            const defaults = await loadSettings();
            set(structuredClone(defaults));
            await applySystemSettings();
        }
    };
}

export const settings = createSettingsStore();