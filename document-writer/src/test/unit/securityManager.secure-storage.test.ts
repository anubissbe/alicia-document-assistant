import * as vscode from 'vscode';
import { SecurityManager } from '../../utils/securityManager';
import * as crypto from 'crypto';

// Mock VS Code extension context
const mockContext = {
    subscriptions: [],
    workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([])
    } as any,
    globalState: {
        get: jest.fn(),
        update: jest.fn(),
        setKeysForSync: jest.fn(),
        keys: jest.fn().mockReturnValue([])
    } as any,
    extensionPath: '',
    storagePath: '',
    globalStoragePath: '',
    logPath: '',
    extensionUri: {} as vscode.Uri,
    storageUri: {} as vscode.Uri,
    globalStorageUri: {} as vscode.Uri,
    logUri: {} as vscode.Uri,
    extension: {} as vscode.Extension<any>,
    languageModelAccessInformation: {
        token: '',
        availableModels: [],
        onDidChange: jest.fn(),
        canSendRequest: jest.fn()
    } as any as vscode.LanguageModelAccessInformation,
    environmentVariableCollection: {
        getScoped: jest.fn(),
        persistent: true,
        replace: jest.fn(),
        append: jest.fn(),
        prepend: jest.fn(),
        get: jest.fn(),
        forEach: jest.fn(),
        clear: jest.fn(),
        delete: jest.fn()
    } as any,
    asAbsolutePath: jest.fn(),
    extensionMode: vscode.ExtensionMode.Test,
    secrets: {
        store: jest.fn().mockResolvedValue(undefined),
        get: jest.fn(),
        delete: jest.fn().mockResolvedValue(undefined),
        onDidChange: jest.fn()
    }
};

