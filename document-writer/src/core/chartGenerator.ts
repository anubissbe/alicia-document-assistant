import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';

/**
 * Interface for chart data configuration
 * 
 * @remarks
 * This interface defines the structure of data required to generate charts.
 * It follows a similar pattern to Chart.js data configuration to make it
 * familiar to developers used to web-based charting libraries.
 * 
 * @example
 * ```typescript
 * const salesData: ChartData = {
 *   labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
 *   datasets: [{
 *     label: 'Sales 2024',
 *     data: [5000, 6200, 7800, 8400, 9100],
 *     backgroundColor: '#4e79a7',
 *     borderColor: '#2c3e50',
 *     borderWidth: 1
 *   }]
 * };
 * ```
 */
export interface ChartData {
    /**
     * Array of labels for data points (e.g., categories, dates, etc.)
     */
    labels: string[];
    
    /**
     * Array of dataset objects containing the actual data and styling
     */
    datasets: {
        /**
         * Name/label for this dataset (used in legends)
         */
        label: string;
        
        /**
         * Array of numeric values for this dataset
         */
        data: number[];
        
        /**
         * Background color(s) for chart elements
         * Can be a single color or array of colors for each data point
         */
        backgroundColor?: string | string[];
        
        /**
         * Border color(s) for chart elements
         * Can be a single color or array of colors for each data point
         */
        borderColor?: string | string[];
        
        /**
         * Width of borders for chart elements in pixels
         */
        borderWidth?: number;
        
        /**
         * Whether to fill the area under lines (for line charts)
         */
        fill?: boolean;
    }[];
}

/**
 * Interface for chart configuration
 * 
 * @remarks
 * This interface defines the overall configuration for a chart, including
 * its type, data, dimensions, and title. It provides a unified configuration
 * object for all chart types supported by the ChartGenerator.
 * 
 * @example
 * ```typescript
 * const chartConfig: ChartConfig = {
 *   type: 'bar',
 *   data: salesData,
 *   title: 'Monthly Sales Report',
 *   width: 800,
 *   height: 500,
 *   options: {
 *     // Additional chart-specific options
 *   }
 * };
 * ```
 */
export interface ChartConfig {
    /**
     * Type of chart to generate
     * 
     * - 'bar': Vertical bar chart for comparing categories
     * - 'line': Line chart for showing trends over time
     * - 'pie': Circular chart showing proportions of a whole
     * - 'doughnut': Pie chart with a hole in the center
     * - 'scatter': Points plotted on x/y coordinates
     */
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
    
    /**
     * Data configuration for the chart
     */
    data: ChartData;
    
    /**
     * Optional title to display at the top of the chart
     */
    title?: string;
    
    /**
     * Width of the chart in pixels (default: 800)
     */
    width?: number;
    
    /**
     * Height of the chart in pixels (default: 500)
     */
    height?: number;
    
    /**
     * Additional chart-specific options
     */
    options?: any;
}

/**
 * Class for generating charts for documents
 * 
 * @remarks
 * The ChartGenerator class provides functionality for creating various types of charts
 * as images that can be embedded in documents. It uses the node-canvas library for
 * rendering and supports bar, line, pie, doughnut, and scatter charts.
 * 
 * Charts are generated as PNG files and saved in the extension's resources directory.
 * The class handles all aspects of chart generation including:
 * - Canvas setup and configuration
 * - Data processing and scaling
 * - Drawing chart elements (bars, lines, points, etc.)
 * - Adding titles, labels, and legends
 * - Saving output as PNG files
 * 
 * @example
 * ```typescript
 * // Create a chart generator
 * const chartGenerator = new ChartGenerator(context);
 * 
 * // Generate a bar chart
 * const chartConfig = {
 *   type: 'bar',
 *   data: {
 *     labels: ['Q1', 'Q2', 'Q3', 'Q4'],
 *     datasets: [{
 *       label: 'Revenue',
 *       data: [5000, 6000, 7000, 8000]
 *     }]
 *   },
 *   title: 'Quarterly Revenue'
 * };
 * 
 * const chartPath = await chartGenerator.generateChart(chartConfig);
 * ```
 */
