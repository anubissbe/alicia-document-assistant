/**
 * Global Error Handler for Document Writer
 */
class ErrorHandler {
    constructor() {
        this.errorLog = [];
        this.maxErrors = 100;
        this.setupHandlers();
    }
    
    setupHandlers() {
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.logError({
                type: 'unhandledRejection',
                error: event.reason,
                promise: event.promise,
                timestamp: new Date().toISOString()
            });
            
            // Prevent default browser handling
            event.preventDefault();
            
            // Show user-friendly message
            this.showUserError('An unexpected error occurred', event.reason);
        });
        
        // Handle global errors
        window.addEventListener('error', (event) => {
            this.logError({
                type: 'globalError',
                error: event.error,
                message: event.message,
                filename: event.filename,
                line: event.lineno,
                column: event.colno,
                timestamp: new Date().toISOString()
            });
            
            // Show user-friendly message in debug mode
            if (window.DEBUG_MODE) {
                this.showUserError('JavaScript Error', event.error || event.message);
            }
        });
        
        // Override console.error to capture all errors
        const originalConsoleError = console.error;
        console.error = (...args) => {
            this.logError({
                type: 'consoleError',
                args: args,
                timestamp: new Date().toISOString()
            });
            originalConsoleError.apply(console, args);
        };
    }
    
    logError(errorInfo) {
        // Add to error log
        this.errorLog.push(errorInfo);
        
        // Limit error log size
        if (this.errorLog.length > this.maxErrors) {
            this.errorLog.shift();
        }
        
        // Log to console in debug mode
        if (window.DEBUG_MODE) {
            console.log('%c[ERROR LOGGED]', 'color: #ff6b6b; font-weight: bold', errorInfo);
        }
        
        // Send to analytics or error tracking service (if configured)
        this.sendToAnalytics(errorInfo);
    }
    
    showUserError(title, error) {
        let message = title;
        
        if (error) {
            if (error.message) {
                message += ': ' + error.message;
            } else if (typeof error === 'string') {
                message += ': ' + error;
            }
        }
        
        // Use toast if available
        if (window.showToast) {
            window.showToast(message, 'error');
        } else {
            // Fallback to alert
            console.error(message);
            if (window.DEBUG_MODE) {
                alert(message);
            }
        }
    }
    
    sendToAnalytics(errorInfo) {
        // Placeholder for sending errors to analytics service
        // This could be integrated with services like Sentry, LogRocket, etc.
        if (window.DEBUG_MODE) {
            // In debug mode, just log that we would send this
            console.log('Would send error to analytics:', errorInfo);
        }
    }
    
    getErrorLog() {
        return this.errorLog;
    }
    
    clearErrorLog() {
        this.errorLog = [];
    }
    
    /**
     * Wrap a function with error handling
     */
    wrapFunction(fn, context = null, errorMessage = 'Operation failed') {
        return async function(...args) {
            try {
                return await fn.apply(context, args);
            } catch (error) {
                window.errorHandler.logError({
                    type: 'wrappedFunction',
                    functionName: fn.name || 'anonymous',
                    error: error,
                    args: args,
                    timestamp: new Date().toISOString()
                });
                
                window.errorHandler.showUserError(errorMessage, error);
                throw error; // Re-throw to maintain promise chain
            }
        };
    }
    
    /**
     * Create a safe version of a function that won't throw
     */
    safeFunction(fn, defaultReturn = null, context = null) {
        return function(...args) {
            try {
                return fn.apply(context, args);
            } catch (error) {
                window.errorHandler.logError({
                    type: 'safeFunction',
                    functionName: fn.name || 'anonymous',
                    error: error,
                    args: args,
                    timestamp: new Date().toISOString()
                });
                
                return defaultReturn;
            }
        };
    }
}

// Initialize error handler
window.errorHandler = new ErrorHandler();

// Export utility functions
window.wrapWithErrorHandling = window.errorHandler.wrapFunction.bind(window.errorHandler);
window.makeSafeFunction = window.errorHandler.safeFunction.bind(window.errorHandler);