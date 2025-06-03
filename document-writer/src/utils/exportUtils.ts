import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { promisify } from 'util';
import { DocumentFormat } from '../core/formatProcessor';
import { FormatProcessor } from '../core/formatProcessor';
import { Document } from '../services/documentService';

// Promisify fs functions
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Export options interface
 */
export interface ExportOptions {
    includeMetadata?: boolean;
    prettify?: boolean;
    embedResources?: boolean;
    outputPath?: string;
    overwrite?: boolean;
}

/**
 * Export result interface
 */
export interface ExportResult {
    success: boolean;
    path: string;
    format: string;
    error?: string;
}

/**
 * ExportUtils provides utilities for exporting documents to various formats
 */
export class ExportUtils {
    private _formatProcessor: FormatProcessor;
    
    /**
     * Constructor
     */
    constructor() {
        this._formatProcessor = new FormatProcessor();
    }
    
    /**
     * Export a document to a specific format
     * @param document The document to export
     * @param targetFormat The target format
     * @param options Export options
     * @returns The export result
     */
    public async exportDocument(
        document: Document,
        targetFormat: DocumentFormat,
        options: ExportOptions = {}
    ): Promise<ExportResult> {
        try {
            // Get source format from document type
            const sourceFormat = document.type as DocumentFormat;
            
            // Validate source format
            if (!Object.values(DocumentFormat).includes(sourceFormat)) {
                throw new Error(`Unsupported source format: ${sourceFormat}`);
            }
            
            // Determine output path
            const outputPath = this._determineOutputPath(document, targetFormat, options);
            
            // Ensure output directory exists
            await mkdir(path.dirname(outputPath), { recursive: true });
            
            // Check if file exists and overwrite option is false
            if (fs.existsSync(outputPath) && options.overwrite === false) {
                throw new Error(`File already exists: ${outputPath}`);
            }
            
            // Process content
            let processedContent = document.content;
            
            // Convert content to target format if needed
            if (sourceFormat !== targetFormat) {
                processedContent = this._formatProcessor.processContent(
                    processedContent,
                    sourceFormat,
                    targetFormat
                );
            }
            
            // Add metadata if requested
            if (options.includeMetadata) {
                processedContent = this._addMetadata(processedContent, document, targetFormat);
            }
            
            // Prettify content if requested
            if (options.prettify) {
                processedContent = this._prettifyContent(processedContent, targetFormat);
            }
            
            // Embed resources if requested
            if (options.embedResources) {
                processedContent = await this._embedResources(processedContent, document, targetFormat);
            }
            
            // Write file
            await writeFile(outputPath, processedContent, 'utf-8');
            
            // Return result
            return {
                success: true,
                path: outputPath,
                format: targetFormat
            };
        } catch (error) {
            console.error('Export error:', error);
            
            return {
                success: false,
                path: '',
                format: targetFormat,
                error: error instanceof Error ? error.message : 'Unknown error'
            };
        }
    }
    
    /**
     * Export a document to multiple formats
     * @param document The document to export
     * @param targetFormats The target formats
     * @param options Export options
     * @returns The export results
     */
    public async exportDocumentToMultipleFormats(
        document: Document,
        targetFormats: DocumentFormat[],
        options: ExportOptions = {}
    ): Promise<ExportResult[]> {
        const results: ExportResult[] = [];
        
        for (const format of targetFormats) {
            const result = await this.exportDocument(document, format, options);
            results.push(result);
        }
        
        return results;
    }
    
    /**
     * Determine the output path for an exported document
     * @param document The document
     * @param targetFormat The target format
     * @param options Export options
     * @returns The output path
     */
    private _determineOutputPath(
        document: Document,
        targetFormat: string,
        options: ExportOptions
    ): string {
        // If output path is provided, use it
        if (options.outputPath) {
            return options.outputPath;
        }
        
        // Otherwise, create a path based on the document path
        const directory = path.dirname(document.path);
        const baseName = path.basename(document.path, path.extname(document.path));
        
        return path.join(directory, `${baseName}.${targetFormat}`);
    }
    
