/**
 * Main Application Logic for Document Writer
 */

// Debug mode detection - using safe access from init.js
const DEBUG_MODE = window.DEBUG_MODE;

if (DEBUG_MODE) {
    console.log('%c[DEBUG MODE ENABLED]', 'color: #ff6b6b; font-weight: bold; font-size: 14px');
    console.log('All operations will be logged to console');
    
    // Override fetch to log all API calls
    const originalFetch = window.fetch;
    window.fetch = async function(...args) {
        const [url, options] = args;
        console.log(`%c[API CALL] ${options?.method || 'GET'} ${url}`, 'color: #4ecdc4');
        if (options?.body) {
            try {
                const body = JSON.parse(options.body);
                console.log('[REQUEST BODY]', body);
            } catch {}
        }
        
        const startTime = Date.now();
        try {
            const response = await originalFetch.apply(this, args);
            const duration = Date.now() - startTime;
            console.log(`%c[API RESPONSE] ${url} - ${response.status} (${duration}ms)`, 'color: #45b7d1');
            return response;
        } catch (error) {
            console.error(`%c[API ERROR] ${url}`, 'color: #ff6b6b', error);
            throw error;
        }
    };
}

// Debug logging helper is now provided by init.js
const debugLog = window.debugLog;

class DocumentWriterApp {
    constructor() {
        // Clear any stored images from previous sessions
        if (window.imageStorage && typeof window.imageStorage.clear === 'function') {
            window.imageStorage.clear();
        }
        
        // Clear any stored content from previous sessions to avoid 404 errors
        this.clearStoredContent();
        
        // Store event listeners for cleanup
        this.eventListeners = [];
        
        this.currentStepIndex = 0;
        this.steps = [
            {
                id: 'document-type',
                title: 'Select Document Type',
                description: 'Choose the type of document you want to create',
                completed: false
            },
            {
                id: 'document-details',
                title: 'Document Details',
                description: 'Enter basic document information',
                completed: false
            },
            {
                id: 'content-sections',
                title: 'Content Sections',
                description: 'Define the content sections for your document',
                completed: false
            },
            {
                id: 'ai-generation',
                title: 'AI Generation',
                description: 'Generate content using AI',
                completed: false
            },
            {
                id: 'review',
                title: 'Review & Download',
                description: 'Review your document and download it',
                completed: false
            }
        ];
        
        this.wizardData = {
            documentType: null,
            documentTitle: '',
            documentData: {
                description: '',
                author: '',
                date: new Date().toISOString().split('T')[0]
            },
            sections: [],
            generatedContent: ''
        };
        
        this.chatHistory = [];
        this.tempGeneratedContent = null;
        
        this.init();
    }

    /**
     * Initialize the application
     */
    init() {
        this.updateStepsNavigation();
        this.updateWizardContent();
        this.updateProgress();
        this.setupEventListeners();
        
        // Start auto-save
        if (window.autoSave) {
            window.autoSave.start();
        }
        
        // Check AI connection status periodically
        this.connectionCheckInterval = setInterval(() => {
            if (window.aiClient) {
                window.aiClient.checkConnection();
            }
        }, 30000); // Check every 30 seconds
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        if (this.connectionCheckInterval) {
            clearInterval(this.connectionCheckInterval);
        }
        if (window.autoSave) {
            window.autoSave.stop();
        }
    }

