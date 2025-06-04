import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { SecurityManager } from '../../utils/securityManager';

// Mock modules
jest.mock('vscode');
jest.mock('fs');
jest.mock('path');

describe('Path Traversal Prevention', () => {
    let securityManager: SecurityManager;
    let mockContext: vscode.ExtensionContext;
    let mockSecretStorage: vscode.SecretStorage;
    let mockGlobalState: any;
    
    // Prepare mocks
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
        
        // Mock path functions
        (path.normalize as jest.Mock).mockImplementation((p: string) => p);
        (path.isAbsolute as jest.Mock).mockImplementation((p: string) => p.startsWith('/') || /^[A-Z]:\\/i.test(p));
        (path.join as jest.Mock).mockImplementation((...segments: string[]) => segments.join('/'));
        
        // Create SecurityManager instance
        securityManager = new SecurityManager(mockContext);
    });
    
    afterEach(() => {
        jest.clearAllMocks();
    });
    
    describe('Path Traversal Detection', () => {
        test('should detect basic path traversal attempts', () => {
            // Test various path traversal patterns
            const traversalPatterns = [
                '../file.txt',
                '../../file.txt',
                '/path/to/../../file.txt',
                './../../file.txt',
                'folder/../../../file.txt',
                'folder/subfolder/../../file.txt',
                'C:\\path\\..\\..\\file.txt',
                '..%2Ffile.txt',
                '%2e%2e%2ffile.txt',
                '\\..\\file.txt'
            ];
            
            traversalPatterns.forEach(pattern => {
                const result = securityManager.validatePath(pattern);
                expect(result.valid).toBeFalsy();
                expect(result.message).toContain('Path traversal is not allowed');
            });
        });
        
        test('should handle URL-encoded path traversal attempts', () => {
            // Mock path.normalize to decode URL encoding for this test
            (path.normalize as jest.Mock).mockImplementationOnce((p: string) => {
                return p.replace(/%2e/gi, '.').replace(/%2f/gi, '/');
            });
            
            const result = securityManager.validatePath('%2e%2e%2ffile.txt');
            expect(result.valid).toBeFalsy();
            expect(result.message).toContain('Path traversal is not allowed');
        });
        
        test('should allow legitimate paths that contain .. as part of names', () => {
            // Test paths that contain .. but are not path traversal
            const legitimatePaths = [
                'file..txt',
                'my..folder/file.txt',
                'folder/file..with..dots.txt',
                'folder..name/file.txt'
            ];
            
            // Mock normalize to return the exact path to avoid detecting .. in these paths
            (path.normalize as jest.Mock).mockImplementation((p: string) => {
                // For this test, we simulate normalize by ensuring there's no path traversal
                // but preserving '..' within filenames/directories
                if (p.includes('../') || p.includes('..\\')) {
                    return p; // This would contain a real traversal
                }
                return p; // No traversal, just .. in names
            });
            
            legitimatePaths.forEach(pattern => {
                const result = securityManager.validatePath(pattern);
                expect(result.valid).toBeTruthy();
            });
        });
        
        test('should allow path traversal when explicitly permitted', () => {
            const traversalPaths = [
                '../file.txt',
                '../../file.txt',
                'folder/../file.txt'
            ];
            
            traversalPaths.forEach(pattern => {
                const result = securityManager.validatePath(pattern, { allowTraversal: true });
                expect(result.valid).toBeTruthy();
            });
        });
    });
    
    describe('Path Sanitization', () => {
        test('should remove path traversal segments', () => {
            const traversalPaths = [
                '../file.txt',
                '../../file.txt',
                '/path/to/../../file.txt',
                './../../file.txt',
                'folder/../../../file.txt'
            ];
            
            traversalPaths.forEach(pattern => {
                const sanitized = securityManager.sanitizePath(pattern, '/base/dir');
                expect(sanitized).not.toContain('../');
                expect(sanitized).not.toContain('..\\');
            });
        });
        
        test('should handle complex path traversal attempts', () => {
            const complexTraversalPaths = [
                '../././../file.txt',
                'folder/./subfolder/../.././file.txt',
                './folder/../../file.txt'
            ];
            
            complexTraversalPaths.forEach(pattern => {
                const sanitized = securityManager.sanitizePath(pattern, '/base/dir');
                expect(sanitized).not.toContain('../');
                expect(sanitized).not.toContain('..\\');
            });
        });
        
        test('should make relative paths absolute', () => {
            // Setup mock
            (path.isAbsolute as jest.Mock).mockReturnValue(false);
            (path.join as jest.Mock).mockReturnValue('/base/dir/relative/path.txt');
            
            const sanitized = securityManager.sanitizePath('relative/path.txt', '/base/dir');
            expect(sanitized).toBe('/base/dir/relative/path.txt');
        });
        
        test('should handle URL-encoded path traversal attempts', () => {
            // Setup mock to handle URL encoded characters
            (path.normalize as jest.Mock).mockImplementationOnce((p: string) => {
                return p.replace(/%2e/gi, '.').replace(/%2f/gi, '/');
            });
            
            const sanitized = securityManager.sanitizePath('%2e%2e%2ffile.txt', '/base/dir');
            expect(sanitized).not.toContain('../');
            expect(sanitized).not.toContain('..\\');
            expect(sanitized).not.toContain('%2e%2e%2f');
        });
    });
    
    describe('Advanced Path Traversal Scenarios', () => {
        test('should handle mixed forward and backslash traversal attempts', () => {
            const mixedPaths = [
                '..\\..\\file.txt',
                '../..\\file.txt',
                '..\\../file.txt'
            ];
            
            mixedPaths.forEach(pattern => {
                const result = securityManager.validatePath(pattern);
                expect(result.valid).toBeFalsy();
                expect(result.message).toContain('Path traversal is not allowed');
                
                const sanitized = securityManager.sanitizePath(pattern, '/base/dir');
                expect(sanitized).not.toContain('../');
                expect(sanitized).not.toContain('..\\');
            });
        });
        
        test('should handle null byte injection attempts', () => {
            // Mock normalize to simulate null byte handling
            (path.normalize as jest.Mock).mockImplementationOnce((p: string) => {
                return p.replace(/\0/g, '');
            });
            
            const nullBytePath = 'safe/path\0/../malicious.txt';
            
            const result = securityManager.validatePath(nullBytePath);
            // After normalization, this would contain '../' and should be detected
            expect(result.valid).toBeFalsy();
            
            const sanitized = securityManager.sanitizePath(nullBytePath, '/base/dir');
            expect(sanitized).not.toContain('../');
            expect(sanitized).not.toContain('\0');
        });
        
        test('should handle excessive directory traversal', () => {
            // Try to traverse beyond the root
            const excessiveTraversal = '../../../../../../../../../etc/passwd';
            
            const result = securityManager.validatePath(excessiveTraversal);
            expect(result.valid).toBeFalsy();
            
            const sanitized = securityManager.sanitizePath(excessiveTraversal, '/base/dir');
            expect(sanitized).not.toContain('../');
            // Should resolve to something safe in the base dir
            expect(sanitized).toContain('/base/dir');
        });
    });
    
    describe('Combined Path Security Measures', () => {
        test('should validate and then sanitize paths', () => {
            // This test simulates a real-world usage pattern where paths are first
            // validated and then sanitized if they will be used
            
            const paths = [
                { path: 'safe/path.txt', expected: true },
                { path: '../unsafe/path.txt', expected: false },
                { path: 'safe/../unsafe.txt', expected: false },
                { path: 'folder/subfolder/file.txt', expected: true }
            ];
            
            for (const { path: testPath, expected } of paths) {
                const validationResult = securityManager.validatePath(testPath);
                expect(validationResult.valid).toBe(expected);
                
                // If valid, ensure sanitization preserves the essential path
                if (expected) {
                    const sanitized = securityManager.sanitizePath(testPath, '/base/dir');
                    expect(sanitized).toContain('file.txt');
                }
                // If invalid due to traversal, ensure sanitization removes the traversal
                else if (testPath.includes('..')) {
                    const sanitized = securityManager.sanitizePath(testPath, '/base/dir');
                    expect(sanitized).not.toContain('../');
                    expect(sanitized).not.toContain('..\\');
                }
            }
        });
        
        test('should handle paths with allowed base directories', () => {
            // Setup mock
            (path.normalize as jest.Mock).mockImplementation((p: string) => p);
            
            const validationOptions = {
                allowedBaseDirs: ['/safe/dir1', '/safe/dir2']
            };
            
            const paths = [
                { path: '/safe/dir1/file.txt', expected: true },
                { path: '/safe/dir2/subdir/file.txt', expected: true },
                { path: '/unsafe/dir/file.txt', expected: false },
                { path: '/safe/dir1/../dir3/file.txt', expected: false } // traversal
            ];
            
            for (const { path: testPath, expected } of paths) {
                // Simulate path.normalize properly for path matching
                (path.normalize as jest.Mock).mockReturnValueOnce(testPath);
                
                const result = securityManager.validatePath(testPath, validationOptions);
                expect(result.valid).toBe(expected);
            }
        });
    });
});
