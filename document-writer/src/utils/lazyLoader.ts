import * as vscode from 'vscode';
import { LRUCache } from './cacheManager';

/**
 * Lazy loading configuration
 */
export interface LazyLoadConfig {
    cacheTtl?: number; // Cache TTL in milliseconds
    retryAttempts?: number; // Number of retry attempts on failure
    retryDelay?: number; // Delay between retries in milliseconds
    timeout?: number; // Timeout for loading operations
    preloadThreshold?: number; // Preload when this close to viewport
    batchSize?: number; // Number of items to load in a batch
}

/**
 * Lazy loadable resource
 */
export interface LazyResource<T = any> {
    id: string;
    loader: () => Promise<T>;
    priority?: 'high' | 'medium' | 'low';
    dependencies?: string[];
    metadata?: Record<string, any>;
}

/**
 * Loading state for a resource
 */
export interface LoadingState<T = any> {
    status: 'pending' | 'loading' | 'loaded' | 'error';
    data?: T;
    error?: Error;
    loadTime?: number;
    retryCount?: number;
}

/**
 * Lazy loader with caching, batching, and dependency management
 */
export class LazyLoader {
    private cache: LRUCache<any>;
    private loadingStates = new Map<string, LoadingState>();
    private loadingPromises = new Map<string, Promise<any>>();
    private resources = new Map<string, LazyResource>();
    private config: Required<LazyLoadConfig>;
    private batchQueue: string[] = [];
    private batchTimer?: NodeJS.Timeout;

    constructor(config: LazyLoadConfig = {}) {
        this.config = {
            cacheTtl: config.cacheTtl || 3600000, // 1 hour
            retryAttempts: config.retryAttempts || 3,
            retryDelay: config.retryDelay || 1000,
            timeout: config.timeout || 30000,
            preloadThreshold: config.preloadThreshold || 200,
            batchSize: config.batchSize || 5
        };

        this.cache = new LRUCache('lazy-loader', {
            defaultTtl: this.config.cacheTtl,
            maxSize: 500
        });
    }

    /**
     * Register a lazy loadable resource
     */
    public register<T>(resource: LazyResource<T>): void {
        this.resources.set(resource.id, resource);
        this.loadingStates.set(resource.id, { status: 'pending' });
    }

    /**
     * Register multiple resources
     */
    public registerBatch<T>(resources: LazyResource<T>[]): void {
        for (const resource of resources) {
            this.register(resource);
        }
    }

    /**
     * Load a resource by ID
     */
    public async load<T>(id: string): Promise<T> {
        // Check cache first
        const cached = this.cache.get(id);
        if (cached !== undefined) {
            return cached;
        }

        // Check if already loading
        const existingPromise = this.loadingPromises.get(id);
        if (existingPromise) {
            return existingPromise;
        }

        const resource = this.resources.get(id);
        if (!resource) {
            throw new Error(`Resource ${id} not registered`);
        }

        // Load dependencies first
        if (resource.dependencies && resource.dependencies.length > 0) {
            await this.loadDependencies(resource.dependencies);
        }

        // Start loading
        const loadPromise = this.loadWithRetry(resource);
        this.loadingPromises.set(id, loadPromise);

        try {
            const result = await loadPromise;
            this.cache.set(id, result, this.config.cacheTtl);
            
            // Update loading state
            this.loadingStates.set(id, {
                status: 'loaded',
                data: result,
                loadTime: Date.now()
            });

            return result;
        } catch (error) {
            // Update error state
            this.loadingStates.set(id, {
                status: 'error',
                error: error as Error
            });
            throw error;
        } finally {
            this.loadingPromises.delete(id);
        }
    }

    /**
     * Load multiple resources in parallel
     */
    public async loadBatch<T>(ids: string[]): Promise<Map<string, T>> {
        const results = new Map<string, T>();
        const loadPromises = ids.map(async (id) => {
            try {
                const result = await this.load<T>(id);
                results.set(id, result);
            } catch (error) {
                console.error(`Failed to load resource ${id}:`, error);
            }
        });

        await Promise.allSettled(loadPromises);
        return results;
    }

    /**
     * Preload resources in background
     */
    public preload(ids: string[]): void {
        // Sort by priority
        const sortedIds = this.sortByPriority(ids);
        
        // Load high priority items immediately
        const highPriority = sortedIds.filter(id => {
            const resource = this.resources.get(id);
            return resource?.priority === 'high';
        });

        if (highPriority.length > 0) {
            this.loadBatch(highPriority).catch(error => {
                console.warn('High priority preload failed:', error);
            });
        }

        // Queue medium and low priority items for batch loading
        const otherPriority = sortedIds.filter(id => {
            const resource = this.resources.get(id);
            return resource?.priority !== 'high';
        });

        this.queueForBatchLoad(otherPriority);
    }

