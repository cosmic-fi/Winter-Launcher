// @ts-nocheck
// Enhanced Console Window JavaScript

class EnhancedConsole {
    constructor() {
        this.logs = [];
        this.filteredLogs = [];
        this.logLevelFilter = 'all';
        this.searchFilter = '';
        this.autoScroll = true;
        this.maxLogs = 10000;
        this.isConnected = false;
        
        this.initializeElements();
        this.setupEventListeners();
        this.connectToMainProcess();
        this.setupKeyboardShortcuts();
        this.startStatusUpdates();
        this.initializeIcons();
    }

    initializeIcons() {
        if (window.lucide) {
            window.lucide.createIcons();
        }
    }

    initializeElements() {
        this.consoleLogs = document.getElementById('console-logs');
        this.clearBtn = document.getElementById('clear-btn');
        this.filterBtn = document.getElementById('filter-btn');
        this.exportBtn = document.getElementById('export-btn');
        this.autoScrollBtn = document.getElementById('auto-scroll-btn');
        this.closeBtn = document.getElementById('close-btn');
        this.filterBar = document.getElementById('filter-bar');
        this.logLevelSelect = document.getElementById('log-level-filter');
        this.searchInput = document.getElementById('search-filter');
        this.closeFilterBtn = document.getElementById('close-filter');
        this.logCount = document.getElementById('log-count');
        this.statusElement = document.getElementById('console-status');
    }

