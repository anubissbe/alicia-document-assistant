import * as vscode from 'vscode';
import { AssistantMessage } from './documentAssistant';

/**
 * Interface for conversation history messages in a format suitable for content generation
 */
export interface HistoryMessage {
    role: 'user' | 'assistant';
    content: string;
}

/**
 * ConversationHistoryManager manages the conversation history for the document assistant
 */
export class ConversationHistoryManager {
    private _messages: AssistantMessage[] = [];
    private _maxHistoryLength: number = 50;
    
    /**
     * Constructor
     * @param maxHistoryLength Optional maximum number of messages to keep in history
     */
    constructor(maxHistoryLength?: number) {
        if (maxHistoryLength && maxHistoryLength > 0) {
            this._maxHistoryLength = maxHistoryLength;
        }
    }
    
    /**
     * Add a message to the conversation history
     * @param message The message to add
     */
    public addMessage(message: AssistantMessage): void {
        this._messages.push(message);
        
        // Trim history if it exceeds the maximum length
        if (this._messages.length > this._maxHistoryLength) {
            this._messages = this._messages.slice(this._messages.length - this._maxHistoryLength);
        }
    }
    
    /**
     * Get all messages in the conversation history
     * @returns Array of all messages
     */
    public getMessages(): AssistantMessage[] {
        return [...this._messages];
    }
    
    /**
     * Get a limited number of most recent messages
     * @param count Number of messages to retrieve
     * @returns Array of most recent messages
     */
    public getRecentMessages(count: number): AssistantMessage[] {
        if (count <= 0) {
            return [];
        }
        
        return this._messages.slice(-Math.min(count, this._messages.length));
    }
    
    /**
     * Clear the conversation history
     */
    public clearHistory(): void {
        this._messages = [];
    }
    
    /**
     * Convert assistant messages to a format suitable for content generation
     * @param messages Array of assistant messages to convert
     * @returns Array of history messages
     */
    public convertToHistoryMessages(messages: AssistantMessage[]): HistoryMessage[] {
        return messages.map(message => ({
            role: message.type,
            content: message.content
        }));
    }
    
    /**
     * Convert history messages to a string format
     * @param messages Array of history messages to convert
     * @returns String representation of the conversation
     */
    public convertToString(messages: HistoryMessage[]): string {
        return messages.map(message => 
            `${message.role === 'user' ? 'User' : 'Assistant'}: ${message.content}`
        ).join('\n\n');
    }
    
    /**
     * Export the conversation history to a file
     * @param filePath The file path to export to
     * @returns Promise resolving to true if successful, false otherwise
     */
    public async exportToFile(filePath: string): Promise<boolean> {
        try {
            const exportData = {
                timestamp: new Date().toISOString(),
                messages: this._messages
            };
            
            const jsonData = JSON.stringify(exportData, null, 2);
            const writeData = Buffer.from(jsonData, 'utf8');
            
            await vscode.workspace.fs.writeFile(vscode.Uri.file(filePath), writeData);
            return true;
        } catch (error) {
            console.error('Error exporting conversation history:', error);
            return false;
        }
    }
    
    /**
     * Import conversation history from a file
     * @param filePath The file path to import from
     * @returns Promise resolving to true if successful, false otherwise
     */
    public async importFromFile(filePath: string): Promise<boolean> {
        try {
            const readData = await vscode.workspace.fs.readFile(vscode.Uri.file(filePath));
            const jsonData = Buffer.from(readData).toString('utf8');
            const importData = JSON.parse(jsonData);
            
            // Validate the import data
            if (!importData.messages || !Array.isArray(importData.messages)) {
                throw new Error('Invalid conversation history format');
            }
            
            // Process the imported messages
            const messages: AssistantMessage[] = importData.messages.map((message: any) => {
                // Convert string timestamps back to Date objects
                if (typeof message.timestamp === 'string') {
                    message.timestamp = new Date(message.timestamp);
                }
                
                return message;
            });
            
            // Replace the current history
            this._messages = messages;
            return true;
        } catch (error) {
            console.error('Error importing conversation history:', error);
            return false;
        }
    }
}
