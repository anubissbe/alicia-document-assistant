/**
 * Export/Import functionality for Document Writer
 */
class ExportImport {
    constructor() {
        this.version = '1.0';
    }
    
    /**
     * Export current document state
     */
    exportDocument() {
        if (!window.app || !window.app.wizardData) {
            showToast('No document to export', 'warning');
            return;
        }
        
        const exportData = {
            version: this.version,
            exportDate: new Date().toISOString(),
            documentType: window.app.wizardData.documentType,
            documentTitle: window.app.wizardData.documentTitle,
            documentData: window.app.wizardData.documentData,
            sections: window.app.wizardData.sections,
            generatedContent: window.app.wizardData.generatedContent,
            currentStep: window.app.currentStepIndex,
            completedSteps: window.app.steps.map(s => s.completed)
        };
        
        // Create filename
        const filename = `${exportData.documentTitle || 'document'}_${new Date().toISOString().split('T')[0]}.json`;
        
        // Download JSON file
        const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        showToast('Document exported successfully', 'success');
    }
    
    /**
     * Import document from file
     */
    importDocument(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            
            reader.onload = (e) => {
                try {
                    const data = JSON.parse(e.target.result);
                    
                    // Validate import data
                    if (!this.validateImportData(data)) {
                        throw new Error('Invalid document format');
                    }
                    
                    // Apply imported data
                    this.applyImportData(data);
                    
                    showToast('Document imported successfully', 'success');
                    resolve(data);
                    
                } catch (error) {
                    showToast('Error importing document: ' + error.message, 'error');
                    reject(error);
                }
            };
            
            reader.onerror = () => {
                showToast('Error reading file', 'error');
                reject(new Error('File read error'));
            };
            
            reader.readAsText(file);
        });
    }
    
    /**
     * Validate import data
     */
    validateImportData(data) {
        // Check required fields
        if (!data.version || !data.documentType) {
            return false;
        }
        
        // Check version compatibility
        const majorVersion = data.version.split('.')[0];
        const currentMajor = this.version.split('.')[0];
        if (majorVersion !== currentMajor) {
            showToast('Warning: Document was created with a different version', 'warning');
        }
        
        return true;
    }
    
    /**
     * Apply imported data to the app
     */
    applyImportData(data) {
        if (!window.app) return;
        
        // Reset app state
        window.app.currentStepIndex = 0;
        window.app.wizardData = {
            documentType: data.documentType,
            documentTitle: data.documentTitle || '',
            documentData: data.documentData || {},
            sections: data.sections || [],
            generatedContent: data.generatedContent || ''
        };
        
        // Restore step completion
        if (data.completedSteps) {
            data.completedSteps.forEach((completed, index) => {
                if (window.app.steps[index]) {
                    window.app.steps[index].completed = completed;
                }
            });
        }
        
        // Navigate to the saved step
        if (data.currentStep !== undefined) {
            window.app.currentStepIndex = Math.min(data.currentStep, window.app.steps.length - 1);
        }
        
        // Update UI
        window.app.updateStepsNavigation();
        window.app.updateWizardContent();
        window.app.updateProgress();
        
        // Mark for auto-save
        if (window.autoSave) {
            window.autoSave.markDirty();
        }
    }
    
    /**
     * Show import dialog
     */
    showImportDialog() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h2>📥 Import Document</h2>
                <p>Select a previously exported document file (.json) to import.</p>
                
                <div style="margin: 20px 0;">
                    <input type="file" id="import-file-input" accept=".json" style="display: none;">
                    <button class="primary-button" onclick="document.getElementById('import-file-input').click()">
                        Choose File
                    </button>
                    <span id="import-file-name" style="margin-left: 10px; color: #666;"></span>
                </div>
                
                <div class="modal-actions">
                    <button class="secondary-button" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="primary-button" id="import-confirm-btn" disabled>Import</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        const fileInput = document.getElementById('import-file-input');
        const fileName = document.getElementById('import-file-name');
        const confirmBtn = document.getElementById('import-confirm-btn');
        
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileName.textContent = file.name;
                confirmBtn.disabled = false;
                
                confirmBtn.onclick = async () => {
                    try {
                        await this.importDocument(file);
                        modal.remove();
                    } catch (error) {
                        console.error('Import error:', error);
                    }
                };
            }
        });
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
}

// Create global instance
window.exportImport = new ExportImport();

// Add keyboard shortcut for export
if (window.keyboardShortcuts) {
    window.keyboardShortcuts.register('ctrl+e', () => {
        window.exportImport.exportDocument();
    }, 'Export document');
    
    window.keyboardShortcuts.register('ctrl+i', () => {
        window.exportImport.showImportDialog();
    }, 'Import document');
}