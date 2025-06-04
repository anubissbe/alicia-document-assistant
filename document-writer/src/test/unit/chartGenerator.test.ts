import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { ChartGenerator, ChartData, ChartOptions } from '../../core/chartGenerator.js';
import { Canvas, createCanvas, loadImage } from 'canvas';

// Silence console.error during tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});
afterAll(() => {
    console.error = originalConsoleError;
});

// Mock fs and fs.promises
const mockFsPromises = {
    writeFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn().mockResolvedValue(undefined),
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue(Buffer.from('mock image data')),
    stat: jest.fn().mockResolvedValue({
        isFile: () => true,
        size: 1024
    })
};

jest.mock('node:fs', () => {
    const actualFs = jest.requireActual('node:fs');
    return {
        ...actualFs,
        constants: {
            R_OK: 4,
            W_OK: 2
        },
        promises: mockFsPromises,
        createReadStream: jest.fn(),
        createWriteStream: jest.fn().mockReturnValue({
            write: jest.fn(),
            end: jest.fn(),
            on: jest.fn((event, callback) => {
                if (event === 'finish') {
                    callback();
                }
                return this;
            })
        })
    };
});

jest.mock('node:fs/promises', () => mockFsPromises);

// Mock vscode module
jest.mock('vscode', () => ({
    ExtensionContext: jest.fn(),
    window: {
        showErrorMessage: jest.fn()
    }
}));

// Mock Chart.js
const mockChartInstance = {
    toBase64Image: jest.fn().mockReturnValue('data:image/png;base64,mockdata'),
    resize: jest.fn(),
    update: jest.fn(),
    destroy: jest.fn(),
    render: jest.fn(),
    stop: jest.fn()
};

const mockChart = jest.fn().mockImplementation((ctx, config) => ({
    ...mockChartInstance,
    data: config.data || {},
    options: config.options || {},
    ctx: ctx,
    canvas: ctx.canvas,
    config: config
}));

const registerables = [
    'ArcElement',
    'LineElement',
    'BarElement',
    'PointElement',
    'RadarController',
    'CategoryScale',
    'LinearScale',
    'Title',
    'Legend',
    'Tooltip'
];

const chartModule = {
    Chart: mockChart,
    register: jest.fn(),
    registerables,
    defaults: {
        font: { family: 'Arial', size: 12 },
        color: '#666',
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
            legend: { display: true },
            title: { display: false }
        }
    }
};

jest.mock('chart.js', () => ({
    __esModule: true,
    default: chartModule,
    ...chartModule
}));

// Mock dynamic imports for canvas
jest.mock('canvas', () => {
    const mockContext = {
        drawImage: jest.fn(),
        fillText: jest.fn(),
        measureText: jest.fn().mockReturnValue({ width: 100 }),
        beginPath: jest.fn(),
        stroke: jest.fn(),
        fill: jest.fn(),
        save: jest.fn(),
        restore: jest.fn(),
        scale: jest.fn(),
        clearRect: jest.fn(),
        setTransform: jest.fn(),
        canvas: null as any,
        createPattern: jest.fn(),
        createLinearGradient: jest.fn(),
        createRadialGradient: jest.fn(),
        getImageData: jest.fn().mockReturnValue({ data: new Uint8ClampedArray(4) }),
        putImageData: jest.fn(),
        clip: jest.fn(),
        rect: jest.fn(),
        arc: jest.fn(),
        moveTo: jest.fn(),
        lineTo: jest.fn(),
        closePath: jest.fn()
    };
    
    const mockCanvas = {
        getContext: jest.fn().mockReturnValue(mockContext),
        toBuffer: jest.fn().mockImplementation((format = 'image/png') => Buffer.from('mock image buffer')),
        toDataURL: jest.fn().mockReturnValue('data:image/png;base64,mockdata'),
        width: 800,
        height: 500
    };
    
    // Set up circular reference as in real canvas
    mockContext.canvas = mockCanvas;
    
    return {
        createCanvas: jest.fn().mockReturnValue(mockCanvas),
        loadImage: jest.fn().mockResolvedValue({
            width: 800,
            height: 500
        }),
        Context2d: jest.fn()
    };
});


// Mock canvg for SVG export
jest.mock('canvg', () => ({
    __esModule: true,
    Canvg: {
        from: jest.fn().mockResolvedValue({
            render: jest.fn().mockResolvedValue(undefined),
            toString: jest.fn().mockReturnValue('mock svg content'),
            stop: jest.fn()
        })
    }
}));

// Mock pdfkit for PDF export
jest.mock('pdfkit', () => {
  return jest.fn().mockImplementation(() => ({
    image: jest.fn(),
    on: jest.fn((event, callback) => {
      if (event === 'end') {
        callback();
      }
    }),
    end: jest.fn()
  }));
});

