import * as vscode from 'vscode';
import * as http from 'http';
import { MCPTool } from '../models/mcpTool';
import { AnalyzeDocumentTool } from '../models/tools/analyzeDocumentTool';
import { GenerateChartTool } from '../models/tools/generateChartTool';
import { CreateDocumentTool } from '../models/tools/createDocumentTool';
import { DocumentService } from '../services/documentService';
import { TemplateEngine } from '../core/templateEngine';
import { ChartGenerator } from '../core/chartGenerator';

/**
 * Class that handles integration with Cline via the MCP protocol
 */
export class ClineIntegration implements vscode.Disposable {
    private server: http.Server | null = null;
    private port: number = 0;
    private readonly tools: Map<string, MCPTool> = new Map();
    private readonly defaultPort: number = 9876; // Default port for the MCP server
    private isRegistered: boolean = false;

    /**
     * Implement dispose method required by vscode.Disposable
     */
    public dispose(): void {
        this.stop();
    }

    /**
     * Initialize the MCP server
     * @returns Promise that resolves to true if initialization was successful, false otherwise
     */
    public async initialize(): Promise<boolean> {
        try {
            await this.start();
            return true;
        } catch (error) {
            console.error('Failed to initialize ClineIntegration:', error);
            return false;
        }
    }

    constructor(private readonly context: vscode.ExtensionContext) {
        // Register the built-in tools
        this.registerBuiltInTools();
    }

    /**
     * Register built-in MCP tools
     */
    private registerBuiltInTools(): void {
        // Create service instances
        const documentService = new DocumentService(this.context);
        const templateEngine = new TemplateEngine(this.context);
        const chartGenerator = new ChartGenerator(this.context);

        // Register the document analysis tool
        this.registerTool(new AnalyzeDocumentTool());
        
        // Register the chart generation tool
        this.registerTool(new GenerateChartTool(chartGenerator));
        
        // Register the document creation tool
        this.registerTool(new CreateDocumentTool(documentService, templateEngine));
    }

    /**
     * Register a tool with the MCP server
     * @param tool The tool to register
     */
    public registerTool(tool: MCPTool): void {
        if (this.tools.has(tool.name)) {
            console.warn(`Tool with name "${tool.name}" is already registered. Overwriting...`);
        }
        
        this.tools.set(tool.name, tool);
        console.log(`Registered tool: ${tool.name}`);
    }

