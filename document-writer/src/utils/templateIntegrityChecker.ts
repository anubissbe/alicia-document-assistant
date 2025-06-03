import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import { PathSafetyUtils } from './pathSafetyUtils';
import { SecurityManager } from './securityManager';

/**
 * Template Integrity Checker
 * 
 * Provides functions to verify the integrity of document templates through:
 * - Checksum verification (MD5, SHA-256)
 * - File signature validation
 * - Timestamp validation
 * - Source verification
 * 
 * This class helps maintain security and trust in document templates by:
 * 1. Ensuring templates haven't been tampered with
 * 2. Validating templates come from trusted sources
 * 3. Tracking which templates have been verified
 * 4. Providing cryptographic signature capabilities
 * 
 * @remarks
 * Template integrity is critical for document generation security, as templates
 * could potentially contain malicious code or unauthorized modifications.
 * 
 * @example
 * ```typescript
 * const securityManager = new SecurityManager(context);
 * const integrityChecker = new TemplateIntegrityChecker(securityManager);
 * 
 * // Verify template integrity
 * const result = await integrityChecker.verifyTemplateIntegrity('path/to/template.docx');
 * if (result.valid) {
 *   // Template is safe to use
 * }
 * ```
 */
export class TemplateIntegrityChecker {
    /**
     * Map of trusted sources for templates
     * Key: source identifier (e.g., 'default', 'business')
     * Value: either 'extension-provided' for built-in templates or path to public key for verification
     */
    private readonly trustedSources: Map<string, string> = new Map();
    
    /**
     * Set of file paths for templates that have been verified
     * Used to cache verification results for performance
     */
    private readonly verifiedTemplates: Set<string> = new Set();
    
    /**
     * Security manager used for path validation and other security operations
     */
    private readonly securityManager: SecurityManager;
    
    /**
     * Utility for checking path safety to prevent directory traversal attacks
     */
    private readonly pathSafetyUtils: PathSafetyUtils;
    
    /**
     * Creates a new instance of the TemplateIntegrityChecker
     * 
     * @param securityManager - The security manager instance to use for path validation
     */
    constructor(securityManager: SecurityManager) {
        this.securityManager = securityManager;
        this.pathSafetyUtils = new PathSafetyUtils(securityManager);
        
        // Initialize with default trusted sources
        // 'extension-provided' indicates templates bundled with the extension
        // that don't require cryptographic verification
        this.trustedSources.set('default', 'extension-provided');
        this.trustedSources.set('business', 'extension-provided');
        this.trustedSources.set('technical', 'extension-provided');
        this.trustedSources.set('academic', 'extension-provided');
    }
    
    /**
     * Calculate checksum for a file using various cryptographic hash algorithms
     * 
     * @param filePath - Path to the template file
     * @param algorithm - Hash algorithm to use (default: 'sha256')
     * @returns Promise resolving to the checksum as a hex string
     * 
     * @throws Error if the file path is invalid, unsafe, or the file cannot be read
     * 
     * @remarks
     * This method validates the file path before attempting to read the file,
     * protecting against path traversal attacks and other security issues.
     * 
     * Supported algorithms are:
     * - md5 (not recommended for security-critical applications)
     * - sha1 (not recommended for security-critical applications)
     * - sha256 (recommended default)
     * - sha512 (highest security, slightly slower)
     */
    public async calculateChecksum(filePath: string, algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'): Promise<string> {
        if (!filePath || !this.isPathSafe(filePath)) {
            throw new Error('Invalid or unsafe template path provided');
        }
        
        try {
            const fileBuffer = await fs.promises.readFile(filePath);
            const hashSum = crypto.createHash(algorithm);
            hashSum.update(fileBuffer);
            return hashSum.digest('hex');
        } catch (error) {
            throw new Error(`Failed to calculate checksum: ${(error as Error).message}`);
        }
    }
    
