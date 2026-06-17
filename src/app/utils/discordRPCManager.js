// @ts-nocheck
import { get } from 'svelte/store';
import { settings } from '../stores/settings';
import { getSelectedAccount } from '../shared/user';
import { selectedMajor, selectedVariant } from '../shared/versionManager';
import { launchStatus } from '../stores/launch';

class DiscordRPCManager {
    constructor() {
        this.isEnabled = false;
        this.isInitialized = false;
    }

    async initialize() {
        const currentSettings = get(settings);
        this.isEnabled = currentSettings?.launcher?.integration?.discordRichPresence?.value || false;
        
        if (this.isEnabled && !this.isInitialized) {
            try {
                const result = await window.electron.discordRPC.init();
                if (result.success) {
                    this.isInitialized = true;
                    console.log('Discord RPC initialized successfully');
                    await this.setIdleActivity();
                } else {
                    console.error('Failed to initialize Discord RPC:', result.error);
                }
            } catch (error) {
                console.error('Discord RPC initialization error:', error);
            }
        }
    }

    async disconnect() {
        if (this.isInitialized) {
            try {
                await window.electron.discordRPC.disconnect();
                this.isInitialized = false;
                console.log('Discord RPC disconnected');
            } catch (error) {
                console.error('Discord RPC disconnect error:', error);
            }
        }
    }

    async updateSettings(enabled) {
        const wasEnabled = this.isEnabled;
        this.isEnabled = enabled;

        if (enabled && !wasEnabled) {
            // Enable Discord RPC
            await this.initialize();
        } else if (!enabled && wasEnabled) {
            await this.clearActivity();
            await this.disconnect();
        } else if (enabled && this.isInitialized) {
            await this.setIdleActivity();
        }
    }

    async setIdleActivity() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            await window.electron.discordRPC.setIdle();
        } catch (error) {
            console.error('Failed to set idle activity:', error);
        }
    }

    async setLaunchingActivity() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            const version = get(selectedMajor);
            const variant = get(selectedVariant);
            await window.electron.discordRPC.setLaunching(version, variant);
        } catch (error) {
            console.error('Failed to set launching activity:', error);
        }
    }

    async setPlayingActivity() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            const version = get(selectedMajor);
            const variant = get(selectedVariant);
            const account = getSelectedAccount();
            const username = account?.username || account?.name || 'Player';
            
            await window.electron.discordRPC.setPlaying(version, variant, username);
        } catch (error) {
            console.error('Failed to set playing activity:', error);
        }
    }

    async setDownloadingActivity(progress) {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            const version = get(selectedMajor);
            await window.electron.discordRPC.setDownloading(progress, version);
        } catch (error) {
            console.error('Failed to set downloading activity:', error);
        }
    }

    async clearActivity() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        try {
            await window.electron.discordRPC.clear();
        } catch (error) {
            console.error('Failed to clear activity:', error);
        }
    }

    async getStatus() {
        if (!this.isInitialized) {
            return { isConnected: false, currentActivity: null };
        }
        
        try {
            return await window.electron.discordRPC.getStatus();
        } catch (error) {
            console.error('Failed to get Discord RPC status:', error);
            return { isConnected: false, currentActivity: null };
        }
    }

    async refreshActivity() {
        if (!this.isEnabled || !this.isInitialized) return;
        
        const currentStatus = get(launchStatus);
        
        switch (currentStatus.status) {
            case 'running':
                await this.setPlayingActivity();
                break;
            case 'downloading':
                await this.setDownloadingActivity(currentStatus.progress?.percentage || 0);
                break;
            case 'launching':
                await this.setLaunchingActivity();
                break;
            default:
                await this.setIdleActivity();
                break;
        }
    }
}

// Export singleton instance
export const discordRPCManager = new DiscordRPCManager();