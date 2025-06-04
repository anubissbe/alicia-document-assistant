/**
 * previewEnhancer.ts
 * Enhances document preview with additional functionality
 */

import * as vscode from 'vscode';
import { DocumentFormat, PreviewOptions, PreviewOptionsManager } from '../models/previewOptions';
import { AnnotationManager, DocumentAnnotation } from '../models/documentAnnotation';

/**
 * Preview enhancement result
 */
export interface PreviewEnhancementResult {
    /**
     * Enhanced HTML content
     */
    html: string;
    
    /**
     * CSS to inject
     */
    css: string;
    
    /**
     * JavaScript to inject
     */
    js: string;
}

/**
 * PreviewEnhancer class
 * Enhances document previews with additional functionality
 */
export class PreviewEnhancer {
    /**
     * Singleton instance
     */
    private static instance: PreviewEnhancer;
    
    /**
     * Option manager instance
     */
    private optionsManager: PreviewOptionsManager;
    
    /**
     * Annotation manager instance
     */
    private annotationManager: AnnotationManager;
    
    /**
     * Private constructor (singleton)
     */
    private constructor() {
        this.optionsManager = PreviewOptionsManager.getInstance();
        this.annotationManager = AnnotationManager.getInstance();
    }
    
    /**
     * Get singleton instance
     */
    public static getInstance(): PreviewEnhancer {
        if (!PreviewEnhancer.instance) {
            PreviewEnhancer.instance = new PreviewEnhancer();
        }
        return PreviewEnhancer.instance;
    }
    
    /**
     * Enhance document preview
     */
    public async enhancePreview(
        documentUri: vscode.Uri,
        content: string,
        format: DocumentFormat,
        userOptions?: Partial<PreviewOptions>
    ): Promise<PreviewEnhancementResult> {
        // Get stored options for document
        const storedOptions = await this.optionsManager.loadOptionsForDocument(documentUri);
        
        // Merge with user options and defaults
        const options = this.optionsManager.mergeWithDefaults(
            { ...storedOptions, ...userOptions },
            format
        );
        
        // Base result
        const result: PreviewEnhancementResult = {
            html: content,
            css: '',
            js: ''
        };
        
        // Apply enhancements based on options
        if (options.toolbar.show) {
            result.html = this.addToolbar(result.html, options);
        }
        
        if (options.responsive) {
            result.css += this.getResponsiveCSS();
        }
        
        // Add theme-specific CSS
        result.css += this.getThemeCSS(options.appearance.theme);
        
        // Add annotations if enabled
        if (options.annotations.enabled) {
            const annotations = await this.annotationManager.loadAnnotations(documentUri);
            result.html = this.addAnnotations(result.html, annotations, options);
        }
        
        // Add format-specific enhancements
        switch (format) {
            case DocumentFormat.MARKDOWN:
                result.html = this.enhanceMarkdown(result.html, options);
                break;
            case DocumentFormat.HTML:
                result.html = this.enhanceHtml(result.html, options);
                break;
            case DocumentFormat.PDF:
                result.html = this.enhancePdf(result.html, options);
                break;
            case DocumentFormat.DOCX:
                result.html = this.enhanceDocx(result.html, options);
                break;
            // Add other formats as needed
        }
        
        // Add JavaScript for interactivity
        result.js = this.getEnhancementJavaScript(options);
        
        // Add custom CSS/JS if provided
        if (options.customCSS) {
            result.css += options.customCSS;
        }
        
        if (options.customJS) {
            result.js += options.customJS;
        }
        
        return result;
    }
    
    /**
     * Add toolbar to preview
     */
    private addToolbar(html: string, options: PreviewOptions): string {
        // Create toolbar HTML
        const toolbarHtml = `
            <div class="document-preview-toolbar ${options.toolbar.position}" role="toolbar" aria-label="Document preview toolbar">
                ${this.getToolbarContentHtml(options)}
            </div>
        `;
        
        // Add toolbar based on position
        switch (options.toolbar.position) {
            case 'top':
                return `${toolbarHtml}${html}`;
            case 'bottom':
                return `${html}${toolbarHtml}`;
            case 'left':
                return `<div class="document-preview-container with-left-toolbar">
                    ${toolbarHtml}
                    <div class="document-preview-content">${html}</div>
                </div>`;
            case 'right':
                return `<div class="document-preview-container with-right-toolbar">
                    <div class="document-preview-content">${html}</div>
                    ${toolbarHtml}
                </div>`;
            default:
                return `${toolbarHtml}${html}`;
        }
    }
    
