/**
 * Initialization script for Document Writer
 * This ensures all required global objects and functions exist before other scripts run
 */

// Initialize global namespace
window.DocumentWriter = window.DocumentWriter || {};

// Global utility functions that must be available everywhere
window.showToast = function(message, type = 'info') {
    const toastContainer = document.getElementById('toast-container');
    if (!toastContainer) {
        console.error('Toast container not found');
        return;
    }
    
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.textContent = message;
    
    toastContainer.appendChild(toast);
    
    // Auto-remove after 4 seconds
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 4000);
};

window.showLoading = function(message = 'Processing...') {
    const overlay = document.getElementById('loading-overlay');
    const loadingText = document.getElementById('loading-text');
    
    if (overlay && loadingText) {
        loadingText.textContent = message;
        overlay.style.display = 'flex';
    }
};

window.hideLoading = function() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.display = 'none';
    }
};

// Safe localStorage access
window.safeLocalStorage = {
    getItem: function(key) {
        try {
            return localStorage.getItem(key);
        } catch (e) {
            console.warn('localStorage not available:', e);
            return null;
        }
    },
    setItem: function(key, value) {
        try {
            localStorage.setItem(key, value);
            return true;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    },
    removeItem: function(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (e) {
            console.warn('localStorage not available:', e);
            return false;
        }
    }
};

// Debug mode with safe localStorage
window.DEBUG_MODE = window.safeLocalStorage.getItem('debugMode') === 'true' || 
                   window.location.search.includes('debug=true');

// Debug logging helper
window.debugLog = function(category, message, data = null) {
    if (!window.DEBUG_MODE) return;
    
    const timestamp = new Date().toISOString().split('T')[1].split('.')[0];
    console.log(`%c[${timestamp}] [${category}]`, 'color: #95afc0; font-weight: bold', message);
    if (data) {
        console.log(data);
    }
};

// Safe DOM element getter
window.safeGetElement = function(id) {
    const element = document.getElementById(id);
    if (!element && window.DEBUG_MODE) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
};

// Ensure all required global objects exist (will be overwritten by actual implementations)
window.DocumentWriter.ensureGlobals = function() {
    // These will be overwritten by actual implementations when loaded
    window.imageStorage = window.imageStorage || {
        clear: () => console.warn('ImageStorage not loaded'),
        store: () => console.warn('ImageStorage not loaded'),
        get: () => null
    };
    
    window.settingsManager = window.settingsManager || {
        getSetting: () => null,
        setSetting: () => false,
        loadSettings: () => ({})
    };
    
    window.documentTemplates = window.documentTemplates || {
        getTemplate: () => null,
        getTemplates: () => []
    };
    
    window.fileProcessor = window.fileProcessor || {
        processFile: () => Promise.reject('FileProcessor not loaded')
    };
    
    window.researchAssistant = window.researchAssistant || {
        research: () => Promise.reject('ResearchAssistant not loaded')
    };
    
    window.autoSave = window.autoSave || {
        save: () => console.warn('AutoSave not loaded'),
        markDirty: () => console.warn('AutoSave not loaded')
    };
};

// Initialize when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.DocumentWriter.ensureGlobals);
} else {
    window.DocumentWriter.ensureGlobals();
}

// Error boundary for unhandled promise rejections
window.addEventListener('unhandledrejection', event => {
    console.error('Unhandled promise rejection:', event.reason);
    if (window.showToast) {
        window.showToast('An error occurred. Please check the console for details.', 'error');
    }
    event.preventDefault();
});

// Global error handler
window.addEventListener('error', event => {
    console.error('Global error:', event.error);
    if (window.DEBUG_MODE) {
        if (window.showToast) {
            window.showToast(`Error: ${event.error.message}`, 'error');
        }
    }
});