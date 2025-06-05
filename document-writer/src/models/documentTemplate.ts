import { DocumentFormat } from './documentFormat';

export enum SecurityLevel {
    LOW = 'LOW',
    MEDIUM = 'MEDIUM',
    HIGH = 'HIGH'
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
    metadata?: {
        author?: string;
        version?: string;
        lastModified?: Date;
        category?: string;
        tags?: string[];
        [key: string]: any;
    };
}
