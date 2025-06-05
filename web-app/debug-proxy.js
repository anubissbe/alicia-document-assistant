/**
 * Debug Proxy Server
 * Intercepts and logs all API calls for debugging
 */

const express = require('express');
const cors = require('cors');
const debugLogger = require('./debug-logger');

const app = express();
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// Debug proxy port
const PORT = 8001;

// Track ongoing operations
const operations = new Map();

// Middleware to log all requests
app.use((req, res, next) => {
    const operationId = Date.now();
    operations.set(operationId, {
        start: Date.now(),
        path: req.path,
        method: req.method
    });
    
    req.operationId = operationId;
    debugLogger.logRequest(req, req.path);
    
    // Log response
    const originalSend = res.send;
    res.send = function(data) {
        const operation = operations.get(req.operationId);
        if (operation) {
            const duration = Date.now() - operation.start;
            debugLogger.logPerformance(`${operation.method} ${operation.path}`, duration);
            operations.delete(req.operationId);
        }
        originalSend.call(this, data);
    };
    
    next();
});

// Proxy endpoint for image generation
app.post('/generate-image', async (req, res) => {
    const { description, type } = req.body;
    
    debugLogger.logImageGeneration(type, description, 'STARTED');
    console.log('\n=== IMAGE GENERATION REQUEST ===');
    console.log(`Type: ${type}`);
    console.log(`Description: ${description}`);
    console.log('================================\n');
    
    try {
        // Forward to actual image generation
        const response = await fetch('http://192.168.1.25:8000/generate', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        debugLogger.logImageGeneration(type, description, 'COMPLETED');
        res.json(data);
        
    } catch (error) {
        debugLogger.logError('IMAGE_GEN', error);
        console.error('\n=== IMAGE GENERATION ERROR ===');
        console.error(error);
        console.error('==============================\n');
        res.status(500).json({ error: error.message });
    }
});

// Proxy endpoint for AI text generation
app.post('/ai-generate', async (req, res) => {
    const { prompt, type } = req.body;
    
    debugLogger.logAIRequest(type || 'text', prompt, 'STARTED');
    console.log('\n=== AI GENERATION REQUEST ===');
    console.log(`Type: ${type || 'text'}`);
    console.log(`Prompt length: ${prompt.length} chars`);
    console.log('=============================\n');
    
    try {
        // Forward to LM Studio
        const response = await fetch('http://127.0.0.1:1234/v1/chat/completions', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(req.body)
        });
        
        const data = await response.json();
        debugLogger.logAIRequest(type || 'text', prompt, 'COMPLETED');
        res.json(data);
        
    } catch (error) {
        debugLogger.logError('AI_GEN', error);
        console.error('\n=== AI GENERATION ERROR ===');
        console.error(error);
        console.error('===========================\n');
        res.status(500).json({ error: error.message });
    }
});

// Status endpoint
app.get('/debug-status', (req, res) => {
    const activeOps = Array.from(operations.entries()).map(([id, op]) => ({
        id,
        ...op,
        duration: Date.now() - op.start
    }));
    
    res.json({
        debugMode: debugLogger.debugMode,
        activeOperations: activeOps,
        uptime: (Date.now() - debugLogger.startTime) / 1000
    });
});

// Only start if debug mode is enabled
if (debugLogger.debugMode) {
    app.listen(PORT, () => {
        console.log(`\n[DEBUG PROXY] Running on http://localhost:${PORT}`);
        console.log('[DEBUG PROXY] Intercepting API calls for debugging\n');
    });
} else {
    console.log('[DEBUG PROXY] Not started - debug mode is disabled');
}

module.exports = app;