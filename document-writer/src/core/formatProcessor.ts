import { DocumentFormat } from '../models/documentFormat';
import * as docx from 'docx';

export interface FormatOptions {
    indentation?: number;
    lineSpacing?: number;
    fontFamily?: string;
    fontSize?: number;
    margins?: {
        top: number;
        right: number;
        bottom: number;
        left: number;
    };
    pageSize?: 'A4' | 'Letter' | 'Legal';
    orientation?: 'portrait' | 'landscape';
}

export interface FormattedDocument {
    content: string;
    metadata: {
        format: string;
        timestamp: string;
        options: FormatOptions;
    };
}

export class FormatProcessor {
    private readonly defaultOptions: FormatOptions = {
        indentation: 4,
        lineSpacing: 1.5,
        fontFamily: 'Arial',
        fontSize: 12,
        margins: {
            top: 25.4,    // 1 inch in mm
            right: 25.4,
            bottom: 25.4,
            left: 25.4
        },
        pageSize: 'A4',
        orientation: 'portrait'
    };

    async formatDocument(content: string, format: string, options?: FormatOptions): Promise<FormattedDocument> {
        // Merge provided options with defaults
        const finalOptions = { ...this.defaultOptions, ...options };

        // Validate format and options
        this.validateFormat(format);
        this.validateOptions(finalOptions);

        // Process content based on target format
        let processedContent: string;
        switch (format.toLowerCase()) {
            case 'markdown':
                processedContent = await this.formatMarkdown(content, finalOptions);
                break;
            case 'html':
                processedContent = await this.formatHTML(content, finalOptions);
                break;
            case 'plain':
                processedContent = await this.formatPlainText(content, finalOptions);
                break;
            case 'latex':
                processedContent = await this.formatLaTeX(content, finalOptions);
                break;
            case 'docx':
                processedContent = await this.formatDOCX(content, finalOptions);
                break;
            default:
                throw new Error(`Unsupported format: ${format}`);
        }

        return {
            content: processedContent,
            metadata: {
                format,
                timestamp: new Date().toISOString(),
                options: finalOptions
            }
        };
    }

    private validateFormat(format: string): void {
        const supportedFormats = ['markdown', 'html', 'plain', 'latex', 'docx'];
        if (!supportedFormats.includes(format.toLowerCase())) {
            throw new Error(`Unsupported format: ${format}. Supported formats are: ${supportedFormats.join(', ')}`);
        }
    }

    private validateOptions(options: FormatOptions): void {
        if (options.indentation && (options.indentation < 0 || options.indentation > 8)) {
            throw new Error('Indentation must be between 0 and 8 spaces');
        }

        if (options.lineSpacing && (options.lineSpacing < 1 || options.lineSpacing > 3)) {
            throw new Error('Line spacing must be between 1 and 3');
        }

        if (options.fontSize && (options.fontSize < 8 || options.fontSize > 72)) {
            throw new Error('Font size must be between 8 and 72');
        }

        if (options.margins) {
            const { top, right, bottom, left } = options.margins;
            if ([top, right, bottom, left].some(margin => margin < 0)) {
                throw new Error('Margins cannot be negative');
            }
        }
    }

