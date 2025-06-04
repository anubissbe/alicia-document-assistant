import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { constants } from 'node:fs';

const { R_OK, W_OK } = constants;
const fsPromises = fs.promises;

// Custom error class for document operations
class DocumentError extends Error {
    constructor(message: string, public code?: string) {
        super(message);
        this.name = 'DocumentError';
    }
}

// Type guard for NodeJS.ErrnoException
function isNodeError(error: unknown): error is NodeJS.ErrnoException {
    return error instanceof Error && 'code' in error;
}

// Error messages
const ERROR_MESSAGES = {
    INVALID_PATH: 'Invalid document path',
    FILE_NOT_FOUND: 'Document not found',
    ACCESS_DENIED: 'Access denied',
    INVALID_OPERATION: 'Invalid operation',
    DIRECTORY_NOT_FOUND: 'Directory not found'
};

/**
 * Document metadata interface
 */
export interface DocumentMetadata {
    path: string;
    title?: string;
    type?: string;
    dateCreated?: Date;
    dateModified?: Date;
    tags?: string[];
    author?: string;
    properties?: Record<string, any>;
}

/**
 * Document interface
 */
export interface Document extends DocumentMetadata {
    content: string;
}

/**
 * DocumentService handles document operations
 */
export class DocumentService {
    private _documentsCache: Map<string, Document> = new Map();
    
    /**
     * Constructor
     */
    constructor() {
        // Initialize any required resources
    }
    
