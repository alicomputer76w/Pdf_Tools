/**
 * Comprehensive Error Handler for PDF Tools Suite
 * Provides centralized error handling, logging, and user feedback
 */

class ErrorHandler {
    constructor() {
        if (ErrorHandler.instance) {
            return ErrorHandler.instance;
        }
        
        this.errorLog = [];
        this.maxLogSize = 100;
        this.debugMode = false;
        this.setupGlobalErrorHandlers();
        
        ErrorHandler.instance = this;
    }

    static getInstance() {
        if (!ErrorHandler.instance) {
            new ErrorHandler();
        }
        return ErrorHandler.instance;
    }

    setupGlobalErrorHandlers() {
        // Global JavaScript error handler
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'JavaScript Error',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                stack: event.error?.stack
            });
        });

        // Unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'Unhandled Promise Rejection',
                message: event.reason?.message || 'Promise rejected',
                error: event.reason,
                stack: event.reason?.stack
            });
        });

        // Resource loading errors
        window.addEventListener('error', (event) => {
            if (event.target !== window) {
                this.handleError({
                    type: 'Resource Loading Error',
                    message: `Failed to load: ${event.target.src || event.target.href}`,
                    element: event.target.tagName,
                    source: event.target.src || event.target.href
                });
            }
        }, true);
    }

    handleError(errorInfo, context = {}) {
        const errorEntry = {
            id: this.generateErrorId(),
            timestamp: new Date().toISOString(),
            type: errorInfo.type || 'Unknown Error',
            message: errorInfo.message || 'An unknown error occurred',
            stack: errorInfo.stack,
            context: context,
            userAgent: navigator.userAgent,
            url: window.location.href,
            severity: this.determineSeverity(errorInfo)
        };

        // Add to error log
        this.addToLog(errorEntry);

        // Log to console in debug mode
        if (this.debugMode) {
            console.error('Error Handler:', errorEntry);
        }

        // Show user notification based on severity
        this.notifyUser(errorEntry);

        // Send to analytics if available
        this.sendToAnalytics(errorEntry);

        return errorEntry;
    }

    addToLog(errorEntry) {
        this.errorLog.unshift(errorEntry);
        
        // Maintain log size limit
        if (this.errorLog.length > this.maxLogSize) {
            this.errorLog = this.errorLog.slice(0, this.maxLogSize);
        }

        // Store in localStorage for persistence
        try {
            localStorage.setItem('pdftools_error_log', JSON.stringify(this.errorLog.slice(0, 10)));
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    determineSeverity(errorInfo) {
        const message = errorInfo.message?.toLowerCase() || '';
        const type = errorInfo.type?.toLowerCase() || '';

        // Critical errors
        if (type.includes('security') || 
            message.includes('permission') ||
            message.includes('cors') ||
            type.includes('network')) {
            return 'critical';
        }

        // High severity errors
        if (type.includes('syntax') ||
            type.includes('reference') ||
            message.includes('undefined') ||
            message.includes('null')) {
            return 'high';
        }

        // Medium severity errors
        if (type.includes('validation') ||
            message.includes('invalid') ||
            message.includes('format')) {
            return 'medium';
        }

        // Low severity (warnings, info)
        return 'low';
    }

    notifyUser(errorEntry) {
        if (!window.notificationManager) return;

        const userMessage = this.getUserFriendlyMessage(errorEntry);
        
        switch (errorEntry.severity) {
            case 'critical':
                notificationManager.error(userMessage, {
                    persistent: true,
                    details: 'Please refresh the page and try again. If the problem persists, contact support.',
                    actions: [
                        { id: 'refresh', label: 'Refresh Page' },
                        { id: 'report', label: 'Report Issue' }
                    ]
                });
                break;
                
            case 'high':
                notificationManager.error(userMessage, {
                    duration: 8000,
                    details: 'This operation could not be completed.',
                    actions: [
                        { id: 'retry', label: 'Try Again' }
                    ]
                });
                break;
                
            case 'medium':
                notificationManager.warning(userMessage, {
                    duration: 6000
                });
                break;
                
            case 'low':
                // Only show in debug mode
                if (this.debugMode) {
                    notificationManager.info(userMessage, {
                        duration: 4000
                    });
                }
                break;
        }
    }

    getUserFriendlyMessage(errorEntry) {
        const message = errorEntry.message.toLowerCase();
        
        // File-related errors
        if (message.includes('file') && message.includes('size')) {
            return 'The selected file is too large. Please choose a smaller file.';
        }
        
        if (message.includes('file') && message.includes('type')) {
            return 'The selected file type is not supported. Please choose a valid PDF or image file.';
        }
        
        if (message.includes('file') && message.includes('corrupt')) {
            return 'The selected file appears to be corrupted. Please try a different file.';
        }

        // PDF-specific errors
        if (message.includes('pdf') && message.includes('password')) {
            return 'This PDF is password protected. Please provide the correct password.';
        }
        
        if (message.includes('pdf') && message.includes('permission')) {
            return 'This PDF has restrictions that prevent the requested operation.';
        }

        // Network errors
        if (message.includes('network') || message.includes('fetch')) {
            return 'Network connection issue. Please check your internet connection and try again.';
        }

        // Memory errors
        if (message.includes('memory') || message.includes('out of')) {
            return 'Not enough memory to complete this operation. Try with a smaller file.';
        }

        // Generic processing errors
        if (message.includes('process') || message.includes('convert')) {
            return 'Unable to process the file. Please try again or use a different file.';
        }

        // Default message
        return 'An unexpected error occurred. Please try again.';
    }

    sendToAnalytics(errorEntry) {
        // Only send non-sensitive error data
        if (window.analytics && typeof window.analytics.track === 'function') {
            try {
                window.analytics.track('Error Occurred', {
                    errorType: errorEntry.type,
                    severity: errorEntry.severity,
                    errorId: errorEntry.id,
                    timestamp: errorEntry.timestamp,
                    // Don't send full stack traces or sensitive data
                    hasStack: !!errorEntry.stack,
                    context: errorEntry.context?.tool || 'unknown'
                });
            } catch (e) {
                // Ignore analytics errors
            }
        }
    }

    generateErrorId() {
        return `err_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    // Public methods for manual error reporting
    static logError(error, context = {}, severity = 'medium') {
        const handler = ErrorHandler.getInstance();
        return handler.handleError({
            type: 'Manual Error',
            message: error.message || error.toString(),
            stack: error.stack,
            error: error
        }, { ...context, manual: true });
    }

    static logWarning(message, context = {}) {
        const handler = ErrorHandler.getInstance();
        return handler.handleError({
            type: 'Warning',
            message: message
        }, { ...context, severity: 'low' });
    }

    static logInfo(message, context = {}) {
        const handler = ErrorHandler.getInstance();
        return handler.handleError({
            type: 'Info',
            message: message
        }, { ...context, severity: 'low' });
    }

    // Utility methods
    getErrorLog() {
        return [...this.errorLog];
    }

    clearErrorLog() {
        this.errorLog = [];
        try {
            localStorage.removeItem('pdftools_error_log');
        } catch (e) {
            // Ignore localStorage errors
        }
    }

    setDebugMode(enabled) {
        this.debugMode = enabled;
        console.log(`Debug mode ${enabled ? 'enabled' : 'disabled'}`);
    }

    exportErrorLog() {
        const logData = {
            timestamp: new Date().toISOString(),
            userAgent: navigator.userAgent,
            url: window.location.href,
            errors: this.errorLog
        };

        const blob = new Blob([JSON.stringify(logData, null, 2)], {
            type: 'application/json'
        });

        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `pdf-tools-error-log-${Date.now()}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }
}

// Initialize error handler
document.addEventListener('DOMContentLoaded', () => {
    window.errorHandler = new ErrorHandler();
    
    // Enable debug mode in development
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        window.errorHandler.setDebugMode(true);
    }
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ErrorHandler;
}