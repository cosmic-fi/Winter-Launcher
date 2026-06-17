// @ts-nocheck
import { writable, derived, get } from 'svelte/store'; // Add 'get' import
import { logger } from '../utils/logger';
import { showToast } from './ui';
import { t } from './i18n';

// Core launch state
export const isLaunching = writable(false);
export const launchStatus = writable('ready');
export const launchError = writable(null);
export const launchTimeout = writable(null); // Add missing launchTimeout
export const runningInstances = writable(0);
export const runningInstancesList = writable([]); // Track running instances with details

// Per-instance launch tracking
export const instanceLaunchStates = writable({}); // { instanceId: { isLaunching: boolean, status: string, progress?: number, progressText?: string } }

// Derived stores
export const canLaunch = derived(
    [isLaunching, launchStatus],
    ([$isLaunching, $launchStatus]) => {
        return !$isLaunching && ($launchStatus === 'ready' || $launchStatus === 'error');
    }
);

export const launchButtonText = derived(
    [launchStatus, t],
    ([$launchStatus, $t]) => {
        switch ($launchStatus) {
            case 'preparing':
                return `${$t('mainContent.launch.launchStatus.preparing')}...`;
            case 'downloading':
                return `${$t('mainContent.launch.launchStatus.downloading')} ${$t('mainContent.launch.launchStatus.assets')}...`;
            case 'extracting':
                return `${$t('mainContent.launch.launchStatus.extracting')}...`;
            case 'verifying':
                return `${$t('mainContent.launch.launchStatus.verifying')}...`;
            case 'running':
                return `${$t('mainContent.launch.launchStatus.running')}`;
            case 'error':
                return `${$t('mainContent.launch.launchStatus.ready')}`;
            default:
                return `${$t('mainContent.launch.launchStatus.ready')}`;
        }
    }
);

// Per-instance launch status - returns functions that check status for specific instance
export const getInstanceLaunchStatus = (instanceId) => derived(
    [instanceLaunchStates, runningInstancesList],
    ([$instanceLaunchStates, $runningInstancesList]) => {
        const instanceState = $instanceLaunchStates[instanceId] || { isLaunching: false, status: 'ready' };
        const isRunning = $runningInstancesList.some(item => item.id === instanceId);
        
        return {
            canLaunch: !instanceState.isLaunching && (instanceState.status === 'ready' || instanceState.status === 'error'),
            isLaunching: instanceState.isLaunching,
            isRunning: isRunning,
            launchStatus: instanceState.status,
            progress: instanceState.progress || 0,
            progressText: instanceState.progressText || '',
            buttonText: instanceState.isLaunching ? 
                (() => {
                    switch (instanceState.status) {
                        case 'preparing':
                            return `${get(t)('mainContent.launch.launchStatus.preparing')}`;
                        case 'downloading':
                            return `${get(t)('mainContent.launch.launchStatus.downloading')}`;
                        case 'extracting':
                            return `${get(t)('mainContent.launch.launchStatus.extracting')}`;
                        case 'verifying':
                            return `${get(t)('mainContent.launch.launchStatus.verifying')}`;
                        case 'running':
                            return `${get(t)('mainContent.launch.launchStatus.running')}`;
                        case 'error':
                            return `${get(t)('mainContent.launch.launchStatus.ready')}`;
                        default:
                            return `${get(t)('mainContent.launch.launchStatus.launching')}`;
                    }
                })() :
                isRunning ? 
                    `${get(t)('mainContent.launch.launchStatus.running')}` :
                    `${get(t)('mainContent.launch.launchStatus.ready')}`,
            progressText: instanceState.isLaunching ? 
                (() => {
                    switch (instanceState.status) {
                        case 'preparing':
                            return instanceState.progressText || `${get(t)('mainContent.launch.launchStatus.preparing')} instance...`;
                        case 'downloading':
                            return instanceState.progressText || `${get(t)('mainContent.launch.launchStatus.downloading')} ${get(t)('mainContent.launch.launchStatus.assets')}...`;
                        case 'extracting':
                            return instanceState.progressText || `${get(t)('mainContent.launch.launchStatus.extracting')} files...`;
                        case 'verifying':
                            return instanceState.progressText || `${get(t)('mainContent.launch.launchStatus.verifying')} files...`;
                        case 'running':
                            return instanceState.progressText || `${get(t)('mainContent.launch.launchStatus.running')} game...`;
                        case 'error':
                            return instanceState.progressText || 'Ready to launch';
                        default:
                            return instanceState.progressText || `${get(t)('mainContent.launch.launchStatus.launching')}...`;
                    }
                })() :
                isRunning ? 
                    'Game is running' :
                    'Ready to launch'
        };
    }
);

