/**
 * Version History for Document Writer
 */
class VersionHistory {
    constructor() {
        this.storageKey = 'document-versions';
        this.maxVersions = 10;
        this.versions = this.loadVersions();
    }
    
    /**
     * Load versions from localStorage
     */
    loadVersions() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : [];
        } catch (error) {
            console.error('Error loading versions:', error);
            return [];
        }
    }
    
    /**
     * Save current document as a new version
     */
    saveVersion(name = null) {
        if (!window.app || !window.app.wizardData || !window.app.wizardData.generatedContent) {
            showToast('No document to save', 'warning');
            return false;
        }
        
        const version = {
            id: Date.now().toString(),
            name: name || `Version ${this.versions.length + 1}`,
            timestamp: new Date().toISOString(),
            documentType: window.app.wizardData.documentType,
            documentTitle: window.app.wizardData.documentTitle,
            documentData: window.app.wizardData.documentData,
            sections: window.app.wizardData.sections,
            generatedContent: window.app.wizardData.generatedContent,
            wordCount: this.getWordCount(window.app.wizardData.generatedContent)
        };
        
        // Add to versions array
        this.versions.unshift(version);
        
        // Limit versions
        if (this.versions.length > this.maxVersions) {
            this.versions = this.versions.slice(0, this.maxVersions);
        }
        
        // Save to localStorage
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.versions));
            showToast(`Version "${version.name}" saved`, 'success');
            return true;
        } catch (error) {
            console.error('Error saving version:', error);
            showToast('Failed to save version', 'error');
            return false;
        }
    }
    
    /**
     * Load a specific version
     */
    loadVersion(versionId) {
        const version = this.versions.find(v => v.id === versionId);
        if (!version) {
            showToast('Version not found', 'error');
            return false;
        }
        
        if (!window.app) return false;
        
        // Restore document state
        window.app.wizardData = {
            documentType: version.documentType,
            documentTitle: version.documentTitle,
            documentData: version.documentData || {},
            sections: version.sections || [],
            generatedContent: version.generatedContent
        };
        
        // Navigate to preview
        window.app.currentStepIndex = window.app.steps.length - 1;
        window.app.updateStepsNavigation();
        window.app.updateWizardContent();
        window.app.updateProgress();
        
        showToast(`Loaded "${version.name}"`, 'success');
        return true;
    }
    
    /**
     * Delete a version
     */
    deleteVersion(versionId) {
        const index = this.versions.findIndex(v => v.id === versionId);
        if (index === -1) return false;
        
        const version = this.versions[index];
        this.versions.splice(index, 1);
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.versions));
            showToast(`Deleted "${version.name}"`, 'success');
            return true;
        } catch (error) {
            console.error('Error deleting version:', error);
            showToast('Failed to delete version', 'error');
            return false;
        }
    }
    
    /**
     * Rename a version
     */
    renameVersion(versionId, newName) {
        const version = this.versions.find(v => v.id === versionId);
        if (!version) return false;
        
        version.name = newName;
        
        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.versions));
            showToast('Version renamed', 'success');
            return true;
        } catch (error) {
            console.error('Error renaming version:', error);
            showToast('Failed to rename version', 'error');
            return false;
        }
    }
    
    /**
     * Compare two versions
     */
    compareVersions(versionId1, versionId2) {
        const v1 = this.versions.find(v => v.id === versionId1);
        const v2 = this.versions.find(v => v.id === versionId2);
        
        if (!v1 || !v2) {
            showToast('Versions not found', 'error');
            return null;
        }
        
        // Basic diff comparison
        const diff = {
            version1: v1,
            version2: v2,
            titleChanged: v1.documentTitle !== v2.documentTitle,
            wordCountDiff: v2.wordCount - v1.wordCount,
            sectionsAdded: v2.sections.length - v1.sections.length,
            contentLength: v2.generatedContent.length - v1.generatedContent.length
        };
        
        return diff;
    }
    
    /**
     * Show version history dialog
     */
    showVersionHistory() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        const versionsList = this.versions.map(v => `
            <div class="version-item" style="padding: 16px; border: 1px solid var(--border-color, #ddd); border-radius: 8px; margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: start;">
                    <div style="flex: 1;">
                        <h4 style="margin: 0 0 8px 0;">
                            <span class="version-name" data-id="${v.id}">${v.name}</span>
                            <button class="edit-name-btn" data-id="${v.id}" style="margin-left: 8px; font-size: 12px;">✏️</button>
                        </h4>
                        <p style="font-size: 14px; color: var(--text-muted, #666); margin: 0;">
                            ${v.documentTitle || 'Untitled'} • ${v.wordCount} words
                        </p>
                        <p style="font-size: 12px; color: var(--text-muted, #666); margin: 4px 0 0 0;">
                            ${new Date(v.timestamp).toLocaleString()}
                        </p>
                    </div>
                    <div style="display: flex; gap: 8px;">
                        <button class="secondary-button load-version-btn" data-id="${v.id}" style="padding: 6px 12px; font-size: 14px;">
                            Load
                        </button>
                        <button class="secondary-button delete-version-btn" data-id="${v.id}" style="padding: 6px 12px; font-size: 14px;">
                            🗑️
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 700px; max-height: 80vh; overflow-y: auto;">
                <h2>📚 Version History</h2>
                
                <div style="margin: 20px 0;">
                    <button class="primary-button" id="save-version-btn">
                        💾 Save Current Version
                    </button>
                    <span style="margin-left: 10px; color: var(--text-muted, #666);">
                        ${this.versions.length}/${this.maxVersions} versions saved
                    </span>
                </div>
                
                ${this.versions.length > 0 ? `
                    <div id="versions-list">
                        ${versionsList}
                    </div>
                ` : `
                    <p style="text-align: center; color: var(--text-muted, #666); padding: 40px;">
                        No versions saved yet. Save your first version to start tracking changes.
                    </p>
                `}
                
                <div class="modal-actions">
                    <button class="secondary-button" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Save current version
        document.getElementById('save-version-btn').addEventListener('click', () => {
            const name = prompt('Version name (optional):');
            if (this.saveVersion(name || null)) {
                modal.remove();
                this.showVersionHistory(); // Refresh
            }
        });
        
        // Load version buttons
        modal.querySelectorAll('.load-version-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const versionId = e.target.dataset.id;
                if (confirm('Load this version? Current changes will be lost.')) {
                    this.loadVersion(versionId);
                    modal.remove();
                }
            });
        });
        
        // Delete version buttons
        modal.querySelectorAll('.delete-version-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const versionId = e.target.dataset.id;
                if (confirm('Delete this version?')) {
                    this.deleteVersion(versionId);
                    modal.remove();
                    this.showVersionHistory(); // Refresh
                }
            });
        });
        
        // Edit name buttons
        modal.querySelectorAll('.edit-name-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const versionId = e.target.dataset.id;
                const nameSpan = modal.querySelector(`.version-name[data-id="${versionId}"]`);
                const currentName = nameSpan.textContent;
                const newName = prompt('New version name:', currentName);
                if (newName && newName !== currentName) {
                    this.renameVersion(versionId, newName);
                    nameSpan.textContent = newName;
                }
            });
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * Get word count
     */
    getWordCount(content) {
        return content.trim().split(/\s+/).filter(w => w.length > 0).length;
    }
    
    /**
     * Auto-save version on significant changes
     */
    enableAutoVersioning() {
        let lastContent = '';
        let changeCount = 0;
        
        setInterval(() => {
            if (!window.app || !window.app.wizardData || !window.app.wizardData.generatedContent) return;
            
            const currentContent = window.app.wizardData.generatedContent;
            
            // Check for significant changes
            if (currentContent !== lastContent) {
                const wordDiff = Math.abs(this.getWordCount(currentContent) - this.getWordCount(lastContent));
                
                // Auto-save if more than 500 words changed
                if (wordDiff > 500) {
                    changeCount++;
                    this.saveVersion(`Auto-save ${changeCount}`);
                }
                
                lastContent = currentContent;
            }
        }, 60000); // Check every minute
    }
}

// Initialize version history
window.versionHistory = new VersionHistory();

// Add keyboard shortcut
if (window.keyboardShortcuts) {
    window.keyboardShortcuts.register('ctrl+h', () => {
        window.versionHistory.showVersionHistory();
    }, 'Show version history');
}