    /**
     * Get loading state for a resource
     */
    public getLoadingState(id: string): LoadingState | undefined {
        return this.loadingStates.get(id);
    }

    /**
     * Get loading states for multiple resources
     */
    public getLoadingStates(ids: string[]): Map<string, LoadingState> {
        const states = new Map<string, LoadingState>();
        for (const id of ids) {
            const state = this.loadingStates.get(id);
            if (state) {
                states.set(id, state);
            }
        }
        return states;
    }

    /**
     * Check if a resource is loaded
     */
    public isLoaded(id: string): boolean {
        const state = this.loadingStates.get(id);
        return state?.status === 'loaded' || this.cache.has(id);
    }

    /**
     * Check if a resource is loading
     */
    public isLoading(id: string): boolean {
        const state = this.loadingStates.get(id);
        return state?.status === 'loading';
    }

    /**
     * Invalidate cached resource
     */
    public invalidate(id: string): void {
        this.cache.delete(id);
        this.loadingStates.set(id, { status: 'pending' });
        this.loadingPromises.delete(id);
    }

    /**
     * Invalidate multiple resources
     */
    public invalidateBatch(ids: string[]): void {
        for (const id of ids) {
            this.invalidate(id);
        }
    }

    /**
     * Clear all cached resources
     */
    public clear(): void {
        this.cache.clear();
        this.loadingStates.clear();
        this.loadingPromises.clear();
        this.clearBatchQueue();
    }

    /**
     * Get cache statistics
     */
    public getCacheStats() {
        return this.cache.getStats();
    }

    /**
     * Create a lazy image loader
     */
    public createImageLoader(imageUrls: string[]): LazyImageLoader {
        return new LazyImageLoader(this, imageUrls);
    }

    /**
     * Create a lazy template loader
     */
    public createTemplateLoader(templatePaths: string[]): LazyTemplateLoader {
        return new LazyTemplateLoader(this, templatePaths);
    }

    /**
     * Dispose of the lazy loader
     */
    public dispose(): void {
        this.clearBatchQueue();
        this.cache.dispose();
        this.loadingStates.clear();
        this.loadingPromises.clear();
        this.resources.clear();
    }

    /**
     * Load resource with retry logic
     */
    private async loadWithRetry<T>(resource: LazyResource<T>): Promise<T> {
        let lastError: Error | undefined;
        const state = this.loadingStates.get(resource.id);
        
        if (state) {
            state.status = 'loading';
            state.retryCount = 0;
        }

        for (let attempt = 0; attempt <= this.config.retryAttempts; attempt++) {
            try {
                if (state) {
                    state.retryCount = attempt;
                }

                // Apply timeout
                const result = await Promise.race([
                    resource.loader(),
                    new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('Load timeout')), this.config.timeout);
                    })
                ]);

                return result;
            } catch (error) {
                lastError = error as Error;
                
                if (attempt < this.config.retryAttempts) {
                    await this.delay(this.config.retryDelay * Math.pow(2, attempt)); // Exponential backoff
                }
            }
        }

        throw lastError || new Error('Load failed');
    }

    /**
     * Load dependencies in parallel
     */
    private async loadDependencies(dependencies: string[]): Promise<void> {
        const loadPromises = dependencies.map(dep => this.load(dep));
        await Promise.all(loadPromises);
    }

    /**
     * Sort resources by priority
     */
    private sortByPriority(ids: string[]): string[] {
        const priorityOrder = { high: 0, medium: 1, low: 2 };
        
        return ids.sort((a, b) => {
            const resourceA = this.resources.get(a);
            const resourceB = this.resources.get(b);
            
            const priorityA = priorityOrder[resourceA?.priority || 'medium'];
            const priorityB = priorityOrder[resourceB?.priority || 'medium'];
            
            return priorityA - priorityB;
        });
    }

    /**
     * Queue resources for batch loading
     */
    private queueForBatchLoad(ids: string[]): void {
        this.batchQueue.push(...ids);
        
        // Clear existing timer
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
        }

        // Set timer to process batch
        this.batchTimer = setTimeout(() => {
            this.processBatchQueue();
        }, 100); // Small delay to allow batching
    }

    /**
     * Process the batch queue
     */
    private async processBatchQueue(): Promise<void> {
        if (this.batchQueue.length === 0) {
            return;
        }

        // Take a batch of items
        const batch = this.batchQueue.splice(0, this.config.batchSize);
        
        try {
            await this.loadBatch(batch);
        } catch (error) {
            console.warn('Batch load failed:', error);
        }

        // Process remaining items
        if (this.batchQueue.length > 0) {
            this.batchTimer = setTimeout(() => {
                this.processBatchQueue();
            }, 50); // Small delay between batches
        }
    }

    /**
     * Clear batch queue
     */
    private clearBatchQueue(): void {
        this.batchQueue = [];
        if (this.batchTimer) {
            clearTimeout(this.batchTimer);
            this.batchTimer = undefined;
        }
    }

    /**
     * Utility delay function
     */
    private delay(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
}

