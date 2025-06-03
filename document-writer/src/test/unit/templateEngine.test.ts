import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { TemplateEngine, ValidationResult } from '../../core/templateEngine';
import { TemplateMetadata } from '../../models/templateMetadata';

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    readdir: jest.fn(),
    readFile: jest.fn(),
    access: jest.fn(),
  },
  constants: {
    F_OK: 0
  }
}));

// Mock the vscode module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn()
}));

describe('TemplateEngine', () => {
  let templateEngine: TemplateEngine;
  let mockContext: vscode.ExtensionContext;
  
  const mockMetadata: TemplateMetadata = {
    name: 'Test Template',
    description: 'A test template',
    type: 'test',
    version: '1.0.0',
    author: 'Test Author',
    variables: [
      {
        name: 'title',
        type: 'string',
        required: true,
        description: 'Document title'
      },
      {
        name: 'amount',
        type: 'number',
        required: false,
        description: 'Amount value',
        default: 0
      },
      {
        name: 'isActive',
        type: 'boolean',
        required: false,
        description: 'Active status',
        default: true
      },
      {
        name: 'items',
        type: 'array',
        required: false,
        description: 'List of items'
      },
      {
        name: 'date',
        type: 'date',
        required: false,
        description: 'Document date',
        default: new Date().toISOString()
      }
    ],
    sections: ['header', 'content', 'footer']
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock extension context
    mockContext = {
      extensionPath: '/test/extension/path',
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    
    // Mock filesystem functions
    const mockReaddir = fs.promises.readdir as jest.Mock;
    mockReaddir.mockResolvedValue([
      { name: 'test.json', isDirectory: () => false }
    ]);
    
    const mockReadFile = fs.promises.readFile as jest.Mock;
    mockReadFile.mockImplementation((path) => {
      if (path.endsWith('.json')) {
        return Promise.resolve(JSON.stringify(mockMetadata));
      }
      if (path.endsWith('.docx')) {
        return Promise.resolve('Template content with {{title}} and {{amount}}');
      }
      return Promise.resolve('');
    });
    
    const mockAccess = fs.promises.access as jest.Mock;
    mockAccess.mockImplementation((path) => {
      if (path.includes('test.docx')) {
        return Promise.resolve();
      }
      return Promise.reject(new Error('File not found'));
    });
    
    // Create instance
    templateEngine = new TemplateEngine(mockContext);
  });

  describe('Helper functions', () => {
    it('should correctly format dates', async () => {
      // Access the private handlebars instance for testing helpers
      const handlebars = (templateEngine as any).handlebars;
      const helper = handlebars.helpers.formatDate;
      
      const testDate = new Date('2025-01-01');
      
      // Test different formats
      expect(helper(testDate, 'short')).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(helper(testDate, 'long')).toContain('2025');
      expect(helper(testDate, 'time')).toMatch(/\d{1,2}:\d{2}:\d{2}/);
      expect(helper(testDate, 'datetime')).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      expect(helper(testDate, 'unknown')).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      
      // Test with string date
      expect(helper('2025-01-01', 'short')).toMatch(/\d{1,2}\/\d{1,2}\/\d{4}/);
      
      // Test with null
      expect(helper(null, 'short')).toBe('');
    });
    
    it('should correctly format currency values', async () => {
      const handlebars = (templateEngine as any).handlebars;
      const helper = handlebars.helpers.currency;
      
      expect(helper(1000, 'USD')).toBe('$1,000.00');
      expect(helper(1000, 'EUR')).toBe('€1,000.00');
      expect(helper(0, 'USD')).toBe('$0.00');
      expect(helper(null)).toBe('');
    });
    
    it('should correctly format percentages', async () => {
      const handlebars = (templateEngine as any).handlebars;
      const helper = handlebars.helpers.percentage;
      
      expect(helper(0.5)).toBe('50.00%');
      expect(helper(0.12345, 2)).toBe('12.35%');
      expect(helper(0.12345, 0)).toBe('12%');
      expect(helper(null)).toBe('');
    });
    
    it('should correctly handle conditionals', async () => {
      const handlebars = (templateEngine as any).handlebars;
      const helper = handlebars.helpers.conditional;
      
      expect(helper(true, 'Yes', 'No')).toBe('Yes');
      expect(helper(false, 'Yes', 'No')).toBe('No');
    });
    
    it('should correctly format lists', async () => {
      const handlebars = (templateEngine as any).handlebars;
      const helper = handlebars.helpers.list;
      
      expect(helper(['a', 'b', 'c'])).toBe('a, b, c');
      expect(helper(['a', 'b', 'c'], ' - ')).toBe('a - b - c');
      expect(helper(null)).toBe('');
      expect(helper('not an array')).toBe('');
    });
  });

  describe('Template validation', () => {
    it('should validate required fields', async () => {
      // Mock the template cache
      (templateEngine as any).templateCache.set('test', mockMetadata);
      
      // Missing required field
      const missingRequired = await templateEngine.validateTemplateData('test', {
        amount: 100
      });
      expect(missingRequired.valid).toBe(false);
      expect(missingRequired.errors).toContain('Required variable missing: title');
      
      // Valid data
      const validData = await templateEngine.validateTemplateData('test', {
        title: 'Test Document',
        amount: 100
      });
      expect(validData.valid).toBe(true);
      expect(validData.errors).toHaveLength(0);
    });
    
    it('should validate data types', async () => {
      // Mock the template cache
      (templateEngine as any).templateCache.set('test', mockMetadata);
      
      // Invalid types
      const invalidTypes = await templateEngine.validateTemplateData('test', {
        title: 123, // Should be string
        amount: 'not a number', // Should be number
        isActive: 'true', // Should be boolean
        items: {}, // Should be array
        date: 'invalid date' // Should be date
      });
      
      expect(invalidTypes.valid).toBe(false);
      expect(invalidTypes.errors).toContain('Invalid type for title: expected string');
      expect(invalidTypes.errors).toContain('Invalid type for amount: expected number');
      expect(invalidTypes.errors).toContain('Invalid type for isActive: expected boolean');
      expect(invalidTypes.errors).toContain('Invalid type for items: expected array');
      
      // Valid data with all types
      const validData = await templateEngine.validateTemplateData('test', {
        title: 'Test Document',
        amount: 100,
        isActive: true,
        items: ['item1', 'item2'],
        date: new Date()
      });
      
      expect(validData.valid).toBe(true);
    });
    
    it('should return error for unknown template type', async () => {
      const result = await templateEngine.validateTemplateData('unknown', {});
      expect(result.valid).toBe(false);
      expect(result.errors).toContain('Template type not found');
    });
  });

  describe('Template loading and retrieval', () => {
    it('should return null for non-existent template type', async () => {
      const template = await templateEngine.getTemplateForType('unknown');
      expect(template).toBeNull();
    });
    
    it('should return template path for existing template', async () => {
      // Mock the template cache
      (templateEngine as any).templateCache.set('test', mockMetadata);
      
      // Mock the fileExists method to return true
      (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
      
      const template = await templateEngine.getTemplateForType('test');
      expect(template).toBe(path.join('/test/extension/path', 'resources', 'templates', 'test', 'test.docx'));
    });
    
    it('should return available templates', () => {
      // Mock the template cache
      (templateEngine as any).templateCache.set('test', mockMetadata);
      
      const templates = templateEngine.getAvailableTemplates();
      expect(templates.size).toBe(1);
      expect(templates.get('test')).toEqual(mockMetadata);
    });
    
    it('should return template metadata', () => {
      // Mock the template cache
      (templateEngine as any).templateCache.set('test', mockMetadata);
      
      const metadata = templateEngine.getTemplateMetadata('test');
      expect(metadata).toEqual(mockMetadata);
      
      const unknownMetadata = templateEngine.getTemplateMetadata('unknown');
      expect(unknownMetadata).toBeUndefined();
    });
  });

  describe('Template processing', () => {
    it('should process template with data', async () => {
      // Mock readFile to return a template string
      (fs.promises.readFile as jest.Mock).mockResolvedValue('Hello {{name}}!');
      
      const result = await templateEngine.processTemplate('test.hbs', { name: 'World' });
      expect(result).toBe('Hello World!');
    });
  });

  describe('Custom extensions', () => {
    it('should register and use partial templates', async () => {
      // Register a partial
      templateEngine.registerPartial('header', '<h1>{{title}}</h1>');
      
      // Mock readFile to return a template that uses the partial
      (fs.promises.readFile as jest.Mock).mockResolvedValue('{{> header }}');
      
      const result = await templateEngine.processTemplate('test.hbs', { title: 'Test Title' });
      expect(result).toBe('<h1>Test Title</h1>');
    });
    
    it('should register and use custom helpers', async () => {
      // Register a custom helper
      templateEngine.registerHelper('uppercase', (str) => str.toUpperCase());
      
      // Mock readFile to return a template that uses the helper
      (fs.promises.readFile as jest.Mock).mockResolvedValue('{{uppercase name}}');
      
      const result = await templateEngine.processTemplate('test.hbs', { name: 'test' });
      expect(result).toBe('TEST');
    });
  });
});