describe('ChartGenerator', () => {
  let chartGenerator: ChartGenerator;
  let mockContext: vscode.ExtensionContext;
  
  // Sample chart data and options for testing
  const sampleBarData: ChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Sales',
        data: [12, 19, 3, 5, 2]
      }
    ]
  };

  const sampleBarOptions: ChartOptions = {
    type: 'bar',
    title: 'Monthly Sales',
    width: 800,
    height: 500
  };

  const sampleLineData: ChartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
    datasets: [
      {
        label: 'Revenue',
        data: [120, 190, 300, 500, 200]
      }
    ]
  };

  const sampleLineOptions: ChartOptions = {
    type: 'line',
    title: 'Monthly Revenue'
  };

  const samplePieData: ChartData = {
    labels: ['Product A', 'Product B', 'Product C'],
    datasets: [
      {
        label: 'Sales',
        data: [300, 150, 100]
      }
    ]
  };

  const samplePieOptions: ChartOptions = {
    type: 'pie',
    title: 'Product Sales Distribution'
  };

  const sampleDoughnutData: ChartData = {
    labels: ['Marketing', 'Development', 'Sales', 'Support'],
    datasets: [
      {
        label: 'Budget',
        data: [35, 45, 15, 5]
      }
    ]
  };

  const sampleDoughnutOptions: ChartOptions = {
    type: 'doughnut',
    title: 'Budget Allocation'
  };

    beforeEach(() => {
        // Clear all mocks
        jest.clearAllMocks();
        (console.error as jest.Mock).mockClear();
        
        // Reset Chart.js instance mock
        Object.values(mockChartInstance).forEach(mock => {
            if (jest.isMockFunction(mock)) {
                mock.mockClear();
            }
        });
        
        // Reset fs promises mocks
        Object.values(mockFsPromises).forEach(mock => {
            if (jest.isMockFunction(mock)) {
                mock.mockClear();
            }
        });
        
        // Setup mock extension context
        mockContext = {
            extensionPath: '/test/extension/path',
            subscriptions: [],
            workspaceState: {
                get: jest.fn(),
                update: jest.fn()
            },
            globalState: {
                get: jest.fn(),
                update: jest.fn()
            }
        } as unknown as vscode.ExtensionContext;
        
        // Create instance
        chartGenerator = new ChartGenerator();
    });

  afterEach(() => {
    // Clean up any chart instances
    jest.resetModules();
    
    // Reset canvas mocks
    const canvas = require('canvas');
    canvas.createCanvas.mockClear();
    canvas.loadImage.mockClear();
    
    // Reset Chart.js mocks
    const Chart = require('chart.js').Chart;
    Chart.mockClear();
  });

  describe('generateChart', () => {
    it('should generate chart markup with correct configuration', async () => {
      // Generate a bar chart
      const result = await chartGenerator.generateChart(sampleBarData, sampleBarOptions);
      
      // Verify the result contains expected chart markup
      expect(result).toContain('<div class="chart-container"');
      expect(result).toContain('<canvas id="chart-');
      expect(result).toContain('new Chart(ctx,');
      expect(result).toContain('"type":"bar"');
      expect(result).toContain('"labels":["Jan","Feb","Mar","Apr","May"]');
      expect(result).toContain('"title":"Monthly Sales"');
    });

    it('should include responsive handling in generated markup', async () => {
      const result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        responsive: true
      });
      
      expect(result).toContain('ResizeObserver');
      expect(result).toContain('chart.resize()');
    });

    it('should validate chart data', async () => {
      const invalidData: ChartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: []
      };

      await expect(chartGenerator.generateChart(invalidData, sampleBarOptions))
        .rejects.toThrow('Chart datasets must be an array');
    });
    
    it('should validate chart options', async () => {
      const invalidOptions: ChartOptions = {
        type: 'invalid' as any,
        title: 'Invalid Chart'
      };

      await expect(chartGenerator.generateChart(sampleBarData, invalidOptions))
        .rejects.toThrow('Invalid chart type');
    });

    it('should validate dataset lengths', async () => {
      const invalidData: ChartData = {
        labels: ['Jan', 'Feb', 'Mar'],
        datasets: [{
          label: 'Invalid',
          data: [1, 2] // Length mismatch with labels
        }]
      };

      await expect(chartGenerator.generateChart(invalidData, sampleBarOptions))
        .rejects.toThrow('Dataset 0 length must match labels length');
    });
  });

  describe('Chart export functionality', () => {
    it('should export chart as PNG', async () => {
      const result = await chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'png');
      expect(result).toBeInstanceOf(Buffer);
      expect(require('canvas').createCanvas).toHaveBeenCalledWith(800, 500);
      expect(require('chart.js').Chart).toHaveBeenCalled();
      expect(require('chart.js').register).toHaveBeenCalledWith(...require('chart.js').registerables);
    });

    it('should export chart as SVG', async () => {
      const result = await chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'svg');
      expect(result).toBeInstanceOf(Buffer);
      expect(require('canvas').createCanvas).toHaveBeenCalledWith(800, 500);
      expect(require('chart.js').Chart).toHaveBeenCalled();
      expect(require('canvg').Canvg.from).toHaveBeenCalled();
    });

    it('should export chart as PDF', async () => {
      const result = await chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'pdf');
      expect(result).toBeInstanceOf(Buffer);
      expect(require('pdfkit')).toHaveBeenCalledWith({ size: [800, 500] });
    });

    it('should handle PNG export errors gracefully', async () => {
      const mockError = new Error('Canvas error');
      require('canvas').createCanvas.mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'png'))
        .rejects.toThrow('Failed to export chart: PNG conversion failed: Canvas error');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error exporting chart as PNG:'),
        mockError
      );
    });

    it('should handle SVG export errors gracefully', async () => {
      const mockError = new Error('SVG error');
      require('canvg').Canvg.from.mockRejectedValueOnce(mockError);

      await expect(chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'svg'))
        .rejects.toThrow('Failed to export chart: SVG conversion failed: SVG error');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error exporting chart as SVG:'),
        mockError
      );
    });

    it('should handle PDF export errors gracefully', async () => {
      const mockError = new Error('PDF error');
      require('pdfkit').mockImplementationOnce(() => {
        throw mockError;
      });

      await expect(chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'pdf'))
        .rejects.toThrow('Failed to export chart: PDF conversion failed: PDF error');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error exporting chart as PDF:'),
        mockError
      );
    });

    it('should handle invalid export format', async () => {
      await expect(chartGenerator.exportChart(sampleBarData, sampleBarOptions, 'invalid' as any))
        .rejects.toThrow('Failed to export chart: Unsupported export format: invalid');
    });
    
    
    it('should throw an error for unsupported chart types', async () => {
      const invalidOptions: ChartOptions = {
        type: 'unsupported' as any,
        title: 'Invalid Chart'
      };
      
      const validData: ChartData = {
        labels: ['A', 'B'],
        datasets: [{ label: 'Test', data: [1, 2] }]
      };
      
      await expect(chartGenerator.generateChart(validData, invalidOptions))
        .rejects.toThrow('Failed to generate chart: Unsupported chart type: unsupported');
      
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining('Error generating chart:'),
        expect.any(Error)
      );
    });
  });

  describe('Chart type validation', () => {
    it('should validate chart type', () => {
      const validateChartOptions = (chartGenerator as any).validateChartOptions.bind(chartGenerator);
      
      // Valid chart types
      expect(() => validateChartOptions({ type: 'bar' })).not.toThrow();
      expect(() => validateChartOptions({ type: 'line' })).not.toThrow();
      expect(() => validateChartOptions({ type: 'pie' })).not.toThrow();
      expect(() => validateChartOptions({ type: 'doughnut' })).not.toThrow();
      expect(() => validateChartOptions({ type: 'radar' })).not.toThrow();

      // Invalid chart type
      expect(() => validateChartOptions({ type: 'invalid' as any }))
        .toThrow('Invalid chart type');
    });

    it('should validate dimensions', () => {
      const validateChartOptions = (chartGenerator as any).validateChartOptions.bind(chartGenerator);
      
      // Invalid width
      expect(() => validateChartOptions({ type: 'bar', width: -100 }))
        .toThrow('Chart width must be positive');

      // Invalid height
      expect(() => validateChartOptions({ type: 'bar', height: -100 }))
        .toThrow('Chart height must be positive');
    });
  });

  describe('Chart configuration', () => {
    it('should apply default colors when not provided', async () => {
      const result = await chartGenerator.generateChart(sampleBarData, sampleBarOptions);
      expect(result).toContain('#FF6384'); // First default color
    });

    it('should respect custom colors when provided', async () => {
      const customData = {
        ...sampleBarData,
        datasets: [{
          ...sampleBarData.datasets[0],
          backgroundColor: ['#custom1', '#custom2']
        }]
      };
      const result = await chartGenerator.generateChart(customData, sampleBarOptions);
      expect(result).toContain('#custom1');
    });

    it('should handle legend configuration', async () => {
      const result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        legend: false
      });
      expect(result).toContain('"legend":{"display":false}');
    });
  });

  describe('Chart animation and responsiveness', () => {
    it('should handle animation configuration', async () => {
      // Test with animation enabled
      let result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        animation: true
      });
      expect(result).toContain('"duration":1000');

      // Test with animation disabled
      result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        animation: false
      });
      expect(result).toContain('"duration":0');
    });

    it('should handle responsive configuration', async () => {
      // Test with responsive enabled
      let result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        responsive: true,
        maintainAspectRatio: true
      });
      expect(result).toContain('"responsive":true');
      expect(result).toContain('"maintainAspectRatio":true');
      expect(result).toContain('ResizeObserver');

      // Test with responsive disabled
      result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        responsive: false,
        maintainAspectRatio: false
      });
      expect(result).toContain('"responsive":false');
      expect(result).toContain('"maintainAspectRatio":false');
      expect(result).not.toContain('ResizeObserver');
    });

    it('should handle title configuration', async () => {
      // Test with title
      let result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        title: 'Test Chart'
      });
      expect(result).toContain('"display":true');
      expect(result).toContain('"text":"Test Chart"');

      // Test without title
      result = await chartGenerator.generateChart(sampleBarData, {
        ...sampleBarOptions,
        title: undefined
      });
      expect(result).toContain('"display":false');
    });
  });
});
