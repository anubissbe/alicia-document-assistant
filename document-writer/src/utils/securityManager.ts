import * as vscode from 'vscode';
import * as path from 'path';
import * as crypto from 'crypto';
import * as fs from 'fs';
import { htmlSanitizer } from './htmlSanitizer';

/**
 * Options for path validation
 */
export interface PathValidationOptions {
    /**
     * List of allowed file extensions
     */
    allowedExtensions?: string[];
    
    /**
     * List of allowed base directories
     */
    allowedBaseDirs?: string[];
    
    /**
     * Whether to allow absolute paths
     */
    allowAbsolutePaths?: boolean;
    
    /**
     * Whether to allow path traversal
     */
    allowTraversal?: boolean;
    
    /**
     * Whether to enforce extension check
     */
    enforceExtension?: boolean;
}

/**
 * Result of path validation
 */
export interface PathValidationResult {
    /**
     * Whether the path is valid
     */
    valid: boolean;
    
    /**
     * Validation message (error or confirmation)
     */
    message: string;
    
    /**
     * Validation errors if any
     */
    errors?: string[];
}

/**
 * Configuration for encryption
 */
export interface EncryptionConfig {
    /**
     * Algorithm to use for encryption (default: aes-256-cbc)
     */
    algorithm?: string;
    
    /**
     * Initialization vector length (default: 16 bytes)
     */
    ivLength?: number;
    
    /**
     * Key derivation iterations (default: 10000)
     */
    iterations?: number;
    
    /**
     * Key length in bytes (default: 32)
     */
    keyLength?: number;
    
    /**
     * Hash algorithm for key derivation (default: sha256)
     */
    digest?: string;
}

/**
 * Stored credential item
 */
export interface StoredCredential {
    /**
     * When the credential was created
     */
    createdAt: number;
    
    /**
     * When the credential expires (if applicable)
     */
    expiresAt?: number;
    
    /**
     * The encrypted value
     */
    value: string;
    
    /**
     * Initialization vector used for encryption
     */
    iv: string;
    
    /**
     * Salt used for key derivation
     */
    salt: string;
    
    /**
     * Information about what type of credential this is
     */
    type: 'api-key' | 'password' | 'token' | 'certificate' | 'other';
    
    /**
     * Optional metadata
     */
    metadata?: Record<string, any>;
}

/**
 * SecurityManager provides centralized security services throughout the application
 * It handles input validation, sanitization, and secure storage operations
 */
export class SecurityManager {
    private context?: vscode.ExtensionContext;
    
    // Default allowed extensions
    private defaultAllowedExtensions: string[] = [
        '.docx', '.pdf', '.txt', '.json', '.md', '.html', '.xml', '.csv'
    ];
    
    // Default encryption configuration
    private defaultEncryptionConfig: EncryptionConfig = {
        algorithm: 'aes-256-cbc',
        ivLength: 16,
        iterations: 10000,
        keyLength: 32,
        digest: 'sha256'
    };
    
    // Master key identifier for the application
    private readonly MASTER_KEY_ID = 'document-writer-master-key';
    
    /**
     * Creates a new SecurityManager instance
     * @param context The extension context
     */
    constructor(context?: vscode.ExtensionContext) {
        this.context = context;
    }
    
    /**
     * Validates a file path against security constraints
     * @param filePath The path to validate
     * @param options Validation options
     * @returns Validation result
     */
    public validatePath(filePath: string, options: PathValidationOptions = {}): PathValidationResult {
        if (!filePath) {
            return {
                valid: false,
                message: 'Path cannot be empty',
                errors: ['Empty path provided']
            };
        }
        
        const errors: string[] = [];
        const normalizedPath = this.normalizePath(filePath);
        
        // Check if path is absolute when not allowed
        if (path.isAbsolute(normalizedPath) && options.allowAbsolutePaths === false) {
            errors.push('Absolute paths are not allowed');
        }
        
        // Check for path traversal attempts if not allowed
        if (!options.allowTraversal && this.containsPathTraversal(normalizedPath)) {
            errors.push('Path traversal is not allowed');
        }
        
        // Check file extension if enforced
        if (options.enforceExtension !== false) {
            const ext = path.extname(normalizedPath).toLowerCase();
            const allowedExts = options.allowedExtensions || this.defaultAllowedExtensions;
            
            if (!allowedExts.includes(ext)) {
                errors.push(`File extension "${ext}" is not allowed. Allowed extensions: ${allowedExts.join(', ')}`);
            }
        }
        
        // Check if path is within allowed directories if specified
        if (options.allowedBaseDirs && options.allowedBaseDirs.length > 0) {
            const isWithinAllowedDir = options.allowedBaseDirs.some(dir => {
                const normalizedDir = this.normalizePath(dir);
                return normalizedPath.startsWith(normalizedDir);
            });
            
            if (!isWithinAllowedDir) {
                errors.push('Path is not within allowed directories');
            }
        }
        
        // Return validation result
        if (errors.length > 0) {
            return {
                valid: false,
                message: errors[0],
                errors
            };
        }
        
        return {
            valid: true,
            message: 'Path validation successful'
        };
    }
    
