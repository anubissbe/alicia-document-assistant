import * as vscode from 'vscode';

/**
 * Memory monitoring configuration
 */
export interface MemoryConfig {
    heapWarningThreshold?: number; // Warning threshold as percentage of max heap
    heapCriticalThreshold?: number; // Critical threshold as percentage of max heap
    monitoringInterval?: number; // Monitoring interval in milliseconds
    enableAutoCleanup?: boolean; // Enable automatic cleanup
    cleanupStrategies?: CleanupStrategy[];
    enableGCHints?: boolean; // Enable garbage collection hints
}

/**
 * Cleanup strategy
 */
export interface CleanupStrategy {
    name: string;
    priority: number; // Higher priority runs first
    condition: (stats: MemoryStats) => boolean;
    action: () => Promise<void> | void;
}

/**
 * Memory statistics
 */
export interface MemoryStats {
    heapUsed: number;
    heapTotal: number;
    heapLimit: number;
    external: number;
    rss: number; // Resident Set Size
    heapUsedPercentage: number;
    heapTotalPercentage: number;
    freeMemory: number;
    totalMemory: number;
    timestamp: number;
}

/**
 * Memory warning levels
 */
export enum MemoryWarningLevel {
    Normal = 'normal',
    Warning = 'warning',
    Critical = 'critical'
}

/**
 * Memory event data
 */
export interface MemoryEvent {
    level: MemoryWarningLevel;
    stats: MemoryStats;
    message: string;
    timestamp: number;
}

/**
 * Object pool for reusing objects
 */
export class ObjectPool<T> {
    private available: T[] = [];
    private inUse = new Set<T>();
    private factory: () => T;
    private reset: (obj: T) => void;
    private maxSize: number;

    constructor(factory: () => T, reset: (obj: T) => void, maxSize: number = 100) {
        this.factory = factory;
        this.reset = reset;
        this.maxSize = maxSize;
    }

    /**
     * Get an object from the pool
     */
    public acquire(): T {
        let obj = this.available.pop();
        
        if (!obj) {
            obj = this.factory();
        }
        
        this.inUse.add(obj);
        return obj;
    }

    /**
     * Return an object to the pool
     */
    public release(obj: T): void {
        if (!this.inUse.has(obj)) {
            return; // Not from this pool
        }

        this.inUse.delete(obj);
        
        if (this.available.length < this.maxSize) {
            this.reset(obj);
            this.available.push(obj);
        }
    }

    /**
     * Clear the pool
     */
    public clear(): void {
        this.available = [];
        this.inUse.clear();
    }

    /**
     * Get pool statistics
     */
    public getStats(): { available: number; inUse: number; total: number } {
        return {
            available: this.available.length,
            inUse: this.inUse.size,
            total: this.available.length + this.inUse.size
        };
    }
}

/**
 * Weak reference cache that doesn't prevent garbage collection
 */
export class WeakCache<K, V extends object> {
    private cache = new Map<K, WeakRef<V>>();
    private registry = new FinalizationRegistry<K>((key) => {
        this.cache.delete(key);
    });

    /**
     * Set a value in the cache
     */
    public set(key: K, value: V): void {
        const weakRef = new WeakRef(value);
        this.cache.set(key, weakRef);
        this.registry.register(value, key);
    }

    /**
     * Get a value from the cache
     */
    public get(key: K): V | undefined {
        const weakRef = this.cache.get(key);
        if (!weakRef) {
            return undefined;
        }

        const value = weakRef.deref();
        if (!value) {
            // Object was garbage collected
            this.cache.delete(key);
            return undefined;
        }

        return value;
    }

    /**
     * Check if key exists
     */
    public has(key: K): boolean {
        return this.get(key) !== undefined;
    }

    /**
     * Delete a key
     */
    public delete(key: K): boolean {
        return this.cache.delete(key);
    }

    /**
     * Clear the cache
     */
    public clear(): void {
        this.cache.clear();
    }

    /**
     * Get cache size (approximate)
     */
    public size(): number {
        return this.cache.size;
    }
}

