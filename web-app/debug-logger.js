/**
 * Debug Logger for Document Writer
 * Provides server-side logging when debug mode is enabled
 */

class DebugLogger {
    constructor() {
        this.debugMode = process.env.NODE_ENV === 'debug' || process.argv.includes('--debug');
        this.startTime = Date.now();
        
        if (this.debugMode) {
            console.log('\n[DEBUG] Debug logging enabled\n');
        }
    }

    log(category, message, data = null) {
        if (!this.debugMode) return;
        
        const timestamp = new Date().toISOString();
        const elapsed = ((Date.now() - this.startTime) / 1000).toFixed(2);
        
        console.log(`[${timestamp}] [${elapsed}s] [${category}] ${message}`);
        
        if (data) {
            console.log(`  Data:`, JSON.stringify(data, null, 2));
        }
    }

    logRequest(req, endpoint) {
        if (!this.debugMode) return;
        
        const info = {
            method: req.method,
            endpoint: endpoint,
            ip: req.ip || req.connection.remoteAddress,
            userAgent: req.headers['user-agent']
        };
        
        this.log('REQUEST', `${req.method} ${endpoint}`, info);
    }

    logImageGeneration(type, description, status) {
        this.log('IMAGE_GEN', `${status} - Type: ${type}`, { description });
    }

    logAIRequest(type, prompt, status) {
        this.log('AI', `${status} - Type: ${type}`, { 
            promptLength: prompt ? prompt.length : 0,
            promptPreview: prompt ? prompt.substring(0, 100) + '...' : ''
        });
    }

    logError(category, error) {
        if (!this.debugMode) return;
        
        console.error(`[ERROR] [${category}] ${error.message}`);
        if (error.stack) {
            console.error(error.stack);
        }
    }

    logPerformance(operation, duration) {
        this.log('PERFORMANCE', `${operation} took ${duration}ms`);
    }
}

// Create singleton instance
const debugLogger = new DebugLogger();

module.exports = debugLogger;