    setupEventListeners() {
        this.clearBtn.addEventListener('click', () => this.clearLogs());
        this.filterBtn.addEventListener('click', () => this.toggleFilterBar());
        this.exportBtn.addEventListener('click', () => this.exportLogs());
        this.autoScrollBtn.addEventListener('click', () => this.toggleAutoScroll());
        this.closeBtn.addEventListener('click', () => this.closeConsole());
        this.closeFilterBtn.addEventListener('click', () => this.toggleFilterBar());
        
        this.logLevelSelect.addEventListener('change', () => this.applyFilters());
        this.searchInput.addEventListener('input', () => this.applyFilters());
        
        // Auto-scroll detection
        this.consoleLogs.addEventListener('scroll', () => {
            const isAtBottom = this.consoleLogs.scrollHeight - this.consoleLogs.scrollTop <= this.consoleLogs.clientHeight + 50;
            if (this.autoScroll && !isAtBottom) {
                this.setAutoScroll(false);
            } else if (!this.autoScroll && isAtBottom) {
                this.setAutoScroll(true);
            }
        });
    }

    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'l':
                        e.preventDefault();
                        this.clearLogs();
                        break;
                    case 'f':
                        e.preventDefault();
                        this.toggleFilterBar();
                        break;
                    case 's':
                        e.preventDefault();
                        this.exportLogs();
                        break;
                    case 'r':
                        e.preventDefault();
                        this.reconnect();
                        break;
                }
            }
            
            if (e.key === 'Escape' && this.filterBar.style.display !== 'none') {
                this.toggleFilterBar();
            }
        });
    }

    connectToMainProcess() {
        console.log('connectToMainProcess called');
        console.log('window.electron available:', !!window.electron);
        console.log('window.electron.onConsoleData available:', !!(window.electron && window.electron.onConsoleData));
        
        if (window.electron && window.electron.onConsoleData) {
            // Listen for console data from main process
            const consoleDataCleanup = window.electron.onConsoleData((data) => {
                this.addLog(data);
            });

            // Store cleanup function for later
            this.consoleDataCleanup = consoleDataCleanup;

            this.isConnected = true;
            this.updateConnectionStatus('connected');
            this.addSystemLog('Console connected to main process');
        } else {
            this.addSystemLog('Electron API not available - running in development mode');
            this.updateConnectionStatus('disconnected');
        }
    }

    addLog(data) {
        // Handle different data types properly
        console.log('addLog called with data:', data);
        console.log('Current log level filter:', this.logLevelFilter);
        let message = '';
        let level = 'info';
        
        if (typeof data === 'object' && data !== null) {
            if (data.message) {
                message = data.message;
                level = data.level || 'info';
            } else if (data.error) {
                message = data.error;
                level = 'error';
            } else if (data.level === 'system' || data.type === 'system') {
                message = data.message || JSON.stringify(data, null, 2);
                level = 'system';
            } else if (data._events || data.sender) {
                // Handle sender objects that contain event emitters
                if (data.data && typeof data.data === 'string') {
                    message = data.data;
                } else if (data.message) {
                    message = data.message;
                } else {
                    // Filter out internal Node.js properties and show relevant data
                    const filteredData = {};
                    for (const key in data) {
                        if (key !== '_events' && key !== '_eventsCount' && key !== 'sender' && key !== 'ports') {
                            if (data[key] !== null && typeof data[key] !== 'function') {
                                filteredData[key] = data[key];
                            }
                        }
                    }
                    message = Object.keys(filteredData).length > 0 ? JSON.stringify(filteredData, null, 2) : 'Empty sender object';
                }
            } else {
                // Pretty print objects for better readability
                message = JSON.stringify(data, null, 2);
            }
        } else {
            message = data.toString();
        }

        const logEntry = {
            id: Date.now() + Math.random(),
            timestamp: new Date(),
            level: level,
            message: message,
            raw: data
        };

        this.logs.push(logEntry);
        
        // Limit log storage
        if (this.logs.length > this.maxLogs) {
            this.logs = this.logs.slice(-this.maxLogs);
        }

        this.renderLog(logEntry);
        this.updateLogCount();

        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    addSystemLog(message) {
        this.addLog({
            level: 'system',
            message: `[SYSTEM] ${message}`,
            timestamp: new Date()
        });
    }

    renderLog(logEntry) {
        console.log('renderLog called with:', logEntry);
        console.log('shouldShowLog result:', this.shouldShowLog(logEntry));
        if (this.shouldShowLog(logEntry)) {
            const logElement = this.createLogElement(logEntry);
            this.consoleLogs.appendChild(logElement);
            this.filteredLogs.push(logEntry);
        }
    }

    createLogElement(logEntry) {
        const div = document.createElement('div');
        div.className = `log-entry ${logEntry.level}`;
        div.setAttribute('data-level', logEntry.level);
        div.setAttribute('data-id', logEntry.id);

        const timestamp = logEntry.timestamp.toLocaleTimeString();
        const level = logEntry.level.toUpperCase();
        
        let message = this.escapeHtml(logEntry.message);
        
        // Highlight search terms
        if (this.searchFilter) {
            const regex = new RegExp(`(${this.escapeRegex(this.searchFilter)})`, 'gi');
            message = message.replace(regex, '<span class="highlight">$1</span>');
        }

        // Check if message already contains a timestamp (format: "HH:MM:SS" or "H:MM:SS AM/PM")
        const timestampPattern = /\b\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?\b/;
        const hasTimestamp = timestampPattern.test(message);

        div.innerHTML = `
            ${hasTimestamp ? '' : `<span class="log-timestamp">${timestamp}</span>`}
            <span class="log-message log-${logEntry.level.toLowerCase()}">${message}</span>
        `;
        console.log(logEntry)

        return div;
    }

    shouldShowLog(logEntry) {
        // Apply level filter - handle both uppercase and lowercase level names
        if (this.logLevelFilter !== 'all' && logEntry.level.toLowerCase() !== this.logLevelFilter.toLowerCase()) {
            return false;
        }

        // Apply search filter
        if (this.searchFilter && !logEntry.message.toLowerCase().includes(this.searchFilter.toLowerCase())) {
            return false;
        }

        return true;
    }

    applyFilters() {
        this.logLevelFilter = this.logLevelSelect.value;
        this.searchFilter = this.searchInput.value.toLowerCase();

        // Clear current display
        this.consoleLogs.innerHTML = '';
        this.filteredLogs = [];

        // Re-render filtered logs
        this.logs.forEach(logEntry => {
            if (this.shouldShowLog(logEntry)) {
                const logElement = this.createLogElement(logEntry);
                this.consoleLogs.appendChild(logElement);
                this.filteredLogs.push(logEntry);
            }
        });

        this.updateLogCount();

        if (this.autoScroll) {
            this.scrollToBottom();
        }
    }

    clearLogs() {
        this.logs = [];
        this.filteredLogs = [];
        this.consoleLogs.innerHTML = '';
        this.updateLogCount();
        this.addSystemLog('Console cleared');
    }

    exportLogs() {
        const content = this.generateLogExport();
        const blob = new Blob([content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = `winterlauncher-console-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.log`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        this.addSystemLog('Logs exported successfully');
    }

    generateLogExport() {
        return this.logs.map(log => {
            const timestamp = log.timestamp.toISOString();
            const level = log.level.toUpperCase();
            return `[${timestamp}] [${level}] ${log.message}`;
        }).join('\n');
    }

    toggleFilterBar() {
        const isVisible = this.filterBar.style.display !== 'none';
        this.filterBar.style.display = isVisible ? 'none' : 'flex';
        
        if (!isVisible) {
            this.searchInput.focus();
        }
    }

    toggleAutoScroll() {
        this.setAutoScroll(!this.autoScroll);
    }

    closeConsole() {
        // Close the console window
        if (window.electron && window.electron.closeConsoleWindow) {
            window.electron.closeConsoleWindow();
        } else {
            // Fallback: close the window directly
            window.close();
        }
    }

    setAutoScroll(enabled) {
        this.autoScroll = enabled;
        this.autoScrollBtn.classList.toggle('active', enabled);
        
        if (enabled) {
            this.scrollToBottom();
        }
    }

    scrollToBottom() {
        setTimeout(() => {
            this.consoleLogs.scrollTop = this.consoleLogs.scrollHeight;
        }, 10);
    }

    updateLogCount() {
        const total = this.logs.length;
        const filtered = this.filteredLogs.length;
        
        if (filtered === total) {
            this.logCount.textContent = `${total} entries`;
        } else {
            this.logCount.textContent = `${filtered} of ${total} entries`;
        }
    }

    updateConnectionStatus(status) {
        this.statusElement.textContent = status.charAt(0).toUpperCase() + status.slice(1);
        this.statusElement.className = `status-${status}`;
    }

    reconnect() {
        this.addSystemLog('Attempting to reconnect...');
        this.connectToMainProcess();
    }

    cleanup() {
        // Remove event listeners to prevent memory leaks
        if (this.consoleDataCleanup) {
            this.consoleDataCleanup();
            this.consoleDataCleanup = null;
        }
    }

    startStatusUpdates() {
        setInterval(() => {
            if (this.isConnected) {
                const memory = performance.memory;
                if (memory) {
                    const used = Math.round(memory.usedJSHeapSize / 1024 / 1024);
                    this.statusElement.textContent = `Connected • Memory: ${used}MB`;
                }
            }
        }, 5000);
    }

    // Utility functions
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    escapeRegex(string) {
        return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }
}

// Initialize the enhanced console when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.enhancedConsole = new EnhancedConsole();
    
    // Clean up when window is unloaded
    window.addEventListener('beforeunload', () => {
        if (window.enhancedConsole) {
            window.enhancedConsole.cleanup();
        }
    });
});