    /**
     * Get a document by path
     * @param documentPath The document path
     * @returns The document
     */
    public async getDocument(documentPath: string): Promise<Document> {
        if (!documentPath) {
            throw new Error(ERROR_MESSAGES.INVALID_PATH);
        }

        try {
            // Check if document is in cache
            const cachedDocument = this._documentsCache.get(documentPath);
            if (cachedDocument) {
                return cachedDocument;
            }

            // Check if file exists and is accessible
            try {
                await fs.promises.access(documentPath, R_OK);
            } catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                    throw new Error(ERROR_MESSAGES.FILE_NOT_FOUND);
                }
                if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
                    throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
                }
                throw error;
            }
            
            // Get file stats
            const stats = await fs.promises.stat(documentPath);
            
            // Read file content
            const content = await fs.promises.readFile(documentPath, 'utf-8');
            
            // Create document object
            const document: Document = {
                path: documentPath,
                title: path.basename(documentPath, path.extname(documentPath)),
                type: path.extname(documentPath).slice(1),
                content,
                dateCreated: stats.birthtime,
                dateModified: stats.mtime
            };
            
            // Cache document
            this._documentsCache.set(documentPath, document);
            
            return document;
        } catch (error) {
            console.error(`Error getting document ${documentPath}:`, error);
            if (error instanceof DocumentError) {
                throw error;
            }
            throw new DocumentError(
                `Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isNodeError(error) ? error.code : undefined
            );
        }
    }
    
    /**
     * Save a document
     * @param document The document to save
     * @returns The saved document
     */
    public async saveDocument(document: Document): Promise<Document> {
        if (!document || !document.path) {
            throw new Error(ERROR_MESSAGES.INVALID_PATH);
        }

        try {
            // Validate write access to directory
            const directory = path.dirname(document.path);
            try {
                await fs.promises.access(directory, W_OK);
            } catch (error) {
                await fs.promises.mkdir(directory, { recursive: true });
            }
            
            // Write file content
            await fs.promises.writeFile(document.path, document.content, 'utf-8');
            
            // Update metadata
            document.dateModified = new Date();
            
            // Update cache
            this._documentsCache.set(document.path, document);
            
            return document;
        } catch (error) {
            console.error(`Error saving document ${document.path}:`, error);
            if (error instanceof DocumentError) {
                throw error;
            }
            throw new DocumentError(
                `Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isNodeError(error) ? error.code : undefined
            );
        }
    }
    
    /**
     * Delete a document
     * @param documentPath The document path
     * @returns True if the document was deleted
     */
    public async deleteDocument(documentPath: string): Promise<boolean> {
        try {
            // Check if document exists
            await fs.promises.stat(documentPath);
            
            // Delete file
            await fs.promises.unlink(documentPath);
            
            // Remove from cache
            this._documentsCache.delete(documentPath);
            
            return true;
        } catch (error) {
            console.error(`Error deleting document ${documentPath}:`, error);
            if (error instanceof DocumentError) {
                throw error;
            }
            throw new DocumentError(
                `Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isNodeError(error) ? error.code : undefined
            );
        }
    }
    
    /**
     * Get document metadata
     * @param documentPath The document path
     * @returns The document metadata
     */
    public async getDocumentMetadata(documentPath: string): Promise<DocumentMetadata> {
        try {
            // Check if document is in cache
            const cachedDocument = this._documentsCache.get(documentPath);
            if (cachedDocument) {
                // Return metadata without content
                const { content, ...metadata } = cachedDocument;
                return metadata;
            }
            
            // Get file stats
            const stats = await fs.promises.stat(documentPath);
            
            // Create metadata object
            const metadata: DocumentMetadata = {
                path: documentPath,
                title: path.basename(documentPath, path.extname(documentPath)),
                type: path.extname(documentPath).slice(1),
                dateCreated: stats.birthtime,
                dateModified: stats.mtime
            };
            
            return metadata;
        } catch (error) {
            console.error(`Error getting document metadata ${documentPath}:`, error);
            if (error instanceof DocumentError) {
                throw error;
            }
            throw new DocumentError(
                `Failed to get document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isNodeError(error) ? error.code : undefined
            );
        }
    }
    
    /**
     * Get all documents in a directory
     * @param directoryPath The directory path
     * @returns Array of document metadata
     */
    public async getDocumentsInDirectory(directoryPath: string): Promise<DocumentMetadata[]> {
        if (!directoryPath) {
            throw new Error(ERROR_MESSAGES.INVALID_PATH);
        }

        try {
            // Verify directory exists and is accessible
            try {
                const stats = await fs.promises.stat(directoryPath);
                if (!stats.isDirectory()) {
                    throw new Error(ERROR_MESSAGES.INVALID_PATH);
                }
                await fs.promises.access(directoryPath, R_OK);
            } catch (error) {
                if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
                    throw new Error(ERROR_MESSAGES.DIRECTORY_NOT_FOUND);
                }
                if (error instanceof Error && 'code' in error && error.code === 'EACCES') {
                    throw new Error(ERROR_MESSAGES.ACCESS_DENIED);
                }
                throw error;
            }

            // Get all files in directory
            const files = await fs.promises.readdir(directoryPath);
            
            // Get metadata for each file
            const metadataPromises = files.map(async (file: string) => {
                const filePath = path.join(directoryPath, file);
                
                try {
                    const fileStats = await fs.promises.stat(filePath);
                    
                    // Skip directories
                    if (fileStats.isDirectory()) {
                        return null;
                    }
                    
                    const metadata: DocumentMetadata = {
                        path: filePath,
                        title: path.basename(filePath, path.extname(filePath)),
                        type: path.extname(filePath).slice(1),
                        dateCreated: fileStats.birthtime,
                        dateModified: fileStats.mtime
                    };
                    
                    return metadata;
                } catch (error) {
                    console.error(`Error getting metadata for ${filePath}:`, error);
                    return null;
                }
            });
            
            // Filter out nulls - explicitly casting to satisfy TypeScript
            const metadataArray = (await Promise.all(metadataPromises)).filter((item: DocumentMetadata | null): item is DocumentMetadata => item !== null);
            
            return metadataArray;
        } catch (error) {
            console.error(`Error getting documents in directory ${directoryPath}:`, error);
            if (error instanceof DocumentError) {
                throw error;
            }
            throw new DocumentError(
                `Failed to get documents in directory: ${error instanceof Error ? error.message : 'Unknown error'}`,
                isNodeError(error) ? error.code : undefined
            );
        }
    }
    
    /**
     * Search for documents by content
     * @param searchQuery The search query
     * @param directoryPath The directory path to search in
     * @returns Array of document metadata
     */
    public async searchDocuments(searchQuery: string, directoryPath: string): Promise<DocumentMetadata[]> {
        try {
            // Get all documents in directory
            const documents = await this.getDocumentsInDirectory(directoryPath);
            
            // Search each document
            const results: DocumentMetadata[] = [];
            
            for (const metadata of documents) {
                try {
                    // Get document content
                    const document = await this.getDocument(metadata.path);
                    
                    // Check if content contains search query
                    if (document.content.toLowerCase().includes(searchQuery.toLowerCase())) {
                        results.push(metadata);
                    }
                } catch (error) {
                    console.error(`Error searching document ${metadata.path}:`, error);
                    // Skip this document
                }
            }
            
            return results;
        } catch (error) {
            console.error(`Error searching documents in ${directoryPath}:`, error);
            throw new Error(`Failed to search documents: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Create a new document
     * @param title The document title
     * @param type The document type
     * @param directoryPath The directory path
     * @param content The document content
     * @returns The created document
     */
    public async createDocument(
        title: string,
        type: string,
        directoryPath: string,
        content: string = ''
    ): Promise<Document> {
        try {
            // Create file path
            const fileName = `${title}${type.startsWith('.') ? type : `.${type}`}`;
            const filePath = path.join(directoryPath, fileName);
            
            // Create document
            const document: Document = {
                path: filePath,
                title,
                type: type.startsWith('.') ? type.slice(1) : type,
                content,
                dateCreated: new Date(),
                dateModified: new Date()
            };
            
            // Save document
            return await this.saveDocument(document);
        } catch (error) {
            console.error(`Error creating document ${title}:`, error);
            throw new Error(`Failed to create document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Rename a document
     * @param documentPath The document path
     * @param newTitle The new title
     * @returns The renamed document
     */
    public async renameDocument(documentPath: string, newTitle: string): Promise<Document> {
        try {
            // Get document
            const document = await this.getDocument(documentPath);
            
            // Create new path
            const directory = path.dirname(documentPath);
            const extension = path.extname(documentPath);
            const newPath = path.join(directory, `${newTitle}${extension}`);
            
            // Rename file
            await fs.promises.rename(documentPath, newPath);
            
            // Update document
            document.path = newPath;
            document.title = newTitle;
            document.dateModified = new Date();
            
            // Update cache
            this._documentsCache.delete(documentPath);
            this._documentsCache.set(newPath, document);
            
            return document;
        } catch (error) {
            console.error(`Error renaming document ${documentPath}:`, error);
            throw new Error(`Failed to rename document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Export a document to a different format
     * @param document The document to export
     * @param targetFormat The target format
     * @param outputPath The output path
     * @returns The exported document path
     */
    public async exportDocument(
        document: Document,
        targetFormat: string,
        outputPath?: string
    ): Promise<string> {
        try {
            // If no output path, create one
            if (!outputPath) {
                const directory = path.dirname(document.path);
                const baseName = path.basename(document.path, path.extname(document.path));
                outputPath = path.join(directory, `${baseName}.${targetFormat}`);
            }
            
            // In a real implementation, we would use a format processor to convert the content
            // For now, we'll just write the content as is
            await fs.promises.writeFile(outputPath, document.content, 'utf-8');
            
            return outputPath;
        } catch (error) {
            console.error(`Error exporting document ${document.path}:`, error);
            throw new Error(`Failed to export document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Update document metadata
     * @param documentPath The document path
     * @param metadata The metadata to update
     * @returns The updated document metadata
     */
    public async updateDocumentMetadata(
        documentPath: string,
        metadata: Partial<DocumentMetadata>
    ): Promise<DocumentMetadata> {
        try {
            // Get document
            const document = await this.getDocument(documentPath);
            const oldPath = document.path;
            
            // Handle path update first if needed
            if (metadata.path && metadata.path !== oldPath) {
                // Attempt rename
                await fs.promises.rename(oldPath, metadata.path);
                
                // Update document path
                document.path = metadata.path;
                
                // Update cache
                this._documentsCache.delete(oldPath);
                this._documentsCache.set(metadata.path, document);
            }
            
            // Update other metadata
            Object.assign(document, {
                ...metadata,
                dateModified: new Date()
            });
            
            // Return metadata without content
            const { content, ...updatedMetadata } = document;
            return updatedMetadata;
        } catch (error) {
            console.error(`Error updating document metadata ${documentPath}:`, error);
            throw new Error(`Failed to update document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Generate a preview of the document
     * @param document The document to preview
     * @returns The path to the generated preview file
     */
    public async generatePreview(document: any): Promise<string> {
        try {
            const previewDir = path.join(vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '', '.previews');
            
            // Ensure preview directory exists
            if (!fs.existsSync(previewDir)) {
                await fs.promises.mkdir(previewDir, { recursive: true });
            }
            
            // Generate preview filename
            const previewName = `${document.title || 'document'}_preview.html`;
            const previewPath = path.join(previewDir, previewName);
            
            // Convert document content to HTML for preview
            let previewContent = '';
            if (document.type === 'markdown') {
                // Basic markdown to HTML conversion (simplified)
                previewContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Preview: ${document.title || 'Document'}</title>
                        <style>
                            body { font-family: Arial, sans-serif; margin: 20px; }
                            pre { background: #f4f4f4; padding: 10px; border-radius: 4px; }
                        </style>
                    </head>
                    <body>
                        <h1>${document.title || 'Document Preview'}</h1>
                        <pre>${document.content || ''}</pre>
                    </body>
                    </html>
                `;
            } else {
                previewContent = `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <title>Preview: ${document.title || 'Document'}</title>
                    </head>
                    <body>
                        <h1>${document.title || 'Document Preview'}</h1>
                        <div>${document.content || ''}</div>
                    </body>
                    </html>
                `;
            }
            
            // Write preview file
            await fs.promises.writeFile(previewPath, previewContent, 'utf8');
            
            return previewPath;
        } catch (error) {
            console.error('Error generating preview:', error);
            throw new Error(`Failed to generate preview: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Generate a document from template or content
     * @param document The document to generate
     * @returns The path to the generated document
     */
    public async generateDocument(document: any): Promise<string> {
        try {
            const outputDir = vscode.workspace.getConfiguration('documentWriter').get('outputPath') as string || './generated-documents';
            const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
            const resolvedOutputDir = outputDir.startsWith('./') ? path.join(workspacePath, outputDir.substring(2)) : outputDir;
            
            // Ensure output directory exists
            if (!fs.existsSync(resolvedOutputDir)) {
                await fs.promises.mkdir(resolvedOutputDir, { recursive: true });
            }
            
            // Generate filename based on document type
            const fileName = `${document.title || 'document'}.${document.type === 'markdown' ? 'md' : 'txt'}`;
            const outputPath = path.join(resolvedOutputDir, fileName);
            
            // Write document content
            await fs.promises.writeFile(outputPath, document.content || '', 'utf8');
            
            return outputPath;
        } catch (error) {
            console.error('Error generating document:', error);
            throw new Error(`Failed to generate document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
