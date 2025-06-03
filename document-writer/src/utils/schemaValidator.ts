// @ts-ignore
import Ajv from 'ajv';
// @ts-ignore
import addFormats from 'ajv-formats';

// Define error type to fix TypeScript errors
interface ErrorObjectWithParams {
    instancePath?: string;
    keyword: string;
    message?: string;
    params: any;
}

/**
 * Options for schema validation
 */
export interface ValidationOptions {
    /** 
     * Whether to coerce types during validation (e.g., '123' to 123)
     */
    coerceTypes?: boolean;
    
    /**
     * Whether to allow additional properties not defined in the schema
     */
    allowAdditionalProperties?: boolean;
    
    /**
     * Whether to use strict mode for validation
     */
    strictMode?: boolean;
}

/**
 * Result of object validation
 */
export interface ValidationResult<T = any> {
    /**
     * Whether the object is valid against the schema
     */
    valid: boolean;
    
    /**
     * The validated object (if valid), or null (if invalid)
     */
    value: T | null;
    
    /**
     * Validation errors (empty array if valid)
     */
    errors: string[];
}

/**
 * JSON Schema type definitions helper
 */
export class SchemaTypes {
    /**
     * Create a string type definition
     * @param description Field description
     * @param format Optional format (e.g., 'email', 'uri')
     * @returns JSON Schema type definition
     */
    static string(description: string, format?: string): any {
        const schema: any = {
            type: 'string',
            description
        };
        
        if (format) {
            schema.format = format;
        }
        
        return schema;
    }
    
    /**
     * Create a number type definition
     * @param description Field description
     * @param minimum Optional minimum value
     * @param maximum Optional maximum value
     * @returns JSON Schema type definition
     */
    static number(description: string, minimum?: number, maximum?: number): any {
        const schema: any = {
            type: 'number',
            description
        };
        
        if (minimum !== undefined) {
            schema.minimum = minimum;
        }
        
        if (maximum !== undefined) {
            schema.maximum = maximum;
        }
        
        return schema;
    }
    
    /**
     * Create an integer type definition
     * @param description Field description
     * @param minimum Optional minimum value
     * @param maximum Optional maximum value
     * @returns JSON Schema type definition
     */
    static integer(description: string, minimum?: number, maximum?: number): any {
        const schema: any = {
            type: 'integer',
            description
        };
        
        if (minimum !== undefined) {
            schema.minimum = minimum;
        }
        
        if (maximum !== undefined) {
            schema.maximum = maximum;
        }
        
        return schema;
    }
    
    /**
     * Create a boolean type definition
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static boolean(description: string): any {
        return {
            type: 'boolean',
            description
        };
    }
    
    /**
     * Create an array type definition
     * @param items Schema for array items
     * @param description Field description
     * @param minItems Optional minimum number of items
     * @param maxItems Optional maximum number of items
     * @returns JSON Schema type definition
     */
    static array(items: any, description: string, minItems?: number, maxItems?: number): any {
        const schema: any = {
            type: 'array',
            items,
            description
        };
        
        if (minItems !== undefined) {
            schema.minItems = minItems;
        }
        
        if (maxItems !== undefined) {
            schema.maxItems = maxItems;
        }
        
        return schema;
    }
    
    /**
     * Create an object type definition
     * @param properties Object properties
     * @param required Required property names
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static object(properties: Record<string, any>, required: string[] = [], description: string): any {
        return {
            type: 'object',
            properties,
            required,
            additionalProperties: false,
            description
        };
    }
    
    /**
     * Create an enum type definition
     * @param values Enum values
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static enum(values: any[], description: string): any {
        return {
            enum: values,
            description
        };
    }
    
    /**
     * Create an email type definition
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static email(description: string): any {
        return {
            type: 'string',
            format: 'email',
            description
        };
    }
    
    /**
     * Create a URI type definition
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static uri(description: string): any {
        return {
            type: 'string',
            format: 'uri',
            description
        };
    }
    
    /**
     * Create a date type definition
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static date(description: string): any {
        return {
            type: 'string',
            format: 'date',
            description
        };
    }
    
    /**
     * Create a date-time type definition
     * @param description Field description
     * @returns JSON Schema type definition
     */
    static dateTime(description: string): any {
        return {
            type: 'string',
            format: 'date-time',
            description
        };
    }
}

// Singleton instance of AJV for schema validation
// @ts-ignore
const ajvInstance = new Ajv({
    allErrors: true,
    useDefaults: true
});
// @ts-ignore
addFormats(ajvInstance);

