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
        
        // Convert markdown content to HTML (basic conversion)
        const htmlContent = this.markdownToHTML(content);
        
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
        
        return `# ${title}

**Document Type:** ${type.charAt(0).toUpperCase() + type.slice(1)}  
${author ? `**Author:** ${author}  ` : ''}**Date:** ${formattedDate}

---

${content}

---

*Generated by Document Writer with AI assistance*`;
    }

    /**
     * Basic markdown to HTML conversion
     */
    markdownToHTML(markdown) {
        return markdown
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
            
            // Create a new window for printing
            const printWindow = window.open('', '_blank');
            printWindow.document.write(htmlContent);
            printWindow.document.close();
            
            // Add print-specific styles
            const printStyles = printWindow.document.createElement('style');
            printStyles.textContent = `
                @media print {
                    body { margin: 0; }
                    .document-header { page-break-after: avoid; }
                    h1, h2, h3 { page-break-after: avoid; }
                    p { page-break-inside: avoid; }
                    .footer { page-break-before: avoid; }
                }
            `;
            printWindow.document.head.appendChild(printStyles);
            
            // Wait for content to load
            setTimeout(() => {
                printWindow.print();
                // Close window after a delay to ensure print dialog appears
                setTimeout(() => {
                    printWindow.close();
                }, 1000);
            }, 500);
            
            return true; // Return true to indicate PDF generation initiated
            
        } catch (error) {
            console.error('PDF generation error:', error);
            throw new Error('PDF generation failed. Please try HTML export instead.');
        }
    }

    /**
     * Generate DOCX document
     */
    async generateDOCX(documentDetails, content) {
        try {
            // Check if docx library is loaded
            if (typeof window.docx === 'undefined') {
                // Load docx library dynamically
                await this.loadDocxLibrary();
            }
            
            const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = window.docx;
            
            // Parse content into sections
            const lines = content.split('\n');
            const children = [];
            
            // Add title
            children.push(
                new Paragraph({
                    text: documentDetails.title,
                    heading: HeadingLevel.TITLE,
                    alignment: AlignmentType.CENTER,
                    spacing: { after: 400 }
                })
            );
            
            // Add metadata
            if (documentDetails.author) {
                children.push(
                    new Paragraph({
                        alignment: AlignmentType.CENTER,
                        children: [
                            new TextRun({
                                text: 'Author: ',
                                bold: true
                            }),
                            new TextRun(documentDetails.author)
                        ],
                        spacing: { after: 200 }
                    })
                );
            }
            
            children.push(
                new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                        new TextRun({
                            text: 'Date: ',
                            bold: true
                        }),
                        new TextRun(new Date(documentDetails.date || Date.now()).toLocaleDateString())
                    ],
                    spacing: { after: 400 }
                })
            );
            
            // Add page break after header
            children.push(new PageBreak());
            
            // Process content
            let currentParagraphText = '';
            let inCodeBlock = false;
            
            for (const line of lines) {
                // Check for headers
                if (line.startsWith('# ') && !inCodeBlock) {
                    if (currentParagraphText) {
                        children.push(new Paragraph({ text: currentParagraphText.trim() }));
                        currentParagraphText = '';
                    }
                    children.push(
                        new Paragraph({
                            text: line.substring(2),
                            heading: HeadingLevel.HEADING_1,
                            spacing: { before: 400, after: 200 }
                        })
                    );
                } else if (line.startsWith('## ') && !inCodeBlock) {
                    if (currentParagraphText) {
                        children.push(new Paragraph({ text: currentParagraphText.trim() }));
                        currentParagraphText = '';
                    }
                    children.push(
                        new Paragraph({
                            text: line.substring(3),
                            heading: HeadingLevel.HEADING_2,
                            spacing: { before: 300, after: 150 }
                        })
                    );
                } else if (line.startsWith('### ') && !inCodeBlock) {
                    if (currentParagraphText) {
                        children.push(new Paragraph({ text: currentParagraphText.trim() }));
                        currentParagraphText = '';
                    }
                    children.push(
                        new Paragraph({
                            text: line.substring(4),
                            heading: HeadingLevel.HEADING_3,
                            spacing: { before: 200, after: 100 }
                        })
                    );
                } else if (line.startsWith('```')) {
                    inCodeBlock = !inCodeBlock;
                    if (currentParagraphText) {
                        children.push(new Paragraph({ text: currentParagraphText.trim() }));
                        currentParagraphText = '';
                    }
                } else if (line.trim() === '' && !inCodeBlock) {
                    // Empty line - end current paragraph
                    if (currentParagraphText) {
                        children.push(new Paragraph({ 
                            text: currentParagraphText.trim(),
                            spacing: { after: 200 }
                        }));
                        currentParagraphText = '';
                    }
                } else {
                    // Regular text or code
                    currentParagraphText += line + ' ';
                }
            }
            
            // Add any remaining text
            if (currentParagraphText) {
                children.push(new Paragraph({ text: currentParagraphText.trim() }));
            }
            
            // Add footer
            children.push(new PageBreak());
            children.push(
                new Paragraph({
                    text: 'Generated by Document Writer with AI assistance',
                    alignment: AlignmentType.CENTER,
                    spacing: { before: 400 }
                })
            );
            
            // Create document
            const doc = new Document({
                sections: [{
                    properties: {},
                    children: children
                }]
            });
            
            // Generate blob
            const blob = await Packer.toBlob(doc);
            return blob;
            
        } catch (error) {
            console.error('DOCX generation error:', error);
            throw new Error('DOCX generation failed. Please ensure you have an internet connection and try again.');
        }
    }

    /**
     * Load DOCX library dynamically
     */
    async loadDocxLibrary() {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://unpkg.com/docx@7.8.0/build/index.js';
            script.onload = resolve;
            script.onerror = () => reject(new Error('Failed to load DOCX library'));
            document.head.appendChild(script);
        });
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