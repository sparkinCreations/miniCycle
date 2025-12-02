/**
 * Global Error Handler
 *
 * Catches and handles all unhandled errors and promise rejections.
 * Provides user-friendly notifications and debug logging.
 *
 * @module modules/utils/errorHandler
 * @version 1.389
 * @created November 13, 2025
 */

class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.maxErrorsBeforeSilence = 10; // Prevent notification spam
        this.errorLog = [];
        this.maxLogSize = 50;

        this.setupGlobalHandlers();
    }

    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        // Catch all synchronous errors
        window.onerror = (message, source, lineno, colno, error) => {
            this.handleError({
                type: 'window.onerror',
                message,
                source,
                lineno,
                colno,
                error,
                stack: error?.stack
            });

            // Return false to allow default error handling (console.error)
            return false;
        };

        // Catch all unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'unhandledrejection',
                message: event.reason?.message || event.reason,
                error: event.reason,
                stack: event.reason?.stack
            });

            // Prevent default handling (we've logged it)
            event.preventDefault();
        });

        console.log('🛡️ Global error handlers initialized');
    }

    /**
     * Handle an error and notify user
     */
    handleError(errorInfo) {
        this.errorCount++;

        // Log to console
        console.error(`[ErrorHandler] ${errorInfo.type}:`, errorInfo);

        // Add to error log
        this.addToLog(errorInfo);

        // Show user notification (but prevent spam)
        if (this.errorCount <= this.maxErrorsBeforeSilence) {
            this.showUserNotification(errorInfo);
        } else if (this.errorCount === this.maxErrorsBeforeSilence + 1) {
            // Show final warning
            if (typeof window.showNotification === 'function') {
                window.showNotification(
                    'Multiple errors detected. Further error notifications will be suppressed. Check the console for details.',
                    'error'
                );
            }
        }

        // For critical errors, suggest export
        if (this.isCriticalError(errorInfo)) {
            this.suggestDataExport(errorInfo);
        }
    }

    /**
     * Add error to log with timestamp
     */
    addToLog(errorInfo) {
        this.errorLog.push({
            timestamp: new Date().toISOString(),
            ...errorInfo
        });

        // Trim log if too large
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog.shift();
        }
    }

    /**
     * Show user-friendly notification
     */
    showUserNotification(errorInfo) {
        if (typeof window.showNotification !== 'function') {
            return;
        }

        let message = 'An unexpected error occurred.';

        // Customize message based on error type
        if (errorInfo.message) {
            const msg = String(errorInfo.message).toLowerCase();

            if (msg.includes('quota') || msg.includes('storage')) {
                message = 'Storage quota exceeded. Please export your data and clear some space.';
            } else if (msg.includes('network') || msg.includes('fetch')) {
                message = 'Network error. Please check your connection.';
            } else if (msg.includes('syntax') || msg.includes('parse')) {
                message = 'Data corruption detected. Your data may need to be restored from backup.';
            } else if (msg.includes('permission') || msg.includes('denied')) {
                message = 'Permission denied. Please check your browser settings.';
            } else {
                // Generic error message
                message = 'An unexpected error occurred. The app will try to continue.';
            }
        }

        window.showNotification(message, 'error');
    }

    /**
     * Check if error is critical (data loss risk)
     */
    isCriticalError(errorInfo) {
        const msg = String(errorInfo.message || '').toLowerCase();
        return (
            msg.includes('quota') ||
            msg.includes('storage') ||
            msg.includes('syntax') ||
            msg.includes('parse') ||
            msg.includes('corrupted')
        );
    }

    /**
     * Suggest data export for critical errors
     */
    suggestDataExport(errorInfo) {
        setTimeout(() => {
            if (typeof window.showNotification === 'function') {
                window.showNotification(
                    'Critical error detected. We recommend exporting your data as backup. Go to Settings → Import/Export.',
                    'warning'
                );
            }
        }, 2000); // Delay to avoid notification spam
    }

    /**
     * Get error statistics
     */
    getStats() {
        return {
            totalErrors: this.errorCount,
            recentErrors: this.errorLog.length,
            errorLog: this.errorLog
        };
    }

    /**
     * Reset error counter (useful for testing)
     */
    reset() {
        this.errorCount = 0;
        this.errorLog = [];
    }

    /**
     * Export error log as text (for debugging)
     */
    exportErrorLog() {
        return this.errorLog.map(err => {
            return `[${err.timestamp}] ${err.type}: ${err.message}\n${err.stack || 'No stack trace'}\n`;
        }).join('\n---\n\n');
    }
}

// Create singleton instance
const errorHandler = new ErrorHandler();

// Phase 2 Step 5 - Clean exports (no window.* pollution)
console.log('🛡️ ErrorHandler module loaded (Phase 2 - no window.* exports)');

export default errorHandler;