export const launchActions = {
    setLaunching: (launching) => {
        isLaunching.set(launching);
    },
    
    setStatus: (status) => {
        launchStatus.set(status);
        if (status === 'ready') {
            launchError.set(null);
        }
    },
    
    // Per-instance launch state management
    setInstanceLaunching: (instanceId, launching) => {
        instanceLaunchStates.update(states => ({
            ...states,
            [instanceId]: {
                ...(states[instanceId] || { status: 'ready' }),
                isLaunching: launching
            }
        }));
    },
    
    setInstanceStatus: (instanceId, status) => {
        instanceLaunchStates.update(states => ({
            ...states,
            [instanceId]: {
                ...(states[instanceId] || { isLaunching: false }),
                status: status
            }
        }));
    },
    
    setDownloadProgress: (instanceId, progress, progressText = '') => {
        instanceLaunchStates.update(states => ({
            ...states,
            [instanceId]: {
                ...(states[instanceId] || { isLaunching: false, status: 'downloading' }),
                progress: progress,
                progressText: progressText
            }
        }));
    },
    
    resetInstance: (instanceId) => {
        instanceLaunchStates.update(states => {
            const newStates = { ...states };
            delete newStates[instanceId];
            return newStates;
        });
    },
    
    clearDownloadProgress: (instanceId) => {
        instanceLaunchStates.update(states => ({
            ...states,
            [instanceId]: {
                ...(states[instanceId] || { isLaunching: false }),
                progress: 0,
                progressText: ''
            }
        }));
    },
    setError: (error) => {
        launchError.set(error);
        launchStatus.set('error');
        isLaunching.set(false);
        
        // Clear timeout on error
        const timeoutId = get(launchTimeout);
        if (timeoutId) {
            clearTimeout(timeoutId);
            launchTimeout.set(null);
        }
        
        // Auto-reset after timeout errors (allow retry)
        if (error && error.includes('timeout')) {
            launchStatus.set('ready');
            launchError.set(null);
        }
    },
    
    // Add manual reset for timeout errors
    resetTimeout: () => {
        launchStatus.set('ready');
        launchError.set(null);
        isLaunching.set(false);
    },
    
    reset: () => {
        isLaunching.set(false);
        launchStatus.set('ready');
        launchError.set(null);
    }
    ,
    instanceStarted: (instanceData) => {
        runningInstancesList.update(list => {
            const newList = [...list];
            const existingIndex = newList.findIndex(item => item.id === instanceData.id);
            
            if (instanceData) {
                if (existingIndex === -1) {
                    // Instance not in list, add it with fresh start time and increment counter
                    newList.push({
                        id: instanceData.id,
                        name: instanceData.name,
                        startTime: Date.now()
                    });
                    runningInstances.update(n => n + 1);
                } else {
                    // Instance already in list, update start time to reset timer (don't increment counter)
                    newList[existingIndex] = {
                        ...newList[existingIndex],
                        startTime: Date.now()
                    };
                }
            }
            return newList;
        });
        
        // Set per-instance status to running
        if (instanceData && instanceData.id) {
            instanceLaunchStates.update(states => ({
                ...states,
                [instanceData.id]: {
                    isLaunching: false,
                    status: 'running'
                }
            }));
        }
    },
    instanceClosed: (instanceId) => {
        runningInstancesList.update(list => {
            const wasInList = list.some(item => item.id === instanceId);
            const newList = list.filter(item => item.id !== instanceId);
            
            // Only decrement counter if the instance was actually in the list
            if (wasInList) {
                runningInstances.update(n => Math.max(0, n - 1));
            }
            
            return newList;
        });
        
        // Clean up per-instance state
        if (instanceId) {
            instanceLaunchStates.update(states => {
                const newStates = { ...states };
                delete newStates[instanceId];
                return newStates;
            });
        }
    }
};
