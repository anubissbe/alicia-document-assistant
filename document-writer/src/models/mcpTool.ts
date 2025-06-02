/**
 * Interface for MCP tool responses
 */
export interface MCPToolResponse {
    [key: string]: any;
}

/**
 * Interface for MCP tool input schema
 */
export interface MCPToolInputSchema {
    type: string;
    properties: Record<string, any>;
    required?: string[];
    additionalProperties?: boolean;
    $schema?: string;
}

/**
 * Interface for MCP tools
 */
export interface MCPTool {
    /**
     * Name of the tool
     */
    name: string;

    /**
     * Description of the tool
     */
    description: string;

    /**
     * JSON Schema for the tool's input
     */
    inputSchema: MCPToolInputSchema;

    /**
     * Execute the tool with the given arguments
     * @param args Arguments for the tool
     * @returns Promise that resolves to the tool's response
     */
    execute(args: any): Promise<MCPToolResponse>;
}

/**
 * Abstract base class for MCP tools
 */
export abstract class BaseMCPTool implements MCPTool {
    /**
     * Constructor
     * @param name Name of the tool
     * @param description Description of the tool
     * @param inputSchema JSON Schema for the tool's input
     */
    constructor(
        public readonly name: string,
        public readonly description: string,
        public readonly inputSchema: MCPToolInputSchema
    ) {}

    /**
     * Execute the tool with the given arguments
     * @param args Arguments for the tool
     */
    abstract execute(args: any): Promise<MCPToolResponse>;
}
