/**
 * File Processor for handling document uploads and extraction
 */
class FileProcessor {
    constructor() {
        this.supportedFormats = {
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
            'application/msword': 'doc',
            'application/pdf': 'pdf',
            'text/plain': 'txt',
            'text/markdown': 'md',
            'text/html': 'html'
        };
    }

    /**
     * Process uploaded file and extract text content
     */
    async processFile(file) {
        // Add file size limit (25MB)
        const maxSize = 25 * 1024 * 1024; // 25MB
        if (file.size > maxSize) {
            throw new Error(`File size exceeds limit of 25MB. File size: ${(file.size / 1024 / 1024).toFixed(2)}MB`);
        }
        
        const fileType = this.supportedFormats[file.type];
        
        if (!fileType) {
            throw new Error(`Unsupported file type: ${file.type}`);
        }

        try {
            let extractedContent = '';
            
            switch (fileType) {
                case 'docx':
                    extractedContent = await this.extractFromDocx(file);
                    break;
                case 'pdf':
                    extractedContent = await this.extractFromPdf(file);
                    break;
                case 'txt':
                case 'md':
                case 'html':
                    extractedContent = await this.extractFromText(file);
                    break;
                default:
                    throw new Error(`Processing not implemented for ${fileType}`);
            }

            return {
                filename: file.name,
                type: fileType,
                size: file.size,
                content: extractedContent,
                wordCount: this.countWords(extractedContent),
                summary: await this.generateSummary(extractedContent)
            };

        } catch (error) {
            console.error('File processing error:', error);
            throw new Error(`Failed to process ${file.name}: ${error.message}`);
        }
    }

