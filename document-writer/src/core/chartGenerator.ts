// Basic type interfaces for charting functionality

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

export type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar' | 'scatter';

export interface ChartOptions {
    type: ChartType;
    title?: string;
    width?: number;
    height?: number;
    responsive?: boolean;
    maintainAspectRatio?: boolean;
    legend?: boolean;
    animation?: boolean;
}

export class ChartGenerator {
    private readonly defaultColors = [
        '#FF6384',
        '#36A2EB',
        '#FFCE56',
        '#4BC0C0',
        '#9966FF',
        '#FF9F40'
    ];

    private readonly defaultOptions: Partial<ChartOptions> = {
        width: 600,
        height: 400,
        responsive: true,
        maintainAspectRatio: true,
        legend: true,
        animation: true,
        type: 'bar' // Add default chart type
    };

    async generateChart(data: ChartData, options: ChartOptions): Promise<string> {
        try {
            // Validate inputs
            this.validateChartData(data);
            this.validateChartOptions(options);

            // Merge options with defaults
            const finalOptions = { ...this.defaultOptions, ...options };
            
            // Ensure valid dimensions
            finalOptions.width = Math.max(finalOptions.width || 600, 1);
            finalOptions.height = Math.max(finalOptions.height || 400, 1);

            // Apply colors if not provided
            data.datasets = data.datasets.map((dataset, index) => ({
                ...dataset,
                backgroundColor: dataset.backgroundColor || this.getDefaultColors(index, data.labels.length),
                borderColor: dataset.borderColor || this.defaultColors[index % this.defaultColors.length],
                borderWidth: dataset.borderWidth || 1
            }));

            // Generate chart configuration
            const config = this.generateChartConfig(data, finalOptions);

            // Convert to base64 string (placeholder - actual implementation would use a charting library)
            return this.generateChartMarkup(config);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to generate chart: ${errorMessage}`);
        }
    }

    private validateChartData(data: ChartData): void {
        if (!data.labels || !Array.isArray(data.labels)) {
            throw new Error('Chart labels must be an array');
        }

        if (!data.datasets || !Array.isArray(data.datasets)) {
            throw new Error('Chart datasets must be an array');
        }

        data.datasets.forEach((dataset, index) => {
            if (!dataset.data || !Array.isArray(dataset.data)) {
                throw new Error(`Dataset ${index} data must be an array`);
            }

            if (dataset.data.length !== data.labels.length) {
                throw new Error(`Dataset ${index} length must match labels length`);
            }
        });
    }

    private validateChartOptions(options: ChartOptions): void {
        const validTypes = ['bar', 'line', 'pie', 'doughnut', 'radar'];
        if (!validTypes.includes(options.type)) {
            throw new Error('Invalid chart type');
        }

        if (options.width && options.width <= 0) {
            throw new Error('Chart width must be positive');
        }

        if (options.height && options.height <= 0) {
            throw new Error('Chart height must be positive');
        }
    }

    private getDefaultColors(datasetIndex: number, count: number): string[] {
        const chartType = this.defaultOptions.type || 'bar';
        if (['pie', 'doughnut'].includes(chartType)) {
            return Array.from({ length: count }, (_, i) => 
                this.defaultColors[(datasetIndex + i) % this.defaultColors.length]
            );
        }
        return [this.defaultColors[datasetIndex % this.defaultColors.length]];
    }

    private generateChartConfig(data: ChartData, options: ChartOptions): any {
        const mergedOptions = { ...this.defaultOptions, ...options };
        return {
            type: options.type, // Always use provided type, not from defaults
            data: {
                labels: data.labels,
                datasets: data.datasets
            },
            options: {
                responsive: mergedOptions.responsive,
                maintainAspectRatio: mergedOptions.maintainAspectRatio,
                plugins: {
                    legend: {
                        display: mergedOptions.legend
                    },
                    title: {
                        display: !!mergedOptions.title,
                        text: mergedOptions.title
                    }
                },
                animation: {
                    duration: mergedOptions.animation ? 1000 : 0
                }
            }
        };
    }

    private generateChartMarkup(config: any): string {
        const chartId = `chart-${Date.now()}`;
        const width = (config as any).width || 600;
        const height = (config as any).height || 400;
        const containerStyle = config.options?.responsive 
            ? 'position: relative; width: 100%; height: 100%;'
            : `position: relative; width: ${width}px; height: ${height}px;`;
            
        return `
            <div class="chart-container" style="${containerStyle}">
                <canvas id="${chartId}"></canvas>
            </div>
            <script src="https://cdn.jsdelivr.net/npm/chart.js/dist/chart.umd.min.js"></script>
            <script>
                (function() {
                    const ctx = document.getElementById('${chartId}').getContext('2d');
                    const chart = new Chart(ctx, ${JSON.stringify(config)});
                    
                    // Handle responsiveness
                    if (${config.options?.responsive}) {
                        const container = document.querySelector('#${chartId}').parentElement;
                        const resizeObserver = new ResizeObserver(entries => {
                            for (const entry of entries) {
                                const { width, height } = entry.contentRect;
                                chart.resize(width, height);
                                chart.update('resize');
                            }
                        });
                        resizeObserver.observe(container);
                    }
                })();
            </script>
        `;
    }

    async exportChart(data: ChartData, options: ChartOptions, format: 'png' | 'svg' | 'pdf'): Promise<Buffer> {
        try {
            // Validate inputs
            this.validateChartData(data);
            this.validateChartOptions(options);

            // Generate chart configuration
            const config = this.generateChartConfig(data, { ...this.defaultOptions, ...options });

            // Generate chart markup
            const chartMarkup = this.generateChartMarkup(config);

            // Convert to requested format using appropriate library
            switch (format) {
                case 'png':
                    return await this.convertToPNG(chartMarkup, config);
                case 'svg':
                    return await this.convertToSVG(chartMarkup, config);
                case 'pdf':
                    return await this.convertToPDF(chartMarkup, config);
                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to export chart: ${errorMessage}`);
        }
    }

    private async convertToPNG(_markup: string, config: any): Promise<Buffer> {
        try {
            // Dynamic imports
            const { createCanvas } = await import('canvas');
            const { Chart, registerables } = await import('chart.js');
            
            // Ensure valid dimensions
            const width = Math.max(config.width || 600, 1);
            const height = Math.max(config.height || 400, 1);
            
            // Create canvas with dimensions
            const canvas = createCanvas(width, height);
            canvas.width = width;
            canvas.height = height;
            
            // Register required Chart.js components
            Chart.register(...registerables);
            
            // Create and render chart
            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx as any, config);
            
            // Wait for any animations to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Convert to PNG buffer
            return canvas.toBuffer('image/png');
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`PNG conversion failed: ${errorMessage}`);
        }
    }

    private async convertToSVG(_markup: string, config: any): Promise<Buffer> {
        try {
            // Dynamic imports
            const { createCanvas } = await import('canvas');
            const { Chart, registerables } = await import('chart.js');
            const { Canvg } = await import('canvg');
            
            // Ensure valid dimensions
            const width = Math.max(config.width || 600, 1);
            const height = Math.max(config.height || 400, 1);
            
            // Create canvas with dimensions
            const canvas = createCanvas(width, height);
            canvas.width = width;
            canvas.height = height;
            
            // Register required Chart.js components
            Chart.register(...registerables);
            
            // Create and render chart
            const ctx = canvas.getContext('2d');
            const chart = new Chart(ctx as any, config);
            
            // Wait for any animations to complete
            await new Promise(resolve => setTimeout(resolve, 100));
            
            // Get chart as base64 image
            const base64Image = chart.toBase64Image();
            
            // Create SVG with embedded image
            const svgMarkup = `
                <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
                    <image href="${base64Image}" width="100%" height="100%" />
                </svg>`;
            
            return Buffer.from(svgMarkup);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`SVG conversion failed: ${errorMessage}`);
        }
    }

    private async convertToPDF(markup: string, config: any): Promise<Buffer> {
        try {
            const { default: PDFDocument } = await import('pdfkit');
            
            // Ensure valid dimensions
            const width = Math.max(config.width || 600, 1);
            const height = Math.max(config.height || 400, 1);
            
            const doc = new PDFDocument({ size: [width, height] });
            
            // Convert chart to PNG first
            const pngBuffer = await this.convertToPNG(markup, config);
            
            // Add PNG to PDF
            doc.image(pngBuffer, 0, 0, {
                width,
                height
            });
            
            // Get PDF buffer
            return new Promise((resolve, reject) => {
                const chunks: Buffer[] = [];
                doc.on('data', (chunk: Buffer) => chunks.push(chunk));
                doc.on('end', () => resolve(Buffer.concat(chunks)));
                doc.on('error', (err: Error) => reject(err));
                doc.end();
            });
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`PDF conversion failed: ${errorMessage}`);
        }
    }
}