    /**
     * Clear any stored content from previous sessions
     */
    clearStoredContent() {
        // Clear localStorage items that might contain old image URLs
        const keysToCheck = ['documentContent', 'wizardData', 'generatedContent'];
        keysToCheck.forEach(key => {
            const stored = localStorage.getItem(key);
            if (stored && stored.includes('/image/img-')) {
                console.log(`[APP] Clearing stored ${key} with old image references`);
                localStorage.removeItem(key);
            }
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Handle document type selection
        document.addEventListener('click', (e) => {
            if (e.target.classList.contains('document-type-card')) {
                this.selectDocumentType(e.target.dataset.type);
            }
            
            if (e.target.classList.contains('template-card')) {
                this.selectTemplate(e.target.dataset.templateId);
            }
            
            if (e.target.classList.contains('step-nav-item')) {
                const stepIndex = parseInt(e.target.dataset.stepIndex);
                if (stepIndex !== this.currentStepIndex) {
                    this.goToStep(stepIndex);
                }
            }
            
            // Handle action buttons
            const action = e.target.dataset.action;
            if (action) {
                this.handleAction(action, e.target);
            }
        });

        // Handle form inputs
        document.addEventListener('input', (e) => {
            if (e.target.classList.contains('form-input')) {
                this.updateFormData(e.target.name, e.target.value);
            }
        });

        // Handle keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + Enter to send feedback
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                const feedbackInput = document.getElementById('feedback-input');
                if (feedbackInput && document.activeElement === feedbackInput) {
                    e.preventDefault();
                    this.sendFeedback();
                }
            }
        });
    }

    /**
     * Handle various actions
     */
    handleAction(action, target) {
        switch (action) {
            case 'addSection':
                this.addSection();
                break;
            case 'removeSection':
                this.removeSection(target.dataset.index);
                break;
            case 'generateSection':
                this.generateSectionContent(target.dataset.index);
                break;
            case 'generateDocument':
                this.generateDocument();
                break;
            case 'downloadDocument':
                this.downloadDocument(target.dataset.format);
                break;
            case 'previewDocument':
                this.previewDocument();
                break;
            case 'improveContent':
                this.improveContent(target.dataset.type);
                break;
            case 'generateTitle':
                this.generateTitleSuggestions();
                break;
            case 'analyzeResources':
                this.analyzeUploadedResources();
                break;
            case 'generateOutline':
                this.generateDocumentOutline();
                break;
            case 'sendFeedback':
                this.sendFeedback();
                break;
            case 'applyChanges':
                this.applyChanges();
                break;
            case 'quickFeedback':
                this.sendQuickFeedback(target.dataset.feedback);
                break;
            case 'addImage':
                this.showImageDialog();
                break;
        }
    }

    /**
     * Update steps navigation
     */
    updateStepsNavigation() {
        const container = document.getElementById('steps-navigation');
        container.innerHTML = this.steps.map((step, index) => `
            <div class="step-nav-item ${index === this.currentStepIndex ? 'current' : ''} ${step.completed ? 'completed' : ''}" 
                 data-step-index="${index}">
                <div class="step-nav-number">
                    ${step.completed ? '✓' : index + 1}
                </div>
                <div class="step-nav-title">${step.title}</div>
            </div>
        `).join('');
    }

    /**
     * Update wizard content based on current step
     */
    updateWizardContent() {
        const container = document.getElementById('wizard-content');
        const step = this.steps[this.currentStepIndex];
        
        let content = '';
        switch (step.id) {
            case 'document-type':
                content = this.getDocumentTypeStepHTML();
                break;
            case 'document-details':
                content = this.getDocumentDetailsStepHTML();
                break;
            case 'content-sections':
                content = this.getContentSectionsStepHTML();
                break;
            case 'ai-generation':
                content = this.getAIGenerationStepHTML();
                break;
            case 'review':
                content = this.getReviewStepHTML();
                break;
        }
        
        container.innerHTML = `
            <div class="step-content">
                <h2 class="step-title">${step.title}</h2>
                <p class="step-description">${step.description}</p>
                ${content}
            </div>
        `;
        
        // Initialize components for specific steps
        if (step.id === 'document-details') {
            // Initialize file upload and research components
            setTimeout(() => {
                if (window.fileProcessor) {
                    window.fileProcessor.createFileUploadUI('file-upload-container');
                }
                if (window.researchAssistant) {
                    window.researchAssistant.createResearchUI('research-container');
                }
            }, 100);
        }
        
        this.updateNavigationButtons();
    }

    /**
     * Get document type step HTML
     */
    getDocumentTypeStepHTML() {
        const types = [
            { type: 'business', icon: '💼', title: 'Business', description: 'Business reports, proposals, and letters' },
            { type: 'technical', icon: '⚙️', title: 'Technical', description: 'Technical documentation and specifications' },
            { type: 'academic', icon: '🎓', title: 'Academic', description: 'Academic papers and research documents' },
            { type: 'report', icon: '📊', title: 'Report', description: 'General reports and analysis documents' },
            { type: 'letter', icon: '✉️', title: 'Letter', description: 'Formal and informal letters' },
            { type: 'custom', icon: '📄', title: 'Custom', description: 'Create a custom document' }
        ];
        
        return `
            <div class="document-type-grid">
                ${types.map(type => `
                    <div class="document-type-card ${this.wizardData.documentType === type.type ? 'selected' : ''}" 
                         data-type="${type.type}">
                        <div class="card-icon">${type.icon}</div>
                        <div class="card-title">${type.title}</div>
                        <div class="card-description">${type.description}</div>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Get document details step HTML
     */
    getDocumentDetailsStepHTML() {
        const hasResearchOrFiles = (window.researchContext && window.researchContext.length > 0) || 
                                   (window.uploadedDocuments && window.uploadedDocuments.length > 0);
        
        return `
            <div class="document-details-form">
                <div class="form-group">
                    <label for="documentTitle">Document Title *</label>
                    <input type="text" id="documentTitle" name="documentTitle" class="form-input" 
                           value="${this.wizardData.documentTitle}" placeholder="Enter document title" required>
                </div>
                
                <div class="form-group">
                    <label for="documentDescription">Description</label>
                    <textarea id="documentDescription" name="documentDescription" class="form-input" 
                              placeholder="Enter document description">${this.wizardData.documentData.description}</textarea>
                </div>
                
                <div class="form-group">
                    <label for="documentAuthor">Author</label>
                    <input type="text" id="documentAuthor" name="documentAuthor" class="form-input" 
                           value="${this.wizardData.documentData.author}" placeholder="Enter author name">
                </div>
                
                <div class="form-group">
                    <label for="documentDate">Date</label>
                    <input type="date" id="documentDate" name="documentDate" class="form-input" 
                           value="${this.wizardData.documentData.date}">
                </div>

                <!-- File Upload Section -->
                <div id="file-upload-container"></div>

                <!-- Research Assistant Section -->
                <div id="research-container"></div>

                ${window.aiClient && window.aiClient.isConnected ? `
                <div class="ai-assistance">
                    <h4>🤖 AI Assistance</h4>
                    <p>AI can help improve your document with ${hasResearchOrFiles ? 'research data and uploaded files' : 'suggestions'}.</p>
                    <div class="button-container">
                        <button class="generate-button" data-action="generateTitle">Generate Title Suggestions</button>
                        ${hasResearchOrFiles ? '<button class="secondary-button" data-action="analyzeResources">Analyze Resources</button>' : ''}
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get content sections step HTML
     */
    getContentSectionsStepHTML() {
        return `
            <div class="content-sections">
                <div class="sections-intro">
                    <p>Define the content sections for your document. You can add, remove, and customize sections as needed.</p>
                </div>
                
                <div class="sections-list" id="sections-list">
                    ${this.getSectionsListHTML()}
                </div>
                
                <div class="button-container">
                    <button class="secondary-button" data-action="addSection">
                        ➕ Add Section
                    </button>
                    ${window.aiClient && window.aiClient.isConnected ? `
                    <button class="generate-button" data-action="generateOutline">
                        🤖 Generate AI Outline
                    </button>
                    ` : ''}
                </div>
            </div>
        `;
    }

    /**
     * Get sections list HTML
     */
    getSectionsListHTML() {
        if (this.wizardData.sections.length === 0) {
            return `
                <div class="empty-step-message">
                    <p>No sections defined yet. Click "Add Section" to create your first section.</p>
                </div>
            `;
        }
        
        return this.wizardData.sections.map((section, index) => `
            <div class="section-item" data-index="${index}">
                <div class="section-header">
                    <input type="text" value="${section.title}" class="section-title-input form-input" 
                           onchange="app.updateSectionTitle(${index}, this.value)" placeholder="Section title">
                    <div class="section-actions">
                        ${window.aiClient && window.aiClient.isConnected ? `
                        <button class="secondary-button" data-action="generateSection" data-index="${index}">
                            🤖 Generate
                        </button>
                        ` : ''}
                        <button class="secondary-button" data-action="removeSection" data-index="${index}">
                            🗑️ Remove
                        </button>
                    </div>
                </div>
                <div class="section-content">
                    <textarea class="form-input section-content-input" placeholder="Section content (optional)" 
                              onchange="app.updateSectionContent(${index}, this.value)">${section.content || ''}</textarea>
                </div>
            </div>
        `).join('');
    }

    /**
     * Get AI generation step HTML
     */
    getAIGenerationStepHTML() {
        if (!window.aiClient || !window.aiClient.isConnected) {
            return `
                <div class="empty-step-message">
                    <h3>⚠️ AI Not Connected</h3>
                    <p>LM Studio is not running or not accessible. Please ensure LM Studio is running on port 1234.</p>
                    <p>You can still proceed to review and download your document with the sections you've defined.</p>
                </div>
            `;
        }

        return `
            <div class="ai-generation">
                <div class="ai-assistance">
                    <h3>🤖 AI Document Generation</h3>
                    <p>Let AI generate your complete document based on the information you've provided.</p>
                    
                    <div class="generation-options">
                        <h4>Generation Options:</h4>
                        <div class="form-group">
                            <label>
                                <input type="radio" name="generationType" value="full" checked>
                                Generate complete document with all sections
                            </label>
                        </div>
                        <div class="form-group">
                            <label>
                                <input type="radio" name="generationType" value="sections">
                                Generate content for empty sections only
                            </label>
                        </div>
                        <div class="info-message" style="margin-top: 1rem; padding: 0.75rem; background: var(--hover-background); border-radius: 4px; border: 1px solid var(--border-color);">
                            <p style="margin: 0; font-size: 0.9rem;">
                                📊 Based on your ${window.settingsManager?.getSetting('minPages') || 3}-page requirement, 
                                Alicia will include <strong>${Math.max(2, Math.floor(((window.settingsManager?.getSetting('minPages') || 3) / 5) * 3))}</strong> 
                                relevant images throughout the document (3 images per 5 pages).
                            </p>
                        </div>
                    </div>
                    
                    <button class="generate-button" data-action="generateDocument">
                        🚀 Generate Document with AI
                    </button>
                </div>
                
                ${this.wizardData.generatedContent ? `
                <div class="generated-content">
                    <h4>Generated Content:</h4>
                    <div class="content-preview">
                        ${this.wizardData.generatedContent.substring(0, 500)}...
                    </div>
                    <div class="button-container">
                        <button class="secondary-button" data-action="improveContent" data-type="grammar">
                            📝 Improve Grammar
                        </button>
                        <button class="secondary-button" data-action="improveContent" data-type="clarity">
                            🔍 Improve Clarity
                        </button>
                        <button class="secondary-button" data-action="improveContent" data-type="professional">
                            💼 Make More Professional
                        </button>
                    </div>
                </div>
                ` : ''}
            </div>
        `;
    }

    /**
     * Get review step HTML
     */
    getReviewStepHTML() {
        return `
            <div class="document-review">
                <div class="review-summary">
                    <h3>Document Summary</h3>
                    <div class="summary-grid">
                        <div><strong>Type:</strong> ${this.wizardData.documentType}</div>
                        <div><strong>Title:</strong> ${this.wizardData.documentTitle}</div>
                        <div><strong>Author:</strong> ${this.wizardData.documentData.author || 'Not specified'}</div>
                        <div><strong>Sections:</strong> ${this.wizardData.sections.length}</div>
                    </div>
                </div>
                
                <div class="download-options">
                    <h3>Download Options</h3>
                    <div class="button-container">
                        <button class="primary-button" data-action="downloadDocument" data-format="docx">
                            📘 Download DOCX
                        </button>
                        <button class="primary-button" data-action="downloadDocument" data-format="pdf">
                            📕 Download PDF
                        </button>
                        <button class="secondary-button" data-action="downloadDocument" data-format="html">
                            📄 Download HTML
                        </button>
                        <button class="secondary-button" data-action="downloadDocument" data-format="markdown">
                            📝 Download Markdown
                        </button>
                        <button class="secondary-button" data-action="previewDocument">
                            👁️ Preview Document
                        </button>
                    </div>
                </div>
                
                ${this.wizardData.generatedContent ? `
                <div class="final-content">
                    <h3>Final Document Content</h3>
                    <div class="content-actions">
                        <button class="secondary-button" data-action="addImage">
                            🖼️ Add Image/Chart
                        </button>
                    </div>
                    <div class="content-preview" id="final-content-preview" style="max-height: 400px; overflow-y: auto; border: 1px solid var(--border-color); padding: 1rem; background: var(--input-background); margin-top: 1rem;">
                        ${window.documentGenerator.markdownToHTML(this.wizardData.generatedContent)}
                    </div>
                </div>
                
                ${window.aiClient && window.aiClient.isConnected ? `
                <div class="feedback-chat">
                    <h3>🤖 AI Feedback & Adjustments</h3>
                    <p>Provide feedback to refine your document. The AI will adjust the content based on your input.</p>
                    
                    <div class="chat-history" id="chat-history">
                        <!-- Chat messages will appear here -->
                    </div>
                    
                    <div class="chat-input-area">
                        <textarea id="feedback-input" class="form-input" placeholder="E.g., 'Make the introduction more formal', 'Add more details about implementation', 'Shorten the conclusion'..." rows="3"></textarea>
                        <small style="opacity: 0.7;">Press Ctrl+Enter (Cmd+Enter on Mac) to send</small>
                        <div class="button-container">
                            <button class="primary-button" data-action="sendFeedback">
                                💬 Send Feedback
                            </button>
                            <button class="secondary-button" data-action="applyChanges">
                                ✅ Apply Changes to Document
                            </button>
                        </div>
                    </div>
                    
                    <div class="quick-actions">
                        <h4>Quick Actions:</h4>
                        <div class="button-container">
                            <button class="secondary-button small" data-action="quickFeedback" data-feedback="make-formal">
                                Make More Formal
                            </button>
                            <button class="secondary-button small" data-action="quickFeedback" data-feedback="make-concise">
                                Make More Concise
                            </button>
                            <button class="secondary-button small" data-action="quickFeedback" data-feedback="add-details">
                                Add More Details
                            </button>
                            <button class="secondary-button small" data-action="quickFeedback" data-feedback="improve-flow">
                                Improve Flow
                            </button>
                        </div>
                    </div>
                </div>
                ` : ''}
                ` : ''}
            </div>
        `;
    }

    /**
     * Update navigation buttons
     */
    updateNavigationButtons() {
        const prevBtn = document.getElementById('prev-btn');
        const nextBtn = document.getElementById('next-btn');
        
        prevBtn.disabled = this.currentStepIndex === 0;
        nextBtn.disabled = this.currentStepIndex === this.steps.length - 1 || !this.isCurrentStepValid();
        
        if (this.currentStepIndex === this.steps.length - 1) {
            nextBtn.style.display = 'none';
        } else {
            nextBtn.style.display = 'inline-flex';
        }
    }

    /**
     * Check if current step is valid
     */
    isCurrentStepValid() {
        const step = this.steps[this.currentStepIndex];
        
        switch (step.id) {
            case 'document-type':
                return !!this.wizardData.documentType;
            case 'document-details':
                return !!this.wizardData.documentTitle.trim();
            case 'content-sections':
                return true; // Always valid, sections are optional
            case 'ai-generation':
                return true; // Always valid
            case 'review':
                return true; // Always valid
            default:
                return false;
        }
    }

    /**
     * Update progress
     */
    updateProgress() {
        const completedSteps = this.steps.filter(step => step.completed).length;
        const progress = Math.round((completedSteps / this.steps.length) * 100);
        
        document.getElementById('progress-value').style.width = `${progress}%`;
        document.getElementById('progress-text').textContent = `${progress}% Complete`;
    }

    /**
     * Select document type
     */
    selectDocumentType(type) {
        this.wizardData.documentType = type;
        this.steps[0].completed = true;
        
        // Show template selection dialog
        if (window.documentTemplates && type !== 'custom') {
            setTimeout(() => {
                window.documentTemplates.showTemplateDialog(type);
            }, 300);
        } else {
            // Auto-populate sections based on document type
            if (this.wizardData.sections.length === 0) {
                const defaultSections = window.documentGenerator.getDefaultSections(type);
                this.wizardData.sections = defaultSections.map(title => ({ title, content: '' }));
            }
        }
        
        this.updateStepsNavigation();
        this.updateWizardContent();
        this.updateProgress();
        
        showToast(`Selected ${type} document type`, 'success');
        
        // Mark for auto-save
        if (window.autoSave) {
            window.autoSave.markDirty();
        }
    }

    /**
     * Update form data
     */
    updateFormData(name, value) {
        if (name === 'documentTitle') {
            this.wizardData.documentTitle = value;
            this.steps[1].completed = !!value.trim();
        } else {
            this.wizardData.documentData[name] = value;
        }
        
        this.updateStepsNavigation();
        this.updateNavigationButtons();
        this.updateProgress();
        
        // Mark for auto-save
        if (window.autoSave) {
            window.autoSave.markDirty();
        }
    }

    /**
     * Add new section
     */
    addSection() {
        this.wizardData.sections.push({
            title: 'New Section',
            content: ''
        });
        
        this.updateWizardContent();
        showToast('Section added', 'success');
    }

    /**
     * Remove section
     */
    removeSection(index) {
        this.wizardData.sections.splice(index, 1);
        this.updateWizardContent();
        showToast('Section removed', 'success');
    }

    /**
     * Update section title
     */
    updateSectionTitle(index, title) {
        if (this.wizardData.sections[index]) {
            this.wizardData.sections[index].title = title;
        }
    }

    /**
     * Update section content
     */
    updateSectionContent(index, content) {
        if (this.wizardData.sections[index]) {
            this.wizardData.sections[index].content = content;
        }
    }

    /**
     * Generate section content with AI
     */
    async generateSectionContent(index) {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }

        const section = this.wizardData.sections[index];
        if (!section) return;

        try {
            showLoading(`Generating content for "${section.title}"...`);
            
            const content = await window.aiClient.generateSectionContent(section.title, {
                type: this.wizardData.documentType,
                title: this.wizardData.documentTitle,
                description: this.wizardData.documentData.description
            });
            
            section.content = content;
            hideLoading();
            this.updateWizardContent();
            showToast('Section content generated', 'success');
            
        } catch (error) {
            hideLoading();
            showToast('Error generating section content: ' + error.message, 'error');
        }
    }

    /**
     * Generate complete document with AI
     */
    async generateDocument() {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }

        let progress;
        try {
            // Show progress indicator
            if (window.progressIndicator) {
                progress = window.progressIndicator.showProgress('document-generation', {
                    title: 'Generating Document',
                    message: 'Alicia is creating your document with AI...',
                    showPercentage: false
                });
                progress.setIndeterminate();
            }
            
            const content = await window.documentGenerator.generateDocument(this.wizardData, 'markdown');
            this.wizardData.generatedContent = content;
            this.steps[3].completed = true;
            
            // Log generated content stats
            const imageCount = (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
            const wordCount = content.split(' ').length;
            console.log(`[DOCUMENT] Generated document:`, {
                words: wordCount,
                estimatedPages: Math.ceil(wordCount / 300),
                images: imageCount
            });
            
            this.updateStepsNavigation();
            this.updateWizardContent();
            this.updateProgress();
            
            showToast('Document generated successfully!', 'success');
            
            // Mark for auto-save
            if (window.autoSave) {
                window.autoSave.markDirty();
            }
            
        } catch (error) {
            showToast('Error generating document: ' + error.message, 'error');
        } finally {
            // Hide progress indicator
            if (progress) {
                progress.hide();
            }
        }
    }

    /**
     * Download document
     */
    async downloadDocument(format) {
        try {
            const content = await window.documentGenerator.generateDocument(this.wizardData, format);
            
            if (format === 'pdf') {
                // PDF generation opens print dialog, just show success message
                showToast('Opening print dialog. Select "Save as PDF" to download.', 'info');
                return;
            }
            
            // Adjust filename based on actual format
            let actualFormat = format;
            if (format === 'docx') {
                // We're actually generating .doc format for better compatibility
                actualFormat = 'doc';
            }
            
            const filename = `${this.wizardData.documentTitle || 'document'}.${actualFormat}`;
            
            // Set appropriate MIME type
            let mimeType;
            switch (format) {
                case 'html':
                    mimeType = 'text/html';
                    break;
                case 'markdown':
                    mimeType = 'text/markdown';
                    break;
                case 'docx':
                    mimeType = 'application/msword'; // Using .doc MIME type
                    break;
                default:
                    mimeType = 'text/plain';
            }
            
            window.documentGenerator.downloadDocument(content, filename, mimeType);
            showToast(`Document downloaded as ${format.toUpperCase()}`, 'success');
            
        } catch (error) {
            showToast('Error downloading document: ' + error.message, 'error');
        }
    }

    /**
     * Preview document
     */
    async previewDocument() {
        try {
            const content = await window.documentGenerator.generateDocument(this.wizardData, 'html');
            window.documentGenerator.previewDocument(content, this.wizardData.documentTitle);
            
        } catch (error) {
            showToast('Error previewing document: ' + error.message, 'error');
        }
    }

    /**
     * Go to specific step
     */
    goToStep(stepIndex) {
        if (stepIndex >= 0 && stepIndex < this.steps.length) {
            this.currentStepIndex = stepIndex;
            this.updateStepsNavigation();
            this.updateWizardContent();
        }
    }

    /**
     * Generate title suggestions using AI
     */
    async generateTitleSuggestions() {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }

        try {
            showLoading('Generating title suggestions...');
            
            const suggestions = await window.aiClient.generateTitleSuggestions(
                this.wizardData.documentType,
                this.wizardData.documentData.description || 'No description provided'
            );
            
            hideLoading();
            
            // Show suggestions in a prompt
            const titles = suggestions.split('\n').filter(t => t.trim().length > 0);
            const selectedTitle = await this.showTitleSuggestions(titles);
            
            if (selectedTitle) {
                this.wizardData.documentTitle = selectedTitle;
                this.updateFormData('documentTitle', selectedTitle);
                this.updateWizardContent();
                showToast('Title updated', 'success');
            }
            
        } catch (error) {
            hideLoading();
            showToast('Error generating titles: ' + error.message, 'error');
        }
    }

    /**
     * Show title suggestions dialog
     */
    async showTitleSuggestions(titles) {
        return new Promise((resolve) => {
            const modal = document.createElement('div');
            modal.className = 'modal-overlay';
            modal.innerHTML = `
                <div class="modal-content">
                    <h3>🤖 AI Title Suggestions</h3>
                    <p>Select a title or use one as inspiration:</p>
                    <div class="title-suggestions">
                        ${titles.map((title, index) => `
                            <div class="title-option" data-title="${title.trim()}">
                                ${title.trim()}
                            </div>
                        `).join('')}
                    </div>
                    <div class="modal-actions">
                        <button class="secondary-button" onclick="this.closest('.modal-overlay').remove(); resolve(null)">Cancel</button>
                    </div>
                </div>
            `;
            
            modal.addEventListener('click', (e) => {
                if (e.target.classList.contains('title-option')) {
                    const title = e.target.getAttribute('data-title');
                    modal.remove();
                    resolve(title);
                } else if (e.target.classList.contains('modal-overlay')) {
                    modal.remove();
                    resolve(null);
                }
            });
            
            document.body.appendChild(modal);
        });
    }

    /**
     * Analyze uploaded resources and research
     */
    async analyzeUploadedResources() {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }

        try {
            showLoading('Analyzing uploaded resources...');
            
            let analysisContext = '';
            
            // Add uploaded documents context
            if (window.fileProcessor && window.uploadedDocuments) {
                analysisContext += window.fileProcessor.getUploadedDocumentsContext();
            }
            
            // Add research context
            if (window.researchAssistant && window.researchContext) {
                analysisContext += window.researchContext;
            }
            
            if (!analysisContext) {
                hideLoading();
                showToast('No resources to analyze', 'warning');
                return;
            }
            
            const prompt = `Based on the following research and documents, please provide:
1. Key insights and themes
2. Suggested improvements for the document
3. Additional sections that might be valuable
4. Important points to emphasize

${analysisContext}

Document context:
- Type: ${this.wizardData.documentType}
- Title: ${this.wizardData.documentTitle}
- Description: ${this.wizardData.documentData.description}`;

            const analysis = await window.aiClient.generateText(prompt, {
                temperature: 0.6,
                maxTokens: 1000
            });
            
            hideLoading();
            this.showAnalysisResults(analysis);
            
        } catch (error) {
            hideLoading();
            showToast('Error analyzing resources: ' + error.message, 'error');
        }
    }

    /**
     * Show analysis results in a modal
     */
    showAnalysisResults(analysis) {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.innerHTML = `
            <div class="modal-content large">
                <h3>🔍 Resource Analysis</h3>
                <div class="analysis-content">
                    ${window.documentGenerator.markdownToHTML(analysis)}
                </div>
                <div class="modal-actions">
                    <button class="primary-button" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target.classList.contains('modal-overlay')) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }

    /**
     * Generate document outline using AI
     */
    async generateDocumentOutline() {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }

        try {
            showLoading('Generating document outline...');
            
            const outline = await window.aiClient.generateOutline({
                title: this.wizardData.documentTitle,
                type: this.wizardData.documentType,
                description: this.wizardData.documentData.description
            });
            
            hideLoading();
            
            // Parse outline and add as sections
            const sections = this.parseOutlineToSections(outline);
            this.wizardData.sections = sections;
            this.updateWizardContent();
            
            showToast(`Generated outline with ${sections.length} sections`, 'success');
            
        } catch (error) {
            hideLoading();
            showToast('Error generating outline: ' + error.message, 'error');
        }
    }

    /**
     * Parse AI-generated outline into sections
     */
    parseOutlineToSections(outline) {
        const lines = outline.split('\n');
        const sections = [];
        
        lines.forEach(line => {
            const trimmed = line.trim();
            // Look for markdown headers or numbered items
            if (trimmed.match(/^#+\s+/) || trimmed.match(/^\d+\.\s+/) || trimmed.match(/^-\s+/)) {
                const title = trimmed.replace(/^#+\s+|^\d+\.\s+|^-\s+/, '').trim();
                if (title.length > 0) {
                    sections.push({
                        title: title,
                        content: ''
                    });
                }
            }
        });
        
        return sections.length > 0 ? sections : [
            { title: 'Introduction', content: '' },
            { title: 'Main Content', content: '' },
            { title: 'Conclusion', content: '' }
        ];
    }

    /**
     * Send feedback to AI for document adjustments
     */
    async sendFeedback() {
        const feedbackInput = document.getElementById('feedback-input');
        if (!feedbackInput || !feedbackInput.value.trim()) return;

        const feedback = feedbackInput.value.trim();
        
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }

        try {
            // Add user message to chat
            this.addChatMessage('user', feedback);
            feedbackInput.value = '';
            
            showLoading('Processing your feedback...');
            
            // Generate revised content based on feedback
            const currentContent = this.tempGeneratedContent || this.wizardData.generatedContent;
            
            // Limit content length to prevent token issues
            const contentPreview = currentContent.length > 3000 
                ? currentContent.substring(0, 3000) + '\n\n[... document continues ...]'
                : currentContent;
            
            const prompt = `You are Alicia, a personal document assistant helping to refine a document. Here is the current document:

${contentPreview}

The user has provided the following feedback:
"${feedback}"

Please revise the document according to this feedback. Maintain the overall structure and format, but make the requested adjustments. Return the complete revised document.`;

            const revisedContent = await window.aiClient.generateText(prompt, {
                temperature: 0.5,
                maxTokens: 4000
            });
            
            // Store as temporary content
            this.tempGeneratedContent = revisedContent;
            
            // Update preview
            this.updateDocumentPreview(revisedContent);
            
            // Add AI response to chat
            this.addChatMessage('ai', 'I\'ve revised the document based on your feedback. Please review the changes above. Click "Apply Changes" if you\'re satisfied, or provide more feedback.');
            
            hideLoading();
            
        } catch (error) {
            hideLoading();
            showToast('Error processing feedback: ' + error.message, 'error');
            this.addChatMessage('ai', 'Sorry, I encountered an error while processing your feedback. Please try again.');
        }
    }

    /**
     * Send quick feedback
     */
    async sendQuickFeedback(feedbackType) {
        const feedbackMap = {
            'make-formal': 'Please make the entire document more formal and professional in tone.',
            'make-concise': 'Please make the document more concise by removing unnecessary words and condensing the content.',
            'add-details': 'Please add more details and expand on the key points in the document.',
            'improve-flow': 'Please improve the flow and transitions between sections for better readability.'
        };
        
        const feedbackText = feedbackMap[feedbackType];
        if (feedbackText) {
            document.getElementById('feedback-input').value = feedbackText;
            await this.sendFeedback();
        }
    }

    /**
     * Apply changes to the document
     */
    applyChanges() {
        if (!this.tempGeneratedContent) {
            showToast('No changes to apply', 'warning');
            return;
        }
        
        // Apply the temporary content as the final content
        this.wizardData.generatedContent = this.tempGeneratedContent;
        this.tempGeneratedContent = null;
        
        // Clear chat history
        this.chatHistory = [];
        const chatHistoryElement = document.getElementById('chat-history');
        if (chatHistoryElement) {
            chatHistoryElement.innerHTML = '';
        }
        
        showToast('Changes applied successfully!', 'success');
        this.addChatMessage('system', 'Changes have been applied to your document. You can continue to refine it or download the final version.');
    }

    /**
     * Improve document content
     */
    async improveContent(improvementType) {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }
        
        if (!this.wizardData.generatedContent) {
            showToast('No content to improve', 'warning');
            return;
        }
        
        try {
            showLoading(`Improving document (${improvementType})...`);
            
            // Get the current content (either temp or original)
            const currentContent = this.tempGeneratedContent || this.wizardData.generatedContent;
            
            // Call AI to improve the content
            const improvedContent = await window.aiClient.improveContent(currentContent, improvementType);
            
            // Store as temporary content
            this.tempGeneratedContent = improvedContent;
            
            // Update preview
            this.updateDocumentPreview(improvedContent);
            
            hideLoading();
            
            // Add to chat history
            let message = '';
            switch (improvementType) {
                case 'grammar':
                    message = 'I\'ve corrected grammar, spelling, and punctuation errors in your document.';
                    break;
                case 'clarity':
                    message = 'I\'ve rewritten the document to improve clarity and readability.';
                    break;
                case 'professional':
                    message = 'I\'ve adjusted the tone to be more professional and formal.';
                    break;
                default:
                    message = 'I\'ve improved your document.';
            }
            
            this.addChatMessage('ai', message);
            this.addChatMessage('system', 'Review the changes above. Click "Apply Changes" to keep them or continue editing.');
            
            showToast('Document improved! Review changes above.', 'success');
            
        } catch (error) {
            hideLoading();
            showToast('Error improving content: ' + error.message, 'error');
        }
    }

    /**
     * Add message to chat history
     */
    addChatMessage(type, message) {
        const chatMessage = {
            type: type,
            message: message,
            timestamp: new Date().toISOString()
        };
        
        this.chatHistory.push(chatMessage);
        
        const chatHistoryElement = document.getElementById('chat-history');
        if (!chatHistoryElement) return;
        
        const messageElement = document.createElement('div');
        messageElement.className = `chat-message ${type}`;
        
        const iconMap = {
            'user': '👤',
            'ai': '🤖',
            'system': 'ℹ️'
        };
        
        messageElement.innerHTML = `
            <div class="message-header">
                <span class="message-icon">${iconMap[type] || '💬'}</span>
                <span class="message-type">${type === 'ai' ? 'AI Assistant' : type.charAt(0).toUpperCase() + type.slice(1)}</span>
                <span class="message-time">${new Date(chatMessage.timestamp).toLocaleTimeString()}</span>
            </div>
            <div class="message-content">${message}</div>
        `;
        
        chatHistoryElement.appendChild(messageElement);
        chatHistoryElement.scrollTop = chatHistoryElement.scrollHeight;
    }

    /**
     * Update document preview with new content
     */
    updateDocumentPreview(content) {
        const previewElement = document.getElementById('final-content-preview');
        if (previewElement) {
            // Log to check if content has images
            const imageMatches = content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || [];
            const imageCount = imageMatches.length;
            console.log(`[PREVIEW] Updating with ${imageCount} images`);
            if (imageCount > 0) {
                console.log('[PREVIEW] Images found in markdown:');
                imageMatches.forEach((img, index) => {
                    const isDataUrl = img.includes('data:image');
                    console.log(`  ${index + 1}. ${img.substring(0, 100)}... (isDataUrl: ${isDataUrl})`);
                });
            }
            
            const htmlContent = window.documentGenerator.markdownToHTML(content);
            
            // Log HTML images
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = htmlContent;
            const htmlImages = tempDiv.querySelectorAll('img');
            console.log(`[PREVIEW] ${htmlImages.length} images in generated HTML`);
            htmlImages.forEach((img, index) => {
                console.log(`  ${index + 1}. src: ${img.src?.substring(0, 100)}...`);
            });
            
            previewElement.innerHTML = htmlContent;
            previewElement.scrollTop = 0;
            
            // Add highlight effect
            previewElement.classList.add('updated');
            setTimeout(() => {
                previewElement.classList.remove('updated');
            }, 1000);
        }
    }

    /**
     * Show image dialog for adding images
     */
    showImageDialog() {
        const dialog = document.createElement('div');
        dialog.className = 'modal-overlay';
        dialog.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>Add Image or Chart</h2>
                <div class="image-options">
                    <div class="form-group">
                        <label>Image Type</label>
                        <select id="image-type" class="form-input">
                            <option value="photo">Stock Photo (AI Generated)</option>
                            <option value="chart">Chart/Graph (Chart.js)</option>
                            <option value="diagram">Diagram (AI Generated)</option>
                            <option value="infographic">Infographic (AI Generated)</option>
                        </select>
                    </div>
                    
                    <div class="form-group">
                        <label>Description</label>
                        <textarea id="image-description" class="form-input" rows="3" 
                                placeholder="Describe what you want to show..."></textarea>
                    </div>
                    
                    <div id="chart-config" style="display:none;">
                        <div class="form-group">
                            <label>Chart Data (comma-separated values)</label>
                            <input type="text" id="chart-data" class="form-input" 
                                   placeholder="10,20,30,40,50">
                        </div>
                        <div class="form-group">
                            <label>Chart Labels (comma-separated)</label>
                            <input type="text" id="chart-labels" class="form-input" 
                                   placeholder="Jan,Feb,Mar,Apr,May">
                        </div>
                    </div>
                    
                    <div class="button-container">
                        <button class="primary-button" id="generate-image-btn">
                            Generate Image
                        </button>
                        <button class="secondary-button" id="cancel-image-btn">
                            Cancel
                        </button>
                    </div>
                </div>
            </div>
        `;
        
        document.body.appendChild(dialog);
        
        // Show/hide chart config based on type
        document.getElementById('image-type').addEventListener('change', (e) => {
            const chartConfig = document.getElementById('chart-config');
            chartConfig.style.display = e.target.value === 'chart' ? 'block' : 'none';
        });
        
        // Handle generate button
        document.getElementById('generate-image-btn').addEventListener('click', async () => {
            const type = document.getElementById('image-type').value;
            const description = document.getElementById('image-description').value;
            
            if (!description.trim()) {
                showToast('Please provide a description', 'error');
                return;
            }
            
            try {
                const isSDEnabled = window.documentGenerator.imageGenerator.stableDiffusionAPI.enabled;
                let loadingMessage;
                
                if (type === 'chart') {
                    loadingMessage = 'Generating chart...';
                } else if (isSDEnabled) {
                    loadingMessage = 'Generating AI image... This may take 30-60 seconds';
                } else {
                    loadingMessage = 'Generating placeholder image...';
                }
                
                showLoading(loadingMessage);
                
                let imageData;
                if (type === 'chart') {
                    const data = document.getElementById('chart-data').value;
                    const labels = document.getElementById('chart-labels').value;
                    
                    const enhancedDescription = `${description} with data: ${data} and labels: ${labels}`;
                    imageData = await window.documentGenerator.imageGenerator.generateImage(enhancedDescription, 'chart');
                } else {
                    imageData = await window.documentGenerator.imageGenerator.generateImage(description, type);
                }
                
                // Insert image into document
                const imageMarkdown = `\n\n![${imageData.alt}](${imageData.url})\n*${imageData.caption}*\n\n`;
                this.wizardData.generatedContent += imageMarkdown;
                
                // Update preview
                this.updateDocumentPreview(this.wizardData.generatedContent);
                
                hideLoading();
                document.body.removeChild(dialog);
                showToast('Image added successfully!', 'success');
                
            } catch (error) {
                hideLoading();
                showToast('Error generating image: ' + error.message, 'error');
            }
        });
        
        // Handle cancel button
        document.getElementById('cancel-image-btn').addEventListener('click', () => {
            document.body.removeChild(dialog);
        });
    }

    /**
     * Regenerate document with automatic image suggestions
     */
    async regenerateDocumentWithImages() {
        if (!window.aiClient || !window.aiClient.isConnected) {
            showToast('AI not connected', 'error');
            return;
        }
        
        debugLog('AUTO_VISUALS', 'Starting automatic visual generation');
        console.log('\n========== AUTO-ADD VISUALS STARTED ==========');
        
        try {
            showLoading('Analyzing document and adding visuals...');
            
            debugLog('AUTO_VISUALS', 'Requesting image suggestions from AI');
            
            // Get image suggestions from AI
            const suggestions = await window.aiClient.generateImageDescriptions(
                this.wizardData.generatedContent, 
                this.wizardData.documentType
            );
            
            debugLog('AUTO_VISUALS', `AI suggested ${suggestions.length} images`, suggestions);
            
            // Limit to maximum 3 auto-generated images
            const limitedSuggestions = suggestions.slice(0, 3);
            console.log(`\n[AUTO-VISUALS] Processing ${limitedSuggestions.length} image suggestions:`);
            limitedSuggestions.forEach((s, i) => {
                console.log(`  ${i + 1}. Type: ${s.type}, Description: ${s.description}`);
            });
            
            // Process each suggestion
            let enhancedContent = this.wizardData.generatedContent;
            let imagesAdded = 0;
            
            for (let i = 0; i < limitedSuggestions.length; i++) {
                const suggestion = limitedSuggestions[i];
                console.log(`\n[IMAGE ${i + 1}/${limitedSuggestions.length}] Generating ${suggestion.type}: "${suggestion.description}"`);
                debugLog('IMAGE_GEN', `Starting generation ${i + 1}/${limitedSuggestions.length}`, suggestion);
                try {
                    const imageData = await window.documentGenerator.imageGenerator.generateImage(
                        suggestion.description, 
                        suggestion.type
                    );
                    
                    // For preview, use data URL directly
                    // We'll store images only when exporting
                    const imageUrl = imageData.url;
                    
                    // Find appropriate place to insert image
                    const imageMarkdown = `\n\n![${imageData.alt}](${imageUrl})\n*${suggestion.caption || imageData.caption}*\n\n`;
                    
                    // Simple insertion strategy: add after the section mentioned in placement
                    if (suggestion.placement) {
                        const placementRegex = new RegExp(`(${suggestion.placement}[^\n]*\n)`, 'i');
                        if (placementRegex.test(enhancedContent)) {
                            enhancedContent = enhancedContent.replace(placementRegex, `$1${imageMarkdown}`);
                        } else {
                            // If placement not found, add at the end
                            enhancedContent += imageMarkdown;
                        }
                    } else {
                        enhancedContent += imageMarkdown;
                    }
                    
                    imagesAdded++;
                    console.log(`[IMAGE ${i + 1}/${limitedSuggestions.length}] ✓ Successfully generated and added to document`);
                    debugLog('IMAGE_GEN', `Completed generation ${i + 1}/${limitedSuggestions.length}`);
                    
                } catch (error) {
                    console.error(`[IMAGE ${i + 1}/${limitedSuggestions.length}] ✗ Failed:`, error.message);
                    debugLog('IMAGE_GEN_ERROR', `Failed generation ${i + 1}/${limitedSuggestions.length}`, error);
                }
            }
            
            // Update content
            this.wizardData.generatedContent = enhancedContent;
            this.updateDocumentPreview(enhancedContent);
            
            hideLoading();
            console.log(`\n========== AUTO-ADD VISUALS COMPLETED ==========`);
            console.log(`Total images added: ${imagesAdded}`);
            console.log('==============================================\n');
            debugLog('AUTO_VISUALS', `Completed - ${imagesAdded} images added`);
            
            showToast(`Added ${imagesAdded} visual elements to your document!`, 'success');
            
        } catch (error) {
            hideLoading();
            showToast('Error adding visuals: ' + error.message, 'error');
        }
    }
}

