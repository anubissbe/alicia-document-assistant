import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateManagerService } from '../../services/templateManagerService';
import { DocumentFormat, DocumentTemplate } from '../../models/documentTemplate';
import { SecurityManager, SecurityLevel } from '../../utils/securityManager';

// Mock the dependencies
jest.mock('vscode');
jest.mock('fs');
jest.mock('../../utils/securityManager');

describe('TemplateManagerService', () => {
    let templateManager: TemplateManagerService;
    let mockContext: vscode.ExtensionContext;
    let mockSecurityManager: jest.Mocked<SecurityManager>;
    
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
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date()
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
        
        // Create SecurityManager mock
        mockSecurityManager = {
            normalizePath: jest.fn().mockImplementation((path) => path),
            validatePath: jest.fn().mockReturnValue(true),
            addAllowedPath: jest.fn(),
            validateInput: jest.fn(),
            sanitizeContent: jest.fn().mockImplementation((content) => content),
            storeSecret: jest.fn(),
            getSecret: jest.fn(),
            deleteSecret: jest.fn(),
            generateHash: jest.fn(),
            verifyTemplateIntegrity: jest.fn(),
            encryptData: jest.fn(),
            decryptData: jest.fn(),
        } as any;
        
        // Mock SecurityManager constructor
        (SecurityManager as jest.MockedClass<typeof SecurityManager>).mockImplementation(() => mockSecurityManager);
        
        // Create TemplateManagerService instance
        templateManager = new TemplateManagerService(mockContext);
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
            expect(templates[0].format).toBe(sampleTemplate.format);
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
                format: DocumentFormat.DOCX,
                templatePath: '/path/to/new/template.docx',
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
    
    describe('importTemplate', () => {
        test('should import a template from a file', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.normalizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue(true);
            
            // Mock fs.existsSync
            (fs.existsSync as jest.Mock).mockReturnValue(true);
            
            // Mock the addTemplate method
            const addTemplateSpy = jest.spyOn(templateManager, 'addTemplate')
                .mockResolvedValue({
                    ...sampleTemplate,
                    name: 'Imported Template',
                    description: 'Imported from file',
                    templatePath: '/path/to/imported/template.docx'
                });
            
            // Import the template
            const importedTemplate = await templateManager.importTemplate(
                '/path/to/imported/template.docx',
                'Imported Template',
                'Imported from file'
            );
            
            // Verify the template was imported
            expect(mockSecurityManager.normalizePath).toHaveBeenCalled();
            expect(mockSecurityManager.validatePath).toHaveBeenCalled();
            expect(fs.existsSync).toHaveBeenCalled();
            expect(addTemplateSpy).toHaveBeenCalled();
            expect(importedTemplate.name).toBe('Imported Template');
        });
        
        test('should throw an error for invalid file path', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.normalizePath.mockReturnValue(null);
            
            await expect(templateManager.importTemplate(
                '/invalid/path/template.docx',
                'Invalid Template',
                'Invalid path'
            )).rejects.toThrow('Invalid template file path: /invalid/path/template.docx');
        });
        
        test('should throw an error for disallowed file path', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.normalizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue(false);
            
            await expect(templateManager.importTemplate(
                '/disallowed/path/template.docx',
                'Disallowed Template',
                'Disallowed path'
            )).rejects.toThrow('Template file path not allowed: /disallowed/path/template.docx');
        });
        
        test('should throw an error if file does not exist', async () => {
            // Mock SecurityManager methods
            mockSecurityManager.normalizePath.mockImplementation((path) => path);
            mockSecurityManager.validatePath.mockReturnValue(true);
            
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