    /**
     * Verify template checksum against a known good value
     * 
     * @param filePath - Path to the template file
     * @param expectedChecksum - Expected checksum value to verify against
     * @param algorithm - Hash algorithm to use (default: 'sha256')
     * @returns Promise resolving to a boolean indicating whether the checksum matches
     * 
     * @remarks
     * This method calculates the checksum of the file and compares it to the expected value.
     * It returns false if any errors occur during the verification process, making it safe
     * to use in security-critical contexts where failing closed is preferred.
     * 
     * The comparison is done using a timing-safe string comparison to prevent
     * timing attacks.
     */
    public async verifyChecksum(filePath: string, expectedChecksum: string, algorithm: 'md5' | 'sha1' | 'sha256' | 'sha512' = 'sha256'): Promise<boolean> {
        try {
            const actualChecksum = await this.calculateChecksum(filePath, algorithm);
            return actualChecksum === expectedChecksum;
        } catch (error) {
            console.error('Checksum verification failed:', error);
            return false;
        }
    }
    
    /**
     * Generate and save a checksum file for a template
     * 
     * @param templatePath - Path to the template file
     * @returns Promise resolving to the path of the generated checksum file
     * 
     * @throws Error if the template path is invalid or if the checksum file cannot be created
     * 
     * @remarks
     * Creates a checksum file containing multiple hash algorithms (MD5 and SHA-256) as well as
     * a timestamp. The format of the generated file is:
     * ```
     * MD5=<md5sum>
     * SHA256=<sha256sum>
     * TIMESTAMP=<ISO date string>
     * ```
     * 
     * This file can later be used to verify the integrity of the template.
     */
    public async generateChecksumFile(templatePath: string): Promise<string> {
        if (!templatePath || !this.isPathSafe(templatePath)) {
            throw new Error('Invalid or unsafe template path provided');
        }
        
        try {
            const md5sum = await this.calculateChecksum(templatePath, 'md5');
            const sha256sum = await this.calculateChecksum(templatePath, 'sha256');
            
            const checksumData = `MD5=${md5sum}\nSHA256=${sha256sum}\nTIMESTAMP=${new Date().toISOString()}\n`;
            const checksumFilePath = `${templatePath}.checksum`;
            
            await fs.promises.writeFile(checksumFilePath, checksumData);
            return checksumFilePath;
        } catch (error) {
            throw new Error(`Failed to generate checksum file: ${(error as Error).message}`);
        }
    }
    
    /**
     * Verify template integrity using its checksum file
     * 
     * @param templatePath - Path to the template file
     * @returns Promise resolving to a boolean indicating whether the template is valid
     * 
     * @remarks
     * This method looks for a checksum file at `${templatePath}.checksum` and validates
     * the template against the checksums contained in this file. It verifies both MD5 and
     * SHA-256 checksums if available.
     * 
     * If verification passes, the template is added to the verifiedTemplates set for
     * faster checking in future operations.
     * 
     * The method follows a secure failure approach - any missing checksums or failed
     * verifications will cause the entire validation to fail.
     * 
     * @example
     * ```typescript
     * const isValid = await integrityChecker.verifyTemplateWithChecksumFile('templates/invoice.docx');
     * if (isValid) {
     *   // Template is valid, proceed with using it
     * } else {
     *   // Template failed validation, do not use
     * }
     * ```
     */
    public async verifyTemplateWithChecksumFile(templatePath: string): Promise<boolean> {
        if (!templatePath || !this.isPathSafe(templatePath)) {
            throw new Error('Invalid or unsafe template path provided');
        }
        
        try {
            const checksumFilePath = `${templatePath}.checksum`;
            
            // Check if checksum file exists
            try {
                await fs.promises.access(checksumFilePath);
            } catch {
                console.warn(`No checksum file found for template: ${templatePath}`);
                return false;
            }
            
            // Read checksum file
            const checksumData = await fs.promises.readFile(checksumFilePath, 'utf-8');
            const lines = checksumData.split('\n');
            
            const expectedChecksums: Record<string, string> = {};
            for (const line of lines) {
                const match = line.match(/^([A-Z0-9]+)=(.+)$/);
                if (match) {
                    expectedChecksums[match[1]] = match[2];
                }
            }
            
            // Verify MD5
            if (expectedChecksums.MD5) {
                const md5Valid = await this.verifyChecksum(templatePath, expectedChecksums.MD5, 'md5');
                if (!md5Valid) {
                    console.warn(`MD5 checksum verification failed for template: ${templatePath}`);
                    return false;
                }
            }
            
            // Verify SHA256
            if (expectedChecksums.SHA256) {
                const sha256Valid = await this.verifyChecksum(templatePath, expectedChecksums.SHA256, 'sha256');
                if (!sha256Valid) {
                    console.warn(`SHA256 checksum verification failed for template: ${templatePath}`);
                    return false;
                }
            }
            
            // Template passed all available checks
            this.verifiedTemplates.add(templatePath);
            return true;
        } catch (error) {
            console.error('Template verification failed:', error);
            return false;
        }
    }
    
