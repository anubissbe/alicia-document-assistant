// @ts-check

(function() {
    /**
     * Current form data
     * @type {Object}
     */
    const formData = {};
    
    /**
     * Reference to the VS Code API
     * @type {Object}
     */
    const vscode = acquireVsCodeApi();
    
    // Initialize the webview
    document.addEventListener('DOMContentLoaded', () => {
        console.log('Document Wizard webview initialized');
        
        // Request initial data from the extension
        vscode.postMessage({
            command: 'getInitialData'
        });
        
        // Set up form field event listeners
        setupFormFieldListeners();
        
        // Set up button event listeners
        setupButtonListeners();
        
        // Set up file browser button listeners
        setupFileBrowserListeners();
    });
    
    /**
     * Set up event listeners for form fields
     */
    function setupFormFieldListeners() {
        const form = document.getElementById('wizard-form');
        if (!form) {
            console.error('Form element not found');
            return;
        }
        
        // Handle text and textarea inputs
        const textInputs = form.querySelectorAll('input[type="text"], textarea');
        textInputs.forEach(input => {
            input.addEventListener('input', (event) => {
                updateField(event.target.name, event.target.value);
            });
        });
        
        // Handle select inputs
        const selectInputs = form.querySelectorAll('select');
        selectInputs.forEach(select => {
            select.addEventListener('change', (event) => {
                updateField(event.target.name, event.target.value);
            });
        });
        
        // Handle radio inputs
        const radioInputs = form.querySelectorAll('input[type="radio"]');
        radioInputs.forEach(radio => {
            radio.addEventListener('change', (event) => {
                if (event.target.checked) {
                    updateField(event.target.name, event.target.value);
                }
            });
        });
        
        // Handle checkbox inputs
        const checkboxGroups = {};
        const checkboxInputs = form.querySelectorAll('input[type="checkbox"]');
        
        checkboxInputs.forEach(checkbox => {
            const name = checkbox.name;
            
            if (!checkboxGroups[name]) {
                checkboxGroups[name] = [];
            }
            
            checkboxGroups[name].push(checkbox);
            
            checkbox.addEventListener('change', () => {
                const selectedValues = Array.from(checkboxGroups[name])
                    .filter(cb => cb.checked)
                    .map(cb => cb.value);
                
                updateField(name, selectedValues);
            });
        });
    }
    
    /**
     * Set up event listeners for buttons
     */
    function setupButtonListeners() {
        // Next button
        const nextButton = document.getElementById('next-button');
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                validateAndProceed('next');
            });
        }
        
        // Previous button
        const prevButton = document.getElementById('prev-button');
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                // No validation needed to go back
                vscode.postMessage({
                    command: 'previousStep'
                });
            });
        }
        
        // Finish button
        const finishButton = document.getElementById('finish-button');
        if (finishButton) {
            finishButton.addEventListener('click', () => {
                validateAndProceed('finish');
            });
        }
    }
    
    /**
     * Set up event listeners for file browser buttons
     */
    function setupFileBrowserListeners() {
        const browseButtons = document.querySelectorAll('.browse-button');
        
        browseButtons.forEach(button => {
            button.addEventListener('click', (event) => {
                const id = button.id.replace('browse-', '');
                
                vscode.postMessage({
                    command: 'browseFile',
                    field: id
                });
            });
        });
    }
    
    /**
     * Update a field in the form data and notify the extension
     * @param {string} field - The field name
     * @param {any} value - The field value
     */
    function updateField(field, value) {
        formData[field] = value;
        
        vscode.postMessage({
            command: 'updateField',
            field,
            value
        });
    }
    
    /**
     * Validate the current step and proceed if valid
     * @param {string} action - 'next' or 'finish'
     */
    function validateAndProceed(action) {
        // Request validation from the extension
        vscode.postMessage({
            command: 'validateStep'
        });
        
        // The response will be handled in the message listener
        // The extension will validate and send back a message
        // with the validation result
    }
    
    /**
     * Show an error message
     * @param {string} message - The error message
     */
    function showError(message) {
        // Remove any existing error message
        removeError();
        
        // Create a new error message
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.textContent = message;
        
        // Insert it at the top of the form
        const form = document.getElementById('wizard-form');
        if (form) {
            form.insertBefore(errorElement, form.firstChild);
        }
    }
    
    /**
     * Remove any displayed error message
     */
    function removeError() {
        const errorElement = document.querySelector('.error-message');
        if (errorElement) {
            errorElement.remove();
        }
    }
    
    // Handle messages from the extension
    window.addEventListener('message', (event) => {
        const message = event.data;
        
        switch (message.command) {
            case 'initialData':
                // Update form with initial data
                Object.assign(formData, message.data);
                console.log('Received initial data:', formData);
                break;
                
            case 'validationResult':
                if (message.isValid) {
                    // Clear any error message
                    removeError();
                    
                    // Proceed to the next step or finish
                    if (document.getElementById('next-button')) {
                        vscode.postMessage({
                            command: 'nextStep'
                        });
                    } else if (document.getElementById('finish-button')) {
                        vscode.postMessage({
                            command: 'createDocument'
                        });
                    }
                } else {
                    // Show error message
                    showError(message.error);
                }
                break;
                
            case 'updateOptions':
                // Update options for a select or checkbox field
                const field = message.field;
                const options = message.options;
                
                if (field && options) {
                    // Handle select elements
                    const selectElement = document.getElementById(field);
                    if (selectElement && selectElement.tagName === 'SELECT') {
                        // Clear existing options except the first one
                        while (selectElement.options.length > 1) {
                            selectElement.remove(1);
                        }
                        
                        // Add new options
                        options.forEach(option => {
                            const optionElement = document.createElement('option');
                            optionElement.value = option.value;
                            optionElement.textContent = option.label;
                            selectElement.appendChild(optionElement);
                        });
                    }
                    
                    // Handle checkbox groups
                    const checkboxContainer = document.querySelector(`[name="${field}"]`).closest('.form-group');
                    if (checkboxContainer) {
                        // Get the label element
                        const labelElement = checkboxContainer.querySelector('label');
                        
                        // Clear existing checkboxes
                        const checkboxOptions = checkboxContainer.querySelectorAll('.checkbox-option');
                        checkboxOptions.forEach(option => option.remove());
                        
                        // Add new checkboxes
                        options.forEach(option => {
                            const div = document.createElement('div');
                            div.className = 'checkbox-option';
                            
                            const input = document.createElement('input');
                            input.type = 'checkbox';
                            input.id = `${field}-${option.value}`;
                            input.name = field;
                            input.value = option.value;
                            
                            // Check if this value is in the formData
                            if (formData[field] && Array.isArray(formData[field]) && 
                                formData[field].includes(option.value)) {
                                input.checked = true;
                            }
                            
                            const label = document.createElement('label');
                            label.htmlFor = input.id;
                            label.textContent = option.label;
                            
                            div.appendChild(input);
                            div.appendChild(label);
                            
                            // Add after the main label
                            if (labelElement && labelElement.nextSibling) {
                                checkboxContainer.insertBefore(div, labelElement.nextSibling);
                            } else {
                                checkboxContainer.appendChild(div);
                            }
                            
                            // Add event listener
                            input.addEventListener('change', () => {
                                const selectedValues = Array.from(
                                    checkboxContainer.querySelectorAll(`input[name="${field}"]:checked`)
                                ).map(cb => cb.value);
                                
                                updateField(field, selectedValues);
                            });
                        });
                    }
                }
                break;
                
            case 'fileSelected':
                // Update file input field with selected path
                const fileField = document.getElementById(message.field);
                if (fileField) {
                    fileField.value = message.path;
                }
                break;
        }
    });
})();