export class ChartGenerator {
    /**
     * Default color palette for charts
     * These colors are designed to be distinct, accessible, and visually appealing
     * @private
     */
    private readonly defaultColors = [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
    ];
    
    /**
     * Creates a new instance of the ChartGenerator
     * 
     * @param context - VS Code extension context used to access extension resources
     */
    constructor(private context: vscode.ExtensionContext) {}
    
    /**
     * Generate a chart as a PNG image based on the provided configuration
     * 
     * @param config - Chart configuration defining type, data, and appearance
     * @returns Promise resolving to the file path of the generated chart image
     * 
     * @throws Error if chart generation fails for any reason
     * 
     * @remarks
     * This is the main method for generating charts. It handles the entire process from
     * creating the canvas to saving the final image. The method:
     * 
     * 1. Sets up the canvas with the specified dimensions
     * 2. Applies default colors to datasets if not provided
     * 3. Delegates to specialized methods for each chart type
     * 4. Adds titles and other common elements
     * 5. Saves the chart as a PNG file in the extension's resources directory
     * 
     * Each chart type has its own rendering method that handles the specifics of
     * drawing that particular chart type.
     * 
     * @example
     * ```typescript
     * const chartPath = await chartGenerator.generateChart({
     *   type: 'line',
     *   data: timeSeriesData,
     *   title: 'Temperature Trends',
     *   width: 1000,
     *   height: 600
     * });
     * ```
     */
    async generateChart(config: ChartConfig): Promise<string> {
        try {
            // Set default width and height if not provided
            const width = config.width || 800;
            const height = config.height || 500;
            
            // Create canvas
            const canvas = createCanvas(width, height);
            const ctx = canvas.getContext('2d');
            
            // Apply background
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, width, height);
            
            // Ensure colors are set for datasets
            this.applyColorDefaults(config.data);
            
            // Draw the chart based on type
            switch (config.type) {
                case 'bar':
                    await this.drawBarChart(ctx, config, width, height);
                    break;
                case 'line':
                    await this.drawLineChart(ctx, config, width, height);
                    break;
                case 'pie':
                case 'doughnut':
                    await this.drawPieChart(ctx, config, width, height, config.type === 'doughnut');
                    break;
                case 'scatter':
                    await this.drawScatterChart(ctx, config, width, height);
                    break;
                default:
                    throw new Error(`Unsupported chart type: ${config.type}`);
            }
            
            // Add title if provided
            if (config.title) {
                ctx.font = 'bold 24px Arial';
                ctx.textAlign = 'center';
                ctx.fillStyle = 'black';
                ctx.fillText(config.title, width / 2, 30);
            }
            
            // Save the chart as an image
            const outputDir = path.join(this.context.extensionPath, 'resources', 'charts');
            await this.ensureDirectoryExists(outputDir);
            
            const fileName = `chart_${Date.now()}.png`;
            const outputPath = path.join(outputDir, fileName);
            
            const buffer = canvas.toBuffer('image/png');
            await fs.promises.writeFile(outputPath, buffer);
            
            return outputPath;
        } catch (error) {
            console.error('Error generating chart:', error);
            throw new Error(`Failed to generate chart: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
    
    /**
     * Apply default colors to datasets if not provided
     * 
     * @param data - Chart data to process
     * 
     * @remarks
     * This method ensures all datasets have appropriate colors by applying defaults
     * from the color palette when colors aren't explicitly specified. It handles both
     * backgroundColor and borderColor properties, and sets a default borderWidth.
     * 
     * The method cycles through the default colors array for datasets beyond the
     * palette size, ensuring all datasets receive a color.
     * 
     * @private
     */
    private applyColorDefaults(data: ChartData): void {
        data.datasets.forEach((dataset, index) => {
            const colorIndex = index % this.defaultColors.length;
            const color = this.defaultColors[colorIndex];
            
            if (!dataset.backgroundColor) {
                dataset.backgroundColor = color;
            }
            
            if (!dataset.borderColor) {
                dataset.borderColor = color;
            }
            
            if (dataset.borderWidth === undefined) {
                dataset.borderWidth = 1;
            }
        });
    }
    
    /**
     * Draw a bar chart on the canvas
     * 
     * @param ctx - Canvas rendering context to draw on
     * @param config - Chart configuration
     * @param width - Canvas width in pixels
     * @param height - Canvas height in pixels
     * 
     * @remarks
     * This method renders a bar chart on the provided canvas context.
     * The implementation:
     * 
     * 1. Calculates chart dimensions and margins
     * 2. Determines the maximum value for scaling
     * 3. Draws axes and grid lines
     * 4. Renders bars for each dataset with appropriate colors
     * 5. Adds labels for data points
     * 6. Draws the legend for multiple datasets
     * 
     * For grouped bar charts (multiple datasets), each group of bars is 
     * arranged side by side for the corresponding category.
     * 
     * @private
     */
    private async drawBarChart(
        ctx: CanvasRenderingContext2D,
        config: ChartConfig,
        width: number,
        height: number
    ): Promise<void> {
        const { data } = config;
        const marginTop = config.title ? 60 : 30;
        const marginBottom = 60;
        const marginLeft = 60;
        const marginRight = 30;
        
        const chartWidth = width - marginLeft - marginRight;
        const chartHeight = height - marginTop - marginBottom;
        
        const numBars = data.labels.length;
        const numGroups = data.datasets.length;
        const groupWidth = chartWidth / numBars;
        const barWidth = groupWidth / (numGroups + 1);
        
        // Find the maximum value for scaling
        let maxValue = 0;
        for (const dataset of data.datasets) {
            const datasetMax = Math.max(...dataset.data);
            maxValue = Math.max(maxValue, datasetMax);
        }
        
        // Add some padding to the maximum value
        maxValue *= 1.1;
        
        // Draw axes
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(marginLeft, marginTop);
        ctx.lineTo(marginLeft, height - marginBottom);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(marginLeft, height - marginBottom);
        ctx.lineTo(width - marginRight, height - marginBottom);
        ctx.stroke();
        
        // Draw Y-axis labels
        const numYLabels = 5;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        
        for (let i = 0; i <= numYLabels; i++) {
            const value = (maxValue * i) / numYLabels;
            const y = height - marginBottom - (chartHeight * i) / numYLabels;
            
            ctx.fillText(value.toFixed(0), marginLeft - 10, y);
            
            // Draw grid line
            ctx.beginPath();
            ctx.strokeStyle = '#e0e0e0';
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(width - marginRight, y);
            ctx.stroke();
        }
        
        // Draw bars and X-axis labels
        for (let i = 0; i < numBars; i++) {
            const label = data.labels[i];
            const x = marginLeft + i * groupWidth + groupWidth / 2;
            
            // Draw X-axis label
            ctx.save();
            ctx.translate(x, height - marginBottom + 10);
            ctx.rotate(Math.PI / 4); // Rotate labels to prevent overlap
            ctx.textAlign = 'left';
            ctx.fillStyle = 'black';
            ctx.fillText(label, 0, 0);
            ctx.restore();
            
            // Draw bars for each dataset
            for (let j = 0; j < numGroups; j++) {
                const dataset = data.datasets[j];
                const value = dataset.data[i];
                const barHeight = (chartHeight * value) / maxValue;
                
                const barX = marginLeft + i * groupWidth + (j + 0.5) * barWidth;
                const barY = height - marginBottom - barHeight;
                
                // Draw bar
                ctx.fillStyle = Array.isArray(dataset.backgroundColor) 
                    ? dataset.backgroundColor[i % dataset.backgroundColor.length] 
                    : dataset.backgroundColor as string;
                
                ctx.fillRect(barX, barY, barWidth, barHeight);
                
                // Draw border
                ctx.strokeStyle = Array.isArray(dataset.borderColor) 
                    ? dataset.borderColor[i % dataset.borderColor.length] 
                    : dataset.borderColor as string;
                
                ctx.lineWidth = dataset.borderWidth || 1;
                ctx.strokeRect(barX, barY, barWidth, barHeight);
            }
        }
        
        // Draw legend
        this.drawLegend(ctx, config, width, height);
    }
    
    /**
     * Draw a line chart on the canvas
     * 
     * @param ctx - Canvas rendering context to draw on
     * @param config - Chart configuration
     * @param width - Canvas width in pixels
     * @param height - Canvas height in pixels
     * 
     * @remarks
     * This method renders a line chart on the provided canvas context.
     * The implementation:
     * 
     * 1. Calculates chart dimensions and margins
     * 2. Determines the maximum value for scaling
     * 3. Draws axes and grid lines
     * 4. Renders lines connecting data points for each dataset
     * 5. Optionally fills the area under each line if specified
     * 6. Draws data points as circles
     * 7. Adds labels for data points
     * 8. Draws the legend for multiple datasets
     * 
     * Line charts are particularly useful for visualizing trends over time
     * or continuous data.
     * 
     * @private
     */
    private async drawLineChart(
        ctx: CanvasRenderingContext2D,
        config: ChartConfig,
        width: number,
        height: number
    ): Promise<void> {
        const { data } = config;
        const marginTop = config.title ? 60 : 30;
        const marginBottom = 60;
        const marginLeft = 60;
        const marginRight = 30;
        
        const chartWidth = width - marginLeft - marginRight;
        const chartHeight = height - marginTop - marginBottom;
        
        const numPoints = data.labels.length;
        
        // Find the maximum value for scaling
        let maxValue = 0;
        for (const dataset of data.datasets) {
            const datasetMax = Math.max(...dataset.data);
            maxValue = Math.max(maxValue, datasetMax);
        }
        
        // Add some padding to the maximum value
        maxValue *= 1.1;
        
        // Draw axes
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(marginLeft, marginTop);
        ctx.lineTo(marginLeft, height - marginBottom);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(marginLeft, height - marginBottom);
        ctx.lineTo(width - marginRight, height - marginBottom);
        ctx.stroke();
        
        // Draw Y-axis labels
        const numYLabels = 5;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        
        for (let i = 0; i <= numYLabels; i++) {
            const value = (maxValue * i) / numYLabels;
            const y = height - marginBottom - (chartHeight * i) / numYLabels;
            
            ctx.fillText(value.toFixed(0), marginLeft - 10, y);
            
            // Draw grid line
            ctx.beginPath();
            ctx.strokeStyle = '#e0e0e0';
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(width - marginRight, y);
            ctx.stroke();
        }
        
        // Draw X-axis labels
        for (let i = 0; i < numPoints; i++) {
            const label = data.labels[i];
            const x = marginLeft + (i / (numPoints - 1)) * chartWidth;
            
            ctx.save();
            ctx.translate(x, height - marginBottom + 10);
            ctx.rotate(Math.PI / 4); // Rotate labels to prevent overlap
            ctx.textAlign = 'left';
            ctx.fillStyle = 'black';
            ctx.fillText(label, 0, 0);
            ctx.restore();
            
            // Draw grid line
            ctx.beginPath();
            ctx.strokeStyle = '#e0e0e0';
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, height - marginBottom);
            ctx.stroke();
        }
        
        // Draw lines for each dataset
        for (let i = 0; i < data.datasets.length; i++) {
            const dataset = data.datasets[i];
            
            // Draw line
            ctx.beginPath();
            ctx.strokeStyle = Array.isArray(dataset.borderColor) 
                ? dataset.borderColor[0] 
                : dataset.borderColor as string;
            ctx.lineWidth = dataset.borderWidth || 2;
            
            for (let j = 0; j < numPoints; j++) {
                const x = marginLeft + (j / (numPoints - 1)) * chartWidth;
                const y = height - marginBottom - (chartHeight * dataset.data[j]) / maxValue;
                
                if (j === 0) {
                    ctx.moveTo(x, y);
                } else {
                    ctx.lineTo(x, y);
                }
            }
            
            ctx.stroke();
            
            // Fill area under the line if specified
            if (dataset.fill) {
                ctx.lineTo(marginLeft + chartWidth, height - marginBottom);
                ctx.lineTo(marginLeft, height - marginBottom);
                ctx.closePath();
                
                const fillColor = Array.isArray(dataset.backgroundColor) 
                    ? dataset.backgroundColor[0] 
                    : dataset.backgroundColor as string;
                
                // Create a semi-transparent fill
                const rgbaFill = this.convertToRGBA(fillColor, 0.2);
                ctx.fillStyle = rgbaFill;
                ctx.fill();
            }
            
            // Draw data points
            for (let j = 0; j < numPoints; j++) {
                const x = marginLeft + (j / (numPoints - 1)) * chartWidth;
                const y = height - marginBottom - (chartHeight * dataset.data[j]) / maxValue;
                
                ctx.beginPath();
                ctx.arc(x, y, 4, 0, Math.PI * 2);
                ctx.fillStyle = Array.isArray(dataset.backgroundColor) 
                    ? dataset.backgroundColor[j % dataset.backgroundColor.length] 
                    : dataset.backgroundColor as string;
                ctx.fill();
                
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
            }
        }
        
        // Draw legend
        this.drawLegend(ctx, config, width, height);
    }
    
    /**
     * Draw a pie or doughnut chart on the canvas
     * 
     * @param ctx - Canvas rendering context to draw on
     * @param config - Chart configuration
     * @param width - Canvas width in pixels
     * @param height - Canvas height in pixels
     * @param isDoughnut - Whether to draw a doughnut chart (true) or a pie chart (false)
     * 
     * @remarks
     * This method renders either a pie or doughnut chart on the provided canvas context.
     * The implementation:
     * 
     * 1. Calculates the center point and radius
     * 2. Computes the total value to determine slice proportions
     * 3. Draws each slice with appropriate colors
     * 4. Adds percentage labels inside slices when they're large enough
     * 5. For doughnut charts, cuts out the center circle
     * 6. Adds a legend to identify each slice
     * 
     * Pie and doughnut charts are ideal for showing proportions of a whole
     * or composition of a total value.
     * 
     * @private
     */
    private async drawPieChart(
        ctx: CanvasRenderingContext2D,
        config: ChartConfig,
        width: number,
        height: number,
        isDoughnut: boolean
    ): Promise<void> {
        const { data } = config;
        const marginTop = config.title ? 60 : 30;
        
        // Use the first dataset for pie/doughnut chart
        const dataset = data.datasets[0];
        const total = dataset.data.reduce((sum, value) => sum + value, 0);
        
        // Calculate the center and radius
        const centerX = width / 2;
        const centerY = (height + marginTop) / 2;
        const radius = Math.min(width, height) / 3;
        
        // Draw slices
        let startAngle = 0;
        
        for (let i = 0; i < dataset.data.length; i++) {
            const value = dataset.data[i];
            const sliceAngle = (value / total) * Math.PI * 2;
            
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAngle, startAngle + sliceAngle);
            ctx.closePath();
            
            // Fill slice
            ctx.fillStyle = Array.isArray(dataset.backgroundColor) 
                ? dataset.backgroundColor[i % dataset.backgroundColor.length] 
                : dataset.backgroundColor as string;
            ctx.fill();
            
            // Draw border
            ctx.strokeStyle = 'white';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // If it's a doughnut chart, draw the inner circle
            if (isDoughnut) {
                ctx.beginPath();
                ctx.arc(centerX, centerY, radius * 0.6, 0, Math.PI * 2);
                ctx.fillStyle = 'white';
                ctx.fill();
            }
            
            // Calculate the midpoint of the slice for label
            const midAngle = startAngle + sliceAngle / 2;
            const labelRadius = radius * 0.7;
            const labelX = centerX + Math.cos(midAngle) * labelRadius;
            const labelY = centerY + Math.sin(midAngle) * labelRadius;
            
            // Draw percentage label inside the slice if large enough
            if (sliceAngle > 0.2) {
                const percentage = ((value / total) * 100).toFixed(1) + '%';
                
                ctx.font = 'bold 12px Arial';
                ctx.fillStyle = 'white';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(percentage, labelX, labelY);
            }
            
            startAngle += sliceAngle;
        }
        
        // Draw legend with labels
        const legendX = width - 150;
        const legendY = marginTop + 20;
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i < data.labels.length; i++) {
            const label = data.labels[i];
            const y = legendY + i * 20;
            
            // Draw color box
            ctx.fillStyle = Array.isArray(dataset.backgroundColor) 
                ? dataset.backgroundColor[i % dataset.backgroundColor.length] 
                : dataset.backgroundColor as string;
            ctx.fillRect(legendX, y - 6, 12, 12);
            
            // Draw label
            ctx.fillStyle = 'black';
            ctx.fillText(label, legendX + 20, y);
        }
    }
    
    /**
     * Draw a scatter chart on the canvas
     * 
     * @param ctx - Canvas rendering context to draw on
     * @param config - Chart configuration
     * @param width - Canvas width in pixels
     * @param height - Canvas height in pixels
     * 
     * @remarks
     * This method renders a scatter chart on the provided canvas context.
     * The implementation:
     * 
     * 1. Calculates chart dimensions and margins
     * 2. Determines the maximum X and Y values for scaling
     * 3. Draws axes and grid lines
     * 4. Plots individual data points as circles
     * 5. Adds labels to data points
     * 6. Draws the legend for multiple datasets
     * 
     * Scatter charts are useful for showing relationships between two variables
     * and identifying patterns or correlations in the data.
     * 
     * @private
     */
    private async drawScatterChart(
        ctx: CanvasRenderingContext2D,
        config: ChartConfig,
        width: number,
        height: number
    ): Promise<void> {
        const { data } = config;
        const marginTop = config.title ? 60 : 30;
        const marginBottom = 60;
        const marginLeft = 60;
        const marginRight = 30;
        
        const chartWidth = width - marginLeft - marginRight;
        const chartHeight = height - marginTop - marginBottom;
        
        // Find the maximum values for scaling
        let maxX = 0;
        let maxY = 0;
        
        for (const dataset of data.datasets) {
            for (const value of dataset.data) {
                maxX = Math.max(maxX, value);
                maxY = Math.max(maxY, value);
            }
        }
        
        // Add some padding to the maximum values
        maxX *= 1.1;
        maxY *= 1.1;
        
        // Draw axes
        ctx.strokeStyle = 'black';
        ctx.lineWidth = 1;
        
        // Y-axis
        ctx.beginPath();
        ctx.moveTo(marginLeft, marginTop);
        ctx.lineTo(marginLeft, height - marginBottom);
        ctx.stroke();
        
        // X-axis
        ctx.beginPath();
        ctx.moveTo(marginLeft, height - marginBottom);
        ctx.lineTo(width - marginRight, height - marginBottom);
        ctx.stroke();
        
        // Draw Y-axis labels
        const numYLabels = 5;
        ctx.textAlign = 'right';
        ctx.textBaseline = 'middle';
        ctx.font = '12px Arial';
        ctx.fillStyle = 'black';
        
        for (let i = 0; i <= numYLabels; i++) {
            const value = (maxY * i) / numYLabels;
            const y = height - marginBottom - (chartHeight * i) / numYLabels;
            
            ctx.fillText(value.toFixed(0), marginLeft - 10, y);
            
            // Draw grid line
            ctx.beginPath();
            ctx.strokeStyle = '#e0e0e0';
            ctx.moveTo(marginLeft, y);
            ctx.lineTo(width - marginRight, y);
            ctx.stroke();
        }
        
        // Draw X-axis labels
        const numXLabels = 5;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        
        for (let i = 0; i <= numXLabels; i++) {
            const value = (maxX * i) / numXLabels;
            const x = marginLeft + (chartWidth * i) / numXLabels;
            
            ctx.fillText(value.toFixed(0), x, height - marginBottom + 10);
            
            // Draw grid line
            ctx.beginPath();
            ctx.strokeStyle = '#e0e0e0';
            ctx.moveTo(x, marginTop);
            ctx.lineTo(x, height - marginBottom);
            ctx.stroke();
        }
        
        // Draw data points for each dataset
        for (let i = 0; i < data.datasets.length; i++) {
            const dataset = data.datasets[i];
            
            for (let j = 0; j < dataset.data.length && j < data.labels.length; j++) {
                const value = dataset.data[j];
                const x = marginLeft + (chartWidth * value) / maxX;
                const y = height - marginBottom - (chartHeight * value) / maxY;
                
                // Draw point
                ctx.beginPath();
                ctx.arc(x, y, 5, 0, Math.PI * 2);
                ctx.fillStyle = Array.isArray(dataset.backgroundColor) 
                    ? dataset.backgroundColor[j % dataset.backgroundColor.length] 
                    : dataset.backgroundColor as string;
                ctx.fill();
                
                ctx.strokeStyle = 'white';
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Draw label if needed
                ctx.fillStyle = 'black';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'bottom';
                ctx.font = '10px Arial';
                ctx.fillText(data.labels[j], x, y - 8);
            }
        }
        
        // Draw legend
        this.drawLegend(ctx, config, width, height);
    }
    
    /**
     * Draw a legend for the chart
     * 
     * @param ctx - Canvas rendering context to draw on
     * @param config - Chart configuration
     * @param width - Canvas width in pixels
     * @param height - Canvas height in pixels
     * 
     * @remarks
     * This method draws a legend on the right side of the chart, showing
     * color indicators and labels for each dataset. It's used by all chart types
     * except pie/doughnut charts, which have their own legend implementation.
     * 
     * The legend consists of:
     * - Small colored rectangles representing each dataset
     * - Dataset labels next to the color indicators
     * 
     * @private
     */
    private drawLegend(
        ctx: CanvasRenderingContext2D,
        config: ChartConfig,
        width: number,
        height: number
    ): void {
        if (config.type === 'pie' || config.type === 'doughnut') {
            // Legend is already drawn in the pie chart method
            return;
        }
        
        const { data } = config;
        const legendX = width - 150;
        const legendY = 50;
        
        ctx.font = '12px Arial';
        ctx.textAlign = 'left';
        ctx.textBaseline = 'middle';
        
        for (let i = 0; i < data.datasets.length; i++) {
            const dataset = data.datasets[i];
            const y = legendY + i * 20;
            
            // Draw color box
            ctx.fillStyle = Array.isArray(dataset.backgroundColor) 
                ? dataset.backgroundColor[0] 
                : dataset.backgroundColor as string;
            ctx.fillRect(legendX, y - 6, 12, 12);
            
            // Draw label
            ctx.fillStyle = 'black';
            ctx.fillText(dataset.label, legendX + 20, y);
        }
    }
    
    /**
     * Convert a hex color to RGBA with specified alpha transparency
     * 
     * @param hex - Hex color code (e.g., '#ff0000' or '#f00')
     * @param alpha - Alpha transparency value between 0 and 1
     * @returns RGBA color string (e.g., 'rgba(255, 0, 0, 0.5)')
     * 
     * @remarks
     * This utility method converts a hex color code to an RGBA color string
     * with the specified alpha transparency. It's used primarily for:
     * 
     * - Creating semi-transparent fills for line charts
     * - Applying transparency to chart elements
     * - Creating hover/focus effects
     * 
     * @private
     */
    private convertToRGBA(hex: string, alpha: number): string {
        // Remove # if present
        hex = hex.replace('#', '');
        
        // Parse hex to RGB
        const r = parseInt(hex.substring(0, 2), 16);
        const g = parseInt(hex.substring(2, 4), 16);
        const b = parseInt(hex.substring(4, 6), 16);
        
        // Return as rgba
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
    
    /**
     * Ensure a directory exists, creating it if necessary
     * 
     * @param dir - Directory path to check/create
     * @returns Promise that resolves when the directory exists
     * 
     * @remarks
     * This utility method checks if a directory exists and creates it
     * if it doesn't. It's used to ensure the charts output directory
     * exists before attempting to save chart images.
     * 
     * The method uses the recursive option when creating directories,
     * so it will create any missing parent directories as well.
     * 
     * @private
     */
    private async ensureDirectoryExists(dir: string): Promise<void> {
        try {
            await fs.promises.access(dir, fs.constants.F_OK);
        } catch (error) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
    }
}
