import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentService, DocumentData, DocumentSection } from '../../services/documentService';
import { SecurityManager } from '../../utils/securityManager';
import { DocumentTemplate, DocumentFormat, PlaceholderType } from '../../models/documentTemplate';
import { TemplateManagerService } from '../../services/templateManagerService';

// Mock dependencies
jest.mock('vscode');
jest.mock('fs');
jest.mock('../../utils/securityManager');
jest.mock('../../services/templateManagerService');

describe('DocumentService Performance Tests', () => {
    let documentService: DocumentService;
    let mockContext: vscode.ExtensionContext;
    let mockSecurityManager: jest.Mocked<SecurityManager>;
    let mockTemplateManager: jest.Mocked<TemplateManagerService>;
    
    // Create a large template for performance testing
    function createLargeTemplate(sectionsCount: number): DocumentTemplate {
        const sections = [];
        
        for (let i = 0; i < sectionsCount; i++) {
            sections.push({
                id: `section_${i}`,
                name: `Section ${i}`,
                isRequired: i < 5, // First 5 sections are required
                description: `Description for section ${i}`,
                placeholders: [
                    { 
                        id: `placeholder_${i}_1`, 
                        key: `placeholder_${i}_1`,
                        description: 'Placeholder description',
                        type: PlaceholderType.TEXT,
                        isRequired: true
                    },
                    { 
                        id: `placeholder_${i}_2`, 
                        key: `placeholder_${i}_2`,
                        description: 'Placeholder description',
                        type: PlaceholderType.TEXT,
                        isRequired: false
                    }
                ],
                order: i
            });
        }
        
        return {
            id: 'large_template',
            name: 'Large Test Template',
            description: 'A large template for performance testing',
            format: DocumentFormat.DOCX,
            templatePath: '/path/to/large_template.docx',
            metadata: {
                author: 'Test Author',
                version: '1.0',
                tags: ['test', 'performance'],
                category: 'Performance Test'
            },
            sections,
            createdAt: new Date(),
            updatedAt: new Date()
        };
    }
    
    // Create a large document data object for performance testing
    function createLargeDocumentData(sectionsCount: number): DocumentData {
        const sections: DocumentSection[] = [];
        
        for (let i = 0; i < sectionsCount; i++) {
            sections.push({
                id: `section_${i}`,
                title: `Section ${i}`,
                content: `This is the content for section ${i}. `.repeat(100) // ~3KB of text per section
            });
        }
        
        return {
            title: 'Large Test Document',
            type: 'Performance Test',
            template: 'large_template',
            author: 'Test User',
            sections
        };
    }
    
    beforeEach(() => {
        // Create mock context
        mockContext = {
            subscriptions: [],
            extensionPath: '/test/extension/path',
            storagePath: '/test/storage/path',
            globalStoragePath: '/test/global/storage/path',
            logPath: '/test/log/path',
            extensionUri: { fsPath: '/test/extension/path' } as any,
            storageUri: { fsPath: '/test/storage/path' } as any,
            globalStorageUri: { fsPath: '/test/global/storage/path' } as any,
            logUri: { fsPath: '/test/log/path' } as any,
            globalState: {
                get: jest.fn(),
                update: jest.fn(),
                setKeysForSync: jest.fn(),
            } as any,
            workspaceState: {
                get: jest.fn(),
                update: jest.fn(),
            } as any,
            secrets: {
                store: jest.fn(),
                get: jest.fn(),
                delete: jest.fn(),
                onDidChange: jest.fn(),
            } as any,
            extensionMode: 1,
            environmentVariableCollection: {} as any,
            asAbsolutePath: jest.fn((relativePath) => path.join('/test/extension/path', relativePath)),
            extension: {} as any,
            languageModelAccessInformation: {} as any,
        };
        
        // Create SecurityManager mock
        mockSecurityManager = {
            normalizePath: jest.fn().mockImplementation((path) => path),
            validatePath: jest.fn().mockReturnValue(true),
            addAllowedPath: jest.fn(),
            validateInput: jest.fn().mockReturnValue(true),
            sanitizeContent: jest.fn().mockImplementation((content) => content),
            storeSecret: jest.fn(),
            getSecret: jest.fn(),
            deleteSecret: jest.fn(),
            generateHash: jest.fn(),
            verifyTemplateIntegrity: jest.fn().mockReturnValue(true),
            encryptData: jest.fn(),
            decryptData: jest.fn(),
        } as any;
        
        // Create TemplateManager mock
        mockTemplateManager = {
            getTemplates: jest.fn(),
            getTemplateById: jest.fn(),
            getAvailableTemplates: jest.fn(),
            addTemplate: jest.fn(),
            updateTemplate: jest.fn(),
            deleteTemplate: jest.fn(),
            importTemplate: jest.fn(),
        } as any;
        
        // Mock SecurityManager constructor
        (SecurityManager as jest.MockedClass<typeof SecurityManager>).mockImplementation(() => mockSecurityManager);
        
        // Mock TemplateManagerService constructor
        (TemplateManagerService as jest.MockedClass<typeof TemplateManagerService>).mockImplementation(() => mockTemplateManager);
        
        // Create DocumentService instance
        documentService = new DocumentService(mockContext, mockTemplateManager);
        
        // Mock fs methods
        (fs.mkdirSync as jest.Mock).mockReturnValue(undefined);
        (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
        (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
        (fs.readFileSync as jest.Mock).mockReturnValue('template content');
        (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
        
        // Mock generateFilename method
        jest.spyOn(documentService as any, '_generateFilename')
            .mockReturnValue('Test_Document_2025-06-03T10-30-00.000Z.json');
        
        // Mock unique ID generation
        jest.spyOn(documentService as any, '_generateUniqueId')
            .mockReturnValue('generated_id');
    });
    
    describe('Performance Benchmarking', () => {
        test('should handle creating documents from large templates efficiently', async () => {
            // Create a large template with 50 sections
            const largeTemplate = createLargeTemplate(50);
            
            // Mock template retrieval
            mockTemplateManager.getTemplateById.mockReturnValue(largeTemplate);
            
            // Measure performance
            const startTime = performance.now();
            
            const document = await documentService.createDocumentFromTemplate('large_template');
            
            const endTime = performance.now();
            
            // Verify document creation
            expect(document).toBeDefined();
            expect(document.sections.length).toBe(50);
            
            // Test should be fast (less than 100ms)
            expect(endTime - startTime).toBeLessThan(100);
        });
        
        test('should handle saving large documents efficiently', async () => {
            // Create a large document with 50 sections
            const largeDocument = createLargeDocumentData(50);
            
            // Measure performance
            const startTime = performance.now();
            
            const savedPath = await documentService.saveDocument(largeDocument);
            
            const endTime = performance.now();
            
            // Verify document was saved
            expect(savedPath).toBeDefined();
            
            // Test should be fast (less than 100ms)
            expect(endTime - startTime).toBeLessThan(100);
            
            // Verify fs operations
            expect(fs.promises.writeFile).toHaveBeenCalled();
            
            // Extract the written content
            const writeFileCall = (fs.promises.writeFile as jest.Mock).mock.calls[0];
            const writtenContent = writeFileCall[1];
            
            // Check memory usage of serialized content
            const contentSizeBytes = Buffer.byteLength(writtenContent, 'utf8');
            console.log(`Serialized document size: ${contentSizeBytes / 1024} KB`);
            
            // Size should be reasonable (less than 1MB)
            expect(contentSizeBytes).toBeLessThan(1024 * 1024);
        });
        
        test('should handle generating previews for large documents efficiently', async () => {
            // Create a large document with 50 sections
            const largeDocument = createLargeDocumentData(50);
            
            // Measure performance
            const startTime = performance.now();
            
            const previewPath = await documentService.generatePreview(largeDocument);
            
            const endTime = performance.now();
            
            // Verify preview was generated
            expect(previewPath).toBeDefined();
            
            // Test should be fast (less than 150ms)
            expect(endTime - startTime).toBeLessThan(150);
            
            // Verify fs operations
            expect(fs.promises.writeFile).toHaveBeenCalled();
            
            // Extract the written content
            const writeFileCall = (fs.promises.writeFile as jest.Mock).mock.calls[0];
            const writtenContent = writeFileCall[1];
            
            // Check memory usage of preview content
            const contentSizeBytes = Buffer.byteLength(writtenContent, 'utf8');
            console.log(`Preview document size: ${contentSizeBytes / 1024} KB`);
            
            // Size should be reasonable (less than 1MB)
            expect(contentSizeBytes).toBeLessThan(1024 * 1024);
        });
        
        test('should handle generating documents efficiently', async () => {
            // Create a large document with 50 sections
            const largeDocument = createLargeDocumentData(50);
            
            // Mock template retrieval
            const largeTemplate = createLargeTemplate(50);
            mockTemplateManager.getTemplateById.mockReturnValue(largeTemplate);
            
            // Mock the docxtemplater functionality
            const mockDocxTemplater = {
                setData: jest.fn(),
                render: jest.fn(),
                getZip: jest.fn().mockReturnValue({
                    generate: jest.fn().mockReturnValue(Buffer.from('document content'))
                })
            };
            
            // Use a spy to capture the internal method call
            const generateDocxSpy = jest.spyOn(documentService as any, '_generateDocxDocument')
                .mockResolvedValue('/test/storage/path/output/Test_Document.docx');
            
            // Measure performance
            const startTime = performance.now();
            
            const outputPath = await documentService.generateDocument(largeDocument);
            
            const endTime = performance.now();
            
            // Verify document generation
            expect(outputPath).toBeDefined();
            
            // Test should be fast (less than 200ms)
            expect(endTime - startTime).toBeLessThan(200);
        });
    });
    
    describe('Memory Usage Optimization', () => {
        test('should reuse template data for multiple documents', async () => {
            // Create a template
            const template = createLargeTemplate(10);
            mockTemplateManager.getTemplateById.mockReturnValue(template);
            
            // Spy on template retrieval
            const getTemplateSpy = jest.spyOn(mockTemplateManager, 'getTemplateById');
            
            // Create multiple documents from the same template
            for (let i = 0; i < 10; i++) {
                await documentService.createDocumentFromTemplate('large_template');
            }
            
            // Template should be retrieved only once since we've implemented caching
            expect(getTemplateSpy).toHaveBeenCalledTimes(1);
        });
        
        test('should handle concurrent document operations efficiently', async () => {
            // Create templates and documents
            const template = createLargeTemplate(10);
            mockTemplateManager.getTemplateById.mockReturnValue(template);
            
            const documents = Array.from({ length: 10 }, (_, i) => 
                createLargeDocumentData(10)
            );
            
            // Measure performance of concurrent operations
            const startTime = performance.now();
            
            // Perform multiple operations concurrently
            await Promise.all([
                ...documents.map(doc => documentService.saveDocument(doc)),
                ...documents.map(doc => documentService.generatePreview(doc))
            ]);
            
            const endTime = performance.now();
            
            // Total time should be reasonable (less than 500ms for 20 operations)
            expect(endTime - startTime).toBeLessThan(500);
        });
    });
    
    describe('Stress Tests', () => {
        test('should handle very large documents', async () => {
            // Create an extremely large document with 200 sections
            const veryLargeDocument = createLargeDocumentData(200);
            
            // Mock template retrieval
            const largeTemplate = createLargeTemplate(200);
            mockTemplateManager.getTemplateById.mockReturnValue(largeTemplate);
            
            // Use a spy to capture the internal method call
            const generateDocxSpy = jest.spyOn(documentService as any, '_generateDocxDocument')
                .mockResolvedValue('/test/storage/path/output/Test_Document.docx');
            
            // Measure performance
            const startTime = performance.now();
            
            // Perform operations on very large document
            await documentService.saveDocument(veryLargeDocument);
            await documentService.generatePreview(veryLargeDocument);
            await documentService.generateDocument(veryLargeDocument);
            
            const endTime = performance.now();
            
            // Operations should complete within a reasonable time (less than 1 second)
            expect(endTime - startTime).toBeLessThan(1000);
        });
        
        test('should handle documents with large section content', async () => {
            // Create a document with fewer sections but very large content
            const largeContentDocument: DocumentData = {
                title: 'Large Content Document',
                type: 'Performance Test',
                template: 'large_template',
                author: 'Test User',
                sections: [
                    {
                        id: 'section_1',
                        title: 'Large Section',
                        // Create approximately 1MB of text
                        content: 'This is a test. '.repeat(100000)
                    }
                ]
            };
            
            // Mock template retrieval
            mockTemplateManager.getTemplateById.mockReturnValue(createLargeTemplate(1));
            
            // Use a spy to capture the internal method call
            const generateDocxSpy = jest.spyOn(documentService as any, '_generateDocxDocument')
                .mockResolvedValue('/test/storage/path/output/Test_Document.docx');
            
            // Measure performance
            const startTime = performance.now();
            
            // Perform operations on document with large content
            await documentService.saveDocument(largeContentDocument);
            await documentService.generatePreview(largeContentDocument);
            await documentService.generateDocument(largeContentDocument);
            
            const endTime = performance.now();
            
            // Operations should complete within a reasonable time (less than 2 seconds)
            expect(endTime - startTime).toBeLessThan(2000);
        });
    });
    
    describe('Caching Implementation', () => {
        test('should implement and utilize template caching', async () => {
            // Create a template
            const template = createLargeTemplate(10);
            
            // Set up template retrieval to track calls
            let templateRetrievalCount = 0;
            mockTemplateManager.getTemplateById.mockImplementation(() => {
                templateRetrievalCount++;
                return template;
            });
            
            // Create 10 documents from the same template
            for (let i = 0; i < 10; i++) {
                await documentService.createDocumentFromTemplate('large_template');
            }
            
            // Since we've implemented caching, the template should only be retrieved once
            expect(templateRetrievalCount).toBe(1);
        });
        
        test('should implement and utilize document caching', async () => {
            // Create a document
            const document = createLargeDocumentData(10);
            
            // Mock global state to simulate saved documents
            const savedDocuments = {
                'test_document.json': {
                    title: 'Test Document',
                    path: '/test/storage/path/documents/test_document.json',
                    lastModified: new Date().toISOString()
                }
            };
            mockContext.globalState.get = jest.fn().mockReturnValue(JSON.stringify(savedDocuments));
            
            // Set up file read to track calls
            let fileReadCount = 0;
            (fs.promises.readFile as jest.Mock).mockImplementation(() => {
                fileReadCount++;
                return Promise.resolve(JSON.stringify(document));
            });
            
            // Load the same document multiple times
            for (let i = 0; i < 5; i++) {
                await documentService.loadDocument('test_document.json');
            }
            
            // Since we've implemented caching, the file should only be read once
            expect(fileReadCount).toBe(1);
        });
    });
    
    describe('Optimization Recommendations', () => {
        // These are not actual tests but recommendations for optimization
        
        test.skip('Document generation optimization suggestions', () => {
            /**
             * Optimization suggestions for document generation:
             * 
             * 1. Implement template caching:
             *    - Create a TemplateCache class to store frequently used templates
             *    - Use template ID as key and store the parsed template in memory
             *    - Add expiration mechanism to prevent memory leaks
             * 
             * 2. Optimize docxtemplater usage:
             *    - Pre-compile templates when they're first loaded
             *    - Use streaming for large document generation
             *    - Implement batched processing for very large documents
             * 
             * 3. Memory usage optimization:
             *    - Implement lazy loading for template sections
             *    - Use object pooling for document generation
             *    - Implement content chunking for large sections
             * 
             * 4. Parallel processing:
             *    - Process document sections in parallel when applicable
             *    - Use worker threads for CPU-intensive operations
             *    - Implement queue mechanism for large batch operations
             */
        });
        
        test.skip('Document storage optimization suggestions', () => {
            /**
             * Optimization suggestions for document storage:
             * 
             * 1. Implement document caching:
             *    - Create a DocumentCache class to store frequently accessed documents
             *    - Use LRU (Least Recently Used) algorithm for cache management
             *    - Add size-based constraints to prevent excessive memory usage
             * 
             * 2. Optimize JSON serialization:
             *    - Use incremental JSON parsing for large documents
             *    - Consider binary serialization formats for large documents
             *    - Implement compression for document storage
             * 
             * 3. File system optimizations:
             *    - Use streaming for file operations with large documents
             *    - Implement background saving for non-critical operations
             *    - Add file operation retries with exponential backoff
             */
        });
    });
});
