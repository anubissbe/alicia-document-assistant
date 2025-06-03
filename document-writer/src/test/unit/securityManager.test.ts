import * as vscode from 'vscode';
import * as path from 'path';
import { SecurityManager, PathValidationOptions } from '../../utils/securityManager';

// Mock modules
jest.mock('vscode');

describe('SecurityManager', () => {
    let securityManager: SecurityManager;
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
        
        // Create SecurityManager instance
        securityManager = new SecurityManager(mockContext);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('validatePath', () => {
        test('should reject empty paths', () => {
            const result = securityManager.validatePath('');
            
            expect(result.valid).toBe(false);
            expect(result.message).toContain('empty');
            expect(result.errors).toHaveLength(1);
        });
        
        test('should validate paths with allowed extensions', () => {
            const validPath = 'test/path/file.docx';
            const result = securityManager.validatePath(validPath);
            
            expect(result.valid).toBe(true);
            expect(result.message).toContain('successful');
        });
        
        test('should reject paths with disallowed extensions', () => {
            const invalidPath = 'test/path/file.exe';
            const result = securityManager.validatePath(invalidPath);
            
            expect(result.valid).toBe(false);
            expect(result.message).toContain('extension');
            expect(result.errors?.[0]).toContain('.exe');
        });
        
        test('should handle custom allowed extensions', () => {
            const options: PathValidationOptions = {
                allowedExtensions: ['.custom', '.ext']
            };
            
            const validPath = 'test/path/file.custom';
            const invalidPath = 'test/path/file.docx';
            
            const validResult = securityManager.validatePath(validPath, options);
            const invalidResult = securityManager.validatePath(invalidPath, options);
            
            expect(validResult.valid).toBe(true);
            expect(invalidResult.valid).toBe(false);
        });
        
        test('should detect path traversal attempts', () => {
            const traversalPaths = [
                '../outside/file.txt',
                'folder/../../outside/file.txt',
                'folder/./../outside/file.txt'
            ];
            
            traversalPaths.forEach(traversalPath => {
                const result = securityManager.validatePath(traversalPath);
                expect(result.valid).toBe(false);
                expect(result.message).toContain('traversal');
            });
        });
        
        test('should allow path traversal when explicitly permitted', () => {
            const traversalPath = '../outside/file.docx';
            const options: PathValidationOptions = {
                allowTraversal: true
            };
            
            const result = securityManager.validatePath(traversalPath, options);
            
            expect(result.valid).toBe(true);
        });
        
        test('should validate against allowed base directories', () => {
            const baseDirs = ['/safe/dir1', '/safe/dir2'];
            const options: PathValidationOptions = {
                allowedBaseDirs: baseDirs,
                allowAbsolutePaths: true
            };
            
            const validPath = '/safe/dir1/file.docx';
            const invalidPath = '/unsafe/dir/file.docx';
            
            const validResult = securityManager.validatePath(validPath, options);
            const invalidResult = securityManager.validatePath(invalidPath, options);
            
            expect(validResult.valid).toBe(true);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.message).toContain('not within allowed directories');
        });
        
        test('should handle absolute paths based on configuration', () => {
            const absolutePath = path.resolve('/absolute/path/file.docx');
            
            const allowedResult = securityManager.validatePath(absolutePath, { 
                allowAbsolutePaths: true 
            });
            
            const disallowedResult = securityManager.validatePath(absolutePath, { 
                allowAbsolutePaths: false 
            });
            
            expect(allowedResult.valid).toBe(true);
            expect(disallowedResult.valid).toBe(false);
            expect(disallowedResult.message).toContain('Absolute paths are not allowed');
        });
    });
    
    describe('sanitizePath', () => {
        test('should handle empty paths', () => {
            expect(securityManager.sanitizePath('')).toBe('');
            expect(securityManager.sanitizePath(null as unknown as string)).toBe('');
            expect(securityManager.sanitizePath(undefined as unknown as string)).toBe('');
        });
        
        test('should normalize path separators', () => {
            const mixedPath = 'folder\\subfolder/file.txt';
            const result = securityManager.sanitizePath(mixedPath);
            
            // The exact result will depend on the platform, but we can check normalization occurred
            expect(result).not.toContain('\\subfolder/');
        });
        
        test('should resolve paths relative to base directory', () => {
            const baseDir = '/base/dir';
            const relativePath = 'subfolder/file.txt';
            
            const result = securityManager.sanitizePath(relativePath, baseDir);
            
            expect(result).toContain('base');
            expect(result).toContain('dir');
            expect(result).toContain('subfolder');
            expect(result).toContain('file.txt');
        });
        
        test('should prevent path traversal outside base directory', () => {
            const baseDir = '/safe/dir';
            const traversalPath = '../unsafe/file.txt';
            
            const result = securityManager.sanitizePath(traversalPath, baseDir);
            
            // Should be sanitized to stay within baseDir
            expect(result).toContain('safe');
            expect(result).toContain('dir');
            expect(result).not.toContain('unsafe');
            // Should just include the filename
            expect(result).toContain('file.txt');
        });
    });
    
    describe('sanitizeInput', () => {
        test('should handle empty inputs', () => {
            expect(securityManager.sanitizeInput('')).toBe('');
            expect(securityManager.sanitizeInput(null as unknown as string)).toBe('');
            expect(securityManager.sanitizeInput(undefined as unknown as string)).toBe('');
        });
        
        test('should encode HTML special characters', () => {
            const input = '<script>alert("XSS");</script>';
            const result = securityManager.sanitizeInput(input);
            
            expect(result).toBe('&lt;script&gt;alert(&quot;XSS&quot;);&lt;/script&gt;');
            expect(result).not.toContain('<script>');
            expect(result).not.toContain('</script>');
        });
        
        test('should handle mixed content', () => {
            const input = 'Normal text with <tags> and "quotes" and \'apostrophes\'';
            const result = securityManager.sanitizeInput(input);
            
            expect(result).toContain('Normal text with');
            expect(result).toContain('&lt;tags&gt;');
            expect(result).toContain('&quot;quotes&quot;');
            expect(result).toContain('&#39;apostrophes&#39;');
        });
    });
    
    describe('secure storage operations', () => {
        test('storeSecureData should store data in secret storage', async () => {
            await securityManager.storeSecureData('testKey', 'testValue');
            
            expect(mockSecretStorage.store).toHaveBeenCalledWith('testKey', 'testValue');
        });
        
        test('storeSecureData should reject empty key or value', async () => {
            await expect(securityManager.storeSecureData('', 'value')).rejects.toThrow('Key and value');
            await expect(securityManager.storeSecureData('key', '')).rejects.toThrow('Key and value');
        });
        
        test('getSecureData should retrieve data from secret storage', async () => {
            const result = await securityManager.getSecureData('testKey');
            
            expect(mockSecretStorage.get).toHaveBeenCalledWith('testKey');
            expect(result).toBe('secret-testKey');
        });
        
        test('getSecureData should reject empty key', async () => {
            await expect(securityManager.getSecureData('')).rejects.toThrow('Key must be provided');
        });
        
        test('deleteSecureData should remove data from secret storage', async () => {
            await securityManager.deleteSecureData('testKey');
            
            expect(mockSecretStorage.delete).toHaveBeenCalledWith('testKey');
        });
        
        test('deleteSecureData should reject empty key', async () => {
            await expect(securityManager.deleteSecureData('')).rejects.toThrow('Key must be provided');
        });
    });
    
    describe('crypto operations', () => {
        test('generateHash should create consistent hashes', () => {
            const data = 'test data';
            const hash1 = securityManager.generateHash(data);
            const hash2 = securityManager.generateHash(data);
            
            expect(hash1).toBe(hash2);
            expect(hash1.length).toBeGreaterThan(0);
        });
        
        test('verifyIntegrity should confirm matching data', () => {
            const data = 'test data';
            const hash = securityManager.generateHash(data);
            
            expect(securityManager.verifyIntegrity(data, hash)).toBe(true);
        });
        
        test('verifyIntegrity should reject non-matching data', () => {
            const data1 = 'test data';
            const data2 = 'different data';
            const hash = securityManager.generateHash(data1);
            
            expect(securityManager.verifyIntegrity(data2, hash)).toBe(false);
        });
        
        test('generateToken should create random tokens', () => {
            const token1 = securityManager.generateToken();
            const token2 = securityManager.generateToken();
            
            expect(token1).not.toBe(token2);
            expect(token1.length).toBe(64); // 32 bytes = 64 hex chars
        });
        
        test('generateToken should respect length parameter', () => {
            const token = securityManager.generateToken(16);
            
            expect(token.length).toBe(32); // 16 bytes = 32 hex chars
        });
    });
});
