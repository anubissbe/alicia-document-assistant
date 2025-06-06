/**
 * Share Document functionality for collaborative features
 */
class ShareDocument {
    constructor() {
        this.shareBaseUrl = window.location.origin + window.location.pathname;
    }
    
    /**
     * Generate shareable link with document data
     */
    generateShareLink() {
        if (!window.app || !window.app.wizardData || !window.app.wizardData.generatedContent) {
            showToast('Please generate a document first', 'warning');
            return null;
        }
        
        const shareData = {
            v: '1', // version
            t: window.app.wizardData.documentTitle || 'Untitled',
            d: window.app.wizardData.documentType,
            c: this.compressContent(window.app.wizardData.generatedContent),
            a: window.app.wizardData.documentData.author || '',
            dt: new Date().toISOString().split('T')[0]
        };
        
        // Encode data
        const encodedData = btoa(encodeURIComponent(JSON.stringify(shareData)));
        const shareLink = `${this.shareBaseUrl}#share=${encodedData}`;
        
        return shareLink;
    }
    
    /**
     * Compress content for URL sharing
     */
    compressContent(content) {
        // Basic compression: remove extra whitespace and limit length
        let compressed = content
            .replace(/\s+/g, ' ')
            .replace(/\n{3,}/g, '\n\n')
            .trim();
        
        // Limit to 5000 characters for URL safety
        if (compressed.length > 5000) {
            compressed = compressed.substring(0, 4997) + '...';
        }
        
        return compressed;
    }
    
    /**
     * Load shared document from URL
     */
    loadSharedDocument() {
        const hash = window.location.hash;
        if (!hash.startsWith('#share=')) {
            return false;
        }
        
        try {
            const encodedData = hash.substring(7); // Remove '#share='
            const decodedData = JSON.parse(decodeURIComponent(atob(encodedData)));
            
            if (!this.validateShareData(decodedData)) {
                throw new Error('Invalid share data');
            }
            
            // Apply shared data
            this.applySharedData(decodedData);
            
            showToast('Shared document loaded successfully', 'success');
            return true;
            
        } catch (error) {
            console.error('Error loading shared document:', error);
            showToast('Unable to load shared document', 'error');
            return false;
        }
    }
    
    /**
     * Validate share data
     */
    validateShareData(data) {
        return data && data.v && data.t && data.d && data.c;
    }
    
    /**
     * Apply shared data to the app
     */
    applySharedData(data) {
        if (!window.app) return;
        
        // Set document data
        window.app.wizardData = {
            documentType: data.d,
            documentTitle: data.t,
            documentData: {
                author: data.a || 'Shared Document',
                date: data.dt || new Date().toISOString().split('T')[0]
            },
            sections: [],
            generatedContent: data.c
        };
        
        // Navigate to preview
        window.app.currentStepIndex = window.app.steps.length - 1;
        window.app.updateStepsNavigation();
        window.app.updateWizardContent();
        window.app.updateProgress();
        
        // Clear the share hash from URL
        window.history.replaceState(null, '', window.location.pathname);
    }
    
    /**
     * Show share dialog
     */
    showShareDialog() {
        const shareLink = this.generateShareLink();
        if (!shareLink) return;
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>🔗 Share Document</h2>
                <p>Share this link with others to let them view your document:</p>
                
                <div style="margin: 20px 0;">
                    <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                        <input type="text" id="share-link-input" value="${shareLink}" 
                               readonly style="flex: 1; padding: 10px; font-size: 14px;" 
                               class="form-input">
                        <button class="primary-button" id="copy-link-btn">📋 Copy</button>
                    </div>
                    
                    <div style="display: flex; gap: 10px; flex-wrap: wrap;">
                        <button class="secondary-button" id="share-email-btn">
                            📧 Share via Email
                        </button>
                        <button class="secondary-button" id="share-whatsapp-btn">
                            💬 Share on WhatsApp
                        </button>
                        <button class="secondary-button" id="share-linkedin-btn">
                            💼 Share on LinkedIn
                        </button>
                    </div>
                </div>
                
                <div style="background: #f0f0f0; padding: 10px; border-radius: 4px; margin: 20px 0;">
                    <strong>⚠️ Note:</strong> The shared link contains a compressed version of your document 
                    (up to 5000 characters). For longer documents, consider exporting to a file instead.
                </div>
                
                <h3>QR Code</h3>
                <div id="qr-code-container" style="text-align: center; margin: 20px 0;">
                    <canvas id="qr-code"></canvas>
                </div>
                
                <div class="modal-actions">
                    <button class="secondary-button" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Copy link functionality
        document.getElementById('copy-link-btn').addEventListener('click', () => {
            const input = document.getElementById('share-link-input');
            input.select();
            document.execCommand('copy');
            showToast('Link copied to clipboard!', 'success');
        });
        
        // Social sharing
        const title = window.app.wizardData.documentTitle || 'Document';
        const text = `Check out this document: ${title}`;
        
        document.getElementById('share-email-btn').addEventListener('click', () => {
            window.open(`mailto:?subject=${encodeURIComponent(title)}&body=${encodeURIComponent(text + '\n\n' + shareLink)}`);
        });
        
        document.getElementById('share-whatsapp-btn').addEventListener('click', () => {
            window.open(`https://wa.me/?text=${encodeURIComponent(text + '\n' + shareLink)}`);
        });
        
        document.getElementById('share-linkedin-btn').addEventListener('click', () => {
            window.open(`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(shareLink)}`);
        });
        
        // Generate QR code
        this.generateQRCode(shareLink);
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * Generate QR code for the share link
     */
    generateQRCode(link) {
        const canvas = document.getElementById('qr-code');
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        const size = 200;
        canvas.width = size;
        canvas.height = size;
        
        // Simple QR code placeholder (in production, use a proper QR library)
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, size, size);
        
        ctx.fillStyle = '#000';
        ctx.font = '12px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('QR Code', size/2, size/2 - 10);
        ctx.fillText('(Requires QR library)', size/2, size/2 + 10);
        
        // Draw a border
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.strokeRect(0, 0, size, size);
    }
    
    /**
     * Enable collaborative editing (WebRTC)
     */
    async enableCollaboration() {
        // This would implement real-time collaboration using WebRTC
        // For now, show coming soon message
        showToast('Real-time collaboration coming soon!', 'info');
    }
}

// Initialize share functionality
window.shareDocument = new ShareDocument();

// Check for shared document on load
document.addEventListener('DOMContentLoaded', () => {
    window.shareDocument.loadSharedDocument();
});

// Add keyboard shortcut
if (window.keyboardShortcuts) {
    window.keyboardShortcuts.register('ctrl+shift+s', () => {
        window.shareDocument.showShareDialog();
    }, 'Share document');
}