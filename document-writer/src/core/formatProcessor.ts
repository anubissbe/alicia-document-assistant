import * as vscode from 'vscode';
import * as marked from 'marked';
import * as TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

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
     * @returns The processed content
     */
    public processContent(
        content: string,
        sourceFormat: DocumentFormat,
        targetFormat: DocumentFormat,
        options: FormatConversionOptions = {}
    ): string {
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
                
            // For DOCX and PDF conversions, we would need to use specialized libraries
            // These would typically be implemented as part of a more complete solution
            
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
            const html = marked(content);
            
            // Optionally add styles
            if (options.includeStyles) {
                return this._addStylesToHtml(html, options.customStyles);
            }
            
            return html;
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
}