/**
 * Memory Manager for monitoring and optimizing memory usage
 */
export class MemoryManager {
    private config: Required<MemoryConfig>;
    private monitoringTimer?: NodeJS.Timeout;
    private memoryHistory: MemoryStats[] = [];
    private outputChannel: vscode.OutputChannel;
    private eventEmitter = new vscode.EventEmitter<MemoryEvent>();
    private objectPools = new Map<string, ObjectPool<any>>();
    private weakCaches = new Map<string, WeakCache<any, any>>();
    private cleanupStrategies: CleanupStrategy[] = [];
    
    public readonly onMemoryEvent = this.eventEmitter.event;

    constructor(config: MemoryConfig = {}) {
        this.config = {
            heapWarningThreshold: config.heapWarningThreshold ?? 70,
            heapCriticalThreshold: config.heapCriticalThreshold ?? 85,
            monitoringInterval: config.monitoringInterval ?? 30000, // 30 seconds
            enableAutoCleanup: config.enableAutoCleanup ?? true,
            cleanupStrategies: config.cleanupStrategies ?? [],
            enableGCHints: config.enableGCHints ?? true
        };

        this.outputChannel = vscode.window.createOutputChannel('Document Writer Memory');
        
        this.cleanupStrategies = [
            ...this.getDefaultCleanupStrategies(),
            ...this.config.cleanupStrategies
        ];

        if (this.config.enableAutoCleanup) {
            this.startMonitoring();
        }
    }

    /**
     * Start memory monitoring
     */
    public startMonitoring(): void {
        if (this.monitoringTimer) {
            return; // Already monitoring
        }

        this.monitoringTimer = setInterval(() => {
            this.checkMemoryUsage();
        }, this.config.monitoringInterval);

        this.outputChannel.appendLine('Memory monitoring started');
    }

    /**
     * Stop memory monitoring
     */
    public stopMonitoring(): void {
        if (this.monitoringTimer) {
            clearInterval(this.monitoringTimer);
            this.monitoringTimer = undefined;
            this.outputChannel.appendLine('Memory monitoring stopped');
        }
    }

    /**
     * Get current memory statistics
     */
    public getMemoryStats(): MemoryStats {
        const usage = process.memoryUsage();
        const memoryInfo = process.memoryUsage();
        
        // Get system memory info (approximate)
        const totalMemory = 8 * 1024 * 1024 * 1024; // Default to 8GB if can't detect
        const freeMemory = totalMemory - usage.rss;

        return {
            heapUsed: usage.heapUsed,
            heapTotal: usage.heapTotal,
            heapLimit: totalMemory, // Approximate
            external: usage.external,
            rss: usage.rss,
            heapUsedPercentage: (usage.heapUsed / usage.heapTotal) * 100,
            heapTotalPercentage: (usage.heapTotal / totalMemory) * 100,
            freeMemory,
            totalMemory,
            timestamp: Date.now()
        };
    }

    /**
     * Get memory history
     */
    public getMemoryHistory(): MemoryStats[] {
        return [...this.memoryHistory];
    }

    /**
     * Force garbage collection (if available)
     */
    public forceGC(): boolean {
        if (global.gc) {
            this.outputChannel.appendLine('Forcing garbage collection');
            global.gc();
            return true;
        } else {
            this.outputChannel.appendLine('Garbage collection not available (run with --expose-gc)');
            return false;
        }
    }

    /**
     * Create an object pool for reusing objects
     */
    public createObjectPool<T>(
        name: string,
        factory: () => T,
        reset: (obj: T) => void,
        maxSize: number = 100
    ): ObjectPool<T> {
        const pool = new ObjectPool(factory, reset, maxSize);
        this.objectPools.set(name, pool);
        return pool;
    }

    /**
     * Get an existing object pool
     */
    public getObjectPool<T>(name: string): ObjectPool<T> | undefined {
        return this.objectPools.get(name);
    }

