/**
 * Auto-save functionality for Document Writer
 * Automatically saves user progress to localStorage
 */
class AutoSave {
    constructor() {
        this.saveKey = 'documentwriter_autosave';
        this.saveInterval = null;
        this.lastSaveTime = null;
        this.isDirty = false;
        this.autoSaveDelay = 30000; // Auto-save every 30 seconds
        this.debounceTimer = null;
        this.debounceDelay = 2000; // Wait 2 seconds after last change
    }
    
    /**
     * Start auto-save monitoring
     */
    start() {
        // Set up auto-save interval
        this.saveInterval = setInterval(() => {
            if (this.isDirty) {
                this.save();
            }
        }, this.autoSaveDelay);
        
        // Load any existing auto-save on start
        this.load();
        
        console.log('[AUTO-SAVE] Started auto-save monitoring');
    }
    
    /**
     * Stop auto-save monitoring
     */
    stop() {
        if (this.saveInterval) {
            clearInterval(this.saveInterval);
            this.saveInterval = null;
        }
        
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
            this.debounceTimer = null;
        }
        
        console.log('[AUTO-SAVE] Stopped auto-save monitoring');
    }
    
    /**
     * Mark data as changed (needs saving)
     */
    markDirty() {
        this.isDirty = true;
        
        // Debounce saves to avoid too frequent saves
        if (this.debounceTimer) {
            clearTimeout(this.debounceTimer);
        }
        
        this.debounceTimer = setTimeout(() => {
            if (this.isDirty) {
                this.save();
            }
        }, this.debounceDelay);
    }
    
    /**
     * Save current wizard state
     */
    save() {
        if (!window.app) return;
        
        const saveData = {
            version: '1.0',
            timestamp: new Date().toISOString(),
            currentStep: window.app.currentStepIndex,
            wizardData: window.app.wizardData,
            completedSteps: window.app.steps.map(step => step.completed),
            // Don't save generated content if it's too large
            generatedContent: window.app.wizardData.generatedContent ? 
                window.app.wizardData.generatedContent.substring(0, 50000) : null
        };
        
        try {
            localStorage.setItem(this.saveKey, JSON.stringify(saveData));
            this.lastSaveTime = new Date();
            this.isDirty = false;
            this.showSaveIndicator();
            console.log('[AUTO-SAVE] Saved wizard state');
        } catch (error) {
            console.error('[AUTO-SAVE] Failed to save:', error);
            // If localStorage is full, try to clear old data
            if (error.name === 'QuotaExceededError') {
                this.clearOldSaves();
                // Try again
                try {
                    localStorage.setItem(this.saveKey, JSON.stringify(saveData));
                } catch (retryError) {
                    console.error('[AUTO-SAVE] Failed to save even after clearing old data');
                }
            }
        }
    }
    
    /**
     * Load saved wizard state
     */
    load() {
        const savedData = localStorage.getItem(this.saveKey);
        if (!savedData || !window.app) return false;
        
        try {
            const data = JSON.parse(savedData);
            
            // Check if save is from today
            const saveDate = new Date(data.timestamp);
            const now = new Date();
            const hoursSinceSave = (now - saveDate) / (1000 * 60 * 60);
            
            // If save is older than 24 hours, don't load it
            if (hoursSinceSave > 24) {
                console.log('[AUTO-SAVE] Saved data is too old, ignoring');
                this.clear();
                return false;
            }
            
            // Show recovery prompt
            if (this.showRecoveryPrompt(data.timestamp)) {
                // Restore wizard state
                window.app.currentStepIndex = data.currentStep || 0;
                window.app.wizardData = data.wizardData || window.app.wizardData;
                
                // Restore step completion status
                if (data.completedSteps) {
                    data.completedSteps.forEach((completed, index) => {
                        if (window.app.steps[index]) {
                            window.app.steps[index].completed = completed;
                        }
                    });
                }
                
                // Update UI
                window.app.updateStepsNavigation();
                window.app.updateWizardContent();
                window.app.updateProgress();
                
                console.log('[AUTO-SAVE] Restored wizard state from', data.timestamp);
                showToast('Document restored from auto-save', 'success');
                return true;
            } else {
                // User declined to restore
                this.clear();
            }
        } catch (error) {
            console.error('[AUTO-SAVE] Failed to load saved data:', error);
            this.clear();
        }
        
        return false;
    }
    
    /**
     * Show recovery prompt
     */
    showRecoveryPrompt(timestamp) {
        const saveTime = new Date(timestamp).toLocaleString();
        return confirm(`Found auto-saved document from ${saveTime}. Would you like to restore it?`);
    }
    
    /**
     * Clear saved data
     */
    clear() {
        localStorage.removeItem(this.saveKey);
        this.isDirty = false;
        console.log('[AUTO-SAVE] Cleared saved data');
    }
    
    /**
     * Clear old auto-save data to free up space
     */
    clearOldSaves() {
        const keysToCheck = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith('documentwriter_')) {
                keysToCheck.push(key);
            }
        }
        
        // Remove old keys
        keysToCheck.forEach(key => {
            if (key !== this.saveKey) {
                localStorage.removeItem(key);
            }
        });
    }
    
    /**
     * Show save indicator
     */
    showSaveIndicator() {
        // Create or update save indicator
        let indicator = document.getElementById('auto-save-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'auto-save-indicator';
            indicator.style.cssText = `
                position: fixed;
                bottom: 20px;
                right: 20px;
                background: #4CAF50;
                color: white;
                padding: 8px 16px;
                border-radius: 4px;
                font-size: 12px;
                opacity: 0;
                transition: opacity 0.3s;
                z-index: 10000;
            `;
            document.body.appendChild(indicator);
        }
        
        indicator.textContent = `Saved at ${this.lastSaveTime.toLocaleTimeString()}`;
        indicator.style.opacity = '1';
        
        // Fade out after 2 seconds
        setTimeout(() => {
            indicator.style.opacity = '0';
        }, 2000);
    }
}

// Create global auto-save instance
window.autoSave = new AutoSave();