    /**
     * Get toolbar content HTML
     */
    private getToolbarContentHtml(options: PreviewOptions): string {
        let html = '';
        
        // Add page navigation if enabled
        if (options.toolbar.showPageNavigation) {
            html += `
                <div class="toolbar-group page-navigation">
                    <button class="toolbar-button" data-action="first-page" title="First Page">
                        <i class="codicon codicon-arrow-up"></i>
                    </button>
                    <button class="toolbar-button" data-action="previous-page" title="Previous Page">
                        <i class="codicon codicon-arrow-left"></i>
                    </button>
                    <span class="page-indicator">
                        Page <span class="current-page">1</span> of <span class="total-pages">1</span>
                    </span>
                    <button class="toolbar-button" data-action="next-page" title="Next Page">
                        <i class="codicon codicon-arrow-right"></i>
                    </button>
                    <button class="toolbar-button" data-action="last-page" title="Last Page">
                        <i class="codicon codicon-arrow-down"></i>
                    </button>
                </div>
            `;
        }
        
        // Add zoom controls if enabled
        if (options.toolbar.showZoomControls) {
            html += `
                <div class="toolbar-group zoom-controls">
                    <button class="toolbar-button" data-action="zoom-out" title="Zoom Out">
                        <i class="codicon codicon-zoom-out"></i>
                    </button>
                    <span class="zoom-level">${Math.round(options.zoomLevel * 100)}%</span>
                    <button class="toolbar-button" data-action="zoom-in" title="Zoom In">
                        <i class="codicon codicon-zoom-in"></i>
                    </button>
                    <button class="toolbar-button" data-action="zoom-reset" title="Reset Zoom">
                        <i class="codicon codicon-zoom-reset"></i>
                    </button>
                </div>
            `;
        }
        
        // Add annotation tools if enabled
        if (options.toolbar.showAnnotationTools) {
            html += `
                <div class="toolbar-group annotation-tools">
                    <button class="toolbar-button" data-action="toggle-annotations" title="Toggle Annotations">
                        <i class="codicon codicon-comment"></i>
                    </button>
                    <button class="toolbar-button" data-action="add-comment" title="Add Comment">
                        <i class="codicon codicon-comment-add"></i>
                    </button>
                    <button class="toolbar-button" data-action="add-highlight" title="Add Highlight">
                        <i class="codicon codicon-highlight"></i>
                    </button>
                </div>
            `;
        }
        
        // Add export options if enabled
        if (options.toolbar.showExportOptions) {
            html += `
                <div class="toolbar-group export-options">
                    <button class="toolbar-button" data-action="export-pdf" title="Export as PDF">
                        <i class="codicon codicon-file-pdf"></i>
                    </button>
                    <button class="toolbar-button" data-action="export-docx" title="Export as DOCX">
                        <i class="codicon codicon-file-word"></i>
                    </button>
                    <button class="toolbar-button" data-action="export-html" title="Export as HTML">
                        <i class="codicon codicon-file-code"></i>
                    </button>
                </div>
            `;
        }
        
        // Add print button if enabled
        if (options.toolbar.showPrintButton) {
            html += `
                <div class="toolbar-group print-options">
                    <button class="toolbar-button" data-action="print" title="Print">
                        <i class="codicon codicon-print"></i>
                    </button>
                </div>
            `;
        }
        
        // Add custom buttons if provided
        if (options.toolbar.customButtons && options.toolbar.customButtons.length > 0) {
            html += '<div class="toolbar-group custom-buttons">';
            
            options.toolbar.customButtons.forEach(button => {
                html += `
                    <button class="toolbar-button" data-action="${button.action}" title="${button.tooltip || button.label}">
                        <i class="codicon codicon-${button.icon}"></i>
                        ${button.label}
                    </button>
                `;
            });
            
            html += '</div>';
        }
        
        return html;
    }
    
