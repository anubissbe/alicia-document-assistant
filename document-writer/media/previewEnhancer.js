/**
 * PreviewEnhancer class for client-side document preview enhancements
 */
class PreviewEnhancer {
    constructor() {
        this.vscode = acquireVsCodeApi();
        this.format = null;
        this.zoomLevel = 1.0;
        this.showToolbar = true;
        this.showAnnotations = false;
        this.options = {};
        this.currentPage = 1;
        this.totalPages = 1;
        this.lastScrollPosition = { x: 0, y: 0 };
        this.scrollTimeout = null;
    }

    /**
     * Initialize the enhancer with options
     * @param {Object} config Enhancer configuration options
     */
    initialize(config) {
        // Store configuration options
        this.format = config.format || 'html';
        this.zoomLevel = config.zoomLevel || 1.0;
        this.showToolbar = config.showToolbar !== undefined ? config.showToolbar : true;
        this.showAnnotations = config.showAnnotations || false;
        this.options = config.options || {};

        // Set up event listeners
        this._setupEventListeners();

        // Apply initial state
        this._applyInitialState();

        // Set up responsive behavior if enabled
        if (this.options.responsive && this.options.responsive.enabled) {
            this._setupResponsive();
        }

        console.log('Preview Enhancer initialized with format:', this.format);
    }

