import { SchemaTypes, validateAgainstSchema, validateObject, createSchemaFromInterface } from '../../utils/schemaValidator';

describe('SchemaValidator', () => {
    describe('SchemaTypes', () => {
        it('should create string type definition', () => {
            const schema = SchemaTypes.string('Test string');
            expect(schema).toEqual({
                type: 'string',
                description: 'Test string'
            });
        });

        it('should create string type with format', () => {
            const schema = SchemaTypes.string('Test email', 'email');
            expect(schema).toEqual({
                type: 'string',
                description: 'Test email',
                format: 'email'
            });
        });

        it('should create number type definition', () => {
            const schema = SchemaTypes.number('Test number', 0, 100);
            expect(schema).toEqual({
                type: 'number',
                description: 'Test number',
                minimum: 0,
                maximum: 100
            });
        });

        it('should create integer type definition', () => {
            const schema = SchemaTypes.integer('Test integer', 1, 10);
            expect(schema).toEqual({
                type: 'integer',
                description: 'Test integer',
                minimum: 1,
                maximum: 10
            });
        });

        it('should create boolean type definition', () => {
            const schema = SchemaTypes.boolean('Test boolean');
            expect(schema).toEqual({
                type: 'boolean',
                description: 'Test boolean'
            });
        });

        it('should create array type definition', () => {
            const itemsSchema = { type: 'string' };
            const schema = SchemaTypes.array(itemsSchema, 'Test array', 1, 5);
            expect(schema).toEqual({
                type: 'array',
                items: itemsSchema,
                description: 'Test array',
                minItems: 1,
                maxItems: 5
            });
        });

        it('should create object type definition', () => {
            const properties = {
                name: { type: 'string' },
                age: { type: 'integer' }
            };
            const schema = SchemaTypes.object(properties, ['name'], 'Test object');
            expect(schema).toEqual({
                type: 'object',
                properties,
                required: ['name'],
                additionalProperties: false,
                description: 'Test object'
            });
        });

        it('should create enum type definition', () => {
            const schema = SchemaTypes.enum(['red', 'green', 'blue'], 'Test enum');
            expect(schema).toEqual({
                enum: ['red', 'green', 'blue'],
                description: 'Test enum'
            });
        });

        it('should create email type definition', () => {
            const schema = SchemaTypes.email('Test email');
            expect(schema).toEqual({
                type: 'string',
                format: 'email',
                description: 'Test email'
            });
        });

        it('should create uri type definition', () => {
            const schema = SchemaTypes.uri('Test URI');
            expect(schema).toEqual({
                type: 'string',
                format: 'uri',
                description: 'Test URI'
            });
        });

        it('should create date type definition', () => {
            const schema = SchemaTypes.date('Test date');
            expect(schema).toEqual({
                type: 'string',
                format: 'date',
                description: 'Test date'
            });
        });

        it('should create date-time type definition', () => {
            const schema = SchemaTypes.dateTime('Test date-time');
            expect(schema).toEqual({
                type: 'string',
                format: 'date-time',
                description: 'Test date-time'
            });
        });
    });

    describe('validateAgainstSchema', () => {
        it('should validate valid data', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer', minimum: 0 }
                },
                required: ['name']
            };
            
            const data = { name: 'John', age: 30 };
            const errors = validateAgainstSchema(data, schema);
            
            expect(errors).toEqual([]);
        });

        it('should return errors for invalid data', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer', minimum: 0 }
                },
                required: ['name', 'age']
            };
            
            const data = { name: 'John' };
            const errors = validateAgainstSchema(data, schema);
            
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('Missing required property: age');
        });

        it('should validate type errors', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer' }
                }
            };
            
            const data = { name: 'John', age: 'thirty' };
            const errors = validateAgainstSchema(data, schema);
            
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('Invalid type');
        });

        it('should validate number constraints', () => {
            const schema = {
                type: 'object',
                properties: {
                    score: { type: 'number', minimum: 0, maximum: 100 }
                }
            };
            
            const data = { score: 150 };
            const errors = validateAgainstSchema(data, schema);
            
            expect(errors.length).toBeGreaterThan(0);
            expect(errors[0]).toContain('Invalid value');
        });

        it('should handle schema validation errors', () => {
            // Invalid schema (missing type)
            const schema = {
                properties: {
                    name: { type: 'string' }
                }
            };
            
            const data = { name: 'John' };
            const errors = validateAgainstSchema(data, schema);
            
            expect(errors.length).toBeGreaterThan(0);
        });
    });

    describe('validateObject', () => {
        it('should validate and return valid object', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer', minimum: 0 }
                },
                required: ['name']
            };
            
            const data = { name: 'John', age: 30 };
            const result = validateObject(data, 'person', schema);
            
            expect(result.valid).toBe(true);
            expect(result.value).toEqual(data);
            expect(result.errors).toEqual([]);
        });

        it('should return validation errors for invalid object', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' },
                    age: { type: 'integer', minimum: 0 }
                },
                required: ['name', 'age']
            };
            
            const data = { name: 'John' };
            const result = validateObject(data, 'person', schema);
            
            expect(result.valid).toBe(false);
            expect(result.value).toBeNull();
            expect(result.errors.length).toBeGreaterThan(0);
        });

        it('should coerce types when option is enabled', () => {
            const schema = {
                type: 'object',
                properties: {
                    age: { type: 'integer' },
                    active: { type: 'boolean' }
                }
            };
            
            const data = { age: '25', active: 1 };
            const result = validateObject(data, 'person', schema, { coerceTypes: true });
            
            expect(result.valid).toBe(true);
            expect(result.value).toBeDefined();
            if (result.value) {
                expect(typeof result.value.age).toBe('number');
                expect(typeof result.value.active).toBe('boolean');
            }
        });

        it('should handle schema not found', () => {
            const schema = {
                type: 'object',
                properties: {
                    name: { type: 'string' }
                }
            };
            
            const data = { name: 'John' };
            // Using wrong schema ID to trigger not found error
            const result = validateObject(data, 'nonExistentSchema', schema);
            
            expect(result.valid).toBe(false);
            expect(result.errors[0]).toContain('Schema with ID nonExistentSchema not found');
        });

        it('should handle unexpected validation errors', () => {
            // Force an error by passing invalid arguments
            const result = validateObject(null, 'person', null);
            
            expect(result.valid).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
        });
    });

    describe('createSchemaFromInterface', () => {
        it('should create a JSON schema from interface definition', () => {
            const properties = {
                name: { type: 'string' },
                age: { type: 'integer' }
            };
            const required = ['name'];
            
            const schema = createSchemaFromInterface('Person', properties, required);
            
            expect(schema).toEqual({
                $id: 'schema:Person',
                type: 'object',
                title: 'Person',
                properties,
                required,
                additionalProperties: false
            });
        });

        it('should create a schema with empty required array if not provided', () => {
            const properties = {
                name: { type: 'string' }
            };
            
            const schema = createSchemaFromInterface('SimpleObject', properties);
            
            expect(schema).toEqual({
                $id: 'schema:SimpleObject',
                type: 'object',
                title: 'SimpleObject',
                properties,
                required: [],
                additionalProperties: false
            });
        });
    });
});
