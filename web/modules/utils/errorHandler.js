/**
 * Global Error Handler (DI-Pure)
 *
 * Catches and handles all unhandled errors and promise rejections.
 * Provides user-friendly notifications and debug logging.
 *
 * Note: window.onerror and window.addEventListener are browser APIs,
 * not dependencies - they cannot be injected.
 *
 * @module modules/utils/errorHandler
 * @created November 13, 2025
 */

import { createDIModule, optional } from '../core/diBase.js';
import { LIMITS } from '../core/constants.js';
import { getLabel } from '../labels/labelResolver.js';

// ============================================================================
// DEPENDENCY INJECTION SETUP
// ============================================================================

/**
 * @typedef {Object} ErrorHandlerDeps
 * @property {Function} [showNotification] - Function to show user notifications
 */

const di = createDIModule('ErrorHandler', {
    showNotification: optional(null)
});

/**
 * Set dependencies for ErrorHandler (call after notifications module loads)
 * @param {ErrorHandlerDeps} dependencies - { showNotification }
 */
export const setErrorHandlerDependencies = (dependencies) => di.setDependencies(dependencies);

// ============================================================================
// ERROR HANDLER CLASS
// ============================================================================

class ErrorHandler {
    constructor() {
        this.errorCount = 0;
        this.maxErrorsBeforeSilence = LIMITS.MAX_ERRORS_BEFORE_SILENCE;
        this.errorLog = [];
        this.maxLogSize = LIMITS.ERROR_LOG;

        this.setupGlobalHandlers();
    }

    /**
     * Get current dependencies
     * @returns {ErrorHandlerDeps}
     */
    get deps() {
        return di.resolve();
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
            const reason = event.reason;
            let message = 'Unknown rejection';

            // Debug: log the raw reason to help identify source
            console.warn('🔍 Unhandled rejection raw reason:', reason);
            console.warn('🔍 Rejection type:', typeof reason, reason?.constructor?.name);
            if (reason instanceof Error) {
                console.warn('🔍 Error message:', reason.message);
                console.warn('🔍 Error stack:', reason.stack);
            }

            if (reason instanceof Error) {
                message = reason.message;
            } else if (typeof reason === 'string') {
                message = reason;
            } else if (reason && typeof reason === 'object') {
                // Try to extract useful info from object
                message = reason.message || reason.error || reason.reason ||
                          (Object.keys(reason).length > 0 ? JSON.stringify(reason) : 'Empty object rejection');
            }

            this.handleError({
                type: 'unhandledrejection',
                message,
                error: reason,
                stack: reason?.stack
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
            const { showNotification } = this.deps;
            if (typeof showNotification === 'function') {
                showNotification(
                    getLabel('notify.errorMultipleSuppressed'),
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
        const { showNotification } = this.deps;
        if (typeof showNotification !== 'function') {
            return;
        }

        let message = getLabel('notify.errorUnexpected');

        // Customize message based on error type
        if (errorInfo.message) {
            const msg = String(errorInfo.message).toLowerCase();

            if (msg.includes('quota') || msg.includes('storage')) {
                message = getLabel('notify.errorStorageQuota');
            } else if (msg.includes('network') || msg.includes('fetch')) {
                message = getLabel('notify.errorNetwork');
            } else if (msg.includes('syntax') || msg.includes('parse')) {
                message = getLabel('notify.errorDataCorruption');
            } else if (msg.includes('permission') || msg.includes('denied')) {
                message = getLabel('notify.errorPermission');
            } else {
                // Generic error message
                message = getLabel('notify.errorUnexpectedContinue');
            }
        }

        showNotification(message, 'error');
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
            const { showNotification } = this.deps;
            if (typeof showNotification === 'function') {
                showNotification(
                    getLabel('notify.errorCriticalExport'),
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

// Named export (preferred over default export)
export { errorHandler };

console.log('📦 ErrorHandler module loaded (using diBase)');
