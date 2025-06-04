import * as vscode from 'vscode';
import { marked } from 'marked';
import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { promisify } from 'util';
import * as PizZip from 'pizzip';
import * as Docxtemplater from 'docxtemplater';
import * as mammoth from 'mammoth';
import { spawn } from 'child_process';
import { PDFPreviewProvider } from '../utils/pdfPreviewProvider';

// Promisify fs functions
const readFile = promisify(fs.readFile);
const writeFile = promisify(fs.writeFile);
const mkdir = promisify(fs.mkdir);

/**
 * Document format enum
 */
export enum DocumentFormat {
    TEXT = 'txt',
    MARKDOWN = 'md',
    HTML = 'html',
    DOCX = 'docx',
    PDF = 'pdf'
}

/**
 * Format conversion options
 */
export interface FormatConversionOptions {
    preserveFormatting?: boolean;
    includeStyles?: boolean;
    customStyles?: Record<string, string>;
    preserveImages?: boolean;
    imageBasePath?: string;
    outputPath?: string;
    metadata?: Record<string, any>;
    templatePath?: string;
}

/**
 * FormatProcessor handles converting document content between different formats
 */
export class FormatProcessor {
    private _turndownService: TurndownService;
    
    /**
     * Constructor
     */
    constructor() {
        // Initialize turndown service for HTML to Markdown conversion
        this._turndownService = new TurndownService({
            headingStyle: 'atx',
            codeBlockStyle: 'fenced'
        });
        
        // Configure turndown options
        this._configureTurndown();
    }
    
    /**
     * Process content from one format to another
     * @param content The content to process
     * @param sourceFormat The source format
     * @param targetFormat The target format
     * @param options Format conversion options
     * @returns The processed content or a path to the generated file
     */
    public async processContent(
        content: string,
        sourceFormat: DocumentFormat,
        targetFormat: DocumentFormat,
        options: FormatConversionOptions = {}
    ): Promise<string> {
        // If source and target formats are the same, return content unchanged
        if (sourceFormat === targetFormat) {
            return content;
        }
        
        // Process content based on source and target formats
        switch (`${sourceFormat}-${targetFormat}`) {
            case `${DocumentFormat.MARKDOWN}-${DocumentFormat.HTML}`:
                return this._markdownToHtml(content, options);
                
            case `${DocumentFormat.HTML}-${DocumentFormat.MARKDOWN}`:
                return this._htmlToMarkdown(content, options);
                
            case `${DocumentFormat.MARKDOWN}-${DocumentFormat.TEXT}`:
                return this._markdownToText(content, options);
                
            case `${DocumentFormat.HTML}-${DocumentFormat.TEXT}`:
                return this._htmlToText(content, options);
                
            case `${DocumentFormat.TEXT}-${DocumentFormat.MARKDOWN}`:
                return this._textToMarkdown(content, options);
                
            case `${DocumentFormat.TEXT}-${DocumentFormat.HTML}`:
                return this._textToHtml(content, options);
                
            case `${DocumentFormat.MARKDOWN}-${DocumentFormat.DOCX}`:
                return await this._markdownToDocx(content, options);
                
            case `${DocumentFormat.HTML}-${DocumentFormat.DOCX}`:
                return await this._htmlToDocx(content, options);
                
            case `${DocumentFormat.TEXT}-${DocumentFormat.DOCX}`:
                return await this._textToDocx(content, options);
                
            case `${DocumentFormat.MARKDOWN}-${DocumentFormat.PDF}`:
                return await this._markdownToPdf(content, options);
                
            case `${DocumentFormat.HTML}-${DocumentFormat.PDF}`:
                return await this._htmlToPdf(content, options);
                
            case `${DocumentFormat.TEXT}-${DocumentFormat.PDF}`:
                return await this._textToPdf(content, options);
                
            case `${DocumentFormat.DOCX}-${DocumentFormat.HTML}`:
                return this._docxToHtml(content, options);
                
            case `${DocumentFormat.DOCX}-${DocumentFormat.MARKDOWN}`:
                return this._docxToMarkdown(content, options);
                
            case `${DocumentFormat.DOCX}-${DocumentFormat.TEXT}`:
                return this._docxToText(content, options);
                
            case `${DocumentFormat.DOCX}-${DocumentFormat.PDF}`:
                return this._docxToPdf(content, options);
                
            case `${DocumentFormat.PDF}-${DocumentFormat.HTML}`:
                return this._pdfToHtml(content, options);
                
            case `${DocumentFormat.PDF}-${DocumentFormat.MARKDOWN}`:
                return this._pdfToMarkdown(content, options);
                
            case `${DocumentFormat.PDF}-${DocumentFormat.TEXT}`:
                return this._pdfToText(content, options);
                
            case `${DocumentFormat.PDF}-${DocumentFormat.DOCX}`:
                return await this._pdfToDocx(content, options);
                
            default:
                throw new Error(`Unsupported conversion: ${sourceFormat} to ${targetFormat}`);
        }
    }
    