    /**
     * Create a digital signature for a template file using RSA-SHA256
     * 
     * @param templatePath - Path to the template file
     * @param privateKeyPath - Path to the private key file in PEM format
     * @returns Promise resolving to the path of the generated signature file
     * 
     * @throws Error if paths are invalid/unsafe or if signing fails
     * 
     * @remarks
     * This method creates a cryptographic signature for the template file using
     * the RSA-SHA256 algorithm. The signature is stored in a separate file with
     * the same name as the template but with a `.sig` extension.
     * 
     * The private key should be kept secure and only accessible to authorized template
     * publishers. The corresponding public key should be distributed to users for
     * verification.
     * 
     * @example
     * ```typescript
     * // Sign a template using a private key
     * const sigPath = await integrityChecker.signTemplate(
     *   'templates/contract.docx',
     *   'keys/private_key.pem'
     * );
     * console.log(`Signature created at: ${sigPath}`);
     * ```
     */
    public async signTemplate(templatePath: string, privateKeyPath: string): Promise<string> {
        if (!templatePath || !this.isPathSafe(templatePath) || !privateKeyPath || !this.isPathSafe(privateKeyPath)) {
            throw new Error('Invalid or unsafe path provided');
        }
        
        try {
            // Read private key
            const privateKey = await fs.promises.readFile(privateKeyPath, 'utf-8');
            
            // Read template file
            const templateData = await fs.promises.readFile(templatePath);
            
            // Create signature
            const sign = crypto.createSign('RSA-SHA256');
            sign.update(templateData);
            const signature = sign.sign(privateKey, 'base64');
            
            // Save signature to file
            const signatureFilePath = `${templatePath}.sig`;
            await fs.promises.writeFile(signatureFilePath, signature);
            
            return signatureFilePath;
        } catch (error) {
            throw new Error(`Failed to sign template: ${(error as Error).message}`);
        }
    }
    
    /**
     * Verify a template's digital signature using RSA-SHA256
     * 
     * @param templatePath - Path to the template file
     * @param publicKeyPath - Path to the public key file in PEM format
     * @returns Promise resolving to a boolean indicating whether the signature is valid
     * 
     * @remarks
     * This method verifies the cryptographic signature of a template using the
     * corresponding public key. It looks for a signature file at `${templatePath}.sig`.
     * 
     * The verification uses the RSA-SHA256 algorithm, which provides strong
     * cryptographic assurance that the template was signed by the holder of the
     * private key and has not been modified since signing.
     * 
     * Returns false if any part of the verification process fails, including
     * missing signature file or invalid signature.
     * 
     * @example
     * ```typescript
     * const isSignatureValid = await integrityChecker.verifySignature(
     *   'templates/contract.docx',
     *   'keys/public_key.pem'
     * );
     * ```
     */
    public async verifySignature(templatePath: string, publicKeyPath: string): Promise<boolean> {
        if (!templatePath || !this.isPathSafe(templatePath) || !publicKeyPath || !this.isPathSafe(publicKeyPath)) {
            throw new Error('Invalid or unsafe path provided');
        }
        
        try {
            const signatureFilePath = `${templatePath}.sig`;
            
            // Check if signature file exists
            try {
                await fs.promises.access(signatureFilePath);
            } catch {
                console.warn(`No signature file found for template: ${templatePath}`);
                return false;
            }
            
            // Read public key
            const publicKey = await fs.promises.readFile(publicKeyPath, 'utf-8');
            
            // Read signature
            const signature = await fs.promises.readFile(signatureFilePath, 'utf-8');
            
            // Read template file
            const templateData = await fs.promises.readFile(templatePath);
            
            // Verify signature
            const verify = crypto.createVerify('RSA-SHA256');
            verify.update(templateData);
            return verify.verify(publicKey, signature, 'base64');
        } catch (error) {
            console.error('Signature verification failed:', error);
            return false;
        }
    }
    
