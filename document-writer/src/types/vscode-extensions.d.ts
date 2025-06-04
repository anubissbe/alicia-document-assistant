/**
 * Type definitions for VS Code extensions to the VS Code API
 * that are not included in the standard @types/vscode package
 */

import * as vscode from 'vscode';

declare module 'vscode' {
    /**
     * Cline integration namespace
     */
    export namespace cline {
        /**
         * Register an MCP server with VS Code
         * @param options Server registration options
         */
        export function registerMCPServer(options: MCPServerOptions): void;

        /**
         * Options for registering an MCP server
         */
        export interface MCPServerOptions {
            /**
             * Name of the server (should match the name in package.json)
             */
            name: string;
            
            /**
             * Port the server is running on
             */
            port: number;
        }
    }
}