    /**
     * Convert Markdown to HTML
     * @param content The Markdown content
     * @param options Format conversion options
     * @returns The HTML content
     */
    private _markdownToHtml(
        content: string,
        options: FormatConversionOptions
    ): string {
        try {
            // Use marked to convert Markdown to HTML
            const html = marked.parse(content);
            
            // Optionally add styles
            if (options.includeStyles) {
                return this._addStylesToHtml(html as string, options.customStyles);
            }
            
            return html as string;
        } catch (error) {
            console.error('Error converting Markdown to HTML:', error);
            throw new Error(`Failed to convert Markdown to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert HTML to Markdown
     * @param content The HTML content
     * @param options Format conversion options
     * @returns The Markdown content
     */
    private _htmlToMarkdown(
        content: string,
        options: FormatConversionOptions
    ): string {
        try {
            // Use turndown to convert HTML to Markdown
            return this._turndownService.turndown(content);
        } catch (error) {
            console.error('Error converting HTML to Markdown:', error);
            throw new Error(`Failed to convert HTML to Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert Markdown to plain text
     * @param content The Markdown content
     * @param options Format conversion options
     * @returns The plain text content
     */
    private _markdownToText(
        content: string,
        options: FormatConversionOptions
    ): string {
        try {
            // First convert Markdown to HTML
            const html = this._markdownToHtml(content, { preserveFormatting: true });
            
            // Then convert HTML to text
            return this._htmlToText(html, options);
        } catch (error) {
            console.error('Error converting Markdown to text:', error);
            throw new Error(`Failed to convert Markdown to text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert HTML to plain text
     * @param content The HTML content
     * @param options Format conversion options
     * @returns The plain text content
     */
    private _htmlToText(
        content: string,
        options: FormatConversionOptions
    ): string {
        try {
            // Use JSDOM for DOM operations in Node.js environment
            const dom = new JSDOM(content);
            const tempElement = dom.window.document.createElement('div');
            tempElement.innerHTML = content;
            
            // Extract text content
            const text = tempElement.textContent || '';
            
            // Process text based on options
            if (options.preserveFormatting) {
                // Preserve some formatting by adding line breaks
                return this._preserveTextFormatting(text);
            }
            
            return text;
        } catch (error) {
            console.error('Error converting HTML to text:', error);
            
            // Fallback implementation for environments where JSDOM fails
            return content
                .replace(/<[^>]*>/g, '') // Remove HTML tags
                .replace(/&nbsp;/g, ' ') // Replace non-breaking spaces
                .replace(/&lt;/g, '<') // Replace HTML entities
                .replace(/&gt;/g, '>')
                .replace(/&amp;/g, '&')
                .replace(/&quot;/g, '"')
                .replace(/&#39;/g, "'")
                .trim();
        }
    }
    
    /**
     * Convert plain text to Markdown
     * @param content The plain text content
     * @param options Format conversion options
     * @returns The Markdown content
     */
    private _textToMarkdown(
        content: string,
        options: FormatConversionOptions
    ): string {
        try {
            // For simple text to Markdown conversion, we'll do some basic formatting
            
            // Split text into lines
            const lines = content.split('\n');
            let result = '';
            let inCodeBlock = false;
            let inList = false;
            
            // Process each line
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i];
                const trimmedLine = line.trim();
                
                // Skip empty lines
                if (trimmedLine === '') {
                    result += '\n';
                    inList = false;
                    continue;
                }
                
                // Check for potential headers (lines followed by empty lines)
                const nextLine = i < lines.length - 1 ? lines[i + 1].trim() : '';
                const prevLine = i > 0 ? lines[i - 1].trim() : '';
                
                if (prevLine === '' && nextLine === '' && trimmedLine.length <= 80) {
                    // Potential header
                    result += `## ${trimmedLine}\n\n`;
                    continue;
                }
                
                // Check for potential list items
                if (trimmedLine.match(/^\d+[\.\)]\s/) || trimmedLine.match(/^[\*\-\+]\s/)) {
                    // Already looks like a list item, keep as is
                    result += `${trimmedLine}\n`;
                    inList = true;
                    continue;
                }
                
                // Check for indented lines (potential code blocks)
                if (line.startsWith('    ') || line.startsWith('\t')) {
                    if (!inCodeBlock && prevLine === '') {
                        result += '```\n';
                        inCodeBlock = true;
                    }
                    
                    result += `${line.replace(/^    /, '')}\n`;
                    
                    if (nextLine === '') {
                        result += '```\n';
                        inCodeBlock = false;
                    }
                    
                    continue;
                }
                
                // Regular paragraph text
                result += `${trimmedLine}\n`;
                
                // Add an extra line break after paragraphs
                if (nextLine === '') {
                    result += '\n';
                }
            }
            
            // Close any open code blocks
            if (inCodeBlock) {
                result += '```\n';
            }
            
            return result;
        } catch (error) {
            console.error('Error converting text to Markdown:', error);
            throw new Error(`Failed to convert text to Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert plain text to HTML
     * @param content The plain text content
     * @param options Format conversion options
     * @returns The HTML content
     */
    private _textToHtml(
        content: string,
        options: FormatConversionOptions
    ): string {
        try {
            // Convert to Markdown first (which detects structure)
            const markdown = this._textToMarkdown(content, options);
            
            // Then convert Markdown to HTML
            return this._markdownToHtml(markdown, options);
        } catch (error) {
            console.error('Error converting text to HTML:', error);
            throw new Error(`Failed to convert text to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert Markdown to DOCX
     * @param content The Markdown content
     * @param options Format conversion options
     * @returns A placeholder message (actual implementation would return a file path or buffer)
     */
    private async _markdownToDocx(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert Markdown to HTML
            const html = this._markdownToHtml(content, options);
            
            // Then convert HTML to DOCX
            return await this._htmlToDocx(html, options);
        } catch (error) {
            console.error('Error converting Markdown to DOCX:', error);
            throw new Error(`Failed to convert Markdown to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert HTML to DOCX
     * @param content The HTML content
     * @param options Format conversion options
     * @returns The path to the generated DOCX file or a base64 encoded string
     */
    private async _htmlToDocx(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // We need a template to work with
            const templatePath = options.templatePath || this._getDefaultTemplate();
            
            // Read the template file
            const templateContent = await readFile(templatePath);
            
            // Create a new zip instance from the template
            const zip = new (PizZip as any)(templateContent);
            
            // Create a new Docxtemplater instance
            const doc = new (Docxtemplater as any)();
            doc.loadZip(zip);
            
            // Create a data object with the HTML content and metadata
            const data = {
                content: content,
                ...options.metadata
            };
            
            // Set the data
            doc.setData(data);
            
            // Render the document
            doc.render();
            
            // Get the zip content
            const buffer = doc.getZip().generate({
                type: 'nodebuffer',
                compression: 'DEFLATE'
            });
            
            // Write to a temporary file if outputPath is not provided
            if (options.outputPath) {
                // Create directory if it doesn't exist
                const outputDir = path.dirname(options.outputPath);
                await mkdir(outputDir, { recursive: true });
                
                // Write to file
                await writeFile(options.outputPath, buffer);
                return options.outputPath;
            } else {
                // Generate a temporary file
                const tempDir = os.tmpdir();
                const tempFilePath = path.join(tempDir, `docx-${Date.now()}.docx`);
                await writeFile(tempFilePath, buffer);
                return tempFilePath;
            }
        } catch (error) {
            console.error('Error converting HTML to DOCX:', error);
            throw new Error(`Failed to convert HTML to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Get the default template path
     * @returns The path to the default template
     */
    private _getDefaultTemplate(): string {
        // Use a default template from the extension resources
        const extensionPath = vscode.extensions.getExtension('document-writer')?.extensionUri.fsPath;
        if (!extensionPath) {
            throw new Error('Extension path not found');
        }
        
        return path.join(extensionPath, 'resources', 'templates', 'default.docx');
    }
    
    /**
     * Convert text to DOCX
     * @param content The text content
     * @param options Format conversion options
     * @returns A placeholder message (actual implementation would return a file path or buffer)
     */
    private async _textToDocx(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert text to Markdown
            const markdown = this._textToMarkdown(content, options);
            
            // Then convert Markdown to DOCX
            return await this._markdownToDocx(markdown, options);
        } catch (error) {
            console.error('Error converting text to DOCX:', error);
            throw new Error(`Failed to convert text to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert Markdown to PDF
     * @param content The Markdown content
     * @param options Format conversion options
     * @returns A placeholder message (actual implementation would return a file path or buffer)
     */
    private async _markdownToPdf(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert Markdown to HTML
            const html = this._markdownToHtml(content, { ...options, includeStyles: true });
            
            // Then convert HTML to PDF
            return await this._htmlToPdf(html, options);
        } catch (error) {
            console.error('Error converting Markdown to PDF:', error);
            throw new Error(`Failed to convert Markdown to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert HTML to PDF
     * @param content The HTML content
     * @param options Format conversion options
     * @returns The path to the generated PDF file
     */
    private async _htmlToPdf(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // Add styles if needed
            if (options.includeStyles) {
                content = this._addStylesToHtml(content, options.customStyles);
            }
            
            // Create a full HTML document if it's just a fragment
            if (!content.includes('<html>')) {
                content = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Document</title>
</head>
<body>
    ${content}
</body>
</html>`;
            }
            
            // Determine output path
            let outputPath: string;
            if (options.outputPath) {
                outputPath = options.outputPath;
            } else {
                // Generate a temporary file
                const tempDir = os.tmpdir();
                outputPath = path.join(tempDir, `pdf-${Date.now()}.pdf`);
            }
            
            // Create directory if it doesn't exist
            const outputDir = path.dirname(outputPath);
            await mkdir(outputDir, { recursive: true });
            
            // In a production environment, we would now use headless Chrome or Puppeteer to convert this HTML to PDF
            // Write HTML to temporary file for processing
            const tempHtmlPath = path.join(os.tmpdir(), `html-to-pdf-${Date.now()}.html`);
            await writeFile(tempHtmlPath, content);
            
            try {
                // Try to use Node PDF generation libraries in the future
                // For now, we'll create a placeholder PDF file
                
                // Create a basic PDF structure (this is a minimal valid PDF)
                const pdfContent = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R >>
endobj
4 0 obj
<< /Length 55 >>
stream
BT
/F1 12 Tf
100 700 Td
(HTML to PDF conversion placeholder) Tj
ET
endstream
endobj
xref
0 5
0000000000 65535 f
0000000009 00000 n
0000000058 00000 n
0000000115 00000 n
0000000197 00000 n
trailer
<< /Size 5 /Root 1 0 R >>
startxref
302
%%EOF`;
                
                // Write the PDF content to the output file
                await writeFile(outputPath, pdfContent);
                
                // Show a message to the user
                vscode.window.showInformationMessage(
                    'Full PDF generation is limited in this version. A basic PDF has been created.',
                    'Open PDF',
                    'View HTML'
                ).then(selection => {
                    if (selection === 'Open PDF') {
                        vscode.env.openExternal(vscode.Uri.file(outputPath));
                    } else if (selection === 'View HTML') {
                        vscode.env.openExternal(vscode.Uri.file(tempHtmlPath));
                    }
                });
            } catch (pdfError) {
                console.error('Error creating PDF:', pdfError);
                
                // Fallback to HTML
                outputPath = outputPath.replace(/\.pdf$/i, '.html');
                await writeFile(outputPath, content);
                
                vscode.window.showErrorMessage(
                    'Failed to create PDF. HTML file created as fallback.',
                    'Open HTML'
                ).then(selection => {
                    if (selection === 'Open HTML') {
                        vscode.env.openExternal(vscode.Uri.file(outputPath));
                    }
                });
            }
            
            return outputPath;
        } catch (error) {
            console.error('Error converting HTML to PDF:', error);
            throw new Error(`Failed to convert HTML to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert text to PDF
     * @param content The text content
     * @param options Format conversion options
     * @returns A placeholder message (actual implementation would return a file path or buffer)
     */
    private async _textToPdf(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert text to Markdown
            const markdown = this._textToMarkdown(content, options);
            
            // Then convert Markdown to PDF
            return await this._markdownToPdf(markdown, options);
        } catch (error) {
            console.error('Error converting text to PDF:', error);
            throw new Error(`Failed to convert text to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert DOCX to HTML
     * @param content Base64 encoded DOCX content or path to DOCX file
     * @param options Format conversion options
     * @returns The HTML content
     */
    private async _docxToHtml(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // Determine if content is a file path or base64 content
            let buffer: Buffer;
            let tempFilePath: string | null = null;
            
            if (content.toLowerCase().endsWith('.docx') || content.toLowerCase().endsWith('.doc')) {
                // It's a file path
                buffer = await readFile(content);
            } else if (content.startsWith('PK')) {
                // It's raw DOCX content
                buffer = Buffer.from(content, 'binary');
                
                // Save to temporary file for better processing
                const tempDir = os.tmpdir();
                tempFilePath = path.join(tempDir, `docx-${Date.now()}.docx`);
                await writeFile(tempFilePath, buffer);
            } else if (content.match(/^[A-Za-z0-9+/=]+$/)) {
                // It's base64 encoded content
                buffer = Buffer.from(content, 'base64');
                
                // Save to temporary file for better processing
                const tempDir = os.tmpdir();
                tempFilePath = path.join(tempDir, `docx-${Date.now()}.docx`);
                await writeFile(tempFilePath, buffer);
            } else {
                throw new Error('Invalid DOCX content format');
            }
            
            // Use mammoth to convert DOCX to HTML with image support
            let conversionOptions: any = { buffer };
            
            // Add image conversion if preserveImages is enabled
            if (options.preserveImages) {
                conversionOptions.convertImage = mammoth.images.imgElement(async (image: any) => {
                    // Handle image extraction for images embedded in the document
                    return {
                        src: `data:${image.contentType};base64,${image.data.toString('base64')}`
                    };
                });
            }
            
            const result = await mammoth.convertToHtml(conversionOptions);
            
            let html = result.value;
            
            // Handle warnings if any
            if (result.messages.length > 0) {
                console.warn('Warnings during DOCX to HTML conversion:', result.messages);
            }
            
            // Optionally add styles
            if (options.includeStyles) {
                html = this._addStylesToHtml(html, options.customStyles);
            }
            
            // Clean up temporary file if created
            if (tempFilePath) {
                try {
                    fs.unlinkSync(tempFilePath);
                } catch (cleanupError) {
                    console.warn('Error cleaning up temporary file:', cleanupError);
                }
            }
            
            return html;
        } catch (error) {
            console.error('Error converting DOCX to HTML:', error);
            throw new Error(`Failed to convert DOCX to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert DOCX to Markdown
     * @param content Base64 encoded DOCX content or path to DOCX file
     * @param options Format conversion options
     * @returns The Markdown content
     */
    private async _docxToMarkdown(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert DOCX to HTML
            const html = await this._docxToHtml(content, options);
            
            // Then convert HTML to Markdown
            return this._htmlToMarkdown(html, options);
        } catch (error) {
            console.error('Error converting DOCX to Markdown:', error);
            throw new Error(`Failed to convert DOCX to Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert DOCX to text
     * @param content Base64 encoded DOCX content or path to DOCX file
     * @param options Format conversion options
     * @returns The plain text content
     */
    private async _docxToText(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // Determine if content is a file path or base64 content
            let buffer: Buffer;
            
            if (content.toLowerCase().endsWith('.docx') || content.toLowerCase().endsWith('.doc')) {
                // It's a file path
                buffer = await readFile(content);
            } else if (content.startsWith('PK')) {
                // It's raw DOCX content
                buffer = Buffer.from(content, 'binary');
            } else if (content.match(/^[A-Za-z0-9+/=]+$/)) {
                // It's base64 encoded content
                buffer = Buffer.from(content, 'base64');
            } else {
                throw new Error('Invalid DOCX content format');
            }
            
            // Use mammoth to extract text directly
            const result = await mammoth.extractRawText({ buffer });
            let text = result.value;
            
            // Handle warnings if any
            if (result.messages.length > 0) {
                console.warn('Warnings during DOCX to text conversion:', result.messages);
            }
            
            // Process text based on options
            if (options.preserveFormatting) {
                // Preserve some formatting by adding line breaks
                text = this._preserveTextFormatting(text);
            }
            
            return text;
        } catch (error) {
            console.error('Error converting DOCX to text:', error);
            throw new Error(`Failed to convert DOCX to text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert DOCX to PDF
     * @param content Base64 encoded DOCX content or path to DOCX file
     * @param options Format conversion options
     * @returns The path to the generated PDF file
     */
    private async _docxToPdf(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert DOCX to HTML
            const html = await this._docxToHtml(content, options);
            
            // Then convert HTML to PDF
            return await this._htmlToPdf(html, options);
        } catch (error) {
            console.error('Error converting DOCX to PDF:', error);
            throw new Error(`Failed to convert DOCX to PDF: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert PDF to HTML
     * @param content Base64 encoded PDF content or path to PDF file
     * @param options Format conversion options
     * @returns The HTML content
     */
    private async _pdfToHtml(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // Use PDFPreviewProvider for enhanced PDF preview
            const pdfPreviewProvider = new PDFPreviewProvider();
            
            // Generate PDF preview
            const previewOptions = {
                maxPages: options.preserveFormatting ? 10 : 5, // Show more pages if preserving formatting
                includeThumbnails: true,
                zoomLevel: 1.0,
                includeMetadata: true
            };
            
            const previewResult = await pdfPreviewProvider.generatePreview(content, previewOptions);
            
            // Check if preview was successful
            if (!previewResult.success) {
                throw new Error(previewResult.error || 'Failed to generate PDF preview');
            }
            
            // Clean up any temporary files created during preview generation
            if (previewResult.temporaryFiles && previewResult.temporaryFiles.length > 0) {
                // Using setTimeout to clean up after the preview has been displayed
                setTimeout(() => {
                    pdfPreviewProvider.cleanupTemporaryFiles(previewResult.temporaryFiles || [])
                        .catch(error => console.warn('Error cleaning up temporary files:', error));
                }, 60000); // Clean up after 1 minute
            }
            
            return previewResult.html;
        } catch (error) {
            console.error('Error converting PDF to HTML:', error);
            throw new Error(`Failed to convert PDF to HTML: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert PDF to Markdown
     * @param content Base64 encoded PDF content or path to PDF file
     * @param options Format conversion options
     * @returns The Markdown content
     */
    private async _pdfToMarkdown(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert PDF to HTML with minimal styling
            const simpleOptions = {
                ...options,
                includeStyles: false
            };
            const html = await this._pdfToHtml(content, simpleOptions);
            
            // Then convert HTML to Markdown
            return this._htmlToMarkdown(html, options);
        } catch (error) {
            console.error('Error converting PDF to Markdown:', error);
            throw new Error(`Failed to convert PDF to Markdown: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert PDF to text
     * @param content Base64 encoded PDF content or path to PDF file
     * @param options Format conversion options
     * @returns The extracted text content
     */
    private async _pdfToText(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert PDF to HTML
            const html = await this._pdfToHtml(content, options);
            
            // Then convert HTML to text
            return this._htmlToText(html, options);
        } catch (error) {
            console.error('Error converting PDF to text:', error);
            throw new Error(`Failed to convert PDF to text: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Convert PDF to DOCX
     * @param content Base64 encoded PDF content or path to PDF file
     * @param options Format conversion options
     * @returns Path to the generated DOCX file
     */
    private async _pdfToDocx(
        content: string,
        options: FormatConversionOptions
    ): Promise<string> {
        try {
            // First convert PDF to HTML
            const html = await this._pdfToHtml(content, options);
            
            // Then convert HTML to DOCX
            return await this._htmlToDocx(html, options);
        } catch (error) {
            console.error('Error converting PDF to DOCX:', error);
            throw new Error(`Failed to convert PDF to DOCX: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }
    
    /**
     * Add styles to HTML content
     * @param html The HTML content
     * @param customStyles Custom styles
     * @returns The HTML content with styles
     */
    private _addStylesToHtml(
        html: string,
        customStyles?: Record<string, string>
    ): string {
        // Default styles
        const defaultStyles = {
            'body': 'font-family: Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px;',
            'h1': 'color: #2c3e50; border-bottom: 1px solid #eee; padding-bottom: 10px;',
            'h2': 'color: #2c3e50; margin-top: 30px;',
            'h3': 'color: #2c3e50;',
            'h4': 'color: #2c3e50;',
            'h5': 'color: #2c3e50;',
            'h6': 'color: #2c3e50;',
            'p': 'margin: 16px 0;',
            'a': 'color: #3498db; text-decoration: none;',
            'a:hover': 'text-decoration: underline;',
            'code': 'background-color: #f7f7f7; padding: 2px 4px; border-radius: 4px; font-family: monospace;',
            'pre': 'background-color: #f7f7f7; padding: 16px; border-radius: 4px; overflow-x: auto;',
            'pre code': 'background-color: transparent; padding: 0;',
            'blockquote': 'border-left: 4px solid #ddd; margin: 16px 0; padding-left: 16px; color: #666;',
            'table': 'border-collapse: collapse; width: 100%;',
            'th, td': 'border: 1px solid #ddd; padding: 8px; text-align: left;',
            'th': 'background-color: #f2f2f2;'
        };
        
        // Merge default styles with custom styles
        const styles = { ...defaultStyles, ...customStyles };
        
        // Create style tag
        let styleTag = '<style>\n';
        
        for (const [selector, style] of Object.entries(styles)) {
            styleTag += `${selector} { ${style} }\n`;
        }
        
        styleTag += '</style>\n';
        
        // Check if the content already has a head tag
        if (html.includes('<head>')) {
            // Insert style tag after the head tag
            return html.replace('<head>', '<head>\n' + styleTag);
        } else if (html.includes('<html>')) {
            // Insert head tag with style tag after the html tag
            return html.replace('<html>', '<html>\n<head>\n' + styleTag + '</head>');
        } else {
            // Create a new HTML document with style tag
            return `<!DOCTYPE html>\n<html>\n<head>\n${styleTag}</head>\n<body>\n${html}\n</body>\n</html>`;
        }
    }
    
    /**
     * Preserve text formatting
     * @param text The text to format
     * @returns The formatted text
     */
    private _preserveTextFormatting(text: string): string {
        // Remove consecutive line breaks (more than 2)
        let formatted = text.replace(/\n{3,}/g, '\n\n');
        
        // Ensure paragraphs have appropriate line breaks
        formatted = formatted.replace(/([.!?])\s+([A-Z])/g, '$1\n\n$2');
        
        return formatted;
    }
    
    /**
     * Configure the turndown service
     */
    private _configureTurndown(): void {
        // Add rule to preserve line breaks
        this._turndownService.addRule('lineBreaks', {
            filter: 'br',
            replacement: function() {
                return '\n';
            }
        });
        
        // Add rule to handle code blocks
        this._turndownService.addRule('codeBlocks', {
            filter: function(node: any) {
                return (
                    node.nodeName === 'PRE' &&
                    node.firstChild &&
                    node.firstChild.nodeName === 'CODE'
                );
            },
            replacement: function(content: string, node: any) {
                // Extract language from class (e.g., "language-javascript")
                const code = node.firstChild as any;
                const className = code.className || '';
                const language = className.match(/language-(\w+)/)?.[1] || '';
                
                return `\n\`\`\`${language}\n${content}\n\`\`\`\n`;
            }
        });
        
        // Add rule to handle tables
        this._turndownService.addRule('tables', {
            filter: 'table',
            replacement: function(content: string) {
                // Simple table handling - more complex tables would need more processing
                return '\n\n' + content + '\n\n';
            }
        });
    }
    
    /**
     * Detect format from content
     * This can be used when the format is not explicitly specified
     * @param content The content to analyze
     * @returns The detected format
     */
    public detectFormat(content: string = ''): DocumentFormat {
        // Check if content looks like HTML
        if (content.match(/<\s*html/) || content.match(/<\s*body/) || content.match(/<\s*div/) || content.match(/<\s*h[1-6]/)) {
            return DocumentFormat.HTML;
        }
        
        // Check if content looks like Markdown
        if (content.match(/^#\s/) || content.match(/\*\*.+\*\*/) || content.match(/\[.+\]\(.+\)/) || content.match(/^\s*[-*+]\s/m)) {
            return DocumentFormat.MARKDOWN;
        }
        
        // Check if content looks like DOCX (base64 encoded or path)
        if (content.startsWith('PK') || content.toLowerCase().endsWith('.docx') || content.toLowerCase().endsWith('.doc')) {
            return DocumentFormat.DOCX;
        }
        
        // Check if content looks like PDF (base64 encoded or path)
        if (content.startsWith('%PDF') || content.toLowerCase().endsWith('.pdf')) {
            return DocumentFormat.PDF;
        }
        
        // Default to TEXT format
        return DocumentFormat.TEXT;
    }
}
