/**
 * Input Validation utility for the Document Writer extension
 */

export interface ValidationRule {
    name: string;
    message: string;
    validator: (value: any) => boolean;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface ValidationSchema {
    [field: string]: ValidationRule[];
}

/**
 * Input validator with comprehensive validation rules
 */
export class InputValidator {
    private static instance: InputValidator;

    public static getInstance(): InputValidator {
        if (!InputValidator.instance) {
            InputValidator.instance = new InputValidator();
        }
        return InputValidator.instance;
    }

    /**
     * Validates an object against a schema
     */
    public validateObject(obj: any, schema: ValidationSchema): ValidationResult {
        const errors: string[] = [];

        for (const [field, rules] of Object.entries(schema)) {
            const value = obj[field];
            
            for (const rule of rules) {
                if (!rule.validator(value)) {
                    errors.push(`${field}: ${rule.message}`);
                }
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates a single value against rules
     */
    public validateValue(value: any, rules: ValidationRule[]): ValidationResult {
        const errors: string[] = [];

        for (const rule of rules) {
            if (!rule.validator(value)) {
                errors.push(rule.message);
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    // Common validation rules
    public static Rules = {
        required: (message: string = 'This field is required'): ValidationRule => ({
            name: 'required',
            message,
            validator: (value: any) => value !== null && value !== undefined && value !== ''
        }),

        minLength: (min: number, message?: string): ValidationRule => ({
            name: 'minLength',
            message: message || `Must be at least ${min} characters long`,
            validator: (value: any) => typeof value === 'string' && value.length >= min
        }),

        maxLength: (max: number, message?: string): ValidationRule => ({
            name: 'maxLength',
            message: message || `Must be no more than ${max} characters long`,
            validator: (value: any) => typeof value === 'string' && value.length <= max
        }),

        email: (message: string = 'Must be a valid email address'): ValidationRule => ({
            name: 'email',
            message,
            validator: (value: any) => {
                const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                return typeof value === 'string' && emailRegex.test(value);
            }
        }),

        url: (message: string = 'Must be a valid URL'): ValidationRule => ({
            name: 'url',
            message,
            validator: (value: any) => {
                try {
                    new URL(value);
                    return true;
                } catch {
                    return false;
                }
            }
        }),

        numeric: (message: string = 'Must be a number'): ValidationRule => ({
            name: 'numeric',
            message,
            validator: (value: any) => !isNaN(Number(value))
        }),

        integer: (message: string = 'Must be an integer'): ValidationRule => ({
            name: 'integer',
            message,
            validator: (value: any) => Number.isInteger(Number(value))
        }),

        positive: (message: string = 'Must be a positive number'): ValidationRule => ({
            name: 'positive',
            message,
            validator: (value: any) => Number(value) > 0
        }),

        range: (min: number, max: number, message?: string): ValidationRule => ({
            name: 'range',
            message: message || `Must be between ${min} and ${max}`,
            validator: (value: any) => {
                const num = Number(value);
                return num >= min && num <= max;
            }
        }),

        pattern: (regex: RegExp, message: string = 'Invalid format'): ValidationRule => ({
            name: 'pattern',
            message,
            validator: (value: any) => typeof value === 'string' && regex.test(value)
        }),

        oneOf: (allowedValues: any[], message?: string): ValidationRule => ({
            name: 'oneOf',
            message: message || `Must be one of: ${allowedValues.join(', ')}`,
            validator: (value: any) => allowedValues.includes(value)
        }),

        fileExtension: (extensions: string[], message?: string): ValidationRule => ({
            name: 'fileExtension',
            message: message || `File must have one of these extensions: ${extensions.join(', ')}`,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                const ext = value.toLowerCase().split('.').pop();
                return ext ? extensions.includes(`.${ext}`) : false;
            }
        }),

        noScripts: (message: string = 'Script tags are not allowed'): ValidationRule => ({
            name: 'noScripts',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return true;
                return !/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(value);
            }
        }),

        noHtmlTags: (message: string = 'HTML tags are not allowed'): ValidationRule => ({
            name: 'noHtmlTags',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return true;
                return !/<[^>]+>/g.test(value);
            }
        }),

        alphanumeric: (message: string = 'Must contain only letters and numbers'): ValidationRule => ({
            name: 'alphanumeric',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                return /^[a-zA-Z0-9]+$/.test(value);
            }
        }),

        slug: (message: string = 'Must be a valid slug (letters, numbers, hyphens, underscores)'): ValidationRule => ({
            name: 'slug',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                return /^[a-zA-Z0-9_-]+$/.test(value);
            }
        }),

        filename: (message: string = 'Must be a valid filename'): ValidationRule => ({
            name: 'filename',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                // Check for invalid filename characters
                const invalidChars = /[<>:"/\\|?*]/;
                return !invalidChars.test(value) && value.trim() !== '';
            }
        }),

        documentTitle: (message: string = 'Document title must be valid'): ValidationRule => ({
            name: 'documentTitle',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                // Must be 1-200 characters, no special chars that could break file systems
                return value.length >= 1 && value.length <= 200 && !/[<>:"/\\|?*]/.test(value);
            }
        }),

        templateName: (message: string = 'Template name must be valid'): ValidationRule => ({
            name: 'templateName',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                // Must be 1-100 characters, alphanumeric with spaces, hyphens, underscores
                return /^[a-zA-Z0-9\s_-]{1,100}$/.test(value);
            }
        }),

        apiKey: (message: string = 'API key format is invalid'): ValidationRule => ({
            name: 'apiKey',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                // API keys are typically 32-128 characters, alphanumeric and some special chars
                return /^[a-zA-Z0-9_-]{16,128}$/.test(value);
            }
        }),

