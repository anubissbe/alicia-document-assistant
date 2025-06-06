import * as vscode from 'vscode';
import { LRUCache } from './cacheManager';

/**
 * Webview optimization configuration
 */
export interface WebviewOptimizationConfig {
    enableVirtualScrolling?: boolean;
    virtualScrollThreshold?: number;
    enableDebouncing?: boolean;
    debounceDelay?: number;
    enableMessageBatching?: boolean;
    batchSize?: number;
    batchDelay?: number;
    enableResourcePreloading?: boolean;
    preloadThreshold?: number;
    enableMemoryManagement?: boolean;
    memoryCleanupInterval?: number;
}

/**
 * Debounced function wrapper
 */
export interface DebouncedFunction<T extends (...args: any[]) => any> {
    (...args: Parameters<T>): void;
    cancel(): void;
    flush(): void;
}

/**
 * Virtual scroll item
 */
export interface VirtualScrollItem {
    id: string;
    height: number;
    data: any;
    rendered?: boolean;
}

/**
 * Message batch for optimization
 */
export interface MessageBatch {
    messages: any[];
    timestamp: number;
}

/**
 * Webview Performance Optimizer
 */
export class WebviewOptimizer {
    private config: Required<WebviewOptimizationConfig>;
    private resourceCache: LRUCache<string>;
    private messageBatches = new Map<string, MessageBatch>();
    private batchTimers = new Map<string, NodeJS.Timeout>();
    private memoryCleanupTimer?: NodeJS.Timeout;
    private context?: vscode.ExtensionContext;

    constructor(config: WebviewOptimizationConfig = {}, context?: vscode.ExtensionContext) {
        this.config = {
            enableVirtualScrolling: config.enableVirtualScrolling ?? true,
            virtualScrollThreshold: config.virtualScrollThreshold ?? 100,
            enableDebouncing: config.enableDebouncing ?? true,
            debounceDelay: config.debounceDelay ?? 300,
            enableMessageBatching: config.enableMessageBatching ?? true,
            batchSize: config.batchSize ?? 10,
            batchDelay: config.batchDelay ?? 50,
            enableResourcePreloading: config.enableResourcePreloading ?? true,
            preloadThreshold: config.preloadThreshold ?? 5,
            enableMemoryManagement: config.enableMemoryManagement ?? true,
            memoryCleanupInterval: config.memoryCleanupInterval ?? 300000 // 5 minutes
        };

        this.context = context;
        this.resourceCache = new LRUCache('webview-resources', {
            maxSize: 200,
            defaultTtl: 1800000, // 30 minutes
            enablePersistence: false
        }, context);

        if (this.config.enableMemoryManagement) {
            this.startMemoryCleanup();
        }
    }

