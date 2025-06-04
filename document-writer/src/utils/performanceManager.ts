import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

/**
 * Interface for performance measurement options
 */
export interface PerformanceMeasurementOptions {
    /**
     * Name of the operation being measured
     */
    operationName: string;
    
    /**
     * Optional tags to categorize the measurement
     */
    tags?: string[];
    
    /**
     * Whether to log the measurement to the output channel
     */
    logToOutput?: boolean;
    
    /**
     * Whether to store the measurement in history
     */
    storeInHistory?: boolean;
}

/**
 * Interface for a performance measurement result
 */
export interface PerformanceMeasurement {
    /**
     * Name of the operation that was measured
     */
    operationName: string;
    
    /**
     * Duration of the operation in milliseconds
     */
    durationMs: number;
    
    /**
     * Memory usage before the operation in bytes
     */
    memoryBefore: number;
    
    /**
     * Memory usage after the operation in bytes
     */
    memoryAfter: number;
    
    /**
     * Memory usage difference (after - before) in bytes
     */
    memoryDelta: number;
    
    /**
     * Optional tags associated with this measurement
     */
    tags: string[];
    
    /**
     * Timestamp when the measurement was taken
     */
    timestamp: Date;
}

/**
 * Interface for performance benchmark options
 */
export interface BenchmarkOptions {
    /**
     * Number of iterations to run
     */
    iterations: number;
    
    /**
     * Whether to warm up the function before measuring
     */
    warmup?: boolean;
    
    /**
     * Number of warmup iterations
     */
    warmupIterations?: number;
    
    /**
     * Whether to log each iteration
     */
    logEachIteration?: boolean;
}

/**
 * Interface for benchmark result statistics
 */
export interface BenchmarkStatistics {
    /**
     * Name of the benchmark
     */
    name: string;
    
    /**
     * Number of iterations performed
     */
    iterations: number;
    
    /**
     * Average duration in milliseconds
     */
    averageDurationMs: number;
    
    /**
     * Minimum duration in milliseconds
     */
    minDurationMs: number;
    
    /**
     * Maximum duration in milliseconds
     */
    maxDurationMs: number;
    
    /**
     * Standard deviation of duration
     */
    stdDevDurationMs: number;
    
    /**
     * Average memory usage delta in bytes
     */
    averageMemoryDeltaBytes: number;
    
    /**
     * Individual measurement results
     */
    measurements: PerformanceMeasurement[];
}

/**
 * Interface for cache statistics
 */
export interface CacheStatistics {
    /**
     * Name of the cache
     */
    cacheName: string;
    
    /**
     * Number of hits
     */
    hits: number;
    
    /**
     * Number of misses
     */
    misses: number;
    
    /**
     * Hit ratio (hits / (hits + misses))
     */
    hitRatio: number;
    
    /**
     * Current size of the cache (number of entries)
     */
    size: number;
    
    /**
     * Total time saved by cache hits in milliseconds
     */
    timeSavedMs: number;
}

/**
 * Manages performance measurement, benchmarking, and optimization for the Document Writer extension
 */
