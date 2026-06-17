import { get } from 'svelte/store';
import { logger } from '../utils/logger.js';
import { instanceLaunchStates } from '../stores/launch.js';

/**
 * Crash recovery service that provides intelligent recovery suggestions
 * and automated recovery attempts based on crash patterns
 */
export class CrashRecoveryService {
    constructor() {
        this.crashPatterns = new Map();
        this.recoveryStrategies = new Map();
        this.initializeRecoveryStrategies();
    }

    initializeRecoveryStrategies() {
        // Define recovery strategies for different crash types
        this.recoveryStrategies.set('memory_issues', {
            name: 'Memory Issues',
            description: 'Game crashed due to memory problems',
            suggestions: [
                'Increase minimum memory allocation',
                'Reduce maximum memory if too high',
                'Close other applications to free up RAM',
                'Consider using 64-bit Java if not already'
            ],
            autoRecovery: (instance) => this.adjustMemorySettings(instance)
        });

        this.recoveryStrategies.set('java_version', {
            name: 'Java Version Issues',
            description: 'Game crashed due to Java compatibility',
            suggestions: [
                'Update to latest Java version',
                'Use Java version recommended for your Minecraft version',
                'Try different Java vendor (AdoptOpenJDK, Oracle, etc.)'
            ],
            autoRecovery: (instance) => this.suggestJavaVersion(instance)
        });

        this.recoveryStrategies.set('mod_conflicts', {
            name: 'Mod Conflicts',
            description: 'Game crashed due to mod compatibility issues',
            suggestions: [
                'Remove recently added mods',
                'Check mod compatibility with your Minecraft version',
                'Update all mods to latest versions',
                'Try launching with fewer mods',
                'Check NeoForge/Forge compatibility for all mods',
                'Try launching without resource packs first'
            ],
            autoRecovery: (instance) => this.analyzeModConflicts(instance)
        });

        this.recoveryStrategies.set('graphics_issues', {
            name: 'Graphics/Display Issues',
            description: 'Game crashed due to graphics problems',
            suggestions: [
                'Update graphics drivers',
                'Try different graphics settings',
                'Disable fancy graphics temporarily',
                'Check for conflicting display software'
            ],
            autoRecovery: (instance) => this.adjustGraphicsSettings(instance)
        });

        this.recoveryStrategies.set('unknown_crashes', {
            name: 'Unknown Crashes',
            description: 'Game crashed for unknown reasons',
            suggestions: [
                'Try launching in safe mode (minimal mods)',
                'Check game logs for specific error messages',
                'Verify game files integrity',
                'Try creating a new instance'
            ],
            autoRecovery: (instance) => this.suggestSafeMode(instance)
        });
    }

    /**
     * Analyzes a crash and provides recovery suggestions
     */
    analyzeCrash(instanceId, crashData) {
        const crashInfo = {
            ...crashData,
            instanceId,
            timestamp: Date.now()
        };

        // Store crash pattern
        this.storeCrashPattern(crashInfo);

        // Analyze crash type
        const crashType = this.determineCrashType(crashInfo);
        const strategy = this.recoveryStrategies.get(crashType);

        if (strategy) {
            return {
                type: crashType,
                strategy: strategy,
                suggestions: strategy.suggestions,
                canAutoRecover: strategy.autoRecovery !== null,
                crashCount: this.getCrashCount(instanceId)
            };
        }

        return {
            type: 'unknown',
            strategy: this.recoveryStrategies.get('unknown_crashes'),
            suggestions: this.recoveryStrategies.get('unknown_crashes').suggestions,
            canAutoRecover: false,
            crashCount: this.getCrashCount(instanceId)
        };
    }

    /**
     * Attempts automatic recovery based on crash analysis
     */
    async attemptRecovery(instanceId, crashAnalysis) {
        if (!crashAnalysis.canAutoRecover) {
            return {
                success: false,
                message: 'No automatic recovery available for this crash type'
            };
        }

        try {
            const instance = this.getInstance(instanceId);
            if (!instance) {
                return {
                    success: false,
                    message: 'Instance not found'
                };
            }

            const result = await crashAnalysis.strategy.autoRecovery(instance);
            
            if (logger && logger.info) {
                logger.info(`[CRASH RECOVERY] Attempted recovery for instance ${instanceId}: ${result.message}`);
            }

            return result;
        } catch (error) {
            if (logger && logger.error) {
                logger.error(`[CRASH RECOVERY] Recovery attempt failed: ${error.message}`);
            }

            return {
                success: false,
                message: `Recovery failed: ${error.message}`
            };
        }
    }

    /**
     * Determines the type of crash based on exit code and other factors
     */
    determineCrashType(crashInfo) {
        const { code, signal, runtime } = crashInfo;

        // Memory-related crashes
        if (code === 137 || signal === 'SIGKILL' || (code === 1 && runtime > 60000)) {
            return 'memory_issues';
        }

        // Java version issues
        if (code === 1 && runtime < 10000) {
            return 'java_version';
        }

        // Graphics/display issues (common Windows crash codes)
        if ([-1073741819, -1073740777, -805306369].includes(code)) {
            return 'graphics_issues';
        }

        // NeoForge/Forge specific crashes (exit code -1 or 4294967295)
        if (code === -1 || code === 4294967295) {
            return 'mod_conflicts';
        }

        // Mod conflicts (based on crash patterns and frequency)
        if (this.isLikelyModConflict(crashInfo)) {
            return 'mod_conflicts';
        }

        return 'unknown_crashes';
    }