    /**
     * Start the MCP server
     */
    public async start(): Promise<void> {
        try {
            // Create the server
            this.server = http.createServer(this.handleRequest.bind(this));
            
            // Find an available port
            this.port = await this.findAvailablePort(this.defaultPort);
            
            // Start listening on the port
            this.server.listen(this.port, () => {
                console.log(`MCP server started on port ${this.port}`);
                
                // Register the server with VS Code
                this.registerWithVSCode();
            });
            
            // Handle server errors
            this.server.on('error', (err) => {
                console.error('MCP server error:', err);
                vscode.window.showErrorMessage(`MCP server error: ${err.message}`);
            });
        } catch (error) {
            console.error('Failed to start MCP server:', error);
            vscode.window.showErrorMessage(`Failed to start MCP server: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Stop the MCP server
     */
    public stop(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
            this.port = 0;
            this.isRegistered = false;
            console.log('MCP server stopped');
        }
    }

    /**
     * Handle incoming HTTP requests to the MCP server
     * @param req HTTP request
     * @param res HTTP response
     */
    private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            // Set CORS headers
            res.setHeader('Access-Control-Allow-Origin', '*');
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
            
            // Handle OPTIONS requests (preflight)
            if (req.method === 'OPTIONS') {
                res.writeHead(200);
                res.end();
                return;
            }
            
            // Only handle POST requests for tool execution
            if (req.method !== 'POST' || !req.url) {
                res.writeHead(405);
                res.end(JSON.stringify({ error: 'Method not allowed' }));
                return;
            }
            
            // Parse the URL to determine the endpoint
            const url = new URL(req.url, `http://localhost:${this.port}`);
            const endpoint = url.pathname;
            
            // Handle different endpoints
            if (endpoint === '/mcp/list_tools') {
                await this.handleListTools(req, res);
            } else if (endpoint === '/mcp/execute_tool') {
                await this.handleExecuteTool(req, res);
            } else {
                res.writeHead(404);
                res.end(JSON.stringify({ error: 'Endpoint not found' }));
            }
        } catch (error) {
            console.error('Error handling request:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: `Internal server error: ${error instanceof Error ? error.message : String(error)}` }));
        }
    }

    /**
     * Handle requests to list available tools
     * @param req HTTP request
     * @param res HTTP response
     */
    private async handleListTools(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        // Collect information about registered tools
        const toolsInfo = Array.from(this.tools.values()).map(tool => ({
            name: tool.name,
            description: tool.description,
            inputSchema: tool.inputSchema
        }));
        
        // Return the list of tools
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({
            server_name: 'document-writer',
            tools: toolsInfo
        }));
    }

    /**
     * Handle requests to execute a tool
     * @param req HTTP request
     * @param res HTTP response
     */
    private async handleExecuteTool(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        try {
            // Read the request body
            const body = await this.readRequestBody(req);
            const request = JSON.parse(body);
            
            // Validate the request
            if (!request.tool_name || !request.arguments) {
                res.writeHead(400);
                res.end(JSON.stringify({ error: 'Invalid request: tool_name and arguments are required' }));
                return;
            }
            
            // Get the requested tool
            const tool = this.tools.get(request.tool_name);
            if (!tool) {
                res.writeHead(404);
                res.end(JSON.stringify({ error: `Tool not found: ${request.tool_name}` }));
                return;
            }
            
            // Execute the tool
            console.log(`Executing tool: ${tool.name}`);
            const result = await tool.execute(request.arguments);
            
            // Return the result
            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ result }));
        } catch (error) {
            console.error('Error executing tool:', error);
            res.writeHead(500);
            res.end(JSON.stringify({ error: `Error executing tool: ${error instanceof Error ? error.message : String(error)}` }));
        }
    }

    /**
     * Read the request body from an HTTP request
     * @param req HTTP request
     * @returns Promise that resolves to the request body as a string
     */
    private readRequestBody(req: http.IncomingMessage): Promise<string> {
        return new Promise<string>((resolve, reject) => {
            const chunks: Buffer[] = [];
            
            req.on('data', (chunk: Buffer) => {
                chunks.push(chunk);
            });
            
            req.on('end', () => {
                resolve(Buffer.concat(chunks).toString());
            });
            
            req.on('error', (err) => {
                reject(err);
            });
        });
    }

    /**
     * Find an available port to use for the MCP server
     * @param startPort The port to start checking from
     * @returns Promise that resolves to an available port
     */
    private findAvailablePort(startPort: number): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            const server = http.createServer();
            
            server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    // Port is in use, try the next one
                    server.close(() => {
                        resolve(this.findAvailablePort(startPort + 1));
                    });
                } else {
                    reject(err);
                }
            });
            
            server.listen(startPort, () => {
                server.close(() => {
                    resolve(startPort);
                });
            });
        });
    }

    /**
     * Register the MCP server with VS Code
     */
    private registerWithVSCode(): void {
        try {
            if (!this.isRegistered && this.port > 0) {
                // Check if the cline namespace is available
                if (vscode.cline) {
                    vscode.cline.registerMCPServer({
                        name: 'document-writer',
                        port: this.port
                    });
                    
                    this.isRegistered = true;
                    console.log('MCP server registered with VS Code');
                } else {
                    console.warn('VS Code API does not include cline namespace. MCP server will not be registered.');
                    vscode.window.showWarningMessage('Cline API not available. Some features may not work properly.');
                }
            }
        } catch (error) {
            console.error('Failed to register MCP server with VS Code:', error);
            vscode.window.showErrorMessage(`Failed to register MCP server: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