    /**
     * Extract text from DOCX file using mammoth.js
     */
    async extractFromDocx(file) {
        // Load mammoth.js dynamically if not already loaded
        if (typeof mammoth === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/mammoth@1.6.0/mammoth.browser.min.js');
        }

        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer: arrayBuffer });
        
        if (result.messages && result.messages.length > 0) {
            console.warn('DOCX extraction warnings:', result.messages);
        }
        
        return result.value;
    }

    /**
     * Extract text from PDF using PDF.js
     */
    async extractFromPdf(file) {
        // Load PDF.js dynamically if not already loaded
        if (typeof pdfjsLib === 'undefined') {
            await this.loadScript('https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.min.js');
            
            // Set worker path
            pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js';
        }

        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
        
        let fullText = '';
        
        for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            const pageText = textContent.items.map(item => item.str).join(' ');
            fullText += pageText + '\n\n';
        }
        
        return fullText.trim();
    }

    /**
     * Extract text from plain text files
     */
    async extractFromText(file) {
        return await file.text();
    }

    /**
     * Load external script dynamically
     */
    loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }

    /**
     * Count words in text
     */
    countWords(text) {
        if (!text) return 0;
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Generate AI summary of extracted content
     */
    async generateSummary(content, maxLength = 500) {
        if (!content || content.length < 100) {
            return 'Content too short for summary';
        }

        if (!window.aiClient || !window.aiClient.isConnected) {
            return 'AI not available for summary generation';
        }

        try {
            const prompt = `Please provide a concise summary of the following document content in ${maxLength} characters or less. Focus on the main topics, key points, and overall purpose:

${content.substring(0, 3000)}${content.length > 3000 ? '...' : ''}`;

            const summary = await window.aiClient.generateText(prompt, {
                temperature: 0.3,
                maxTokens: 150
            });

            return summary;
        } catch (error) {
            console.error('Summary generation failed:', error);
            return 'Summary generation failed';
        }
    }

    /**
     * Create file upload UI component
     */
    createFileUploadUI(containerId, options = {}) {
        const container = document.getElementById(containerId);
        if (!container) return;

        const uploadArea = document.createElement('div');
        uploadArea.className = 'file-upload-area';
        uploadArea.innerHTML = `
            <div class="file-upload-zone" id="file-drop-zone">
                <div class="upload-icon">📄</div>
                <div class="upload-text">
                    <h4>Upload Reference Document</h4>
                    <p>Drag & drop or click to select a Word document, PDF, or text file</p>
                    <small>Supported: .docx, .pdf, .txt, .md</small>
                </div>
                <input type="file" id="file-input" accept=".docx,.pdf,.txt,.md,.html" style="display: none;">
                <button class="secondary-button" id="select-file-btn">Select File</button>
            </div>
            
            <div class="uploaded-files" id="uploaded-files" style="display: none;">
                <h5>Uploaded Reference Documents:</h5>
                <div class="file-list" id="file-list"></div>
            </div>
        `;

        container.appendChild(uploadArea);
        this.setupFileUploadHandlers();
    }

    /**
     * Setup file upload event handlers
     */
    setupFileUploadHandlers() {
        const fileInput = document.getElementById('file-input');
        const selectBtn = document.getElementById('select-file-btn');
        const dropZone = document.getElementById('file-drop-zone');

        if (!fileInput || !selectBtn || !dropZone) return;

        // Click to select file
        selectBtn.addEventListener('click', () => fileInput.click());
        dropZone.addEventListener('click', (e) => {
            if (e.target === dropZone || e.target.classList.contains('upload-text')) {
                fileInput.click();
            }
        });

        // File selection
        fileInput.addEventListener('change', (e) => {
            this.handleFileSelection(e.target.files);
        });

        // Drag and drop
        dropZone.addEventListener('dragover', (e) => {
            e.preventDefault();
            dropZone.classList.add('drag-over');
        });

        dropZone.addEventListener('dragleave', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
        });

        dropZone.addEventListener('drop', (e) => {
            e.preventDefault();
            dropZone.classList.remove('drag-over');
            this.handleFileSelection(e.dataTransfer.files);
        });
    }

    /**
     * Handle file selection and processing
     */
    async handleFileSelection(files) {
        if (!files || files.length === 0) return;

        const fileList = document.getElementById('file-list');
        const uploadedFiles = document.getElementById('uploaded-files');
        
        if (!fileList || !uploadedFiles) return;

        for (const file of files) {
            try {
                showLoading(`Processing ${file.name}...`);
                
                const processedFile = await this.processFile(file);
                
                // Store in global context for AI use
                if (!window.uploadedDocuments) {
                    window.uploadedDocuments = [];
                }
                window.uploadedDocuments.push(processedFile);
                
                // Add to UI
                this.addFileToUI(processedFile);
                
                hideLoading();
                showToast(`Successfully processed ${file.name}`, 'success');
                
            } catch (error) {
                hideLoading();
                showToast(`Error processing ${file.name}: ${error.message}`, 'error');
            }
        }

        uploadedFiles.style.display = 'block';
    }

    /**
     * Add processed file to UI
     */
    addFileToUI(processedFile) {
        const fileList = document.getElementById('file-list');
        if (!fileList) return;

        const fileItem = document.createElement('div');
        fileItem.className = 'file-item';
        fileItem.innerHTML = `
            <div class="file-info">
                <div class="file-name">${processedFile.filename}</div>
                <div class="file-meta">
                    <span class="file-type">${processedFile.type.toUpperCase()}</span>
                    <span class="file-size">${this.formatFileSize(processedFile.size)}</span>
                    <span class="word-count">${processedFile.wordCount} words</span>
                </div>
                <div class="file-summary">${processedFile.summary}</div>
            </div>
            <div class="file-actions">
                <button class="secondary-button" onclick="fileProcessor.previewFile('${processedFile.filename}')">
                    👁️ Preview
                </button>
                <button class="secondary-button" onclick="fileProcessor.removeFile('${processedFile.filename}')">
                    🗑️ Remove
                </button>
            </div>
        `;

        fileList.appendChild(fileItem);
    }

    /**
     * Format file size for display
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Preview file content
     */
    previewFile(filename) {
        if (!window.uploadedDocuments) return;
        
        const file = window.uploadedDocuments.find(f => f.filename === filename);
        if (!file) return;

        const previewWindow = window.open('', '_blank');
        previewWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>Preview: ${file.filename}</title>
                <style>
                    body { font-family: Arial, sans-serif; padding: 20px; max-width: 800px; margin: 0 auto; }
                    .header { border-bottom: 1px solid #ccc; padding-bottom: 10px; margin-bottom: 20px; }
                    .content { white-space: pre-wrap; line-height: 1.6; }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>${file.filename}</h1>
                    <p><strong>Type:</strong> ${file.type} | <strong>Words:</strong> ${file.wordCount}</p>
                    <p><strong>Summary:</strong> ${file.summary}</p>
                </div>
                <div class="content">${file.content}</div>
            </body>
            </html>
        `);
        previewWindow.document.close();
    }

    /**
     * Remove uploaded file
     */
    removeFile(filename) {
        if (!window.uploadedDocuments) return;
        
        window.uploadedDocuments = window.uploadedDocuments.filter(f => f.filename !== filename);
        
        // Remove from UI
        const fileList = document.getElementById('file-list');
        if (fileList) {
            const fileItems = fileList.querySelectorAll('.file-item');
            fileItems.forEach(item => {
                if (item.querySelector('.file-name').textContent === filename) {
                    item.remove();
                }
            });
        }
        
        // Hide uploaded files section if empty
        if (window.uploadedDocuments.length === 0) {
            const uploadedFiles = document.getElementById('uploaded-files');
            if (uploadedFiles) {
                uploadedFiles.style.display = 'none';
            }
        }
        
        showToast(`Removed ${filename}`, 'success');
    }

    /**
     * Get context from uploaded documents for AI
     */
    getUploadedDocumentsContext() {
        if (!window.uploadedDocuments || window.uploadedDocuments.length === 0) {
            return '';
        }

        let context = '\n\n--- REFERENCE DOCUMENTS ---\n';
        
        window.uploadedDocuments.forEach((doc, index) => {
            context += `\n${index + 1}. ${doc.filename} (${doc.type})\n`;
            context += `Summary: ${doc.summary}\n`;
            context += `Content excerpt: ${doc.content.substring(0, 1000)}${doc.content.length > 1000 ? '...' : ''}\n`;
        });
        
        context += '\n--- END REFERENCE DOCUMENTS ---\n\n';
        context += 'Please use the information from these reference documents to enhance and inform the content you generate.\n\n';
        
        return context;
    }
}

// Create global file processor instance
window.fileProcessor = new FileProcessor();