describe('SecurityManager - Secure Storage', () => {
    let securityManager: SecurityManager;
    
    beforeEach(() => {
        jest.clearAllMocks();
        
        // Reset the mocked secrets implementation for each test
        const secretsStorage = new Map<string, string>();
        
        // Mock the store method
        (mockContext.secrets.store as jest.Mock).mockImplementation(
            async (key: string, value: string) => {
                secretsStorage.set(key, value);
                return Promise.resolve();
            }
        );
        
        // Mock the get method
        (mockContext.secrets.get as jest.Mock).mockImplementation(
            async (key: string) => {
                return Promise.resolve(secretsStorage.get(key));
            }
        );
        
        // Mock the delete method
        (mockContext.secrets.delete as jest.Mock).mockImplementation(
            async (key: string) => {
                secretsStorage.delete(key);
                return Promise.resolve();
            }
        );
        
        securityManager = new SecurityManager(mockContext);
    });
    
    describe('Basic secure storage', () => {
        it('should store and retrieve secure data', async () => {
            const key = 'test-key';
            const value = 'test-value';
            
            await securityManager.storeSecureData(key, value);
            const retrieved = await securityManager.getSecureData(key);
            
            expect(retrieved).toBe(value);
            expect(mockContext.secrets.store).toHaveBeenCalledWith(key, value);
            expect(mockContext.secrets.get).toHaveBeenCalledWith(key);
        });
        
        it('should delete secure data', async () => {
            const key = 'test-key';
            const value = 'test-value';
            
            await securityManager.storeSecureData(key, value);
            await securityManager.deleteSecureData(key);
            const retrieved = await securityManager.getSecureData(key);
            
            expect(retrieved).toBeUndefined();
            expect(mockContext.secrets.delete).toHaveBeenCalledWith(key);
        });
        
        it('should throw error when storing with empty key', async () => {
            await expect(securityManager.storeSecureData('', 'value'))
                .rejects.toThrow('Key and value must be provided');
        });
        
        it('should throw error when retrieving with empty key', async () => {
            await expect(securityManager.getSecureData(''))
                .rejects.toThrow('Key must be provided');
        });
    });
    
    describe('API key management', () => {
        it('should store and retrieve API keys', async () => {
            const serviceId = 'github';
            const apiKey = 'ghp_123456789abcdef';
            
            await securityManager.storeApiKey(serviceId, apiKey);
            const retrieved = await securityManager.getApiKey(serviceId);
            
            expect(retrieved).toBe(apiKey);
        });
        
        it('should store API key with metadata', async () => {
            const serviceId = 'github';
            const apiKey = 'ghp_123456789abcdef';
            const metadata = { username: 'testuser', scopes: ['repo', 'user'] };
            
            await securityManager.storeApiKey(serviceId, apiKey, undefined, metadata);
            
            // Verify the API key was stored
            const retrieved = await securityManager.getApiKey(serviceId);
            expect(retrieved).toBe(apiKey);
            
            // Check that a call was made to store with the expected storage key
            expect(mockContext.secrets.store).toHaveBeenCalled();
            const storageKey = `api-key-${serviceId}`;
            expect(mockContext.secrets.store).toHaveBeenCalledWith(
                storageKey,
                expect.any(String) // We can't check the exact encrypted value
            );
        });
        
        it('should throw error when storing API key with empty service ID', async () => {
            await expect(securityManager.storeApiKey('', 'key-value'))
                .rejects.toThrow('Service ID and API key must be provided');
        });
    });
    
    describe('Credentials management', () => {
        it('should store and retrieve credentials', async () => {
            const service = 'test-service';
            const username = 'testuser';
            const password = 'p@ssw0rd';
            
            await securityManager.storeCredentials(service, username, password);
            const retrieved = await securityManager.getCredentials(service, username);
            
            expect(retrieved).toBe(password);
        });
        
        it('should throw error when storing credentials with missing parameters', async () => {
            await expect(securityManager.storeCredentials('service', '', 'password'))
                .rejects.toThrow('Service name, username, and password must be provided');
        });
    });
    
    describe('Secure object storage', () => {
        it('should store and retrieve objects', async () => {
            const key = 'test-object';
            const data = { 
                name: 'Test Object',
                properties: {
                    color: 'blue',
                    size: 42,
                    enabled: true
                },
                tags: ['test', 'sample', 'demo']
            };
            
            await securityManager.storeSecureObject(key, data);
            const retrieved = await securityManager.getSecureObject(key);
            
            expect(retrieved).toEqual(data);
        });
        
        it('should throw error when storing object with empty key', async () => {
            await expect(securityManager.storeSecureObject('', { test: 'value' }))
                .rejects.toThrow('Key and data object must be provided');
        });
    });
    
    describe('Expiration functionality', () => {
        // Mock the Date.now() function to control time
        const realDateNow = Date.now;
        const mockNow = jest.fn();
        
        beforeEach(() => {
            global.Date.now = mockNow;
        });
        
        afterEach(() => {
            global.Date.now = realDateNow;
        });
        
        it('should respect expiration when retrieving API keys', async () => {
            // Start at a specific time
            mockNow.mockReturnValue(1000);
            
            const serviceId = 'github';
            const apiKey = 'ghp_123456789abcdef';
            
            // Store with 1 day expiry
            await securityManager.storeApiKey(serviceId, apiKey, 1);
            
            // Still within expiry
            mockNow.mockReturnValue(1000 + 12 * 60 * 60 * 1000); // 12 hours later
            let retrieved = await securityManager.getApiKey(serviceId);
            expect(retrieved).toBe(apiKey);
            
            // Beyond expiry
            mockNow.mockReturnValue(1000 + 25 * 60 * 60 * 1000); // 25 hours later
            retrieved = await securityManager.getApiKey(serviceId);
            expect(retrieved).toBeUndefined();
        });
    });
    
    describe('Error handling', () => {
        it('should handle errors when storing data', async () => {
            (mockContext.secrets.store as jest.Mock).mockRejectedValueOnce(new Error('Storage error'));
            
            await expect(securityManager.storeSecureData('key', 'value'))
                .rejects.toThrow('Failed to store secure data: Storage error');
        });
        
        it('should handle errors when retrieving data', async () => {
            (mockContext.secrets.get as jest.Mock).mockRejectedValueOnce(new Error('Retrieval error'));
            
            await expect(securityManager.getSecureData('key'))
                .rejects.toThrow('Failed to retrieve secure data: Retrieval error');
        });
    });
});
