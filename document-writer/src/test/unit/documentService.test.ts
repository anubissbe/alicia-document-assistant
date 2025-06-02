import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentService } from '../../services/documentService';
import { DocumentTemplate, DocumentFormat, PlaceholderType } from '../../models/documentTemplate';

// Mock dependencies
jest.mock('fs', () => ({
  readFileSync: jest.fn().mockReturnValue('mock template content'),
  writeFileSync: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined)
  }
}));

jest.mock('path', () => ({
  join: jest.fn((...args) => args.join('/'))
}));

jest.mock('pizzip', () => {
  return jest.fn().mockImplementation(() => ({
    file: jest.fn(),
    generate: jest.fn().mockReturnValue({ 'blob': 'mock-binary-content' })
  }));
});

jest.mock('docxtemplater', () => {
  return jest.fn().mockImplementation(() => ({
    setData: jest.fn(),
    render: jest.fn(),
    getZip: jest.fn().mockReturnValue({
      generate: jest.fn().mockReturnValue(Buffer.from('mock-document-content'))
    })
  }));
});

describe('DocumentService', () => {
  let documentService: DocumentService;
  let mockExtensionContext: vscode.ExtensionContext;
  
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Create mock extension context
    mockExtensionContext = {
      subscriptions: [],
      extensionPath: '/mock/extension/path',
      extensionUri: vscode.Uri.file('/mock/extension/path'),
      storageUri: vscode.Uri.file('/mock/storage/path'),
      globalStorageUri: vscode.Uri.file('/mock/global/storage/path'),
      logUri: vscode.Uri.file('/mock/log/path'),
      extensionMode: vscode.ExtensionMode.Test,
      asAbsolutePath: jest.fn(relativePath => path.join('/mock/extension/path', relativePath))
    } as unknown as vscode.ExtensionContext;
    
    // Create instance of DocumentService for testing
    documentService = new DocumentService(mockExtensionContext);
  });
  
  describe('generateDocument', () => {
    it('should generate a DOCX document from a template with provided data', async () => {
      // Arrange
      const mockTemplate: DocumentTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        format: DocumentFormat.DOCX,
        templatePath: '/path/to/template.docx',
        metadata: {
          author: 'Test Author',
          version: '1.0.0',
          tags: ['test', 'template'],
          category: 'test'
        },
        sections: [
          {
            id: 'section1',
            name: 'Main Section',
            description: 'Main document section',
            placeholders: [
              {
                id: 'title',
                key: 'title',
                description: 'Document title',
                type: PlaceholderType.TEXT,
                isRequired: true
              },
              {
                id: 'author',
                key: 'author',
                description: 'Document author',
                type: PlaceholderType.TEXT,
                isRequired: true
              }
            ],
            isRequired: true,
            order: 1
          }
        ],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const mockData = {
        title: 'Test Document',
        author: 'Test Author',
        content: 'This is a test document content.'
      };
      
      const outputPath = '/path/to/output';
      
      // Act
      const result = await documentService.generateDocument(mockTemplate, mockData, outputPath);
      
      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/template.docx', 'binary');
      expect(fs.writeFileSync).toHaveBeenCalledWith(expect.stringContaining('/path/to/output/Test_Template_'), expect.anything());
      expect(result).toBeDefined();
      expect(result).toContain('/path/to/output/Test_Template_');
    });
    
    it('should handle errors during document generation', async () => {
      // Arrange
      const mockTemplate: DocumentTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        format: DocumentFormat.DOCX,
        templatePath: '/path/to/template.docx',
        metadata: {
          author: 'Test Author',
          version: '1.0.0',
          tags: ['test', 'template'],
          category: 'test'
        },
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const mockData = {
        title: 'Test Document'
      };
      
      const outputPath = '/path/to/output';
      
      // Mock an error during file read
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('Mock file read error');
      });
      
      // Act & Assert
      await expect(documentService.generateDocument(mockTemplate, mockData, outputPath))
        .rejects.toThrow('Mock file read error');
    });
    it('should generate a Markdown document', async () => {
      // Arrange
      const mockTemplate: DocumentTemplate = {
        id: 'test-template',
        name: 'Test Template',
        description: 'A test template',
        format: DocumentFormat.MARKDOWN,
        templatePath: '/path/to/template.md',
        metadata: {
          author: 'Test Author',
          version: '1.0.0',
          tags: ['test', 'template'],
          category: 'test'
        },
        sections: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      const mockData = {
        title: 'Test Document',
        author: 'Test Author'
      };
      
      const outputPath = '/path/to/output';
      
      // Mock the template content with placeholders
      (fs.readFileSync as jest.Mock).mockReturnValue('# {{title}}\nAuthor: {{author}}');
      
      // Act
      const result = await documentService.generateDocument(mockTemplate, mockData, outputPath);
      
      // Assert
      expect(fs.readFileSync).toHaveBeenCalledWith('/path/to/template.md', 'utf-8');
      expect(fs.writeFileSync).toHaveBeenCalledWith(
        expect.stringContaining('/path/to/output/Test_Template_'), 
        expect.stringContaining('# Test Document\nAuthor: Test Author')
      );
      expect(result).toBeDefined();
    });
  });
});
