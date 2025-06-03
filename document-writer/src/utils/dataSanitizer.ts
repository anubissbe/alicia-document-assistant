import * as vscode from 'vscode';
import { SecurityManager } from './securityManager';

/**
 * Enum for different sanitization levels
 */
export enum SanitizationLevel {
    BASIC = 'basic',         // Basic sanitization for general text
    STRICT = 'strict',       // Strict sanitization for security-sensitive data
    HTML = 'html',           // HTML sanitization for content that may contain markup
    TEMPLATE_VAR = 'template_var'  // Template variable sanitization
}

/**
 * Class for sanitizing data throughout the application
 * Provides a consistent interface for sanitization operations
 */
export class DataSanitizer {
    private securityManager: SecurityManager;
    
    constructor(securityManager: SecurityManager) {
        this.securityManager = securityManager;
    }
    
    /**
     * Sanitizes input data according to the specified level
     * @param input The input data to sanitize
     * @param level The sanitization level to apply
     * @returns Sanitized data
     */
    public sanitize(input: string, level: SanitizationLevel = SanitizationLevel.BASIC): string {
        if (!input) {
            return '';
        }
        
        switch (level) {
            case SanitizationLevel.HTML:
                return this.sanitizeHtml(input);
            case SanitizationLevel.STRICT:
                return this.sanitizeStrict(input);
            case SanitizationLevel.TEMPLATE_VAR:
                return this.sanitizeTemplateVariable(input);
            case SanitizationLevel.BASIC:
            default:
                return this.sanitizeBasic(input);
        }
    }
    
    /**
     * Sanitizes a JavaScript object (recursively sanitizes all string properties)
     * @param data The object to sanitize
     * @param level The sanitization level to apply
     * @returns Sanitized object
     */
    public sanitizeObject<T>(data: T, level: SanitizationLevel = SanitizationLevel.BASIC): T {
        if (!data) {
            return data;
        }
        
        // If it's a string, sanitize it directly
        if (typeof data === 'string') {
            return this.sanitize(data, level) as unknown as T;
        }
        
        // If it's an array, sanitize each element
        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeObject(item, level)) as unknown as T;
        }
        
        // If it's an object, sanitize each property
        if (typeof data === 'object') {
            const result: Record<string, any> = {};
            
            for (const key in data) {
                if (Object.prototype.hasOwnProperty.call(data, key)) {
                    result[key] = this.sanitizeObject((data as Record<string, any>)[key], level);
                }
            }
            
            return result as T;
        }
        
        // For other types (number, boolean, etc.), return as is
        return data;
    }
    
    /**
     * Performs basic sanitization for general text input
     * @param input The input to sanitize
     * @returns Sanitized input
     */
    private sanitizeBasic(input: string): string {
        // Use the security manager's existing sanitization method
        return this.securityManager.sanitizeInput(input);
    }
    
    /**
     * Performs strict sanitization for security-sensitive data
     * @param input The input to sanitize
     * @returns Sanitized input
     */
    private sanitizeStrict(input: string): string {
        // Perform basic sanitization first
        let sanitized = this.sanitizeBasic(input);
        
        // Additional security measures for sensitive data
        // Remove special characters, limit to alphanumeric + limited symbols
        sanitized = sanitized.replace(/[^\w\s.,@\-]/g, '');
        
        // Trim whitespace
        return sanitized.trim();
    }
    
    /**
     * Sanitizes HTML content
     * @param input The HTML content to sanitize
     * @returns Sanitized HTML
     */
    private sanitizeHtml(input: string): string {
        // Start with basic sanitization from security manager
        let sanitized = this.securityManager.sanitizeInput(input);
        
        // Further sanitize specific HTML risks that might not be caught
        // Remove potentially dangerous attributes
        sanitized = sanitized.replace(/javascript:/gi, 'removed:');
        sanitized = sanitized.replace(/data:/gi, 'removed:');
        sanitized = sanitized.replace(/on\w+(\s*)=/gi, 'removed=');
        
        // Remove comments that might hide malicious content
        sanitized = sanitized.replace(/<!--[\s\S]*?-->/g, '');
        
        return sanitized;
    }
    
    /**
     * Sanitizes template variables to prevent template injection
     * @param input The template variable to sanitize
     * @returns Sanitized template variable
     */
    private sanitizeTemplateVariable(input: string): string {
        // Start with basic sanitization
        let sanitized = this.sanitizeBasic(input);
        
        // Remove template engine specific syntax to prevent injection
        // Remove handlebars-style expressions
        sanitized = sanitized.replace(/{{.*?}}/g, '');
        sanitized = sanitized.replace(/{%.*?%}/g, '');
        
        // Remove common template delimiters
        sanitized = sanitized.replace(/\$\{.*?\}/g, '');
        
        // Escape backslashes which might be used for escaping in templates
        sanitized = sanitized.replace(/\\/g, '\\\\');
        
        return sanitized;
    }
    
    /**
     * Validates and sanitizes structured document data
     * @param data The document data to validate and sanitize
     * @returns Sanitized document data
     */
    public sanitizeDocumentData(data: Record<string, any>): Record<string, any> {
        const sanitized: Record<string, any> = {};
        
        // Iterate through all properties
        for (const key in data) {
            if (Object.prototype.hasOwnProperty.call(data, key)) {
                const value = data[key];
                
                // Handle different types of data differently
                if (typeof value === 'string') {
                    // For string values, use the appropriate sanitization level based on the field
                    if (key.toLowerCase().includes('html') || key.toLowerCase().includes('content')) {
                        sanitized[key] = this.sanitize(value, SanitizationLevel.HTML);
                    } else if (key.toLowerCase().includes('template') || key.toLowerCase().includes('variable')) {
                        sanitized[key] = this.sanitize(value, SanitizationLevel.TEMPLATE_VAR);
                    } else if (key.toLowerCase().includes('password') || key.toLowerCase().includes('secret') || 
                               key.toLowerCase().includes('token') || key.toLowerCase().includes('key')) {
                        sanitized[key] = this.sanitize(value, SanitizationLevel.STRICT);
                    } else {
                        sanitized[key] = this.sanitize(value, SanitizationLevel.BASIC);
                    }
                } else if (Array.isArray(value)) {
                    // For arrays, sanitize each element
                    sanitized[key] = value.map(item => 
                        typeof item === 'string' 
                            ? this.sanitize(item, SanitizationLevel.BASIC)
                            : this.sanitizeObject(item)
                    );
                } else if (typeof value === 'object' && value !== null) {
                    // For nested objects, recursively sanitize
                    sanitized[key] = this.sanitizeDocumentData(value);
                } else {
                    // For other types (number, boolean, null, etc.), keep as is
                    sanitized[key] = value;
                }
            }
        }
        
        return sanitized;
    }
}
