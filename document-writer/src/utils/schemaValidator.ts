import { MCPToolInputSchema, MCPToolProperty } from '../models/mcpTool';

/**
 * Schema validation error interface
 */
export interface ValidationError {
    path: string;
    message: string;
}

/**
 * Validates parameters against an MCP Tool input schema
 * @param params The parameters to validate
 * @param schema The schema to validate against
 * @returns Array of validation errors, empty if valid
 */
export function validateAgainstSchema(params: any, schema: MCPToolInputSchema): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check type
    if (schema.type !== 'object') {
        errors.push({
            path: '',
            message: `Expected type "object", got "${schema.type}"`
        });
        return errors;
    }
    
    // Check required properties
    for (const requiredProp of schema.required) {
        if (params[requiredProp] === undefined) {
            errors.push({
                path: requiredProp,
                message: `Missing required property "${requiredProp}"`
            });
        }
    }
    
    // Check properties
    for (const [propName, propValue] of Object.entries(params)) {
        // If additionalProperties is false, check if the property is defined in the schema
        if (schema.additionalProperties === false && !schema.properties[propName]) {
            errors.push({
                path: propName,
                message: `Unknown property "${propName}"`
            });
            continue;
        }
        
        // If the property is defined in the schema, validate it
        if (schema.properties[propName]) {
            const propSchema = schema.properties[propName];
            const propErrors = validateProperty(propValue, propSchema, propName);
            errors.push(...propErrors);
        }
    }
    
    return errors;
}

/**
 * Validates a property against a property schema
 * @param value The value to validate
 * @param schema The property schema
 * @param path The current property path
 * @returns Array of validation errors, empty if valid
 */
function validateProperty(value: any, schema: MCPToolProperty, path: string): ValidationError[] {
    const errors: ValidationError[] = [];
    
    // Check if value is null or undefined
    if (value === null || value === undefined) {
        return errors; // Null/undefined values are handled by required check
    }
    
    // Check type
    switch (schema.type) {
        case 'string':
            if (typeof value !== 'string') {
                errors.push({
                    path,
                    message: `Expected type "string", got "${typeof value}"`
                });
                return errors; // Return early as other validations don't apply
            }
            
            // Check pattern
            if (schema.pattern && !new RegExp(schema.pattern).test(value)) {
                errors.push({
                    path,
                    message: `Value does not match pattern "${schema.pattern}"`
                });
            }
            
            // Check min/max length
            if (schema.minLength !== undefined && value.length < schema.minLength) {
                errors.push({
                    path,
                    message: `Value length ${value.length} is less than minimum length ${schema.minLength}`
                });
            }
            
            if (schema.maxLength !== undefined && value.length > schema.maxLength) {
                errors.push({
                    path,
                    message: `Value length ${value.length} is greater than maximum length ${schema.maxLength}`
                });
            }
            
            // Check enum
            if (schema.enum && !schema.enum.includes(value)) {
                errors.push({
                    path,
                    message: `Value "${value}" is not one of the allowed values: ${schema.enum.join(', ')}`
                });
            }
            
            break;
            
        case 'number':
        case 'integer':
            if (typeof value !== 'number') {
                errors.push({
                    path,
                    message: `Expected type "${schema.type}", got "${typeof value}"`
                });
                return errors;
            }
            
            if (schema.type === 'integer' && !Number.isInteger(value)) {
                errors.push({
                    path,
                    message: `Expected integer, got ${value}`
                });
            }
            
            // Check min/max
            if (schema.minimum !== undefined && value < schema.minimum) {
                errors.push({
                    path,
                    message: `Value ${value} is less than minimum ${schema.minimum}`
                });
            }
            
            if (schema.maximum !== undefined && value > schema.maximum) {
                errors.push({
                    path,
                    message: `Value ${value} is greater than maximum ${schema.maximum}`
                });
            }
            
            break;
            
        case 'boolean':
            if (typeof value !== 'boolean') {
                errors.push({
                    path,
                    message: `Expected type "boolean", got "${typeof value}"`
                });
            }
            break;
            
        case 'array':
            if (!Array.isArray(value)) {
                errors.push({
                    path,
                    message: `Expected type "array", got "${typeof value}"`
                });
                return errors;
            }
            
            // Check min/max items
            if (schema.minItems !== undefined && value.length < schema.minItems) {
                errors.push({
                    path,
                    message: `Array length ${value.length} is less than minimum length ${schema.minItems}`
                });
            }
            
            if (schema.maxItems !== undefined && value.length > schema.maxItems) {
                errors.push({
                    path,
                    message: `Array length ${value.length} is greater than maximum length ${schema.maxItems}`
                });
            }
            
            // Check items
            if (schema.items) {
                // If items is an array, validate each item against the corresponding schema
                if (Array.isArray(schema.items)) {
                    for (let i = 0; i < Math.min(value.length, schema.items.length); i++) {
                        const itemErrors = validateProperty(value[i], schema.items[i], `${path}[${i}]`);
                        errors.push(...itemErrors);
                    }
                } else {
                    // If items is a single schema, validate all items against it
                    for (let i = 0; i < value.length; i++) {
                        const itemErrors = validateProperty(value[i], schema.items, `${path}[${i}]`);
                        errors.push(...itemErrors);
                    }
                }
            }
            
            break;
            
        case 'object':
            if (typeof value !== 'object' || Array.isArray(value) || value === null) {
                errors.push({
                    path,
                    message: `Expected type "object", got "${typeof value}"`
                });
                return errors;
            }
            
            // For object properties, we would need the sub-schema to validate
            // This would require a recursive validation approach
            // For now, we'll just do a basic type check
            
            break;
            
        default:
            errors.push({
                path,
                message: `Unknown type "${schema.type}"`
            });
    }
    
    return errors;
}

/**
 * Formats validation errors into a human-readable string
 * @param errors Array of validation errors
 * @returns Human-readable error message
 */
export function formatValidationErrors(errors: ValidationError[]): string {
    if (errors.length === 0) {
        return '';
    }
    
    return errors.map(error => {
        const path = error.path ? error.path : 'input';
        return `${path}: ${error.message}`;
    }).join('\n');
}