        version: (message: string = 'Version must be in semantic version format'): ValidationRule => ({
            name: 'version',
            message,
            validator: (value: any) => {
                if (typeof value !== 'string') return false;
                // Semantic versioning format
                return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.-]+)?(\+[a-zA-Z0-9.-]+)?$/.test(value);
            }
        })
    };

    /**
     * Document-specific validation schemas
     */
    public static Schemas = {
        documentData: {
            title: [
                InputValidator.Rules.required(),
                InputValidator.Rules.documentTitle()
            ],
            author: [
                InputValidator.Rules.maxLength(100, 'Author name must be less than 100 characters')
            ],
            date: [
                InputValidator.Rules.pattern(/^\d{4}-\d{2}-\d{2}$/, 'Date must be in YYYY-MM-DD format')
            ],
            description: [
                InputValidator.Rules.maxLength(500, 'Description must be less than 500 characters'),
                InputValidator.Rules.noScripts()
            ]
        },

        templateMetadata: {
            name: [
                InputValidator.Rules.required(),
                InputValidator.Rules.templateName()
            ],
            description: [
                InputValidator.Rules.maxLength(200, 'Description must be less than 200 characters'),
                InputValidator.Rules.noHtmlTags()
            ],
            category: [
                InputValidator.Rules.required(),
                InputValidator.Rules.oneOf(['Business', 'Technical', 'Academic', 'Personal'])
            ],
            version: [
                InputValidator.Rules.version()
            ]
        },

        userSettings: {
            defaultAuthor: [
                InputValidator.Rules.maxLength(100),
                InputValidator.Rules.noHtmlTags()
            ],
            outputPath: [
                InputValidator.Rules.required(),
                InputValidator.Rules.filename()
            ]
        },

        apiConfiguration: {
            apiKey: [
                InputValidator.Rules.required(),
                InputValidator.Rules.apiKey()
            ],
            endpoint: [
                InputValidator.Rules.url()
            ]
        }
    };

    /**
     * Validates document data
     */
    public validateDocumentData(data: any): ValidationResult {
        return this.validateObject(data, InputValidator.Schemas.documentData);
    }

    /**
     * Validates template metadata
     */
    public validateTemplateMetadata(metadata: any): ValidationResult {
        return this.validateObject(metadata, InputValidator.Schemas.templateMetadata);
    }

    /**
     * Validates user settings
     */
    public validateUserSettings(settings: any): ValidationResult {
        return this.validateObject(settings, InputValidator.Schemas.userSettings);
    }

    /**
     * Validates API configuration
     */
    public validateApiConfiguration(config: any): ValidationResult {
        return this.validateObject(config, InputValidator.Schemas.apiConfiguration);
    }

    /**
     * Sanitizes and validates file path
     */
    public validateFilePath(filePath: string): ValidationResult {
        const errors: string[] = [];

        if (!filePath) {
            errors.push('File path is required');
            return { valid: false, errors };
        }

        // Check for path traversal
        if (filePath.includes('..')) {
            errors.push('Path traversal is not allowed');
        }

        // Check for invalid characters
        const invalidChars = /[<>"|?*]/;
        if (invalidChars.test(filePath)) {
            errors.push('File path contains invalid characters');
        }

        // Check length
        if (filePath.length > 260) {
            errors.push('File path is too long (max 260 characters)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates document content for security issues
     */
    public validateDocumentContent(content: string): ValidationResult {
        const errors: string[] = [];

        if (!content) {
            return { valid: true, errors: [] }; // Empty content is valid
        }

        // Check for script tags
        if (/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi.test(content)) {
            errors.push('Script tags are not allowed in document content');
        }

        // Check for dangerous event handlers
        const dangerousPatterns = [
            /on\w+\s*=/gi,  // Event handlers like onclick=
            /javascript:/gi, // JavaScript protocol
            /vbscript:/gi,   // VBScript protocol
            /data:text\/html/gi // Data URLs with HTML
        ];

        for (const pattern of dangerousPatterns) {
            if (pattern.test(content)) {
                errors.push('Potentially dangerous content detected');
                break;
            }
        }

        // Check content length (reasonable limit for document content)
        if (content.length > 10000000) { // 10MB limit
            errors.push('Document content is too large (max 10MB)');
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Validates user input for forms
     */
    public validateFormInput(formData: Record<string, any>, schema: ValidationSchema): ValidationResult {
        // First sanitize all string inputs
        const sanitizedData: Record<string, any> = {};
        for (const [key, value] of Object.entries(formData)) {
            if (typeof value === 'string') {
                // Basic sanitization - remove control characters
                sanitizedData[key] = value.replace(/[\x00-\x1F\x7F]/g, '');
            } else {
                sanitizedData[key] = value;
            }
        }

        // Then validate against schema
        return this.validateObject(sanitizedData, schema);
    }
}

// Export singleton instance
export const inputValidator = InputValidator.getInstance();