/**
 * Navigation functions
 */
function nextStep() {
    if (window.app && window.app.currentStepIndex < window.app.steps.length - 1 && window.app.isCurrentStepValid()) {
        window.app.currentStepIndex++;
        window.app.updateStepsNavigation();
        window.app.updateWizardContent();
    }
}

function previousStep() {
    if (window.app && window.app.currentStepIndex > 0) {
        window.app.currentStepIndex--;
        window.app.updateStepsNavigation();
        window.app.updateWizardContent();
    }
}

/**
 * Utility functions - now provided by init.js
 */
const showLoading = window.showLoading;
const hideLoading = window.hideLoading;
const showToast = window.showToast;

// Initialize the application when the page loads
document.addEventListener('DOMContentLoaded', () => {
    window.app = new DocumentWriterApp();
    
    // Add navigation button event listeners
    document.getElementById('prev-btn').addEventListener('click', previousStep);
    document.getElementById('next-btn').addEventListener('click', nextStep);
    
    // Add help button listener
    const helpBtn = document.getElementById('help-button');
    if (helpBtn) {
        helpBtn.addEventListener('click', () => {
            if (window.keyboardShortcuts) {
                window.keyboardShortcuts.showHelp();
            }
        });
    }
    
    // Add new feature button listeners
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) {
        shareBtn.addEventListener('click', () => {
            if (window.shareDocument) {
                window.shareDocument.showShareDialog();
            }
        });
    }
    
    const versionBtn = document.getElementById('version-btn');
    if (versionBtn) {
        versionBtn.addEventListener('click', () => {
            if (window.versionHistory) {
                window.versionHistory.showVersionHistory();
            }
        });
    }
    
    const exportBtn = document.getElementById('export-btn');
    if (exportBtn) {
        exportBtn.addEventListener('click', () => {
            if (window.exportImport) {
                window.exportImport.exportDocument();
            }
        });
    }
    
    const printBtn = document.getElementById('print-btn');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            if (window.printPreview) {
                window.printPreview.showPrintSettings();
            }
        });
    }
    
    const statsBtn = document.getElementById('stats-btn');
    if (statsBtn) {
        statsBtn.addEventListener('click', () => {
            if (window.documentStats) {
                window.documentStats.showDetailedStats();
            }
        });
    }
    
    // Handle page unload
    window.addEventListener('beforeunload', () => {
        if (window.app) {
            window.app.cleanup();
        }
    });
});