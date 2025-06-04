/**
 * previewOptions.ts
 * Defines types and classes for document preview options
 */

import * as vscode from 'vscode';
import { DocumentFormat } from './documentFormat';

// Re-export DocumentFormat for backward compatibility
export { DocumentFormat };

/**
 * Preview toolbar button interface
 */
export interface PreviewToolbarButton {
    /**
     * Button action
     */
    action: string;
    
    /**
     * Button label
     */
    label: string;
    
    /**
     * Button icon
     */
    icon: string;
    
    /**
     * Button tooltip
     */
    tooltip?: string;
}

/**
 * Preview toolbar options interface
 */
export interface PreviewToolbarOptions {
    /**
     * Show toolbar
     */
    show: boolean;
    
    /**
     * Toolbar position
     */
    position: 'top' | 'bottom' | 'left' | 'right';
    
    /**
     * Show page navigation
     */
    showPageNavigation: boolean;
    
    /**
     * Show zoom controls
     */
    showZoomControls: boolean;
    
    /**
     * Show annotation tools
     */
    showAnnotationTools: boolean;
    
    /**
     * Show export options
     */
    showExportOptions: boolean;
    
    /**
     * Show print button
     */
    showPrintButton: boolean;
    
    /**
     * Custom buttons
     */
    customButtons?: PreviewToolbarButton[];
}

/**
 * Preview appearance options interface
 */
export interface PreviewAppearanceOptions {
    /**
     * Theme
     */
    theme: 'light' | 'dark' | 'auto';
    
    /**
     * Font family
     */
    fontFamily?: string;
    
    /**
     * Font size
     */
    fontSize?: number;
    
    /**
     * Line height
     */
    lineHeight?: number;
    
    /**
     * Text alignment
     */
    textAlign?: 'left' | 'center' | 'right' | 'justify';
    
    /**
     * Page margins
     */
    margins?: {
        /**
         * Top margin
         */
        top?: number;
        
        /**
         * Right margin
         */
        right?: number;
        
        /**
         * Bottom margin
         */
        bottom?: number;
        
        /**
         * Left margin
         */
        left?: number;
    };
    
    /**
     * Show line numbers
     */
    showLineNumbers?: boolean;
    
    /**
     * Use custom CSS
     */
    useCustomCSS?: boolean;
}

/**
 * Preview processing options interface
 */
export interface PreviewProcessingOptions {
    /**
     * Enable syntax highlighting
     */
    syntaxHighlighting: boolean;
    
    /**
     * Render math expressions
     */
    renderMath: boolean;
    
    /**
     * Render diagrams
     */
    renderDiagrams: boolean;
    
    /**
     * Auto-update preview
     */
    autoUpdate: boolean;
    
    /**
     * Apply transformations
     */
    applyTransformations: boolean;
    
    /**
     * Delay before update (ms)
     */
    updateDelay?: number;
}

/**
 * Preview annotations options interface
 */
export interface PreviewAnnotationsOptions {
    /**
     * Enable annotations
     */
    enabled: boolean;
    
    /**
     * Show annotations by default
     */
    visible: boolean;
    
    /**
     * Show annotation markers
     */
    showMarkers: boolean;
    
    /**
     * Annotation panel position
     */
    panelPosition: 'right' | 'bottom' | 'overlay';
    
    /**
     * Allow adding annotations
     */
    allowAdding: boolean;
    
    /**
     * Allow editing annotations
     */
    allowEditing: boolean;
    
    /**
     * Allow deleting annotations
     */
    allowDeleting: boolean;
    
    /**
     * Highlight associated text
     */
    highlightText: boolean;
    
    /**
     * Default annotation type
     */
    defaultType?: string;
}

/**
 * Preview options interface
 */
export interface PreviewOptions {
    /**
     * Zoom level (1.0 = 100%)
     */
    zoomLevel: number;
    
    /**
     * Enable responsive mode
     */
    responsive: boolean;
    
