import * as vscode from 'vscode';
import { DocumentService } from '../services/documentService';
import { TemplateManagerService } from '../services/templateManagerService';
import * as path from 'path';
import * as crypto from 'crypto';

/**
 * Get a nonce to use in HTML to avoid script injection attacks
 * @returns A random string for use in script nonce attribute
 */
function getNonce() {
    return crypto.randomBytes(16).toString('base64');
}

/**
 * Interface for wizard step definition
 */
export interface WizardStep {
    id: string;
    title: string;
    description: string;
    inputs: WizardInput[];
    required: string[];
    next?: string;
    previous?: string;
    validate: (values: Record<string, any>) => string | null;
}

/**
 * Interface for wizard input field
 */
export interface WizardInput {
    id: string;
    label: string;
    type: 'text' | 'textarea' | 'select' | 'radio' | 'checkbox' | 'file';
    placeholder?: string;
    options?: Array<{ value: string, label: string }>;
    default?: string | string[] | boolean;
    required?: boolean;
    helpText?: string;
    condition?: {
        field: string;
        value: string | string[] | boolean;
    };
    validation?: RegExp;
}

/**
 * Interface for document creation data
 */
export interface DocumentCreationData {
    documentType: string;
    templateId?: string;
    title: string;
    description?: string;
    author?: string;
    sections?: string[];
    customFields?: Record<string, any>;
    outputFormat: string;
    outputPath?: string;
    [key: string]: any;
}

/**
 * Interface for template section
 */
interface TemplateSection {
    id: string;
    name: string;
}

/**
 * Interface for template
 */
interface Template {
    id: string;
    name: string;
    type: string;
    sections?: TemplateSection[];
}

/**
 * Interface for created document
 */
interface CreatedDocument {
    title: string;
    path?: string;
}

/**
 * Provider for the document creation wizard webview
 */
export class DocumentCreationWizard {
    private _panel?: vscode.WebviewPanel;
    private _extensionUri: vscode.Uri;
    private _documentService: DocumentService;
    private _templateManagerService: TemplateManagerService;
    private _steps: WizardStep[] = [];
    private _currentStepId: string = '';
    private _data: DocumentCreationData = {
        documentType: '',
        title: '',
        outputFormat: 'docx'
    };
    
    /**
     * Constructor
     * @param extensionUri The URI of the extension
     * @param documentService The document service
     * @param templateManagerService The template manager service
     */
    constructor(
        extensionUri: vscode.Uri,
        documentService: DocumentService,
        templateManagerService: TemplateManagerService
    ) {
        this._extensionUri = extensionUri;
        this._documentService = documentService;
        this._templateManagerService = templateManagerService;
        this._initializeSteps();
    }
    
