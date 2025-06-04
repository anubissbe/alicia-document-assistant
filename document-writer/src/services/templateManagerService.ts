import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentTemplate, SecurityLevel } from '../models/documentTemplate';
import { SecurityManager } from '../utils/securityManager';

/**
 * Template information for UI display
 */
export interface TemplateInfo {
    id: string;
    name: string;
    description: string;
    type: string;
}

/**
 * Service responsible for managing document templates
 */
export class TemplateManagerService {
    private _extensionContext: vscode.ExtensionContext;
    private _storageKey: string = 'document-writer.templates';
    private _templates: DocumentTemplate[] = [];
    private _securityManager: SecurityManager;
    
    constructor(context: vscode.ExtensionContext) {
        this._extensionContext = context;
        this._securityManager = new SecurityManager(context);
        this._loadTemplates();
    }
    
    /**
     * Get all available templates
     */
    public getTemplates(): DocumentTemplate[] {
        return [...this._templates];
    }

    /**
     * Get all available templates formatted for UI display
     */
    public async getAvailableTemplates(): Promise<TemplateInfo[]> {
        // If no templates are loaded, load some default templates
        if (this._templates.length === 0) {
            await this._loadDefaultTemplates();
        }
        
        return this._templates.map(template => ({
            id: template.id,
            name: template.name,
            description: template.description,
            type: template.type
        }));
    }
    
    /**
     * Get a template by ID
     * @param id The ID of the template to get
     */
    public getTemplateById(id: string): DocumentTemplate | undefined {
        return this._templates.find(template => template.id === id);
    }
    
    /**
     * Add a new template
     * @param template The template to add
     */
    public async addTemplate(template: Omit<DocumentTemplate, 'id'>): Promise<DocumentTemplate> {
        // Generate a unique ID for the template
        const id = this._generateUniqueId();
        
        // Create the template with the generated ID
        const newTemplate: DocumentTemplate = {
            ...template,
            id
        };
        
        // Validate the template
        await this._validateTemplate(newTemplate);
        
        // Add the template to the collection
        this._templates.push(newTemplate);
        
        // Save the templates
        await this._saveTemplates();
        
        return newTemplate;
    }
    
    /**
     * Update an existing template
     * @param id The ID of the template to update
     * @param template The updated template data
     */
    public async updateTemplate(id: string, template: Partial<DocumentTemplate>): Promise<DocumentTemplate> {
        const existingTemplate = this.getTemplateById(id);
        
        if (!existingTemplate) {
            throw new Error(`Template with ID ${id} not found`);
        }
        
        // Create the updated template
        const updatedTemplate: DocumentTemplate = {
            ...existingTemplate,
            ...template,
            id // Ensure the ID doesn't change
        };
        
        // Validate the template
        await this._validateTemplate(updatedTemplate);
        
        // Update the template in the collection
        const index = this._templates.findIndex(t => t.id === id);
        this._templates[index] = updatedTemplate;
        
        // Save the templates
        await this._saveTemplates();
        
        return updatedTemplate;
    }
    
    /**
     * Delete a template
     * @param id The ID of the template to delete
     */
    public async deleteTemplate(id: string): Promise<void> {
        const index = this._templates.findIndex(template => template.id === id);
        
        if (index === -1) {
            throw new Error(`Template with ID ${id} not found`);
        }
        
        // Remove the template from the collection
        this._templates.splice(index, 1);
        
        // Save the templates
        await this._saveTemplates();
    }
    
    /**
     * Import a template from a file
     * @param filePath The path to the template file
     * @param name The name for the new template
     * @param description The description for the new template
     */
    public async importTemplate(
        filePath: string, 
        name: string, 
        description: string
    ): Promise<DocumentTemplate> {
        // Validate the file path
        const pathValidation = this._securityManager.validatePath(
            filePath,
            {
                allowedExtensions: ['.docx', '.md', '.html', '.htm', '.pdf'],
                allowAbsolutePaths: true,
                allowTraversal: false,
                enforceExtension: true
            }
        );
        
        if (!pathValidation.valid) {
            throw new Error(`Invalid template file path: ${filePath}`);
        }
        
        // Ensure the file exists
        if (!fs.existsSync(filePath)) {
            throw new Error(`File does not exist: ${filePath}`);
        }
        
        // Determine the format based on file extension
        const format = this._getFormatFromFilePath(filePath);
        
        // Create a new template
        return await this.addTemplate({
            name,
            description,
            type: format,
            path: filePath,
            metadata: {
                author: 'Unknown',
                version: '1.0',
                lastModified: new Date(),
                tags: [],
                category: 'General'
            }
        });
    }
    
