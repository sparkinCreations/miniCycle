/**
 * ==========================================
 * 🎯 CONSOLE CAPTURE MODULE FOR MIGRATIONS
 * ==========================================
 *
 * Provides enhanced console logging and capture functionality
 * specifically designed for debugging migration processes.
 *
 * @module consoleCapture
 * @version 1.344
 */

export class MiniCycleConsoleCapture {
    constructor(dependencies = {}) {
        this.consoleLogBuffer = [];
        this.originalConsole = {};
        this.consoleCapturing = false;
        this.autoStarted = false;
        this.captureInterval = null;

        // Store injected dependencies
        this._injectedDeps = dependencies;

        // Dependency injection with runtime fallbacks for testability
        // Using getters so tests can mock window functions after construction
        Object.defineProperty(this, 'deps', {
            get: () => ({
                showNotification: this._injectedDeps.showNotification || window.showNotification || this.fallbackNotification.bind(this)
            })
        });

        // Auto-start if conditions are met
        if (this.shouldAutoStartConsoleCapture()) {
            this.startAutoConsoleCapture();
        }
    }

    /**
     * Fallback notification (console only)
     */
    fallbackNotification(message, type = 'info', duration = 3000) {
        // Use original console to avoid recursion
        if (this.originalConsole.log) {
            this.originalConsole.log(`[ConsoleCapture] ${type.toUpperCase()}: ${message}`);
        } else {
            console.log(`[ConsoleCapture] ${type.toUpperCase()}: ${message}`);
        }
    }

    // Check if we should auto-start console capture
    shouldAutoStartConsoleCapture() {
        // Auto-start if:
        // 1. We have old schema data (migration might happen)
        // 2. OR we're in development/testing mode
        // 3. OR migration is explicitly enabled
        const hasOldData = localStorage.getItem("miniCycleStorage") && !localStorage.getItem("miniCycleData");
        const isTestingMode = localStorage.getItem("miniCycle_enableAutoConsoleCapture") === "true";
        const migrationMode = sessionStorage.getItem('miniCycleLegacyModeActive') === 'true';
        
        return hasOldData || isTestingMode || migrationMode;
    }

    // Enhanced console capture that works across page refreshes
    startAutoConsoleCapture() {
        if (this.consoleCapturing || this.autoStarted) return;
        
        this.autoStarted = true;
        this.consoleCapturing = true;
        this.consoleLogBuffer = [];
        
        // Load any existing buffer from previous sessions
        try {
            const storedBuffer = localStorage.getItem("miniCycle_capturedConsoleBuffer");
            if (storedBuffer) {
                const storedLogs = JSON.parse(storedBuffer);
                this.consoleLogBuffer = Array.isArray(storedLogs) ? storedLogs : [];
                console.log(`🔄 Restored ${this.consoleLogBuffer.length} previous console messages`);
            }
        } catch (e) {
            console.warn("⚠️ Could not restore previous console buffer");
        }
        
        // Store original console methods
        this.originalConsole = {
            log: console.log,
            error: console.error,
            warn: console.warn,
            info: console.info,
            debug: console.debug,
            table: console.table
        };
        
        // Enhanced console override with better formatting and filtering
        console.log = (...args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = this.formatConsoleArgs(args);
            const logEntry = `[${timestamp}] 📝 LOG: ${message}`;
            
            this.consoleLogBuffer.push(logEntry);
            this.keepBufferManageable();
            this.originalConsole.log.apply(console, args);
        };
        
        console.error = (...args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = this.formatConsoleArgs(args);
            const logEntry = `[${timestamp}] ❌ ERROR: ${message}`;
            
            this.consoleLogBuffer.push(logEntry);
            this.keepBufferManageable();
            this.originalConsole.error.apply(console, args);
        };
        
        console.warn = (...args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = this.formatConsoleArgs(args);
            const logEntry = `[${timestamp}] ⚠️ WARN: ${message}`;
            
            this.consoleLogBuffer.push(logEntry);
            this.keepBufferManageable();
            this.originalConsole.warn.apply(console, args);
        };
        
        console.info = (...args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = this.formatConsoleArgs(args);
            const logEntry = `[${timestamp}] ℹ️ INFO: ${message}`;
            
            this.consoleLogBuffer.push(logEntry);
            this.keepBufferManageable();
            this.originalConsole.info.apply(console, args);
        };
        
        console.table = (...args) => {
            const timestamp = new Date().toLocaleTimeString();
            const message = this.formatConsoleArgs(args);
            const logEntry = `[${timestamp}] 📊 TABLE: ${message}`;
            
            this.consoleLogBuffer.push(logEntry);
            this.keepBufferManageable();
            this.originalConsole.table.apply(console, args);
        };
        
        console.log("🎯 Enhanced console capture started - monitoring migration activity with detailed logging");
        
        // Store captured logs in localStorage periodically
        this.captureInterval = setInterval(() => {
            if (this.consoleLogBuffer.length > 0) {
                this.saveBufferToStorage();
            }
        }, 2000);
    }

