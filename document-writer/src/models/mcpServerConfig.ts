import * as vscode from 'vscode';

/**
 * MCP Server Configuration Interface
 * Defines the structure for MCP server configuration
 */
export interface MCPServerConfig {
    /**
     * Whether the MCP server is enabled
     */
    enabled: boolean;
    
    /**
     * The port to run the MCP server on
     */
    port: number;
    
    /**
     * The host to bind the MCP server to
     */
    host: string;
    
    /**
     * Authentication token for MCP server (if required)
     */
    authToken?: string;
    
    /**
     * Custom environment variables for the MCP server
     */
    env?: Record<string, string>;
    
    /**
     * The maximum number of concurrent requests
     */
    maxConcurrentRequests?: number;
    
    /**
     * Request timeout in milliseconds
     */
    requestTimeout?: number;
    
    /**
     * Path to custom plugins directory
     */
    pluginsPath?: string;
}

/**
 * Default MCP server configuration
 */
export const DEFAULT_MCP_SERVER_CONFIG: MCPServerConfig = {
    enabled: true,
    port: 8765,
    host: 'localhost',
    maxConcurrentRequests: 5,
    requestTimeout: 30000 // 30 seconds
};

/**
 * Class to handle MCP server configuration
 */
export class MCPServerConfigManager {
    private static readonly CONFIG_SECTION = 'documentWriter.mcp';
    
    /**
     * Load MCP server configuration from VS Code settings
     */
    public static loadConfig(): MCPServerConfig {
        const config = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        
        return {
            enabled: config.get<boolean>('enabled', DEFAULT_MCP_SERVER_CONFIG.enabled),
            port: config.get<number>('port', DEFAULT_MCP_SERVER_CONFIG.port),
            host: config.get<string>('host', DEFAULT_MCP_SERVER_CONFIG.host),
            authToken: config.get<string>('authToken'),
            env: config.get<Record<string, string>>('env'),
            maxConcurrentRequests: config.get<number>('maxConcurrentRequests') ?? DEFAULT_MCP_SERVER_CONFIG.maxConcurrentRequests,
            requestTimeout: config.get<number>('requestTimeout') ?? DEFAULT_MCP_SERVER_CONFIG.requestTimeout,
            pluginsPath: config.get<string>('pluginsPath')
        };
    }
    
    /**
     * Save MCP server configuration to VS Code settings
     * @param config The configuration to save
     */
    public static async saveConfig(config: MCPServerConfig): Promise<void> {
        const vscodeConfig = vscode.workspace.getConfiguration(this.CONFIG_SECTION);
        
        await vscodeConfig.update('enabled', config.enabled, vscode.ConfigurationTarget.Global);
        await vscodeConfig.update('port', config.port, vscode.ConfigurationTarget.Global);
        await vscodeConfig.update('host', config.host, vscode.ConfigurationTarget.Global);
        
        if (config.authToken) {
            await vscodeConfig.update('authToken', config.authToken, vscode.ConfigurationTarget.Global);
        }
        
        if (config.env) {
            await vscodeConfig.update('env', config.env, vscode.ConfigurationTarget.Global);
        }
        
        // Handle optional number fields with non-null assertion
        if (config.maxConcurrentRequests !== undefined) {
            // Non-null assertion (!) tells TypeScript we're sure this is not undefined
            await vscodeConfig.update('maxConcurrentRequests', config.maxConcurrentRequests!, vscode.ConfigurationTarget.Global);
        }
        
        if (config.requestTimeout !== undefined) {
            // Non-null assertion (!) tells TypeScript we're sure this is not undefined
            await vscodeConfig.update('requestTimeout', config.requestTimeout!, vscode.ConfigurationTarget.Global);
        }
        
        if (config.pluginsPath) {
            await vscodeConfig.update('pluginsPath', config.pluginsPath, vscode.ConfigurationTarget.Global);
        }
    }
}