    /**
     * Add metadata to the document content
     * @param content The document content
     * @param document The document
     * @param targetFormat The target format
     * @returns The content with metadata
     */
    private _addMetadata(
        content: string,
        document: Document,
        targetFormat: string
    ): string {
        // Add metadata based on target format
        switch (targetFormat) {
            case DocumentFormat.MARKDOWN:
                return this._addMarkdownMetadata(content, document);
                
            case DocumentFormat.HTML:
                return this._addHtmlMetadata(content, document);
                
            case DocumentFormat.TEXT:
                return this._addTextMetadata(content, document);
                
            // DOCX and PDF metadata would be handled differently
            // and likely require the use of specialized libraries
                
            default:
                // For unsupported formats, return content unchanged
                return content;
        }
    }
    
    /**
     * Add metadata to Markdown content
     * @param content The Markdown content
     * @param document The document
     * @returns The Markdown content with metadata
     */
    private _addMarkdownMetadata(content: string, document: Document): string {
        // Create frontmatter
        let frontmatter = '---\n';
        
        // Add document metadata
        if (document.title) {
            frontmatter += `title: ${document.title}\n`;
        }
        
        if (document.author) {
            frontmatter += `author: ${document.author}\n`;
        }
        
        if (document.dateCreated) {
            frontmatter += `date: ${document.dateCreated.toISOString()}\n`;
        }
        
        if (document.dateModified) {
            frontmatter += `lastModified: ${document.dateModified.toISOString()}\n`;
        }
        
        if (document.tags && document.tags.length > 0) {
            frontmatter += `tags: [${document.tags.join(', ')}]\n`;
        }
        
        // Add custom properties
        if (document.properties) {
            for (const [key, value] of Object.entries(document.properties)) {
                frontmatter += `${key}: ${JSON.stringify(value)}\n`;
            }
        }
        
        frontmatter += '---\n\n';
        
        // Add frontmatter to content
        return frontmatter + content;
    }
    
    /**
     * Add metadata to HTML content
     * @param content The HTML content
     * @param document The document
     * @returns The HTML content with metadata
     */
    private _addHtmlMetadata(content: string, document: Document): string {
        // Create metadata tags
        let metadataTags = '';
        
        if (document.title) {
            metadataTags += `<meta name="title" content="${this._escapeHtml(document.title)}">\n`;
        }
        
        if (document.author) {
            metadataTags += `<meta name="author" content="${this._escapeHtml(document.author)}">\n`;
        }
        
        if (document.dateCreated) {
            metadataTags += `<meta name="date-created" content="${document.dateCreated.toISOString()}">\n`;
        }
        
        if (document.dateModified) {
            metadataTags += `<meta name="date-modified" content="${document.dateModified.toISOString()}">\n`;
        }
        
        if (document.tags && document.tags.length > 0) {
            metadataTags += `<meta name="keywords" content="${this._escapeHtml(document.tags.join(', '))}">\n`;
        }
        
        // Add custom properties
        if (document.properties) {
            for (const [key, value] of Object.entries(document.properties)) {
                metadataTags += `<meta name="${this._escapeHtml(key)}" content="${this._escapeHtml(JSON.stringify(value))}">\n`;
            }
        }
        
        // Check if the content already has a head tag
        if (content.includes('<head>')) {
            // Insert metadata tags after the head tag
            return content.replace('<head>', '<head>\n' + metadataTags);
        } else if (content.includes('<html>')) {
            // Insert head tag with metadata tags after the html tag
            return content.replace('<html>', '<html>\n<head>\n' + metadataTags + '</head>');
        } else {
            // Create a new HTML document with metadata
            return `<!DOCTYPE html>\n<html>\n<head>\n${metadataTags}<title>${
                document.title ? this._escapeHtml(document.title) : 'Document'
            }</title>\n</head>\n<body>\n${content}\n</body>\n</html>`;
        }
    }
    
    /**
     * Add metadata to text content
     * @param content The text content
     * @param document The document
     * @returns The text content with metadata
     */
    private _addTextMetadata(content: string, document: Document): string {
        // Create metadata header
        let metadataHeader = '# Document Metadata\n';
        
        if (document.title) {
            metadataHeader += `Title: ${document.title}\n`;
        }
        
        if (document.author) {
            metadataHeader += `Author: ${document.author}\n`;
        }
        
        if (document.dateCreated) {
            metadataHeader += `Date Created: ${document.dateCreated.toISOString()}\n`;
        }
        
        if (document.dateModified) {
            metadataHeader += `Date Modified: ${document.dateModified.toISOString()}\n`;
        }
        
        if (document.tags && document.tags.length > 0) {
            metadataHeader += `Tags: ${document.tags.join(', ')}\n`;
        }
        
        // Add custom properties
        if (document.properties) {
            metadataHeader += 'Properties:\n';
            
            for (const [key, value] of Object.entries(document.properties)) {
                metadataHeader += `  ${key}: ${JSON.stringify(value)}\n`;
            }
        }
        
        metadataHeader += '\n' + '-'.repeat(80) + '\n\n';
        
        // Add metadata header to content
        return metadataHeader + content;
    }
    