    /**
     * Create a weak cache
     */
    public createWeakCache<K, V extends object>(name: string): WeakCache<K, V> {
        const cache = new WeakCache<K, V>();
        this.weakCaches.set(name, cache);
        return cache;
    }

    /**
     * Get an existing weak cache
     */
    public getWeakCache<K, V extends object>(name: string): WeakCache<K, V> | undefined {
        return this.weakCaches.get(name);
    }

    /**
     * Register a custom cleanup strategy
     */
    public registerCleanupStrategy(strategy: CleanupStrategy): void {
        this.cleanupStrategies.push(strategy);
        this.cleanupStrategies.sort((a, b) => b.priority - a.priority);
    }

    /**
     * Run cleanup strategies manually
     */
    public async runCleanup(forceAll: boolean = false): Promise<void> {
        const stats = this.getMemoryStats();
        
        this.outputChannel.appendLine(`Running cleanup strategies (force: ${forceAll})`);
        
        for (const strategy of this.cleanupStrategies) {
            if (forceAll || strategy.condition(stats)) {
                try {
                    this.outputChannel.appendLine(`Executing cleanup strategy: ${strategy.name}`);
                    await strategy.action();
                } catch (error) {
                    this.outputChannel.appendLine(`Cleanup strategy ${strategy.name} failed: ${error}`);
                }
            }
        }
        
        // Suggest GC after cleanup
        if (this.config.enableGCHints) {
            this.forceGC();
        }
    }

    /**
     * Monitor a function's memory usage
     */
    public async monitorFunction<T>(
        name: string,
        fn: () => Promise<T> | T
    ): Promise<{ result: T; memoryDelta: number; duration: number }> {
        const beforeStats = this.getMemoryStats();
        const startTime = process.hrtime.bigint();
        
        this.outputChannel.appendLine(`Starting memory monitoring for: ${name}`);
        
        try {
            const result = await fn();
            const endTime = process.hrtime.bigint();
            const afterStats = this.getMemoryStats();
            
            const duration = Number(endTime - startTime) / 1_000_000; // Convert to milliseconds
            const memoryDelta = afterStats.heapUsed - beforeStats.heapUsed;
            
            this.outputChannel.appendLine(
                `Function ${name} completed: ` +
                `Duration: ${duration.toFixed(2)}ms, ` +
                `Memory delta: ${this.formatBytes(memoryDelta)}`
            );
            
            return { result, memoryDelta, duration };
        } catch (error) {
            this.outputChannel.appendLine(`Function ${name} failed: ${error}`);
            throw error;
        }
    }

    /**
     * Create a memory-aware cache decorator
     */
    public createMemoryAwareCache<K, V>(
        maxSize: number,
        shouldEvict?: (stats: MemoryStats) => boolean
    ): Map<K, V> & { cleanup(): void } {
        const cache = new Map<K, V>();
        const originalSet = cache.set.bind(cache);
        
        const enhancedCache = cache as Map<K, V> & { cleanup(): void };
        
        enhancedCache.set = (key: K, value: V) => {
            // Check memory before adding
            const stats = this.getMemoryStats();
            
            if (shouldEvict && shouldEvict(stats)) {
                enhancedCache.cleanup();
            }
            
            // Enforce size limit
            if (cache.size >= maxSize) {
                const firstKey = cache.keys().next().value;
                if (firstKey !== undefined) {
                    cache.delete(firstKey);
                }
            }
            
            return originalSet(key, value);
        };
        
        enhancedCache.cleanup = () => {
            const stats = this.getMemoryStats();
            const targetSize = Math.floor(cache.size * 0.7); // Remove 30%
            
            let removed = 0;
            for (const key of cache.keys()) {
                if (cache.size <= targetSize) break;
                cache.delete(key);
                removed++;
            }
            
            this.outputChannel.appendLine(`Cache cleanup: removed ${removed} entries`);
        };
        
        return enhancedCache;
    }

