/**
 * Document Generator for creating various document formats
 */
class DocumentGenerator {
    constructor() {
        this.templates = {
            business: this.getBusinessTemplate(),
            technical: this.getTechnicalTemplate(),
            academic: this.getAcademicTemplate(),
            report: this.getReportTemplate(),
            letter: this.getLetterTemplate(),
            custom: this.getCustomTemplate()
        };
        
        // Initialize image generator
        this.imageGenerator = new ImageGenerator();
    }

    /**
     * Generate document based on wizard data
     */
    async generateDocument(wizardData, format = 'html') {
        const { documentType, documentTitle, documentData, sections } = wizardData;
        
        try {
            showLoading('Generating document with AI...');
            
            // Prepare document details for AI
            const documentDetails = {
                title: documentTitle,
                type: documentType,
                description: documentData.description,
                author: documentData.author,
                date: documentData.date,
                sections: sections || []
            };

            // Generate content using AI
            let aiContent = '';
            if (window.aiClient && window.aiClient.isConnected) {
                // Enhance document details with research and uploaded files context
                const enhancedDetails = this.enhanceWithContext(documentDetails);
                aiContent = await window.aiClient.generateDocument(enhancedDetails);
            } else {
                aiContent = this.generatePlaceholderContent(documentDetails);
                showToast('AI not connected. Using placeholder content.', 'warning');
            }

            // Generate document in requested format
            let generatedDocument;
            switch (format.toLowerCase()) {
                case 'html':
                    generatedDocument = this.generateHTML(documentDetails, aiContent);
                    break;
                case 'markdown':
                    generatedDocument = this.generateMarkdown(documentDetails, aiContent);
                    break;
                case 'pdf':
                    generatedDocument = await this.generatePDF(documentDetails, aiContent);
                    break;
                case 'docx':
                    generatedDocument = await this.generateDOCX(documentDetails, aiContent);
                    break;
                default:
                    generatedDocument = this.generateHTML(documentDetails, aiContent);
            }

            hideLoading();
            return generatedDocument;
            
        } catch (error) {
            hideLoading();
            console.error('Error generating document:', error);
            showToast('Error generating document: ' + error.message, 'error');
            throw error;
        }
    }