    /**
     * Initialize the wizard steps
     */
    private _initializeSteps(): void {
        // Step 1: Document Type Selection
        this._steps.push({
            id: 'document-type',
            title: 'Select Document Type',
            description: 'Choose the type of document you want to create.',
            inputs: [
                {
                    id: 'documentType',
                    label: 'Document Type',
                    type: 'select',
                    options: [
                        { value: 'business-report', label: 'Business Report' },
                        { value: 'technical-specification', label: 'Technical Specification' },
                        { value: 'proposal', label: 'Proposal' },
                        { value: 'letter', label: 'Letter' },
                        { value: 'manual', label: 'User Manual' },
                        { value: 'data-analysis', label: 'Data Analysis Report' },
                        { value: 'custom', label: 'Custom Document' }
                    ],
                    required: true
                }
            ],
            required: ['documentType'],
            next: 'template-selection',
            validate: (values) => {
                if (!values.documentType) {
                    return 'Please select a document type';
                }
                return null;
            }
        });
        
        // Step 2: Template Selection
        this._steps.push({
            id: 'template-selection',
            title: 'Select Template',
            description: 'Choose a template for your document or start from scratch.',
            inputs: [
                {
                    id: 'useTemplate',
                    label: 'Use a Template?',
                    type: 'radio',
                    options: [
                        { value: 'yes', label: 'Yes, use a template' },
                        { value: 'no', label: 'No, start from scratch' }
                    ],
                    default: 'yes',
                    required: true
                },
                {
                    id: 'templateId',
                    label: 'Template',
                    type: 'select',
                    options: [], // Will be populated dynamically based on selected document type
                    condition: {
                        field: 'useTemplate',
                        value: 'yes'
                    },
                    required: false
                }
            ],
            required: ['useTemplate'],
            previous: 'document-type',
            next: 'document-info',
            validate: (values) => {
                if (values.useTemplate === 'yes' && !values.templateId) {
                    return 'Please select a template';
                }
                return null;
            }
        });
        
        // Step 3: Document Information
        this._steps.push({
            id: 'document-info',
            title: 'Document Information',
            description: 'Enter basic information about your document.',
            inputs: [
                {
                    id: 'title',
                    label: 'Title',
                    type: 'text',
                    placeholder: 'Enter document title',
                    required: true
                },
                {
                    id: 'description',
                    label: 'Description',
                    type: 'textarea',
                    placeholder: 'Enter a brief description of the document',
                    required: false
                },
                {
                    id: 'author',
                    label: 'Author',
                    type: 'text',
                    placeholder: 'Enter author name',
                    required: false
                }
            ],
            required: ['title'],
            previous: 'template-selection',
            next: 'sections',
            validate: (values) => {
                if (!values.title) {
                    return 'Please enter a document title';
                }
                if (values.title.length < 3) {
                    return 'Title must be at least 3 characters long';
                }
                return null;
            }
        });
        
        // Step 4: Document Sections
        this._steps.push({
            id: 'sections',
            title: 'Document Sections',
            description: 'Select or customize the sections for your document.',
            inputs: [
                {
                    id: 'sections',
                    label: 'Sections',
                    type: 'checkbox',
                    options: [], // Will be populated dynamically based on document type and template
                    required: false
                },
                {
                    id: 'customSections',
                    label: 'Add Custom Sections',
                    type: 'textarea',
                    placeholder: 'Enter custom sections, one per line',
                    required: false
                }
            ],
            required: [],
            previous: 'document-info',
            next: 'output-options',
            validate: (values) => {
                return null; // No validation required, sections are optional
            }
        });
        
        // Step 5: Output Options
        this._steps.push({
            id: 'output-options',
            title: 'Output Options',
            description: 'Choose output format and location for your document.',
            inputs: [
                {
                    id: 'outputFormat',
                    label: 'Output Format',
                    type: 'select',
                    options: [
                        { value: 'docx', label: 'Word Document (.docx)' },
                        { value: 'pdf', label: 'PDF Document (.pdf)' },
                        { value: 'html', label: 'HTML Document (.html)' },
                        { value: 'markdown', label: 'Markdown Document (.md)' }
                    ],
                    default: 'docx',
                    required: true
                },
                {
                    id: 'outputPath',
                    label: 'Output Location',
                    type: 'file',
                    required: false
                }
            ],
            required: ['outputFormat'],
            previous: 'sections',
            validate: (values) => {
                if (!values.outputFormat) {
                    return 'Please select an output format';
                }
                return null;
            }
        });
        
        // Set the current step to the first step
        this._currentStepId = this._steps[0].id;
    }
    
