/**
 * @author Cosmic-fi
 * @description Discord RPC service for the WinterLauncher application.
*/

import DiscordRPC from 'discord-rpc';
import { app } from 'electron';
import dotenv from 'dotenv';
import path from 'path';
import fs from 'fs';

dotenv.config();
const gitUrl = 'https://github.com/cosmic-fi/ori-launcher';

class DiscordRPCService {
    constructor() {
        this.client = null;
        this.isConnected = false;
        this.clientId = this.getDiscordClientId();
        this.startTime = null;
        this.currentActivity = null;
    }

    getDiscordClientId() {
        // Try to get from environment variable first
        if (process.env.DISCORD_CLIENT_ID) {
            return process.env.DISCORD_CLIENT_ID;
        }
        
        // Fallback for development - try to read from .env file
        try {
            const envPath = path.join(process.cwd(), '.env');
            if (fs.existsSync(envPath)) {
                const envContent = fs.readFileSync(envPath, 'utf8');
                const clientIdMatch = envContent.match(/DISCORD_CLIENT_ID=(.+)/);
                if (clientIdMatch && clientIdMatch[1]) {
                    return clientIdMatch[1].trim();
                }
            }
        } catch (error) {
            console.warn('Failed to read .env file:', error);
        }
    }

    async initialize() {
        if (this.client) {
            return;
        }

        try {
            console.log(`Initializing Discord RPC with client ID: ${this.clientId}`);
            this.client = new DiscordRPC.Client({ transport: 'ipc' });
            
            this.client.on('ready', () => {
                console.log('Discord RPC connected');
                this.isConnected = true;
                this.startTime = Date.now();
                this.setIdleActivity();
            });

            this.client.on('disconnected', () => {
                console.log('Discord RPC disconnected');
                this.isConnected = false;
            });

            this.client.on('error', (error) => {
                console.error('Discord RPC error:', error);
            });

            await this.client.login({ clientId: this.clientId });
            console.log('Discord RPC login successful');
        } catch (error) {
            console.error('Failed to initialize Discord RPC:', error);
            console.error('This might be due to:');
            console.error('- Missing Discord client ID');
            console.error('- Discord client not running');
            console.error('- Native module issues in packaged app');
            this.client = null;
            this.isConnected = false;
        }
    }

    async disconnect() {
        if (this.client && this.isConnected) {
            try {
                await this.client.destroy();
                console.log('Discord RPC disconnected');
            } catch (error) {
                console.error('Error disconnecting Discord RPC:', error);
            }
        }
        this.client = null;
        this.isConnected = false;
        this.startTime = null;
        this.currentActivity = null;
    }

    setIdleActivity() {
        if (!this.isConnected) return;

        const activity = {
            details: 'In Launcher',
            state: 'Browsing',
            startTimestamp: this.startTime,
            largeImageKey: 'ori_launcher_logo',
            largeImageText: `WinterLauncher v${app.getVersion()}`,
            smallImageText: 'Idle',
            instance: false,
            buttons: [
                {
                    label: 'Download WinterLauncher',
                    url: gitUrl
                }
            ]
        };

        this.setActivity(activity);
    }

    setLaunchingActivity(version, variant) {
        if (!this.isConnected) return;

        const activity = {
            details: `Launching Minecraft ${version}`,
            state: `${variant} Version`,
            startTimestamp: Date.now(),
            largeImageKey: 'ori_launcher_logo',
            largeImageText: `WinterLauncher v${app.getVersion()}`,
            smallImageKey: 'winterlauncher_minecraft',
            smallImageText: 'Minecraft',
            instance: false,
            buttons: [
                {
                    label: 'Download WinterLauncher',
                    url: gitUrl
                }
            ]
        };

        this.setActivity(activity);
    }

    setPlayingActivity(version, variant, username) {
        if (!this.isConnected) return;

        const activity = {
            details: `Playing Minecraft ${version}`,
            state: `as ${username} (${variant})`,
            startTimestamp: Date.now(),
            largeImageKey: 'winterlauncher_minecraft',
            largeImageText: `Minecraft ${version}`,
            smallImageKey: 'winterlauncher_logo',
            smallImageText: `WinterLauncher v${app.getVersion()}`,
            instance: false,
            buttons: [
                {
                    label: 'Download WinterLauncher',
                    url: gitUrl
                }
            ]
        };

        this.setActivity(activity);
    }

    setDownloadingActivity(progress, version) {
        if (!this.isConnected) return;

        const activity = {
            details: `Downloading Minecraft ${version}`,
            state: `${Math.round(progress)}% complete`,
            startTimestamp: this.startTime,
            largeImageKey: 'winterlauncher_logo',
            largeImageText: `WinterLauncher v${app.getVersion()}`,
            smallImageKey: 'winterlauncher_download',
            smallImageText: 'Downloading',
            instance: false,
        };

        this.setActivity(activity);
    }

    async setActivity(activity) {
        if (!this.isConnected || !this.client) return;

        try {
            await this.client.setActivity(activity);
            this.currentActivity = activity;
        } catch (error) {
            console.error('Failed to set Discord activity:', error);
        }
    }

    async clearActivity() {
        if (!this.isConnected || !this.client) return;

        try {
            await this.client.clearActivity();
            this.currentActivity = null;
        } catch (error) {
            console.error('Failed to clear Discord activity:', error);
        }
    }

    getStatus() {
        return {
            isConnected: this.isConnected,
            currentActivity: this.currentActivity
        };
    }
}

// Export singleton instance
export const discordRPC = new DiscordRPCService();