    /**
     * Generate HTML document
     */
    generateHTML(documentDetails, content) {
        const { title, type, author, date } = documentDetails;
        const formattedDate = date ? new Date(date).toLocaleDateString() : new Date().toLocaleDateString();
        
        // For export, we need to restore data URLs
        let exportContent = content;
        if (window.imageStorage) {
            exportContent = window.imageStorage.restoreDataUrls(content);
        }
        
        // Convert markdown content to HTML (basic conversion)
        // Skip processing since we already restored data URLs
        const htmlContent = this.markdownToHTML(exportContent, true);
        
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            max-width: 800px;
            margin: 0 auto;
            padding: 2rem;
            line-height: 1.6;
            color: #333;
        }
        .document-header {
            text-align: center;
            border-bottom: 2px solid #007acc;
            padding-bottom: 1rem;
            margin-bottom: 2rem;
        }
        .document-title {
            font-size: 2.5rem;
            color: #007acc;
            margin: 0;
        }
        .document-meta {
            color: #666;
            margin-top: 0.5rem;
        }
        h1 { color: #007acc; border-bottom: 1px solid #eee; padding-bottom: 0.5rem; }
        h2 { color: #0056b3; margin-top: 2rem; }
        h3 { color: #004080; }
        blockquote {
            border-left: 4px solid #007acc;
            padding-left: 1rem;
            margin: 1rem 0;
            background: #f8f9fa;
            padding: 1rem;
        }
        code {
            background: #f8f9fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
        }
        pre {
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 5px;
            overflow-x: auto;
        }
        table {
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }
        th, td {
            border: 1px solid #ddd;
            padding: 0.75rem;
            text-align: left;
        }
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        .document-image {
            margin: 2rem 0;
            text-align: center;
        }
        .document-image img {
            max-width: 100%;
            height: auto;
            border: 1px solid #e0e0e0;
            border-radius: 4px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }
        .document-image figcaption {
            margin-top: 0.5rem;
            font-style: italic;
            color: #666;
            font-size: 0.9rem;
        }
        .footer {
            margin-top: 3rem;
            padding-top: 1rem;
            border-top: 1px solid #eee;
            text-align: center;
            color: #666;
            font-size: 0.9rem;
        }
        @media print {
            body { margin: 0; padding: 1rem; }
            .document-header { page-break-after: avoid; }
            .document-image { page-break-inside: avoid; }
        }
    </style>
</head>
<body>
    <div class="document-header">
        <h1 class="document-title">${title}</h1>
        <div class="document-meta">
            ${author ? `<p><strong>Author:</strong> ${author}</p>` : ''}
            <p><strong>Date:</strong> ${formattedDate}</p>
            <p><strong>Document Type:</strong> ${type.charAt(0).toUpperCase() + type.slice(1)}</p>
        </div>
    </div>
    
    <div class="document-content">
        ${htmlContent}
    </div>
    
    <div class="footer">
        <p>Generated by Document Writer with AI assistance</p>
    </div>
</body>
</html>`;
    }

    /**
     * Generate Markdown document
     */
    generateMarkdown(documentDetails, content) {
        const { title, type, author, date } = documentDetails;
        const formattedDate = date ? new Date(date).toLocaleDateString() : new Date().toLocaleDateString();
        
        // For markdown export, restore data URLs
        if (window.imageStorage) {
            content = window.imageStorage.restoreDataUrls(content);
        }
        
        return `# ${title}

**Document Type:** ${type.charAt(0).toUpperCase() + type.slice(1)}  
${author ? `**Author:** ${author}  ` : ''}**Date:** ${formattedDate}

---

${content}

---

*Created with Alicia - Your Personal Document Assistant*`;
    }

    /**
     * Basic markdown to HTML conversion with image support
     */
    markdownToHTML(markdown, skipProcessing = false) {
        // First, process any data URLs in the markdown to store them
        // Skip this if we're already processing for export
        if (window.imageStorage && !skipProcessing) {
            markdown = window.imageStorage.processContent(markdown);
        }
        
        let html = markdown
            // Headers
            .replace(/^### (.*$)/gm, '<h3>$1</h3>')
            .replace(/^## (.*$)/gm, '<h2>$1</h2>')
            .replace(/^# (.*$)/gm, '<h1>$1</h1>')
            // Bold and italic
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            // Code blocks
            .replace(/```([\s\S]*?)```/g, '<pre><code>$1</code></pre>')
            .replace(/`(.*?)`/g, '<code>$1</code>')
            // Lists
            .replace(/^\* (.*$)/gm, '<li>$1</li>')
            .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
            .replace(/^\d+\. (.*$)/gm, '<li>$1</li>')
            // Paragraphs
            .replace(/\n\n/g, '</p><p>')
            .replace(/^(.*)$/gm, '<p>$1</p>')
            // Clean up
            .replace(/<p><\/p>/g, '')
            .replace(/<p>(<h[1-6]>.*<\/h[1-6]>)<\/p>/g, '$1')
            .replace(/<p>(<ul>.*<\/ul>)<\/p>/g, '$1')
            .replace(/<p>(<pre>.*<\/pre>)<\/p>/g, '$1');
            
        // Handle images
        html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, (match, alt, src) => {
            // Check if this is a stored image path
            if (window.imageStorage && src.startsWith('/stored-images/')) {
                const imageData = window.imageStorage.getImage(src);
                if (imageData) {
                    src = imageData.dataUrl;
                }
            }
            
            return `<figure class="document-image">
                <img src="${src}" alt="${alt}" style="max-width: 100%; height: auto;">
                ${alt ? `<figcaption>${alt}</figcaption>` : ''}
            </figure>`;
        });
        
        return html;
    }

    /**
     * Generate placeholder content when AI is not available
     */
    generatePlaceholderContent(documentDetails) {
        const { title, type, sections } = documentDetails;
        
        let content = `# ${title}\n\n`;
        content += `This is a ${type} document that has been generated as a template.\n\n`;
        
        if (sections && sections.length > 0) {
            sections.forEach((section, index) => {
                content += `## ${section.title}\n\n`;
                content += section.content || `This section should contain information about ${section.title.toLowerCase()}. Please replace this placeholder text with your actual content.\n\n`;
            });
        } else {
            // Generate default sections based on document type
            const defaultSections = this.getDefaultSections(type);
            defaultSections.forEach(section => {
                content += `## ${section}\n\n`;
                content += `This section should contain information about ${section.toLowerCase()}. Please replace this placeholder text with your actual content.\n\n`;
            });
        }
        
        content += `## Conclusion\n\n`;
        content += `This concludes the ${type} document. Please review and modify the content as needed.\n\n`;
        
        return content;
    }

    /**
     * Get default sections for document types
     */
    getDefaultSections(type) {
        const sectionMap = {
            business: ['Executive Summary', 'Background', 'Objectives', 'Methodology', 'Results', 'Recommendations'],
            technical: ['Overview', 'Requirements', 'Architecture', 'Implementation', 'Testing', 'Documentation'],
            academic: ['Abstract', 'Introduction', 'Literature Review', 'Methodology', 'Results', 'Discussion'],
            report: ['Executive Summary', 'Introduction', 'Findings', 'Analysis', 'Recommendations'],
            letter: ['Opening', 'Main Content', 'Closing'],
            custom: ['Introduction', 'Main Content', 'Summary']
        };
        
        return sectionMap[type] || sectionMap.custom;
    }

    /**
     * Generate PDF document
     */
    async generatePDF(documentDetails, content) {
        try {
            // First generate HTML
            const htmlContent = this.generateHTML(documentDetails, content);
            
            // Create a blob from HTML
            const blob = new Blob([htmlContent], { type: 'text/html' });
            const url = URL.createObjectURL(blob);
            
            // Open in new window
            const printWindow = window.open(url, '_blank');
            
            if (!printWindow) {
                throw new Error('Pop-up blocked. Please allow pop-ups for this site.');
            }
            
            // Wait for window to load before printing
            printWindow.onload = function() {
                // Add print styles dynamically
                const style = printWindow.document.createElement('style');
                style.textContent = `
                    @media print {
                        body { margin: 20mm; }
                        .document-header { page-break-after: avoid; }
                        h1, h2, h3 { page-break-after: avoid; }
                        p { page-break-inside: avoid; }
                        .footer { page-break-before: always; }
                    }
                `;
                printWindow.document.head.appendChild(style);
                
                // Trigger print dialog
                setTimeout(() => {
                    printWindow.print();
                }, 500);
            };
            
            // Clean up
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 60000); // Clean up after 1 minute
            
            return true;
            
        } catch (error) {
            console.error('PDF generation error:', error);
            throw error;
        }
    }

    /**
     * Generate DOCX document using a simpler HTML to DOCX conversion
     */
    async generateDOCX(documentDetails, content) {
        try {
            // Generate HTML content first
            const htmlContent = this.generateHTML(documentDetails, content);
            
            // Create a simplified HTML structure for DOCX conversion
            const docxHTML = `
                <html xmlns:o='urn:schemas-microsoft-com:office:office' 
                      xmlns:w='urn:schemas-microsoft-com:office:word' 
                      xmlns='http://www.w3.org/TR/REC-html40'>
                <head>
                    <meta charset="utf-8">
                    <title>${documentDetails.title}</title>
                    <!--[if gte mso 9]>
                    <xml>
                        <w:WordDocument>
                            <w:View>Print</w:View>
                            <w:Zoom>100</w:Zoom>
                            <w:DoNotOptimizeForBrowser/>
                        </w:WordDocument>
                    </xml>
                    <![endif]-->
                    <style>
                        @page {
                            size: A4;
                            margin: 2cm;
                        }
                        body {
                            font-family: 'Times New Roman', serif;
                            font-size: 12pt;
                            line-height: 1.5;
                            color: black;
                        }
                        h1 { font-size: 20pt; font-weight: bold; margin: 20pt 0 10pt 0; }
                        h2 { font-size: 16pt; font-weight: bold; margin: 16pt 0 8pt 0; }
                        h3 { font-size: 14pt; font-weight: bold; margin: 14pt 0 6pt 0; }
                        p { margin: 0 0 10pt 0; }
                        .document-header { text-align: center; margin-bottom: 30pt; }
                        .document-title { font-size: 24pt; font-weight: bold; margin: 0 0 10pt 0; }
                        .document-meta { font-size: 11pt; margin: 5pt 0; }
                        .footer { text-align: center; margin-top: 50pt; font-style: italic; color: #666; }
                    </style>
                </head>
                <body>
                    ${this.extractBodyContent(htmlContent)}
                </body>
                </html>`;
            
            // Create blob with proper MIME type for Word
            const blob = new Blob(['\ufeff', docxHTML], {
                type: 'application/msword'
            });
            
            return blob;
            
        } catch (error) {
            console.error('DOCX generation error:', error);
            
            // Fallback: try RTF format
            try {
                return this.generateRTF(documentDetails, content);
            } catch (rtfError) {
                throw new Error('Document generation failed. Please try HTML export instead.');
            }
        }
    }

    /**
     * Extract body content from HTML
     */
    extractBodyContent(html) {
        const match = html.match(/<body[^>]*>([\s\S]*)<\/body>/i);
        return match ? match[1] : html;
    }

    /**
     * Generate RTF document as fallback
     */
    generateRTF(documentDetails, content) {
        // Basic RTF header
        let rtf = '{\\rtf1\\ansi\\deff0 {\\fonttbl {\\f0 Times New Roman;}}\\f0\\fs24';
        
        // Title
        rtf += '\\qc\\b\\fs32 ' + this.escapeRTF(documentDetails.title) + '\\b0\\fs24\\par\\par';
        
        // Metadata
        if (documentDetails.author) {
            rtf += '\\qc Author: ' + this.escapeRTF(documentDetails.author) + '\\par';
        }
        rtf += '\\qc Date: ' + new Date(documentDetails.date || Date.now()).toLocaleDateString() + '\\par\\par';
        
        // Content
        rtf += '\\ql '; // Left align
        const lines = content.split('\n');
        
        for (const line of lines) {
            if (line.startsWith('# ')) {
                rtf += '\\b\\fs28 ' + this.escapeRTF(line.substring(2)) + '\\b0\\fs24\\par\\par';
            } else if (line.startsWith('## ')) {
                rtf += '\\b\\fs26 ' + this.escapeRTF(line.substring(3)) + '\\b0\\fs24\\par\\par';
            } else if (line.startsWith('### ')) {
                rtf += '\\b ' + this.escapeRTF(line.substring(4)) + '\\b0\\par\\par';
            } else if (line.trim() === '') {
                rtf += '\\par';
            } else {
                rtf += this.escapeRTF(line) + ' ';
            }
        }
        
        // Footer
        rtf += '\\par\\par\\qc\\i Generated by Document Writer with AI assistance\\i0';
        
        rtf += '}';
        
        return new Blob([rtf], { type: 'application/rtf' });
    }

    /**
     * Escape special characters for RTF
     */
    escapeRTF(text) {
        return text
            .replace(/\\/g, '\\\\')
            .replace(/{/g, '\\{')
            .replace(/}/g, '\\}')
            .replace(/\n/g, '\\par ');
    }

    /**
     * Download generated document
     */
    downloadDocument(content, filename, mimeType) {
        // Handle blob content (for DOCX)
        if (content instanceof Blob) {
            const url = URL.createObjectURL(content);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        } else {
            // Handle string content (HTML, Markdown)
            const blob = new Blob([content], { type: mimeType });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }
    }

    /**
     * Preview document in new window
     */
    previewDocument(htmlContent, title) {
        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(htmlContent);
        previewWindow.document.close();
        previewWindow.focus();
    }

    // Template methods (for future use with more sophisticated templating)
    getBusinessTemplate() {
        return {
            name: 'Business Document',
            sections: ['Executive Summary', 'Background', 'Objectives', 'Methodology', 'Results', 'Recommendations']
        };
    }

    getTechnicalTemplate() {
        return {
            name: 'Technical Document',
            sections: ['Overview', 'Requirements', 'Architecture', 'Implementation', 'Testing', 'Documentation']
        };
    }

    getAcademicTemplate() {
        return {
            name: 'Academic Paper',
            sections: ['Abstract', 'Introduction', 'Literature Review', 'Methodology', 'Results', 'Discussion']
        };
    }

    getReportTemplate() {
        return {
            name: 'Report',
            sections: ['Executive Summary', 'Introduction', 'Findings', 'Analysis', 'Recommendations']
        };
    }

    getLetterTemplate() {
        return {
            name: 'Letter',
            sections: ['Opening', 'Main Content', 'Closing']
        };
    }

    getCustomTemplate() {
        return {
            name: 'Custom Document',
            sections: ['Introduction', 'Main Content', 'Summary']
        };
    }

    /**
     * Enhance document details with research and uploaded files context
     */
    enhanceWithContext(documentDetails) {
        let contextualInfo = '';
        
        // Add uploaded documents context
        if (window.fileProcessor && window.uploadedDocuments && window.uploadedDocuments.length > 0) {
            contextualInfo += window.fileProcessor.getUploadedDocumentsContext();
        }
        
        // Add research context
        if (window.researchAssistant && window.researchContext) {
            contextualInfo += window.researchContext;
        }
        
        // Enhance the description with contextual information
        const enhancedDescription = documentDetails.description + 
            (contextualInfo ? '\n\nAdditional Context:\n' + contextualInfo : '');
        
        return {
            ...documentDetails,
            description: enhancedDescription,
            hasExternalContext: contextualInfo.length > 0
        };
    }
}

// Create global document generator instance
window.documentGenerator = new DocumentGenerator();