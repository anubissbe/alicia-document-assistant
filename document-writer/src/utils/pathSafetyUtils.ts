import * as path from 'path';
import * as vscode from 'vscode';
import { SecurityManager, PathValidationOptions } from './securityManager';

/**
 * Utility class for path safety operations throughout the application
 * Provides a consistent interface for path validation and sanitization
 */
export class PathSafetyUtils {
    private securityManager: SecurityManager;
    private allowedExtensions: string[] = ['.docx', '.pdf', '.txt', '.json', '.md', '.html', '.xml', '.csv'];
    private allowedBaseDirs: string[] = [];
    private extensionContext?: vscode.ExtensionContext;

    /**
     * Creates a new PathSafetyUtils instance
     * @param securityManager The security manager instance
     * @param context Optional extension context
     */
    constructor(securityManager: SecurityManager, context?: vscode.ExtensionContext) {
        this.securityManager = securityManager;
        this.extensionContext = context;
        this.initializeAllowedDirectories();
    }

    /**
     * Initialize the list of allowed directories based on workspace and extension configuration
     */
    private initializeAllowedDirectories(): void {
        // Add extension storage paths
        const context = vscode.extensions.getExtension('document-writer')?.extensionUri;
        if (context) {
            const extensionPath = vscode.Uri.parse(context.toString()).fsPath;
            this.allowedBaseDirs.push(path.join(extensionPath, 'resources', 'templates'));
        }

        // Add global storage path if context was provided in constructor
        if (this.extensionContext?.globalStorageUri) {
            this.allowedBaseDirs.push(this.extensionContext.globalStorageUri.fsPath);
        }

        // Add workspace folders
        if (vscode.workspace.workspaceFolders) {
            for (const folder of vscode.workspace.workspaceFolders) {
                this.allowedBaseDirs.push(folder.uri.fsPath);
            }
        }
    }

    /**
     * Safely resolves a path for template operations
     * @param filePath The path to validate and sanitize
     * @param operation The operation being performed (for error messages)
     * @returns Safe path or throws an error if path is invalid
     */
    public resolveTemplatePath(filePath: string, operation: string = 'template operation'): string {
        const templateDir = this.getTemplateDirectory();
        return this.resolvePath(filePath, templateDir, {
            allowedExtensions: ['.docx', '.dotx', '.xml', '.json', '.md', '.html'],
            allowedBaseDirs: [templateDir, ...this.allowedBaseDirs]
        }, operation);
    }

    /**
     * Safely resolves a path for document operations
     * @param filePath The path to validate and sanitize
     * @param operation The operation being performed (for error messages)
     * @returns Safe path or throws an error if path is invalid
     */
    public resolveDocumentPath(filePath: string, operation: string = 'document operation'): string {
        const documentDir = this.getDocumentDirectory();
        return this.resolvePath(filePath, documentDir, {
            allowedExtensions: this.allowedExtensions,
            allowedBaseDirs: [documentDir, ...this.allowedBaseDirs]
        }, operation);
    }

    /**
     * Safely resolves a path for general file operations
     * @param filePath The path to validate and sanitize
     * @param baseDir The base directory for relative paths
     * @param options Validation options
     * @param operation The operation being performed (for error messages)
     * @returns Safe path or throws an error if path is invalid
     */
    public resolvePath(
        filePath: string, 
        baseDir: string, 
        options: PathValidationOptions = {}, 
        operation: string = 'file operation'
    ): string {
        // First validate the path
        const validationResult = this.securityManager.validatePath(filePath, options);
        
        if (!validationResult.valid) {
            throw new Error(`Invalid path for ${operation}: ${validationResult.message}`);
        }
        
        // Then sanitize the path for extra safety
        const sanitizedPath = this.securityManager.sanitizePath(filePath, baseDir);
        
        // Perform a final validation on the sanitized path
        const finalValidation = this.securityManager.validatePath(sanitizedPath, options);
        if (!finalValidation.valid) {
            throw new Error(`Path sanitization failed for ${operation}: ${finalValidation.message}`);
        }
        
        return sanitizedPath;
    }

    /**
     * Gets the template directory path
     * @returns Path to the template directory
     */
    private getTemplateDirectory(): string {
        const context = vscode.extensions.getExtension('document-writer')?.extensionUri;
        if (!context) {
            throw new Error('Extension context not available');
        }
        
        return path.join(vscode.Uri.parse(context.toString()).fsPath, 'resources', 'templates');
    }

    /**
     * Gets the document directory path
     * @returns Path to the document directory
     */
    private getDocumentDirectory(): string {
        // First try to use extension context if available
        if (this.extensionContext?.globalStorageUri) {
            return path.join(this.extensionContext.globalStorageUri.fsPath, 'documents');
        }
        
        // Fallback to workspace folder
        const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (workspacePath) {
            return path.join(workspacePath, '.documents');
        }
        
        // Last resort fallback to template parent directory
        return path.join(this.getTemplateDirectory(), '..', 'documents');
    }

    /**
     * Validates a file extension against allowed extensions
     * @param filePath File path to check
     * @param allowedExtensions List of allowed extensions
     * @returns Whether the extension is allowed
     */
    public isAllowedExtension(filePath: string, allowedExtensions: string[] = this.allowedExtensions): boolean {
        const extension = path.extname(filePath).toLowerCase();
        return allowedExtensions.includes(extension);
    }

    /**
     * Checks if a path is within allowed directories
     * @param filePath Path to check
     * @param allowedDirs List of allowed directories
     * @returns Whether the path is within allowed directories
     */
    public isWithinAllowedDirectories(filePath: string, allowedDirs: string[] = this.allowedBaseDirs): boolean {
        const normalizedPath = path.normalize(filePath);
        return allowedDirs.some(dir => {
            const normalizedDir = path.normalize(dir);
            return normalizedPath.startsWith(normalizedDir);
        });
    }

    /**
     * Creates a safe relative path that doesn't contain path traversal
     * @param filePath Original path
     * @param baseDir Base directory
     * @returns Safe relative path
     */
    public createSafeRelativePath(filePath: string, baseDir: string): string {
        // Sanitize both paths
        const safePath = this.securityManager.sanitizePath(filePath, baseDir);
        const safeBaseDir = this.securityManager.sanitizePath(baseDir, baseDir);
        
        // Create relative path safely
        if (safePath.startsWith(safeBaseDir)) {
            return safePath.substring(safeBaseDir.length).replace(/^[\/\\]+/, '');
        }
        
        // If not within the base directory, return just the filename
        return path.basename(safePath);
    }
}
