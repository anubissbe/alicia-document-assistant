import * as showdown from 'showdown';

/**
 * Utility class for converting between different document formats
 */
export class FormatConverter {
    private markdownConverter: showdown.Converter;

    constructor() {
        // Initialize Showdown converter with options
        this.markdownConverter = new showdown.Converter({
            tables: true,
            tasklists: true,
            strikethrough: true,
            ghCodeBlocks: true,
            smoothLivePreview: true,
            simpleLineBreaks: true,
            requireSpaceBeforeHeadingText: true,
            ghCompatibleHeaderId: true,
            openLinksInNewWindow: true
        });
    }

    /**
     * Convert Markdown content to HTML
     * @param markdown Markdown content
     * @returns HTML content
     */
    public markdownToHtml(markdown: string): string {
        return this.markdownConverter.makeHtml(markdown);
    }

    /**
     * Convert HTML content to Markdown
     * @param html HTML content
     * @returns Markdown content
     */
    public htmlToMarkdown(html: string): string {
        // Create a temporary reverse converter
        const reverseConverter = new showdown.Converter({
            tables: true,
            tasklists: true,
            strikethrough: true,
            ghCodeBlocks: true
        });
        
        // Convert HTML to Markdown
        return reverseConverter.makeMarkdown(html);
    }

    /**
     * Convert document object to HTML
     * @param document Document object
     * @param options HTML formatting options
     * @returns HTML content
     */
    public documentToHtml(document: any, options?: HtmlExportOptions): string {
        const title = document.title || 'Untitled Document';
        const author = document.author || 'Unknown Author';
        const cssOptions = options?.css || {};
        const includeCss = options?.includeCss !== false;
        
        let htmlContent = `
        <!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
            ${includeCss ? this.generateCss(cssOptions) : ''}
        </head>
        <body>
            <h1>${title}</h1>
            <div class="author">By ${author}</div>
        `;
        
        // Add sections
        if (document.sections && document.sections.length > 0) {
            document.sections.forEach((section: any) => {
                htmlContent += `
                <div class="section">
                    <h2 class="section-title">${section.title || 'Untitled Section'}</h2>
                    <div class="section-content">${section.content || ''}</div>
                </div>
                `;
            });
        }
        
        // Add charts
        if (document.charts && document.charts.length > 0) {
            document.charts.forEach((chart: any) => {
                // If chart has a previewUrl or imageUrl, include it
                if (chart.previewUrl || chart.imageUrl) {
                    htmlContent += `
                    <div class="chart-container">
                        <h3 class="chart-title">${chart.title || 'Chart'}</h3>
                        <img src="${chart.previewUrl || chart.imageUrl}" alt="${chart.title || 'Chart'}">
                    </div>
                    `;
                }
            });
        }
        
        // Add tables
        if (document.tables && document.tables.length > 0) {
            document.tables.forEach((table: any) => {
                htmlContent += `
                <div class="table-container">
                    <h3 class="table-title">${table.title || 'Table'}</h3>
                    <table>
                        <thead>
                            <tr>
                `;
                
                // Table headers
                if (table.headers && table.headers.length > 0) {
                    table.headers.forEach((header: string) => {
                        htmlContent += `<th>${header}</th>`;
                    });
                }
                
                htmlContent += `
                            </tr>
                        </thead>
                        <tbody>
                `;
                
                // Table data
                if (table.data && table.data.length > 0) {
                    table.data.forEach((row: any[]) => {
                        htmlContent += '<tr>';
                        row.forEach((cell) => {
                            htmlContent += `<td>${cell}</td>`;
                        });
                        htmlContent += '</tr>';
                    });
                }
                
                htmlContent += `
                        </tbody>
                    </table>
                </div>
                `;
            });
        }
        
        // Close HTML
        htmlContent += `
        </body>
        </html>
        `;
        
        return htmlContent;
    }

