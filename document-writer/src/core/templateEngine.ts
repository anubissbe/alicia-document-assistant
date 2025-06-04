import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import Handlebars from 'handlebars';
import { TemplateMetadata, TemplateVariable } from '../models/templateMetadata';

/**
 * Interface for template validation result
 */
export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Class for template processing
 */
export class TemplateEngine {
    private templateCache = new Map<string, TemplateMetadata>();
    private handlebars: typeof Handlebars;
    
    /**
     * Constructor
     * @param context Extension context
     */
    constructor(private context: vscode.ExtensionContext) {
        this.handlebars = Handlebars.create();
        this.registerHelpers();
        this.loadTemplates();
    }
    
    /**
     * Register custom Handlebars helpers
     */
    private registerHelpers() {
        // Date formatting helper
        this.handlebars.registerHelper('formatDate', (date: Date, format: string) => {
            if (!date) {
                return '';
            }
            
            // Convert string date to Date object if needed
            const dateObj = typeof date === 'string' ? new Date(date) : date;
            
            // Simple format implementation
            switch (format) {
                case 'short':
                    return dateObj.toLocaleDateString();
                case 'long':
                    return dateObj.toLocaleDateString(undefined, { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long', 
                        day: 'numeric' 
                    });
                case 'time':
                    return dateObj.toLocaleTimeString();
                case 'datetime':
                    return dateObj.toLocaleString();
                default:
                    return dateObj.toLocaleDateString();
            }
        });
        
        // Currency formatting helper
        this.handlebars.registerHelper('currency', (amount: number, currency = 'USD') => {
            if (amount === undefined || amount === null) {
                return '';
            }
            
            return new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: currency
            }).format(amount);
        });
        
        // Percentage formatting helper
        this.handlebars.registerHelper('percentage', (value: number, decimals = 2) => {
            if (value === undefined || value === null) {
                return '';
            }
            
            return `${(value * 100).toFixed(decimals)}%`;
        });
        
        // Conditional helper
        this.handlebars.registerHelper('conditional', (condition: boolean, trueValue: any, falseValue: any) => {
            return condition ? trueValue : falseValue;
        });
        
        // List formatting helper
        this.handlebars.registerHelper('list', (items: any[], separator = ', ') => {
            if (!items || !Array.isArray(items)) {
                return '';
            }
            
            return items.join(separator);
        });
    }
    
    /**
     * Load templates from the extension's templates directory
     */
    private async loadTemplates() {
        try {
            const templateDir = path.join(this.context.extensionPath, 'resources', 'templates');
            await this.scanTemplateDirectory(templateDir);
        } catch (error) {
            console.error('Error loading templates:', error);
        }
    }
    
    /**
     * Scan a directory for templates recursively
     * @param dir Directory to scan
     */
    private async scanTemplateDirectory(dir: string) {
        try {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory()) {
                    // Recursively scan subdirectories
                    await this.scanTemplateDirectory(fullPath);
                } else if (entry.name.endsWith('.json')) {
                    // Load template metadata
                    const metadata = await this.loadTemplateMetadata(fullPath);
                    if (metadata) {
                        this.templateCache.set(metadata.type, metadata);
                    }
                }
            }
        } catch (error) {
            console.error(`Error scanning template directory ${dir}:`, error);
        }
    }
    
    /**
     * Load template metadata from a JSON file
     * @param metadataPath Path to the metadata JSON file
     * @returns Template metadata or null if loading fails
     */
    private async loadTemplateMetadata(metadataPath: string): Promise<TemplateMetadata | null> {
        try {
            const content = await fs.promises.readFile(metadataPath, 'utf8');
            return JSON.parse(content) as TemplateMetadata;
        } catch (error) {
            console.error(`Failed to load template metadata: ${metadataPath}`, error);
            return null;
        }
    }
    
    /**
     * Get a template file path for a specific document type
     * @param type Document type
     * @returns Path to the template file or null if not found
     */
    async getTemplateForType(type: string): Promise<string | null> {
        const metadata = this.templateCache.get(type);
        if (!metadata) {
            return null;
        }
        
        const templatePath = path.join(
            this.context.extensionPath,
            'resources',
            'templates',
            type,
            `${type}.docx`
        );
        
        if (await this.fileExists(templatePath)) {
            return templatePath;
        }
        
        return null;
    }
    
    /**
     * Process a template with data
     * @param templatePath Path to the template file
     * @param data Data to use for template processing
     * @returns Processed template as string
     */
    async processTemplate(templatePath: string, data: any): Promise<string> {
        const template = await fs.promises.readFile(templatePath, 'utf8');
        const compiled = this.handlebars.compile(template);
        return compiled(data);
    }
    
    /**
     * Validate data against a template's metadata
     * @param type Document type
     * @param data Data to validate
     * @returns Validation result
     */
    async validateTemplateData(type: string, data: any): Promise<ValidationResult> {
        const metadata = this.templateCache.get(type);
        if (!metadata) {
            return { valid: false, errors: ['Template type not found'] };
        }
        
        const errors: string[] = [];
        
        // Check required variables
        for (const variable of metadata.variables) {
            if (variable.required && !(variable.name in data)) {
                errors.push(`Required variable missing: ${variable.name}`);
            }
            
            if (variable.name in data) {
                const value = data[variable.name];
                if (!this.validateType(value, variable.type)) {
                    errors.push(`Invalid type for ${variable.name}: expected ${variable.type}`);
                }
            }
        }
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
    
    /**
     * Validate a value against an expected type
     * @param value Value to validate
     * @param expectedType Expected type
     * @returns Whether the value matches the expected type
     */
    private validateType(value: any, expectedType: string): boolean {
        switch (expectedType) {
            case 'string':
                return typeof value === 'string';
            case 'number':
                return typeof value === 'number';
            case 'boolean':
                return typeof value === 'boolean';
            case 'array':
                return Array.isArray(value);
            case 'object':
                return typeof value === 'object' && !Array.isArray(value) && value !== null;
            case 'date':
                return value instanceof Date || (typeof value === 'string' && !isNaN(Date.parse(value)));
            default:
                return true;
        }
    }
    
    /**
     * Check if a file exists
     * @param filePath Path to the file
     * @returns Whether the file exists
     */
    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await fs.promises.access(filePath, fs.constants.F_OK);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Get all available templates
     * @returns Map of template types to metadata
     */
    getAvailableTemplates(): Map<string, TemplateMetadata> {
        return new Map(this.templateCache);
    }
    
    /**
     * Get metadata for a specific template type
     * @param type Template type
     * @returns Template metadata or null if not found
     */
    getTemplateMetadata(type: string): TemplateMetadata | undefined {
        return this.templateCache.get(type);
    }
    
    /**
     * Register a partial template
     * @param name Partial name
     * @param template Partial template content
     */
    registerPartial(name: string, template: string): void {
        this.handlebars.registerPartial(name, template);
    }
    
    /**
     * Register a custom helper
     * @param name Helper name
     * @param helper Helper function
     */
    registerHelper(name: string, helper: Handlebars.HelperDelegate): void {
        this.handlebars.registerHelper(name, helper);
    }
}