    /**
     * Get memory usage summary
     */
    public getMemorySummary(): string {
        const stats = this.getMemoryStats();
        const poolStats = Array.from(this.objectPools.entries()).map(([name, pool]) => ({
            name,
            ...pool.getStats()
        }));
        
        const cacheStats = Array.from(this.weakCaches.entries()).map(([name, cache]) => ({
            name,
            size: cache.size()
        }));

        return `
Memory Summary:
  Heap Used: ${this.formatBytes(stats.heapUsed)} (${stats.heapUsedPercentage.toFixed(1)}%)
  Heap Total: ${this.formatBytes(stats.heapTotal)}
  RSS: ${this.formatBytes(stats.rss)}
  External: ${this.formatBytes(stats.external)}
  
Object Pools:
${poolStats.map(p => `  ${p.name}: ${p.inUse} in use, ${p.available} available`).join('\n')}

Weak Caches:
${cacheStats.map(c => `  ${c.name}: ${c.size} entries`).join('\n')}
        `.trim();
    }

    /**
     * Dispose of the memory manager
     */
    public dispose(): void {
        this.stopMonitoring();
        
        // Clear all pools
        for (const pool of this.objectPools.values()) {
            pool.clear();
        }
        this.objectPools.clear();
        
        // Clear all caches
        for (const cache of this.weakCaches.values()) {
            cache.clear();
        }
        this.weakCaches.clear();
        
        this.eventEmitter.dispose();
        this.outputChannel.dispose();
    }

    /**
     * Check memory usage and trigger events/cleanup
     */
    private checkMemoryUsage(): void {
        const stats = this.getMemoryStats();
        
        // Add to history
        this.memoryHistory.push(stats);
        if (this.memoryHistory.length > 100) {
            this.memoryHistory.shift(); // Keep last 100 entries
        }

        // Determine warning level
        let level = MemoryWarningLevel.Normal;
        let message = 'Memory usage normal';

        if (stats.heapUsedPercentage >= this.config.heapCriticalThreshold) {
            level = MemoryWarningLevel.Critical;
            message = `Critical memory usage: ${stats.heapUsedPercentage.toFixed(1)}%`;
            
            // Run cleanup immediately
            this.runCleanup().catch(error => {
                this.outputChannel.appendLine(`Cleanup failed: ${error}`);
            });
            
        } else if (stats.heapUsedPercentage >= this.config.heapWarningThreshold) {
            level = MemoryWarningLevel.Warning;
            message = `High memory usage: ${stats.heapUsedPercentage.toFixed(1)}%`;
        }

        // Fire event
        const event: MemoryEvent = {
            level,
            stats,
            message,
            timestamp: Date.now()
        };
        
        this.eventEmitter.fire(event);

        // Log to output channel
        if (level !== MemoryWarningLevel.Normal) {
            this.outputChannel.appendLine(`[${new Date().toISOString()}] ${message}`);
            this.outputChannel.appendLine(`  Heap: ${this.formatBytes(stats.heapUsed)}/${this.formatBytes(stats.heapTotal)}`);
        }
    }

    /**
     * Get default cleanup strategies
     */
    private getDefaultCleanupStrategies(): CleanupStrategy[] {
        return [
            {
                name: 'Clear object pools',
                priority: 100,
                condition: (stats) => stats.heapUsedPercentage > this.config.heapWarningThreshold,
                action: () => {
                    for (const pool of this.objectPools.values()) {
                        pool.clear();
                    }
                }
            },
            {
                name: 'Force garbage collection',
                priority: 90,
                condition: (stats) => stats.heapUsedPercentage > this.config.heapCriticalThreshold,
                action: () => {
                    this.forceGC();
                }
            },
            {
                name: 'Clear weak caches',
                priority: 80,
                condition: (stats) => stats.heapUsedPercentage > this.config.heapWarningThreshold,
                action: () => {
                    for (const cache of this.weakCaches.values()) {
                        cache.clear();
                    }
                }
            }
        ];
    }

    /**
     * Format bytes to human readable string
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
        
        return (bytes / Math.pow(k, i)).toFixed(2) + ' ' + sizes[i];
    }
}

// Export singleton instance
export const memoryManager = new MemoryManager();