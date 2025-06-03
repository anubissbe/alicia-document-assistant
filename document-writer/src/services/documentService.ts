import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);
const stat = promisify(fs.stat);

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
        try {
            // Check if document is in cache
            const cachedDocument = this._documentsCache.get(documentPath);
            if (cachedDocument) {
                return cachedDocument;
            }
            
            // Get file stats
            const stats = await stat(documentPath);
            
            // Read file content
            const content = await readFile(documentPath, 'utf-8');
            
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
            throw new Error(`Failed to get document: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Save a document
     * @param document The document to save
     * @returns The saved document
     */
    public async saveDocument(document: Document): Promise<Document> {
        try {
            // Create directory if it doesn't exist
            const directory = path.dirname(document.path);
            await mkdir(directory, { recursive: true });
            
            // Write file content
            await writeFile(document.path, document.content, 'utf-8');
            
            // Update metadata
            document.dateModified = new Date();
            
            // Update cache
            this._documentsCache.set(document.path, document);
            
            return document;
        } catch (error) {
            console.error(`Error saving document ${document.path}:`, error);
            throw new Error(`Failed to save document: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            await stat(documentPath);
            
            // Delete file
            await promisify(fs.unlink)(documentPath);
            
            // Remove from cache
            this._documentsCache.delete(documentPath);
            
            return true;
        } catch (error) {
            console.error(`Error deleting document ${documentPath}:`, error);
            throw new Error(`Failed to delete document: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            const stats = await stat(documentPath);
            
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
            throw new Error(`Failed to get document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Get all documents in a directory
     * @param directoryPath The directory path
     * @returns Array of document metadata
     */
    public async getDocumentsInDirectory(directoryPath: string): Promise<DocumentMetadata[]> {
        try {
            // Get all files in directory
            const files = await promisify(fs.readdir)(directoryPath);
            
            // Get metadata for each file
            const metadataPromises = files.map(async (file) => {
                const filePath = path.join(directoryPath, file);
                
                try {
                    const fileStats = await stat(filePath);
                    
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
            const metadataArray = (await Promise.all(metadataPromises)).filter((item): item is DocumentMetadata => item !== null);
            
            return metadataArray;
        } catch (error) {
            console.error(`Error getting documents in directory ${directoryPath}:`, error);
            throw new Error(`Failed to get documents in directory: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
            await promisify(fs.rename)(documentPath, newPath);
            
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
            await writeFile(outputPath, document.content, 'utf-8');
            
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
            
            // Update metadata
            Object.assign(document, metadata, { dateModified: new Date() });
            
            // If path changed, handle rename
            if (metadata.path && metadata.path !== document.path) {
                await promisify(fs.rename)(document.path, metadata.path);
                
                // Update cache
                this._documentsCache.delete(document.path);
                this._documentsCache.set(metadata.path, document);
                
                document.path = metadata.path;
            }
            
            // Return metadata
            const { content, ...updatedMetadata } = document;
            
            return updatedMetadata;
        } catch (error) {
            console.error(`Error updating document metadata ${documentPath}:`, error);
            throw new Error(`Failed to update document metadata: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
}
