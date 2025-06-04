// Template Manager Webview Script
(function() {
    // Get VS Code API
    const vscode = acquireVsCodeApi();
    
    // State management
    let managerState = {
        templates: [],
        categories: [],
        currentCategory: 'all',
        selectedTemplate: null,
        isCreatingTemplate: false,
        newTemplate: {
            name: '',
            description: '',
            category: '',
            content: '',
            type: '',
            tags: []
        },
        searchQuery: '',
        isUploading: false
    };
    
    // Initialize
    init();
    
    /**
     * Initialize the webview
     */
    function init() {
        // Get persisted state if available
        const previousState = vscode.getState();
        if (previousState) {
            managerState = previousState;
        }
        
        // Store state
        vscode.setState(managerState);
        
        // Request templates from extension
        vscode.postMessage({ command: 'getTemplates' });
        
        // Set up event listeners
        setupEventListeners();
        
        // Render UI
        renderUI();
    }
    
    /**
     * Set up event listeners
     */
    function setupEventListeners() {
        // Category tabs
        document.getElementById('category-tabs').addEventListener('click', (e) => {
            if (e.target.classList.contains('category-tab')) {
                const category = e.target.getAttribute('data-category');
                managerState.currentCategory = category;
                updateState();
                renderTemplateList();
                
                // Update active tab
                document.querySelectorAll('.category-tab').forEach(tab => {
                    tab.classList.remove('active');
                });
                e.target.classList.add('active');
            }
        });
        
        // Search input
        document.getElementById('search-input').addEventListener('input', (e) => {
            managerState.searchQuery = e.target.value.trim().toLowerCase();
            updateState();
            renderTemplateList();
        });
        
        // Create template button
        document.getElementById('create-template-button').addEventListener('click', () => {
            managerState.isCreatingTemplate = true;
            managerState.newTemplate = {
                name: '',
                description: '',
                category: '',
                content: '',
                type: '',
                tags: []
            };
            updateState();
            renderUI();
        });
        
        // Import template button
        document.getElementById('import-template-button').addEventListener('click', () => {
            vscode.postMessage({ command: 'importTemplate' });
        });
        
        // Upload template button for drag and drop area
        document.addEventListener('dragover', (e) => {
            e.preventDefault();
            const dropZone = document.getElementById('template-drop-zone');
            if (dropZone) {
                dropZone.classList.add('active');
            }
        });
        
        document.addEventListener('dragleave', (e) => {
            e.preventDefault();
            const dropZone = document.getElementById('template-drop-zone');
            if (dropZone) {
                dropZone.classList.remove('active');
            }
        });
        
        document.addEventListener('drop', (e) => {
            e.preventDefault();
            const dropZone = document.getElementById('template-drop-zone');
            if (dropZone) {
                dropZone.classList.remove('active');
                
                if (e.dataTransfer.files.length > 0) {
                    managerState.isUploading = true;
                    updateState();
                    renderUI();
                    
                    // Notify extension of file drop
                    vscode.postMessage({
                        command: 'dropFiles',
                        fileCount: e.dataTransfer.files.length
                    });
                }
            }
        });
    }
    
    /**
     * Render the UI
     */
    function renderUI() {
        if (managerState.isCreatingTemplate) {
            renderTemplateEditor();
        } else if (managerState.selectedTemplate) {
            renderTemplateDetails();
        } else {
            renderTemplateList();
            renderCategoryTabs();
        }
        
        // Render upload overlay if uploading
        if (managerState.isUploading) {
            renderUploadOverlay();
        }
    }
    
    /**
     * Render the category tabs
     */
    function renderCategoryTabs() {
        const categoryTabs = document.getElementById('category-tabs');
        categoryTabs.innerHTML = '';
        
        // Add "All" tab
        const allTab = document.createElement('div');
        allTab.className = `category-tab ${managerState.currentCategory === 'all' ? 'active' : ''}`;
        allTab.setAttribute('data-category', 'all');
        allTab.textContent = 'All Templates';
        categoryTabs.appendChild(allTab);
        
        // Add category tabs
        managerState.categories.forEach(category => {
            const categoryTab = document.createElement('div');
            categoryTab.className = `category-tab ${managerState.currentCategory === category ? 'active' : ''}`;
            categoryTab.setAttribute('data-category', category);
            categoryTab.textContent = formatCategoryName(category);
            categoryTabs.appendChild(categoryTab);
        });
    }
    
    /**
     * Format a category name for display
     * @param {string} category The category name
     * @returns {string} The formatted category name
     */
    function formatCategoryName(category) {
        return category
            .split('-')
            .map(word => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' ');
    }
    
    /**
     * Render the template list
     */
    function renderTemplateList() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        
        // Create template list container
        const templateListContainer = document.createElement('div');
        templateListContainer.className = 'template-list-container';
        
        // Filter templates by category and search query
        const filteredTemplates = managerState.templates.filter(template => {
            // Category filter
            const categoryMatch = managerState.currentCategory === 'all' || 
                template.category === managerState.currentCategory;
            
            // Search filter
            const searchMatch = !managerState.searchQuery || 
                template.name.toLowerCase().includes(managerState.searchQuery) ||
                (template.description && template.description.toLowerCase().includes(managerState.searchQuery)) ||
                (template.tags && template.tags.some(tag => tag.toLowerCase().includes(managerState.searchQuery)));
                
            return categoryMatch && searchMatch;
        });
        
        // Create template cards
        if (filteredTemplates.length === 0) {
            const noTemplates = document.createElement('div');
            noTemplates.className = 'no-templates';
            noTemplates.textContent = 'No templates found.';
            templateListContainer.appendChild(noTemplates);
            
            // Add template drop zone
            const dropZone = document.createElement('div');
            dropZone.id = 'template-drop-zone';
            dropZone.className = 'template-drop-zone';
            
            const dropIcon = document.createElement('div');
            dropIcon.className = 'drop-icon';
            dropIcon.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>';
            
            const dropText = document.createElement('div');
            dropText.className = 'drop-text';
            dropText.textContent = 'Drag and drop template files here';
            
            dropZone.appendChild(dropIcon);
            dropZone.appendChild(dropText);
            templateListContainer.appendChild(dropZone);
        } else {
            const templateGrid = document.createElement('div');
            templateGrid.className = 'template-grid';
            
            filteredTemplates.forEach(template => {
                const templateCard = document.createElement('div');
                templateCard.className = 'template-card';
                templateCard.setAttribute('data-id', template.id);
                
                templateCard.addEventListener('click', () => {
                    managerState.selectedTemplate = template;
                    updateState();
                    renderTemplateDetails();
                });
                
                const templateIcon = document.createElement('div');
                templateIcon.className = 'template-icon';
                if (template.type) {
                    templateIcon.classList.add(template.type.toLowerCase().replace(/\s+/g, '-'));
                }
                
                const templateName = document.createElement('div');
                templateName.className = 'template-name';
                templateName.textContent = template.name;
                
                const templateDescription = document.createElement('div');
                templateDescription.className = 'template-description';
                templateDescription.textContent = template.description || 'No description available';
                
                const templateCategory = document.createElement('div');
                templateCategory.className = 'template-category';
                templateCategory.textContent = formatCategoryName(template.category);
                
                templateCard.appendChild(templateIcon);
                templateCard.appendChild(templateName);
                templateCard.appendChild(templateDescription);
                templateCard.appendChild(templateCategory);
                
                templateGrid.appendChild(templateCard);
            });
            
            templateListContainer.appendChild(templateGrid);
        }
        
        mainContent.appendChild(templateListContainer);
    }
    
    /**
     * Render the template details
     */
    function renderTemplateDetails() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        
        const template = managerState.selectedTemplate;
        
        if (!template) {
            renderTemplateList();
            return;
        }
        
        // Create template details container
        const detailsContainer = document.createElement('div');
        detailsContainer.className = 'template-details-container';
        
        // Back button
        const backButton = document.createElement('button');
        backButton.className = 'back-button';
        backButton.textContent = '← Back to Templates';
        backButton.addEventListener('click', () => {
            managerState.selectedTemplate = null;
            updateState();
            renderTemplateList();
        });
        
        // Template header
        const templateHeader = document.createElement('div');
        templateHeader.className = 'template-header';
        
        const templateName = document.createElement('h2');
        templateName.className = 'template-detail-name';
        templateName.textContent = template.name;
        
        const templateType = document.createElement('div');
        templateType.className = 'template-detail-type';
        templateType.textContent = template.type || 'General Template';
        
        templateHeader.appendChild(templateName);
        templateHeader.appendChild(templateType);
        
        // Template actions
        const actionContainer = document.createElement('div');
        actionContainer.className = 'template-actions';
        
        const useButton = document.createElement('button');
        useButton.className = 'action-button primary';
        useButton.textContent = 'Use Template';
        useButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'useTemplate',
                templateId: template.id
            });
        });
        
        const editButton = document.createElement('button');
        editButton.className = 'action-button';
        editButton.textContent = 'Edit Template';
        editButton.addEventListener('click', () => {
            managerState.isCreatingTemplate = true;
            managerState.newTemplate = { ...template };
            updateState();
            renderTemplateEditor();
        });
        
        const exportButton = document.createElement('button');
        exportButton.className = 'action-button';
        exportButton.textContent = 'Export Template';
        exportButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'exportTemplate',
                templateId: template.id
            });
        });
        
        const deleteButton = document.createElement('button');
        deleteButton.className = 'action-button danger';
        deleteButton.textContent = 'Delete Template';
        deleteButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to delete this template? This action cannot be undone.')) {
                vscode.postMessage({
                    command: 'deleteTemplate',
                    templateId: template.id
                });
                
                managerState.selectedTemplate = null;
                updateState();
                renderTemplateList();
            }
        });
        
        actionContainer.appendChild(useButton);
        actionContainer.appendChild(editButton);
        actionContainer.appendChild(exportButton);
        actionContainer.appendChild(deleteButton);
        
        // Template info
        const infoContainer = document.createElement('div');
        infoContainer.className = 'template-info-container';
        
        // Description
        const descriptionSection = document.createElement('div');
        descriptionSection.className = 'info-section';
        
        const descriptionTitle = document.createElement('h3');
        descriptionTitle.textContent = 'Description';
        
        const descriptionContent = document.createElement('div');
        descriptionContent.className = 'info-content';
        descriptionContent.textContent = template.description || 'No description available';
        
        descriptionSection.appendChild(descriptionTitle);
        descriptionSection.appendChild(descriptionContent);
        infoContainer.appendChild(descriptionSection);
        
        // Category
        const categorySection = document.createElement('div');
        categorySection.className = 'info-section';
        
        const categoryTitle = document.createElement('h3');
        categoryTitle.textContent = 'Category';
        
        const categoryContent = document.createElement('div');
        categoryContent.className = 'info-content';
        categoryContent.textContent = formatCategoryName(template.category);
        
        categorySection.appendChild(categoryTitle);
        categorySection.appendChild(categoryContent);
        infoContainer.appendChild(categorySection);
        
        // Tags
        if (template.tags && template.tags.length > 0) {
            const tagsSection = document.createElement('div');
            tagsSection.className = 'info-section';
            
            const tagsTitle = document.createElement('h3');
            tagsTitle.textContent = 'Tags';
            
            const tagsContent = document.createElement('div');
            tagsContent.className = 'tags-container';
            
            template.tags.forEach(tag => {
                const tagElement = document.createElement('span');
                tagElement.className = 'tag';
                tagElement.textContent = tag;
                tagsContent.appendChild(tagElement);
            });
            
            tagsSection.appendChild(tagsTitle);
            tagsSection.appendChild(tagsContent);
            infoContainer.appendChild(tagsSection);
        }
        
        // Preview
        const previewSection = document.createElement('div');
        previewSection.className = 'info-section preview-section';
        
        const previewTitle = document.createElement('h3');
        previewTitle.textContent = 'Template Preview';
        
        const previewContent = document.createElement('div');
        previewContent.className = 'preview-content';
        
        const previewButton = document.createElement('button');
        previewButton.className = 'preview-button';
        previewButton.textContent = 'Generate Preview';
        previewButton.addEventListener('click', () => {
            vscode.postMessage({
                command: 'generatePreview',
                templateId: template.id
            });
            
            previewButton.disabled = true;
            previewButton.textContent = 'Generating preview...';
        });
        
        previewSection.appendChild(previewTitle);
        previewSection.appendChild(previewContent);
        previewSection.appendChild(previewButton);
        infoContainer.appendChild(previewSection);
        
        // Append all elements
        detailsContainer.appendChild(backButton);
        detailsContainer.appendChild(templateHeader);
        detailsContainer.appendChild(actionContainer);
        detailsContainer.appendChild(infoContainer);
        
        mainContent.appendChild(detailsContainer);
    }
    
    /**
     * Render the template editor
     */
    function renderTemplateEditor() {
        const mainContent = document.getElementById('main-content');
        mainContent.innerHTML = '';
        
        // Create editor container
        const editorContainer = document.createElement('div');
        editorContainer.className = 'template-editor-container';
        
        // Create header with title
        const editorHeader = document.createElement('div');
        editorHeader.className = 'editor-header';
        
        const editorTitle = document.createElement('h2');
        editorTitle.textContent = managerState.newTemplate.id 
            ? 'Edit Template' 
            : 'Create New Template';
        
        const closeButton = document.createElement('button');
        closeButton.className = 'close-button';
        closeButton.textContent = '✕';
        closeButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to close the editor? Any unsaved changes will be lost.')) {
                managerState.isCreatingTemplate = false;
                updateState();
                renderUI();
            }
        });
        
        editorHeader.appendChild(editorTitle);
        editorHeader.appendChild(closeButton);
        
        // Create form
        const form = document.createElement('form');
        form.className = 'template-form';
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            saveTemplate();
        });
        
        // Template name
        const nameGroup = document.createElement('div');
        nameGroup.className = 'form-group';
        
        const nameLabel = document.createElement('label');
        nameLabel.setAttribute('for', 'template-name');
        nameLabel.textContent = 'Template Name';
        
        const nameInput = document.createElement('input');
        nameInput.type = 'text';
        nameInput.id = 'template-name';
        nameInput.value = managerState.newTemplate.name || '';
        nameInput.placeholder = 'Enter template name';
        nameInput.required = true;
        nameInput.addEventListener('input', (e) => {
            managerState.newTemplate.name = e.target.value;
            updateState();
        });
        
        nameGroup.appendChild(nameLabel);
        nameGroup.appendChild(nameInput);
        form.appendChild(nameGroup);
        
        // Template description
        const descriptionGroup = document.createElement('div');
        descriptionGroup.className = 'form-group';
        
        const descriptionLabel = document.createElement('label');
        descriptionLabel.setAttribute('for', 'template-description');
        descriptionLabel.textContent = 'Description';
        
        const descriptionInput = document.createElement('textarea');
        descriptionInput.id = 'template-description';
        descriptionInput.rows = 3;
        descriptionInput.value = managerState.newTemplate.description || '';
        descriptionInput.placeholder = 'Enter template description';
        descriptionInput.addEventListener('input', (e) => {
            managerState.newTemplate.description = e.target.value;
            updateState();
        });
        
        descriptionGroup.appendChild(descriptionLabel);
        descriptionGroup.appendChild(descriptionInput);
        form.appendChild(descriptionGroup);
        
        // Template category
        const categoryGroup = document.createElement('div');
        categoryGroup.className = 'form-group';
        
        const categoryLabel = document.createElement('label');
        categoryLabel.setAttribute('for', 'template-category');
        categoryLabel.textContent = 'Category';
        
        const categorySelect = document.createElement('select');
        categorySelect.id = 'template-category';
        categorySelect.required = true;
        
        // Add empty option
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = 'Select category';
        emptyOption.disabled = true;
        emptyOption.selected = !managerState.newTemplate.category;
        categorySelect.appendChild(emptyOption);
        
        // Add category options
        managerState.categories.forEach(category => {
            const option = document.createElement('option');
            option.value = category;
            option.textContent = formatCategoryName(category);
            option.selected = managerState.newTemplate.category === category;
            categorySelect.appendChild(option);
        });
        
        // Add "Create new category" option
        const newCategoryOption = document.createElement('option');
        newCategoryOption.value = 'new';
        newCategoryOption.textContent = '+ Create new category';
        categorySelect.appendChild(newCategoryOption);
        
        categorySelect.addEventListener('change', (e) => {
            if (e.target.value === 'new') {
                const newCategory = prompt('Enter new category name:');
                if (newCategory && newCategory.trim()) {
                    const formattedCategory = newCategory.trim().toLowerCase().replace(/\s+/g, '-');
                    
                    // Add to categories if it doesn't exist
                    if (!managerState.categories.includes(formattedCategory)) {
                        managerState.categories.push(formattedCategory);
                    }
                    
                    // Update select
                    const option = document.createElement('option');
                    option.value = formattedCategory;
                    option.textContent = formatCategoryName(formattedCategory);
                    
                    // Insert before "Create new category" option
                    categorySelect.insertBefore(option, newCategoryOption);
                    
                    // Select the new category
                    option.selected = true;
                    managerState.newTemplate.category = formattedCategory;
                } else {
                    // If canceled, revert to previous selection
                    categorySelect.value = managerState.newTemplate.category || '';
                }
            } else {
                managerState.newTemplate.category = e.target.value;
            }
            
            updateState();
        });
        
        categoryGroup.appendChild(categoryLabel);
        categoryGroup.appendChild(categorySelect);
        form.appendChild(categoryGroup);
        
        // Template type
        const typeGroup = document.createElement('div');
        typeGroup.className = 'form-group';
        
        const typeLabel = document.createElement('label');
        typeLabel.setAttribute('for', 'template-type');
        typeLabel.textContent = 'Document Type';
        
        const typeSelect = document.createElement('select');
        typeSelect.id = 'template-type';
        
        const documentTypes = [
            '',
            'Business Report',
            'Technical Specification',
            'Project Proposal',
            'User Manual',
            'Research Paper',
            'Letter',
            'Meeting Minutes',
            'General'
        ];
        
        documentTypes.forEach(type => {
            const option = document.createElement('option');
            option.value = type;
            option.textContent = type || 'Select document type';
            option.disabled = type === '';
            option.selected = managerState.newTemplate.type === type;
            typeSelect.appendChild(option);
        });
        
        typeSelect.addEventListener('change', (e) => {
            managerState.newTemplate.type = e.target.value;
            updateState();
        });
        
        typeGroup.appendChild(typeLabel);
        typeGroup.appendChild(typeSelect);
        form.appendChild(typeGroup);
        
        // Tags
        const tagsGroup = document.createElement('div');
        tagsGroup.className = 'form-group';
        
        const tagsLabel = document.createElement('label');
        tagsLabel.setAttribute('for', 'template-tags');
        tagsLabel.textContent = 'Tags';
        
        const tagsInput = document.createElement('input');
        tagsInput.type = 'text';
        tagsInput.id = 'template-tags';
        tagsInput.value = (managerState.newTemplate.tags || []).join(', ');
        tagsInput.placeholder = 'Enter tags separated by commas';
        tagsInput.addEventListener('input', (e) => {
            const tagsString = e.target.value;
            managerState.newTemplate.tags = tagsString
                .split(',')
                .map(tag => tag.trim())
                .filter(tag => tag);
            updateState();
        });
        
        tagsGroup.appendChild(tagsLabel);
        tagsGroup.appendChild(tagsInput);
        form.appendChild(tagsGroup);
        
        // Template content options
        const contentOptionsGroup = document.createElement('div');
        contentOptionsGroup.className = 'form-group';
        
        const contentOptionsLabel = document.createElement('label');
        contentOptionsLabel.textContent = 'Template Content';
        
        const contentOptions = document.createElement('div');
        contentOptions.className = 'content-options';
        
        const uploadOption = document.createElement('div');
        uploadOption.className = 'content-option';
        uploadOption.innerHTML = `
            <input type="radio" id="upload-option" name="content-option" value="upload" checked>
            <label for="upload-option">Upload Template File</label>
        `;
        
        const editorOption = document.createElement('div');
        editorOption.className = 'content-option';
        editorOption.innerHTML = `
            <input type="radio" id="editor-option" name="content-option" value="editor">
            <label for="editor-option">Use Template Editor</label>
        `;
        
        contentOptions.appendChild(uploadOption);
        contentOptions.appendChild(editorOption);
        
        contentOptionsGroup.appendChild(contentOptionsLabel);
        contentOptionsGroup.appendChild(contentOptions);
        form.appendChild(contentOptionsGroup);
        
        // Template content
        const contentGroup = document.createElement('div');
        contentGroup.className = 'form-group';
        
        const uploadContent = document.createElement('div');
        uploadContent.className = 'upload-content';
        
        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'template-file';
        fileInput.accept = '.docx,.md,.html,.json';
        fileInput.style.display = 'none';
        
        const uploadButton = document.createElement('button');
        uploadButton.type = 'button';
        uploadButton.className = 'upload-button';
        uploadButton.textContent = 'Choose Template File';
        uploadButton.addEventListener('click', () => {
            fileInput.click();
        });
        
        const fileNameDisplay = document.createElement('div');
        fileNameDisplay.className = 'file-name-display';
        fileNameDisplay.textContent = 'No file chosen';
        
        fileInput.addEventListener('change', (e) => {
            if (e.target.files.length > 0) {
                const file = e.target.files[0];
                fileNameDisplay.textContent = file.name;
                
                // Upload file to extension
                vscode.postMessage({
                    command: 'uploadTemplateFile',
                    fileName: file.name
                });
            } else {
                fileNameDisplay.textContent = 'No file chosen';
            }
        });
        
        uploadContent.appendChild(fileInput);
        uploadContent.appendChild(uploadButton);
        uploadContent.appendChild(fileNameDisplay);
        
        contentGroup.appendChild(uploadContent);
        form.appendChild(contentGroup);
        
        // Form actions
        const formActions = document.createElement('div');
        formActions.className = 'form-actions';
        
        const cancelButton = document.createElement('button');
        cancelButton.type = 'button';
        cancelButton.className = 'cancel-button';
        cancelButton.textContent = 'Cancel';
        cancelButton.addEventListener('click', () => {
            if (confirm('Are you sure you want to cancel? Any unsaved changes will be lost.')) {
                managerState.isCreatingTemplate = false;
                updateState();
                renderUI();
            }
        });
        
        const saveButton = document.createElement('button');
        saveButton.type = 'submit';
        saveButton.className = 'save-button';
        saveButton.textContent = 'Save Template';
        
        formActions.appendChild(cancelButton);
        formActions.appendChild(saveButton);
        form.appendChild(formActions);
        
        // Append all elements
        editorContainer.appendChild(editorHeader);
        editorContainer.appendChild(form);
        mainContent.appendChild(editorContainer);
    }
    
    /**
     * Render upload overlay
     */
    function renderUploadOverlay() {
        const overlay = document.createElement('div');
        overlay.className = 'upload-overlay';
        
        const uploadContent = document.createElement('div');
        uploadContent.className = 'upload-overlay-content';
        
        const spinner = document.createElement('div');
        spinner.className = 'spinner';
        
        const uploadText = document.createElement('div');
        uploadText.className = 'upload-text';
        uploadText.textContent = 'Uploading template...';
        
        uploadContent.appendChild(spinner);
        uploadContent.appendChild(uploadText);
        overlay.appendChild(uploadContent);
        
        document.body.appendChild(overlay);
    }
    
    /**
     * Save template
     */
    function saveTemplate() {
        // Validate form
        if (!managerState.newTemplate.name) {
            showError('Template name is required');
            return;
        }
        
        if (!managerState.newTemplate.category) {
            showError('Template category is required');
            return;
        }
        
        // Send save command to extension
        vscode.postMessage({
            command: 'saveTemplate',
            template: managerState.newTemplate
        });
    }
    
    /**
     * Show error message
     * @param {string} message Error message
     */
    function showError(message) {
        const errorContainer = document.getElementById('error-container');
        errorContainer.textContent = message;
        errorContainer.style.display = 'block';
        
        // Hide error after 3 seconds
        setTimeout(() => {
            errorContainer.style.display = 'none';
        }, 3000);
    }
    
    /**
     * Update the state and persist
     */
    function updateState() {
        vscode.setState(managerState);
    }
    
    /**
     * Handle messages from the extension
     */
    window.addEventListener('message', event => {
        const message = event.data;
        
        switch (message.command) {
            case 'templatesLoaded':
                managerState.templates = message.templates;
                managerState.categories = Array.from(new Set(
                    message.templates.map(template => template.category)
                ));
                updateState();
                renderUI();
                break;
                
            case 'templateSaved':
                managerState.isCreatingTemplate = false;
                managerState.selectedTemplate = message.template;
                updateState();
                renderUI();
                break;
                
            case 'templateDeleted':
                if (managerState.selectedTemplate && managerState.selectedTemplate.id === message.templateId) {
                    managerState.selectedTemplate = null;
                }
                
                // Remove from templates array
                managerState.templates = managerState.templates.filter(
                    template => template.id !== message.templateId
                );
                
                // Update categories
                managerState.categories = Array.from(new Set(
                    managerState.templates.map(template => template.category)
                ));
                
                updateState();
                renderUI();
                break;
                
            case 'templatePreviewGenerated':
                // Update preview content
                if (managerState.selectedTemplate && managerState.selectedTemplate.id === message.templateId) {
                    const previewContent = document.querySelector('.preview-content');
                    if (previewContent) {
                        previewContent.innerHTML = message.previewHtml;
                    }
                    
                    // Re-enable preview button
                    const previewButton = document.querySelector('.preview-button');
                    if (previewButton) {
                        previewButton.disabled = false;
                        previewButton.textContent = 'Generate Preview';
                    }
                }
                break;
                
            case 'fileUploaded':
                // Update upload overlay
                managerState.isUploading = false;
                
                // Remove overlay
                const overlay = document.querySelector('.upload-overlay');
                if (overlay) {
                    document.body.removeChild(overlay);
                }
                
                // If file was for template content, update template
                if (message.fileName) {
                    // Display file name
                    const fileNameDisplay = document.querySelector('.file-name-display');
                    if (fileNameDisplay) {
                        fileNameDisplay.textContent = message.fileName;
                    }
                    
                    // Update template content reference
                    if (managerState.newTemplate) {
                        managerState.newTemplate.contentFile = message.fileName;
                    }
                    
                    updateState();
                }
                break;
                
            case 'error':
                showError(message.message);
                
                // Remove upload overlay if present
                managerState.isUploading = false;
                const errorOverlay = document.querySelector('.upload-overlay');
                if (errorOverlay) {
                    document.body.removeChild(errorOverlay);
                }
                break;
        }
    });
})();
