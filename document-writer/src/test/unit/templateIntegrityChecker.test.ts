/**
 * Unit tests for the TemplateIntegrityChecker class
 * 
 * These tests verify the functionality of the template integrity verification system,
 * which is responsible for ensuring templates are valid, trusted, and have not been
 * tampered with through various cryptographic checks.
 * 
 * @group Unit
 * @group Security
 */

import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { TemplateIntegrityChecker } from '../../utils/templateIntegrityChecker';
import { SecurityManager } from '../../utils/securityManager';
import { PathSafetyUtils } from '../../utils/pathSafetyUtils';

/**
 * Mock dependencies for isolated testing
 * - fs.promises: For file operations simulation
 * - crypto: For cryptographic operations simulation
 * - SecurityManager: For path validation
 */
jest.mock('fs', () => ({
    promises: {
        readFile: jest.fn(),
        writeFile: jest.fn(),
        access: jest.fn()
    }
}));

jest.mock('crypto', () => ({
    createHash: jest.fn(),
    createSign: jest.fn(),
    createVerify: jest.fn()
}));

jest.mock('../../utils/pathSafetyUtils');
jest.mock('../../utils/securityManager');

/**
 * Test suite for the TemplateIntegrityChecker class
 * 
 * Tests cover:
 * - Checksum calculation and verification
 * - Signature generation and verification
 * - Trusted source management
 * - Comprehensive template integrity validation
 */