    /**
     * Sanitizes a file path to prevent path traversal and other issues
     * @param filePath Path to sanitize
     * @param baseDir Base directory for resolving relative paths
     * @returns Sanitized path
     */
    public sanitizePath(filePath: string, baseDir: string = ''): string {
        if (!filePath) {
            return '';
        }
        
        // Normalize the path to handle different separators
        let normalizedPath = this.normalizePath(filePath);
        
        // Resolve relative paths
        if (!path.isAbsolute(normalizedPath) && baseDir) {
            normalizedPath = path.join(baseDir, normalizedPath);
        }
        
        // Remove any remaining relative components by converting to absolute and back
        const absolutePath = path.resolve(normalizedPath);
        
        // Make sure the path is within the baseDir if provided
        if (baseDir && !absolutePath.startsWith(this.normalizePath(baseDir))) {
            // If outside baseDir, return just the filename to prevent traversal
            return path.join(baseDir, path.basename(absolutePath));
        }
        
        return absolutePath;
    }
    
    /**
     * Sanitizes input to prevent XSS and injection attacks
     * @param input String to sanitize
     * @returns Sanitized string
     */
    public sanitizeInput(input: string): string {
        if (!input) {
            return '';
        }
        
        // Use the enhanced HTML sanitizer for comprehensive sanitization
        return htmlSanitizer.sanitizeUserInput(input);
    }

    /**
     * Sanitizes HTML content for use in webviews
     * @param html HTML content to sanitize
     * @returns Sanitized HTML
     */
    public sanitizeHtml(html: string): string {
        if (!html) {
            return '';
        }
        
        return htmlSanitizer.sanitizeHtml(html);
    }

    /**
     * Sanitizes template data recursively
     * @param data Template data to sanitize
     * @returns Sanitized data
     */
    public sanitizeTemplateData(data: any): any {
        return htmlSanitizer.sanitizeTemplateData(data);
    }

    /**
     * Generates a Content Security Policy for webviews
     * @param nonce Optional nonce for script/style sources
     * @returns CSP string
     */
    public generateWebviewCSP(nonce?: string): string {
        return htmlSanitizer.generateCSP(nonce);
    }
    
