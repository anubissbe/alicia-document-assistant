import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateManagerService } from '../../services/templateManagerService.js';
import { DocumentTemplate } from '../../models/documentTemplate.js';
import { SecurityManager } from '../../utils/securityManager.js';

// Mock dependencies
jest.mock('vscode');
jest.mock('fs', () => {
    const actualFs = jest.requireActual('fs');
    return {
        ...actualFs,
        constants: {
            R_OK: 4,
            W_OK: 2
        },
        promises: {
            readFile: jest.fn(),
            writeFile: jest.fn(),
            access: jest.fn(),
            mkdir: jest.fn(),
            readdir: jest.fn(),
            unlink: jest.fn()
        },
        existsSync: jest.fn(),
        readFileSync: jest.fn(),
        writeFileSync: jest.fn(),
        mkdirSync: jest.fn()
    };
});
jest.mock('../../utils/securityManager.js');

describe('TemplateManagerService', () => {
    let templateManager: TemplateManagerService;
    let mockContext: vscode.ExtensionContext;
    let mockSecurityManager: jest.Mocked<SecurityManager>;
    
    // Sample template for testing
    const sampleTemplate: DocumentTemplate = {
        id: 'template_123',
        name: 'Test Template',
        description: 'A test template',
        path: '/path/to/template.docx',
        type: 'docx',
        metadata: {
            author: 'Test Author',
            version: '1.0',
            lastModified: new Date()
        }
    };
    
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        
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
                get: jest.fn().mockReturnValue(null),
                update: jest.fn().mockResolvedValue(undefined),
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
        
        // Create SecurityManager mock with public methods and required private properties
        mockSecurityManager = {
            validatePath: jest.fn().mockReturnValue({ valid: true, message: 'Valid path' }),
            sanitizePath: jest.fn().mockImplementation((path) => path),
            sanitizeInput: jest.fn().mockImplementation((input) => input),
            storeSecureData: jest.fn(),
            getSecureData: jest.fn(),
            deleteSecureData: jest.fn(),
            storeApiKey: jest.fn(),
            getApiKey: jest.fn(),
            storeCredentials: jest.fn(),
            getCredentials: jest.fn(),
            storeSecureObject: jest.fn(),
            getSecureObject: jest.fn(),
            rotateEncryptionKeys: jest.fn(),
            generateHash: jest.fn(),
            verifyIntegrity: jest.fn(),
            generateToken: jest.fn(),
            // Add required private properties as any
            context: {} as any,
            defaultAllowedExtensions: [] as any,
            defaultEncryptionConfig: {} as any,
            MASTER_KEY_ID: '' as any,
            containsPathTraversal: jest.fn(),
            encrypt: jest.fn(),
            decrypt: jest.fn(),
            getMasterKey: jest.fn(),
            encryptAndStoreCredential: jest.fn(),
            getAndDecryptCredential: jest.fn(),
            getAllStoredKeys: jest.fn(),
            normalizePath: jest.fn().mockImplementation((path) => path)
        } as unknown as jest.Mocked<SecurityManager>;
        
        // Mock SecurityManager constructor
        (SecurityManager as jest.MockedClass<typeof SecurityManager>).mockImplementation(() => mockSecurityManager);
        
        // Create TemplateManagerService instance
        templateManager = new TemplateManagerService(mockContext);
    });

    afterEach(() => {
        // Clean up
        jest.resetModules();
        
        // Reset fs mocks
        const fs = require('fs');
        Object.values(fs.promises).forEach(mock => (mock as jest.Mock).mockClear());
        (fs.existsSync as jest.Mock).mockClear();
        (fs.readFileSync as jest.Mock).mockClear();
        (fs.writeFileSync as jest.Mock).mockClear();
        
        // Reset SecurityManager mock
        (SecurityManager as jest.MockedClass<typeof SecurityManager>).mockClear();
    });
    
    describe('getTemplates', () => {
        test('should return an empty array when no templates exist', () => {
            const templates = templateManager.getTemplates();
            expect(templates).toEqual([]);
        });
        
        test('should return all templates', () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Create a new instance to load the mocked templates
            templateManager = new TemplateManagerService(mockContext);
            
            const templates = templateManager.getTemplates();
            expect(templates.length).toBe(1);
            expect(templates[0].id).toBe(sampleTemplate.id);
        });
    });
    
    describe('getAvailableTemplates', () => {
        test('should return templates formatted for UI display', async () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Create a new instance to load the mocked templates
            templateManager = new TemplateManagerService(mockContext);
            
            const templates = await templateManager.getAvailableTemplates();
            expect(templates.length).toBe(1);
            expect(templates[0].id).toBe(sampleTemplate.id);
            expect(templates[0].name).toBe(sampleTemplate.name);
            expect(templates[0].description).toBe(sampleTemplate.description);
            expect(templates[0].type).toBe(sampleTemplate.type);
        });
    });
    
    describe('getTemplateById', () => {
        test('should return a template by ID', () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Create a new instance to load the mocked templates
            templateManager = new TemplateManagerService(mockContext);
            
            const template = templateManager.getTemplateById(sampleTemplate.id);
            expect(template).toBeDefined();
            expect(template?.id).toBe(sampleTemplate.id);
        });
        
        test('should return undefined for non-existent template ID', () => {
            const template = templateManager.getTemplateById('non-existent-id');
            expect(template).toBeUndefined();
        });
    });
    
    describe('addTemplate', () => {
        test('should add a new template', async () => {
            // Mock global state update method
            const updateSpy = jest.spyOn(mockContext.globalState, 'update');
            
            // Create a template without ID
            const templateData: Omit<DocumentTemplate, 'id'> = {
                name: 'New Template',
                description: 'A new template',
                path: '/path/to/new/template.docx',
                type: 'docx',
                metadata: {
                    author: 'Test Author',
                    version: '1.0',
                    lastModified: new Date()
                }
            };
            
            // Add the template
            const newTemplate = await templateManager.addTemplate(templateData);
            
            // Verify the template was added
            expect(updateSpy).toHaveBeenCalled();
            expect(newTemplate.id).toBeDefined();
            expect(newTemplate.name).toBe(templateData.name);
        });
    });
    
    describe('updateTemplate', () => {
        test('should update an existing template', async () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Create a new instance to load the mocked templates
            templateManager = new TemplateManagerService(mockContext);
            
            // Mock global state update method
            const updateSpy = jest.spyOn(mockContext.globalState, 'update');
            
            // Update the template
            const updatedData = { name: 'Updated Name', description: 'Updated description' };
            const updatedTemplate = await templateManager.updateTemplate(sampleTemplate.id, updatedData);
            
            // Verify the template was updated
            expect(updateSpy).toHaveBeenCalled();
            expect(updatedTemplate.id).toBe(sampleTemplate.id);
            expect(updatedTemplate.name).toBe(updatedData.name);
            expect(updatedTemplate.description).toBe(updatedData.description);
        });
        
        test('should throw an error for non-existent template ID', async () => {
            await expect(templateManager.updateTemplate('non-existent-id', {}))
                .rejects.toThrow('Template with ID non-existent-id not found');
        });
    });
    
    describe('deleteTemplate', () => {
        test('should delete an existing template', async () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Create a new instance to load the mocked templates
            templateManager = new TemplateManagerService(mockContext);
            
            // Mock global state update method
            const updateSpy = jest.spyOn(mockContext.globalState, 'update');
            
            // Delete the template
            await templateManager.deleteTemplate(sampleTemplate.id);
            
            // Verify the template was deleted
            expect(updateSpy).toHaveBeenCalled();
            expect(templateManager.getTemplateById(sampleTemplate.id)).toBeUndefined();
        });
        
        test('should throw an error for non-existent template ID', async () => {
            await expect(templateManager.deleteTemplate('non-existent-id'))
                .rejects.toThrow('Template with ID non-existent-id not found');
        });
    });
    
    describe('exportTemplate', () => {
        test('should export a template to a file', async () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Create a new instance to load the mocked templates
            templateManager = new TemplateManagerService(mockContext);
            
            // Mock fs.promises.writeFile
            (fs.promises.writeFile as jest.Mock).mockResolvedValue(undefined);
            
            // Export the template
            await templateManager.exportTemplate(sampleTemplate.id, '/path/to/export/template.docx');
            
            // Verify the template was exported
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                '/path/to/export/template.docx',
                expect.any(String),
                'utf8'
            );
        });
        
        test('should throw an error for non-existent template ID', async () => {
            await expect(templateManager.exportTemplate('non-existent-id', '/path/to/export/template.docx'))
                .rejects.toThrow('Template with ID non-existent-id not found');
        });
        
        test('should throw an error for invalid export path', async () => {
            // Mock the global state to return a saved template
            const templatesJson = JSON.stringify([sampleTemplate]);
            mockContext.globalState.get = jest.fn().mockReturnValue(templatesJson);
            
            // Mock SecurityManager to reject the path
            mockSecurityManager.validatePath.mockReturnValue({ valid: false, message: 'Invalid path' });
            
            await expect(templateManager.exportTemplate(sampleTemplate.id, '/invalid/path/template.docx'))
                .rejects.toThrow('Invalid export path: /invalid/path/template.docx');
        });
    });

    describe('importTemplate', () => {
        test('should import a template from a file', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.sanitizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue({ valid: true, message: 'Valid path' });
            
            // Mock fs.existsSync
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            
            // Mock the addTemplate method
            const addTemplateSpy = jest.spyOn(templateManager, 'addTemplate')
                .mockResolvedValue({
                    ...sampleTemplate,
                    name: 'Imported Template',
                    description: 'Imported from file',
                    path: '/path/to/imported/template.docx'
                });
            
            // Import the template
            const importedTemplate = await templateManager.importTemplate(
                '/path/to/imported/template.docx',
                'Imported Template',
                'Imported from file'
            );
            
            // Verify the template was imported
            expect(mockSecurityManager.validatePath).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalled();
            expect(addTemplateSpy).toHaveBeenCalled();
            expect(importedTemplate.name).toBe('Imported Template');
        });
        
        test('should throw an error for invalid file path', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.sanitizePath.mockReturnValue('');
            
            await expect(templateManager.importTemplate(
                '/invalid/path/template.docx',
                'Invalid Template',
                'Invalid path'
            )).rejects.toThrow('Invalid template file path: /invalid/path/template.docx');
        });
        
        test('should throw an error for disallowed file path', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.sanitizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue({ valid: false, message: 'Invalid path' });
            
            await expect(templateManager.importTemplate(
                '/disallowed/path/template.docx',
                'Disallowed Template',
                'Disallowed path'
            )).rejects.toThrow('Template file path not allowed: /disallowed/path/template.docx');
        });
        
        test('should throw an error if file does not exist', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.sanitizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue({ valid: true, message: 'Valid path' });
            
            // Mock fs.existsSync
            (fs.existsSync as jest.Mock).mockReturnValue(false);
            
            await expect(templateManager.importTemplate(
                '/path/to/nonexistent/template.docx',
                'Nonexistent Template',
                'Nonexistent file'
            )).rejects.toThrow('File does not exist: /path/to/nonexistent/template.docx');
        });
    });
});
