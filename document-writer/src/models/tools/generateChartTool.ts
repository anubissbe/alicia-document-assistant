import * as vscode from 'vscode';
import { BaseMCPTool, MCPToolResponse } from '../mcpTool';
import { ChartGenerator, ChartData, ChartOptions } from '../../core/chartGenerator';

/**
 * Tool to generate charts for documents
 */
export class GenerateChartTool extends BaseMCPTool {
    /**
     * Constructor
     * @param chartGenerator Chart generator instance
     */
    constructor(private chartGenerator: ChartGenerator) {
        super(
            'generate_chart',
            'Generates charts for document content based on provided data',
            {
                type: 'object',
                properties: {
                    chartType: {
                        type: 'string',
                        description: 'The type of chart to generate',
                        enum: ['bar', 'line', 'pie', 'doughnut', 'scatter']
                    },
                    title: {
                        type: 'string',
                        description: 'The title of the chart'
                    },
                    labels: {
                        type: 'array',
                        items: {
                            type: 'string'
                        },
                        description: 'Labels for the chart data points'
                    },
                    datasets: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                label: {
                                    type: 'string',
                                    description: 'Label for the dataset'
                                },
                                data: {
                                    type: 'array',
                                    items: {
                                        type: 'number'
                                    },
                                    description: 'Data values for the dataset'
                                },
                                backgroundColor: {
                                    type: ['string', 'array'],
                                    description: 'Optional background color(s) for the dataset'
                                },
                                borderColor: {
                                    type: ['string', 'array'],
                                    description: 'Optional border color(s) for the dataset'
                                },
                                fill: {
                                    type: 'boolean',
                                    description: 'Whether to fill the area under the line (for line charts)'
                                }
                            },
                            required: ['label', 'data'],
                            additionalProperties: true
                        },
                        description: 'Datasets for the chart'
                    },
                    width: {
                        type: 'number',
                        description: 'Optional width of the chart in pixels'
                    },
                    height: {
                        type: 'number',
                        description: 'Optional height of the chart in pixels'
                    }
                },
                required: ['chartType', 'labels', 'datasets'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#'
            }
        );
    }

    /**
     * Execute the chart generation
     * @param args Arguments for the tool
     * @returns Promise that resolves to the chart generation results
     */
    async execute(args: {
        chartType: 'bar' | 'line' | 'pie' | 'doughnut' | 'scatter';
        title?: string;
        labels: string[];
        datasets: Array<{
            label: string;
            data: number[];
            backgroundColor?: string | string[];
            borderColor?: string | string[];
            fill?: boolean;
        }>;
        width?: number;
        height?: number;
    }): Promise<MCPToolResponse> {
        try {
            // Create chart data
            const chartData: ChartData = {
                labels: args.labels,
                datasets: args.datasets
            };

            // Create chart options
            const chartOptions: ChartOptions = {
                type: args.chartType,
                title: args.title,
                width: args.width,
                height: args.height
            };

            // Generate the chart
            const chartPath = await this.chartGenerator.generateChart(chartData, chartOptions);

            // Return the chart information
            return {
                success: true,
                chartPath,
                chartType: args.chartType,
                width: args.width || 800,
                height: args.height || 500
            };
        } catch (error) {
            console.error('Error generating chart:', error);
            throw new Error(`Failed to generate chart: ${error instanceof Error ? error.message : String(error)}`);
        }
    }
}