    /**
     * Set up event listeners for user interactions
     */
    _setupEventListeners() {
        // Format selector
        const formatSelector = document.getElementById('preview-format-selector');
        if (formatSelector) {
            formatSelector.addEventListener('change', (e) => {
                this._handleFormatChange(e.target.value);
            });
        }

        // Toolbar buttons
        document.querySelectorAll('.toolbar-button').forEach(button => {
            button.addEventListener('click', (e) => {
                const action = e.currentTarget.getAttribute('data-action');
                if (action) {
                    this._handleToolbarAction(action);
                }
            });
        });

        // Scroll position tracking
        window.addEventListener('scroll', () => {
            if (this.scrollTimeout) {
                clearTimeout(this.scrollTimeout);
            }
            
            this.scrollTimeout = setTimeout(() => {
                const position = {
                    x: window.scrollX,
                    y: window.scrollY
                };
                
                // Only send message if position changed significantly
                if (Math.abs(position.y - this.lastScrollPosition.y) > 50 ||
                    Math.abs(position.x - this.lastScrollPosition.x) > 50) {
                    this.lastScrollPosition = position;
                    this.vscode.postMessage({
                        command: 'scrollPositionChanged',
                        position
                    });
                }
            }, 300);
        });

        // Handle message from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            
            switch (message.command) {
                case 'scrollToPosition':
                    if (message.position) {
                        window.scrollTo(message.position.x, message.position.y);
                    }
                    break;

                case 'setZoom':
                    this._applyZoom(message.zoomLevel);
                    break;

                case 'toggleToolbar':
                    this._toggleToolbar(message.visible);
                    break;

                case 'toggleAnnotations':
                    this._toggleAnnotations(message.visible);
                    break;

                case 'navigatePage':
                    this._navigatePage(message.next);
                    break;

                case 'print':
                    window.print();
                    break;

                case 'adjustUIForBreakpoint':
                    this._adjustUIForBreakpoint(message.breakpoint);
                    break;
            }
        });

        // Handle annotation actions
        document.querySelectorAll('[data-action="saveAnnotation"]').forEach(button => {
            button.addEventListener('click', () => {
                const textarea = button.closest('.add-annotation').querySelector('textarea');
                if (textarea && textarea.value.trim()) {
                    this._saveAnnotation(textarea.value);
                    textarea.value = '';
                }
            });
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            // Only handle if not in input field
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }

            // Ctrl/Cmd + Plus: Zoom in
            if ((e.ctrlKey || e.metaKey) && e.key === '+') {
                e.preventDefault();
                this._handleToolbarAction('zoomIn');
            }
            
            // Ctrl/Cmd + Minus: Zoom out
            if ((e.ctrlKey || e.metaKey) && e.key === '-') {
                e.preventDefault();
                this._handleToolbarAction('zoomOut');
            }
            
            // Ctrl/Cmd + 0: Reset zoom
            if ((e.ctrlKey || e.metaKey) && e.key === '0') {
                e.preventDefault();
                this._handleToolbarAction('zoomReset');
            }
            
            // Ctrl/Cmd + P: Print
            if ((e.ctrlKey || e.metaKey) && e.key === 'p') {
                e.preventDefault();
                this._handleToolbarAction('print');
            }
            
            // Right arrow or Page Down: Next page
            if (e.key === 'ArrowRight' || e.key === 'PageDown') {
                // Only for document formats that support pages
                if (this.format === 'pdf' || this.format === 'docx') {
                    e.preventDefault();
                    this._handleToolbarAction('nextPage');
                }
            }
            
            // Left arrow or Page Up: Previous page
            if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
                // Only for document formats that support pages
                if (this.format === 'pdf' || this.format === 'docx') {
                    e.preventDefault();
                    this._handleToolbarAction('prevPage');
                }
            }
        });
    }

    /**
     * Apply initial state to the UI
     */
    _applyInitialState() {
        // Apply zoom level
        this._applyZoom(this.zoomLevel);
        
        // Show/hide toolbar
        this._toggleToolbar(this.showToolbar);
        
        // Show/hide annotations
        this._toggleAnnotations(this.showAnnotations);
        
        // Set initial page for paginated formats
        if (this.format === 'pdf' || this.format === 'docx') {
            this._updatePageIndicator(1, this.totalPages);
        }
    }

    /**
     * Set up responsive behavior
     */
    _setupResponsive() {
        // Initial check for breakpoint
        this._checkBreakpoint();
        
        // Set up resize observer
        window.addEventListener('resize', () => {
            this._checkBreakpoint();
        });
    }

    /**
     * Check current breakpoint and apply responsive adjustments
     */
    _checkBreakpoint() {
        const width = window.innerWidth;
        const breakpoints = this.options.responsive.breakpoints || {
            xs: 480,
            sm: 768,
            md: 992,
            lg: 1200
        };
        
        let currentBreakpoint = 'xs';
        
        if (width >= breakpoints.lg) {
            currentBreakpoint = 'lg';
        } else if (width >= breakpoints.md) {
            currentBreakpoint = 'md';
        } else if (width >= breakpoints.sm) {
            currentBreakpoint = 'sm';
        }
        
        // Apply breakpoint-specific adjustments
        this._adjustUIForBreakpoint(currentBreakpoint);
        
        // Notify extension of breakpoint change
        this.vscode.postMessage({
            command: 'responsiveBreakpointChanged',
            breakpoint: currentBreakpoint
        });
    }

    /**
     * Handle format change
     * @param {string} format New format
     */
    _handleFormatChange(format) {
        if (format !== this.format) {
            this.vscode.postMessage({
                command: 'changeFormat',
                format: format
            });
        }
    }

    /**
     * Handle toolbar action
     * @param {string} action Action name
     */
    _handleToolbarAction(action) {
        // Send action to extension
        this.vscode.postMessage({
            command: 'toolbarAction',
            action: action
        });
        
        // Handle client-side actions immediately for better UX
        switch (action) {
            case 'toggleAnnotations':
                this._toggleAnnotations(!this.showAnnotations);
                break;
                
            case 'print':
                window.print();
                break;
                
            // Other actions are handled by extension
        }
    }

    /**
     * Apply zoom level to the preview content
     * @param {number} zoomLevel Zoom level (1.0 = 100%)
     */
    _applyZoom(zoomLevel) {
        this.zoomLevel = zoomLevel;
        
        // Update content zoom
        const contentElement = document.querySelector('.preview-content');
        if (contentElement) {
            contentElement.style.zoom = zoomLevel;
        }
        
        // Update zoom level display
        const zoomLevelElement = document.querySelector('.zoom-level');
        if (zoomLevelElement) {
            zoomLevelElement.textContent = `${Math.round(zoomLevel * 100)}%`;
        }
    }

    /**
     * Toggle toolbar visibility
     * @param {boolean} visible Toolbar visibility
     */
    _toggleToolbar(visible) {
        this.showToolbar = visible;
        
        const toolbar = document.querySelector('.preview-toolbar');
        if (toolbar) {
            toolbar.style.display = visible ? 'flex' : 'none';
        }
    }

    /**
     * Toggle annotations panel
     * @param {boolean} visible Annotations panel visibility
     */
    _toggleAnnotations(visible) {
        this.showAnnotations = visible;
        
        const annotationsPanel = document.querySelector('.annotations-panel');
        if (annotationsPanel) {
            annotationsPanel.classList.toggle('hidden', !visible);
        }
        
        // Toggle body class for CSS adjustments
        document.body.classList.toggle('annotations-visible', visible);
    }

    /**
     * Navigate between pages
     * @param {boolean} next True for next page, false for previous
     */
    _navigatePage(next) {
        if (this.format !== 'pdf' && this.format !== 'docx') {
            return;
        }
        
        if (next && this.currentPage < this.totalPages) {
            this.currentPage++;
        } else if (!next && this.currentPage > 1) {
            this.currentPage--;
        }
        
        this._updatePageIndicator(this.currentPage, this.totalPages);
        
        // Additional logic for page navigation would go here
        // For example, showing/hiding page content based on current page
    }

    /**
     * Update page indicator
     * @param {number} current Current page
     * @param {number} total Total pages
     */
    _updatePageIndicator(current, total) {
        this.currentPage = current;
        this.totalPages = total;
        
        const currentPageElement = document.querySelector('.current-page');
        const totalPagesElement = document.querySelector('.total-pages');
        
        if (currentPageElement) {
            currentPageElement.textContent = current.toString();
        }
        
        if (totalPagesElement) {
            totalPagesElement.textContent = total.toString();
        }
    }

    /**
     * Save annotation
     * @param {string} text Annotation text
     */
    _saveAnnotation(text) {
        this.vscode.postMessage({
            command: 'saveAnnotation',
            text: text
        });
    }

    /**
     * Adjust UI for breakpoint
     * @param {string} breakpoint Breakpoint name
     */
    _adjustUIForBreakpoint(breakpoint) {
        // Apply breakpoint-specific styles
        document.body.dataset.breakpoint = breakpoint;
        
        // Adjust font size if enabled
        if (this.options.responsive && this.options.responsive.adaptFontSize) {
            let fontSizeAdjustment = 1;
            
            switch (breakpoint) {
                case 'xs':
                    fontSizeAdjustment = 0.8;
                    break;
                case 'sm':
                    fontSizeAdjustment = 0.9;
                    break;
                case 'md':
                    fontSizeAdjustment = 1;
                    break;
                case 'lg':
                    fontSizeAdjustment = 1.1;
                    break;
            }
            
            document.documentElement.style.setProperty('--responsive-font-size-adjustment', fontSizeAdjustment);
        }
        
        // Adjust toolbar if enabled
        if (this.options.responsive && this.options.responsive.adaptToolbar) {
            const toolbar = document.querySelector('.preview-toolbar');
            
            if (toolbar) {
                if (breakpoint === 'xs') {
                    // Simplify toolbar on mobile
                    document.querySelectorAll('.toolbar-group:not(.zoom-controls):not(.format-selector)').forEach(group => {
                        group.style.display = 'none';
                    });
                } else {
                    // Show all toolbar groups on larger screens
                    document.querySelectorAll('.toolbar-group').forEach(group => {
                        group.style.display = 'flex';
                    });
                }
            }
        }
    }
}

// Global error handler to capture and report errors
window.addEventListener('error', (event) => {
    const vscode = acquireVsCodeApi();
    vscode.postMessage({
        command: 'error',
        message: event.message,
        filename: event.filename,
        lineno: event.lineno,
        colno: event.colno,
        error: event.error ? event.error.toString() : null
    });
});

// Prevent context menu to avoid interference with VSCode menu
document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
});