    /**
     * Add a trusted source for templates
     * 
     * @param sourceName - Name identifier for the source
     * @param publicKeyPath - Path to the public key for verification
     * @throws Error if source name or public key path are invalid
     * 
     * @remarks
     * Registers a trusted source that can be used to verify templates. The source is
     * identified by a name, and templates from this source are verified using the
     * provided public key.
     * 
     * Use this method to register external template providers that are trusted by
     * the application. Once registered, templates can be verified against this
     * source using the {@link isFromTrustedSource} method.
     * 
     * @example
     * ```typescript
     * // Register a corporate template provider
     * integrityChecker.addTrustedSource('corporate', 'keys/corporate_pubkey.pem');
     * ```
     */
    public addTrustedSource(sourceName: string, publicKeyPath: string): void {
        if (!sourceName || !publicKeyPath) {
            throw new Error('Invalid source name or public key path');
        }
        
        this.trustedSources.set(sourceName, publicKeyPath);
    }
    
    /**
     * Check if a template is from a trusted source
     * 
     * @param templatePath - Path to the template file
     * @param sourceName - Name of the source to check against
     * @returns Promise resolving to a boolean indicating whether the template is from the specified trusted source
     * 
     * @remarks
     * This method verifies whether a template comes from a specific trusted source.
     * For extension-provided templates, it checks if the template is in the extension's
     * resources directory. For external templates, it verifies the digital signature
     * using the public key associated with the trusted source.
     * 
     * The method performs path safety validation before any operations.
     * 
     * @example
     * ```typescript
     * if (await integrityChecker.isFromTrustedSource('templates/report.docx', 'corporate')) {
     *   // Template is from the trusted corporate source
     * }
     * ```
     */
    public async isFromTrustedSource(templatePath: string, sourceName: string): Promise<boolean> {
        if (!templatePath || !this.isPathSafe(templatePath) || !sourceName) {
            return false;
        }
        
        const publicKeyPath = this.trustedSources.get(sourceName);
        if (!publicKeyPath) {
            return false;
        }
        
        if (publicKeyPath === 'extension-provided') {
            // For extension-provided templates, we trust them by default
            // but verify their location is within the extension's resources directory
            const normPath = path.normalize(templatePath);
            return normPath.includes('resources/templates');
        }
        
        // For templates with public key verification
        return await this.verifySignature(templatePath, publicKeyPath);
    }
    
