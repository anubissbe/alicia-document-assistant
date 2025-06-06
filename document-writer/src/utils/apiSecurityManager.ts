import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { inputValidator } from './inputValidator';

/**
 * API Request configuration
 */
export interface ApiRequestConfig {
    url: string;
    method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    headers?: Record<string, string>;
    body?: any;
    timeout?: number;
    retries?: number;
    validateResponse?: boolean;
}

/**
 * API Response wrapper
 */
export interface ApiResponse<T = any> {
    data: T;
    status: number;
    headers: Record<string, string>;
    success: boolean;
    error?: string;
}

/**
 * Rate limiting configuration
 */
export interface RateLimitConfig {
    maxRequests: number;
    windowMs: number;
    identifier: string;
}

/**
 * API Security Manager for secure external API communications
 */
export class ApiSecurityManager {
    private rateLimitStore: Map<string, { count: number; resetTime: number }> = new Map();
    private blockedUrls: Set<string> = new Set();
    private allowedDomains: Set<string> = new Set([
        'api.openai.com',
        'api.anthropic.com',
        'api.github.com',
        'httpbin.org' // For testing
    ]);

    constructor() {
        this.initializeSecuritySettings();
    }

    /**
     * Initialize security settings
     */
    private initializeSecuritySettings(): void {
        // Add common malicious domains to blocklist
        this.blockedUrls.add('malware.com');
        this.blockedUrls.add('phishing.com');
        // In a real implementation, this would be loaded from a threat intelligence feed
    }

    /**
     * Validates API URL for security
     */
    public validateApiUrl(url: string): { valid: boolean; error?: string } {
        try {
            const parsedUrl = new URL(url);

            // Check protocol
            if (parsedUrl.protocol !== 'https:') {
                return { valid: false, error: 'Only HTTPS URLs are allowed' };
            }

            // Check if domain is blocked
            if (this.blockedUrls.has(parsedUrl.hostname)) {
                return { valid: false, error: 'URL is on security blocklist' };
            }

            // Check if domain is allowed
            if (!this.allowedDomains.has(parsedUrl.hostname)) {
                return { valid: false, error: 'Domain is not in the allowlist' };
            }

            // Check for suspicious patterns
            if (this.hasSuspiciousPatterns(url)) {
                return { valid: false, error: 'URL contains suspicious patterns' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: 'Invalid URL format' };
        }
    }

    /**
     * Checks for suspicious patterns in URLs
     */
    private hasSuspiciousPatterns(url: string): boolean {
        const suspiciousPatterns = [
            /javascript:/i,
            /data:/i,
            /file:/i,
            /\.\.\//, // Path traversal
            /%2e%2e/, // Encoded path traversal
            /%00/, // Null byte
            /script/i, // Script injection attempt
            /on\w+=/i // Event handlers
        ];

        return suspiciousPatterns.some(pattern => pattern.test(url));
    }

    /**
     * Sanitizes API request data
     */
    public sanitizeRequestData(data: any): any {
        if (typeof data === 'string') {
            return this.sanitizeString(data);
        }

        if (Array.isArray(data)) {
            return data.map(item => this.sanitizeRequestData(item));
        }

        if (typeof data === 'object' && data !== null) {
            const sanitized: any = {};
            for (const [key, value] of Object.entries(data)) {
                // Sanitize key names
                const sanitizedKey = this.sanitizeString(key);
                sanitized[sanitizedKey] = this.sanitizeRequestData(value);
            }
            return sanitized;
        }

        return data;
    }

    /**
     * Sanitizes string data
     */
    private sanitizeString(str: string): string {
        return str
            .replace(/[\x00-\x1F\x7F]/g, '') // Remove control characters
            .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+\s*=/gi, ''); // Remove event handlers
    }

    /**
     * Validates API response for security
     */
    public validateApiResponse(response: any): { valid: boolean; error?: string } {
        if (!response) {
            return { valid: false, error: 'Empty response' };
        }

        // Check response size (prevent DoS)
        const responseStr = JSON.stringify(response);
        if (responseStr.length > 10 * 1024 * 1024) { // 10MB limit
            return { valid: false, error: 'Response too large' };
        }

        // Check for potentially malicious content
        if (this.containsMaliciousContent(responseStr)) {
            return { valid: false, error: 'Response contains potentially malicious content' };
        }

        return { valid: true };
    }

