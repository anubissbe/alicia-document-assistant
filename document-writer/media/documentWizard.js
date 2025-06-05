// @ts-check

(function() {
    /**
     * Current wizard state
     * @type {Object}
     */
    let currentState = {};
    
    /**
     * Reference to the VS Code API
     * @type {Object}
     */
    let vscode;
    
    /**
     * Initialize the wizard webview
     * @param {Object} vsCodeApi - VS Code API reference
     * @param {Object} initialState - Initial wizard state
     */
    window.initializeWizard = function(vsCodeApi, initialState) {
        console.log('Initializing Document Creation Wizard', initialState);
        
        // Store the VS Code API reference
        vscode = vsCodeApi;
        currentState = initialState || {};
        
        // Set up event delegation for dynamic content
        setupEventDelegation();
        
        // Update UI based on initial state
        updateUI();
        
        // Log DOM state for debugging
        console.log('DOM ready, document type cards found:', 
            document.querySelectorAll('.document-type-card').length);
        console.log('Template cards found:', 
            document.querySelectorAll('.template-card').length);
        
        // Notify extension that webview is ready
        vscode.postMessage({
            command: 'ready'
        });
    };
    
    /**
     * Set up event delegation for all wizard interactions
     */
    function setupEventDelegation() {
        document.addEventListener('click', handleClick);
        document.addEventListener('change', handleChange);
        document.addEventListener('input', handleInput);
    }
    
    /**
     * Handle all click events through delegation
     * @param {Event} event - Click event
     */
    function handleClick(event) {
        console.log('Click detected on:', event.target);
        
        const target = event.target;
        const action = target.getAttribute('data-action');
        const documentType = target.getAttribute('data-type');
        const templateId = target.getAttribute('data-template-id');
        
        console.log('Target attributes:', {
            action: action,
            documentType: documentType,
            templateId: templateId,
            classList: target.classList.toString()
        });
        
        // Handle data-action attributes
        if (action) {
            console.log('Handling action:', action);
            event.preventDefault();
            handleAction(action, target);
            return;
        }
        
        // Handle document type selection
        if (documentType) {
            console.log('Handling document type selection:', documentType);
            event.preventDefault();
            selectDocumentType(documentType, target);
            return;
        }
        
        // Handle template selection
        if (templateId) {
            console.log('Handling template selection:', templateId);
            event.preventDefault();
            selectTemplate(templateId, target);
            return;
        }
        
        // Handle clickable cards/items
        const card = target.closest('.document-type-card, .template-card');
        if (card) {
            console.log('Found card:', card);
            const type = card.getAttribute('data-type');
            const cardTemplateId = card.getAttribute('data-template-id');
            
            console.log('Card attributes:', {
                type: type,
                templateId: cardTemplateId
            });
            
            if (type) {
                event.preventDefault();
                selectDocumentType(type, card);
            } else if (cardTemplateId) {
                event.preventDefault();
                selectTemplate(cardTemplateId, card);
            }
        } else {
            console.log('No card found for click target');
        }
    }
    
    /**
     * Handle action button clicks
     * @param {string} action - Action to perform
     * @param {Element} target - Target element
     */
    function handleAction(action, target) {
        console.log('Handling action:', action);
        
        switch (action) {
            case 'nextStep':
                nextStep();
                break;
            case 'prevStep':
                previousStep();
                break;
            case 'addSection':
                addSection();
                break;
            case 'editSection':
                editSection(target);
                break;
            case 'removeSection':
                removeSection(target);
                break;
            case 'createDocument':
                createDocument();
                break;
            case 'validateStep':
                validateCurrentStep();
                break;
            case 'skipTemplate':
                skipTemplate();
                break;
            default:
                console.warn('Unknown action:', action);
        }
    }
    
    /**
     * Select document type
     * @param {string} type - Document type
     * @param {Element} target - Target element
     */
    function selectDocumentType(type, target) {
        console.log('Selecting document type:', type);
        
        // Update visual selection
        document.querySelectorAll('.document-type-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        if (target) {
            target.classList.add('selected');
        }
        
        // Update state and notify extension
        currentState.documentType = type;
        vscode.postMessage({
            command: 'setDocumentType',
            documentType: type
        });
        
        // Enable next button if available
        const nextButton = document.querySelector('[data-action="nextStep"]');
        if (nextButton) {
            nextButton.disabled = false;
        }
    }
    
    /**
     * Select template
     * @param {string} templateId - Template ID
     * @param {Element} target - Target element
     */
    function selectTemplate(templateId, target) {
        console.log('Selecting template:', templateId);
        
        // Update visual selection
        document.querySelectorAll('.template-card').forEach(card => {
            card.classList.remove('selected');
        });
        
        if (target) {
            target.classList.add('selected');
        }
        
        // Update state and notify extension
        currentState.templateId = templateId;
        vscode.postMessage({
            command: 'selectTemplate',
            templateId: templateId
        });
        
        // Enable next button if available
        const nextButton = document.querySelector('[data-action="nextStep"]');
        if (nextButton) {
            nextButton.disabled = false;
        }
    }
    
    /**
     * Go to next step
     */
    function nextStep() {
        console.log('Next step');
        vscode.postMessage({
            command: 'nextStep'
        });
    }
    
    /**
     * Go to previous step
     */
    function previousStep() {
        console.log('Previous step');
        vscode.postMessage({
            command: 'prevStep'
        });
    }
    
    /**
     * Add a new section
     */
    function addSection() {
        console.log('Adding section');
        vscode.postMessage({
            command: 'addSection'
        });
    }
    
    /**
     * Edit a section
     * @param {Element} target - Target element
     */
    function editSection(target) {
        const sectionId = target.getAttribute('data-section-id');
        console.log('Editing section:', sectionId);
        vscode.postMessage({
            command: 'editSection',
            sectionId: sectionId
        });
    }
    
    /**
     * Remove a section
     * @param {Element} target - Target element
     */
    function removeSection(target) {
        const sectionId = target.getAttribute('data-section-id');
        console.log('Removing section:', sectionId);
        vscode.postMessage({
            command: 'removeSection',
            sectionId: sectionId
        });
    }
    
    /**
     * Create the document
     */
    function createDocument() {
        console.log('Creating document');
        
        // Collect all form data
        const formData = collectFormData();
        
        vscode.postMessage({
            command: 'createDocument',
            formData: formData
        });
    }
    
    /**
     * Validate current step
     */
    function validateCurrentStep() {
        vscode.postMessage({
            command: 'validateStep'
        });
    }
    
    /**
     * Skip template selection
     */
    function skipTemplate() {
        console.log('Skipping template selection');
        vscode.postMessage({
            command: 'skipTemplate'
        });
    }
    
    /**
     * Handle form field changes
     * @param {Event} event - Change event
     */
    function handleChange(event) {
        const target = event.target;
        updateFormField(target.name, target.value);
    }
    
    /**
     * Handle form field input
     * @param {Event} event - Input event
     */
    function handleInput(event) {
        const target = event.target;
        updateFormField(target.name, target.value);
    }
    
    /**
     * Update form field and notify extension
     * @param {string} fieldName - Field name
     * @param {string} value - Field value
     */
    function updateFormField(fieldName, value) {
        if (!fieldName) return;
        
        console.log('Updating field:', fieldName, value);
        
        // Update local state
        if (!currentState.documentData) {
            currentState.documentData = {};
        }
        currentState.documentData[fieldName] = value;
        
        // Notify extension
        vscode.postMessage({
            command: 'updateDocumentDetails',
            fieldName: fieldName,
            value: value
        });
    }
    
    /**
     * Collect all form data
     * @returns {Object} Form data object
     */
    function collectFormData() {
        const formData = {};
        
        // Collect all input fields
        document.querySelectorAll('input, textarea, select').forEach(element => {
            if (element.name) {
                formData[element.name] = element.value;
            }
        });
        
        return formData;
    }
    
    /**
     * Update UI based on current state
     */
    function updateUI() {
        // Update document type selection
        if (currentState.documentType) {
            const typeCard = document.querySelector(`[data-type="${currentState.documentType}"]`);
            if (typeCard) {
                typeCard.classList.add('selected');
            }
        }
        
        // Update template selection
        if (currentState.templateId) {
            const templateCard = document.querySelector(`[data-template-id="${currentState.templateId}"]`);
            if (templateCard) {
                templateCard.classList.add('selected');
            }
        }
        
        // Update form fields
        if (currentState.documentData) {
            Object.keys(currentState.documentData).forEach(fieldName => {
                const field = document.querySelector(`[name="${fieldName}"]`);
                if (field) {
                    field.value = currentState.documentData[fieldName];
                }
            });
        }
    }
    
    /**
     * Handle messages from the extension
     */
    window.addEventListener('message', event => {
        const message = event.data;
        console.log('Received message:', message);
        
        switch (message.command) {
            case 'updateState':
                currentState = message.state || {};
                updateUI();
                break;
            case 'showError':
                showError(message.message);
                break;
            case 'showLoading':
                showLoading(message.message);
                break;
            case 'documentCreated':
                showSuccess('Document created successfully!');
                break;
            default:
                console.log('Unknown message command:', message.command);
        }
    });
    
    /**
     * Show error message
     * @param {string} message - Error message
     */
    function showError(message) {
        // Create or update error display
        let errorDiv = document.getElementById('error-message');
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.id = 'error-message';
            errorDiv.className = 'error-message';
            document.body.insertBefore(errorDiv, document.body.firstChild);
        }
        
        errorDiv.textContent = message;
        errorDiv.style.display = 'block';
        
        // Hide after 5 seconds
        setTimeout(() => {
            errorDiv.style.display = 'none';
        }, 5000);
    }
    
    /**
     * Show loading message
     * @param {string} message - Loading message
     */
    function showLoading(message) {
        // Implementation for loading indicator
        console.log('Loading:', message);
    }
    
    /**
     * Show success message
     * @param {string} message - Success message
     */
    function showSuccess(message) {
        // Create or update success display
        let successDiv = document.getElementById('success-message');
        if (!successDiv) {
            successDiv = document.createElement('div');
            successDiv.id = 'success-message';
            successDiv.className = 'success-message';
            document.body.insertBefore(successDiv, document.body.firstChild);
        }
        
        successDiv.textContent = message;
        successDiv.style.display = 'block';
        
        // Hide after 3 seconds
        setTimeout(() => {
            successDiv.style.display = 'none';
        }, 3000);
    }
    
})();