import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { createCanvas, loadImage, Canvas, CanvasRenderingContext2D } from 'canvas';

/**
 * Interface for chart data configuration
 */
export interface ChartData {
    labels: string[];
    datasets: {
        label: string;
        data: number[];
        backgroundColor?: string | string[];
        borderColor?: string | string[];
        borderWidth?: number;
        fill?: boolean;
    }[];
}

/**
 * Interface for chart configuration
 */
export interface ChartConfig {
    type: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
    data: ChartData;
    title?: string;
    width?: number;
    height?: number;
    options?: any;
}

/**
 * Class for generating charts for documents
 */
export class ChartGenerator {
    private readonly defaultColors = [
        '#4e79a7', '#f28e2c', '#e15759', '#76b7b2', '#59a14f',
        '#edc949', '#af7aa1', '#ff9da7', '#9c755f', '#bab0ab'
    ];
    
    /**
     * Constructor
     * @param context Extension context
     */
    constructor(private context: vscode.ExtensionContext) {}
    
    /**
     * Generate a chart as a PNG image
     * @param config Chart configuration
     * @returns Path to the generated chart image
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
     * @param data Chart data
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
     * Draw a bar chart
     * @param ctx Canvas context
     * @param config Chart configuration
     * @param width Canvas width
     * @param height Canvas height
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
     * Draw a line chart
     * @param ctx Canvas context
     * @param config Chart configuration
     * @param width Canvas width
     * @param height Canvas height
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
     * Draw a pie or doughnut chart
     * @param ctx Canvas context
     * @param config Chart configuration
     * @param width Canvas width
     * @param height Canvas height
     * @param isDoughnut Whether to draw a doughnut chart
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
     * Draw a scatter chart
     * @param ctx Canvas context
     * @param config Chart configuration
     * @param width Canvas width
     * @param height Canvas height
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
     * @param ctx Canvas context
     * @param config Chart configuration
     * @param width Canvas width
     * @param height Canvas height
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
     * Convert a hex color to RGBA with specified alpha
     * @param hex Hex color
     * @param alpha Alpha value
     * @returns RGBA color string
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
     * @param dir Directory path
     */
    private async ensureDirectoryExists(dir: string): Promise<void> {
        try {
            await fs.promises.access(dir, fs.constants.F_OK);
        } catch (error) {
            await fs.promises.mkdir(dir, { recursive: true });
        }
    }
}
