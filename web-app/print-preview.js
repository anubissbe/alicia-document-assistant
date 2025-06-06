/**
 * Print Preview and Styling for Document Writer
 */
class PrintPreview {
    constructor() {
        this.printStyles = this.getDefaultPrintStyles();
    }
    
    /**
     * Get default print styles
     */
    getDefaultPrintStyles() {
        return {
            fontSize: '12pt',
            lineHeight: '1.6',
            fontFamily: 'Georgia, serif',
            margins: '1in',
            headerFooter: true,
            pageNumbers: true,
            colorMode: 'color' // 'color' or 'grayscale'
        };
    }
    
    /**
     * Show print preview
     */
    showPrintPreview() {
        if (!window.app || !window.app.wizardData || !window.app.wizardData.generatedContent) {
            showToast('No document to preview', 'warning');
            return;
        }
        
        // Create preview window
        const previewWindow = window.open('', '_blank', 'width=800,height=600');
        
        // Generate HTML content
        const htmlContent = this.generatePrintHTML();
        
        // Write to preview window
        previewWindow.document.write(htmlContent);
        previewWindow.document.close();
        
        // Add print button functionality
        previewWindow.document.getElementById('print-btn').addEventListener('click', () => {
            previewWindow.print();
        });
        
        // Add close button functionality
        previewWindow.document.getElementById('close-btn').addEventListener('click', () => {
            previewWindow.close();
        });
    }
    
    /**
     * Generate print-ready HTML
     */
    generatePrintHTML() {
        const content = window.app.wizardData.generatedContent || '';
        const title = window.app.wizardData.documentTitle || 'Untitled Document';
        const author = window.app.wizardData.documentData.author || '';
        const date = window.app.wizardData.documentData.date || new Date().toLocaleDateString();
        
        // Convert markdown to HTML
        const htmlContent = this.markdownToHTML(content);
        
        // Get print styles
        const styles = this.getPrintStyles();
        
        return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title} - Print Preview</title>
    <style>
        ${styles}
        
        /* Preview controls */
        .preview-controls {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            background: #333;
            color: white;
            padding: 10px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            z-index: 1000;
            box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }
        
        .preview-controls button {
            background: #007acc;
            color: white;
            border: none;
            padding: 8px 16px;
            border-radius: 4px;
            cursor: pointer;
            font-size: 14px;
            margin-left: 10px;
        }
        
        .preview-controls button:hover {
            background: #005a9e;
        }
        
        /* Document container */
        .document-container {
            margin-top: 60px;
            padding: 20px;
            max-width: 850px;
            margin-left: auto;
            margin-right: auto;
            background: white;
            box-shadow: 0 0 20px rgba(0,0,0,0.1);
        }
        
        @media print {
            .preview-controls {
                display: none !important;
            }
            
            .document-container {
                margin: 0;
                padding: 0;
                box-shadow: none;
                max-width: none;
            }
        }
    </style>
</head>
<body>
    <div class="preview-controls">
        <div>
            <strong>Print Preview:</strong> ${title}
        </div>
        <div>
            <button id="print-btn">🖨️ Print</button>
            <button id="close-btn">✖️ Close</button>
        </div>
    </div>
    
    <div class="document-container">
        <div class="document-content">
            ${htmlContent}
        </div>
    </div>
    