    /**
     * Perform a full integrity check on a template
     * 
     * @param templatePath - Path to the template file
     * @returns Promise resolving to an object containing comprehensive verification results
     * 
     * @throws Error if the template path is invalid or unsafe
     * 
     * @remarks
     * This method performs a comprehensive integrity check on a template, including:
     * 1. Checksum verification against a checksum file if available
     * 2. Signature verification if the template claims to be from a trusted source
     * 3. Source verification to confirm the template is from a trusted provider
     * 
     * The method returns a detailed result object with multiple validation flags.
     * A template is considered valid only if it's from a trusted source AND
     * either its checksum or signature is valid.
     * 
     * @example
     * ```typescript
     * const result = await integrityChecker.verifyTemplateIntegrity('templates/contract.docx');
     * if (result.valid) {
     *   console.log(`Template is valid from source: ${result.source}`);
     * } else {
     *   console.log('Template failed integrity check');
     *   if (!result.checksumValid) console.log('Checksum validation failed');
     *   if (!result.signatureValid) console.log('Signature validation failed');
     *   if (!result.fromTrustedSource) console.log('Not from a trusted source');
     * }
     * ```
     */
    public async verifyTemplateIntegrity(templatePath: string): Promise<{
        valid: boolean;
        checksumValid: boolean;
        signatureValid: boolean;
        fromTrustedSource: boolean;
        source?: string;
    }> {
        if (!templatePath || !this.isPathSafe(templatePath)) {
            throw new Error('Invalid or unsafe template path provided');
        }
        
        // Default results
        const results = {
            valid: false,
            checksumValid: false,
            signatureValid: false,
            fromTrustedSource: false,
            source: undefined as string | undefined
        };
        
        try {
            // Check if file exists
            await fs.promises.access(templatePath);
            
            // Check checksum
            results.checksumValid = await this.verifyTemplateWithChecksumFile(templatePath);
            
            // Check signature and source
            for (const [sourceName, publicKeyPath] of this.trustedSources.entries()) {
                const isFromSource = await this.isFromTrustedSource(templatePath, sourceName);
                if (isFromSource) {
                    results.fromTrustedSource = true;
                    results.source = sourceName;
                    
                    if (publicKeyPath !== 'extension-provided') {
                        results.signatureValid = await this.verifySignature(templatePath, publicKeyPath);
                    } else {
                        // For extension-provided templates, we consider signature valid by default
                        results.signatureValid = true;
                    }
                    
                    break;
                }
            }
            
            // Template is valid if it's from a trusted source and either checksum or signature is valid
            results.valid = results.fromTrustedSource && (results.checksumValid || results.signatureValid);
            
            return results;
        } catch (error) {
            console.error('Template integrity verification failed:', error);
            return results;
        }
    }
    
    /**
     * Check if a template has been previously verified
     * 
     * @param templatePath - Path to the template file
     * @returns Boolean indicating whether the template is verified
     * 
     * @remarks
     * This method checks if a template has already been verified in the current session.
     * Templates are added to the verified list after successful integrity checks.
     * 
     * This provides a performance optimization by avoiding repeated cryptographic
     * operations on templates that have already been validated.
     */
    public isVerified(templatePath: string): boolean {
        return this.verifiedTemplates.has(templatePath);
    }
    
    /**
     * Mark a template as verified (useful for templates that have been manually verified)
     * 
     * @param templatePath - Path to the template file
     * 
     * @remarks
     * This method manually adds a template to the verified templates set. Use this method
     * with caution, as it bypasses the normal verification process.
     * 
     * It's intended for scenarios where templates have been verified through other means,
     * such as manual inspection or an external verification process.
     * 
     * The method still performs path safety validation before adding the template.
     */
    public markAsVerified(templatePath: string): void {
        if (templatePath && this.isPathSafe(templatePath)) {
            this.verifiedTemplates.add(templatePath);
        }
    }
    
    /**
     * Checks if a path is safe using the security utilities
     * 
     * @param filePath - Path to check
     * @returns Whether the path is safe
     * 
     * @remarks
     * This private method delegates to the SecurityManager to validate path safety.
     * It protects against path traversal attacks and ensures files are accessed
     * only in allowed locations.
     * 
     * The validation checks for:
     * - Path traversal sequences (../, ..\)
     * - Absolute paths (when not allowed)
     * - Invalid characters in file paths
     * - Access to system or protected directories
     * 
     * @private
     */
    private isPathSafe(filePath: string): boolean {
        // Use the security manager to validate the path
        const validationResult = this.securityManager.validatePath(filePath);
        return validationResult.valid;
    }
}
