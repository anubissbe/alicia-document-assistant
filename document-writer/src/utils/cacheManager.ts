import * as vscode from 'vscode';
import * as crypto from 'crypto';

/**
 * Cache entry with metadata
 */
export interface CacheEntry<T = any> {
    key: string;
    value: T;
    timestamp: number;
    ttl: number;
    size: number;
    accessCount: number;
    lastAccessed: number;
    tags?: string[];
}

/**
 * Cache configuration options
 */
export interface CacheConfig {
    maxSize?: number; // Maximum number of entries
    maxMemory?: number; // Maximum memory usage in bytes
    defaultTtl?: number; // Default TTL in milliseconds
    cleanupInterval?: number; // Cleanup interval in milliseconds
    enablePersistence?: boolean; // Whether to persist cache to disk
    compressionThreshold?: number; // Compress values larger than this size
}

/**
 * Cache statistics
 */
export interface CacheStats {
    hits: number;
    misses: number;
    size: number;
    memoryUsage: number;
    hitRatio: number;
    oldestEntry?: number;
    newestEntry?: number;
}

/**
 * LRU (Least Recently Used) Cache with TTL, compression, and persistence
 */
export class LRUCache<T = any> {
    private cache = new Map<string, CacheEntry<T>>();
    private config: Required<CacheConfig>;
    private stats: CacheStats = {
        hits: 0,
        misses: 0,
        size: 0,
        memoryUsage: 0,
        hitRatio: 0
    };
    private cleanupTimer?: NodeJS.Timeout;
    private context?: vscode.ExtensionContext;

    constructor(name: string, config: CacheConfig = {}, context?: vscode.ExtensionContext) {
        this.config = {
            maxSize: config.maxSize || 1000,
            maxMemory: config.maxMemory || 50 * 1024 * 1024, // 50MB
            defaultTtl: config.defaultTtl || 3600000, // 1 hour
            cleanupInterval: config.cleanupInterval || 300000, // 5 minutes
            enablePersistence: config.enablePersistence || false,
            compressionThreshold: config.compressionThreshold || 1024 // 1KB
        };
        
        this.context = context;
        
        // Start cleanup timer
        this.startCleanupTimer();
        
        // Load persisted cache if enabled
        if (this.config.enablePersistence && context) {
            this.loadFromPersistence(name);
        }
    }

    /**
     * Get a value from the cache
     */
    public get(key: string): T | undefined {
        const entry = this.cache.get(key);
        
        if (!entry) {
            this.stats.misses++;
            this.updateHitRatio();
            return undefined;
        }

        // Check if entry is expired
        if (this.isExpired(entry)) {
            this.cache.delete(key);
            this.updateStats();
            this.stats.misses++;
            this.updateHitRatio();
            return undefined;
        }

        // Update access metadata
        entry.accessCount++;
        entry.lastAccessed = Date.now();
        
        this.stats.hits++;
        this.updateHitRatio();
        
        return entry.value;
    }

    /**
     * Set a value in the cache
     */
    public set(key: string, value: T, ttl?: number, tags?: string[]): void {
        const now = Date.now();
        const entryTtl = ttl || this.config.defaultTtl;
        const size = this.calculateSize(value);
        
        const entry: CacheEntry<T> = {
            key,
            value,
            timestamp: now,
            ttl: entryTtl,
            size,
            accessCount: 1,
            lastAccessed: now,
            tags
        };

        // Remove existing entry if it exists
        if (this.cache.has(key)) {
            this.cache.delete(key);
        }

        // Check memory limits and evict if necessary
        this.ensureMemoryLimits(size);
        
        // Check size limits and evict if necessary
        this.ensureSizeLimits();

        this.cache.set(key, entry);
        this.updateStats();
    }

    /**
     * Delete a value from the cache
     */
    public delete(key: string): boolean {
        const deleted = this.cache.delete(key);
        if (deleted) {
            this.updateStats();
        }
        return deleted;
    }

    /**
     * Check if a key exists in the cache
     */
    public has(key: string): boolean {
        const entry = this.cache.get(key);
        return entry ? !this.isExpired(entry) : false;
    }

    /**
     * Clear all entries from the cache
     */
    public clear(): void {
        this.cache.clear();
        this.updateStats();
    }

    /**
     * Get cache statistics
     */
    public getStats(): CacheStats {
        return { ...this.stats };
    }

    /**
     * Get all keys in the cache
     */
    public keys(): string[] {
        const validKeys: string[] = [];
        for (const [key, entry] of this.cache.entries()) {
            if (!this.isExpired(entry)) {
                validKeys.push(key);
            }
        }
        return validKeys;
    }

