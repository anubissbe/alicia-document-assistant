import * as vscode from 'vscode';
import * as path from 'path';
import { WebviewStateProvider, WebviewStateManager } from '../models/webviewState';
import { DocumentService } from '../services/documentService';
import { TemplateManagerService } from '../services/templateManagerService';

/**
 * Document type enumeration
 */
export enum DocumentType {
    Business = 'business',
    Technical = 'technical',
    Academic = 'academic',
    Letter = 'letter',
    Report = 'report',
    Custom = 'custom'
}

/**
 * Wizard step interface
 */
export interface WizardStep {
    id: string;
    title: string;
    description: string;
    optional: boolean;
    completed: boolean;
}

/**
 * Wizard state interface
 */
export interface WizardState {
    currentStepIndex: number;
    steps: WizardStep[];
    documentType?: DocumentType;
    templateId?: string;
    documentTitle?: string;
    documentData: Record<string, any>;
    progress: number;
}

/**
 * Document Creation Wizard Provider
 * Provides a step-by-step wizard for creating documents
 */
export class DocumentCreationWizard implements WebviewStateProvider {
    private static readonly viewType = 'documentWriter.documentCreationWizard';
    private _panel?: vscode.WebviewPanel;
    private _extensionUri: vscode.Uri;
    private _documentService: DocumentService;
    private _templateService: TemplateManagerService;
    private readonly _stateId: string = 'documentWizard';
    
    private _state: WizardState = {
        currentStepIndex: 0,
        steps: [
            {
                id: 'document-type',
                title: 'Select Document Type',
                description: 'Choose the type of document you want to create',
                optional: false,
                completed: false
            },
            {
                id: 'template-selection',
                title: 'Select Template',
                description: 'Choose a template for your document',
                optional: false,
                completed: false
            },
            {
                id: 'document-details',
                title: 'Document Details',
                description: 'Enter basic document information',
                optional: false,
                completed: false
            },
            {
                id: 'content-sections',
                title: 'Content Sections',
                description: 'Define the content sections for your document',
                optional: false,
                completed: false
            },
            {
                id: 'review',
                title: 'Review',
                description: 'Review your document before creating it',
                optional: false,
                completed: false
            }
        ],
        documentData: {},
        progress: 0
    };
    
    /**
     * Constructor
     * @param extensionUri Extension URI
     * @param documentService Document service
     * @param templateService Template manager service
     */
    constructor(
        extensionUri: vscode.Uri,
        documentService: DocumentService,
        templateService: TemplateManagerService
    ) {
        this._extensionUri = extensionUri;
        this._documentService = documentService;
        this._templateService = templateService;
        
        // Load saved state
        this.loadState().catch(error => {
            console.error('Failed to load wizard state:', error);
        });
        
        // Register commands
        this._registerCommands();
    }
    
    /**
     * Get the webview state ID
     * @returns Webview state ID
     */
    public getStateId(): string {
        return this._stateId;
    }
    
    /**
     * Get the webview state type
     * @returns Webview state type
     */
    public getStateType(): string {
        return 'wizard';
    }
    
    /**
     * Save current state
     */
    public async saveState(): Promise<void> {
        const stateManager = WebviewStateManager.getInstance();
        const savedState = stateManager.getState(this.getStateId());
        
        if (savedState) {
            stateManager.updateState(this.getStateId(), {
                currentStepIndex: this._state.currentStepIndex,
                steps: this._state.steps,
                documentType: this._state.documentType,
                templateId: this._state.templateId,
                documentTitle: this._state.documentTitle,
                documentData: this._state.documentData,
                progress: this._calculateProgress()
            });
        } else {
            stateManager.createState(this.getStateId(), this.getStateType(), {
                currentStepIndex: this._state.currentStepIndex,
                steps: this._state.steps,
                documentType: this._state.documentType,
                templateId: this._state.templateId,
                documentTitle: this._state.documentTitle,
                documentData: this._state.documentData,
                progress: this._calculateProgress()
            });
        }
    }
    