    // Keep buffer size manageable (last 500 messages)
    keepBufferManageable() {
        if (this.consoleLogBuffer.length > 500) {
            this.consoleLogBuffer = this.consoleLogBuffer.slice(-500);
        }
    }

    // Save buffer to storage with error handling
    saveBufferToStorage() {
        try {
            localStorage.setItem("miniCycle_capturedConsoleBuffer", JSON.stringify(this.consoleLogBuffer));
        } catch (e) {
            // Storage might be full, remove old entries
            if (this.consoleLogBuffer.length > 100) {
                this.consoleLogBuffer = this.consoleLogBuffer.slice(-100);
                try {
                    localStorage.setItem("miniCycle_capturedConsoleBuffer", JSON.stringify(this.consoleLogBuffer));
                } catch (e2) {
                    console.warn("⚠️ Unable to save console buffer to localStorage");
                }
            }
        }
    }

    // Helper function to format console arguments
    formatConsoleArgs(args) {
        return args.map(arg => {
            if (typeof arg === 'object') {
                try {
                    if (arg === null) return 'null';
                    if (arg === undefined) return 'undefined';
                    if (arg instanceof Error) return `${arg.name}: ${arg.message}`;
                    if (Array.isArray(arg)) return `[${arg.length} items]: ${JSON.stringify(arg).substring(0, 100)}${arg.length > 3 ? '...' : ''}`;
                    
                    const str = JSON.stringify(arg, null, 2);
                    return str.length > 200 ? str.substring(0, 200) + '...' : str;
                } catch (e) {
                    return '[Object - could not stringify]';
                }
            }
            return String(arg);
        }).join(' ');
    }

    // Enhanced stop function
    stopConsoleCapture() {
        if (!this.consoleCapturing) return;
        
        // Restore original console methods
        console.log = this.originalConsole.log;
        console.error = this.originalConsole.error;
        console.warn = this.originalConsole.warn;
        console.info = this.originalConsole.info;
        console.debug = this.originalConsole.debug;
        console.table = this.originalConsole.table;
        
        // Clear interval
        if (this.captureInterval) {
            clearInterval(this.captureInterval);
            this.captureInterval = null;
        }
        
        this.consoleCapturing = false;
        this.autoStarted = false;
        
        // Clear the stored buffer
        localStorage.removeItem("miniCycle_capturedConsoleBuffer");
        
        console.log("⏹️ Enhanced console capture stopped - all logging restored to normal");
    }