export class PerformanceManager {
    private outputChannel: vscode.OutputChannel;
    private measurementHistory: PerformanceMeasurement[] = [];
    private cacheStatistics: Map<string, CacheStatistics> = new Map();
    private readonly MAX_HISTORY_SIZE = 1000;
    private context: vscode.ExtensionContext;
    
    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Document Writer Performance');
    }
    
    /**
     * Measures the performance of a function execution
     * @param fn The function to measure
     * @param options Measurement options
     * @returns The result of the function and the performance measurement
     */
    public async measure<T>(fn: () => Promise<T> | T, options: PerformanceMeasurementOptions): Promise<{result: T, measurement: PerformanceMeasurement}> {
        // Record starting memory usage
        const memoryBefore = process.memoryUsage().heapUsed;
        
        // Record start time
        const startTime = process.hrtime.bigint();
        
        // Execute the function
        const result = await fn();
        
        // Record end time
        const endTime = process.hrtime.bigint();
        
        // Calculate duration in milliseconds
        const durationNs = Number(endTime - startTime);
        const durationMs = durationNs / 1_000_000;
        
        // Record ending memory usage
        const memoryAfter = process.memoryUsage().heapUsed;
        
        // Create measurement result
        const measurement: PerformanceMeasurement = {
            operationName: options.operationName,
            durationMs: durationMs,
            memoryBefore: memoryBefore,
            memoryAfter: memoryAfter,
            memoryDelta: memoryAfter - memoryBefore,
            tags: options.tags || [],
            timestamp: new Date()
        };
        
        // Log to output if requested
        if (options.logToOutput) {
            this.logMeasurement(measurement);
        }
        
        // Store in history if requested
        if (options.storeInHistory) {
            this.addToHistory(measurement);
        }
        
        return { result, measurement };
    }
    
    /**
     * Synchronous version of measure for functions that don't return promises
     * @param fn The function to measure
     * @param options Measurement options
     * @returns The result of the function and the performance measurement
     */
    public measureSync<T>(fn: () => T, options: PerformanceMeasurementOptions): {result: T, measurement: PerformanceMeasurement} {
        // Record starting memory usage
        const memoryBefore = process.memoryUsage().heapUsed;
        
        // Record start time
        const startTime = process.hrtime.bigint();
        
        // Execute the function
        const result = fn();
        
        // Record end time
        const endTime = process.hrtime.bigint();
        
        // Calculate duration in milliseconds
        const durationNs = Number(endTime - startTime);
        const durationMs = durationNs / 1_000_000;
        
        // Record ending memory usage
        const memoryAfter = process.memoryUsage().heapUsed;
        
        // Create measurement result
        const measurement: PerformanceMeasurement = {
            operationName: options.operationName,
            durationMs: durationMs,
            memoryBefore: memoryBefore,
            memoryAfter: memoryAfter,
            memoryDelta: memoryAfter - memoryBefore,
            tags: options.tags || [],
            timestamp: new Date()
        };
        
        // Log to output if requested
        if (options.logToOutput) {
            this.logMeasurement(measurement);
        }
        
        // Store in history if requested
        if (options.storeInHistory) {
            this.addToHistory(measurement);
        }
        
        return { result, measurement };
    }
    
    /**
     * Runs a benchmark for a function with multiple iterations
     * @param name Name of the benchmark
     * @param fn Function to benchmark
     * @param options Benchmark options
     * @returns Benchmark statistics
     */
    public async benchmark<T>(name: string, fn: () => Promise<T> | T, options: BenchmarkOptions): Promise<BenchmarkStatistics> {
        this.outputChannel.appendLine(`\n🔍 Starting benchmark: ${name}`);
        this.outputChannel.appendLine(`Iterations: ${options.iterations}`);
        
        // Perform warmup if requested
        if (options.warmup) {
            const warmupIterations = options.warmupIterations || 3;
            this.outputChannel.appendLine(`Warming up with ${warmupIterations} iterations...`);
            
            for (let i = 0; i < warmupIterations; i++) {
                await fn();
            }
        }
        
        const measurements: PerformanceMeasurement[] = [];
        
        // Run benchmark iterations
        for (let i = 0; i < options.iterations; i++) {
            const { measurement } = await this.measure(fn, {
                operationName: `${name} (iteration ${i + 1})`,
                storeInHistory: false
            });
            
            measurements.push(measurement);
            
            if (options.logEachIteration) {
                this.outputChannel.appendLine(`Iteration ${i + 1}: ${measurement.durationMs.toFixed(2)} ms, Memory delta: ${this.formatBytes(measurement.memoryDelta)}`);
            }
        }
        
        // Calculate statistics
        const durations = measurements.map(m => m.durationMs);
        const memoryDeltas = measurements.map(m => m.memoryDelta);
        
        const minDuration = Math.min(...durations);
        const maxDuration = Math.max(...durations);
        const avgDuration = durations.reduce((sum, val) => sum + val, 0) / durations.length;
        const stdDevDuration = Math.sqrt(
            durations.reduce((sum, val) => sum + Math.pow(val - avgDuration, 2), 0) / durations.length
        );
        const avgMemoryDelta = memoryDeltas.reduce((sum, val) => sum + val, 0) / memoryDeltas.length;
        
        // Create result
        const result: BenchmarkStatistics = {
            name,
            iterations: options.iterations,
            averageDurationMs: avgDuration,
            minDurationMs: minDuration,
            maxDurationMs: maxDuration,
            stdDevDurationMs: stdDevDuration,
            averageMemoryDeltaBytes: avgMemoryDelta,
            measurements
        };
        
        // Log results
        this.outputChannel.appendLine(`\n📊 Benchmark results for: ${name}`);
        this.outputChannel.appendLine(`Average duration: ${avgDuration.toFixed(2)} ms`);
        this.outputChannel.appendLine(`Min duration: ${minDuration.toFixed(2)} ms`);
        this.outputChannel.appendLine(`Max duration: ${maxDuration.toFixed(2)} ms`);
        this.outputChannel.appendLine(`Standard deviation: ${stdDevDuration.toFixed(2)} ms`);
        this.outputChannel.appendLine(`Average memory delta: ${this.formatBytes(avgMemoryDelta)}`);
        
        return result;
    }
    
    /**
     * Profiles memory usage over time while executing a function
     * @param name Name of the profiling session
     * @param fn Function to profile
     * @param sampleIntervalMs Interval between memory samples in milliseconds
     * @returns Memory usage samples over time
     */
    public async profileMemory<T>(
        name: string, 
        fn: () => Promise<T> | T, 
        sampleIntervalMs: number = 100
    ): Promise<{result: T, samples: {timestamp: number, heapUsed: number, heapTotal: number}[]}> {
        const samples: {timestamp: number, heapUsed: number, heapTotal: number}[] = [];
        let sampling = true;
        
        // Start sampling
        const startTime = Date.now();
        const sampleInterval = setInterval(() => {
            if (!sampling) return;
            
            const mem = process.memoryUsage();
            samples.push({
                timestamp: Date.now() - startTime,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal
            });
        }, sampleIntervalMs);
        
        try {
            // Run the function
            const result = await fn();
            
            // Stop sampling
            sampling = false;
            clearInterval(sampleInterval);
            
            // Take one final sample
            const mem = process.memoryUsage();
            samples.push({
                timestamp: Date.now() - startTime,
                heapUsed: mem.heapUsed,
                heapTotal: mem.heapTotal
            });
            
            // Log results
            this.outputChannel.appendLine(`\n📈 Memory profile for: ${name}`);
            this.outputChannel.appendLine(`Duration: ${samples[samples.length - 1].timestamp} ms`);
            this.outputChannel.appendLine(`Peak heap used: ${this.formatBytes(Math.max(...samples.map(s => s.heapUsed)))}`);
            this.outputChannel.appendLine(`Initial heap used: ${this.formatBytes(samples[0].heapUsed)}`);
            this.outputChannel.appendLine(`Final heap used: ${this.formatBytes(samples[samples.length - 1].heapUsed)}`);
            this.outputChannel.appendLine(`Delta: ${this.formatBytes(samples[samples.length - 1].heapUsed - samples[0].heapUsed)}`);
            
            return { result, samples };
        } catch (error) {
            // Make sure to stop sampling if an error occurs
            sampling = false;
            clearInterval(sampleInterval);
            throw error;
        }
    }
    
    /**
     * Updates statistics for a cache
     * @param cacheName Name of the cache
     * @param hit Whether the cache lookup was a hit
     * @param timeSavedMs Time saved by the cache hit in milliseconds
     */
    public updateCacheStatistics(cacheName: string, hit: boolean, timeSavedMs: number = 0): void {
        // Get or create cache statistics
        const stats = this.cacheStatistics.get(cacheName) || {
            cacheName,
            hits: 0,
            misses: 0,
            hitRatio: 0,
            size: 0,
            timeSavedMs: 0
        };
        
        // Update statistics
        if (hit) {
            stats.hits++;
            stats.timeSavedMs += timeSavedMs;
        } else {
            stats.misses++;
        }
        
        // Recalculate hit ratio
        stats.hitRatio = stats.hits / (stats.hits + stats.misses);
        
        // Store updated statistics
        this.cacheStatistics.set(cacheName, stats);
    }
    
    /**
     * Updates the size of a cache
     * @param cacheName Name of the cache
     * @param size Current size of the cache
     */
    public updateCacheSize(cacheName: string, size: number): void {
        const stats = this.cacheStatistics.get(cacheName);
        if (stats) {
            stats.size = size;
            this.cacheStatistics.set(cacheName, stats);
        }
    }
    
    /**
     * Gets statistics for all caches
     * @returns Array of cache statistics
     */
    public getCacheStatistics(): CacheStatistics[] {
        return Array.from(this.cacheStatistics.values());
    }
    
    /**
     * Clears cache statistics
     */
    public clearCacheStatistics(): void {
        this.cacheStatistics.clear();
    }
    
    /**
     * Gets the measurement history
     * @param filter Optional filter function for measurements
     * @returns Filtered measurement history
     */
    public getHistory(filter?: (measurement: PerformanceMeasurement) => boolean): PerformanceMeasurement[] {
        if (filter) {
            return this.measurementHistory.filter(filter);
        }
        return [...this.measurementHistory];
    }
    
    /**
     * Clears the measurement history
     */
    public clearHistory(): void {
        this.measurementHistory = [];
    }
    
    /**
     * Exports performance data to a JSON file
     * @param filePath Path to export the data to
     */
    public async exportData(filePath: string): Promise<void> {
        const data = {
            measurements: this.measurementHistory,
            cacheStatistics: Array.from(this.cacheStatistics.values())
        };
        
        await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2));
    }
    
    /**
     * Shows the performance dashboard in a webview
     */
    public showDashboard(): void {
        // Create and show a webview panel
        const panel = vscode.window.createWebviewPanel(
            'documentWriterPerformance',
            'Document Writer Performance Dashboard',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );
        
        // Generate dashboard HTML
        panel.webview.html = this.generateDashboardHtml();
        
        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'clearHistory':
                    this.clearHistory();
                    panel.webview.html = this.generateDashboardHtml();
                    break;
                case 'clearCacheStats':
                    this.clearCacheStatistics();
                    panel.webview.html = this.generateDashboardHtml();
                    break;
                case 'exportData':
                    vscode.window.showSaveDialog({
                        filters: { 'JSON': ['json'] },
                        defaultUri: vscode.Uri.file(path.join(this.context.globalStoragePath, 'performance-data.json'))
                    }).then(uri => {
                        if (uri) {
                            this.exportData(uri.fsPath).then(() => {
                                vscode.window.showInformationMessage(`Performance data exported to ${uri.fsPath}`);
                            }).catch(err => {
                                vscode.window.showErrorMessage(`Failed to export performance data: ${err.message}`);
                            });
                        }
                    });
                    break;
            }
        });
    }
    
    /**
     * Adds a measurement to the history
     * @param measurement The measurement to add
     */
    private addToHistory(measurement: PerformanceMeasurement): void {
        this.measurementHistory.push(measurement);
        
        // Limit history size
        if (this.measurementHistory.length > this.MAX_HISTORY_SIZE) {
            this.measurementHistory.shift();
        }
    }
    
    /**
     * Logs a measurement to the output channel
     * @param measurement The measurement to log
     */
    private logMeasurement(measurement: PerformanceMeasurement): void {
        this.outputChannel.appendLine(
            `[${measurement.timestamp.toISOString()}] ${measurement.operationName}: ` +
            `${measurement.durationMs.toFixed(2)} ms, ` +
            `Memory delta: ${this.formatBytes(measurement.memoryDelta)}`
        );
        
        if (measurement.tags.length > 0) {
            this.outputChannel.appendLine(`  Tags: ${measurement.tags.join(', ')}`);
        }
    }
    
    /**
     * Formats bytes to a human-readable string
     * @param bytes The number of bytes
     * @returns Formatted string
     */
    private formatBytes(bytes: number): string {
        if (Math.abs(bytes) < 1024) {
            return `${bytes} B`;
        }
        
        const units = ['KB', 'MB', 'GB', 'TB'];
        let i = -1;
        const absBytes = Math.abs(bytes);
        
        do {
            bytes /= 1024;
            i++;
        } while (absBytes / 1024 > 1024 && i < units.length - 1);
        
        return `${bytes.toFixed(2)} ${units[i]}`;
    }
    
    /**
     * Generates HTML for the performance dashboard
     * @returns Dashboard HTML
     */
    private generateDashboardHtml(): string {
        // Group measurements by operation name
        const operationGroups = new Map<string, PerformanceMeasurement[]>();
        
        for (const measurement of this.measurementHistory) {
            const group = operationGroups.get(measurement.operationName) || [];
            group.push(measurement);
            operationGroups.set(measurement.operationName, group);
        }
        
        // Calculate statistics for each group
        const operationStats = Array.from(operationGroups.entries()).map(([name, measurements]) => {
            const durations = measurements.map(m => m.durationMs);
            const avgDuration = durations.reduce((sum, val) => sum + val, 0) / durations.length;
            const minDuration = Math.min(...durations);
            const maxDuration = Math.max(...durations);
            
            const memoryDeltas = measurements.map(m => m.memoryDelta);
            const avgMemoryDelta = memoryDeltas.reduce((sum, val) => sum + val, 0) / memoryDeltas.length;
            
            return {
                name,
                count: measurements.length,
                avgDuration,
                minDuration,
                maxDuration,
                avgMemoryDelta,
                measurements
            };
        }).sort((a, b) => b.avgDuration - a.avgDuration);
        
        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Document Writer Performance Dashboard</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                }
                h1, h2, h3 {
                    color: var(--vscode-editor-foreground);
                }
                table {
                    border-collapse: collapse;
                    width: 100%;
                    margin-bottom: 20px;
                }
                th, td {
                    text-align: left;
                    padding: 8px;
                    border-bottom: 1px solid var(--vscode-panel-border);
                }
                th {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                }
                .card {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 5px;
                    padding: 15px;
                    margin-bottom: 20px;
                }
                .button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    padding: 8px 12px;
                    border-radius: 3px;
                    cursor: pointer;
                    margin-right: 10px;
                }
                .button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                .stat-card {
                    display: inline-block;
                    width: 200px;
                    margin: 10px;
                    padding: 15px;
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-radius: 5px;
                    text-align: center;
                }
                .stat-value {
                    font-size: 24px;
                    font-weight: bold;
                    margin: 10px 0;
                }
                .stat-label {
                    font-size: 14px;
                    color: var(--vscode-descriptionForeground);
                }
                .tab {
                    overflow: hidden;
                    border-bottom: 1px solid var(--vscode-panel-border);
                    margin-bottom: 20px;
                }
                .tab button {
                    background-color: inherit;
                    float: left;
                    border: none;
                    outline: none;
                    cursor: pointer;
                    padding: 10px 16px;
                    color: var(--vscode-foreground);
                }
                .tab button:hover {
                    background-color: var(--vscode-list-hoverBackground);
                }
                .tab button.active {
                    background-color: var(--vscode-editor-inactiveSelectionBackground);
                    border-bottom: 2px solid var(--vscode-button-background);
                }
                .tabcontent {
                    display: none;
                    padding: 6px 12px;
                }
                .show {
                    display: block;
                }
            </style>
        </head>
        <body>
            <h1>Document Writer Performance Dashboard</h1>
            
            <div class="tab">
                <button class="tablinks active" onclick="openTab(event, 'OperationStats')">Operation Statistics</button>
                <button class="tablinks" onclick="openTab(event, 'CacheStats')">Cache Statistics</button>
                <button class="tablinks" onclick="openTab(event, 'RawData')">Raw Data</button>
            </div>
            
            <div class="tabcontent show" id="OperationStats">
                <div style="margin-bottom: 20px;">
                    <button class="button" onclick="clearHistory()">Clear History</button>
                    <button class="button" onclick="exportData()">Export Data</button>
                </div>
                
                <div class="card">
                    <h3>Summary</h3>
                    <div class="stat-card">
                        <div class="stat-value">${this.measurementHistory.length}</div>
                        <div class="stat-label">Total Measurements</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">${operationGroups.size}</div>
                        <div class="stat-label">Unique Operations</div>
                    </div>
                </div>
                
                <h2>Operation Performance</h2>
                <table>
                    <tr>
                        <th>Operation</th>
                        <th>Count</th>
                        <th>Avg Duration (ms)</th>
                        <th>Min Duration (ms)</th>
                        <th>Max Duration (ms)</th>
                        <th>Avg Memory Delta</th>
                    </tr>
                    ${operationStats.map(stat => `
                        <tr>
                            <td>${stat.name}</td>
                            <td>${stat.count}</td>
                            <td>${stat.avgDuration.toFixed(2)}</td>
                            <td>${stat.minDuration.toFixed(2)}</td>
                            <td>${stat.maxDuration.toFixed(2)}</td>
                            <td>${this.formatBytes(stat.avgMemoryDelta)}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <div class="tabcontent" id="CacheStats">
                <div style="margin-bottom: 20px;">
                    <button class="button" onclick="clearCacheStats()">Clear Cache Statistics</button>
                </div>
                
                <h2>Cache Performance</h2>
                ${this.cacheStatistics.size === 0 ? '<p>No cache statistics available.</p>' : `
                <table>
                    <tr>
                        <th>Cache Name</th>
                        <th>Size</th>
                        <th>Hits</th>
                        <th>Misses</th>
                        <th>Hit Ratio</th>
                        <th>Time Saved</th>
                    </tr>
                    ${Array.from(this.cacheStatistics.values()).map(stat => `
                        <tr>
                            <td>${stat.cacheName}</td>
                            <td>${stat.size}</td>
                            <td>${stat.hits}</td>
                            <td>${stat.misses}</td>
                            <td>${(stat.hitRatio * 100).toFixed(2)}%</td>
                            <td>${stat.timeSavedMs.toFixed(2)} ms</td>
                        </tr>
                    `).join('')}
                </table>
                `}
            </div>
            
            <div class="tabcontent" id="RawData">
                <h2>Recent Measurements</h2>
                <table>
                    <tr>
                        <th>Timestamp</th>
                        <th>Operation</th>
                        <th>Duration (ms)</th>
                        <th>Memory Delta</th>
                        <th>Tags</th>
                    </tr>
                    ${this.measurementHistory.slice(-50).reverse().map(m => `
                        <tr>
                            <td>${m.timestamp.toISOString()}</td>
                            <td>${m.operationName}</td>
                            <td>${m.durationMs.toFixed(2)}</td>
                            <td>${this.formatBytes(m.memoryDelta)}</td>
                            <td>${m.tags.join(', ')}</td>
                        </tr>
                    `).join('')}
                </table>
            </div>
            
            <script>
                const vscode = acquireVsCodeApi();
                
                function openTab(evt, tabName) {
                    const tabcontent = document.getElementsByClassName("tabcontent");
                    for (let i = 0; i < tabcontent.length; i++) {
                        tabcontent[i].classList.remove("show");
                    }
                    
                    const tablinks = document.getElementsByClassName("tablinks");
                    for (let i = 0; i < tablinks.length; i++) {
                        tablinks[i].classList.remove("active");
                    }
                    
                    document.getElementById(tabName).classList.add("show");
                    evt.currentTarget.classList.add("active");
                }
                
                function clearHistory() {
                    vscode.postMessage({ command: 'clearHistory' });
                }
                
                function clearCacheStats() {
                    vscode.postMessage({ command: 'clearCacheStats' });
                }
                
                function exportData() {
                    vscode.postMessage({ command: 'exportData' });
                }
                
                // Initialize tabs
                document.getElementById('OperationStats').classList.add('show');
            </script>
        </body>
        </html>`;
    }
}