    private async formatMarkdown(content: string, options: FormatOptions): Promise<string> {
        // Apply markdown-specific formatting
        let formatted = content;

        // Ensure consistent line endings
        formatted = formatted.replace(/\r\n|\r/g, '\n');

        // Add consistent heading spacing
        formatted = formatted.replace(/^(#{1,6})\s*(.+)$/gm, '$1 $2');

        // Normalize list indentation
        formatted = formatted.replace(/^(\s*[-*+])\s+/gm, `$1 `);

        // Ensure consistent blockquote formatting
        formatted = formatted.replace(/^(\s*>)\s+/gm, '$1 ');

        // Add line breaks between sections
        formatted = formatted.replace(/\n{3,}/g, '\n\n');

        return formatted;
    }

    private async formatHTML(content: string, options: FormatOptions): Promise<string> {
        // Apply HTML-specific formatting
        let formatted = content;

        // Add basic HTML structure if not present
        if (!formatted.includes('<!DOCTYPE html>')) {
            formatted = `<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <style>
        body {
            font-family: ${options.fontFamily};
            font-size: ${options.fontSize}px;
            line-height: ${options.lineSpacing};
            margin: ${options.margins?.top}mm ${options.margins?.right}mm ${options.margins?.bottom}mm ${options.margins?.left}mm;
        }
    </style>
</head>
<body>
${formatted}
</body>
</html>`;
        }

        // Normalize indentation
        formatted = this.normalizeHTMLIndentation(formatted, options.indentation || 4);

        return formatted;
    }

    private async formatPlainText(content: string, options: FormatOptions): Promise<string> {
        // Apply plain text formatting
        let formatted = content;

        // Normalize line endings
        formatted = formatted.replace(/\r\n|\r/g, '\n');

        // Apply indentation to paragraphs
        const indent = ' '.repeat(options.indentation || 0);
        formatted = formatted.replace(/^(?!$)/gm, indent);

        // Normalize spacing between paragraphs
        formatted = formatted.replace(/\n{3,}/g, '\n\n');

        return formatted;
    }

    private async formatLaTeX(content: string, options: FormatOptions): Promise<string> {
        // Apply LaTeX-specific formatting
        let formatted = content;

        // Add document class if not present
        if (!formatted.includes('\\documentclass')) {
            formatted = `\\documentclass[${options.fontSize}pt]{article}

\\usepackage[${options.orientation}]{geometry}
\\usepackage{setspace}
\\geometry{
    a4paper,
    top=${options.margins?.top}mm,
    right=${options.margins?.right}mm,
    bottom=${options.margins?.bottom}mm,
    left=${options.margins?.left}mm
}

\\begin{document}
${formatted}
\\end{document}`;
        }

        // Normalize spacing around environments
        formatted = formatted.replace(/\\begin{([^}]+)}/g, '\n\\begin{$1}\n');
        formatted = formatted.replace(/\\end{([^}]+)}/g, '\n\\end{$1}\n');

        // Normalize spacing around sections
        formatted = formatted.replace(/(\\section\*?{[^}]+})/g, '\n$1\n');

        return formatted;
    }

    private async formatDOCX(content: string, options: FormatOptions): Promise<string> {
        const doc = new docx.Document({
            sections: [{
                properties: {
                    page: {
                        size: {
                            width: options.pageSize === 'Letter' ? 12240 : 11906, // Letter: 8.5", A4: 8.3"
                            height: options.pageSize === 'Letter' ? 15840 : 16838, // Letter: 11", A4: 11.7"
                            orientation: options.orientation === 'landscape' ? 
                                docx.PageOrientation.LANDSCAPE : 
                                docx.PageOrientation.PORTRAIT,
                        },
                        margin: {
                            top: this.convertToTwip(options.margins?.top ?? this.defaultOptions.margins!.top),
                            right: this.convertToTwip(options.margins?.right ?? this.defaultOptions.margins!.right),
                            bottom: this.convertToTwip(options.margins?.bottom ?? this.defaultOptions.margins!.bottom),
                            left: this.convertToTwip(options.margins?.left ?? this.defaultOptions.margins!.left),
                        }
                    },
                },
                children: [
                    new docx.Paragraph({
                        text: content,
                        spacing: {
                            line: ((options.lineSpacing ?? this.defaultOptions.lineSpacing!) * 240),
                        },
                        indent: {
                            firstLine: ((options.indentation ?? this.defaultOptions.indentation!) * 240),
                        },
                    }),
                ],
            }],
            styles: {
                default: {
                    document: {
                        run: {
                            font: options.fontFamily ?? this.defaultOptions.fontFamily!,
                            size: (options.fontSize ?? this.defaultOptions.fontSize!) * 2,
                        },
                    },
                },
            },
        });

        const buffer = await docx.Packer.toBase64String(doc);
        return buffer;
    }

    private convertToTwip(millimeters: number): number {
        // Convert millimeters to twips (1 mm = 56.7 twips)
        return Math.round(millimeters * 56.7);
    }

    private normalizeHTMLIndentation(html: string, spaces: number): string {
        const lines = html.split('\n');
        let indent = 0;
        const indentStr = ' '.repeat(spaces);

        return lines.map(line => {
            // Decrease indent for closing tags
            if (line.match(/<\/[^>]+>/)) {
                indent = Math.max(0, indent - 1);
            }

            // Add current indentation
            const formatted = line.trim() ? indentStr.repeat(indent) + line.trim() : '';

            // Increase indent for opening tags
            if (line.match(/<[^/][^>]*>/) && !line.match(/<[^>]+\/>/)) {
                indent++;
            }

            return formatted;
        }).join('\n');
    }
}