describe('TemplateIntegrityChecker', () => {
    /**
     * Test fixtures and mocks
     */
    let templateChecker: TemplateIntegrityChecker;
    let mockSecurityManager: jest.Mocked<SecurityManager>;
    let mockCreateHash: jest.Mock;
    let mockDigest: jest.Mock;
    let mockUpdate: jest.Mock;
    let mockCreateSign: jest.Mock;
    let mockSign: jest.Mock;
    let mockCreateVerify: jest.Mock;
    let mockVerify: jest.Mock;

    /**
     * Set up test environment before each test
     * - Reset all mocks
     * - Configure mock implementations
     * - Initialize the TemplateIntegrityChecker with mocked dependencies
     */
    beforeEach(() => {
        jest.clearAllMocks();

        // Setup security manager mock with a mocked extension context
        const mockContext = {
            secrets: {
                store: jest.fn(),
                get: jest.fn(),
                delete: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        
        mockSecurityManager = new SecurityManager(mockContext) as jest.Mocked<SecurityManager>;
        mockSecurityManager.validatePath = jest.fn().mockReturnValue({ valid: true, message: '' });

        // Setup crypto mocks
        mockDigest = jest.fn().mockReturnValue('mocked-hash-value');
        mockUpdate = jest.fn().mockReturnThis();
        mockCreateHash = jest.fn().mockReturnValue({
            update: mockUpdate,
            digest: mockDigest
        });
        (crypto.createHash as jest.Mock) = mockCreateHash;

        mockSign = jest.fn().mockReturnValue('mocked-signature');
        mockCreateSign = jest.fn().mockReturnValue({
            update: mockUpdate,
            sign: mockSign
        });
        (crypto.createSign as jest.Mock) = mockCreateSign;

        mockVerify = jest.fn().mockReturnValue(true);
        mockCreateVerify = jest.fn().mockReturnValue({
            update: mockUpdate,
            verify: mockVerify
        });
        (crypto.createVerify as jest.Mock) = mockCreateVerify;

        // Initialize the checker with mocked dependencies
        templateChecker = new TemplateIntegrityChecker(mockSecurityManager);
    });

    /**
     * Tests for the calculateChecksum method
     * 
     * Verifies:
     * - Successful checksum calculation with SHA-256
     * - Path safety validation
     * - Error handling for file operations
     */
    describe('calculateChecksum', () => {
        /**
         * Test that checksum calculation works correctly for valid files
         * - Should read the file using fs.promises.readFile
         * - Should create a hash with the specified algorithm
         * - Should update the hash with the file content
         * - Should return the digest as a hex string
         */
        it('should calculate checksum for a valid file path', async () => {
            // Arrange
            const filePath = '/valid/path/template.docx';
            const fileBuffer = Buffer.from('test content');
            (fs.promises.readFile as jest.Mock).mockResolvedValue(fileBuffer);

            // Act
            const result = await templateChecker.calculateChecksum(filePath);

            // Assert
            expect(fs.promises.readFile).toHaveBeenCalledWith(filePath);
            expect(crypto.createHash).toHaveBeenCalledWith('sha256');
            expect(mockUpdate).toHaveBeenCalledWith(fileBuffer);
            expect(mockDigest).toHaveBeenCalledWith('hex');
            expect(result).toBe('mocked-hash-value');
        });

        /**
         * Test that unsafe paths are rejected
         * - Should validate the path using SecurityManager
         * - Should throw an appropriate error message
         */
        it('should throw error for unsafe path', async () => {
            // Arrange
            const filePath = '../unsafe/path/template.docx';
            mockSecurityManager.validatePath.mockReturnValue({ valid: false, message: 'Path traversal attempt' });

            // Act & Assert
            await expect(templateChecker.calculateChecksum(filePath)).rejects.toThrow('Invalid or unsafe template path provided');
        });

        /**
         * Test error handling when file operations fail
         * - Should properly propagate file system errors
         * - Should wrap the original error with context
         */
        it('should throw error when file read fails', async () => {
            // Arrange
            const filePath = '/valid/path/template.docx';
            (fs.promises.readFile as jest.Mock).mockRejectedValue(new Error('File not found'));

            // Act & Assert
            await expect(templateChecker.calculateChecksum(filePath)).rejects.toThrow('Failed to calculate checksum: File not found');
        });
    });

    /**
     * Tests for the verifyChecksum method
     * 
     * Verifies:
     * - Successful checksum verification
     * - Failed checksum verification
     * - Error handling during verification
     */
    describe('verifyChecksum', () => {
        /**
         * Test successful checksum verification
         * - Should call calculateChecksum with correct parameters
         * - Should compare checksums for equality
         * - Should return true when checksums match
         */
        it('should return true when checksums match', async () => {
            // Arrange
            const filePath = '/valid/path/template.docx';
            const expectedChecksum = 'mocked-hash-value';
            jest.spyOn(templateChecker, 'calculateChecksum').mockResolvedValue(expectedChecksum);

            // Act
            const result = await templateChecker.verifyChecksum(filePath, expectedChecksum);

            // Assert
            expect(result).toBe(true);
            expect(templateChecker.calculateChecksum).toHaveBeenCalledWith(filePath, 'sha256');
        });

        /**
         * Test failed checksum verification
         * - Should return false when checksums don't match
         * - Should not throw exceptions for mismatches
         */
        it('should return false when checksums do not match', async () => {
            // Arrange
            const filePath = '/valid/path/template.docx';
            const expectedChecksum = 'expected-checksum';
            jest.spyOn(templateChecker, 'calculateChecksum').mockResolvedValue('actual-checksum');

            // Act
            const result = await templateChecker.verifyChecksum(filePath, expectedChecksum);

            // Assert
            expect(result).toBe(false);
        });

        /**
         * Test error handling during checksum verification
         * - Should catch errors from calculateChecksum
         * - Should return false (fail closed) for any errors
         * - Should log the error for diagnostics
         */
        it('should return false when checksum calculation fails', async () => {
            // Arrange
            const filePath = '/valid/path/template.docx';
            const expectedChecksum = 'expected-checksum';
            jest.spyOn(templateChecker, 'calculateChecksum').mockRejectedValue(new Error('Calculation failed'));

            // Act
            const result = await templateChecker.verifyChecksum(filePath, expectedChecksum);

            // Assert
            expect(result).toBe(false);
        });
    });

    /**
     * Tests for the generateChecksumFile method
     * 
     * Verifies:
     * - Successful checksum file generation with multiple hash algorithms
     * - File path validation
     * - Proper timestamp inclusion
     */
    describe('generateChecksumFile', () => {
        /**
         * Test successful checksum file generation
         * - Should calculate checksums with multiple algorithms (MD5, SHA-256)
         * - Should include a timestamp in ISO format
         * - Should write the file with the correct content format
         * - Should return the path to the generated file
         */
        it('should generate and save checksum file', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const checksumFilePath = '/valid/path/template.docx.checksum';
            
            // Mock multiple checksum calculations for different algorithms
            jest.spyOn(templateChecker, 'calculateChecksum')
                .mockResolvedValueOnce('md5-hash-value')  // MD5
                .mockResolvedValueOnce('sha256-hash-value'); // SHA256
            
            // Mock Date.toISOString()
            const mockDate = new Date('2025-01-01T12:00:00Z');
            jest.spyOn(global, 'Date').mockImplementation(() => mockDate);
            
            // Act
            const result = await templateChecker.generateChecksumFile(templatePath);
            
            // Assert
            expect(templateChecker.calculateChecksum).toHaveBeenCalledWith(templatePath, 'md5');
            expect(templateChecker.calculateChecksum).toHaveBeenCalledWith(templatePath, 'sha256');
            
            const expectedContent = `MD5=md5-hash-value\nSHA256=sha256-hash-value\nTIMESTAMP=2025-01-01T12:00:00.000Z\n`;
            expect(fs.promises.writeFile).toHaveBeenCalledWith(checksumFilePath, expectedContent);
            expect(result).toBe(checksumFilePath);
        });
        
        /**
         * Test path safety validation
         * - Should validate template path is safe
         * - Should throw an appropriate error for unsafe paths
         */
        it('should throw error for unsafe path', async () => {
            // Arrange
            const templatePath = '../unsafe/path/template.docx';
            mockSecurityManager.validatePath.mockReturnValue({ valid: false, message: 'Path traversal attempt' });
            
            // Act & Assert
            await expect(templateChecker.generateChecksumFile(templatePath)).rejects.toThrow('Invalid or unsafe template path provided');
        });
    });

    /**
     * Tests for the verifyTemplateWithChecksumFile method
     * 
     * Verifies:
     * - Successful verification against a checksum file
     * - Handling of missing checksum files
     * - Handling of failed checksum verification
     */
    describe('verifyTemplateWithChecksumFile', () => {
        /**
         * Test successful verification with a valid checksum file
         * - Should check for the existence of the checksum file
         * - Should parse checksums from the file content
         * - Should verify each checksum algorithm (MD5, SHA-256)
         * - Should return true when all verifications pass
         * - Should add the template to the verified templates set
         */
        it('should return true when template checksum verification passes', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const checksumContent = 'MD5=md5-hash-value\nSHA256=sha256-hash-value\n';
            
            // Mock file access and reading
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.readFile as jest.Mock).mockResolvedValue(checksumContent);
            
            // Mock checksum verification
            jest.spyOn(templateChecker, 'verifyChecksum')
                .mockResolvedValueOnce(true)  // MD5
                .mockResolvedValueOnce(true); // SHA256
            
            // Act
            const result = await templateChecker.verifyTemplateWithChecksumFile(templatePath);
            
            // Assert
            expect(fs.promises.access).toHaveBeenCalledWith(`${templatePath}.checksum`);
            expect(fs.promises.readFile).toHaveBeenCalledWith(`${templatePath}.checksum`, 'utf-8');
            expect(templateChecker.verifyChecksum).toHaveBeenCalledWith(templatePath, 'md5-hash-value', 'md5');
            expect(templateChecker.verifyChecksum).toHaveBeenCalledWith(templatePath, 'sha256-hash-value', 'sha256');
            expect(result).toBe(true);
        });
        
        /**
         * Test handling of missing checksum files
         * - Should attempt to access the checksum file
         * - Should return false when the file doesn't exist
         * - Should log a warning about the missing file
         */
        it('should return false when checksum file does not exist', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'));
            
            // Act
            const result = await templateChecker.verifyTemplateWithChecksumFile(templatePath);
            
            // Assert
            expect(result).toBe(false);
        });
        
        /**
         * Test handling of failed checksum verification
         * - Should return false if any algorithm verification fails
         * - Should log a warning about the failed verification
         */
        it('should return false when MD5 checksum verification fails', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const checksumContent = 'MD5=md5-hash-value\nSHA256=sha256-hash-value\n';
            
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.readFile as jest.Mock).mockResolvedValue(checksumContent);
            
            jest.spyOn(templateChecker, 'verifyChecksum')
                .mockResolvedValueOnce(false)  // MD5 fails
                .mockResolvedValueOnce(true);  // SHA256 passes
            
            // Act
            const result = await templateChecker.verifyTemplateWithChecksumFile(templatePath);
            
            // Assert
            expect(result).toBe(false);
        });
    });

    /**
     * Tests for the signTemplate method
     * 
     * Verifies:
     * - Successful template signing
     * - Path safety validation
     * - Proper RSA-SHA256 signature generation
     */
    describe('signTemplate', () => {
        /**
         * Test successful template signing
         * - Should read the private key
         * - Should read the template file
         * - Should create a signature using RSA-SHA256
         * - Should save the signature to a .sig file
         * - Should return the path to the signature file
         */
        it('should sign a template and save signature file', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const privateKeyPath = '/valid/path/private_key.pem';
            const signatureFilePath = '/valid/path/template.docx.sig';
            
            const templateData = Buffer.from('template content');
            const privateKey = 'private-key-content';
            
            (fs.promises.readFile as jest.Mock)
                .mockResolvedValueOnce(privateKey)      // Read private key
                .mockResolvedValueOnce(templateData);   // Read template
            
            // Act
            const result = await templateChecker.signTemplate(templatePath, privateKeyPath);
            
            // Assert
            expect(fs.promises.readFile).toHaveBeenCalledWith(privateKeyPath, 'utf-8');
            expect(fs.promises.readFile).toHaveBeenCalledWith(templatePath);
            expect(crypto.createSign).toHaveBeenCalledWith('RSA-SHA256');
            expect(mockUpdate).toHaveBeenCalledWith(templateData);
            expect(mockSign).toHaveBeenCalledWith(privateKey, 'base64');
            expect(fs.promises.writeFile).toHaveBeenCalledWith(signatureFilePath, 'mocked-signature');
            expect(result).toBe(signatureFilePath);
        });
        
        /**
         * Test path safety validation
         * - Should validate both template and private key paths
         * - Should throw an appropriate error for unsafe paths
         */
        it('should throw error for unsafe paths', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const privateKeyPath = '../unsafe/path/private_key.pem';
            
            mockSecurityManager.validatePath
                .mockReturnValueOnce({ valid: true, message: '' })       // First call for templatePath
                .mockReturnValueOnce({ valid: false, message: 'Path traversal attempt' }); // Second call for privateKeyPath
            
            // Act & Assert
            await expect(templateChecker.signTemplate(templatePath, privateKeyPath))
                .rejects.toThrow('Invalid or unsafe path provided');
        });
    });

    /**
     * Tests for the verifySignature method
     * 
     * Verifies:
     * - Successful signature verification
     * - Handling of missing signature files
     * - Path safety validation
     */
    describe('verifySignature', () => {
        /**
         * Test successful signature verification
         * - Should check for the existence of the signature file
         * - Should read the public key, signature, and template file
         * - Should verify the signature using RSA-SHA256
         * - Should return true for a valid signature
         */
        it('should verify a valid signature', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const publicKeyPath = '/valid/path/public_key.pem';
            
            const templateData = Buffer.from('template content');
            const publicKey = 'public-key-content';
            const signature = 'valid-signature';
            
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            (fs.promises.readFile as jest.Mock)
                .mockResolvedValueOnce(publicKey)      // Read public key
                .mockResolvedValueOnce(signature)      // Read signature
                .mockResolvedValueOnce(templateData);  // Read template
            
            // Act
            const result = await templateChecker.verifySignature(templatePath, publicKeyPath);
            
            // Assert
            expect(fs.promises.access).toHaveBeenCalledWith(`${templatePath}.sig`);
            expect(fs.promises.readFile).toHaveBeenCalledWith(publicKeyPath, 'utf-8');
            expect(fs.promises.readFile).toHaveBeenCalledWith(`${templatePath}.sig`, 'utf-8');
            expect(fs.promises.readFile).toHaveBeenCalledWith(templatePath);
            expect(crypto.createVerify).toHaveBeenCalledWith('RSA-SHA256');
            expect(mockUpdate).toHaveBeenCalledWith(templateData);
            expect(mockVerify).toHaveBeenCalledWith(publicKey, signature, 'base64');
            expect(result).toBe(true);
        });
        
        /**
         * Test handling of missing signature files
         * - Should attempt to access the signature file
         * - Should return false when the file doesn't exist
         * - Should log a warning about the missing file
         */
        it('should return false when signature file does not exist', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const publicKeyPath = '/valid/path/public_key.pem';
            
            (fs.promises.access as jest.Mock).mockRejectedValue(new Error('File not found'));
            
            // Act
            const result = await templateChecker.verifySignature(templatePath, publicKeyPath);
            
            // Assert
            expect(result).toBe(false);
        });
    });

    /**
     * Tests for the verifyTemplateIntegrity method
     * 
     * Verifies:
     * - Comprehensive integrity verification
     * - Handling of templates from trusted and untrusted sources
     * - Coordination of multiple verification methods
     */
    describe('verifyTemplateIntegrity', () => {
        /**
         * Test successful comprehensive integrity verification
         * - Should check if the template file exists
         * - Should verify checksums
         * - Should check if the template is from a trusted source
         * - Should verify signature for external templates
         * - Should return a comprehensive result object
         * - Should mark the template as valid when all checks pass
         */
        it('should verify template integrity with all checks passing', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            
            // Mock verification methods
            jest.spyOn(templateChecker, 'verifyTemplateWithChecksumFile').mockResolvedValue(true);
            jest.spyOn(templateChecker, 'isFromTrustedSource').mockResolvedValue(true);
            jest.spyOn(templateChecker, 'verifySignature').mockResolvedValue(true);
            
            // Mock fs access
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            
            // Act
            const result = await templateChecker.verifyTemplateIntegrity(templatePath);
            
            // Assert
            expect(fs.promises.access).toHaveBeenCalledWith(templatePath);
            expect(templateChecker.verifyTemplateWithChecksumFile).toHaveBeenCalledWith(templatePath);
            expect(templateChecker.isFromTrustedSource).toHaveBeenCalled();
            expect(result).toEqual({
                valid: true,
                checksumValid: true,
                signatureValid: true,
                fromTrustedSource: true,
                source: expect.any(String)
            });
        });
        
        /**
         * Test handling of untrusted templates
         * - Should still perform checksum verification
         * - Should correctly identify the template as untrusted
         * - Should mark the template as invalid
         * - Should not include source information for untrusted templates
         */
        it('should return invalid result when template is not from trusted source', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            
            jest.spyOn(templateChecker, 'verifyTemplateWithChecksumFile').mockResolvedValue(true);
            jest.spyOn(templateChecker, 'isFromTrustedSource').mockResolvedValue(false);
            
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            
            // Act
            const result = await templateChecker.verifyTemplateIntegrity(templatePath);
            
            // Assert
            expect(result).toEqual({
                valid: false,
                checksumValid: true,
                signatureValid: false,
                fromTrustedSource: false,
                source: undefined
            });
        });
    });

    /**
     * Tests for the isFromTrustedSource and addTrustedSource methods
     * 
     * Verifies:
     * - Handling of extension-provided templates
     * - Adding and verifying custom trusted sources
     * - Integration with signature verification
     */
    describe('isFromTrustedSource & addTrustedSource', () => {
        /**
         * Test recognition of extension-provided templates
         * - Should identify templates in the extension's resources directory
         * - Should trust them without requiring signature verification
         */
        it('should recognize extension-provided templates as trusted', async () => {
            // Arrange
            const templatePath = '/extension/resources/templates/business.docx';
            const sourceName = 'default';
            
            // Act
            const result = await templateChecker.isFromTrustedSource(templatePath, sourceName);
            
            // Assert
            expect(result).toBe(true);
        });
        
        /**
         * Test adding and verifying custom trusted sources
         * - Should register a new trusted source with its public key
         * - Should use signature verification for custom sources
         * - Should correctly identify templates from the new source
         */
        it('should add and verify a new trusted source', async () => {
            // Arrange
            const templatePath = '/valid/path/template.docx';
            const sourceName = 'custom-source';
            const publicKeyPath = '/valid/path/public_key.pem';
            
            templateChecker.addTrustedSource(sourceName, publicKeyPath);
            
            jest.spyOn(templateChecker, 'verifySignature').mockResolvedValue(true);
            
            // Act
            const result = await templateChecker.isFromTrustedSource(templatePath, sourceName);
            
            // Assert
            expect(templateChecker.verifySignature).toHaveBeenCalledWith(templatePath, publicKeyPath);
            expect(result).toBe(true);
        });
    });
});