/**
 * Validates data against a JSON schema
 * @param data Data to validate
 * @param schema JSON schema to validate against
 * @returns Array of error messages (empty if valid)
 */
export function validateAgainstSchema(data: any, schema: any): string[] {
    try {
        const validate = ajvInstance.compile(schema);
        const valid = validate(data);
        
        if (valid) {
            return [];
        }
        
        // Format error messages
        return (validate.errors || []).map(error => {
            // Type assertion to handle AJV error object
            const err = error as unknown as ErrorObjectWithParams;
            const path = err.instancePath || '';
            const property = err.params.missingProperty || err.params.additionalProperty || '';
            const formattedPath = path + (property ? `/${property}` : '');
            
            switch (err.keyword) {
                case 'required':
                    return `Missing required property: ${err.params.missingProperty}`;
                case 'type':
                    return `Invalid type at ${formattedPath}: expected ${err.params.type}`;
                case 'format':
                    return `Invalid format at ${formattedPath}: expected ${err.params.format}`;
                case 'enum':
                    return `Invalid value at ${formattedPath}: must be one of the allowed values`;
                case 'pattern':
                    return `Invalid pattern at ${formattedPath}: value does not match required pattern`;
                case 'minimum':
                case 'maximum':
                case 'minLength':
                case 'maxLength':
                case 'minItems':
                case 'maxItems':
                    return `Invalid value at ${formattedPath}: ${err.message}`;
                default:
                    return `Validation error at ${formattedPath}: ${err.message || 'Unknown error'}`;
            }
        });
    } catch (error: any) {
        return [`Schema validation error: ${error.message || 'Unknown error'}`];
    }
}

/**
 * Validates an object against a schema
 * @param obj Object to validate
 * @param schemaId Schema ID
 * @param schema JSON schema
 * @param options Validation options
 * @returns Validation result
 */
export function validateObject<T = any>(
    obj: any,
    schemaId: string,
    schema: any,
    options: ValidationOptions = {}
): ValidationResult<T> {
    try {
        // Configure Ajv instance with options
        // @ts-ignore
        const ajv = new Ajv({
            allErrors: true,
            useDefaults: true,
            coerceTypes: options.coerceTypes || false
        });
        // @ts-ignore
        addFormats(ajv);
        
        // Add schema
        ajv.addSchema(schema, schemaId);
        
        // Get validation function
        const validate = ajv.getSchema(schemaId);
        if (!validate) {
            return {
                valid: false,
                value: null,
                errors: [`Schema with ID ${schemaId} not found`]
            };
        }
        
        // Validate object
        const valid = validate(obj);
        
        if (valid) {
            return {
                valid: true,
                value: obj as T,
                errors: []
            };
        }
        
        // Format error messages
        const errors = (validate.errors || []).map(error => {
            // Type assertion to handle AJV error object
            const err = error as unknown as ErrorObjectWithParams;
            const path = err.instancePath || '';
            const property = err.params.missingProperty || err.params.additionalProperty || '';
            const formattedPath = path + (property ? `/${property}` : '');
            
            switch (err.keyword) {
                case 'required':
                    return `Missing required property: ${err.params.missingProperty}`;
                case 'type':
                    return `Invalid type at ${formattedPath}: expected ${err.params.type}`;
                case 'format':
                    return `Invalid format at ${formattedPath}: expected ${err.params.format}`;
                case 'enum':
                    return `Invalid value at ${formattedPath}: must be one of the allowed values`;
                case 'pattern':
                    return `Invalid pattern at ${formattedPath}: value does not match required pattern`;
                case 'minimum':
                case 'maximum':
                case 'minLength':
                case 'maxLength':
                case 'minItems':
                case 'maxItems':
                    return `Invalid value at ${formattedPath}: ${err.message}`;
                default:
                    return `Validation error at ${formattedPath}: ${err.message || 'Unknown error'}`;
            }
        });
        
        return {
            valid: false,
            value: null,
            errors
        };
    } catch (error: any) {
        return {
            valid: false,
            value: null,
            errors: [`Schema validation error: ${error.message || 'Unknown error'}`]
        };
    }
}

/**
 * Creates a JSON schema from an interface definition
 * @param name Interface name
 * @param properties Interface properties
 * @param required Required property names
 * @returns JSON schema
 */
export function createSchemaFromInterface(
    name: string,
    properties: Record<string, any>,
    required: string[] = []
): any {
    return {
        $id: `schema:${name}`,
        type: 'object',
        title: name,
        properties,
        required,
        additionalProperties: false
    };
}
