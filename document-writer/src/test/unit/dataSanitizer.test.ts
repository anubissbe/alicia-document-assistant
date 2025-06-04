import * as vscode from 'vscode';
import { SecurityManager } from '../../utils/securityManager';
import { DataSanitizer, SanitizationLevel } from '../../utils/dataSanitizer';

// Mock modules
jest.mock('vscode');

describe('DataSanitizer', () => {
    let securityManager: SecurityManager;
    let dataSanitizer: DataSanitizer;
    let mockContext: vscode.ExtensionContext;
    let mockSecretStorage: vscode.SecretStorage;
    let mockGlobalState: any;
    
    // Setup mocks
    beforeEach(() => {
        // Mock vscode.SecretStorage
        mockSecretStorage = {
            store: jest.fn().mockResolvedValue(undefined),
            get: jest.fn().mockImplementation((key: string) => Promise.resolve(`secret-${key}`)),
            delete: jest.fn().mockResolvedValue(undefined),
            onDidChange: jest.fn() as any
        };
        
        // Create a mock that satisfies the Memento interface
        mockGlobalState = {
            get: jest.fn(),
            update: jest.fn().mockResolvedValue(undefined),
            keys: jest.fn().mockReturnValue([])
        };
        
        // Create mock context
        mockContext = {
            subscriptions: [],
            workspaceState: {} as any,
            globalState: mockGlobalState,
            extensionUri: {} as vscode.Uri,
            extensionPath: '',
            asAbsolutePath: jest.fn(),
            storagePath: '',
            globalStoragePath: '',
            logPath: '',
            storageUri: {} as vscode.Uri,
            globalStorageUri: {} as vscode.Uri,
            logUri: {} as vscode.Uri,
            extensionMode: vscode.ExtensionMode.Development,
            secrets: mockSecretStorage,
            extension: {} as any
        } as unknown as vscode.ExtensionContext;
        
        // Mock SecurityManager sanitizeInput method
        securityManager = new SecurityManager(mockContext);
        jest.spyOn(securityManager, 'sanitizeInput').mockImplementation((input: string) => {
            if (!input) {
                return '';
            }
            return input
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#39;');
        });
        
        // Create DataSanitizer instance
        dataSanitizer = new DataSanitizer(securityManager);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('sanitize', () => {
        test('should handle null or empty input', () => {
            expect(dataSanitizer.sanitize('')).toBe('');
            expect(dataSanitizer.sanitize(undefined as unknown as string)).toBe('');
            expect(dataSanitizer.sanitize(null as unknown as string)).toBe('');
        });
        
        test('should apply basic sanitization correctly', () => {
            const input = '<script>alert("XSS");</script>';
            const result = dataSanitizer.sanitize(input, SanitizationLevel.BASIC);
            
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('</script>');
            expect(result).toContain('&lt;script&gt;');
            expect(result).toContain('&lt;/script&gt;');
            expect(securityManager.sanitizeInput).toHaveBeenCalledWith(input);
        });
        
        test('should apply strict sanitization correctly', () => {
            const input = 'Test input with <special> chars & symbols!@#$%^&*()';
            const result = dataSanitizer.sanitize(input, SanitizationLevel.STRICT);
            
            expect(result).not.toContain('<special>');
            expect(result).not.toContain('!@#$%^&*()');
            expect(result).toMatch(/^[\w\s.,@\-]+$/);
        });
        
        test('should sanitize HTML content correctly', () => {
            const input = '<div onclick="alert(\'XSS\')">Test</div><!-- hidden comment --> <img src="javascript:alert(\'XSS\')" />';
            const result = dataSanitizer.sanitize(input, SanitizationLevel.HTML);
            
            expect(result).not.toContain('onclick=');
            expect(result).not.toContain('javascript:');
            expect(result).not.toContain('<!-- hidden comment -->');
            expect(result).toContain('removed=');
            expect(result).toContain('removed:');
        });
        
        test('should sanitize template variables correctly', () => {
            const input = 'Normal text {{handlebars}} ${javascript} {% liquid %}';
            const result = dataSanitizer.sanitize(input, SanitizationLevel.TEMPLATE_VAR);
            
            expect(result).not.toContain('{{handlebars}}');
            expect(result).not.toContain('${javascript}');
            expect(result).not.toContain('{% liquid %}');
            expect(result).toContain('Normal text  ');
        });
    });
    
    describe('sanitizeObject', () => {
        test('should handle null or empty input', () => {
            expect(dataSanitizer.sanitizeObject(null)).toBeNull();
            expect(dataSanitizer.sanitizeObject(undefined)).toBeUndefined();
            expect(dataSanitizer.sanitizeObject({})).toEqual({});
        });
        
        test('should sanitize string values in objects', () => {
            const input = {
                name: '<script>alert("XSS");</script>',
                description: 'Normal text'
            };
            
            const result = dataSanitizer.sanitizeObject(input);
            
            expect(result.name).not.toContain('<script>');
            expect(result.name).toContain('&lt;script&gt;');
            expect(result.description).toBe('Normal text');
        });
        
        test('should recursively sanitize nested objects', () => {
            const input = {
                user: {
                    name: '<b>User</b>',
                    profile: {
                        bio: '<script>alert("XSS");</script>'
                    }
                },
                settings: {
                    theme: 'dark'
                }
            };
            
            const result = dataSanitizer.sanitizeObject(input);
            
            expect(result.user.name).not.toContain('<b>');
            expect(result.user.profile.bio).not.toContain('<script>');
            expect(result.settings.theme).toBe('dark');
        });
        
        test('should sanitize arrays of values', () => {
            const input = {
                tags: ['<script>alert("XSS");</script>', 'normal tag', '<b>Bold</b>']
            };
            
            const result = dataSanitizer.sanitizeObject(input);
            
            expect(result.tags[0]).not.toContain('<script>');
            expect(result.tags[0]).toContain('&lt;script&gt;');
            expect(result.tags[1]).toBe('normal tag');
            expect(result.tags[2]).not.toContain('<b>');
        });
        
        test('should preserve non-string values', () => {
            const input = {
                name: 'Test',
                age: 30,
                active: true,
                lastLogin: null,
                scores: [1, 2, 3]
            };
            
            const result = dataSanitizer.sanitizeObject(input);
            
            expect(result.name).toBe('Test');
            expect(result.age).toBe(30);
            expect(result.active).toBe(true);
            expect(result.lastLogin).toBeNull();
            expect(result.scores).toEqual([1, 2, 3]);
        });
    });
    
    describe('sanitizeDocumentData', () => {
        test('should apply different sanitization levels based on field names', () => {
            const data = {
                title: 'Document Title',
                htmlContent: '<p>Some <script>alert("XSS")</script> content</p>',
                templateVariable: '{{variable}}',
                secretKey: 'sensitive-data!@#',
                sections: [
                    {
                        title: 'Section 1',
                        content: '<div onclick="alert()">Test</div>'
                    }
                ],
                metadata: {
                    author: '<b>Author</b>',
                    password: 'p@$$w0rd!'
                }
            };
            
            const result = dataSanitizer.sanitizeDocumentData(data);
            
            // Check HTML sanitization
            expect(result.htmlContent).not.toContain('<script>');
            expect(result.htmlContent).not.toContain('alert("XSS")');
            
            // Check template variable sanitization
            expect(result.templateVariable).not.toContain('{{variable}}');
            
            // Check strict sanitization for sensitive fields
            expect(result.secretKey).not.toContain('!@#');
            expect(result.metadata.password).not.toContain('!');
            
            // Check recursive sanitization
            expect(result.sections[0].content).not.toContain('onclick=');
            expect(result.metadata.author).not.toContain('<b>');
        });
        
        test('should preserve data structure and non-string values', () => {
            const data = {
                title: 'Document',
                createdAt: new Date('2025-06-03'),
                version: 1.2,
                published: true,
                authors: ['Author 1', 'Author 2'],
                settings: {
                    isPublic: true,
                    viewCount: 42
                }
            };
            
            const result = dataSanitizer.sanitizeDocumentData(data);
            
            expect(result.createdAt).toEqual(data.createdAt);
            expect(result.version).toBe(1.2);
            expect(result.published).toBe(true);
            expect(result.authors).toHaveLength(2);
            expect(result.settings.isPublic).toBe(true);
            expect(result.settings.viewCount).toBe(42);
        });
    });
});