/**
 * Lazy image loader with viewport detection
 */
export class LazyImageLoader {
    private loader: LazyLoader;
    private imageUrls: string[];
    private intersectionObserver?: IntersectionObserver;
    private loadedImages = new Set<string>();

    constructor(loader: LazyLoader, imageUrls: string[]) {
        this.loader = loader;
        this.imageUrls = imageUrls;
        this.registerImages();
    }

    /**
     * Setup intersection observer for viewport detection
     */
    public setupViewportDetection(container?: Element): void {
        if (typeof IntersectionObserver === 'undefined') {
            return; // Not available in Node.js environment
        }

        this.intersectionObserver = new IntersectionObserver(
            (entries) => {
                for (const entry of entries) {
                    if (entry.isIntersecting) {
                        const imgElement = entry.target as HTMLImageElement;
                        const src = imgElement.dataset.src;
                        if (src && !this.loadedImages.has(src)) {
                            this.loadImage(src, imgElement);
                        }
                    }
                }
            },
            {
                root: container,
                rootMargin: '50px' // Load images 50px before they enter viewport
            }
        );
    }

    /**
     * Load a specific image
     */
    public async loadImage(src: string, imgElement?: HTMLImageElement): Promise<void> {
        if (this.loadedImages.has(src)) {
            return;
        }

        try {
            await this.loader.load(src);
            this.loadedImages.add(src);
            
            if (imgElement) {
                imgElement.src = src;
                imgElement.classList.add('loaded');
            }
        } catch (error) {
            console.error(`Failed to load image ${src}:`, error);
            
            if (imgElement) {
                imgElement.classList.add('error');
            }
        }
    }

    /**
     * Preload all images
     */
    public preloadAll(): void {
        this.loader.preload(this.imageUrls);
    }

    /**
     * Dispose of the image loader
     */
    public dispose(): void {
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
    }

    /**
     * Register images with the lazy loader
     */
    private registerImages(): void {
        const imageResources: LazyResource[] = this.imageUrls.map(url => ({
            id: url,
            loader: () => this.loadImageData(url),
            priority: 'low'
        }));

        this.loader.registerBatch(imageResources);
    }

    /**
     * Load image data
     */
    private async loadImageData(url: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(url);
            img.onerror = () => reject(new Error(`Failed to load image: ${url}`));
            img.src = url;
        });
    }
}

/**
 * Lazy template loader for document templates
 */
export class LazyTemplateLoader {
    private loader: LazyLoader;
    private templatePaths: string[];

    constructor(loader: LazyLoader, templatePaths: string[]) {
        this.loader = loader;
        this.templatePaths = templatePaths;
        this.registerTemplates();
    }

    /**
     * Load a template by path
     */
    public async loadTemplate(path: string): Promise<any> {
        return this.loader.load(path);
    }

    /**
     * Preload frequently used templates
     */
    public preloadFrequent(): void {
        // Prioritize common template types
        const frequentTemplates = this.templatePaths.filter(path => 
            path.includes('business') || 
            path.includes('letter') || 
            path.includes('report')
        );

        this.loader.preload(frequentTemplates);
    }

    /**
     * Get template loading states
     */
    public getTemplateStates(): Map<string, LoadingState> {
        return this.loader.getLoadingStates(this.templatePaths);
    }

    /**
     * Register templates with the lazy loader
     */
    private registerTemplates(): void {
        const templateResources: LazyResource[] = this.templatePaths.map(path => ({
            id: path,
            loader: () => this.loadTemplateData(path),
            priority: this.getTemplatePriority(path)
        }));

        this.loader.registerBatch(templateResources);
    }

    /**
     * Load template data from file system
     */
    private async loadTemplateData(path: string): Promise<any> {
        try {
            const uri = vscode.Uri.file(path);
            const data = await vscode.workspace.fs.readFile(uri);
            return JSON.parse(data.toString());
        } catch (error) {
            throw new Error(`Failed to load template ${path}: ${error}`);
        }
    }

    /**
     * Determine template priority based on file name
     */
    private getTemplatePriority(path: string): 'high' | 'medium' | 'low' {
        const filename = path.toLowerCase();
        
        if (filename.includes('business') || filename.includes('letter')) {
            return 'high';
        } else if (filename.includes('report') || filename.includes('document')) {
            return 'medium';
        } else {
            return 'low';
        }
    }
}

// Export singleton instance
export const lazyLoader = new LazyLoader();