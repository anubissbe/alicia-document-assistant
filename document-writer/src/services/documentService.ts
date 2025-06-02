import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as PizZipModule from 'pizzip';
const PizZip = PizZipModule.default || PizZipModule;
import * as DocxtemplaterModule from 'docxtemplater';
const Docxtemplater = DocxtemplaterModule.default || DocxtemplaterModule;
import { DocumentFormat, DocumentTemplate } from '../models/documentTemplate';

/**
 * Service responsible for document generation and manipulation
 */
export class DocumentService {
    private _extensionContext: vscode.ExtensionContext;
    
    constructor(context: vscode.ExtensionContext) {
        this._extensionContext = context;
    }

    /**
     * Generate a document from a template with the provided data
     * @param template The document template to use
     * @param data The data to fill into the template
     * @param outputPath The path to save the generated document to
     * @returns The path to the generated document
     */
    public async generateDocument(
        template: DocumentTemplate, 
        data: Record<string, any>,
        outputPath: string
    ): Promise<string> {
        try {
            switch (template.format) {
                case DocumentFormat.DOCX:
                    return await this.generateDocxDocument(template, data, outputPath);
                case DocumentFormat.MARKDOWN:
                    return await this.generateMarkdownDocument(template, data, outputPath);
                case DocumentFormat.HTML:
                    return await this.generateHtmlDocument(template, data, outputPath);
                case DocumentFormat.PDF:
                    return await this.generatePdfDocument(template, data, outputPath);
                default:
                    throw new Error(`Unsupported document format: ${template.format}`);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`Error generating document: ${error instanceof Error ? error.message : String(error)}`);
            throw error;
        }
    }
    
    /**
     * Generate a DOCX document from a template
     */
    private async generateDocxDocument(
        template: DocumentTemplate, 
        data: Record<string, any>,
        outputPath: string
    ): Promise<string> {
        // Ensure the output directory exists
        await this.ensureDirectoryExists(outputPath);
        
        // Construct the output file path
        const filename = `${this.sanitizeFilename(template.name)}_${new Date().toISOString().replace(/:/g, '-')}.docx`;
        const fullOutputPath = path.join(outputPath, filename);
        
        try {
            // Read the template
            const templatePath = template.templatePath;
            const templateContent = fs.readFileSync(templatePath, 'binary');
            
            // Create a new zip from the template
            const zip = new PizZip(templateContent);
            
            // Create a new Docxtemplater instance
            const doc = new Docxtemplater(zip, {
                paragraphLoop: true,
                linebreaks: true,
            });
            
            // Set the data
            doc.setData(data);
            
            // Render the document
            doc.render();
            
            // Get the zip document and generate the output
            const buffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE',
            });
            
            // Write the output
            fs.writeFileSync(fullOutputPath, buffer);
            
            return fullOutputPath;
        } catch (error) {
            console.error('Error generating DOCX document:', error);
            throw error;
        }
    }
    
    /**
     * Generate a Markdown document from a template
     */
    private async generateMarkdownDocument(
        template: DocumentTemplate, 
        data: Record<string, any>,
        outputPath: string
    ): Promise<string> {
        // Ensure the output directory exists
        await this.ensureDirectoryExists(outputPath);
        
        // Construct the output file path
        const filename = `${this.sanitizeFilename(template.name)}_${new Date().toISOString().replace(/:/g, '-')}.md`;
        const fullOutputPath = path.join(outputPath, filename);
        
        try {
            // Read the template
            const templateContent = fs.readFileSync(template.templatePath, 'utf-8');
            
            // Simple template replacement for now - can be replaced with a more robust solution
            let result = templateContent;
            
            // Replace all placeholders
            for (const [key, value] of Object.entries(data)) {
                const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                result = result.replace(regex, String(value));
            }
            
            // Write the output
            fs.writeFileSync(fullOutputPath, result);
            
            return fullOutputPath;
        } catch (error) {
            console.error('Error generating Markdown document:', error);
            throw error;
        }
    }
    
    /**
     * Generate an HTML document from a template
     */
    private async generateHtmlDocument(
        template: DocumentTemplate, 
        data: Record<string, any>,
        outputPath: string
    ): Promise<string> {
        // Implementation will be added in Phase 2
        throw new Error('HTML document generation not yet implemented');
    }
    
    /**
     * Generate a PDF document from a template
     */
    private async generatePdfDocument(
        template: DocumentTemplate, 
        data: Record<string, any>,
        outputPath: string
    ): Promise<string> {
        // Implementation will be added in Phase 2
        throw new Error('PDF document generation not yet implemented');
    }
    
    /**
     * Ensure that a directory exists, creating it if necessary
     */
    private async ensureDirectoryExists(directoryPath: string): Promise<void> {
        try {
            await fs.promises.mkdir(directoryPath, { recursive: true });
        } catch (error) {
            console.error('Error creating directory:', error);
            throw error;
        }
    }
    
    /**
     * Sanitize a filename to ensure it's valid
     */
    private sanitizeFilename(filename: string): string {
        // Replace invalid characters and spaces with underscores
        return filename.replace(/[/\\?%*:|"<>\s]/g, '_');
    }
}
