import * as vscode from 'vscode';

/**
 * WebviewState represents the persistent state of a webview
 */
export interface WebviewState {
    id: string;
    type: string;
    lastUpdated: number;
    data: Record<string, any>;
}

/**
 * WebviewStateManager handles state management for webviews
 * It provides a centralized way to store and retrieve state for all webviews
 */
export class WebviewStateManager {
    private static instance: WebviewStateManager;
    private stateMap: Map<string, WebviewState>;
    private context: vscode.ExtensionContext | undefined;
    private static readonly STATE_KEY = 'documentWriter.webviewStates';
    
    /**
     * Private constructor - use getInstance()
     */
    private constructor() {
        this.stateMap = new Map<string, WebviewState>();
    }
    
    /**
     * Get singleton instance
     * @returns WebviewStateManager instance
     */
    public static getInstance(): WebviewStateManager {
        if (!WebviewStateManager.instance) {
            WebviewStateManager.instance = new WebviewStateManager();
        }
        return WebviewStateManager.instance;
    }
    
    /**
     * Initialize with extension context
     * @param context Extension context
     */
    public initialize(context: vscode.ExtensionContext): void {
        this.context = context;
        
        // Load saved states from global state
        const savedStates = this.context.globalState.get<Record<string, WebviewState>>(WebviewStateManager.STATE_KEY);
        if (savedStates) {
            Object.values(savedStates).forEach(state => {
                this.stateMap.set(state.id, state);
            });
        }
    }
    
    /**
     * Create a new webview state
     * @param id Unique identifier for the webview
     * @param type Type of webview (e.g., 'preview', 'editor', 'wizard')
     * @param initialData Initial data for the webview
     * @returns The created WebviewState
     */
    public createState(id: string, type: string, initialData: Record<string, any> = {}): WebviewState {
        const state: WebviewState = {
            id,
            type,
            lastUpdated: Date.now(),
            data: initialData
        };
        
        this.stateMap.set(id, state);
        this.saveStates();
        
        return state;
    }
    
    /**
     * Get a webview state by ID
     * @param id Webview state ID
     * @returns The WebviewState or undefined if not found
     */
    public getState(id: string): WebviewState | undefined {
        return this.stateMap.get(id);
    }
    
    /**
     * Update webview state
     * @param id Webview state ID
     * @param data New data to merge with existing data
     * @returns Updated WebviewState or undefined if not found
     */
    public updateState(id: string, data: Record<string, any>): WebviewState | undefined {
        const state = this.stateMap.get(id);
        if (!state) {
            return undefined;
        }
        
        // Merge new data with existing data
        state.data = {
            ...state.data,
            ...data
        };
        
        state.lastUpdated = Date.now();
        this.stateMap.set(id, state);
        this.saveStates();
        
        return state;
    }
    
    /**
     * Delete a webview state
     * @param id Webview state ID
     * @returns True if deleted, false if not found
     */
    public deleteState(id: string): boolean {
        const result = this.stateMap.delete(id);
        if (result) {
            this.saveStates();
        }
        return result;
    }
    
    /**
     * Get all states of a specific type
     * @param type Webview type
     * @returns Array of WebviewState objects of the specified type
     */
    public getStatesByType(type: string): WebviewState[] {
        return Array.from(this.stateMap.values())
            .filter(state => state.type === type);
    }
    
    /**
     * Save states to extension context
     */
    private saveStates(): void {
        if (!this.context) {
            return;
        }
        
        const statesObj: Record<string, WebviewState> = {};
        this.stateMap.forEach((state, id) => {
            statesObj[id] = state;
        });
        
        this.context.globalState.update(WebviewStateManager.STATE_KEY, statesObj);
    }
    
    /**
     * Clear all webview states
     */
    public clearAllStates(): void {
        this.stateMap.clear();
        if (this.context) {
            this.context.globalState.update(WebviewStateManager.STATE_KEY, undefined);
        }
    }
}

/**
 * WebviewStateProvider interface for webview providers that use state management
 */
export interface WebviewStateProvider {
    /**
     * Get the webview state ID
     */
    getStateId(): string;
    
    /**
     * Get the webview state type
     */
    getStateType(): string;
    
    /**
     * Save current state
     */
    saveState(): Promise<void>;
    
    /**
     * Load saved state
     */
    loadState(): Promise<boolean>;
}