    /**
     * Convert document object to Markdown
     * @param document Document object
     * @param options Markdown formatting options
     * @returns Markdown content
     */
    public documentToMarkdown(document: any, options?: MarkdownExportOptions): string {
        const title = document.title || 'Untitled Document';
        const author = document.author || 'Unknown Author';
        const headerLevel = options?.headerLevel || 1;
        const includeMetadata = options?.includeMetadata !== false;
        
        let markdownContent = '';
        
        // Add title with appropriate header level
        const titleMarker = '#'.repeat(headerLevel);
        markdownContent += `${titleMarker} ${title}\n\n`;
        
        // Add author and metadata
        if (includeMetadata) {
            markdownContent += `By ${author}\n\n`;
            
            // Add optional metadata if available
            if (document.metadata) {
                markdownContent += `**Date**: ${document.metadata.date || 'N/A'}\n`;
                markdownContent += `**Version**: ${document.metadata.version || 'N/A'}\n\n`;
            }
        }
        
        // Add sections with appropriate header levels
        if (document.sections && document.sections.length > 0) {
            document.sections.forEach((section: any) => {
                const sectionHeaderMarker = '#'.repeat(headerLevel + 1);
                markdownContent += `${sectionHeaderMarker} ${section.title || 'Untitled Section'}\n\n`;
                markdownContent += `${section.content || ''}\n\n`;
            });
        }
        
        // Add charts (as references since we can't include actual charts in Markdown)
        if (document.charts && document.charts.length > 0) {
            const chartsHeaderMarker = '#'.repeat(headerLevel + 1);
            markdownContent += `${chartsHeaderMarker} Charts\n\n`;
            
            document.charts.forEach((chart: any, index: number) => {
                const chartHeaderMarker = '#'.repeat(headerLevel + 2);
                markdownContent += `${chartHeaderMarker} ${chart.title || `Chart ${index + 1}`}\n\n`;
                
                // If image URL is available, include it as an image link
                if (chart.imageUrl) {
                    markdownContent += `![${chart.title || `Chart ${index + 1}`}](${chart.imageUrl})\n\n`;
                } else {
                    markdownContent += `[Chart image not displayed in Markdown]\n\n`;
                }
            });
        }
        
        // Add tables
        if (document.tables && document.tables.length > 0) {
            document.tables.forEach((table: any) => {
                const tableHeaderMarker = '#'.repeat(headerLevel + 2);
                markdownContent += `${tableHeaderMarker} ${table.title || 'Table'}\n\n`;
                
                // Table headers
                if (table.headers && table.headers.length > 0) {
                    markdownContent += '| ' + table.headers.join(' | ') + ' |\n';
                    markdownContent += '|' + table.headers.map(() => '---').join('|') + '|\n';
                    
                    // Table data
                    if (table.data && table.data.length > 0) {
                        table.data.forEach((row: any[]) => {
                            markdownContent += '| ' + row.join(' | ') + ' |\n';
                        });
                    }
                    
                    markdownContent += '\n';
                }
            });
        }
        
        return markdownContent;
    }

    /**
     * Generate CSS for HTML export
     * @param options CSS styling options
     * @returns CSS string wrapped in style tags
     */
    private generateCss(options: any = {}): string {
        const fontFamily = options.fontFamily || 'Arial, sans-serif';
        const textColor = options.textColor || '#333';
        const headerColor = options.headerColor || '#444';
        const linkColor = options.linkColor || '#0366d6';
        const backgroundColor = options.backgroundColor || '#fff';
        
        return `
        <style>
            body {
                font-family: ${fontFamily};
                line-height: 1.6;
                color: ${textColor};
                background-color: ${backgroundColor};
                max-width: 800px;
                margin: 0 auto;
                padding: 20px;
            }
            h1, h2, h3, h4, h5, h6 {
                color: ${headerColor};
                margin-top: 1.5em;
                margin-bottom: 0.5em;
            }
            h1 {
                font-size: 2em;
                border-bottom: 1px solid #eee;
                padding-bottom: 0.3em;
            }
            h2 {
                font-size: 1.5em;
            }
            a {
                color: ${linkColor};
                text-decoration: none;
            }
            a:hover {
                text-decoration: underline;
            }
            .author {
                color: #666;
                font-style: italic;
                margin-bottom: 2em;
            }
            .section {
                margin-bottom: 2em;
            }
            .section-title {
                font-size: 1.2em;
                font-weight: bold;
                margin-bottom: 0.5em;
            }
            .section-content {
                white-space: pre-wrap;
            }
            table {
                border-collapse: collapse;
                width: 100%;
                margin: 1em 0;
            }
            th, td {
                border: 1px solid #ddd;
                padding: 8px;
                text-align: left;
            }
            th {
                background-color: #f2f2f2;
            }
            .chart-container {
                margin: 1em 0;
                max-width: 100%;
            }
            .chart-title {
                font-weight: bold;
                margin-bottom: 0.5em;
            }
            img {
                max-width: 100%;
                height: auto;
            }
            .page-break {
                page-break-after: always;
            }
            code {
                font-family: 'Courier New', Courier, monospace;
                background-color: #f6f8fa;
                padding: 0.2em 0.4em;
                border-radius: 3px;
            }
            pre {
                background-color: #f6f8fa;
                padding: 16px;
                border-radius: 3px;
                overflow: auto;
            }
            blockquote {
                border-left: 4px solid #ddd;
                padding-left: 16px;
                margin-left: 0;
                color: #666;
            }
        </style>
        `;
    }
}

/**
 * Options for HTML export
 */
export interface HtmlExportOptions {
    includeCss?: boolean;
    css?: {
        fontFamily?: string;
        textColor?: string;
        headerColor?: string;
        linkColor?: string;
        backgroundColor?: string;
    };
}

/**
 * Options for Markdown export
 */
export interface MarkdownExportOptions {
    headerLevel?: number;
    includeMetadata?: boolean;
}

/**
 * Options for PDF export
 */
export interface PdfExportOptions {
    format?: 'A4' | 'Letter' | 'Legal' | 'Tabloid';
    landscape?: boolean;
    margins?: {
        top?: string;
        right?: string;
        bottom?: string;
        left?: string;
    };
    printBackground?: boolean;
    scale?: number;
    headerTemplate?: string;
    footerTemplate?: string;
}
