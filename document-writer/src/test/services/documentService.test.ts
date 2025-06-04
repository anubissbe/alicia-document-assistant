import * as fs from 'fs';
import * as path from 'path';
import { DocumentService } from '../../services/documentService';
import { DocumentTemplate } from '../../models/documentTemplate';
import { DocumentFormat } from '../../models/documentFormat';
import * as vscode from '../vscode-mock';

// Mock dependencies
jest.mock('fs', () => ({
    promises: {
        mkdir: jest.fn().mockResolvedValue(undefined)
    },
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    existsSync: jest.fn()
}));

jest.mock('pizzip', () => {
    return jest.fn().mockImplementation(() => ({
        generate: jest.fn().mockReturnValue(Buffer.from('test'))
    }));
});

jest.mock('docxtemplater', () => {
    return jest.fn().mockImplementation(() => ({
        setData: jest.fn(),
        render: jest.fn(),
        getZip: jest.fn().mockReturnValue({
            generate: jest.fn().mockReturnValue(Buffer.from('test'))
        })
    }));
});

describe('DocumentService', () => {
    let documentService: DocumentService;
    const mockContext = vscode.ExtensionContext as any;
    
    beforeEach(() => {
        jest.clearAllMocks();
        documentService = new DocumentService(mockContext);
    });
    
    describe('generateDocument', () => {
        const mockTemplate: DocumentTemplate = {
            id: 'test-template',
            name: 'Test Template',
            description: 'A test template',
            format: DocumentFormat.DOCX,
            templatePath: '/path/to/template.docx',
            metadata: {
                author: 'Test Author',
                version: '1.0',
                tags: ['test'],
                category: 'Test'
            },
            sections: [],
            createdAt: new Date(),
            updatedAt: new Date()
        };
        
        const mockData = {
            title: 'Test Document',
            author: 'Test Author',
            content: 'Test Content'
        };
        
        const outputPath = '/path/to/output';
        
        it('should call the correct generator based on format', async () => {
            // Mock implementation
            (fs.readFileSync as jest.Mock).mockReturnValueOnce('template content');
            
            // Test DOCX generation
            await documentService.generateDocument(mockTemplate, mockData, outputPath);
            
            // Verify the correct methods were called
            expect(fs.readFileSync).toHaveBeenCalledWith(mockTemplate.templatePath, 'binary');
            expect(fs.writeFileSync).toHaveBeenCalled();
        });
        
        it('should throw an error for unsupported formats', async () => {
            const unsupportedTemplate = {
                ...mockTemplate,
                format: 'UNSUPPORTED' as DocumentFormat
            };
            
            await expect(
                documentService.generateDocument(unsupportedTemplate, mockData, outputPath)
            ).rejects.toThrow('Unsupported document format');
        });
        
        it('should throw an error when HTML generation is not implemented', async () => {
            const htmlTemplate = {
                ...mockTemplate,
                format: DocumentFormat.HTML
            };
            
            await expect(
                documentService.generateDocument(htmlTemplate, mockData, outputPath)
            ).rejects.toThrow('HTML document generation not yet implemented');
        });
        
        it('should throw an error when PDF generation is not implemented', async () => {
            const pdfTemplate = {
                ...mockTemplate,
                format: DocumentFormat.PDF
            };
            
            await expect(
                documentService.generateDocument(pdfTemplate, mockData, outputPath)
            ).rejects.toThrow('PDF document generation not yet implemented');
        });
    });
    
    describe('sanitizeFilename', () => {
        it('should replace invalid characters in filenames', async () => {
            const template: DocumentTemplate = {
                id: 'test-template',
                name: 'Test: Template? With* Invalid/Characters',
                description: 'A test template',
                format: DocumentFormat.MARKDOWN,
                templatePath: '/path/to/template.md',
                metadata: {
                    author: 'Test Author',
                    version: '1.0',
                    tags: ['test'],
                    category: 'Test'
                },
                sections: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            (fs.readFileSync as jest.Mock).mockReturnValueOnce('# {{title}}\n\n{{content}}');
            
            const result = await documentService.generateDocument(
                template,
                { title: 'Test', content: 'Content' },
                '/path/to/output'
            );
            
            // Check that the filename was properly sanitized
            expect(result).toContain('Test_ Template_ With_ Invalid_Characters_');
        });
    });
    
    describe('markdown generation', () => {
        it('should correctly replace placeholders in markdown templates', async () => {
            const template: DocumentTemplate = {
                id: 'md-template',
                name: 'Markdown Template',
                description: 'A markdown template',
                format: DocumentFormat.MARKDOWN,
                templatePath: '/path/to/template.md',
                metadata: {
                    author: 'Test Author',
                    version: '1.0',
                    tags: ['markdown'],
                    category: 'Documentation'
                },
                sections: [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            
            const templateContent = '# {{title}}\n\nAuthor: {{author}}\n\n{{content}}';
            const data = {
                title: 'Test Document',
                author: 'Test Author',
                content: 'This is the content.'
            };
            
            (fs.readFileSync as jest.Mock).mockReturnValueOnce(templateContent);
            
            await documentService.generateDocument(template, data, '/path/to/output');
            
            // Check that the content was correctly generated
            const expectedContent = '# Test Document\n\nAuthor: Test Author\n\nThis is the content.';
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                expect.any(String),
                expectedContent
            );
        });
    });
});