    <script>
        // Page break detection
        window.addEventListener('load', () => {
            const pageHeight = 11 * 96; // 11 inches in pixels at 96 DPI
            const elements = document.querySelectorAll('h1, h2, h3');
            
            elements.forEach(el => {
                const rect = el.getBoundingClientRect();
                const pageNumber = Math.floor(rect.top / pageHeight);
                const positionOnPage = rect.top % pageHeight;
                
                // If heading is near bottom of page, add page break before it
                if (positionOnPage > pageHeight * 0.9) {
                    el.style.pageBreakBefore = 'always';
                }
            });
        });
    </script>
</body>
</html>
        `;
    }
    
    /**
     * Get print-specific styles
     */
    getPrintStyles() {
        return `
        /* Base styles */
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
        }
        
        body {
            font-family: ${this.printStyles.fontFamily};
            font-size: ${this.printStyles.fontSize};
            line-height: ${this.printStyles.lineHeight};
            color: #333;
            background: #f5f5f5;
        }
        
        /* Document styles */
        .document-content {
            padding: ${this.printStyles.margins};
            background: white;
        }
        
        /* Typography */
        h1 {
            font-size: 24pt;
            margin-bottom: 16pt;
            color: #222;
            border-bottom: 2px solid #ddd;
            padding-bottom: 8pt;
        }
        
        h2 {
            font-size: 18pt;
            margin-top: 24pt;
            margin-bottom: 12pt;
            color: #333;
        }
        
        h3 {
            font-size: 14pt;
            margin-top: 18pt;
            margin-bottom: 10pt;
            color: #444;
        }
        
        p {
            margin-bottom: 12pt;
            text-align: justify;
        }
        
        /* Lists */
        ul, ol {
            margin-left: 24pt;
            margin-bottom: 12pt;
        }
        
        li {
            margin-bottom: 6pt;
        }
        
        /* Images */
        img {
            max-width: 100%;
            height: auto;
            display: block;
            margin: 16pt auto;
            page-break-inside: avoid;
        }
        
        /* Tables */
        table {
            width: 100%;
            border-collapse: collapse;
            margin: 16pt 0;
            page-break-inside: avoid;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8pt;
            text-align: left;
        }
        
        th {
            background: #f5f5f5;
            font-weight: bold;
        }
        
        /* Code blocks */
        pre, code {
            font-family: 'Courier New', monospace;
            background: #f5f5f5;
            padding: 2pt 4pt;
            border-radius: 3pt;
        }
        
        pre {
            padding: 12pt;
            margin: 12pt 0;
            overflow-x: auto;
            page-break-inside: avoid;
        }
        
        /* Blockquotes */
        blockquote {
            margin: 16pt 0;
            padding: 12pt 24pt;
            border-left: 4pt solid #ddd;
            font-style: italic;
            color: #666;
        }
        
        /* Page breaks */
        .page-break {
            page-break-after: always;
        }
        
        /* Print specific */
        @media print {
            body {
                background: white;
                color: ${this.printStyles.colorMode === 'grayscale' ? '#000' : '#333'};
            }
            
            .document-content {
                padding: 0;
            }
            
            /* Page setup */
            @page {
                size: letter;
                margin: ${this.printStyles.margins};
                
                ${this.printStyles.headerFooter ? `
                @top-center {
                    content: "${window.app.wizardData.documentTitle || 'Document'}";
                    font-size: 10pt;
                    color: #666;
                }
                
                @bottom-right {
                    content: ${this.printStyles.pageNumbers ? 'counter(page)' : '""'};
                    font-size: 10pt;
                    color: #666;
                }
                ` : ''}
            }
            
            /* Avoid breaks */
            h1, h2, h3, h4, h5, h6 {
                page-break-after: avoid;
            }
            
            p {
                orphans: 3;
                widows: 3;
            }
            
            /* Links */
            a {
                color: ${this.printStyles.colorMode === 'grayscale' ? '#000' : '#007acc'};
                text-decoration: none;
            }
            
            a[href^="http"]:after {
                content: " (" attr(href) ")";
                font-size: 10pt;
                color: #666;
            }
            
            /* Images in grayscale */
            ${this.printStyles.colorMode === 'grayscale' ? `
            img {
                filter: grayscale(100%);
            }
            ` : ''}
        }
        `;
    }
    
    /**
     * Convert markdown to HTML
     */
    markdownToHTML(markdown) {
        // Basic markdown to HTML conversion
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gim, '<h3>$1</h3>')
            .replace(/^## (.*$)/gim, '<h2>$1</h2>')
            .replace(/^# (.*$)/gim, '<h1>$1</h1>')
            // Bold
            .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
            // Italic
            .replace(/\*(.+?)\*/g, '<em>$1</em>')
            // Links
            .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>')
            // Images
            .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">')
            // Line breaks
            .replace(/\n\n/g, '</p><p>')
            // Lists
            .replace(/^\* (.+)$/gim, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/^\d+\. (.+)$/gim, '<li>$1</li>');
        
        // Wrap in paragraphs
        html = '<p>' + html + '</p>';
        
        // Clean up
        html = html
            .replace(/<p><h/g, '<h')
            .replace(/<\/h(\d)><\/p>/g, '</h$1>')
            .replace(/<p><ul>/g, '<ul>')
            .replace(/<\/ul><\/p>/g, '</ul>')
            .replace(/<p><\/p>/g, '');
        
        return html;
    }
    
    /**
     * Show print settings dialog
     */
    showPrintSettings() {
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h2>🖨️ Print Settings</h2>
                
                <div class="form-group">
                    <label>Font Size</label>
                    <select id="print-font-size" class="form-input">
                        <option value="10pt" ${this.printStyles.fontSize === '10pt' ? 'selected' : ''}>10pt</option>
                        <option value="11pt" ${this.printStyles.fontSize === '11pt' ? 'selected' : ''}>11pt</option>
                        <option value="12pt" ${this.printStyles.fontSize === '12pt' ? 'selected' : ''}>12pt</option>
                        <option value="14pt" ${this.printStyles.fontSize === '14pt' ? 'selected' : ''}>14pt</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Font Family</label>
                    <select id="print-font-family" class="form-input">
                        <option value="Georgia, serif" ${this.printStyles.fontFamily === 'Georgia, serif' ? 'selected' : ''}>Georgia (Serif)</option>
                        <option value="Arial, sans-serif" ${this.printStyles.fontFamily === 'Arial, sans-serif' ? 'selected' : ''}>Arial (Sans-serif)</option>
                        <option value="'Times New Roman', serif" ${this.printStyles.fontFamily === "'Times New Roman', serif" ? 'selected' : ''}>Times New Roman</option>
                        <option value="'Courier New', monospace" ${this.printStyles.fontFamily === "'Courier New', monospace" ? 'selected' : ''}>Courier New</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Line Height</label>
                    <select id="print-line-height" class="form-input">
                        <option value="1.2" ${this.printStyles.lineHeight === '1.2' ? 'selected' : ''}>1.2 (Compact)</option>
                        <option value="1.5" ${this.printStyles.lineHeight === '1.5' ? 'selected' : ''}>1.5 (Normal)</option>
                        <option value="1.6" ${this.printStyles.lineHeight === '1.6' ? 'selected' : ''}>1.6 (Comfortable)</option>
                        <option value="2.0" ${this.printStyles.lineHeight === '2.0' ? 'selected' : ''}>2.0 (Double)</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Margins</label>
                    <select id="print-margins" class="form-input">
                        <option value="0.5in" ${this.printStyles.margins === '0.5in' ? 'selected' : ''}>Narrow (0.5")</option>
                        <option value="1in" ${this.printStyles.margins === '1in' ? 'selected' : ''}>Normal (1")</option>
                        <option value="1.25in" ${this.printStyles.margins === '1.25in' ? 'selected' : ''}>Wide (1.25")</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>Color Mode</label>
                    <select id="print-color-mode" class="form-input">
                        <option value="color" ${this.printStyles.colorMode === 'color' ? 'selected' : ''}>Color</option>
                        <option value="grayscale" ${this.printStyles.colorMode === 'grayscale' ? 'selected' : ''}>Grayscale</option>
                    </select>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="print-page-numbers" ${this.printStyles.pageNumbers ? 'checked' : ''}>
                        Show page numbers
                    </label>
                </div>
                
                <div class="form-group">
                    <label>
                        <input type="checkbox" id="print-header-footer" ${this.printStyles.headerFooter ? 'checked' : ''}>
                        Show header/footer
                    </label>
                </div>
                
                <div class="modal-actions">
                    <button class="secondary-button" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="primary-button" id="apply-print-settings">Apply & Preview</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
        
        // Apply settings
        document.getElementById('apply-print-settings').addEventListener('click', () => {
            this.printStyles = {
                fontSize: document.getElementById('print-font-size').value,
                fontFamily: document.getElementById('print-font-family').value,
                lineHeight: document.getElementById('print-line-height').value,
                margins: document.getElementById('print-margins').value,
                colorMode: document.getElementById('print-color-mode').value,
                pageNumbers: document.getElementById('print-page-numbers').checked,
                headerFooter: document.getElementById('print-header-footer').checked
            };
            
            // Save settings
            localStorage.setItem('printSettings', JSON.stringify(this.printStyles));
            
            modal.remove();
            this.showPrintPreview();
        });
        
        // Close on background click
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
    }
    
    /**
     * Quick print
     */
    quickPrint() {
        if (!window.app || !window.app.wizardData || !window.app.wizardData.generatedContent) {
            showToast('No document to print', 'warning');
            return;
        }
        
        window.print();
    }
}

// Initialize print preview
window.printPreview = new PrintPreview();

// Load saved settings
const savedSettings = localStorage.getItem('printSettings');
if (savedSettings) {
    window.printPreview.printStyles = JSON.parse(savedSettings);
}

// Add keyboard shortcuts
if (window.keyboardShortcuts) {
    window.keyboardShortcuts.register('ctrl+p', () => {
        window.printPreview.showPrintSettings();
    }, 'Print settings & preview');
    
    window.keyboardShortcuts.register('ctrl+shift+p', () => {
        window.printPreview.quickPrint();
    }, 'Quick print');
}