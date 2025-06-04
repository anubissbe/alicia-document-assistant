/**
 * Interface for template variables
 */
export interface TemplateVariable {
    /**
     * Name of the variable
     */
    name: string;

    /**
     * Type of the variable
     */
    type: 'string' | 'number' | 'boolean' | 'array' | 'object' | 'date';

    /**
     * Whether the variable is required
     */
    required: boolean;

    /**
     * Description of the variable
     */
    description: string;

    /**
     * Default value for the variable
     */
    default?: any;
}

/**
 * Interface for template metadata
 */
export interface TemplateMetadata {
    /**
     * Name of the template
     */
    name: string;

    /**
     * Description of the template
     */
    description: string;

    /**
     * Type of the template (e.g., report, letter, proposal)
     */
    type: string;

    /**
     * Version of the template
     */
    version: string;

    /**
     * Author of the template
     */
    author: string;

    /**
     * Variables used in the template
     */
    variables: TemplateVariable[];

    /**
     * Sections in the template
     */
    sections: string[];
}