    /**
     * Add annotations to preview
     */
    private addAnnotations(
        html: string,
        annotations: DocumentAnnotation[],
        options: PreviewOptions
    ): string {
        if (!annotations || annotations.length === 0) {
            return html;
        }
        
        // Create annotations container
        let annotationsHtml = `
            <div class="document-annotations ${options.annotations.visible ? 'visible' : 'hidden'}">
                <div class="annotations-header">
                    <h3>Annotations</h3>
                    <button class="close-annotations">×</button>
                </div>
                <div class="annotations-content">
        `;
        
        // Add each annotation
        annotations.forEach(annotation => {
            annotationsHtml += this.annotationManager.getAnnotationHtml(annotation);
        });
        
        // Close annotations container
        annotationsHtml += `
                </div>
                <div class="annotations-footer">
                    <button class="add-annotation-button">Add Annotation</button>
                </div>
            </div>
        `;
        
        // Add annotation markers to content
        let contentWithMarkers = html;
        annotations.forEach(annotation => {
            if (annotation.position) {
                // This is a simplified example - actual implementation would depend on
                // the document format and how positions are represented
                contentWithMarkers = this.addAnnotationMarker(
                    contentWithMarkers,
                    annotation
                );
            }
        });
        
        // Combine content with annotations panel
        return `
            <div class="document-preview-with-annotations">
                <div class="document-content">${contentWithMarkers}</div>
                ${annotationsHtml}
            </div>
        `;
    }
    
    /**
     * Add annotation marker to content
     */
    private addAnnotationMarker(
        content: string,
        annotation: DocumentAnnotation
    ): string {
        // This is a simplified implementation - actual implementation
        // would depend on the document format and how positions are represented
        
        // For demonstration purposes, just add a comment icon at the end of the content
        return content.replace(
            /<\/body>/i,
            `<div class="annotation-marker" data-annotation-id="${annotation.id}" 
                 style="background-color: ${annotation.metadata.color || '#4287f5'}">
                <i class="codicon codicon-comment"></i>
            </div></body>`
        );
    }
    
    /**
     * Get responsive CSS
     */
    private getResponsiveCSS(): string {
        return `
            /* Responsive CSS will be loaded from media/responsive.css */
            /* This is a placeholder for dynamic responsive CSS */
            .document-preview-container {
                display: flex;
                flex-direction: row;
                width: 100%;
                height: 100%;
            }
            
            .document-preview-container.with-left-toolbar {
                flex-direction: row;
            }
            
            .document-preview-container.with-right-toolbar {
                flex-direction: row-reverse;
            }
            
            .document-preview-content {
                flex: 1;
                overflow: auto;
            }
            
            /* Media queries for different screen sizes */
            @media (max-width: 768px) {
                .document-preview-toolbar.left,
                .document-preview-toolbar.right {
                    width: 40px;
                }
                
                .document-preview-toolbar.top,
                .document-preview-toolbar.bottom {
                    height: 40px;
                }
                
                .toolbar-button span {
                    display: none;
                }
            }
        `;
    }
    
    /**
     * Get theme-specific CSS
     */
    private getThemeCSS(theme: 'light' | 'dark' | 'auto'): string {
        // This will be determined dynamically based on the VSCode theme
        // For now, just return a placeholder
        return `
            /* Theme-specific CSS will be dynamically generated */
            /* This is a placeholder for theme-specific CSS */
            .document-preview-container {
                background-color: var(--vscode-editor-background);
                color: var(--vscode-editor-foreground);
            }
            
            .document-preview-toolbar {
                background-color: var(--vscode-editor-background);
                border-color: var(--vscode-panel-border);
            }
            
            .toolbar-button {
                color: var(--vscode-button-foreground);
                background-color: var(--vscode-button-background);
            }
            
            .toolbar-button:hover {
                background-color: var(--vscode-button-hoverBackground);
            }
        `;
    }
    
    /**
     * Enhance Markdown content
     */
    private enhanceMarkdown(html: string, options: PreviewOptions): string {
        let enhancedHtml = html;
        
        // Add syntax highlighting if enabled
        if (options.processing.syntaxHighlighting) {
            enhancedHtml = this.addSyntaxHighlighting(enhancedHtml);
        }
        
        // Render math expressions if enabled
        if (options.processing.renderMath) {
            enhancedHtml = this.renderMathExpressions(enhancedHtml);
        }
        
        // Render diagrams if enabled
        if (options.processing.renderDiagrams) {
            enhancedHtml = this.renderDiagrams(enhancedHtml);
        }
        
        return enhancedHtml;
    }
    
