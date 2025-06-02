/**
 * Document Template Interfaces
 * These interfaces define the structure for document templates and their metadata.
 */

export interface DocumentTemplate {
    id: string;
    name: string;
    description: string;
    format: DocumentFormat;
    templatePath: string;
    metadata: TemplateMetadata;
    sections: TemplateSection[];
    createdAt: Date;
    updatedAt: Date;
}

export enum DocumentFormat {
    DOCX = 'docx',
    HTML = 'html',
    MARKDOWN = 'markdown',
    PDF = 'pdf'
}

export interface TemplateMetadata {
    author: string;
    version: string;
    tags: string[];
    category: string;
    isDefault?: boolean;
}

export interface TemplateSection {
    id: string;
    name: string;
    description: string;
    placeholders: Placeholder[];
    isRequired: boolean;
    order: number;
}

export interface Placeholder {
    id: string;
    key: string;
    description: string;
    defaultValue?: string;
    type: PlaceholderType;
    isRequired: boolean;
    validationRules?: ValidationRule[];
}

export enum PlaceholderType {
    TEXT = 'text',
    NUMBER = 'number',
    DATE = 'date',
    BOOLEAN = 'boolean',
    LIST = 'list',
    IMAGE = 'image',
    TABLE = 'table',
    RICH_TEXT = 'rich_text',
    DYNAMIC = 'dynamic'
}

export interface ValidationRule {
    type: ValidationRuleType;
    params?: any;
    errorMessage: string;
}

export enum ValidationRuleType {
    REQUIRED = 'required',
    MIN_LENGTH = 'min_length',
    MAX_LENGTH = 'max_length',
    PATTERN = 'pattern',
    MIN_VALUE = 'min_value',
    MAX_VALUE = 'max_value',
    CUSTOM = 'custom'
}