    /**
     * Open the document creation wizard
     */
    public open(): void {
        // Create the webview panel
        this._panel = vscode.window.createWebviewPanel(
            'document-writer.documentCreationWizard',
            'Create Document',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(this._extensionUri, 'media'),
                    vscode.Uri.joinPath(this._extensionUri, 'resources'),
                ]
            }
        );
        
        // Set the initial HTML content
        this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
        
        // Set up the message listener
        this._setWebviewMessageListener(this._panel.webview);
        
        // Handle panel close
        this._panel.onDidDispose(
            () => {
                this._panel = undefined;
            },
            null,
            []
        );
    }
    
    /**
     * Get the HTML for the webview
     * @param webview The webview
     * @returns The HTML for the webview
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentWizard.js')
        );
        
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'media', 'documentWizard.css')
        );
        
        const nonce = this._getNonce();
        
        // Find the current step
        const currentStep = this._steps.find(step => step.id === this._currentStepId);
        if (!currentStep) {
            throw new Error(`Step with ID ${this._currentStepId} not found`);
        }
        
        // Calculate progress percentage
        const currentStepIndex = this._steps.findIndex(step => step.id === this._currentStepId);
        const progressPercentage = Math.round(((currentStepIndex + 1) / this._steps.length) * 100);
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <link href="${styleUri}" rel="stylesheet">
            <title>Create Document</title>
        </head>
        <body>
            <div class="wizard-container">
                <div class="wizard-header">
                    <h1>${currentStep.title}</h1>
                    <p class="description">${currentStep.description}</p>
                    
                    <div class="progress-container">
                        <div class="progress-bar">
                            <div class="progress-fill" style="width: ${progressPercentage}%"></div>
                        </div>
                        <div class="progress-text">Step ${currentStepIndex + 1} of ${this._steps.length}</div>
                    </div>
                </div>
                
                <div class="wizard-content">
                    <form id="wizard-form">
                        ${this._generateFormFields(currentStep)}
                    </form>
                </div>
                
                <div class="wizard-footer">
                    <div class="button-container">
                        ${currentStep.previous ? '<button id="prev-button" class="secondary-button">Previous</button>' : ''}
                        ${currentStep.next ? '<button id="next-button" class="primary-button">Next</button>' : '<button id="finish-button" class="primary-button">Create Document</button>'}
                    </div>
                </div>
            </div>
            
            <script nonce="${nonce}" src="${scriptUri}"></script>
        </body>
        </html>`;
    }
    
    /**
     * Generate the HTML for form fields
     * @param step The wizard step
     * @returns HTML for form fields
     */
    private _generateFormFields(step: WizardStep): string {
        let html = '';
        
        for (const input of step.inputs) {
            // Check if this input has a condition
            const shouldRender = !input.condition || 
                this._data[input.condition.field] === input.condition.value;
            
            if (!shouldRender) {
                continue;
            }
            
            const value = this._data[input.id] !== undefined ? this._data[input.id] : input.default;
            
            html += `<div class="form-group">
                <label for="${input.id}">${input.label}${input.required ? ' *' : ''}</label>`;
            
            switch (input.type) {
                case 'text':
                    html += `<input type="text" id="${input.id}" name="${input.id}" value="${value || ''}" placeholder="${input.placeholder || ''}" ${input.required ? 'required' : ''}>`;
                    break;
                    
                case 'textarea':
                    html += `<textarea id="${input.id}" name="${input.id}" placeholder="${input.placeholder || ''}" ${input.required ? 'required' : ''}>${value || ''}</textarea>`;
                    break;
                    
                case 'select':
                    html += `<select id="${input.id}" name="${input.id}" ${input.required ? 'required' : ''}>
                        <option value="">-- Select ${input.label} --</option>`;
                    
                    if (input.options) {
                        for (const option of input.options) {
                            const selected = value === option.value ? 'selected' : '';
                            html += `<option value="${option.value}" ${selected}>${option.label}</option>`;
                        }
                    }
                    
                    html += `</select>`;
                    break;
                    
                case 'radio':
                    if (input.options) {
                        for (const option of input.options) {
                            const checked = value === option.value ? 'checked' : '';
                            html += `<div class="radio-option">
                                <input type="radio" id="${input.id}-${option.value}" name="${input.id}" value="${option.value}" ${checked} ${input.required ? 'required' : ''}>
                                <label for="${input.id}-${option.value}">${option.label}</label>
                            </div>`;
                        }
                    }
                    break;
                    
                case 'checkbox':
                    if (input.options) {
                        const selectedValues = Array.isArray(value) ? value : [];
                        
                        for (const option of input.options) {
                            const checked = selectedValues.includes(option.value) ? 'checked' : '';
                            html += `<div class="checkbox-option">
                                <input type="checkbox" id="${input.id}-${option.value}" name="${input.id}" value="${option.value}" ${checked}>
                                <label for="${input.id}-${option.value}">${option.label}</label>
                            </div>`;
                        }
                    }
                    break;
                    
                case 'file':
                    html += `<div class="file-input-container">
                        <input type="text" id="${input.id}" name="${input.id}" value="${value || ''}" readonly>
                        <button type="button" class="browse-button" id="browse-${input.id}">Browse...</button>
                    </div>`;
                    break;
            }
            
            if (input.helpText) {
                html += `<div class="help-text">${input.helpText}</div>`;
            }
            
            html += `</div>`;
        }
        
        return html;
    }
    
    /**
     * Set up the webview message listener
     * @param webview The webview
     */
    private _setWebviewMessageListener(webview: vscode.Webview): void {
        webview.onDidReceiveMessage(
            async (message) => {
                switch (message.command) {
                    case 'getInitialData':
                        // Send the initial data to the webview
                        webview.postMessage({
                            command: 'initialData',
                            data: this._data
                        });
                        break;
                        
                    case 'updateField':
                        // Update a field in the data object
                        this._data[message.field] = message.value;
                        
                        // If the document type changes, update the template options
                        if (message.field === 'documentType') {
                            this._updateTemplateOptions();
                        }
                        
                        // If the template changes, update the section options
                        if (message.field === 'templateId') {
                            this._updateSectionOptions();
                        }
                        break;
                        
                    case 'validateStep':
                        // Find the current step
                        const currentStep = this._steps.find(step => step.id === this._currentStepId);
                        if (!currentStep) {
                            webview.postMessage({
                                command: 'validationResult',
                                isValid: false,
                                error: `Step with ID ${this._currentStepId} not found`
                            });
                            return;
                        }
                        
                        // Validate the current step
                        const validationError = currentStep.validate(this._data);
                        
                        // Send the validation result to the webview
                        webview.postMessage({
                            command: 'validationResult',
                            isValid: validationError === null,
                            error: validationError
                        });
                        break;
                        
                    case 'nextStep':
                        // Find the current step
                        const currentStepForNext = this._steps.find(step => step.id === this._currentStepId);
                        if (!currentStepForNext || !currentStepForNext.next) {
                            return;
                        }
                        
                        // Move to the next step
                        this._currentStepId = currentStepForNext.next;
                        
                        // Update the webview
                        if (this._panel) {
                            this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
                        }
                        break;
                        
                    case 'previousStep':
                        // Find the current step
                        const currentStepForPrev = this._steps.find(step => step.id === this._currentStepId);
                        if (!currentStepForPrev || !currentStepForPrev.previous) {
                            return;
                        }
                        
                        // Move to the previous step
                        this._currentStepId = currentStepForPrev.previous;
                        
                        // Update the webview
                        if (this._panel) {
                            this._panel.webview.html = this._getHtmlForWebview(this._panel.webview);
                        }
                        break;
                        
                    case 'browseFile':
                        // Open a file picker dialog
                        const options: vscode.OpenDialogOptions = {
                            canSelectMany: false,
                            openLabel: 'Select',
                            filters: {
                                'All Files': ['*']
                            }
                        };
                        
                        // Add filters based on the field
                        if (message.field === 'outputPath') {
                            const format = this._data.outputFormat || 'docx';
                            options.filters = {
                                'Document Files': [format]
                            };
                            
                            // Use save dialog instead for output path
                            const result = await vscode.window.showSaveDialog({
                                defaultUri: vscode.Uri.file(`document.${format}`),
                                filters: options.filters,
                                saveLabel: 'Save As'
                            });
                            
                            if (result) {
                                this._data[message.field] = result.fsPath;
                                
                                // Notify the webview of the selected file
                                webview.postMessage({
                                    command: 'fileSelected',
                                    field: message.field,
                                    path: result.fsPath
                                });
                            }
                        } else {
                            const result = await vscode.window.showOpenDialog(options);
                            
                            if (result && result.length > 0) {
                                this._data[message.field] = result[0].fsPath;
                                
                                // Notify the webview of the selected file
                                webview.postMessage({
                                    command: 'fileSelected',
                                    field: message.field,
                                    path: result[0].fsPath
                                });
                            }
                        }
                        break;
                        
                    case 'createDocument':
                        // Create the document
                        try {
                            // We need to implement this method in DocumentService
                            const document = await this._createDocument(this._data);
                            
                            // Show success message
                            vscode.window.showInformationMessage(`Document created successfully: ${document.title}`);
                            
                            // Close the wizard
                            if (this._panel) {
                                this._panel.dispose();
                            }
                            
                            // Open the document if a path was specified
                            if (document.path) {
                                // Determine how to open the document based on format
                                if (this._data.outputFormat === 'docx' || this._data.outputFormat === 'pdf') {
                                    // Open with OS default application
                                    const uri = vscode.Uri.file(document.path);
                                    vscode.env.openExternal(uri);
                                } else if (this._data.outputFormat === 'html' || this._data.outputFormat === 'markdown') {
                                    // Open in VS Code
                                    const uri = vscode.Uri.file(document.path);
                                    vscode.window.showTextDocument(uri);
                                }
                            }
                        } catch (error) {
                            vscode.window.showErrorMessage(`Error creating document: ${error instanceof Error ? error.message : String(error)}`);
                        }
                        break;
                }
            },
            undefined,
            []
        );
    }
    
    /**
     * Create a document (temporary implementation until DocumentService is updated)
     * @param data Document creation data
     * @returns Created document
     */
    private async _createDocument(data: DocumentCreationData): Promise<CreatedDocument> {
        // This is a temporary implementation that will be replaced
        // when DocumentService.createDocument is implemented
        
        // For now, we'll just create a dummy document
        return {
            title: data.title,
            path: data.outputPath
        };
    }
    
    /**
     * Update template options based on the selected document type
     */
    private async _updateTemplateOptions(): Promise<void> {
        if (!this._panel) {
            return;
        }
        
        // Get the template step
        const templateStep = this._steps.find(step => step.id === 'template-selection');
        if (!templateStep) {
            return;
        }
        
        // Find the template input
        const templateInput = templateStep.inputs.find(input => input.id === 'templateId');
        if (!templateInput) {
            return;
        }
        
        // Get the document type
        const documentType = this._data.documentType;
        
        try {
            // Get templates for the selected document type
            // This is a temporary implementation that will be replaced
            // when TemplateManagerService.getTemplatesByType is implemented
            const templates = await this._getTemplatesByType(documentType);
            
            // Update the template options
            templateInput.options = templates.map(template => ({
                value: template.id,
                label: template.name
            }));
            
            // Notify the webview of the updated options
            this._panel.webview.postMessage({
                command: 'updateOptions',
                field: 'templateId',
                options: templateInput.options
            });
        } catch (error) {
            console.error('Error fetching templates:', error);
            vscode.window.showErrorMessage('Failed to load templates');
        }
    }
    
    /**
     * Get templates by type (temporary implementation until TemplateManagerService is updated)
     * @param documentType Document type
     * @returns Array of templates
     */
    private async _getTemplatesByType(documentType: string): Promise<Template[]> {
        // This is a temporary implementation that will be replaced
        // when TemplateManagerService.getTemplatesByType is implemented
        
        // For now, we'll just return some dummy templates
        const templates: Template[] = [
            {
                id: 'template1',
                name: 'Simple Template',
                type: documentType
            },
            {
                id: 'template2',
                name: 'Professional Template',
                type: documentType
            },
            {
                id: 'template3',
                name: 'Advanced Template',
                type: documentType
            }
        ];
        
        return templates.filter(template => template.type === documentType);
    }
    
    /**
     * Get template by ID (temporary implementation until TemplateManagerService is updated)
     * @param templateId Template ID
     * @returns Template or undefined if not found
     */
    private async _getTemplateById(templateId: string): Promise<Template | undefined> {
        // This is a temporary implementation that will be replaced
        // when TemplateManagerService.getTemplateById is implemented
        
        // For now, we'll just return a dummy template
        const template: Template = {
            id: templateId,
            name: 'Template ' + templateId,
            type: this._data.documentType,
            sections: [
                { id: 'section1', name: 'Introduction' },
                { id: 'section2', name: 'Body' },
                { id: 'section3', name: 'Conclusion' }
            ]
        };
        
        return template;
    }
    
    /**
     * Update section options based on the selected template
     */
    private async _updateSectionOptions(): Promise<void> {
        if (!this._panel) {
            return;
        }
        
        // Get the sections step
        const sectionsStep = this._steps.find(step => step.id === 'sections');
        if (!sectionsStep) {
            return;
        }
        
        // Find the sections input
        const sectionsInput = sectionsStep.inputs.find(input => input.id === 'sections');
        if (!sectionsInput) {
            return;
        }
        
        // Get the template ID
        const templateId = this._data.templateId;
        
        if (templateId) {
            try {
                // Get the template
                const template = await this._getTemplateById(templateId);
                
                if (template && template.sections) {
                    // Update the section options
                    sectionsInput.options = template.sections.map(section => ({
                        value: section.id,
                        label: section.name
                    }));
                    
                    // Pre-select all sections by default
                    this._data.sections = template.sections.map(section => section.id);
                }
            } catch (error) {
                console.error('Error fetching template:', error);
                vscode.window.showErrorMessage('Failed to load template');
            }
        } else {
            // Use default sections for the document type
            const documentType = this._data.documentType;
            
            // Define default sections based on document type
            let defaultSections: Array<{ id: string, name: string }> = [];
            
            switch (documentType) {
                case 'business-report':
                    defaultSections = [
                        { id: 'executive-summary', name: 'Executive Summary' },
                        { id: 'introduction', name: 'Introduction' },
                        { id: 'background', name: 'Background' },
                        { id: 'methodology', name: 'Methodology' },
                        { id: 'findings', name: 'Findings' },
                        { id: 'conclusion', name: 'Conclusion' },
                        { id: 'recommendations', name: 'Recommendations' },
                        { id: 'appendix', name: 'Appendix' }
                    ];
                    break;
                    
                case 'technical-specification':
                    defaultSections = [
                        { id: 'introduction', name: 'Introduction' },
                        { id: 'scope', name: 'Scope' },
                        { id: 'system-overview', name: 'System Overview' },
                        { id: 'requirements', name: 'Requirements' },
                        { id: 'architecture', name: 'Architecture' },
                        { id: 'interfaces', name: 'Interfaces' },
                        { id: 'data-model', name: 'Data Model' },
                        { id: 'security', name: 'Security' },
                        { id: 'performance', name: 'Performance' },
                        { id: 'appendix', name: 'Appendix' }
                    ];
                    break;
                    
                case 'proposal':
                    defaultSections = [
                        { id: 'executive-summary', name: 'Executive Summary' },
                        { id: 'problem-statement', name: 'Problem Statement' },
                        { id: 'proposed-solution', name: 'Proposed Solution' },
                        { id: 'methodology', name: 'Methodology' },
                        { id: 'timeline', name: 'Timeline' },
                        { id: 'budget', name: 'Budget' },
                        { id: 'team', name: 'Team' },
                        { id: 'conclusion', name: 'Conclusion' }
                    ];
                    break;
                    
                case 'letter':
                    defaultSections = [
                        { id: 'sender-info', name: 'Sender Information' },
                        { id: 'recipient-info', name: 'Recipient Information' },
                        { id: 'date', name: 'Date' },
                        { id: 'subject', name: 'Subject' },
                        { id: 'salutation', name: 'Salutation' },
                        { id: 'body', name: 'Body' },
                        { id: 'closing', name: 'Closing' },
                        { id: 'signature', name: 'Signature' }
                    ];
                    break;
                    
                case 'manual':
                    defaultSections = [
                        { id: 'introduction', name: 'Introduction' },
                        { id: 'getting-started', name: 'Getting Started' },
                        { id: 'installation', name: 'Installation' },
                        { id: 'basic-usage', name: 'Basic Usage' },
                        { id: 'advanced-features', name: 'Advanced Features' },
                        { id: 'troubleshooting', name: 'Troubleshooting' },
                        { id: 'faq', name: 'FAQ' },
                        { id: 'appendix', name: 'Appendix' }
                    ];
                    break;
                    
                case 'data-analysis':
                    defaultSections = [
                        { id: 'executive-summary', name: 'Executive Summary' },
                        { id: 'introduction', name: 'Introduction' },
                        { id: 'data-sources', name: 'Data Sources' },
                        { id: 'methodology', name: 'Methodology' },
                        { id: 'analysis', name: 'Analysis' },
                        { id: 'findings', name: 'Findings' },
                        { id: 'visualizations', name: 'Visualizations' },
                        { id: 'conclusions', name: 'Conclusions' },
                        { id: 'recommendations', name: 'Recommendations' },
                        { id: 'appendix', name: 'Appendix' }
                    ];
                    break;
                    
                default:
                    defaultSections = [
                        { id: 'introduction', name: 'Introduction' },
                        { id: 'body', name: 'Body' },
                        { id: 'conclusion', name: 'Conclusion' }
                    ];
                    break;
            }
            
            // Update the section options
            sectionsInput.options = defaultSections.map(section => ({
                value: section.id,
                label: section.name
            }));
            
            // Pre-select all sections by default
            this._data.sections = defaultSections.map(section => section.id);
            
            // Notify the webview of the updated options
            this._panel.webview.postMessage({
                command: 'updateOptions',
                field: 'sections',
                options: sectionsInput.options
            });
        }
    }
    
    /**
     * Generate a nonce for webview content security
     * @returns A random nonce string
     */
    private _getNonce(): string {
        return getNonce();
    }
}
