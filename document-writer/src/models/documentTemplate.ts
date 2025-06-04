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
    metadata?: {
        author?: string;
        version?: string;
        lastModified?: Date;
        [key: string]: any;
    };
}
