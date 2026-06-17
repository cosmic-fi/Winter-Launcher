// @ts-nocheck
/**
 * @author Cosmic-fi
 * @description Logger utility for the WinterLauncher Front-End application.
 */

import { writable } from 'svelte/store';

export const logLevels = {
  DEBUG: { level: 0, label: 'DEBUG', consoleStyle: 'color: #ba68c8' },
  INFO: { level: 1, label: 'INFO', consoleStyle: 'color: #4fc3f7' },
  SUCCESS: { level: 2, label: 'SUCCESS', consoleStyle: 'color: #69f0ae' },
  WARNING: { level: 3, label: 'WARNING', consoleStyle: 'color: #ffb300' },
  ERROR: { level: 4, label: 'ERROR', consoleStyle: 'color: #ff5252' }
};

const defaultMaxEntries = 1000;

function createLogger() {
  const { subscribe, set, update } = writable([]);
  let minLevelKey = 'DEBUG';
  let maxEntries = defaultMaxEntries;
  let sessionActive = false;
  let isInitialized = false;

  function getLevelValue(key) {
    return logLevels[key]?.level ?? 0;
  }

  function shouldLog(entryLevelKey) {
    return getLevelValue(entryLevelKey) >= getLevelValue(minLevelKey);
  }

  function formatEntry({ timestamp, level, message, data }) {
    const payload = data !== null && data !== undefined ? ` | ${typeof data === 'string' ? data : JSON.stringify(data)}` : '';
    return `[${timestamp}] [${level}] ${message}${payload}`;
  }

  // Define which messages should be stacked (only specific ones)
  function getStackablePattern(message) {
    const stackablePatterns = [
      { regex: /^▽ Downloading .+\.\.\.\./, base: '▽ Downloading files', shouldStack: true },
      { regex: /^※ Extracting Files \.\.\. .+/, base: '※ Extracting Files', shouldStack: true },
      { regex: /^⁂ Verifying Files \.\.\. .+/, base: '⁂ Verifying Files', shouldStack: true },
    ];

    for (const pattern of stackablePatterns) {
      if (pattern.regex.test(message) && pattern.shouldStack) {
        return pattern.base;
      }
    }
    return null; // Not stackable - show normally
  }

  async function initialize(loadPreviousSessions = false) {
    if (isInitialized) return;
    if (loadPreviousSessions && typeof window !== 'undefined' && window.electron) {
      try {
        const result = await window.electron?.readSessionLogs?.({
          maxSessions: 3,
          maxLines: maxEntries
        });
        if (result?.success && Array.isArray(result.logs)) {
          // transform raw lines into minimal entries for display
          // since we don't have structured data from log file, just store strings
          set(result.logs.map(line => ({ raw: line })));
          console.log(`%c[LOGGER]%c Loaded ${result.logs.length} previous log lines`, 'font-weight:bold', '');
        }
      } catch (e) {
        console.error('[LOGGER] Failed to load previous session logs:', e);
      }
    } else {
      set([]);
    }
    isInitialized = true;
  }

  async function startSession() {
    if (sessionActive) return;
    if (typeof window !== 'undefined' && window.electron) {
      try {
        const result = await window.electron?.startLogSession?.();
        if (result?.success) {
          sessionActive = true;
          set([]);
          console.log('%c[LOGGER]%c Session started:', 'font-weight:bold', '', result.sessionFile);
        }
      } catch (e) {
        console.error('[LOGGER] startSession failed:', e);
      }
    }
  }

  async function endSession() {
    if (!sessionActive) return;
    if (typeof window !== 'undefined' && window.electron) {
      try {
        await window.electron?.endLogSession?.();
        sessionActive = false;
        console.log('%c[LOGGER]%c Session ended', 'font-weight:bold', '');
      } catch (e) {
        console.error('[LOGGER] endSession failed:', e);
      }
    }
  }

  async function addLog(levelKey, message, data = null) {
    if (!logLevels[levelKey]) levelKey = 'INFO';
    const timestamp = new Date().toISOString();
    const entry = { timestamp, level: levelKey, message, data };

    // Check if this message should be stacked
    const stackPattern = getStackablePattern(message);

    if (shouldLog(levelKey)) {
      update(logs => {
        let newLogs = [...logs];
        
        if (stackPattern) {
          // Look for existing stackable entry (only check last few entries for performance)
          const searchRange = Math.min(5, newLogs.length);
          let foundIndex = -1;
          
          for (let i = newLogs.length - 1; i >= newLogs.length - searchRange; i--) {
            if (newLogs[i] && 
                newLogs[i].level === levelKey && 
                newLogs[i].stackPattern === stackPattern) {
              foundIndex = i;
              break;
            }
          }
          
          if (foundIndex !== -1) {
            // Update existing stacked entry
            newLogs[foundIndex] = {
              ...newLogs[foundIndex],
              count: (newLogs[foundIndex].count || 1) + 1,
              lastMessage: message,
              timestamp: timestamp,
              data: data,
              lastUpdate: Date.now()
            };
          } else {
            // Create new stackable entry
            newLogs.push({
              ...entry,
              stackPattern: stackPattern,
              count: 1,
              lastMessage: message,
              isStackable: true,
              lastUpdate: Date.now()
            });
          }
        } else {
          // Regular message - show normally (not stacked)
          newLogs.push(entry);
        }
        
        if (newLogs.length > maxEntries) {
          return newLogs.slice(newLogs.length - maxEntries);
        }
        return newLogs;
      });
    }

    // Write to session file if active (only in renderer process)
    if (sessionActive && typeof window !== 'undefined' && window.electron) {
      try {
        await window.electron?.writeSessionLog?.(entry);
      } catch (e) {
        console.error('[LOGGER] Failed to write session log:', e);
      }
    }

    // Send to console window via main process (only in renderer process)
    try {
      if (typeof window !== 'undefined' && window.electron && window.electron.logToConsole) {
        console.log(`[LOGGER] Sending to console: level=${levelKey}, message=${message}`);
        await window.electron.logToConsole(entry);
      }
    } catch (e) {
      console.error('[LOGGER] Failed to send to console:', e);
    }

    // Mirror to console with styling
    const style = logLevels[levelKey].consoleStyle;
    const prefix = `[${levelKey}] ${message}`;
    if (levelKey === 'ERROR') {
      console.error(`%c${prefix}`, style, data || '');
    } else if (levelKey === 'WARNING') {
      console.warn(`%c${prefix}`, style, data || '');
    } else {
      console.log(`%c${prefix}`, style, data || '');
    }
  }

  return {
    subscribe,

    // initialization
    init: (loadPreviousSessions = false) => initialize(loadPreviousSessions),

    // session
    startSession,
    endSession,

    // logging helpers
    debug: (msg, data) => addLog('DEBUG', msg, data),
    info: (msg, data) => addLog('INFO', msg, data),
    success: (msg, data) => addLog('SUCCESS', msg, data),
    warn: (msg, data) => addLog('WARNING', msg, data),
    error: (msg, data) => addLog('ERROR', msg, data),

    // utility
    clear: () => set([]),
    reload: () => initialize(true),

    // config
    setMinLevel: (levelKey) => {
      if (logLevels[levelKey]) minLevelKey = levelKey;
    },
    setMaxEntries: (n) => {
      maxEntries = n;
    },

    // getters
    getCurrentLevel: () => minLevelKey,
    isSessionActive: () => sessionActive,
    logLevels
  };
}

export const logger = createLogger();