    // Enhanced log display with better filtering and search
    showAllCapturedLogs() {
        let allLogs = [...this.consoleLogBuffer];
        
        // Also try to get any stored logs from localStorage
        const storedBuffer = localStorage.getItem("miniCycle_capturedConsoleBuffer");
        if (storedBuffer) {
            try {
                const storedLogs = JSON.parse(storedBuffer);
                storedLogs.forEach(log => {
                    if (!allLogs.some(existingLog => existingLog === log)) {
                        allLogs.push(log);
                    }
                });
            } catch (e) {
                console.warn("Could not parse stored console buffer");
            }
        }
        
        if (!allLogs.length) {
            this.appendToTestResults("📭 No console messages captured yet.\n\n");
            return;
        }
        
        // Sort by timestamp
        allLogs.sort((a, b) => {
            const timeA = a.match(/\[(.*?)\]/)?.[1] || '';
            const timeB = b.match(/\[(.*?)\]/)?.[1] || '';
            return timeA.localeCompare(timeB);
        });
        
        this.appendToTestResults("📊 ALL CAPTURED CONSOLE MESSAGES:\n");
        this.appendToTestResults("==========================================\n");
        this.appendToTestResults(`📅 Capture Period: ${allLogs.length > 0 ? allLogs[0].match(/\[(.*?)\]/)?.[1] || 'Unknown' : 'N/A'} - ${allLogs.length > 0 ? allLogs[allLogs.length - 1].match(/\[(.*?)\]/)?.[1] || 'Unknown' : 'N/A'}\n`);
        this.appendToTestResults(`🔢 Total Messages: ${allLogs.length}\n`);
        this.appendToTestResults("==========================================\n\n");
        
        // Group by type for better organization
        const logTypes = {
            'ERROR': allLogs.filter(log => log.includes('❌ ERROR:')),
            'WARN': allLogs.filter(log => log.includes('⚠️ WARN:')),
            'INFO': allLogs.filter(log => log.includes('ℹ️ INFO:')),
            'LOG': allLogs.filter(log => log.includes('📝 LOG:')),
            'TABLE': allLogs.filter(log => log.includes('📊 TABLE:'))
        };
        
        this.appendToTestResults("📈 MESSAGE BREAKDOWN:\n");
        Object.entries(logTypes).forEach(([type, logs]) => {
            if (logs.length > 0) {
                this.appendToTestResults(`  ${type}: ${logs.length} messages\n`);
            }
        });
        this.appendToTestResults("\n");
        
        // Display all messages
        allLogs.forEach((log, index) => {
            this.appendToTestResults(`${String(index + 1).padStart(3, '0')}. ${log}\n`);
        });
        
        this.appendToTestResults("\n==========================================\n");
        this.appendToTestResults(`📊 Console capture complete - ${allLogs.length} messages displayed\n\n`);

        this.deps.showNotification(`📊 Displayed ${allLogs.length} console messages with enhanced migration logging`, "success", 4000);
    }

    clearAllConsoleLogs() {
        this.consoleLogBuffer = [];
        localStorage.removeItem("miniCycle_capturedConsoleBuffer");
        this.appendToTestResults("🧹 All console logs cleared (including stored buffer)\n");
        this.appendToTestResults("✨ Ready to capture new migration activity\n\n");

        this.deps.showNotification("🧹 Console logs cleared - ready for new capture", "info", 2000);
    }