    /**
     * Load saved state
     * @returns Promise resolving to true if state was loaded, false otherwise
     */
    public async loadState(): Promise<boolean> {
        const stateManager = WebviewStateManager.getInstance();
        const savedState = stateManager.getState(this.getStateId());
        
        if (savedState && savedState.data) {
            const data = savedState.data;
            
            // Update state with saved values
            this._state = {
                ...this._state,
                currentStepIndex: data.currentStepIndex !== undefined ? data.currentStepIndex : 0,
                steps: data.steps || this._state.steps,
                documentType: data.documentType,
                templateId: data.templateId,
                documentTitle: data.documentTitle,
                documentData: data.documentData || {},
                progress: data.progress || 0
            };
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Register commands
     */
    private _registerCommands(): void {
        vscode.commands.registerCommand('documentWriter.openDocumentWizard', () => {
            this.showWizard();
        });
        
        vscode.commands.registerCommand('documentWriter.resetWizard', () => {
            this._resetWizard();
        });
    }
    
    /**
     * Reset wizard state
     */
    private _resetWizard(): void {
        // Reset state to initial values
        this._state = {
            currentStepIndex: 0,
            steps: this._state.steps.map(step => ({
                ...step,
                completed: false
            })),
            documentData: {},
            progress: 0
        };
        
        // Save reset state
        this.saveState();
        
        // If panel is open, update it
        if (this._panel) {
            this._updateWizardContent();
        }
    }
    
    /**
     * Calculate current progress percentage
     * @returns Progress percentage (0-100)
     */
    private _calculateProgress(): number {
        const completedSteps = this._state.steps.filter(step => step.completed).length;
        const requiredSteps = this._state.steps.filter(step => !step.optional).length;
        
        return Math.round((completedSteps / requiredSteps) * 100);
    }
    
    /**
     * Update progress indicator
     */
    private _updateProgress(): void {
        // Calculate progress
        this._state.progress = this._calculateProgress();
        
        // Save state
        this.saveState();
        
        // Update UI if panel exists
        if (this._panel && this._panel.webview) {
            this._panel.webview.postMessage({
                command: 'updateProgress',
                progress: this._state.progress
            });
        }
    }
    
    /**
     * Get step HTML
     * @param step Wizard step
     * @param index Step index
     * @param current Whether this is the current step
     * @returns HTML for the step
     */
    private _getStepHtml(step: WizardStep, index: number, current: boolean): string {
        return `
        <div class="wizard-step ${current ? 'current' : ''} ${step.completed ? 'completed' : ''}" id="step-${step.id}">
            <div class="step-header">
                <div class="step-number">
                    ${step.completed 
                        ? '<span class="step-checkmark">✓</span>' 
                        : `<span class="step-index">${index + 1}</span>`}
                </div>
                <div class="step-title">${step.title}</div>
            </div>
            <div class="step-description">${step.description}</div>
            <div class="step-content">
                ${this._getStepContentHtml(step)}
            </div>
            <div class="step-validation-message"></div>
        </div>`;
    }
    
    /**
     * Get step content HTML based on step ID
     * @param step Wizard step
     * @returns HTML for the step content
     */
    private _getStepContentHtml(step: WizardStep): string {
        switch (step.id) {
            case 'document-type':
                return this._getDocumentTypeSelectionHtml();
                
            case 'template-selection':
                return this._getTemplateSelectionHtml();
                
            case 'document-details':
                return this._getDocumentDetailsHtml();
                
            case 'content-sections':
                return this._getContentSectionsHtml();
                
            case 'review':
                return this._getReviewHtml();
                
            default:
                return `<div class="empty-step-content">No content for step ${step.id}</div>`;
        }
    }
    
    /**
     * Get document type selection HTML
     * @returns HTML for document type selection
     */
    private _getDocumentTypeSelectionHtml(): string {
        return `
        <div class="document-type-grid">
            <div class="document-type-card ${this._state.documentType === DocumentType.Business ? 'selected' : ''}" data-type="${DocumentType.Business}">
                <div class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect>
                        <path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path>
                    </svg>
                </div>
                <div class="card-title">Business</div>
                <div class="card-description">Business reports, proposals, and letters</div>
            </div>
            
            <div class="document-type-card ${this._state.documentType === DocumentType.Technical ? 'selected' : ''}" data-type="${DocumentType.Technical}">
                <div class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <polyline points="16 18 22 12 16 6"></polyline>
                        <polyline points="8 6 2 12 8 18"></polyline>
                    </svg>
                </div>
                <div class="card-title">Technical</div>
                <div class="card-description">Technical documentation, specifications, and manuals</div>
            </div>
            
            <div class="document-type-card ${this._state.documentType === DocumentType.Academic ? 'selected' : ''}" data-type="${DocumentType.Academic}">
                <div class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
                        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
                    </svg>
                </div>
                <div class="card-title">Academic</div>
                <div class="card-description">Academic papers, research reports, and essays</div>
            </div>
            
            <div class="document-type-card ${this._state.documentType === DocumentType.Letter ? 'selected' : ''}" data-type="${DocumentType.Letter}">
                <div class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"></path>
                        <polyline points="22,6 12,13 2,6"></polyline>
                    </svg>
                </div>
                <div class="card-title">Letter</div>
                <div class="card-description">Formal and informal letters</div>
            </div>
            
            <div class="document-type-card ${this._state.documentType === DocumentType.Report ? 'selected' : ''}" data-type="${DocumentType.Report}">
                <div class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
                        <polyline points="14 2 14 8 20 8"></polyline>
                        <line x1="16" y1="13" x2="8" y2="13"></line>
                        <line x1="16" y1="17" x2="8" y2="17"></line>
                        <polyline points="10 9 9 9 8 9"></polyline>
                    </svg>
                </div>
                <div class="card-title">Report</div>
                <div class="card-description">General reports and data analysis</div>
            </div>
            
            <div class="document-type-card ${this._state.documentType === DocumentType.Custom ? 'selected' : ''}" data-type="${DocumentType.Custom}">
                <div class="card-icon">
                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                </div>
                <div class="card-title">Custom</div>
                <div class="card-description">Create a custom document</div>
            </div>
        </div>`;
    }
    
    /**
     * Get template selection HTML
     * @returns HTML for template selection
     */
    private _getTemplateSelectionHtml(): string {
        // If no document type is selected, show a message
        if (!this._state.documentType) {
            return `
            <div class="empty-step-message">
                <p>Please select a document type first.</p>
                <button class="wizard-button secondary" data-action="prevStep">Go Back</button>
            </div>`;
        }
        
        // Otherwise, show templates for the selected document type
        return `
        <div class="template-selection">
            <div class="template-filter">
                <input type="text" class="template-search" placeholder="Search templates" />
                <div class="template-filter-buttons">
                    <button class="filter-button active" data-filter="all">All</button>
                    <button class="filter-button" data-filter="recent">Recent</button>
                    <button class="filter-button" data-filter="favorites">Favorites</button>
                </div>
            </div>
            
            <div class="template-grid" id="template-grid">
                <!-- Templates will be loaded dynamically -->
                <div class="template-loading">Loading templates...</div>
            </div>
        </div>`;
    }
    
    /**
     * Get document details HTML
     * @returns HTML for document details
     */
    private _getDocumentDetailsHtml(): string {
        // If no template is selected, show a message
        if (!this._state.templateId) {
            return `
            <div class="empty-step-message">
                <p>Please select a template first.</p>
                <button class="wizard-button secondary" data-action="prevStep">Go Back</button>
            </div>`;
        }
        
        // Otherwise, show document details form
        return `
        <div class="document-details-form">
            <div class="form-group">
                <label for="document-title">Document Title</label>
                <input type="text" id="document-title" class="form-control" value="${this._state.documentTitle || ''}" placeholder="Enter document title" required />
            </div>
            
            <div class="form-group">
                <label for="document-description">Description (Optional)</label>
                <textarea id="document-description" class="form-control" placeholder="Enter document description">${this._state.documentData.description || ''}</textarea>
            </div>
            
            <div class="form-group">
                <label for="document-author">Author</label>
                <input type="text" id="document-author" class="form-control" value="${this._state.documentData.author || ''}" placeholder="Enter author name" />
            </div>
            
            <div class="form-group">
                <label for="document-date">Date</label>
                <input type="date" id="document-date" class="form-control" value="${this._state.documentData.date || new Date().toISOString().split('T')[0]}" />
            </div>
        </div>`;
    }
    
    /**
     * Get content sections HTML
     * @returns HTML for content sections
     */
    private _getContentSectionsHtml(): string {
        // If no document title is set, show a message
        if (!this._state.documentTitle) {
            return `
            <div class="empty-step-message">
                <p>Please enter document details first.</p>
                <button class="wizard-button secondary" data-action="prevStep">Go Back</button>
            </div>`;
        }
        
        // Otherwise, show content sections form
        return `
        <div class="content-sections">
            <div class="sections-intro">
                <p>Define the content sections for your document. You can add, remove, and reorder sections as needed.</p>
            </div>
            
            <div class="sections-list" id="sections-list">
                ${this._getSectionsList()}
            </div>
            
            <div class="sections-actions">
                <button class="wizard-button secondary" data-action="addSection">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="16"></line>
                        <line x1="8" y1="12" x2="16" y2="12"></line>
                    </svg>
                    Add Section
                </button>
            </div>
        </div>`;
    }
    
    /**
     * Get sections list HTML
     * @returns HTML for sections list
     */
    private _getSectionsList(): string {
        const sections = this._state.documentData.sections || [];
        
        if (sections.length === 0) {
            return `
            <div class="empty-sections">
                <p>No sections defined. Click "Add Section" to create your first section.</p>
            </div>`;
        }
        
        return sections.map((section: any, index: number) => `
        <div class="section-item" data-index="${index}">
            <div class="section-header">
                <div class="section-drag-handle">
                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="8" y1="6" x2="21" y2="6"></line>
                        <line x1="8" y1="12" x2="21" y2="12"></line>
                        <line x1="8" y1="18" x2="21" y2="18"></line>
                        <line x1="3" y1="6" x2="3.01" y2="6"></line>
                        <line x1="3" y1="12" x2="3.01" y2="12"></line>
                        <line x1="3" y1="18" x2="3.01" y2="18"></line>
                    </svg>
                </div>
                <div class="section-title">${section.title}</div>
                <div class="section-actions">
                    <button class="section-action" data-action="editSection" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                        </svg>
                    </button>
                    <button class="section-action" data-action="removeSection" data-index="${index}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polyline points="3 6 5 6 21 6"></polyline>
                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                        </svg>
                    </button>
                </div>
            </div>
            <div class="section-preview">
                ${section.content ? `<p>${section.content.substring(0, 100)}${section.content.length > 100 ? '...' : ''}</p>` : '<p class="empty-content">No content</p>'}
            </div>
        </div>
        `).join('');
    }
    
    /**
     * Get review HTML
     * @returns HTML for review step
     */
    private _getReviewHtml(): string {
        // Check if we have all required data
        if (!this._state.documentTitle || !this._state.templateId) {
            return `
            <div class="empty-step-message">
                <p>Please complete all previous steps first.</p>
                <button class="wizard-button secondary" data-action="prevStep">Go Back</button>
            </div>`;
        }
        
        // Get document data
        const sections = this._state.documentData.sections || [];
        
        return `
        <div class="document-review">
            <div class="review-section">
                <h3>Document Type</h3>
                <p>${this._state.documentType}</p>
            </div>
            
            <div class="review-section">
                <h3>Template</h3>
                <p>${this._state.templateId}</p>
            </div>
            
            <div class="review-section">
                <h3>Document Details</h3>
                <table class="review-table">
                    <tr>
                        <th>Title</th>
                        <td>${this._state.documentTitle}</td>
                    </tr>
                    <tr>
                        <th>Description</th>
                        <td>${this._state.documentData.description || '<em>None</em>'}</td>
                    </tr>
                    <tr>
                        <th>Author</th>
                        <td>${this._state.documentData.author || '<em>None</em>'}</td>
                    </tr>
                    <tr>
                        <th>Date</th>
                        <td>${this._state.documentData.date || '<em>None</em>'}</td>
                    </tr>
                </table>
            </div>
            
            <div class="review-section">
                <h3>Content Sections (${sections.length})</h3>
                ${sections.length > 0 ? `
                <div class="sections-summary">
                    <ol>
                        ${sections.map((section: any) => `<li>${section.title}</li>`).join('')}
                    </ol>
                </div>` : '<p><em>No sections defined</em></p>'}
            </div>
            
            <div class="review-actions">
                <button class="wizard-button primary" data-action="createDocument">Create Document</button>
                <button class="wizard-button secondary" data-action="editDocument">Edit</button>
            </div>
        </div>`;
    }
    
    /**
     * Get progress indicator HTML
     * @returns HTML for progress indicator
     */
    private _getProgressIndicatorHtml(): string {
        const progress = this._calculateProgress();
        
        return `
        <div class="wizard-progress">
            <div class="progress-bar">
                <div class="progress-value" style="width: ${progress}%"></div>
            </div>
            <div class="progress-text">${progress}% Complete</div>
        </div>`;
    }
    
    /**
     * Get steps navigation HTML
     * @returns HTML for steps navigation
     */
    private _getStepsNavigationHtml(): string {
        return `
        <div class="steps-navigation">
            ${this._state.steps.map((step, index) => `
            <div class="step-nav-item ${index === this._state.currentStepIndex ? 'current' : ''} ${step.completed ? 'completed' : ''}" data-step-index="${index}">
                <div class="step-nav-number">
                    ${step.completed 
                        ? '<span class="step-nav-checkmark">✓</span>' 
                        : `<span>${index + 1}</span>`}
                </div>
                <div class="step-nav-title">${step.title}</div>
            </div>
            `).join('')}
        </div>`;
    }
    
    /**
     * Get navigation buttons HTML
     * @returns HTML for navigation buttons
     */
    private _getNavigationButtonsHtml(): string {
        const currentIndex = this._state.currentStepIndex;
        const isFirstStep = currentIndex === 0;
        const isLastStep = currentIndex === this._state.steps.length - 1;
        
        return `
        <div class="wizard-navigation">
            <button class="wizard-button secondary" data-action="prevStep" ${isFirstStep ? 'disabled' : ''}>
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                </svg>
                Previous
            </button>
            <button class="wizard-button primary" data-action="nextStep" ${isLastStep ? 'disabled' : ''}>
                Next
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                    <line x1="5" y1="12" x2="19" y2="12"></line>
                    <polyline points="12 5 19 12 12 19"></polyline>
                </svg>
            </button>
        </div>`;
    }
    
    /**
     * Set up webview message listener
     * @param webview The webview
     */
    private _setWebviewMessageListener(webview: vscode.Webview): void {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'ready':
                        // Webview is ready, load templates if needed
                        if (this._state.documentType && this._state.currentStepIndex === 1) {
                            this._loadTemplates(this._state.documentType);
                        }
                        break;
                        
                    case 'prevStep':
                        this._navigateToPreviousStep();
                        break;
                        
                    case 'nextStep':
                        this._navigateToNextStep();
                        break;
                        
                    case 'validateStep':
                        this._validateCurrentStep(message.data);
                        break;
                        
                    case 'setDocumentType':
                        this._setDocumentType(message.documentType);
                        break;
                        
                    case 'selectTemplate':
                        this._selectTemplate(message.templateId);
                        break;
                        
                    case 'updateDocumentDetails':
                        this._updateDocumentDetails(message.details);
                        break;
                        
                    case 'addSection':
                        this._addSection();
                        break;
                        
                    case 'editSection':
                        this._editSection(message.index, message.section);
                        break;
                        
                    case 'removeSection':
                        this._removeSection(message.index);
                        break;
                        
                    case 'createDocument':
                        this._createDocument();
                        break;
                }
            }
        );
    }
    
    /**
     * Set document type
     * @param documentType The document type
     */
    private _setDocumentType(documentType: DocumentType): void {
        this._state.documentType = documentType;
        
        // Mark step as completed
        if (this._state.currentStepIndex === 0) {
            this._state.steps[0].completed = true;
        }
        
        // Save state
        this.saveState();
        
        // Update progress
        this._updateProgress();
        
        // Load templates if we're on the template selection step
        if (this._state.currentStepIndex === 1) {
            this._loadTemplates(documentType);
        }
    }
    
    /**
     * Load templates for document type
     * @param documentType Document type to load templates for
     */
    private async _loadTemplates(documentType: DocumentType): Promise<void> {
        if (!this._panel || !this._panel.webview) {
            return;
        }
        
        try {
            // Get templates from template service (synchronous call)
            const templates = this._templateService.getTemplates();
            console.log('Loaded templates:', templates);
            
            // Filter templates by document type
            const filteredTemplates = templates.filter(template => {
                if (!template.metadata) {
                    console.log('Template has no metadata:', template);
                    return false;
                }
                return template.metadata.category === documentType;
            });
            
            console.log('Filtered templates for', documentType, ':', filteredTemplates);
            
            // Send filtered templates to webview
            this._panel.webview.postMessage({
                command: 'templatesLoaded',
                templates: filteredTemplates
            });
            
        } catch (error) {
            console.error('Error loading templates:', error);
            
            // Send error to webview
            this._panel.webview.postMessage({
                command: 'templatesError',
                error: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * Select template
     * @param templateId Template ID
     */
    private _selectTemplate(templateId: string): void {
        this._state.templateId = templateId;
        
        // Mark step as completed
        if (this._state.currentStepIndex === 1) {
            this._state.steps[1].completed = true;
        }
        
        // Save state
        this.saveState();
        
        // Update progress
        this._updateProgress();
    }
    
    /**
     * Update document details
     * @param details Document details
     */
    private _updateDocumentDetails(details: any): void {
        // Update state
        this._state.documentTitle = details.title;
        this._state.documentData = {
            ...this._state.documentData,
            description: details.description,
            author: details.author,
            date: details.date
        };
        
        // Mark step as completed if title is set
        if (this._state.currentStepIndex === 2 && this._state.documentTitle) {
            this._state.steps[2].completed = true;
        }
        
        // Save state
        this.saveState();
        
        // Update progress
        this._updateProgress();
    }
    
    /**
     * Add a new section
     */
    private _addSection(): void {
        // Create sections array if it doesn't exist
        if (!this._state.documentData.sections) {
            this._state.documentData.sections = [];
        }
        
        // Add new section
        this._state.documentData.sections.push({
            title: 'New Section',
            content: ''
        });
        
        // Mark step as completed if we have at least one section
        if (this._state.currentStepIndex === 3 && this._state.documentData.sections.length > 0) {
            this._state.steps[3].completed = true;
        }
        
        // Save state
        this.saveState();
        
        // Update progress
        this._updateProgress();
        
        // Update webview
        this._updateSectionsList();
    }
    
    /**
     * Edit section
     * @param index Section index
     * @param section Section data
     */
    private _editSection(index: number, section: any): void {
        // Create sections array if it doesn't exist
        if (!this._state.documentData.sections) {
            this._state.documentData.sections = [];
        }
        
        // Update section if index is valid
        if (index >= 0 && index < this._state.documentData.sections.length) {
            this._state.documentData.sections[index] = {
                ...this._state.documentData.sections[index],
                ...section
            };
        }
        
        // Save state
        this.saveState();
        
        // Update webview
        this._updateSectionsList();
    }
    
    /**
     * Remove section
     * @param index Section index
     */
    private _removeSection(index: number): void {
        // Create sections array if it doesn't exist
        if (!this._state.documentData.sections) {
            this._state.documentData.sections = [];
        }
        
        // Remove section if index is valid
        if (index >= 0 && index < this._state.documentData.sections.length) {
            this._state.documentData.sections.splice(index, 1);
        }
        
        // Update completion status
        if (this._state.currentStepIndex === 3) {
            this._state.steps[3].completed = this._state.documentData.sections.length > 0;
        }
        
        // Save state
        this.saveState();
        
        // Update progress
        this._updateProgress();
        
        // Update webview
        this._updateSectionsList();
    }
    
    /**
     * Update sections list in webview
     */
    private _updateSectionsList(): void {
        if (!this._panel || !this._panel.webview) {
            return;
        }
        
        this._panel.webview.postMessage({
            command: 'updateSectionsList',
            sections: this._state.documentData.sections || []
        });
    }
    
    /**
     * Create document
     */
    private async _createDocument(): Promise<void> {
        if (!this._panel || !this._panel.webview) {
            return;
        }
        
        // Check if we have all required data
        if (!this._state.documentTitle || !this._state.templateId) {
            this._panel.webview.postMessage({
                command: 'error',
                message: 'Document title and template are required'
            });
            return;
        }
        
        try {
            // Show loading indicator
            this._panel.webview.postMessage({
                command: 'showLoading',
                message: 'Creating document...'
            });
            
            // Create document
            const document = await this._documentService.createDocument(
                this._state.documentTitle || 'Untitled Document',
                this._state.templateId || '',
                this._state.documentType || DocumentType.Business
            );
            
            // Mark all steps as completed
            this._state.steps.forEach(step => {
                step.completed = true;
            });
            
            // Update progress
            this._updateProgress();
            
            // Show success message
            this._panel.webview.postMessage({
                command: 'documentCreated',
                document
            });
            
            // Save state
            this.saveState();
            
        } catch (error) {
            console.error('Error creating document:', error);
            
            // Show error message
            this._panel.webview.postMessage({
                command: 'error',
                message: error instanceof Error ? error.message : 'Unknown error'
            });
        }
    }
    
    /**
     * Navigate to previous step
     */
    private _navigateToPreviousStep(): void {
        // Check if we're already at the first step
        if (this._state.currentStepIndex === 0) {
            return;
        }
        
        // Update current step index
        this._state.currentStepIndex--;
        
        // Save state
        this.saveState();
        
        // Update webview
        this._updateWizardContent();
    }
    
    /**
     * Navigate to next step
     */
    private _navigateToNextStep(): void {
        // Validate current step
        if (!this._validateCurrentStep()) {
            return;
        }
        
        // Check if we're already at the last step
        if (this._state.currentStepIndex === this._state.steps.length - 1) {
            return;
        }
        
        // Update current step index
        this._state.currentStepIndex++;
        
        // Save state
        this.saveState();
        
        // Update webview
        this._updateWizardContent();
    }
    
    /**
     * Validate current step
     * @param data Optional validation data
     * @returns True if valid, false otherwise
     */
    private _validateCurrentStep(data?: any): boolean {
        const currentStep = this._state.steps[this._state.currentStepIndex];
        
        switch (currentStep.id) {
            case 'document-type':
                // Document type step is valid if a document type is selected
                const isValid = !!this._state.documentType;
                if (isValid) {
                    currentStep.completed = true;
                }
                return isValid;
                
            case 'template-selection':
                // Template selection step is valid if a template is selected
                const templateValid = !!this._state.templateId;
                if (templateValid) {
                    currentStep.completed = true;
                }
                return templateValid;
                
            case 'document-details':
                // Document details step is valid if a title is provided
                const detailsValid = !!this._state.documentTitle;
                if (detailsValid) {
                    currentStep.completed = true;
                }
                return detailsValid;
                
            case 'content-sections':
                // Content sections step is always valid, but completion depends on having at least one section
                const sectionsValid = (this._state.documentData.sections || []).length > 0;
                if (sectionsValid) {
                    currentStep.completed = true;
                }
                return true;
                
            case 'review':
                // Review step is always valid
                currentStep.completed = true;
                return true;
                
            default:
                return false;
        }
    }
    
    /**
     * Update wizard content
     */
    private _updateWizardContent(): void {
        if (!this._panel || !this._panel.webview) {
            return;
        }
        
        // Get current step
        const currentStep = this._state.steps[this._state.currentStepIndex];
        
        // Update webview
        this._panel.webview.postMessage({
            command: 'updateStep',
            stepIndex: this._state.currentStepIndex,
            stepId: currentStep.id,
            stepContent: this._getStepContentHtml(currentStep)
        });
        
        // Update progress
        this._panel.webview.postMessage({
            command: 'updateProgress',
            progress: this._calculateProgress()
        });
        
        // Update steps navigation
        this._panel.webview.postMessage({
            command: 'updateStepsNavigation',
            stepsNavigation: this._getStepsNavigationHtml()
        });
        
        // Load templates if needed
        if (currentStep.id === 'template-selection' && this._state.documentType) {
            this._loadTemplates(this._state.documentType);
        }
    }
    
    /**
     * Show wizard
     */
    public showWizard(): void {
        // If panel already exists, show it
        if (this._panel) {
            this._panel.reveal(vscode.ViewColumn.One);
            return;
        }
        
        // Create webview panel
        this._panel = vscode.window.createWebviewPanel(
            DocumentCreationWizard.viewType,
            'Create Document',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'media')
                ]
            }
        );
        
        // Set panel icon
        this._panel.iconPath = {
            light: vscode.Uri.joinPath(this._extensionUri, 'resources', 'icons', 'light', 'document.svg'),
            dark: vscode.Uri.joinPath(this._extensionUri, 'resources', 'icons', 'dark', 'document.svg')
        };
        
        // Set webview HTML
        this._panel.webview.html = this._getWebviewHtml();
        
        // Set up message listener
        this._setWebviewMessageListener(this._panel.webview);
        
        // Handle panel disposal
        this._panel.onDidDispose(() => {
            this._panel = undefined;
        });
    }
    
    /**
     * Get webview HTML
     * @returns Webview HTML
     */
    private _getWebviewHtml(): string {
        if (!this._panel) {
            return '';
        }
        
        // Get media URIs
        const styleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentWizard.css')
        );
        
        const responsiveStyleUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'responsive.css')
        );
        
        const scriptUri = this._panel.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentWizard.js')
        );
        
        // Create nonce for script security
        const nonce = getNonce();
        
        // Get current step
        const currentStepIndex = this._state.currentStepIndex;
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${this._panel.webview.cspSource}; script-src 'nonce-${nonce}'; img-src ${this._panel.webview.cspSource} data:;">
            <title>Document Creation Wizard</title>
            <link href="${styleUri}" rel="stylesheet" />
            <link href="${responsiveStyleUri}" rel="stylesheet" />
        </head>
        <body>
            <div class="wizard-container">
                ${this._getProgressIndicatorHtml()}
                
                ${this._getStepsNavigationHtml()}
                
                <div class="wizard-content">
                    ${this._state.steps.map((step, index) => 
                        this._getStepHtml(step, index, index === currentStepIndex)
                    ).join('')}
                </div>
                
                ${this._getNavigationButtonsHtml()}
            </div>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
            <script nonce="${nonce}">
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // Store wizard state
                    const state = {
                        currentStepIndex: ${this._state.currentStepIndex},
                        steps: ${JSON.stringify(this._state.steps)},
                        documentType: ${this._state.documentType ? `"${this._state.documentType}"` : 'null'},
                        templateId: ${this._state.templateId ? `"${this._state.templateId}"` : 'null'},
                        documentTitle: ${this._state.documentTitle ? `"${this._state.documentTitle}"` : 'null'},
                        documentData: ${JSON.stringify(this._state.documentData)},
                        progress: ${this._state.progress}
                    };
                    
                    // Initialize wizard
                    document.addEventListener('DOMContentLoaded', () => {
                        initializeWizard(vscode, state);
                        
                        // Let VS Code know we're ready
                        vscode.postMessage({ command: 'ready' });
                    });
                }());
            </script>
        </body>
        </html>`;
    }
    
    /**
     * Get nonce for script security
     * @returns Random nonce string
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }
}

/**
 * Get nonce for script security
 * @returns A random string for use in script nonce attribute
 */
function getNonce(): string {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