    /**
     * Prettify content
     * @param content The content to prettify
     * @param targetFormat The target format
     * @returns The prettified content
     */
    private _prettifyContent(content: string, targetFormat: string): string {
        // Prettify content based on target format
        switch (targetFormat) {
            case DocumentFormat.HTML:
                return this._prettifyHtml(content);
                
            case DocumentFormat.MARKDOWN:
                return this._prettifyMarkdown(content);
                
            default:
                // For unsupported formats, return content unchanged
                return content;
        }
    }
    
    /**
     * Prettify HTML content
     * @param content The HTML content
     * @returns The prettified HTML content
     */
    private _prettifyHtml(content: string): string {
        // In a real implementation, we would use a library like js-beautify
        // For this implementation, we'll do a simple indentation
        
        let result = '';
        let indentLevel = 0;
        let inTag = false;
        let inContent = false;
        
        for (let i = 0; i < content.length; i++) {
            const char = content[i];
            const nextChar = content[i + 1] || '';
            
            if (char === '<' && nextChar !== '/') {
                // Opening tag
                if (inContent) {
                    result += '\n';
                    inContent = false;
                }
                
                result += '\n' + '  '.repeat(indentLevel) + char;
                indentLevel++;
                inTag = true;
            } else if (char === '<' && nextChar === '/') {
                // Closing tag
                indentLevel--;
                
                if (inContent) {
                    result += char;
                    inContent = false;
                } else {
                    result += '\n' + '  '.repeat(indentLevel) + char;
                }
                
                inTag = true;
            } else if (char === '>') {
                // End of tag
                result += char;
                inTag = false;
                
                if (nextChar !== '<' && nextChar.trim() !== '') {
                    inContent = true;
                }
            } else {
                result += char;
                
                if (!inTag && char.trim() !== '') {
                    inContent = true;
                }
            }
        }
        
        return result;
    }
    
    /**
     * Prettify Markdown content
     * @param content The Markdown content
     * @returns The prettified Markdown content
     */
    private _prettifyMarkdown(content: string): string {
        // In a real implementation, we would use a library like prettier
        // For this implementation, we'll do a simple formatting
        
        // Split content into lines
        const lines = content.split('\n');
        let result = '';
        
        // Process each line
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const nextLine = lines[i + 1] || '';
            
            // Add current line
            result += line;
            
            // Add newline
            if (i < lines.length - 1) {
                result += '\n';
                
                // Add extra newline after headings
                if (line.startsWith('#') && line.trim() !== '' && !nextLine.startsWith('#')) {
                    result += '\n';
                }
                
                // Add extra newline after code blocks
                if (line.startsWith('```') && !nextLine.startsWith('```')) {
                    result += '\n';
                }
                
                // Add extra newline after lists if next line is not a list
                if ((line.startsWith('- ') || line.startsWith('* ') || line.match(/^\d+\. /)) &&
                    !(nextLine.startsWith('- ') || nextLine.startsWith('* ') || nextLine.match(/^\d+\. /)) &&
                    nextLine.trim() !== '') {
                    result += '\n';
                }
            }
        }
        
        return result;
    }
    
    /**
     * Embed resources in content
     * @param content The content
     * @param document The document
     * @param targetFormat The target format
     * @returns The content with embedded resources
     */
    private async _embedResources(
        content: string,
        document: Document,
        targetFormat: string
    ): Promise<string> {
        // In a real implementation, we would embed resources (e.g., images) in the content
        // For this implementation, we'll return the content unchanged
        return content;
    }
    
    /**
     * Escape HTML special characters
     * @param text The text to escape
     * @returns The escaped text
     */
    private _escapeHtml(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#39;');
    }
}