    /**
     * Get entries by tag
     */
    public getByTag(tag: string): Array<{ key: string; value: T }> {
        const results: Array<{ key: string; value: T }> = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (!this.isExpired(entry) && entry.tags?.includes(tag)) {
                results.push({ key, value: entry.value });
            }
        }
        
        return results;
    }

    /**
     * Delete entries by tag
     */
    public deleteByTag(tag: string): number {
        let deletedCount = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (entry.tags?.includes(tag)) {
                this.cache.delete(key);
                deletedCount++;
            }
        }
        
        if (deletedCount > 0) {
            this.updateStats();
        }
        
        return deletedCount;
    }

    /**
     * Get or set pattern - returns cached value or sets and returns new value
     */
    public async getOrSet<R = T>(
        key: string, 
        factory: () => Promise<R> | R, 
        ttl?: number, 
        tags?: string[]
    ): Promise<R> {
        const cached = this.get(key) as R;
        if (cached !== undefined) {
            return cached;
        }

        const value = await factory();
        this.set(key, value as unknown as T, ttl, tags);
        return value;
    }

    /**
     * Batch get multiple keys
     */
    public getBatch(keys: string[]): Map<string, T> {
        const results = new Map<string, T>();
        
        for (const key of keys) {
            const value = this.get(key);
            if (value !== undefined) {
                results.set(key, value);
            }
        }
        
        return results;
    }

    /**
     * Batch set multiple key-value pairs
     */
    public setBatch(entries: Array<{ key: string; value: T; ttl?: number; tags?: string[] }>): void {
        for (const entry of entries) {
            this.set(entry.key, entry.value, entry.ttl, entry.tags);
        }
    }

    /**
     * Cleanup expired entries
     */
    public cleanup(): number {
        let removedCount = 0;
        
        for (const [key, entry] of this.cache.entries()) {
            if (this.isExpired(entry)) {
                this.cache.delete(key);
                removedCount++;
            }
        }
        
        if (removedCount > 0) {
            this.updateStats();
        }
        
        return removedCount;
    }

    /**
     * Resize cache to target size
     */
    public resize(targetSize: number): void {
        if (this.cache.size <= targetSize) {
            return;
        }

        // Sort entries by access score (combination of recency and frequency)
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                entry,
                score: this.calculateAccessScore(entry)
            }))
            .sort((a, b) => a.score - b.score); // Lower score = less valuable

        // Remove least valuable entries
        const toRemove = this.cache.size - targetSize;
        for (let i = 0; i < toRemove; i++) {
            this.cache.delete(entries[i].key);
        }

        this.updateStats();
    }

    /**
     * Export cache data for debugging or backup
     */
    public export(): Array<{ key: string; value: T; metadata: Omit<CacheEntry<T>, 'value'> }> {
        const exports: Array<{ key: string; value: T; metadata: Omit<CacheEntry<T>, 'value'> }> = [];
        
        for (const [key, entry] of this.cache.entries()) {
            if (!this.isExpired(entry)) {
                const { value, ...metadata } = entry;
                exports.push({ key, value, metadata });
            }
        }
        
        return exports;
    }

    /**
     * Dispose of the cache and cleanup resources
     */
    public dispose(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
            this.cleanupTimer = undefined;
        }
        
        if (this.config.enablePersistence && this.context) {
            this.saveToPersistence();
        }
        
        this.cache.clear();
    }

    /**
     * Check if an entry is expired
     */
    private isExpired(entry: CacheEntry<T>): boolean {
        return Date.now() > (entry.timestamp + entry.ttl);
    }

    /**
     * Calculate the size of a value in bytes
     */
    private calculateSize(value: T): number {
        try {
            const serialized = JSON.stringify(value);
            return new TextEncoder().encode(serialized).length;
        } catch {
            // If serialization fails, estimate size
            return 100; // Default estimate
        }
    }

    /**
     * Calculate access score for LRU eviction
     */
    private calculateAccessScore(entry: CacheEntry<T>): number {
        const now = Date.now();
        const age = now - entry.timestamp;
        const timeSinceAccess = now - entry.lastAccessed;
        
        // Score considers recency, frequency, and age
        // Lower score = less valuable (will be evicted first)
        return (timeSinceAccess * 0.5) + (age * 0.3) - (entry.accessCount * 1000);
    }

    /**
     * Ensure memory limits are not exceeded
     */
    private ensureMemoryLimits(newEntrySize: number): void {
        if (this.stats.memoryUsage + newEntrySize <= this.config.maxMemory) {
            return;
        }

        // Remove least valuable entries until we have enough space
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                entry,
                score: this.calculateAccessScore(entry)
            }))
            .sort((a, b) => a.score - b.score);

        let freedMemory = 0;
        for (const { key, entry } of entries) {
            this.cache.delete(key);
            freedMemory += entry.size;
            
            if (freedMemory >= newEntrySize) {
                break;
            }
        }
    }

    /**
     * Ensure size limits are not exceeded
     */
    private ensureSizeLimits(): void {
        if (this.cache.size < this.config.maxSize) {
            return;
        }

        // Remove one entry (least valuable)
        const entries = Array.from(this.cache.entries())
            .map(([key, entry]) => ({
                key,
                entry,
                score: this.calculateAccessScore(entry)
            }))
            .sort((a, b) => a.score - b.score);

        if (entries.length > 0) {
            this.cache.delete(entries[0].key);
        }
    }

    /**
     * Update cache statistics
     */
    private updateStats(): void {
        this.stats.size = this.cache.size;
        this.stats.memoryUsage = Array.from(this.cache.values())
            .reduce((total, entry) => total + entry.size, 0);
        
        if (this.cache.size > 0) {
            const timestamps = Array.from(this.cache.values()).map(e => e.timestamp);
            this.stats.oldestEntry = Math.min(...timestamps);
            this.stats.newestEntry = Math.max(...timestamps);
        } else {
            this.stats.oldestEntry = undefined;
            this.stats.newestEntry = undefined;
        }
    }

    /**
     * Update hit ratio
     */
    private updateHitRatio(): void {
        const total = this.stats.hits + this.stats.misses;
        this.stats.hitRatio = total > 0 ? this.stats.hits / total : 0;
    }

    /**
     * Start the cleanup timer
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanup();
        }, this.config.cleanupInterval);
    }

    /**
     * Load cache from persistence
     */
    private async loadFromPersistence(name: string): Promise<void> {
        if (!this.context) return;

        try {
            const data = this.context.globalState.get<string>(`cache-${name}`);
            if (!data) return;

            const entries = JSON.parse(data) as CacheEntry<T>[];
            for (const entry of entries) {
                if (!this.isExpired(entry)) {
                    this.cache.set(entry.key, entry);
                }
            }
            
            this.updateStats();
        } catch (error) {
            console.warn('Failed to load cache from persistence:', error);
        }
    }

    /**
     * Save cache to persistence
     */
    private async saveToPersistence(): Promise<void> {
        if (!this.context) return;

        try {
            const entries = Array.from(this.cache.values())
                .filter(entry => !this.isExpired(entry));
            
            const data = JSON.stringify(entries);
            await this.context.globalState.update(`cache-document-writer`, data);
        } catch (error) {
            console.warn('Failed to save cache to persistence:', error);
        }
    }
}

