/**
 * Keyboard shortcuts for Document Writer
 */
class KeyboardShortcuts {
    constructor() {
        this.shortcuts = new Map();
        this.enabled = true;
        this.init();
    }
    
    init() {
        // Define shortcuts
        this.register('ctrl+s', () => {
            if (window.autoSave) {
                window.autoSave.save();
                showToast('Document saved', 'success');
            }
        }, 'Save document');
        
        this.register('ctrl+shift+s', () => {
            // Save and download
            if (window.app && window.app.wizardData.generatedContent) {
                window.app.downloadDocument('markdown');
            }
        }, 'Save and download');
        
        this.register('ctrl+g', () => {
            // Generate document
            const generateBtn = document.querySelector('[data-action="generateDocument"]');
            if (generateBtn && !generateBtn.disabled) {
                generateBtn.click();
            }
        }, 'Generate document');
        
        this.register('alt+left', () => {
            // Previous step
            if (window.app && window.app.currentStepIndex > 0) {
                previousStep();
            }
        }, 'Previous step');
        
        this.register('alt+right', () => {
            // Next step
            if (window.app && window.app.currentStepIndex < window.app.steps.length - 1) {
                nextStep();
            }
        }, 'Next step');
        
        this.register('ctrl+/', () => {
            // Show shortcuts help
            this.showHelp();
        }, 'Show keyboard shortcuts');
        
        this.register('ctrl+z', () => {
            // Undo last action (if in text field)
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                document.execCommand('undo');
            }
        }, 'Undo');
        
        this.register('ctrl+shift+z', () => {
            // Redo last action (if in text field)
            const activeElement = document.activeElement;
            if (activeElement && (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA')) {
                document.execCommand('redo');
            }
        }, 'Redo');
        
        this.register('escape', () => {
            // Close modals
            const modals = document.querySelectorAll('.modal-overlay');
            modals.forEach(modal => {
                if (modal.style.display !== 'none') {
                    modal.click(); // Click overlay to close
                }
            });
        }, 'Close modal');
        
        // Set up event listener
        document.addEventListener('keydown', (e) => this.handleKeyPress(e));
    }
    
    /**
     * Register a keyboard shortcut
     */
    register(keys, callback, description = '') {
        const normalizedKeys = this.normalizeKeys(keys);
        this.shortcuts.set(normalizedKeys, { callback, description, keys });
    }
    
    /**
     * Normalize key combination string
     */
    normalizeKeys(keys) {
        return keys.toLowerCase()
            .split('+')
            .map(k => k.trim())
            .sort()
            .join('+');
    }
    
    /**
     * Handle key press events
     */
    handleKeyPress(event) {
        if (!this.enabled) return;
        
        // Don't trigger shortcuts in certain situations
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA') {
            // Allow only certain shortcuts in input fields
            const allowedInInputs = ['ctrl+s', 'ctrl+z', 'ctrl+shift+z', 'escape'];
            const keys = this.getKeysFromEvent(event);
            if (!allowedInInputs.includes(keys)) {
                return;
            }
        }
        
        const keys = this.getKeysFromEvent(event);
        const normalizedKeys = this.normalizeKeys(keys);
        const shortcut = this.shortcuts.get(normalizedKeys);
        
        if (shortcut) {
            event.preventDefault();
            event.stopPropagation();
            shortcut.callback();
        }
    }
    
    /**
     * Get key combination from event
     */
    getKeysFromEvent(event) {
        const keys = [];
        
        if (event.ctrlKey || event.metaKey) keys.push('ctrl');
        if (event.altKey) keys.push('alt');
        if (event.shiftKey) keys.push('shift');
        
        // Get the actual key
        let key = event.key.toLowerCase();
        if (key === ' ') key = 'space';
        if (key === 'arrowleft') key = 'left';
        if (key === 'arrowright') key = 'right';
        if (key === 'arrowup') key = 'up';
        if (key === 'arrowdown') key = 'down';
        
        if (!['ctrl', 'alt', 'shift', 'meta'].includes(key)) {
            keys.push(key);
        }
        
        return keys.join('+');
    }
    
    /**
     * Show keyboard shortcuts help
     */
    showHelp() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        const shortcuts = Array.from(this.shortcuts.entries())
            .map(([key, value]) => {
                const displayKey = value.keys
                    .replace('ctrl', '⌘/Ctrl')
                    .replace('alt', 'Alt')
                    .replace('shift', 'Shift')
                    .replace('+', ' + ');
                return `
                    <tr>
                        <td><kbd>${displayKey}</kbd></td>
                        <td>${value.description}</td>
                    </tr>
                `;
            })
            .join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>⌨️ Keyboard Shortcuts</h2>
                <table style="width: 100%; margin-top: 20px;">
                    <thead>
                        <tr>
                            <th style="text-align: left; padding: 8px;">Shortcut</th>
                            <th style="text-align: left; padding: 8px;">Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shortcuts}
                    </tbody>
                </table>
                <div class="modal-actions" style="margin-top: 24px;">
                    <button class="primary-button" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
                <style>
                    kbd {
                        display: inline-block;
                        padding: 3px 6px;
                        font-size: 12px;
                        line-height: 1.4;
                        color: #444;
                        background-color: #fafafa;
                        border: 1px solid #ccc;
                        border-radius: 3px;
                        box-shadow: inset 0 -1px 0 #bbb;
                        font-family: monospace;
                    }
                    .modal-content table {
                        border-collapse: collapse;
                    }
                    .modal-content table td {
                        padding: 8px;
                        border-bottom: 1px solid #eee;
                    }
                    .modal-content table tr:last-child td {
                        border-bottom: none;
                    }
                </style>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }
    
    /**
     * Enable/disable shortcuts
     */
    setEnabled(enabled) {
        this.enabled = enabled;
    }
}

// Create global keyboard shortcuts instance
window.keyboardShortcuts = new KeyboardShortcuts();