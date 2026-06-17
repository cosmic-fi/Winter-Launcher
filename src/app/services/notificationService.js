// @ts-nocheck
import { get } from 'svelte/store';
import { settings } from '../stores/settings';
import { showToast } from '../stores/ui';
import { t } from '../stores/i18n';

export class NotificationService {
    constructor() {
        this.audio = null;
        this.notificationHistory = [];
        this.maxHistorySize = 50;
        this.currentT = () => {}; // Initial empty function
        this.unsubscribeT = t.subscribe(newT => {
            this.currentT = newT;
        });
    }

    async initialize() {
        // Request notification permission
        if ('Notification' in window && Notification.permission === 'default') {
            await Notification.requestPermission();
        }
    }
    
    async showNotification(options) {
        const {
            title,
            message,
            type = 'info',
            category = 'general',
            priority = 'normal',
            showToastOnly = false,
            showSystemOnly = false,
            duration = 3000,
            actions = [],
            icon = null
        } = options;

        const currentSettings = get(settings);
        const systemNotificationsEnabled = currentSettings?.launcher?.notification?.updateNotification?.value;

        // Add to history
        this.addToHistory({ title, message, type, category, priority, timestamp: Date.now() });

        // Show toast notification (unless system-only)
        if (!showSystemOnly) {
            showToast(message, type, duration);
        }

        // Show system notification (unless toast-only)
        if (!showToastOnly && systemNotificationsEnabled && 'Notification' in window && Notification.permission === 'granted') {
            await this.showSystemNotification({ title, message, type, icon, actions });
        }

        // This ensures only our custom sound plays, not the Windows default
        await this.playSound();
    }

    async showSystemNotification({ title, message, type, icon, actions }) {
        try {
            // Use the Electron main process for system notifications with silent: true
            if (window.electron && window.electron.showSystemNotification) {
                await window.electron.showSystemNotification({
                    title,
                    body: message,
                    icon: icon || this.getIconForType(type),
                    actions: actions,
                    silent: true // Disable default Windows notification sound
                });
            } else {
                // Fallback to web Notification API with silent option
                const notification = new Notification(title, {
                    body: message,
                    icon: icon || this.getIconForType(type),
                    badge: '/icons/default.png',
                    tag: `ori-launcher-${type}`,
                    requireInteraction: type === 'error',
                    actions: actions,
                    silent: true // Disable default notification sound
                });

                // Auto-close after 5 seconds (except for errors)
                if (type !== 'error') {
                    setTimeout(() => notification.close(), 5000);
                }
            }

            return { success: true };
        } catch (error) {
            console.warn('Failed to show system notification:', error);
            return { success: false, error: error.message };
        }
    }

    getIconForType(type) {
        const icons = {
            success: '/icons/default.png',
            info: '/icons/default.png',
            warning: '/icons/default.png',
            error: '/icons/default.png'
        };
        return icons[type] || icons.info;
    }

    addToHistory(notification) {
        this.notificationHistory.unshift(notification);
        if (this.notificationHistory.length > this.maxHistorySize) {
            this.notificationHistory = this.notificationHistory.slice(0, this.maxHistorySize);
        }
    }

    getHistory() {
        return this.notificationHistory;
    }

    clearHistory() {
        this.notificationHistory = [];
    }

    // Predefined notification methods for common scenarios
    async showUpdateAvailable(version) {
        await this.showNotification({
            title: this.currentT('notifications.updateAvailable'),
            message: this.currentT('notifications.updateAvailableMessage', { version: this.currentT('version', { version }) }),
            type: 'info',
            category: 'update',
            priority: 'normal',
            actions: [
                { action: 'update', title: this.currentT('notifications.updateNow') },
                { action: 'later', title: this.currentT('notifications.later') }
            ]
        });
    }

    async showLaunchSuccess(version) {
        await this.showNotification({
            title: this.currentT('notifications.gameLaunched'),
            message: this.currentT('notifications.gameLaunchedMessage', { version: this.currentT('version', { version }) }),
            type: 'success',
            category: 'launch',
            priority: 'low',
            duration: 2000
        });
    }

    async showLaunchError(error) {
        await this.showNotification({
            title: this.currentT('notifications.launchFailed'),
            message: this.currentT('notifications.launchFailedMessage'),
            type: 'error',
            category: 'launch',
            priority: 'high'
        });
    }

    async showDownloadComplete(item) {
        await this.showNotification({
            title: this.currentT('notifications.downloadComplete'),
            message: this.currentT('notifications.downloadCompleteMessage', { item }),
            type: 'success',
            category: 'download',
            priority: 'normal'
        });
    }

    async showConnectionLost() {
        await this.showNotification({
            title: this.currentT('notifications.connectionLost'),
            message: this.currentT('notifications.connectionLostMessage'),
            type: 'warning',
            category: 'general',
            priority: 'normal'
        });
    }

    async showConnectionRestored() {
        await this.showNotification({
            title: this.currentT('notifications.connectionRestored'),
            message: this.currentT('notifications.connectionRestoredMessage'),
            type: 'success',
            category: 'general',
            priority: 'low',
            duration: 2000
        });
    }
}

export const notificationService = new NotificationService();