// Settings Manager for Alicia
// Handles all user preferences and configuration

class SettingsManager {
    constructor() {
        this.defaults = {
            // Image Generation
            sdEndpoint: 'http://192.168.1.25:8000',
            sdEnabled: true,
            
            // Document Generation
            minPages: 3,
            docDetailLevel: 'standard',
            
            // AI Model
            lmStudioUrl: 'http://127.0.0.1:1234/v1',
            aiModel: ''
        };
        
        this.settings = this.loadSettings();
    }
    
    /**
     * Load settings from localStorage
     */
    loadSettings() {
        const stored = localStorage.getItem('alicia_settings');
        if (stored) {
            try {
                return { ...this.defaults, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Failed to load settings:', e);
                return this.defaults;
            }
        }
        return this.defaults;
    }
    
    /**
     * Save settings to localStorage
     */
    saveSettings(newSettings) {
        this.settings = { ...this.settings, ...newSettings };
        localStorage.setItem('alicia_settings', JSON.stringify(this.settings));
        
        // Apply settings immediately
        this.applySettings();
        
        return this.settings;
    }
    
    /**
     * Get a specific setting
     */
    getSetting(key) {
        return this.settings[key] ?? this.defaults[key];
    }
    
    /**
     * Apply settings to the application
     */
    applySettings() {
        // Update Stable Diffusion settings
        if (window.imageGenerator) {
            window.imageGenerator.stableDiffusionAPI.baseUrl = this.settings.sdEndpoint;
            window.imageGenerator.stableDiffusionAPI.enabled = this.settings.sdEnabled;
            window.imageGenerator.USE_STABLE_DIFFUSION = this.settings.sdEnabled;
            
            if (this.settings.sdEnabled) {
                window.imageGenerator.checkStableDiffusionAPI();
            } else {
                window.imageGenerator.updateSDStatus('disconnected', 'Image AI: Disabled');
            }
        }
        
        // Update AI Client settings
        if (window.aiClient) {
            window.aiClient.baseUrl = this.settings.lmStudioUrl;
            if (this.settings.aiModel) {
                window.aiClient.model = this.settings.aiModel;
            }
        }
        
        console.log('[SETTINGS] Applied settings:', this.settings);
    }
    
    /**
     * Get document generation instructions based on settings
     */
    getDocumentGenerationInstructions() {
        const minWords = this.settings.minPages * 300; // Approximately 300 words per page
        const detailInstructions = {
            concise: 'Be concise and brief, focusing only on essential information.',
            standard: 'Provide a balanced level of detail with clear explanations.',
            detailed: 'Include comprehensive coverage with detailed explanations and examples.',
            extensive: 'Provide maximum detail with extensive explanations, multiple examples, and thorough analysis.'
        };
        
        return `

CRITICAL DOCUMENT LENGTH REQUIREMENT:
===========================================
THIS IS MANDATORY: The document MUST be AT LEAST ${this.settings.minPages} pages long.
This means approximately ${minWords} words MINIMUM.
DO NOT generate a shorter document under any circumstances.
===========================================

DETAIL LEVEL REQUIREMENT: ${detailInstructions[this.settings.docDetailLevel]}

To meet the ${this.settings.minPages}-page minimum requirement, you MUST:
1. Write comprehensive introductions for each section (at least 150 words each)
2. Provide detailed explanations with multiple paragraphs for every point
3. Include relevant examples, case studies, and real-world applications
4. Add thorough analysis and discussion of implications
5. Expand on all key concepts with in-depth coverage
6. Include detailed conclusions that summarize and synthesize information
7. Add subsections within main sections to provide more depth
8. Include background information and context for all topics

REMEMBER: The document MUST be at least ${minWords} words. This is not optional.
`;
    }
}

// Global settings instance
window.settingsManager = new SettingsManager();

// Settings UI functions
function showSettings() {
    const modal = document.getElementById('settings-modal');
    if (!modal) return;
    
    const settings = window.settingsManager.settings;
    
    // Populate form with current settings
    document.getElementById('sd-endpoint').value = settings.sdEndpoint;
    document.getElementById('sd-enabled').checked = settings.sdEnabled;
    document.getElementById('min-pages').value = settings.minPages;
    document.getElementById('doc-detail-level').value = settings.docDetailLevel;
    document.getElementById('lm-studio-url').value = settings.lmStudioUrl;
    document.getElementById('ai-model').value = settings.aiModel;
    
    modal.style.display = 'flex';
}

function closeSettings() {
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.style.display = 'none';
    }
}

function saveSettings() {
    const newSettings = {
        sdEndpoint: document.getElementById('sd-endpoint').value,
        sdEnabled: document.getElementById('sd-enabled').checked,
        minPages: parseInt(document.getElementById('min-pages').value) || 3,
        docDetailLevel: document.getElementById('doc-detail-level').value,
        lmStudioUrl: document.getElementById('lm-studio-url').value,
        aiModel: document.getElementById('ai-model').value
    };
    
    window.settingsManager.saveSettings(newSettings);
    
    if (window.showToast) {
        window.showToast('Settings saved successfully!', 'success');
    }
    
    closeSettings();
}

// Initialize settings button
document.addEventListener('DOMContentLoaded', () => {
    const settingsButton = document.getElementById('settings-button');
    if (settingsButton) {
        settingsButton.addEventListener('click', showSettings);
    }
    
    // Add event listeners for modal buttons
    const saveBtn = document.getElementById('save-settings-btn');
    if (saveBtn) {
        saveBtn.addEventListener('click', saveSettings);
    }
    
    const cancelBtn = document.getElementById('cancel-settings-btn');
    if (cancelBtn) {
        cancelBtn.addEventListener('click', closeSettings);
    }
    
    // Close modal when clicking outside
    const modal = document.getElementById('settings-modal');
    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeSettings();
            }
        });
    }
    
    // Apply settings on load
    window.settingsManager.applySettings();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = SettingsManager;
}