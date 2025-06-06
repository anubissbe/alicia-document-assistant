import { JSDOM } from 'jsdom';

/**
 * HTML Sanitization utility to prevent XSS attacks in VS Code extension
 */
export class HtmlSanitizer {
    private allowedTags: string[];
    private allowedAttributes: Record<string, string[]>;
    private allowedSchemes: string[];

    constructor() {
        // Allowed HTML tags
        this.allowedTags = [
            'p', 'br', 'strong', 'em', 'u', 'i', 'b',
            'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
            'ul', 'ol', 'li', 'blockquote', 'code', 'pre',
            'a', 'img', 'figure', 'figcaption', 'table', 
            'thead', 'tbody', 'tr', 'th', 'td', 'div', 'span'
        ];
        
        // Allowed attributes for specific tags
        this.allowedAttributes = {
            'a': ['href', 'title', 'target', 'rel'],
            'img': ['src', 'alt', 'width', 'height', 'style'],
            'code': ['class'],
            'pre': ['class'],
            'td': ['colspan', 'rowspan'],
            'th': ['colspan', 'rowspan'],
            'div': ['class', 'style'],
            'span': ['class', 'style']
        };
        
        // Allowed URL schemes
        this.allowedSchemes = ['http', 'https', 'mailto', 'data', 'vscode-resource', 'vscode-webview-resource'];
    }

    /**
     * Escape HTML special characters
     */
    public escapeHtml(text: string): string {
        const map: Record<string, string> = {
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
     * Sanitize HTML content using JSDOM for server-side processing
     */
    public sanitizeHtml(html: string): string {
        try {
            // Create JSDOM instance
            const dom = new JSDOM(html);
            const document = dom.window.document;
            
            // Create a temporary container
            const temp = document.createElement('div');
            temp.innerHTML = html;
            
            // Recursively clean nodes
            this.cleanNode(temp, document);
            
            return temp.innerHTML;
        } catch (error) {
            console.error('HTML sanitization error:', error);
            // Fallback to simple escaping
            return this.escapeHtml(html);
        }
    }

    /**
     * Clean a DOM node recursively
     */
    private cleanNode(node: any, document: any): void {
        // Get all child nodes (use Array.from to avoid live collection issues)
        const children = Array.from(node.childNodes);
        
        children.forEach((child: any) => {
            if (child.nodeType === 1) { // ELEMENT_NODE
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
                this.cleanNode(child, document);
                
            } else if (child.nodeType === 3) { // TEXT_NODE
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
    private cleanAttributes(element: any, tagName: string): void {
        const allowedAttrs = this.allowedAttributes[tagName] || [];
        const attributes = Array.from(element.attributes);
        
        attributes.forEach((attr: any) => {
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
                attr.value.toLowerCase().includes('onerror=') ||
                attr.value.toLowerCase().includes('onmouseover=') ||
                attr.value.toLowerCase().includes('onclick=')) {
                element.removeAttribute(attr.name);
            }
            
            // Sanitize style attributes
            if (attrName === 'style') {
                element.setAttribute('style', this.sanitizeStyleAttribute(attr.value));
            }
        });
        
        // Special handling for target="_blank" - add security attributes
        if (tagName === 'a' && element.getAttribute('target') === '_blank') {
            element.setAttribute('rel', 'noopener noreferrer');
        }
    }

    /**
     * Sanitize CSS style attribute
     */
    private sanitizeStyleAttribute(style: string): string {
        // Remove potentially dangerous CSS
        const dangerous = [
            'expression',
            'javascript:',
            'vbscript:',
            'mocha:',
            'livescript:',
            'import',
            '@import',
            'behavior',
            'binding'
        ];
        
        let sanitized = style;
        dangerous.forEach(pattern => {
            const regex = new RegExp(pattern, 'gi');
            sanitized = sanitized.replace(regex, '');
        });
        
        return sanitized;
    }

    /**
     * Validate URL
     */
    private isValidUrl(url: string): boolean {
        try {
            // Allow data URLs for images
            if (url.startsWith('data:image/')) {
                return true;
            }
            
            // Allow VS Code specific resources
            if (url.startsWith('vscode-resource:') || url.startsWith('vscode-webview-resource:')) {
                return true;
            }
            
            // Parse URL
            const parsed = new URL(url);
            const scheme = parsed.protocol.slice(0, -1); // Remove trailing ':'
            
            return this.allowedSchemes.includes(scheme);
        } catch {
            // Relative URLs are okay if they don't contain dangerous patterns
            return !url.includes(':') && !url.includes('javascript') && !url.includes('vbscript');
        }
    }

    /**
     * Sanitize text for use in HTML attributes
     */
    public sanitizeAttribute(text: string): string {
        return text.replace(/['"<>&]/g, '');
    }

    /**
     * Sanitize user input for document content
     */
    public sanitizeUserInput(input: string): string {
        // First escape basic HTML
        let sanitized = this.escapeHtml(input);
        
        // Allow basic markdown formatting
        sanitized = sanitized
            .replace(/&lt;strong&gt;(.*?)&lt;\/strong&gt;/g, '<strong>$1</strong>')
            .replace(/&lt;em&gt;(.*?)&lt;\/em&gt;/g, '<em>$1</em>')
            .replace(/&lt;code&gt;(.*?)&lt;\/code&gt;/g, '<code>$1</code>');
        
        return sanitized;
    }

    /**
     * Validate and sanitize template data
     */
    public sanitizeTemplateData(data: any): any {
        if (typeof data === 'string') {
            return this.sanitizeUserInput(data);
        }
        
        if (typeof data === 'object' && data !== null) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(data)) {
                const sanitizedKey = this.sanitizeAttribute(key);
                sanitized[sanitizedKey] = this.sanitizeTemplateData(value);
            }
            return sanitized;
        }
        
        return data;
    }

    /**
     * Create Content Security Policy for webviews
     */
    public generateCSP(nonce?: string): string {
        const nonceStr = nonce ? ` 'nonce-${nonce}'` : '';
        
        return [
            "default-src 'none'",
            `script-src 'unsafe-inline'${nonceStr}`,
            `style-src 'unsafe-inline'${nonceStr}`,
            "img-src data: https: vscode-resource: vscode-webview-resource:",
            "font-src data: https: vscode-resource: vscode-webview-resource:",
            "connect-src https:",
            "media-src data: https:",
            "object-src 'none'",
            "base-uri 'none'",
            "form-action 'none'"
        ].join('; ');
    }
}

// Export singleton instance
export const htmlSanitizer = new HtmlSanitizer();