    /**
     * Create a debounced function
     */
    public debounce<T extends (...args: any[]) => any>(
        func: T,
        delay?: number
    ): DebouncedFunction<T> {
        if (!this.config.enableDebouncing) {
            return func as any;
        }

        const actualDelay = delay ?? this.config.debounceDelay;
        let timeoutId: NodeJS.Timeout | undefined;
        let lastArgs: Parameters<T>;

        const debounced = (...args: Parameters<T>) => {
            lastArgs = args;
            
            if (timeoutId) {
                clearTimeout(timeoutId);
            }
            
            timeoutId = setTimeout(() => {
                func.apply(null, lastArgs);
                timeoutId = undefined;
            }, actualDelay);
        };

        debounced.cancel = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
            }
        };

        debounced.flush = () => {
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = undefined;
                func.apply(null, lastArgs);
            }
        };

        return debounced as DebouncedFunction<T>;
    }

    /**
     * Create a throttled function
     */
    public throttle<T extends (...args: any[]) => any>(
        func: T,
        delay: number = 100
    ): (...args: Parameters<T>) => void {
        let lastCall = 0;
        let timeoutId: NodeJS.Timeout | undefined;

        return (...args: Parameters<T>) => {
            const now = Date.now();
            
            if (now - lastCall >= delay) {
                lastCall = now;
                func.apply(null, args);
            } else if (!timeoutId) {
                timeoutId = setTimeout(() => {
                    lastCall = Date.now();
                    func.apply(null, args);
                    timeoutId = undefined;
                }, delay - (now - lastCall));
            }
        };
    }

    /**
     * Optimize webview message sending with batching
     */
    public optimizeMessageSending(webview: vscode.Webview): {
        sendMessage: (message: any) => void;
        sendBatch: (messages: any[]) => void;
        flush: () => void;
    } {
        const webviewId = this.getWebviewId(webview);

        const sendMessage = (message: any) => {
            if (!this.config.enableMessageBatching) {
                webview.postMessage(message);
                return;
            }

            // Add to batch
            let batch = this.messageBatches.get(webviewId);
            if (!batch) {
                batch = { messages: [], timestamp: Date.now() };
                this.messageBatches.set(webviewId, batch);
            }

            batch.messages.push(message);

            // Check if batch is full or timeout reached
            if (batch.messages.length >= this.config.batchSize) {
                this.flushBatch(webview, webviewId);
            } else {
                // Set timer if not already set
                if (!this.batchTimers.has(webviewId)) {
                    const timer = setTimeout(() => {
                        this.flushBatch(webview, webviewId);
                    }, this.config.batchDelay);
                    this.batchTimers.set(webviewId, timer);
                }
            }
        };

        const sendBatch = (messages: any[]) => {
            if (messages.length === 1) {
                webview.postMessage(messages[0]);
            } else if (messages.length > 1) {
                webview.postMessage({
                    type: 'batch',
                    messages: messages
                });
            }
        };

        const flush = () => {
            this.flushBatch(webview, webviewId);
        };

        return { sendMessage, sendBatch, flush };
    }

    /**
     * Create virtual scrolling implementation
     */
    public createVirtualScroll<T>(
        items: T[],
        itemHeight: number,
        containerHeight: number,
        renderItem: (item: T, index: number) => string
    ): {
        renderVisibleItems: (scrollTop: number) => string;
        getScrollerHeight: () => number;
        getItemsInView: (scrollTop: number) => { start: number; end: number };
    } {
        if (!this.config.enableVirtualScrolling || items.length < this.config.virtualScrollThreshold) {
            // Render all items if virtual scrolling is disabled or threshold not met
            return {
                renderVisibleItems: () => items.map((item, index) => renderItem(item, index)).join(''),
                getScrollerHeight: () => items.length * itemHeight,
                getItemsInView: () => ({ start: 0, end: items.length - 1 })
            };
        }

        const getItemsInView = (scrollTop: number) => {
            const start = Math.floor(scrollTop / itemHeight);
            const visibleCount = Math.ceil(containerHeight / itemHeight);
            const end = Math.min(start + visibleCount + 2, items.length - 1); // +2 for buffer
            
            return { start: Math.max(0, start - 1), end }; // -1 for buffer
        };

        const renderVisibleItems = (scrollTop: number) => {
            const { start, end } = getItemsInView(scrollTop);
            const visibleItems: string[] = [];
            
            // Add spacer for items before visible range
            if (start > 0) {
                visibleItems.push(
                    `<div class="virtual-spacer" style="height: ${start * itemHeight}px;"></div>`
                );
            }
            
            // Render visible items
            for (let i = start; i <= end; i++) {
                if (items[i]) {
                    visibleItems.push(renderItem(items[i], i));
                }
            }
            
            // Add spacer for items after visible range
            if (end < items.length - 1) {
                const remainingHeight = (items.length - 1 - end) * itemHeight;
                visibleItems.push(
                    `<div class="virtual-spacer" style="height: ${remainingHeight}px;"></div>`
                );
            }
            
            return visibleItems.join('');
        };

        const getScrollerHeight = () => items.length * itemHeight;

        return { renderVisibleItems, getScrollerHeight, getItemsInView };
    }

    /**
     * Optimize resource loading for webviews
     */
    public optimizeResourceLoading(extensionUri: vscode.Uri): {
        getCachedResource: (path: string) => string | undefined;
        cacheResource: (path: string, content: string) => void;
        getOptimizedResourceUri: (webview: vscode.Webview, path: string) => vscode.Uri;
        preloadResources: (webview: vscode.Webview, paths: string[]) => Promise<void>;
    } {
        const getCachedResource = (path: string): string | undefined => {
            return this.resourceCache.get(path);
        };

        const cacheResource = (path: string, content: string): void => {
            this.resourceCache.set(path, content);
        };

        const getOptimizedResourceUri = (webview: vscode.Webview, path: string): vscode.Uri => {
            const resourceUri = vscode.Uri.joinPath(extensionUri, path);
            return webview.asWebviewUri(resourceUri);
        };

        const preloadResources = async (webview: vscode.Webview, paths: string[]): Promise<void> => {
            if (!this.config.enableResourcePreloading) {
                return;
            }

            const preloadPromises = paths.slice(0, this.config.preloadThreshold).map(async (path) => {
                try {
                    const uri = vscode.Uri.joinPath(extensionUri, path);
                    const content = await vscode.workspace.fs.readFile(uri);
                    this.resourceCache.set(path, content.toString());
                } catch (error) {
                    console.warn(`Failed to preload resource ${path}:`, error);
                }
            });

            await Promise.allSettled(preloadPromises);
        };

        return {
            getCachedResource,
            cacheResource,
            getOptimizedResourceUri,
            preloadResources
        };
    }

    /**
     * Create optimized HTML with performance enhancements
     */
    public createOptimizedHTML(config: {
        title: string;
        nonce: string;
        cspSource: string;
        styleUris: vscode.Uri[];
        scriptUris: vscode.Uri[];
        bodyContent: string;
        enableLazyLoading?: boolean;
        enableServiceWorker?: boolean;
    }): string {
        const lazyLoadScript = config.enableLazyLoading ? `
            <script nonce="${config.nonce}">
                // Lazy loading implementation
                const lazyImages = document.querySelectorAll('img[data-src]');
                const imageObserver = new IntersectionObserver((entries, observer) => {
                    entries.forEach(entry => {
                        if (entry.isIntersecting) {
                            const img = entry.target;
                            img.src = img.dataset.src;
                            img.classList.remove('lazy');
                            imageObserver.unobserve(img);
                        }
                    });
                });
                lazyImages.forEach(img => imageObserver.observe(img));
            </script>
        ` : '';

        const performanceScript = `
            <script nonce="${config.nonce}">
                // Performance monitoring
                window.addEventListener('load', () => {
                    if (window.performance) {
                        const perfData = performance.getEntriesByType('navigation')[0];
                        console.log('Page load time:', perfData.loadEventEnd - perfData.loadEventStart, 'ms');
                    }
                });

                // Message batching support
                let messageBatch = [];
                let batchTimer = null;
                
                window.addEventListener('message', event => {
                    const message = event.data;
                    if (message.type === 'batch') {
                        message.messages.forEach(msg => handleMessage(msg));
                    } else {
                        handleMessage(message);
                    }
                });

                function handleMessage(message) {
                    // Handle individual messages
                    switch (message.command) {
                        // Add message handlers here
                    }
                }

                // Virtual scrolling support
                function setupVirtualScrolling(container, itemHeight) {
                    let isScrolling = false;
                    
                    container.addEventListener('scroll', () => {
                        if (!isScrolling) {
                            window.requestAnimationFrame(() => {
                                updateVisibleItems(container, itemHeight);
                                isScrolling = false;
                            });
                            isScrolling = true;
                        }
                    });
                }

                function updateVisibleItems(container, itemHeight) {
                    // Virtual scrolling logic would go here
                }
            </script>
        `;

        const styleLinks = config.styleUris.map(uri => 
            `<link rel="stylesheet" href="${uri}">`
        ).join('\n    ');

        const scriptTags = config.scriptUris.map(uri => 
            `<script nonce="${config.nonce}" src="${uri}"></script>`
        ).join('\n    ');

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${config.cspSource} 'unsafe-inline'; script-src 'nonce-${config.nonce}'; img-src ${config.cspSource} data: https:; font-src ${config.cspSource};">
    <title>${config.title}</title>
    ${styleLinks}
    <style>
        /* Performance optimizations */
        * {
            box-sizing: border-box;
        }
        
        body {
            font-display: swap; /* Improve font loading */
            will-change: scroll-position; /* Optimize scrolling */
        }
        
        .lazy {
            opacity: 0;
            transition: opacity 0.3s;
        }
        
        .lazy.loaded {
            opacity: 1;
        }
        
        .virtual-spacer {
            pointer-events: none;
        }
        
        /* Reduce layout thrashing */
        .optimized-container {
            contain: layout style paint;
        }
        
        /* GPU acceleration for animations */
        .hardware-accelerated {
            transform: translateZ(0);
            backface-visibility: hidden;
        }
    </style>
</head>
<body class="optimized-container">
    ${config.bodyContent}
    
    ${lazyLoadScript}
    ${performanceScript}
    ${scriptTags}
</body>
</html>`;
    }

    /**
     * Monitor webview performance
     */
    public createPerformanceMonitor(webview: vscode.Webview): {
        startMonitoring: () => void;
        stopMonitoring: () => void;
        getMetrics: () => any;
    } {
        let isMonitoring = false;
        let metrics = {
            messagesSent: 0,
            messagesReceived: 0,
            averageResponseTime: 0,
            memoryUsage: 0,
            lastUpdate: Date.now()
        };

        const originalPostMessage = webview.postMessage.bind(webview);
        
        const startMonitoring = () => {
            if (isMonitoring) return;
            
            isMonitoring = true;
            
            // Override postMessage to track sent messages
            webview.postMessage = (message: any) => {
                metrics.messagesSent++;
                metrics.lastUpdate = Date.now();
                return originalPostMessage(message);
            };

            // Monitor memory usage periodically
            const memoryMonitor = setInterval(() => {
                if (!isMonitoring) {
                    clearInterval(memoryMonitor);
                    return;
                }

                if (process.memoryUsage) {
                    metrics.memoryUsage = process.memoryUsage().heapUsed;
                }
            }, 5000); // Every 5 seconds
        };

        const stopMonitoring = () => {
            isMonitoring = false;
            webview.postMessage = originalPostMessage;
        };

        const getMetrics = () => ({ ...metrics });

        return { startMonitoring, stopMonitoring, getMetrics };
    }

    /**
     * Dispose of the optimizer
     */
    public dispose(): void {
        // Clear all batch timers
        for (const timer of this.batchTimers.values()) {
            clearTimeout(timer);
        }
        this.batchTimers.clear();

        // Clear memory cleanup timer
        if (this.memoryCleanupTimer) {
            clearInterval(this.memoryCleanupTimer);
            this.memoryCleanupTimer = undefined;
        }

        // Dispose cache
        this.resourceCache.dispose();

        // Clear message batches
        this.messageBatches.clear();
    }

    /**
     * Flush a message batch
     */
    private flushBatch(webview: vscode.Webview, webviewId: string): void {
        const batch = this.messageBatches.get(webviewId);
        if (!batch || batch.messages.length === 0) {
            return;
        }

        // Clear timer
        const timer = this.batchTimers.get(webviewId);
        if (timer) {
            clearTimeout(timer);
            this.batchTimers.delete(webviewId);
        }

        // Send batch
        if (batch.messages.length === 1) {
            webview.postMessage(batch.messages[0]);
        } else {
            webview.postMessage({
                type: 'batch',
                messages: batch.messages
            });
        }

        // Clear batch
        this.messageBatches.delete(webviewId);
    }

    /**
     * Get a unique ID for a webview
     */
    private getWebviewId(webview: vscode.Webview): string {
        // Use webview object as key (Map handles object keys properly)
        return `webview-${Date.now()}-${Math.random()}`;
    }

    /**
     * Start memory cleanup timer
     */
    private startMemoryCleanup(): void {
        this.memoryCleanupTimer = setInterval(() => {
            // Cleanup expired cache entries
            this.resourceCache.cleanup();
            
            // Cleanup old message batches
            const now = Date.now();
            for (const [id, batch] of this.messageBatches.entries()) {
                if (now - batch.timestamp > 30000) { // 30 seconds old
                    this.messageBatches.delete(id);
                    
                    const timer = this.batchTimers.get(id);
                    if (timer) {
                        clearTimeout(timer);
                        this.batchTimers.delete(id);
                    }
                }
            }
            
            // Force garbage collection if available
            if (global.gc) {
                global.gc();
            }
        }, this.config.memoryCleanupInterval);
    }
}

// Export singleton instance
export const webviewOptimizer = new WebviewOptimizer();