    // Enhanced error filtering with more sophisticated detection
    showMigrationErrorsOnly() {
        let allLogs = [...this.consoleLogBuffer];
        
        // Also get stored logs
        const storedBuffer = localStorage.getItem("miniCycle_capturedConsoleBuffer");
        if (storedBuffer) {
            try {
                const storedLogs = JSON.parse(storedBuffer);
                storedLogs.forEach(log => {
                    if (!allLogs.some(existingLog => existingLog === log)) {
                        allLogs.push(log);
                    }
                });
            } catch (e) {}
        }
        
        // Enhanced filtering for migration-related messages
        const migrationKeywords = [
            'migration', 'schema', 'backup', 'restore', 'fallback',
            'legacy', 'performSchema25Migration', 'checkMigrationNeeded',
            'handleMigrationFailure', 'createAutomaticMigrationBackup',
            'restoreFromAutomaticBackup', 'migrateTask', 'validateAllMiniCycleTasks'
        ];
        
        const errorMessages = allLogs.filter(log => {
            const logLower = log.toLowerCase();
            return (
                log.includes('❌ ERROR:') || 
                log.includes('⚠️ WARN:') ||
                migrationKeywords.some(keyword => logLower.includes(keyword.toLowerCase())) ||
                log.includes('🔄') ||
                log.includes('📥') ||
                log.includes('✅') ||
                log.includes('🚨')
            );
        });
        
        if (errorMessages.length === 0) {
            this.appendToTestResults("✅ No migration-related messages found!\n");
            this.appendToTestResults("This could mean:\n");
            this.appendToTestResults("  • No migration has run yet\n");
            this.appendToTestResults("  • Migration completed without logging\n");
            this.appendToTestResults("  • Console capture was not active during migration\n\n");
            return;
        }
        
        // Sort by timestamp
        errorMessages.sort((a, b) => {
            const timeA = a.match(/\[(.*?)\]/)?.[1] || '';
            const timeB = b.match(/\[(.*?)\]/)?.[1] || '';
            return timeA.localeCompare(timeB);
        });
        
        this.appendToTestResults("🚨 MIGRATION-RELATED MESSAGES:\n");
        this.appendToTestResults("==========================================\n");
        this.appendToTestResults(`📅 Time Range: ${errorMessages[0]?.match(/\[(.*?)\]/)?.[1] || 'N/A'} - ${errorMessages[errorMessages.length - 1]?.match(/\[(.*?)\]/)?.[1] || 'N/A'}\n`);
        this.appendToTestResults("==========================================\n\n");
        
        // Categorize messages
        const categories = {
            'Critical Errors': errorMessages.filter(log => log.includes('❌ ERROR:') || log.includes('🚨')),
            'Warnings': errorMessages.filter(log => log.includes('⚠️ WARN:')),
            'Migration Progress': errorMessages.filter(log => log.includes('🔄') && !log.includes('ERROR') && !log.includes('WARN')),
            'Backup Operations': errorMessages.filter(log => log.includes('📥') && !log.includes('ERROR') && !log.includes('WARN')),
            'Success Messages': errorMessages.filter(log => log.includes('✅') && !log.includes('ERROR') && !log.includes('WARN'))
        };
        
        Object.entries(categories).forEach(([category, messages]) => {
            if (messages.length > 0) {
                this.appendToTestResults(`\n📋 ${category.toUpperCase()} (${messages.length}):\n`);
                this.appendToTestResults("─".repeat(40) + "\n");
                messages.forEach((message, index) => {
                    this.appendToTestResults(`${String(index + 1).padStart(2, '0')}. ${message}\n`);
                });
            }
        });
        
        this.appendToTestResults("\n==========================================\n");
        this.appendToTestResults(`🔍 Analysis Complete: Found ${errorMessages.length} migration-related messages\n\n`);
        
        if (categories['Critical Errors'].length > 0) {
            this.appendToTestResults("🚨 ATTENTION: Critical errors detected! Review the error messages above.\n\n");
            this.deps.showNotification(`🚨 Found ${errorMessages.length} migration messages including ${categories['Critical Errors'].length} critical errors`, "error", 6000);
        } else if (categories['Warnings'].length > 0) {
            this.appendToTestResults("⚠️ Warnings found but no critical errors detected.\n\n");
            this.deps.showNotification(`⚠️ Found ${errorMessages.length} migration messages with ${categories['Warnings'].length} warnings`, "warning", 4000);
        } else {
            this.appendToTestResults("✅ No critical errors found in migration messages.\n\n");
            this.deps.showNotification(`📊 Found ${errorMessages.length} migration messages - no critical errors`, "success", 4000);
        }
    }

    // Helper to interact with testing modal
    appendToTestResults(text) {
        if (typeof window.appendToTestResults === 'function') {
            window.appendToTestResults(text);
        } else {
            console.log('Testing Results:', text);
        }
    }

    // Helper function to get console capture stats
    getConsoleCaptureStats() {
        return {
            capturing: this.consoleCapturing,
            bufferSize: this.consoleLogBuffer.length,
            autoStarted: this.autoStarted,
            hasStoredBuffer: !!localStorage.getItem("miniCycle_capturedConsoleBuffer")
        };
    }
}

// Auto-create instance and make globally accessible
const consoleCapture = new MiniCycleConsoleCapture();

// Export individual functions for backward compatibility
export const {
    showAllCapturedLogs: showAllCapturedLogs,
    clearAllConsoleLogs: clearAllConsoleLogs,
    showMigrationErrorsOnly: showMigrationErrorsOnly,
    getConsoleCaptureStats: getConsoleCaptureStats,
    stopConsoleCapture: stopConsoleCapture,
    startAutoConsoleCapture: startAutoConsoleCapture
} = consoleCapture;

// Make functions globally accessible
window.showAllCapturedLogs = () => consoleCapture.showAllCapturedLogs();
window.clearAllConsoleLogs = () => consoleCapture.clearAllConsoleLogs();
window.showMigrationErrorsOnly = () => consoleCapture.showMigrationErrorsOnly();
window.getConsoleCaptureStats = () => consoleCapture.getConsoleCaptureStats();
window.stopConsoleCapture = () => consoleCapture.stopConsoleCapture();

export default consoleCapture;