    /**
     * Toolbar options
     */
    toolbar: PreviewToolbarOptions;
    
    /**
     * Appearance options
     */
    appearance: PreviewAppearanceOptions;
    
    /**
     * Processing options
     */
    processing: PreviewProcessingOptions;
    
    /**
     * Annotations options
     */
    annotations: PreviewAnnotationsOptions;
    
    /**
     * Custom CSS
     */
    customCSS?: string;
    
    /**
     * Custom JavaScript
     */
    customJS?: string;
    
    /**
     * Format-specific options
     */
    formatOptions?: {
        [format in DocumentFormat]?: any;
    };
}

/**
 * Preview options manager class
 */
export class PreviewOptionsManager {
    /**
     * Singleton instance
     */
    private static instance: PreviewOptionsManager;
    
    /**
     * Options map by document URI
     */
    private options: Map<string, PreviewOptions> = new Map();
    
    /**
     * Default options by format
     */
    private defaultOptions: Map<DocumentFormat, PreviewOptions> = new Map();
    
    /**
     * Global options
     */
    private globalOptions: Partial<PreviewOptions> = {};
    
    /**
     * Private constructor (singleton)
     */
    private constructor() {
        this.initializeDefaultOptions();
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(): PreviewOptionsManager {
        if (!PreviewOptionsManager.instance) {
            PreviewOptionsManager.instance = new PreviewOptionsManager();
        }
        return PreviewOptionsManager.instance;
    }
    
    /**
     * Initialize default options
     */
    private initializeDefaultOptions(): void {
        // Default options for all formats
        const baseOptions: PreviewOptions = {
            zoomLevel: 1.0,
            responsive: true,
            toolbar: {
                show: true,
                position: 'top',
                showPageNavigation: true,
                showZoomControls: true,
                showAnnotationTools: true,
                showExportOptions: true,
                showPrintButton: true
            },
            appearance: {
                theme: 'auto',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'left',
                margins: {
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 20
                },
                showLineNumbers: false
            },
            processing: {
                syntaxHighlighting: true,
                renderMath: true,
                renderDiagrams: true,
                autoUpdate: true,
                applyTransformations: true,
                updateDelay: 300
            },
            annotations: {
                enabled: true,
                visible: false,
                showMarkers: true,
                panelPosition: 'right',
                allowAdding: true,
                allowEditing: true,
                allowDeleting: true,
                highlightText: true
            }
        };
        
        // Set default options for all formats
        Object.values(DocumentFormat).forEach(format => {
            this.defaultOptions.set(format, { ...baseOptions });
        });
        
        // Customize for specific formats
        
        // Markdown-specific options
        this.defaultOptions.set(DocumentFormat.MARKDOWN, {
            ...baseOptions,
            processing: {
                ...baseOptions.processing,
                syntaxHighlighting: true,
                renderMath: true,
                renderDiagrams: true
            },
            formatOptions: {
                [DocumentFormat.MARKDOWN]: {
                    breaks: true,
                    linkify: true,
                    typographer: true
                }
            }
        });
        
        // HTML-specific options
        this.defaultOptions.set(DocumentFormat.HTML, {
            ...baseOptions,
            processing: {
                ...baseOptions.processing,
                syntaxHighlighting: true,
                renderMath: false,
                renderDiagrams: false
            },
            formatOptions: {
                [DocumentFormat.HTML]: {
                    sanitize: true,
                    allowScripts: false,
                    allowIframes: false,
                    allowImages: true
                }
            }
        });
        
        // PDF-specific options
        this.defaultOptions.set(DocumentFormat.PDF, {
            ...baseOptions,
            toolbar: {
                ...baseOptions.toolbar,
                showPageNavigation: true,
                showZoomControls: true,
                showAnnotationTools: true,
                showExportOptions: false,
                showPrintButton: true
            },
            formatOptions: {
                [DocumentFormat.PDF]: {
                    showThumbnails: true,
                    pagingMode: 'continuous',
                    fitToWidth: true
                }
            }
        });
        
        // DOCX-specific options
        this.defaultOptions.set(DocumentFormat.DOCX, {
            ...baseOptions,
            toolbar: {
                ...baseOptions.toolbar,
                showPageNavigation: true,
                showZoomControls: true,
                showAnnotationTools: true,
                showExportOptions: true,
                showPrintButton: true
            },
            formatOptions: {
                [DocumentFormat.DOCX]: {
                    preserveStyles: true,
                    preserveImages: true,
                    preserveTables: true
                }
            }
        });
    }
    
    /**
     * Load options for document
     */
    public async loadOptionsForDocument(documentUri: vscode.Uri): Promise<Partial<PreviewOptions>> {
        const uriString = documentUri.toString();
        
        // Check if already loaded
        if (this.options.has(uriString)) {
            return this.options.get(uriString) || {};
        }
        
        try {
            // In a real implementation, this would load from persistent storage
            // For now, return an empty object
            return {};
        } catch (error) {
            console.error('Error loading preview options:', error);
            return {};
        }
    }
    
    /**
     * Save options for document
     */
    public async saveOptionsForDocument(
        documentUri: vscode.Uri,
        options: Partial<PreviewOptions>,
        format: DocumentFormat = DocumentFormat.MARKDOWN
    ): Promise<boolean> {
        const uriString = documentUri.toString();
        
        try {
            // Get existing options or use defaults for this format
            const existingOptions = this.options.has(uriString)
                ? this.options.get(uriString)!
                : this.getDefaultOptions(format);
            
            // Create a complete options object by merging
            const completeOptions: PreviewOptions = {
                zoomLevel: options.zoomLevel ?? existingOptions.zoomLevel,
                responsive: options.responsive ?? existingOptions.responsive,
                toolbar: { ...existingOptions.toolbar, ...options.toolbar },
                appearance: { ...existingOptions.appearance, ...options.appearance },
                processing: { ...existingOptions.processing, ...options.processing },
                annotations: { ...existingOptions.annotations, ...options.annotations },
                customCSS: options.customCSS ?? existingOptions.customCSS,
                customJS: options.customJS ?? existingOptions.customJS,
                formatOptions: { ...existingOptions.formatOptions, ...options.formatOptions }
            };
            
            // In a real implementation, this would save to persistent storage
            this.options.set(uriString, completeOptions);
            
            return true;
        } catch (error) {
            console.error('Error saving preview options:', error);
            return false;
        }
    }
    
    /**
     * Reset options for document to defaults
     */
    public async resetOptionsForDocument(
        documentUri: vscode.Uri,
        format: DocumentFormat
    ): Promise<boolean> {
        const uriString = documentUri.toString();
        
        try {
            // Remove document-specific options
            this.options.delete(uriString);
            
            return true;
        } catch (error) {
            console.error('Error resetting preview options:', error);
            return false;
        }
    }
    
    /**
     * Get default options for format
     */
    public getDefaultOptions(format: DocumentFormat): PreviewOptions {
        return this.defaultOptions.get(format) || this.getDefaultBaseOptions();
    }
    
    /**
     * Get default base options
     */
    private getDefaultBaseOptions(): PreviewOptions {
        return {
            zoomLevel: 1.0,
            responsive: true,
            toolbar: {
                show: true,
                position: 'top',
                showPageNavigation: true,
                showZoomControls: true,
                showAnnotationTools: true,
                showExportOptions: true,
                showPrintButton: true
            },
            appearance: {
                theme: 'auto',
                fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Oxygen, Ubuntu, Cantarell, "Open Sans", "Helvetica Neue", sans-serif',
                fontSize: 14,
                lineHeight: 1.5,
                textAlign: 'left',
                margins: {
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 20
                },
                showLineNumbers: false
            },
            processing: {
                syntaxHighlighting: true,
                renderMath: true,
                renderDiagrams: true,
                autoUpdate: true,
                applyTransformations: true,
                updateDelay: 300
            },
            annotations: {
                enabled: true,
                visible: false,
                showMarkers: true,
                panelPosition: 'right',
                allowAdding: true,
                allowEditing: true,
                allowDeleting: true,
                highlightText: true
            }
        };
    }
    
    /**
     * Set global options
     */
    public setGlobalOptions(options: Partial<PreviewOptions>): void {
        this.globalOptions = { ...this.globalOptions, ...options };
    }
    
    /**
     * Get global options
     */
    public getGlobalOptions(): Partial<PreviewOptions> {
        return this.globalOptions;
    }
    
    /**
     * Merge options with defaults
     */
    public mergeWithDefaults(
        options: Partial<PreviewOptions>,
        format: DocumentFormat
    ): PreviewOptions {
        // Get default options for format
        const defaultOptions = this.getDefaultOptions(format);
        
        // Create a copy of the default options
        const result: PreviewOptions = { ...defaultOptions };
        
        // Apply global options if available
        if (this.globalOptions.zoomLevel !== undefined) result.zoomLevel = this.globalOptions.zoomLevel;
        if (this.globalOptions.responsive !== undefined) result.responsive = this.globalOptions.responsive;
        if (this.globalOptions.toolbar) result.toolbar = { ...result.toolbar, ...this.globalOptions.toolbar };
        if (this.globalOptions.appearance) result.appearance = { ...result.appearance, ...this.globalOptions.appearance };
        if (this.globalOptions.processing) result.processing = { ...result.processing, ...this.globalOptions.processing };
        if (this.globalOptions.annotations) result.annotations = { ...result.annotations, ...this.globalOptions.annotations };
        if (this.globalOptions.customCSS !== undefined) result.customCSS = this.globalOptions.customCSS;
        if (this.globalOptions.customJS !== undefined) result.customJS = this.globalOptions.customJS;
        if (this.globalOptions.formatOptions) result.formatOptions = { ...result.formatOptions, ...this.globalOptions.formatOptions };
        
        // Apply document-specific options if available
        if (options.zoomLevel !== undefined) result.zoomLevel = options.zoomLevel;
        if (options.responsive !== undefined) result.responsive = options.responsive;
        if (options.toolbar) result.toolbar = { ...result.toolbar, ...options.toolbar };
        if (options.appearance) result.appearance = { ...result.appearance, ...options.appearance };
        if (options.processing) result.processing = { ...result.processing, ...options.processing };
        if (options.annotations) result.annotations = { ...result.annotations, ...options.annotations };
        if (options.customCSS !== undefined) result.customCSS = options.customCSS;
        if (options.customJS !== undefined) result.customJS = options.customJS;
        if (options.formatOptions) result.formatOptions = { ...result.formatOptions, ...options.formatOptions };
        
        return result;
    }
    
    /**
     * Deep merge objects
     */
    private deepMerge<T>(target: T, source: Partial<T>): T {
        if (!source) {
            return target;
        }
        
        const output = { ...target };
        
        Object.keys(source).forEach(key => {
            const sourceValue = source[key as keyof Partial<T>];
            const targetValue = target[key as keyof T];
            
            // Skip undefined values to maintain required properties
            if (sourceValue === undefined) {
                return;
            }
            
            if (
                sourceValue !== null &&
                typeof sourceValue === 'object' &&
                targetValue !== null &&
                typeof targetValue === 'object' &&
                !Array.isArray(sourceValue) &&
                !Array.isArray(targetValue)
            ) {
                // Recursively merge objects
                output[key as keyof T] = this.deepMerge(targetValue, sourceValue) as any;
            } else {
                // Directly assign primitive values, arrays, or null
                output[key as keyof T] = sourceValue as any;
            }
        });
        
        return output;
    }
}
