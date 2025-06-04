// Document Editor Webview Script
(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // DOM Elements
    const documentTitle = document.getElementById('document-title');
    const documentContent = document.getElementById('document-content');
    const previewContent = document.getElementById('preview-content');
    const editorArea = document.getElementById('editor-area');
    const previewArea = document.getElementById('preview-area');
    
    // Buttons
    const saveButton = document.getElementById('btn-save');
    const togglePreviewButton = document.getElementById('btn-toggle-preview');
    const exportButton = document.getElementById('btn-export');
    const refreshPreviewButton = document.getElementById('btn-refresh-preview');
    
    // Dropdown and selector elements
    const exportOptions = document.getElementById('export-options');
    const previewFormatSelector = document.getElementById('preview-format');
    
    // Track document state
    let currentState = {
        content: '',
        title: 'Untitled Document',
        type: 'markdown',
        isModified: false,
        viewMode: 'edit',
        previewFormat: 'html',
        previewContent: '',
        documentPath: undefined,
        lastEdited: Date.now(),
        // Add new state properties for enhanced preview
        autoPreview: true,
        previewTheme: 'default',
        splitView: false,
        zoomLevel: 1
    };
    
    // Debounce function for real-time preview
    let previewDebounceTimer;
    const PREVIEW_DEBOUNCE_DELAY = 800; // ms
    
    // Track content changes for undo/redo capability
    const contentHistory = [];
    const MAX_HISTORY_SIZE = 50;
    let historyIndex = -1;
    
    // Try to get the state that was saved earlier
    const previousState = vscode.getState();
    if (previousState) {
        console.log("Restoring previous webview state");
        currentState = {...currentState, ...previousState};
    }
    
    // Initialize
    init();
    
    /**
     * Initialize the webview
     */
    function init() {
        // Set up event listeners
        setupEventListeners();
        
        // Restore content from state if available
        if (currentState.content) {
            documentContent.value = currentState.content;
        }
        
        // Update title
        if (currentState.title) {
            documentTitle.textContent = currentState.title;
        }
        
        // Apply split view if enabled
        if (currentState.splitView) {
            enableSplitView();
        }
        
        // Set initial view mode
        setViewMode(currentState.viewMode);
        
        // Set up keyboard shortcuts
        setupKeyboardShortcuts();
        
        // Initialize undo history with current content
        saveToHistory(currentState.content || '');
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Document content input
        documentContent.addEventListener('input', () => {
            currentState.content = documentContent.value;
            currentState.isModified = true;
            currentState.lastEdited = Date.now();
            updateState();
            
            // Save to history for undo/redo
            saveToHistory(documentContent.value);
            
            // Notify VS Code of content change
            vscode.postMessage({
                command: 'contentChanged',
                content: documentContent.value
            });
            
            // Auto-update preview if enabled
            if (currentState.autoPreview && currentState.splitView) {
                triggerAutoPreview();
            }
        });
        
        // Save button
        saveButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'saveDocument'
            });
        });
        
        // Toggle preview button
        togglePreviewButton.addEventListener('click', () => {
            if (currentState.splitView) {
                // In split view, toggle between split and full edit/preview
                toggleSplitView();
            } else {
                // In single view, toggle between edit and preview
                vscode.postMessage({
                    command: 'togglePreview'
                });
            }
        });
        
        // Export button - show/hide dropdown
        exportButton.addEventListener('click', () => {
            exportOptions.style.display = exportOptions.style.display === 'block' ? 'none' : 'block';
        });
        
        // Close export dropdown when clicking elsewhere
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#btn-export') && !e.target.closest('#export-options')) {
                exportOptions.style.display = 'none';
            }
        });
        
        // Export options
        const exportLinks = document.querySelectorAll('#export-options a');
        exportLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const format = e.target.getAttribute('data-format');
                exportOptions.style.display = 'none';
                
                vscode.postMessage({
                    command: 'exportDocument',
                    format: format
                });
            });
        });
        
        // Double-click on title to edit
        documentTitle.addEventListener('dblclick', () => {
            makeElementEditable(documentTitle);
        });
        
        // Preview format selector
        previewFormatSelector.addEventListener('change', () => {
            const selectedFormat = previewFormatSelector.value;
            vscode.postMessage({
                command: 'changePreviewFormat',
                format: selectedFormat
            });
        });
        
        // Refresh preview button
        refreshPreviewButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'refreshPreview',
                format: previewFormatSelector.value
            });
        });
        
        // Set up listeners for real-time preview toggle if it exists
        document.addEventListener('DOMContentLoaded', () => {
            // These elements might not exist until preview content is loaded
            const realTimePreviewToggle = document.getElementById('real-time-preview');
            if (realTimePreviewToggle) {
                realTimePreviewToggle.addEventListener('change', (e) => {
                    currentState.autoPreview = e.target.checked;
                    updateState();
                });
            }
        });
        
        // Set up listeners for preview content after it's loaded
        previewContent.addEventListener('click', (e) => {
            handlePreviewInteractions(e);
        });
    }
    
    /**
     * Set up keyboard shortcuts
     */
    function setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Cmd/Ctrl+S to save
            if ((e.metaKey || e.ctrlKey) && e.key === 's') {
                e.preventDefault();
                vscode.postMessage({
                    command: 'saveDocument'
                });
            }
            
            // Cmd/Ctrl+P to toggle preview
            if ((e.metaKey || e.ctrlKey) && e.key === 'p') {
                e.preventDefault();
                vscode.postMessage({
                    command: 'togglePreview'
                });
            }
            
            // Alt+P to toggle split view
            if (e.altKey && e.key === 'p') {
                e.preventDefault();
                toggleSplitView();
            }
            
            // Cmd/Ctrl+Z for undo
            if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
                e.preventDefault();
                undo();
            }
            
            // Cmd/Ctrl+Shift+Z or Cmd/Ctrl+Y for redo
            if (((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') || 
                ((e.metaKey || e.ctrlKey) && e.key === 'y')) {
                e.preventDefault();
                redo();
            }
        });
    }
    
    /**
     * Save current content to history for undo/redo
     * @param {string} content - Current document content
     */
    function saveToHistory(content) {
        // Don't save if content is the same as the last entry
        if (contentHistory.length > 0 && 
            contentHistory[historyIndex] === content) {
            return;
        }
        
        // If we're not at the end of the history, remove everything after current point
        if (historyIndex >= 0 && historyIndex < contentHistory.length - 1) {
            contentHistory.splice(historyIndex + 1);
        }
        
        // Add new content to history
        contentHistory.push(content);
        historyIndex = contentHistory.length - 1;
        
        // Keep history at reasonable size
        if (contentHistory.length > MAX_HISTORY_SIZE) {
            contentHistory.shift();
            historyIndex--;
        }
    }
    
    /**
     * Undo the last content change
     */
    function undo() {
        if (historyIndex > 0) {
            historyIndex--;
            applyHistoryState();
        }
    }
    
    /**
     * Redo the last undone change
     */
    function redo() {
        if (historyIndex < contentHistory.length - 1) {
            historyIndex++;
            applyHistoryState();
        }
    }
    
    /**
     * Apply the current history state to the editor
     */
    function applyHistoryState() {
        const content = contentHistory[historyIndex];
        documentContent.value = content;
        currentState.content = content;
        currentState.isModified = true;
        updateState();
        
        // Notify extension of content change
        vscode.postMessage({
            command: 'contentChanged',
            content: content
        });
        
        // Update preview if appropriate
        if ((currentState.autoPreview && currentState.splitView) || 
            currentState.viewMode === 'preview') {
            triggerAutoPreview();
        }
    }
    
    /**
     * Trigger auto-preview with debounce
     */
    function triggerAutoPreview() {
        clearTimeout(previewDebounceTimer);
        previewDebounceTimer = setTimeout(() => {
            vscode.postMessage({
                command: 'refreshPreview',
                format: currentState.previewFormat || 'html'
            });
        }, PREVIEW_DEBOUNCE_DELAY);
    }
    
    /**
     * Toggle split view mode
     */
    function toggleSplitView() {
        currentState.splitView = !currentState.splitView;
        updateState();
        
        if (currentState.splitView) {
            enableSplitView();
        } else {
            disableSplitView();
        }
        
        // If enabling split view, refresh the preview
        if (currentState.splitView) {
            vscode.postMessage({
                command: 'refreshPreview',
                format: currentState.previewFormat || 'html'
            });
        }
    }
    
    /**
     * Enable split view
     */
    function enableSplitView() {
        document.body.classList.add('split-view');
        
        // Make both editor and preview visible
        editorArea.classList.remove('hidden');
        previewArea.classList.remove('hidden');
        
        // Update toggle button title
        togglePreviewButton.title = 'Toggle Split View';
        
        // If we don't have preview content yet, request it
        if (!currentState.previewContent) {
            vscode.postMessage({
                command: 'refreshPreview',
                format: currentState.previewFormat || 'html'
            });
        }
    }
    
    /**
     * Disable split view
     */
    function disableSplitView() {
        document.body.classList.remove('split-view');
        
        // Return to previous view mode
        setViewMode(currentState.viewMode);
    }
    
    /**
     * Handle interactions in the preview pane
     * @param {Event} e - Click event in preview
     */
    function handlePreviewInteractions(e) {
        // Handle image zoom controls
        if (e.target.classList.contains('zoom-in')) {
            const img = e.target.closest('.image-container').querySelector('img');
            currentState.zoomLevel = Math.min((currentState.zoomLevel || 1) * 1.2, 3);
            img.style.transform = `scale(${currentState.zoomLevel})`;
            updateState();
        } else if (e.target.classList.contains('zoom-out')) {
            const img = e.target.closest('.image-container').querySelector('img');
            currentState.zoomLevel = Math.max((currentState.zoomLevel || 1) / 1.2, 0.5);
            img.style.transform = `scale(${currentState.zoomLevel})`;
            updateState();
        } else if (e.target.classList.contains('reset-zoom')) {
            const img = e.target.closest('.image-container').querySelector('img');
            currentState.zoomLevel = 1;
            img.style.transform = 'scale(1)';
            updateState();
        }
        
        // Handle table of contents navigation
        if (e.target.closest('.document-toc') && e.target.tagName === 'A') {
            e.preventDefault();
            const targetId = e.target.getAttribute('href').substring(1);
            const targetElement = document.getElementById(targetId);
            
            if (targetElement) {
                // Scroll the target element into view with smooth animation
                targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                
                // Briefly highlight the target element
                targetElement.classList.add('highlight-target');
                setTimeout(() => {
                    targetElement.classList.remove('highlight-target');
                }, 2000);
            }
        }
        
        // Handle real-time preview toggle
        if (e.target.id === 'real-time-preview') {
            currentState.autoPreview = e.target.checked;
            updateState();
            
            // Show notification
            const status = currentState.autoPreview ? 'enabled' : 'disabled';
            const previewInfo = document.querySelector('.preview-info');
            if (previewInfo) {
                previewInfo.innerHTML = `<span class="preview-status">Real-time preview ${status}</span>`;
                setTimeout(() => {
                    previewInfo.innerHTML = `<span class="preview-timestamp">Last updated: ${new Date().toLocaleTimeString()}</span>`;
                }, 3000);
            }
        }
    }
    
    /**
     * Make an element editable
     * @param {HTMLElement} element - The element to make editable
     */
    function makeElementEditable(element) {
        const currentTitle = element.textContent;
        element.setAttribute('contentEditable', 'true');
        element.focus();
        
        // Select all text
        const range = document.createRange();
        range.selectNodeContents(element);
        const selection = window.getSelection();
        selection.removeAllRanges();
        selection.addRange(range);
        
        // Save on blur
        const saveTitle = () => {
            element.removeAttribute('contentEditable');
            if (element.textContent !== currentTitle) {
                currentState.title = element.textContent;
                currentState.isModified = true;
                updateState();
                
                vscode.postMessage({
                    command: 'updateTitle',
                    title: element.textContent
                });
            }
            
            element.removeEventListener('blur', saveTitle);
            element.removeEventListener('keydown', handleKeydown);
        };
        
        // Handle Enter key
        const handleKeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                element.blur();
            }
        };
        
        element.addEventListener('blur', saveTitle);
        element.addEventListener('keydown', handleKeydown);
    }
    
    /**
     * Update view mode (edit/preview)
     * @param {string} mode - The view mode ('edit' or 'preview')
     */
    function setViewMode(mode) {
        currentState.viewMode = mode;
        updateState();
        
        // If in split view, keep both visible
        if (currentState.splitView) {
            editorArea.classList.remove('hidden');
            previewArea.classList.remove('hidden');
            return;
        }
        
        if (mode === 'edit') {
            editorArea.classList.remove('hidden');
            previewArea.classList.add('hidden');
            togglePreviewButton.title = 'Show Preview';
        } else {
            editorArea.classList.add('hidden');
            previewArea.classList.remove('hidden');
            togglePreviewButton.title = 'Edit Document';
        }
    }
    
    /**
     * Update the state and save it
     */
    function updateState() {
        vscode.setState(currentState);
        
        // Also notify extension of state update for persistence across sessions
        vscode.postMessage({
            command: 'persistState',
            state: currentState
        });
    }
    
    /**
     * Handle messages from VS Code
     */
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'updateContent':
                documentContent.value = message.content;
                if (message.title) {
                    documentTitle.textContent = message.title;
                }
                currentState.content = message.content;
                currentState.title = message.title;
                currentState.type = message.type;
                currentState.viewMode = message.viewMode;
                
                // Store document path if provided
                if (message.path) {
                    currentState.documentPath = message.path;
                }
                
                // Reset undo/redo history with new content
                contentHistory.length = 0;
                saveToHistory(message.content);
                historyIndex = 0;
                
                updateState();
                setViewMode(message.viewMode);
                break;
                
            case 'updatePreview':
                previewContent.innerHTML = message.content;
                currentState.previewContent = message.content;
                
                if (message.format) {
                    currentState.previewFormat = message.format;
                }
                
                // Set up interactive elements in preview content
                setupPreviewInteractivity();
                
                setViewMode(message.viewMode);
                updateState();
                break;
                
            case 'updateViewMode':
                setViewMode(message.viewMode);
                break;
                
            case 'documentSaved':
                currentState.isModified = false;
                if (message.title) {
                    documentTitle.textContent = message.title;
                    currentState.title = message.title;
                }
                if (message.path) {
                    currentState.documentPath = message.path;
                }
                updateState();
                break;
                
            case 'previewFormatChanged':
                // Update the preview content with the new format
                previewContent.innerHTML = message.content;
                currentState.previewContent = message.content;
                
                // Set up interactive elements in preview content
                setupPreviewInteractivity();
                
                // Update the format selector to match
                if (message.format) {
                    previewFormatSelector.value = message.format;
                    currentState.previewFormat = message.format;
                }
                
                updateState();
                break;
                
            case 'previewError':
                // Display error message in preview area
                previewContent.innerHTML = `<div class="preview-error">
                    <h3>Preview Error</h3>
                    <p>${message.error}</p>
                </div>`;
                
                // Still save this error state
                currentState.previewContent = previewContent.innerHTML;
                updateState();
                break;
                
            case 'restoreState':
                // Extension is requesting to restore the saved state
                vscode.postMessage({
                    command: 'stateRestored',
                    state: currentState
                });
                break;
                
            case 'toggleSplitView':
                // Extension is requesting to toggle split view
                toggleSplitView();
                break;
        }
    });
    
    /**
     * Set up interactivity for elements in preview content
     */
    function setupPreviewInteractivity() {
        // Set up image zoom functionality
        const imageContainers = previewContent.querySelectorAll('.image-container');
        imageContainers.forEach(container => {
            const img = container.querySelector('img');
            const zoomInBtn = container.querySelector('.zoom-in');
            const zoomOutBtn = container.querySelector('.zoom-out');
            const resetZoomBtn = container.querySelector('.reset-zoom');
            
            if (img && zoomInBtn && zoomOutBtn && resetZoomBtn) {
                zoomInBtn.addEventListener('click', () => {
                    currentState.zoomLevel = Math.min((currentState.zoomLevel || 1) * 1.2, 3);
                    img.style.transform = `scale(${currentState.zoomLevel})`;
                    updateState();
                });
                
                zoomOutBtn.addEventListener('click', () => {
                    currentState.zoomLevel = Math.max((currentState.zoomLevel || 1) / 1.2, 0.5);
                    img.style.transform = `scale(${currentState.zoomLevel})`;
                    updateState();
                });
                
                resetZoomBtn.addEventListener('click', () => {
                    currentState.zoomLevel = 1;
                    img.style.transform = 'scale(1)';
                    updateState();
                });
            }
        });
        
        // Set up real-time preview toggle
        const realTimePreviewToggle = document.getElementById('real-time-preview');
        if (realTimePreviewToggle) {
            realTimePreviewToggle.checked = currentState.autoPreview;
            realTimePreviewToggle.addEventListener('change', (e) => {
                currentState.autoPreview = e.target.checked;
                updateState();
            });
        }
        
        // Set up table of contents navigation
        const tocLinks = previewContent.querySelectorAll('.document-toc a');
        tocLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                const targetId = e.target.getAttribute('href').substring(1);
                const targetElement = document.getElementById(targetId);
                
                if (targetElement) {
                    // Scroll the target element into view with smooth animation
                    targetElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
                    
                    // Briefly highlight the target element
                    targetElement.classList.add('highlight-target');
                    setTimeout(() => {
                        targetElement.classList.remove('highlight-target');
                    }, 2000);
                }
            });
        });
        
        // Update timestamp in preview info
        const previewTimestamp = previewContent.querySelector('.preview-timestamp');
        if (previewTimestamp) {
            previewTimestamp.textContent = `Last updated: ${new Date().toLocaleTimeString()}`;
        }
    }
})();