    /**
     * Load templates from storage
     */
    private _loadTemplates(): void {
        try {
            const templatesJson = this._extensionContext.globalState.get<string>(this._storageKey);
            
            if (templatesJson) {
                this._templates = JSON.parse(templatesJson);
            }
        } catch (error) {
            console.error('Error loading templates:', error);
            vscode.window.showErrorMessage('Failed to load templates');
            this._templates = [];
        }
    }
    
    /**
     * Save templates to storage
     */
    private async _saveTemplates(): Promise<void> {
        try {
            const templatesJson = JSON.stringify(this._templates);
            await this._extensionContext.globalState.update(this._storageKey, templatesJson);
        } catch (error) {
            console.error('Error saving templates:', error);
            vscode.window.showErrorMessage('Failed to save templates');
            throw error;
        }
    }
    
    /**
     * Load default templates
     */
    private async _loadDefaultTemplates(): Promise<void> {
        try {
            // Find template files in the extension's templates directory
            const templatesDir = path.join(this._extensionContext.extensionPath, 'resources', 'templates');
            const defaultTemplates = fs.readdirSync(templatesDir);
            
            // Import each template
            for (const templateFile of defaultTemplates) {
                const templatePath = path.join(templatesDir, templateFile);
                const templateName = path.basename(templateFile, path.extname(templateFile));
                
                // Skip if template already exists
                if (this._templates.some(t => t.name === templateName)) {
                    continue;
                }
                
                await this.importTemplate(
                    templatePath,
                    templateName,
                    `Default ${templateName} template`
                );
            }
        } catch (error) {
            console.error('Error loading default templates:', error);
            vscode.window.showErrorMessage('Failed to load default templates');
        }
    }
    
    /**
     * Validate a template
     * @param template The template to validate
     */
    private async _validateTemplate(template: DocumentTemplate): Promise<void> {
        // Validate the template path
        const pathValidation = this._securityManager.validatePath(
            template.path,
            {
                allowedExtensions: ['.docx', '.md', '.html', '.htm', '.pdf'],
                allowAbsolutePaths: true,
                allowTraversal: false,
                enforceExtension: true
            }
        );
        
        if (!pathValidation.valid) {
            throw new Error(`Invalid template file path: ${pathValidation.message}`);
        }
        
        // Check if the template file exists
        if (!fs.existsSync(template.path)) {
            throw new Error(`Template file does not exist: ${template.path}`);
        }
        
        // Additional validation based on type
        switch (template.type) {
            case 'docx':
                // Validate DOCX template - we could add more validation in the future
                if (!template.path.toLowerCase().endsWith('.docx')) {
                    throw new Error('DOCX template must have a .docx extension');
                }
                break;
                
            case 'markdown':
                // Validate Markdown template
                if (!template.path.toLowerCase().endsWith('.md')) {
                    throw new Error('Markdown template must have a .md extension');
                }
                break;
                
            case 'html':
                // Validate HTML template
                if (!template.path.toLowerCase().endsWith('.html') && 
                    !template.path.toLowerCase().endsWith('.htm')) {
                    throw new Error('HTML template must have a .html or .htm extension');
                }
                break;
                
            case 'pdf':
                // Validate PDF template
                if (!template.path.toLowerCase().endsWith('.pdf')) {
                    throw new Error('PDF template must have a .pdf extension');
                }
                break;
                
            default:
                throw new Error(`Unsupported document type: ${template.type}`);
        }
    }
    
    /**
     * Generate a unique ID for a template
     */
    private _generateUniqueId(): string {
        return 'template_' + Math.random().toString(36).substring(2, 15) + 
               Math.random().toString(36).substring(2, 15);
    }
    
    /**
     * Determine the document format from a file path
     * @param filePath The path to the template file
     */
    private _getFormatFromFilePath(filePath: string): string {
        const extension = path.extname(filePath).toLowerCase();
        
        switch (extension) {
            case '.docx':
                return 'docx';
            case '.md':
                return 'markdown';
            case '.html':
            case '.htm':
                return 'html';
            case '.pdf':
                return 'pdf';
            default:
                throw new Error(`Unsupported file extension: ${extension}`);
        }
    }

    /**
     * Export a template to a file
     * @param id The ID of the template to export
     * @param filePath The path to export the template to
     */
    public async exportTemplate(id: string, filePath: string): Promise<void> {
        const template = this.getTemplateById(id);
        
        if (!template) {
            throw new Error(`Template with ID ${id} not found`);
        }

        // Validate the export path
        const pathValidation = this._securityManager.validatePath(filePath);
        if (!pathValidation.valid) {
            throw new Error(`Invalid export path: ${filePath}`);
        }

        // Read the template file
        const templateContent = await fs.promises.readFile(template.path, 'utf8');
        
        // Write to the export location
        await fs.promises.writeFile(filePath, templateContent, 'utf8');
    }
}