    /**
     * Stores crash patterns for analysis
     */
    storeCrashPattern(crashInfo) {
        const key = `${crashInfo.instanceId}_${crashInfo.code}`;
        const existing = this.crashPatterns.get(key) || [];
        existing.push(crashInfo);
        this.crashPatterns.set(key, existing.slice(-5)); // Keep last 5 crashes of this type
    }

    /**
     * Gets crash count for an instance
     */
    getCrashCount(instanceId) {
        let count = 0;
        for (const [key, crashes] of this.crashPatterns) {
            if (key.startsWith(`${instanceId}_`)) {
                count += crashes.length;
            }
        }
        return count;
    }

    /**
     * Checks if crash is likely due to mod conflicts
     */
    isLikelyModConflict(crashInfo) {
        // Check if instance has many mods and crashes frequently
        const instance = this.getInstance(crashInfo.instanceId);
        if (!instance || !instance.mods || instance.mods.length < 10) {
            return false;
        }

        // If crashes are frequent with this instance, likely mod conflicts
        const crashCount = this.getCrashCount(crashInfo.instanceId);
        return crashCount > 2;
    }

    /**
     * Recovery strategy implementations
     */
    adjustMemorySettings(instance) {
        const currentMin = parseInt(instance.memory?.min) || 1024;
        const currentMax = parseInt(instance.memory?.max) || 4096;
        
        return {
            success: true,
            message: `Suggested memory adjustment: increase minimum from ${currentMin}M to ${Math.min(currentMin * 1.5, 2048)}M`,
            suggestedSettings: {
                memory: {
                    min: `${Math.min(currentMin * 1.5, 2048)}M`,
                    max: currentMax > 8192 ? `${currentMax}M` : `${Math.min(currentMax * 1.5, 8192)}M`
                }
            }
        };
    }

    suggestJavaVersion(instance) {
        const minecraftVersion = instance.version;
        let suggestedJava = '17';
        
        if (minecraftVersion && minecraftVersion.startsWith('1.16')) {
            suggestedJava = '8';
        } else if (minecraftVersion && minecraftVersion.startsWith('1.17')) {
            suggestedJava = '16';
        } else if (minecraftVersion && minecraftVersion.startsWith('1.18')) {
            suggestedJava = '17';
        } else if (minecraftVersion && minecraftVersion.startsWith('1.19')) {
            suggestedJava = '17';
        } else if (minecraftVersion && minecraftVersion.startsWith('1.20')) {
            suggestedJava = '17';
        } else if (minecraftVersion && minecraftVersion.startsWith('1.21')) {
            suggestedJava = '21';
        }

        return {
            success: true,
            message: `Suggested Java version for Minecraft ${minecraftVersion}: Java ${suggestedJava}`,
            suggestedSettings: {
                javaVersion: suggestedJava
            }
        };
    }

    analyzeModConflicts(instance) {
        return {
            success: true,
            message: `Instance has ${instance.mods?.length || 0} mods. Consider removing recently added mods or updating all mods.`,
            suggestedActions: [
                'Create backup of current mods',
                'Remove mods added in last session',
                'Update all mods to latest versions'
            ]
        };
    }

    adjustGraphicsSettings(instance) {
        return {
            success: true,
            message: 'Graphics issues detected. Suggested settings adjustments available.',
            suggestedSettings: {
                graphics: 'fast',
                renderDistance: Math.min(parseInt(instance.renderDistance) || 12, 8),
                smoothLighting: false,
                fancyGraphics: false
            }
        };
    }

    suggestSafeMode(instance) {
        return {
            success: true,
            message: 'Safe mode suggestion: Launch with minimal mods to isolate the issue',
            suggestedActions: [
                'Launch with only essential mods',
                'Temporarily disable resource packs',
                'Use default game settings'
            ]
        };
    }

    getInstance(instanceId) {
        const states = get(instanceLaunchStates);
        return states[instanceId];
    }

    /**
     * Get crash history for an instance
     */
    getCrashHistory(instanceId) {
        try {
            const crashHistory = JSON.parse(localStorage.getItem('crashHistory') || '[]');
            return crashHistory.filter(crash => crash.instanceId === instanceId);
        } catch (error) {
            console.error('Failed to get crash history:', error);
            return [];
        }
    }

    /**
     * Clear crash history for an instance
     */
    clearCrashHistory(instanceId) {
        try {
            const crashHistory = JSON.parse(localStorage.getItem('crashHistory') || '[]');
            const filtered = crashHistory.filter(crash => crash.instanceId !== instanceId);
            localStorage.setItem('crashHistory', JSON.stringify(filtered));
            
            // Clear patterns too
            for (const key of this.crashPatterns.keys()) {
                if (key.startsWith(`${instanceId}_`)) {
                    this.crashPatterns.delete(key);
                }
            }
        } catch (error) {
            console.error('Failed to clear crash history:', error);
        }
    }
}

// Export singleton instance
export const crashRecoveryService = new CrashRecoveryService();