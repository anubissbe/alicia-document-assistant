import * as vscode from 'vscode';
import * as path from 'path';
import { BaseMCPTool, MCPToolResponse } from '../mcpTool';
import { DocumentService } from '../../services/documentService';
import { TemplateEngine, ValidationResult } from '../../core/templateEngine';
import { DocumentTemplate } from '../documentTemplate';
import { DocumentFormat } from '../documentFormat';

/**
 * Tool to create documents from templates
 */
export class CreateDocumentTool extends BaseMCPTool {
    /**
     * Constructor
     * @param documentService Document service instance
     * @param templateEngine Template engine instance
     */
    constructor(
        private documentService: DocumentService,
        private templateEngine: TemplateEngine
    ) {
        super(
            'create_document',
            'Creates a document using a template and provided data',
            {
                type: 'object',
                properties: {
                    templateType: {
                        type: 'string',
                        description: 'The type of template to use (e.g., report, letter, proposal)'
                    },
                    outputPath: {
                        type: 'string',
                        description: 'The path where the document should be saved'
                    },
                    data: {
                        type: 'object',
                        description: 'The data to use for template variables',
                        additionalProperties: true
                    },
                    charts: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                path: {
                                    type: 'string',
                                    description: 'Path to the chart image'
                                },
                                placeholder: {
                                    type: 'string',
                                    description: 'Placeholder name in the template'
                                },
                                description: {
                                    type: 'string',
                                    description: 'Optional description for the chart'
                                }
                            },
                            required: ['path', 'placeholder'],
                            additionalProperties: false
                        },
                        description: 'Optional charts to include in the document'
                    }
                },
                required: ['templateType', 'outputPath', 'data'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#'
            }
        );
    }

    /**
     * Execute the document creation
     * @param args Arguments for the tool
     * @returns Promise that resolves to the document creation results
     */
    async execute(args: {
        templateType: string;
        outputPath: string;
        data: Record<string, any>;
        charts?: Array<{
            path: string;
            placeholder: string;
            description?: string;
        }>;
    }): Promise<MCPToolResponse> {
        try {
            // Validate the template data
            const validationResult = await this.templateEngine.validateTemplateData(
                args.templateType,
                args.data
            );

            if (!validationResult.valid) {
                return {
                    success: false,
                    errors: validationResult.errors,
                    message: 'Template data validation failed'
                };
            }

            // Get the template for the specified type
            const templatePath = await this.templateEngine.getTemplateForType(args.templateType);
            if (!templatePath) {
                return {
                    success: false,
                    errors: [`Template not found for type: ${args.templateType}`],
                    message: 'Template not found'
                };
            }

            // Prepare the data with charts if provided
            const documentData = { ...args.data };
            
            if (args.charts && args.charts.length > 0) {
                for (const chart of args.charts) {
                    // For each chart, add an entry in the data object with the placeholder name
                    documentData[chart.placeholder] = {
                        type: 'image',
                        path: chart.path,
                        description: chart.description || ''
                    };
                }
            }

            // Create a document template object
            const template: DocumentTemplate = {
                id: args.templateType,
                name: args.templateType,
                description: `Template for ${args.templateType}`,
                templatePath: templatePath,
                format: this.getFormatFromPath(templatePath),
                metadata: {
                    author: 'Document Writer',
                    version: '1.0',
                    tags: [args.templateType],
                    category: 'generated'
                },
                sections: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };

            // Generate the document
            const outputFilePath = await this.documentService.generateDocument(
                template,
                documentData,
                args.outputPath
            );

            // Return the result
            return {
                success: true,
                outputPath: outputFilePath,
                templateType: args.templateType,
                message: 'Document created successfully'
            };
        } catch (error) {
            console.error('Error creating document:', error);
            const errorMessage = error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to create document: ${errorMessage}`);
        }
    }

    /**
     * Determines document format from file path extension
     * @param filePath Path to the template file
     * @returns The document format
     */
    private getFormatFromPath(filePath: string): DocumentFormat {
        const extension = path.extname(filePath).toLowerCase().replace('.', '');
        
        switch (extension) {
            case 'docx':
                return DocumentFormat.DOCX;
            case 'html':
            case 'htm':
                return DocumentFormat.HTML;
            case 'md':
                return DocumentFormat.MARKDOWN;
            case 'pdf':
                return DocumentFormat.PDF;
            default:
                return DocumentFormat.DOCX; // Default to DOCX if unknown
        }
    }
}
