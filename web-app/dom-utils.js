/**
 * DOM Utility Functions for Safe Element Access
 */

/**
 * Safely get element by ID with optional error handling
 */
function safeGetById(id, warnIfMissing = true) {
    const element = document.getElementById(id);
    if (!element && warnIfMissing && window.DEBUG_MODE) {
        console.warn(`Element with id '${id}' not found`);
    }
    return element;
}

/**
 * Safely set text content of an element
 */
function safeSetText(elementOrId, text) {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element) {
        element.textContent = text;
        return true;
    }
    return false;
}

/**
 * Safely set HTML content of an element (with sanitization)
 */
function safeSetHTML(elementOrId, html) {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element) {
        // Sanitize if sanitizer is available
        if (window.sanitizer && typeof window.sanitizer.sanitize === 'function') {
            html = window.sanitizer.sanitize(html);
        }
        element.innerHTML = html;
        return true;
    }
    return false;
}

/**
 * Safely add event listener to element
 */
function safeAddEventListener(elementOrId, event, handler, options) {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element) {
        element.addEventListener(event, handler, options);
        return true;
    }
    return false;
}

/**
 * Safely set style property
 */
function safeSetStyle(elementOrId, property, value) {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element && element.style) {
        element.style[property] = value;
        return true;
    }
    return false;
}

/**
 * Safely add or remove CSS class
 */
function safeToggleClass(elementOrId, className, add = true) {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element) {
        if (add) {
            element.classList.add(className);
        } else {
            element.classList.remove(className);
        }
        return true;
    }
    return false;
}

/**
 * Safely get input value
 */
function safeGetValue(elementOrId, defaultValue = '') {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element && 'value' in element) {
        return element.value;
    }
    return defaultValue;
}

/**
 * Safely set input value
 */
function safeSetValue(elementOrId, value) {
    const element = typeof elementOrId === 'string' 
        ? safeGetById(elementOrId) 
        : elementOrId;
    
    if (element && 'value' in element) {
        element.value = value;
        return true;
    }
    return false;
}

/**
 * Safely query selector
 */
function safeQuerySelector(selector, parent = document) {
    try {
        return parent.querySelector(selector);
    } catch (error) {
        if (window.DEBUG_MODE) {
            console.error(`Invalid selector: ${selector}`, error);
        }
        return null;
    }
}

/**
 * Safely query all selectors
 */
function safeQuerySelectorAll(selector, parent = document) {
    try {
        return Array.from(parent.querySelectorAll(selector));
    } catch (error) {
        if (window.DEBUG_MODE) {
            console.error(`Invalid selector: ${selector}`, error);
        }
        return [];
    }
}

// Export as global utilities
window.DOM = {
    getById: safeGetById,
    setText: safeSetText,
    setHTML: safeSetHTML,
    addEventListener: safeAddEventListener,
    setStyle: safeSetStyle,
    toggleClass: safeToggleClass,
    getValue: safeGetValue,
    setValue: safeSetValue,
    querySelector: safeQuerySelector,
    querySelectorAll: safeQuerySelectorAll
};