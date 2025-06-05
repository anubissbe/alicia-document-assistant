import { DocumentFormat } from './documentFormat';

export enum SecurityLevel {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH'
}

export enum PlaceholderType {
    TEXT = 'TEXT',
    NUMBER = 'NUMBER',
    DATE = 'DATE',
    BOOLEAN = 'BOOLEAN',
    LIST = 'LIST',
    OBJECT = 'OBJECT',
    RICH_TEXT = 'RICH_TEXT'
}

export interface DocumentTemplate {
    id: string;
    name: string;
    description: string;
    path: string;
    type: string;
    format: DocumentFormat;
    iconPath?: string;
    dateCreated: Date;
    dateModified: Date;
    tags?: string[];
    sections?: any[];
    metadata?: {
        author?: string;
        version?: string;
        lastModified?: Date;
        category?: string;
        tags?: string[];
        [key: string]: any;
    };
}