    /**
     * Enhance HTML content
     */
    private enhanceHtml(html: string, options: PreviewOptions): string {
        // Add any HTML-specific enhancements here
        return html;
    }
    
    /**
     * Enhance PDF content
     */
    private enhancePdf(html: string, _options: PreviewOptions): string {
        // PDF is typically rendered in an iframe or object tag
        // This would wrap the content appropriately
        return `
            <div class="pdf-container" style="width: 100%; height: 100%;">
                ${html}
            </div>
        `;
    }
    
    /**
     * Enhance DOCX content
     */
    private enhanceDocx(html: string, _options: PreviewOptions): string {
        // DOCX content is typically converted to HTML for preview
        // This method would add any DOCX-specific enhancements
        return html;
    }
    
    /**
     * Add syntax highlighting to code blocks
     */
    private addSyntaxHighlighting(html: string): string {
        // In a real implementation, this would use a library like highlight.js
        // For now, just return the original HTML
        return html;
    }
    
    /**
     * Render math expressions
     */
    private renderMathExpressions(html: string): string {
        // In a real implementation, this would use a library like KaTeX or MathJax
        // For now, just return the original HTML
        return html;
    }
    
    /**
     * Render diagrams
     */
    private renderDiagrams(html: string): string {
        // In a real implementation, this would use libraries like mermaid.js
        // For now, just return the original HTML
        return html;
    }
    
    /**
     * Get enhancement JavaScript
     */
    private getEnhancementJavaScript(_options: PreviewOptions): string {
        return `
            // This is a placeholder for the dynamic JavaScript that would be injected
            // In practice, this would be loaded from previewEnhancer.js in the media folder
            (function() {
                // Initialize preview functionality
                function initPreview() {
                    // Set up toolbar button handlers
                    document.querySelectorAll('.toolbar-button').forEach(button => {
                        button.addEventListener('click', handleToolbarAction);
                    });
                    
                    // Set up annotation handlers
                    document.querySelectorAll('.annotation-marker').forEach(marker => {
                        marker.addEventListener('click', showAnnotation);
                    });
                    
                    // Other initialization
                }
                
                // Handle toolbar button clicks
                function handleToolbarAction(event) {
                    const button = event.currentTarget;
                    const action = button.getAttribute('data-action');
                    
                    // Send message to extension
                    vscode.postMessage({
                        command: 'toolbar-action',
                        action: action
                    });
                }
                
                // Show annotation when marker is clicked
                function showAnnotation(event) {
                    const marker = event.currentTarget;
                    const annotationId = marker.getAttribute('data-annotation-id');
                    
                    // Send message to extension
                    vscode.postMessage({
                        command: 'show-annotation',
                        annotationId: annotationId
                    });
                    
                    // Show annotation panel
                    document.querySelector('.document-annotations').classList.add('visible');
                }
                
                // Initialize when the DOM is ready
                document.addEventListener('DOMContentLoaded', initPreview);
            })();
        `;
    }
    
    /**
     * Create loading spinner
     */
    public createLoadingSpinner(): string {
        return `
            <div class="loading-spinner-container">
                <div class="loading-spinner"></div>
                <div class="loading-text">Loading preview...</div>
            </div>
        `;
    }
    
    /**
     * Create error display
     */
    public createErrorDisplay(error: Error | string): string {
        const errorMessage = typeof error === 'string' ? error : error.message;
        const errorStack = typeof error === 'string' ? '' : error.stack || '';
        
        return `
            <div class="preview-error-container">
                <div class="preview-error-icon">
                    <i class="codicon codicon-error"></i>
                </div>
                <div class="preview-error-message">
                    <h3>Error loading preview</h3>
                    <p>${errorMessage}</p>
                    ${errorStack ? `<pre class="preview-error-stack">${errorStack}</pre>` : ''}
                </div>
                <div class="preview-error-actions">
                    <button class="retry-button">Retry</button>
                </div>
            </div>
        `;
    }
}