    /**
     * Stores sensitive data securely using VS Code's secret storage
     * @param key Key to store data under
     * @param value Value to store
     * @returns Promise that resolves when storage is complete
     */
    public async storeSecureData(key: string, value: string): Promise<void> {
        if (!key || !value) {
            throw new Error('Key and value must be provided for secure storage');
        }
        
        try {
            await this.context!.secrets.store(key, value);
        } catch (error) {
            console.error('Failed to store secure data:', error);
            throw new Error(`Failed to store secure data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Retrieves sensitive data from secure storage
     * @param key Key to retrieve
     * @returns Promise that resolves to the stored value or undefined if not found
     */
    public async getSecureData(key: string): Promise<string | undefined> {
        if (!key) {
            throw new Error('Key must be provided to retrieve secure data');
        }
        
        try {
            return await this.context!.secrets.get(key);
        } catch (error) {
            console.error('Failed to retrieve secure data:', error);
            throw new Error(`Failed to retrieve secure data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Deletes sensitive data from secure storage
     * @param key Key to delete
     * @returns Promise that resolves when deletion is complete
     */
    public async deleteSecureData(key: string): Promise<void> {
        if (!key) {
            throw new Error('Key must be provided to delete secure data');
        }
        
        try {
            await this.context!.secrets.delete(key);
        } catch (error) {
            console.error('Failed to delete secure data:', error);
            throw new Error(`Failed to delete secure data: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Stores an API key securely with encryption
     * @param serviceId Identifier for the service (e.g., 'github', 'openai')
     * @param apiKey The API key to store
     * @param expiryDays Optional number of days until the key expires
     * @param metadata Optional metadata about the API key
     * @returns Promise that resolves when storage is complete
     */
    public async storeApiKey(
        serviceId: string, 
        apiKey: string, 
        expiryDays?: number,
        metadata?: Record<string, any>
    ): Promise<void> {
        if (!serviceId || !apiKey) {
            throw new Error('Service ID and API key must be provided');
        }
        
        const storageKey = `api-key-${serviceId}`;
        const credential: StoredCredential = {
            createdAt: Date.now(),
            expiresAt: expiryDays ? Date.now() + (expiryDays * 24 * 60 * 60 * 1000) : undefined,
            type: 'api-key',
            metadata: metadata || {},
            value: '', // Will be set during encryption
            iv: '',    // Will be set during encryption
            salt: ''   // Will be set during encryption
        };
        
        await this.encryptAndStoreCredential(storageKey, apiKey, credential);
    }
    
    /**
     * Retrieves an API key that was stored securely
     * @param serviceId Identifier for the service
     * @returns Promise that resolves to the API key or undefined if not found or expired
     */
    public async getApiKey(serviceId: string): Promise<string | undefined> {
        const storageKey = `api-key-${serviceId}`;
        return this.getAndDecryptCredential(storageKey);
    }
    
    /**
     * Stores user credentials securely with encryption
     * @param service Name of the service or system
     * @param username Username
     * @param password Password
     * @param expiryDays Optional number of days until the credentials expire
     * @returns Promise that resolves when storage is complete
     */
    public async storeCredentials(
        service: string,
        username: string,
        password: string,
        expiryDays?: number
    ): Promise<void> {
        if (!service || !username || !password) {
            throw new Error('Service name, username, and password must be provided');
        }
        
        const storageKey = `credentials-${service}-${username}`;
        const credential: StoredCredential = {
            createdAt: Date.now(),
            expiresAt: expiryDays ? Date.now() + (expiryDays * 24 * 60 * 60 * 1000) : undefined,
            type: 'password',
            metadata: { username },
            value: '', // Will be set during encryption
            iv: '',    // Will be set during encryption
            salt: ''   // Will be set during encryption
        };
        
        await this.encryptAndStoreCredential(storageKey, password, credential);
    }
    
    /**
     * Retrieves user credentials that were stored securely
     * @param service Name of the service or system
     * @param username Username
     * @returns Promise that resolves to the password or undefined if not found or expired
     */
    public async getCredentials(service: string, username: string): Promise<string | undefined> {
        const storageKey = `credentials-${service}-${username}`;
        return this.getAndDecryptCredential(storageKey);
    }
    
    /**
     * Stores structured data (JSON object) securely with encryption
     * @param key Storage key
     * @param data Object to store
     * @param expiryDays Optional number of days until the data expires
     * @returns Promise that resolves when storage is complete
     */
    public async storeSecureObject<T>(key: string, data: T, expiryDays?: number): Promise<void> {
        if (!key || data === undefined) {
            throw new Error('Key and data object must be provided');
        }
        
        const jsonData = JSON.stringify(data);
        const storageKey = `secure-object-${key}`;
        const credential: StoredCredential = {
            createdAt: Date.now(),
            expiresAt: expiryDays ? Date.now() + (expiryDays * 24 * 60 * 60 * 1000) : undefined,
            type: 'other',
            value: '', // Will be set during encryption
            iv: '',    // Will be set during encryption
            salt: ''   // Will be set during encryption
        };
        
        await this.encryptAndStoreCredential(storageKey, jsonData, credential);
    }
    
    /**
     * Retrieves a structured data object that was stored securely
     * @param key Storage key
     * @returns Promise that resolves to the object or undefined if not found or expired
     */
    public async getSecureObject<T>(key: string): Promise<T | undefined> {
        const storageKey = `secure-object-${key}`;
        const jsonData = await this.getAndDecryptCredential(storageKey);
        
        if (!jsonData) {
            return undefined;
        }
        
        try {
            return JSON.parse(jsonData) as T;
        } catch (error) {
            console.error('Failed to parse secure object:', error);
            throw new Error(`Failed to parse secure object: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Rotates encryption keys and re-encrypts all stored data
     * This should be called periodically to enhance security
     * @returns Promise that resolves when key rotation is complete
     */
    public async rotateEncryptionKeys(): Promise<void> {
        try {
            // Generate a new master key
            const newMasterKey = crypto.randomBytes(32).toString('hex');
            
            // Get all stored keys
            const allKeys = await this.getAllStoredKeys();
            
            // Find all secure credential keys
            const credentialKeys = allKeys.filter(key => 
                key.startsWith('api-key-') || 
                key.startsWith('credentials-') ||
                key.startsWith('secure-object-')
            );
            
            // Re-encrypt each credential with the new key
            for (const key of credentialKeys) {
                // Get the credential using old key
                const rawData = await this.context!.secrets.get(key);
                if (!rawData) continue;
                
                const credential = JSON.parse(rawData) as StoredCredential;
                
                // Get the original value
                const value = await this.getAndDecryptCredential(key);
                if (!value) continue;
                
                // Store with new master key (temporarily store the new master key)
                await this.context!.secrets.store('temp-master-key', newMasterKey);
                const currentMasterKey = await this.context!.secrets.get(this.MASTER_KEY_ID);
                await this.context!.secrets.store(this.MASTER_KEY_ID, newMasterKey);
                
                // Re-encrypt with new master key
                await this.encryptAndStoreCredential(key, value, credential);
                
                // Restore the current master key
                if (currentMasterKey) {
                    await this.context!.secrets.store(this.MASTER_KEY_ID, currentMasterKey);
                }
            }
            
            // Finally update the master key
            await this.context!.secrets.store(this.MASTER_KEY_ID, newMasterKey);
            
            // Clean up
            await this.context!.secrets.delete('temp-master-key');
            
        } catch (error) {
            console.error('Failed to rotate encryption keys:', error);
            throw new Error(`Failed to rotate encryption keys: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Encrypts a value using a derived key
     * @param value Value to encrypt
     * @param salt Salt for key derivation
     * @param config Encryption configuration
     * @returns Encrypted data with IV
     */
    private async encrypt(
        value: string, 
        salt: Buffer, 
        config: EncryptionConfig = this.defaultEncryptionConfig
    ): Promise<{ encrypted: Buffer, iv: Buffer }> {
        // Get master encryption key
        const masterKey = await this.getMasterKey();
        
        // Derive encryption key from master key
        const key = crypto.pbkdf2Sync(
            masterKey,
            salt,
            config.iterations || this.defaultEncryptionConfig.iterations!,
            config.keyLength || this.defaultEncryptionConfig.keyLength!,
            config.digest || this.defaultEncryptionConfig.digest!
        );
        
        // Generate random IV
        const iv = crypto.randomBytes(config.ivLength || this.defaultEncryptionConfig.ivLength!);
        
        // Create cipher and encrypt
        const cipher = crypto.createCipheriv(
            config.algorithm || this.defaultEncryptionConfig.algorithm!,
            key,
            iv
        );
        
        const encrypted = Buffer.concat([
            cipher.update(Buffer.from(value, 'utf8')),
            cipher.final()
        ]);
        
        return { encrypted, iv };
    }
    
    /**
     * Decrypts a value using a derived key
     * @param encrypted Encrypted data
     * @param iv Initialization vector
     * @param salt Salt used for key derivation
     * @param config Encryption configuration
     * @returns Decrypted value
     */
    private async decrypt(
        encrypted: Buffer,
        iv: Buffer,
        salt: Buffer,
        config: EncryptionConfig = this.defaultEncryptionConfig
    ): Promise<string> {
        // Get master encryption key
        const masterKey = await this.getMasterKey();
        
        // Derive encryption key from master key
        const key = crypto.pbkdf2Sync(
            masterKey,
            salt,
            config.iterations || this.defaultEncryptionConfig.iterations!,
            config.keyLength || this.defaultEncryptionConfig.keyLength!,
            config.digest || this.defaultEncryptionConfig.digest!
        );
        
        // Create decipher and decrypt
        const decipher = crypto.createDecipheriv(
            config.algorithm || this.defaultEncryptionConfig.algorithm!,
            key,
            iv
        );
        
        const decrypted = Buffer.concat([
            decipher.update(encrypted),
            decipher.final()
        ]);
        
        return decrypted.toString('utf8');
    }
    
    /**
     * Gets or creates a master encryption key
     * @returns Master key
     */
    private async getMasterKey(): Promise<string> {
        // Try to get existing master key
        let masterKey = await this.context!.secrets.get(this.MASTER_KEY_ID);
        
        // If no master key exists, create one
        if (!masterKey) {
            masterKey = crypto.randomBytes(32).toString('hex');
            await this.context!.secrets.store(this.MASTER_KEY_ID, masterKey);
        }
        
        return masterKey;
    }
    
    /**
     * Encrypts a credential and stores it
     * @param key Storage key
     * @param value Value to encrypt
     * @param credential Credential object to update with encryption details
     */
    private async encryptAndStoreCredential(
        key: string, 
        value: string, 
        credential: StoredCredential
    ): Promise<void> {
        try {
            // Generate random salt
            const salt = crypto.randomBytes(16);
            
            // Encrypt the value
            const { encrypted, iv } = await this.encrypt(value, salt);
            
            // Update credential with encryption details
            credential.value = encrypted.toString('base64');
            credential.iv = iv.toString('base64');
            credential.salt = salt.toString('base64');
            
            // Store the credential
            await this.context!.secrets.store(key, JSON.stringify(credential));
        } catch (error) {
            console.error('Failed to encrypt and store credential:', error);
            throw new Error(`Failed to encrypt and store credential: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Retrieves and decrypts a credential
     * @param key Storage key
     * @returns Decrypted value or undefined if not found or expired
     */
    private async getAndDecryptCredential(key: string): Promise<string | undefined> {
        try {
            // Get the stored credential
            const rawData = await this.context!.secrets.get(key);
            if (!rawData) {
                return undefined;
            }
            
            // Parse the credential
            const credential = JSON.parse(rawData) as StoredCredential;
            
            // Check if credential has expired
            if (credential.expiresAt && credential.expiresAt < Date.now()) {
                // Automatically delete expired credentials
                await this.context!.secrets.delete(key);
                return undefined;
            }
            
            // Decrypt the value
            return await this.decrypt(
                Buffer.from(credential.value, 'base64'),
                Buffer.from(credential.iv, 'base64'),
                Buffer.from(credential.salt, 'base64')
            );
        } catch (error) {
            console.error('Failed to get and decrypt credential:', error);
            throw new Error(`Failed to get and decrypt credential: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Gets all keys stored in the secret storage
     * @returns Array of keys
     */
    private async getAllStoredKeys(): Promise<string[]> {
        try {
            // This is a workaround since VS Code API doesn't provide a direct way to list all keys
            // We'll use reflection to access the underlying storage if possible
            
            // Try to access the storage directly - this may not work in all VS Code versions
            const secretStorage = (this.context!.secrets as any)._storage;
            if (secretStorage && typeof secretStorage.getKeys === 'function') {
                return await secretStorage.getKeys();
            }
            
            // If direct access is not available, return an empty array
            // In a real implementation, you might want to maintain a separate index of keys
            console.warn('Unable to list all stored keys - direct access to secret storage not available');
            return [];
        } catch (error) {
            console.error('Failed to get all stored keys:', error);
            return [];
        }
    }
    
    /**
     * Generates a cryptographic hash for integrity checking
     * @param data Data to hash
     * @param algorithm Hash algorithm to use (default: sha256)
     * @returns Hex-encoded hash
     */
    public generateHash(data: string | Buffer, algorithm: string = 'sha256'): string {
        return crypto.createHash(algorithm).update(data).digest('hex');
    }
    
    /**
     * Verifies the integrity of data against a hash
     * @param data Data to verify
     * @param hash Hash to verify against
     * @param algorithm Hash algorithm used (default: sha256)
     * @returns Whether the data matches the hash
     */
    public verifyIntegrity(data: string | Buffer, hash: string, algorithm: string = 'sha256'): boolean {
        const computedHash = this.generateHash(data, algorithm);
        return computedHash === hash;
    }
    
    /**
     * Generates a random token for various security purposes
     * @param length Length of the token (default: 32)
     * @returns Random token
     */
    public generateToken(length: number = 32): string {
        return crypto.randomBytes(length).toString('hex');
    }
    
    /**
     * Normalizes a path for consistent handling
     * @param filePath Path to normalize
     * @returns Normalized path
     */
    private normalizePath(filePath: string): string {
        // Convert to posix path for consistent handling
        return filePath.replace(/\\/g, '/');
    }
    
    /**
     * Checks if a path contains traversal patterns
     * @param filePath Path to check
     * @returns Whether the path contains traversal
     */
    private containsPathTraversal(filePath: string): boolean {
        // Check for path traversal patterns
        const normalizedPath = this.normalizePath(filePath);
        
        // Check for sequences that could lead to path traversal
        const traversalPatterns = [
            '../', '..\\', // Parent directory references
            '/./', '\\.\\'  // Current directory references that might be used to obfuscate
        ];
        
        return traversalPatterns.some(pattern => normalizedPath.includes(pattern));
    }
}