/**
 * Cache Manager for managing multiple caches
 */
export class CacheManager {
    private caches = new Map<string, LRUCache>();
    private context?: vscode.ExtensionContext;

    constructor(context?: vscode.ExtensionContext) {
        this.context = context;
    }

    /**
     * Get or create a cache
     */
    public getCache<T = any>(name: string, config?: CacheConfig): LRUCache<T> {
        let cache = this.caches.get(name);
        
        if (!cache) {
            cache = new LRUCache<T>(name, config, this.context);
            this.caches.set(name, cache);
        }
        
        return cache as LRUCache<T>;
    }

    /**
     * Get all cache names
     */
    public getCacheNames(): string[] {
        return Array.from(this.caches.keys());
    }

    /**
     * Get statistics for all caches
     */
    public getAllStats(): Map<string, CacheStats> {
        const stats = new Map<string, CacheStats>();
        
        for (const [name, cache] of this.caches.entries()) {
            stats.set(name, cache.getStats());
        }
        
        return stats;
    }

    /**
     * Clear all caches
     */
    public clearAll(): void {
        for (const cache of this.caches.values()) {
            cache.clear();
        }
    }

    /**
     * Cleanup all caches
     */
    public cleanupAll(): void {
        for (const cache of this.caches.values()) {
            cache.cleanup();
        }
    }

    /**
     * Dispose of all caches
     */
    public dispose(): void {
        for (const cache of this.caches.values()) {
            cache.dispose();
        }
        this.caches.clear();
    }
}

// Export singleton instance
export const cacheManager = new CacheManager();