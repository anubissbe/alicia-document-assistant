import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentService, DocumentData, DocumentSection } from '../../services/documentService';
import { SecurityManager } from '../../utils/securityManager';
import { DocumentTemplate, DocumentFormat } from '../../models/documentTemplate';
import { TemplateManagerService } from '../../services/templateManagerService';

// Mock dependencies
jest.mock('vscode');
jest.mock('fs');
jest.mock('../../utils/securityManager');
jest.mock('../../services/templateManagerService');

describe('DocumentService', () => {
    let documentService: DocumentService;
    let mockContext: vscode.ExtensionContext;
    let mockSecurityManager: jest.Mocked<SecurityManager>;
    let mockTemplateManager: jest.Mocked<TemplateManagerService>;
    
    // Sample template for testing
    const sampleTemplate: DocumentTemplate = {
        id: 'template_123',
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
        sections: [
            {
                id: 'section_1',
                name: 'Introduction',
                isRequired: true,
                description: 'Introduction to the document',
                placeholders: [],
                order: 1
            },
            {
                id: 'section_2',
                name: 'Body',
                isRequired: true,
                description: 'Main content of the document',
                placeholders: [],
                order: 2
            }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
    };
    
    // Sample document data for testing
    const sampleDocumentData: DocumentData = {
        title: 'Test Document',
        type: 'Test Type',
        template: 'template_123',
        author: 'Test User',
        sections: [
            {
                id: 'section_1',
                title: 'Introduction',
                content: 'This is the introduction'
            },
            {
                id: 'section_2',
                title: 'Body',
                content: 'This is the main body'
            }
        ]
    };
    
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
            getTemplates: jest.fn().mockResolvedValue([sampleTemplate]),
            getTemplateById: jest.fn().mockReturnValue(sampleTemplate),
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
    });
    
    describe('getTemplates', () => {
        test('should return templates from the template manager', async () => {
            const templates = await documentService.getTemplates();
            
            expect(mockTemplateManager.getTemplates).toHaveBeenCalled();
            expect(templates).toEqual([sampleTemplate]);
        });
    });
    
    describe('createDocumentFromTemplate', () => {
        test('should create a document from template ID', async () => {
            // Mock unique ID generation
            jest.spyOn(documentService as any, '_generateUniqueId')
                .mockReturnValue('generated_id');
            
            const document = await documentService.createDocumentFromTemplate('template_123');
            
            // Verify document creation
            expect(mockTemplateManager.getTemplateById).toHaveBeenCalledWith('template_123');
            expect(document).toBeDefined();
            expect(document.title).toBe(`New ${sampleTemplate.name}`);
            expect(document.template).toBe('template_123');
            expect(document.sections.length).toBe(2);
            expect(document.sections[0].id).toBe('generated_id');
        });
        
        test('should throw an error if template is not found', async () => {
            // Mock template not found
            mockTemplateManager.getTemplateById.mockReturnValue(undefined);
            
            await expect(documentService.createDocumentFromTemplate('nonexistent_template'))
                .rejects.toThrow('Template with ID nonexistent_template not found');
        });
    });
    
    describe('saveDocument', () => {
        test('should save document to the documents folder', async () => {
            // Mock file operations
            (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
            
            // Mock global state
            const updateSpy = jest.spyOn(mockContext.globalState, 'update');
            
            // Mock generateFilename method
            jest.spyOn(documentService as any, '_generateFilename')
                .mockReturnValue('Test_Document_2025-06-03T10-30-00.000Z.json');
            
            const savedPath = await documentService.saveDocument(sampleDocumentData);
            
            // Verify document was saved
            expect(fs.promises.writeFile).toHaveBeenCalled();
            expect(updateSpy).toHaveBeenCalled();
            expect(savedPath).toContain('Test_Document_2025-06-03T10-30-00.000Z.json');
        });
        
        test('should throw an error if path normalization fails', async () => {
            // Mock path validation to fail
            mockSecurityManager.normalizePath.mockReturnValue(null);
            
            await expect(documentService.saveDocument(sampleDocumentData))
                .rejects.toThrow('Failed to normalize path for:');
        });
        
        test('should throw an error if path validation fails', async () => {
            // Mock normalization to succeed but validation to fail
            mockSecurityManager.normalizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue(false);
            
            await expect(documentService.saveDocument(sampleDocumentData))
                .rejects.toThrow('Invalid file path:');
        });
    });
    
    describe('loadDocument', () => {
        test('should load document from a saved file', async () => {
            // Mock saved documents in global state
            const savedDocuments = {
                'test_document.json': {
                    title: 'Test Document',
                    path: '/test/storage/path/documents/test_document.json',
                    lastModified: new Date().toISOString()
                }
            };
            mockContext.globalState.get = jest.fn().mockReturnValue(JSON.stringify(savedDocuments));
            
            // Mock file read operation
            (fs.promises.readFile as jest.Mock).mockResolvedValue(JSON.stringify(sampleDocumentData));
            
            const document = await documentService.loadDocument('test_document.json');
            
            // Verify document was loaded
            expect(mockSecurityManager.validatePath).toHaveBeenCalled();
            expect(fs.promises.readFile).toHaveBeenCalled();
            expect(document).toEqual(sampleDocumentData);
        });
        
        test('should throw an error if document is not found', async () => {
            // Mock empty saved documents
            mockContext.globalState.get = jest.fn().mockReturnValue(JSON.stringify({}));
            
            await expect(documentService.loadDocument('nonexistent_document.json'))
                .rejects.toThrow('Document nonexistent_document.json not found');
        });
        
        test('should throw an error if path validation fails', async () => {
            // Mock saved documents
            const savedDocuments = {
                'test_document.json': {
                    title: 'Test Document',
                    path: '/test/storage/path/documents/test_document.json',
                    lastModified: new Date().toISOString()
                }
            };
            mockContext.globalState.get = jest.fn().mockReturnValue(JSON.stringify(savedDocuments));
            
            // Mock path validation to fail
            mockSecurityManager.validatePath.mockReturnValue(false);
            
            await expect(documentService.loadDocument('test_document.json'))
                .rejects.toThrow('Invalid file path:');
        });
    });
    
    describe('generatePreview', () => {
        test('should generate a markdown preview of the document', async () => {
            // Mock file operations
            (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
            
            // Mock unique ID generation
            jest.spyOn(documentService as any, '_generateUniqueId')
                .mockReturnValue('preview_id');
            
            const previewPath = await documentService.generatePreview(sampleDocumentData);
            
            // Verify preview was generated
            expect(fs.promises.writeFile).toHaveBeenCalled();
            expect(previewPath).toContain('preview_preview_id.md');
        });
        
        test('should throw an error if path validation fails', async () => {
            // Mock path validation to fail
            mockSecurityManager.validatePath.mockReturnValue(false);
            
            await expect(documentService.generatePreview(sampleDocumentData))
                .rejects.toThrow('Invalid file path:');
        });
    });
    
    describe('generateDocument', () => {
        test('should generate a document from document data', async () => {
            // Mock directory creation
            (fs.promises.mkdir as jest.Mock).mockResolvedValue(undefined);
            
            // Mock file operations for DOCX generation
            (fs.readFileSync as jest.Mock).mockReturnValue('template content');
            (fs.writeFileSync as jest.Mock).mockReturnValue(undefined);
            
            // Mock the docxtemplater functionality (simplified)
            const mockDocxTemplater = {
                setData: jest.fn(),
                render: jest.fn(),
                getZip: jest.fn().mockReturnValue({
                    generate: jest.fn().mockReturnValue(Buffer.from('document content'))
                })
            };
            
            // Mock PizZip constructor
            const mockPizZip = function() { return {}; };
            jest.mock('pizzip', () => mockPizZip);
            
            // Mock Docxtemplater constructor
            const mockDocxtemplaterConstructor = jest.fn().mockReturnValue(mockDocxTemplater);
            jest.mock('docxtemplater', () => mockDocxtemplaterConstructor);
            
            // Use a spy to capture the internal method call
            const generateDocxSpy = jest.spyOn(documentService as any, '_generateDocxDocument')
                .mockResolvedValue('/test/storage/path/output/Test_Document.docx');
            
            const outputPath = await documentService.generateDocument(sampleDocumentData);
            
            // Verify document generation
            expect(mockTemplateManager.getTemplateById).toHaveBeenCalledWith('template_123');
            expect(generateDocxSpy).toHaveBeenCalled();
            expect(outputPath).toBe('/test/storage/path/output/Test_Document.docx');
        });
        
        test('should throw an error if template is not found', async () => {
            // Mock template not found
            mockTemplateManager.getTemplateById.mockReturnValue(undefined);
            
            await expect(documentService.generateDocument(sampleDocumentData))
                .rejects.toThrow(`Template with ID ${sampleDocumentData.template} not found`);
        });
    });
});
