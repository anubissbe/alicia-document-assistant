/**
 * HTML Sanitization utility to prevent XSS attacks
 */
class Sanitizer {
    constructor() {
        // Allowed HTML tags
        this.allowedTags = [
            'p', 'br', 'strong', 'em', 'u', 'i', 'b',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
            'a', 'img', 'figure', 'figcaption', 'table', 
            'thead', 'tbody', 'tr', 'th', 'td'
        ];
        
        // Allowed attributes for specific tags
        this.allowedAttributes = {
            'a': ['href', 'title', 'target'],
            'img': ['src', 'alt', 'width', 'height', 'style'],
            'code': ['class'],
            'pre': ['class'],
            'td': ['colspan', 'rowspan'],
            'th': ['colspan', 'rowspan']
        };
        
        // Allowed URL schemes
        this.allowedSchemes = ['http', 'https', 'mailto', 'data'];
    }
    
    /**
     * Escape HTML special characters
     */
    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#x27;',
            '/': '&#x2F;'
        };
        return text.replace(/[&<>"'/]/g, char => map[char]);
    }
    
    /**
     * Sanitize HTML content
     */
    sanitizeHtml(html) {
        // Create a temporary container
        const temp = document.createElement('div');
        temp.innerHTML = html;
        
        // Recursively clean nodes
        this.cleanNode(temp);
        
        return temp.innerHTML;
    }
    
    /**
     * Clean a DOM node recursively
     */
    cleanNode(node) {
        // Get all child nodes (use Array.from to avoid live collection issues)
        const children = Array.from(node.childNodes);
        
        children.forEach(child => {
            if (child.nodeType === Node.ELEMENT_NODE) {
                const tagName = child.tagName.toLowerCase();
                
                // Remove disallowed tags
                if (!this.allowedTags.includes(tagName)) {
                    // Keep the text content but remove the tag
                    const textContent = child.textContent;
                    const textNode = document.createTextNode(textContent);
                    node.replaceChild(textNode, child);
                    return;
                }
                
                // Clean attributes
                this.cleanAttributes(child, tagName);
                
                // Recursively clean child nodes
                this.cleanNode(child);
                
            } else if (child.nodeType === Node.TEXT_NODE) {
                // Text nodes are safe, no action needed
            } else {
                // Remove other types of nodes (comments, etc.)
                node.removeChild(child);
            }
        });
    }
    
    /**
     * Clean attributes of an element
     */
    cleanAttributes(element, tagName) {
        const allowedAttrs = this.allowedAttributes[tagName] || [];
        const attributes = Array.from(element.attributes);
        
        attributes.forEach(attr => {
            const attrName = attr.name.toLowerCase();
            
            // Remove disallowed attributes
            if (!allowedAttrs.includes(attrName)) {
                element.removeAttribute(attr.name);
                return;
            }
            
            // Special handling for URLs
            if (attrName === 'href' || attrName === 'src') {
                const url = attr.value.trim();
                if (!this.isValidUrl(url)) {
                    element.removeAttribute(attr.name);
                }
            }
            
            // Remove javascript: and other dangerous protocols
            if (attr.value.toLowerCase().includes('javascript:') ||
                attr.value.toLowerCase().includes('vbscript:') ||
                attr.value.toLowerCase().includes('onload=') ||
                attr.value.toLowerCase().includes('onerror=')) {
                element.removeAttribute(attr.name);
            }
        });
        
        // Special handling for target="_blank" - add security attributes
        if (tagName === 'a' && element.getAttribute('target') === '_blank') {
            element.setAttribute('rel', 'noopener noreferrer');
        }
    }
    
    /**
     * Validate URL
     */
    isValidUrl(url) {
        try {
            // Allow data URLs for images
            if (url.startsWith('data:image/')) {
                return true;
            }
            
            // Parse URL
            const parsed = new URL(url, window.location.href);
            const scheme = parsed.protocol.slice(0, -1); // Remove trailing ':'
            
            return this.allowedSchemes.includes(scheme);
        } catch {
            // Relative URLs are okay
            return !url.includes(':');
        }
    }
    
    /**
     * Sanitize text for use in HTML attributes
     */
    sanitizeAttribute(text) {
        return text.replace(/['"<>&]/g, '');
    }
}

// Create global sanitizer instance
window.sanitizer = new Sanitizer();