    /**
     * Checks if content contains malicious patterns
     */
    private containsMaliciousContent(content: string): boolean {
        const maliciousPatterns = [
            /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            /javascript:/gi,
            /on\w+\s*=/gi,
            /eval\s*\(/gi,
            /function\s*\(/gi,
            /document\.(write|cookie)/gi
        ];

        return maliciousPatterns.some(pattern => pattern.test(content));
    }

    /**
     * Applies rate limiting
     */
    public checkRateLimit(config: RateLimitConfig): { allowed: boolean; resetTime?: number } {
        const now = Date.now();
        const key = config.identifier;
        const existing = this.rateLimitStore.get(key);

        if (!existing || now >= existing.resetTime) {
            // Reset window
            this.rateLimitStore.set(key, {
                count: 1,
                resetTime: now + config.windowMs
            });
            return { allowed: true };
        }

        if (existing.count >= config.maxRequests) {
            return { 
                allowed: false, 
                resetTime: existing.resetTime 
            };
        }

        // Increment count
        existing.count++;
        this.rateLimitStore.set(key, existing);
        return { allowed: true };
    }

    /**
     * Generates secure headers for API requests
     */
    public generateSecureHeaders(apiKey?: string): Record<string, string> {
        const headers: Record<string, string> = {
            'User-Agent': 'VSCode-DocumentWriter/1.0',
            'Accept': 'application/json',
            'Content-Type': 'application/json',
            'X-Requested-With': 'VSCode-Extension',
            'Cache-Control': 'no-cache, no-store, must-revalidate',
            'Pragma': 'no-cache',
            'X-Content-Type-Options': 'nosniff',
            'X-Frame-Options': 'DENY',
            'X-XSS-Protection': '1; mode=block'
        };

        if (apiKey) {
            // Use Authorization header for API key
            headers['Authorization'] = `Bearer ${apiKey}`;
        }

        // Add request ID for tracking
        headers['X-Request-ID'] = crypto.randomBytes(16).toString('hex');

        return headers;
    }

    /**
     * Makes a secure API request
     */
    public async makeSecureRequest<T = any>(config: ApiRequestConfig): Promise<ApiResponse<T>> {
        try {
            // Validate URL
            const urlValidation = this.validateApiUrl(config.url);
            if (!urlValidation.valid) {
                throw new Error(urlValidation.error);
            }

            // Apply rate limiting
            const rateLimitResult = this.checkRateLimit({
                maxRequests: 100,
                windowMs: 60000, // 1 minute
                identifier: new URL(config.url).hostname
            });

            if (!rateLimitResult.allowed) {
                throw new Error(`Rate limit exceeded. Try again in ${Math.ceil((rateLimitResult.resetTime! - Date.now()) / 1000)} seconds`);
            }

            // Sanitize request body
            const sanitizedBody = config.body ? this.sanitizeRequestData(config.body) : undefined;

            // Prepare request options
            const requestOptions: any = {
                method: config.method,
                headers: {
                    ...this.generateSecureHeaders(),
                    ...config.headers
                },
                body: sanitizedBody ? JSON.stringify(sanitizedBody) : undefined
            };

            // Set timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.timeout || 30000);
            requestOptions.signal = controller.signal;

            // Make request with retries
            const maxRetries = config.retries || 3;
            let lastError: Error | null = null;

            for (let attempt = 0; attempt < maxRetries; attempt++) {
                try {
                    const response = await fetch(config.url, requestOptions);
                    clearTimeout(timeoutId);

                    // Parse response
                    const responseText = await response.text();
                    let responseData: any;

                    try {
                        responseData = JSON.parse(responseText);
                    } catch {
                        responseData = responseText;
                    }

                    // Validate response if requested
                    if (config.validateResponse) {
                        const validation = this.validateApiResponse(responseData);
                        if (!validation.valid) {
                            throw new Error(validation.error);
                        }
                    }

                    // Extract headers
                    const responseHeaders: Record<string, string> = {};
                    response.headers.forEach((value, key) => {
                        responseHeaders[key] = value;
                    });

                    return {
                        data: responseData,
                        status: response.status,
                        headers: responseHeaders,
                        success: response.ok,
                        error: response.ok ? undefined : `HTTP ${response.status}: ${response.statusText}`
                    };

                } catch (error) {
                    lastError = error as Error;
                    
                    // Don't retry on certain errors
                    if (error instanceof TypeError && error.name === 'AbortError') {
                        throw new Error('Request timeout');
                    }

                    // Wait before retry (exponential backoff)
                    if (attempt < maxRetries - 1) {
                        await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
                    }
                }
            }

            throw lastError || new Error('Request failed after retries');

        } catch (error) {
            return {
                data: null,
                status: 0,
                headers: {},
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Validates and processes webhook data
     */
    public validateWebhookData(data: any, expectedSignature?: string, secret?: string): { valid: boolean; error?: string } {
        try {
            // Validate signature if provided
            if (expectedSignature && secret) {
                const computedSignature = crypto
                    .createHmac('sha256', secret)
                    .update(JSON.stringify(data))
                    .digest('hex');

                if (computedSignature !== expectedSignature) {
                    return { valid: false, error: 'Invalid webhook signature' };
                }
            }

            // Validate webhook data structure
            if (!data || typeof data !== 'object') {
                return { valid: false, error: 'Invalid webhook data format' };
            }

            // Check for required webhook fields
            if (!data.timestamp || !data.event) {
                return { valid: false, error: 'Missing required webhook fields' };
            }

            // Validate timestamp (prevent replay attacks)
            const timestamp = new Date(data.timestamp).getTime();
            const now = Date.now();
            const maxAge = 5 * 60 * 1000; // 5 minutes

            if (Math.abs(now - timestamp) > maxAge) {
                return { valid: false, error: 'Webhook timestamp too old or too far in future' };
            }

            return { valid: true };

        } catch (error) {
            return { 
                valid: false, 
                error: error instanceof Error ? error.message : 'Webhook validation failed' 
            };
        }
    }

    /**
     * Adds a domain to the allowlist
     */
    public addAllowedDomain(domain: string): void {
        this.allowedDomains.add(domain);
    }

    /**
     * Removes a domain from the allowlist
     */
    public removeAllowedDomain(domain: string): void {
        this.allowedDomains.delete(domain);
    }

    /**
     * Adds a URL to the blocklist
     */
    public addBlockedUrl(url: string): void {
        this.blockedUrls.add(url);
    }

    /**
     * Removes a URL from the blocklist
     */
    public removeBlockedUrl(url: string): void {
        this.blockedUrls.delete(url);
    }

    /**
     * Cleans up rate limit data (should be called periodically)
     */
    public cleanupRateLimitData(): void {
        const now = Date.now();
        for (const [key, data] of this.rateLimitStore.entries()) {
            if (now >= data.resetTime) {
                this.rateLimitStore.delete(key);
            }
        }
    }
}

// Export singleton instance
export const apiSecurityManager = new ApiSecurityManager();