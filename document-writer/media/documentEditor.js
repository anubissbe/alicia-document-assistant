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
        viewMode: 'edit'
    };
    
    // Try to get the state that was saved earlier
    const previousState = vscode.getState();
    if (previousState) {
        currentState = previousState;
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
        
        // Set initial view mode
        setViewMode(currentState.viewMode);
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Document content input
        documentContent.addEventListener('input', () => {
            currentState.content = documentContent.value;
            currentState.isModified = true;
            updateState();
            
            // Notify VS Code of content change
            vscode.postMessage({
                command: 'contentChanged',
                content: documentContent.value
            });
        });
        
        // Save button
        saveButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'saveDocument'
            });
        });
        
        // Toggle preview button
        togglePreviewButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'togglePreview'
            });
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
                updateState();
                setViewMode(message.viewMode);
                break;
                
            case 'updatePreview':
                previewContent.innerHTML = message.content;
                setViewMode(message.viewMode);
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
                updateState();
                break;
                
            case 'previewFormatChanged':
                // Update the preview content with the new format
                previewContent.innerHTML = message.content;
                
                // Update the format selector to match
                if (message.format) {
                    previewFormatSelector.value = message.format;
                }
                break;
                
            case 'previewError':
                // Display error message in preview area
                previewContent.innerHTML = `<div class="preview-error">
                    <h3>Preview Error</h3>
                    <p>${message.error}</p>
                </div>`;
                break;
        }
    });
})();
