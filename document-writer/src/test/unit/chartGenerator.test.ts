import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ChartGenerator, ChartConfig } from '../../core/chartGenerator';
import { Canvas, createCanvas, loadImage } from 'canvas';

// Mock the fs module
jest.mock('fs', () => ({
  promises: {
    writeFile: jest.fn().mockResolvedValue(undefined),
    access: jest.fn(),
    mkdir: jest.fn().mockResolvedValue(undefined),
  },
  constants: {
    F_OK: 0
  }
}));

// Mock the vscode module
jest.mock('vscode', () => ({
  ExtensionContext: jest.fn()
}));

// Mock the canvas module
jest.mock('canvas', () => {
  // Mock context for canvas
  const mockContext = {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'left',
    textBaseline: 'top',
    font: '',
    fillRect: jest.fn(),
    beginPath: jest.fn(),
    moveTo: jest.fn(),
    lineTo: jest.fn(),
    arc: jest.fn(),
    closePath: jest.fn(),
    fill: jest.fn(),
    stroke: jest.fn(),
    fillText: jest.fn(),
    strokeRect: jest.fn(),
    save: jest.fn(),
    restore: jest.fn(),
    translate: jest.fn(),
    rotate: jest.fn(),
  };

  // Mock canvas
  const mockCanvas = {
    getContext: jest.fn().mockReturnValue(mockContext),
    toBuffer: jest.fn().mockReturnValue(Buffer.from('mock image buffer')),
    width: 800,
    height: 500,
  };

  return {
    createCanvas: jest.fn().mockReturnValue(mockCanvas),
    loadImage: jest.fn().mockResolvedValue({ width: 100, height: 100 }),
    Canvas: jest.fn(),
  };
});

describe('ChartGenerator', () => {
  let chartGenerator: ChartGenerator;
  let mockContext: vscode.ExtensionContext;
  
  // Sample chart configuration for testing
  const sampleBarChartConfig: ChartConfig = {
    type: 'bar',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        {
          label: 'Sales',
          data: [12, 19, 3, 5, 2],
        }
      ]
    },
    title: 'Monthly Sales',
    width: 800,
    height: 500
  };

  const sampleLineChartConfig: ChartConfig = {
    type: 'line',
    data: {
      labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May'],
      datasets: [
        {
          label: 'Revenue',
          data: [120, 190, 300, 500, 200],
          fill: true
        }
      ]
    },
    title: 'Monthly Revenue'
  };

  const samplePieChartConfig: ChartConfig = {
    type: 'pie',
    data: {
      labels: ['Product A', 'Product B', 'Product C'],
      datasets: [
        {
          label: 'Sales',
          data: [300, 150, 100]
        }
      ]
    },
    title: 'Product Sales Distribution'
  };

  const sampleDoughnutChartConfig: ChartConfig = {
    type: 'doughnut',
    data: {
      labels: ['Marketing', 'Development', 'Sales', 'Support'],
      datasets: [
        {
          label: 'Budget',
          data: [35, 45, 15, 5]
        }
      ]
    },
    title: 'Budget Allocation'
  };

  const sampleScatterChartConfig: ChartConfig = {
    type: 'scatter',
    data: {
      labels: ['Point 1', 'Point 2', 'Point 3', 'Point 4'],
      datasets: [
        {
          label: 'Dataset 1',
          data: [10, 20, 30, 40]
        }
      ]
    },
    title: 'Scatter Plot'
  };

  beforeEach(() => {
    // Clear all mocks
    jest.clearAllMocks();
    
    // Setup mock extension context
    mockContext = {
      extensionPath: '/test/extension/path',
      subscriptions: [],
    } as unknown as vscode.ExtensionContext;
    
    // Create instance
    chartGenerator = new ChartGenerator(mockContext);
  });

  describe('generateChart', () => {
    it('should generate a chart and return the file path', async () => {
      // Mock the file access check (ensureDirectoryExists method)
      (fs.promises.access as jest.Mock).mockRejectedValueOnce(new Error('Directory does not exist')).mockResolvedValueOnce(undefined);
      
      // Generate a bar chart
      const result = await chartGenerator.generateChart(sampleBarChartConfig);
      
      // Check that the chart was generated
      expect(result).toContain('/test/extension/path/resources/charts/chart_');
      expect(result).toContain('.png');
      
      // Verify that the directory creation was attempted
      expect(fs.promises.mkdir).toHaveBeenCalledWith(
        path.join('/test/extension/path', 'resources', 'charts'),
        { recursive: true }
      );
      
      // Verify that the file was written
      expect(fs.promises.writeFile).toHaveBeenCalled();
      
      // Verify canvas was created with correct dimensions
      expect(createCanvas).toHaveBeenCalledWith(800, 500);
    });
    
    it('should apply default colors to datasets', async () => {
      // Create a chart generator with spies
      const applyColorDefaultsSpy = jest.spyOn(chartGenerator as any, 'applyColorDefaults');
      
      await chartGenerator.generateChart(sampleBarChartConfig);
      
      // Verify the color defaults were applied
      expect(applyColorDefaultsSpy).toHaveBeenCalledWith(sampleBarChartConfig.data);
    });
    
    it('should handle errors gracefully', async () => {
      // Force an error by making canvas.toBuffer throw
      (createCanvas(800, 500).toBuffer as jest.Mock).mockImplementationOnce(() => {
        throw new Error('Mock canvas error');
      });
      
      // Expect the generateChart to throw with a meaningful error
      await expect(chartGenerator.generateChart(sampleBarChartConfig))
        .rejects.toThrow('Failed to generate chart: Mock canvas error');
    });
  });

  describe('Chart type rendering', () => {
    beforeEach(() => {
      // Mock successful directory check
      (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
    });
    
    it('should render bar charts correctly', async () => {
      // Spy on private method
      const drawBarChartSpy = jest.spyOn(chartGenerator as any, 'drawBarChart');
      
      await chartGenerator.generateChart(sampleBarChartConfig);
      
      // Verify the correct drawing method was called
      expect(drawBarChartSpy).toHaveBeenCalled();
      
      // Verify the canvas context was used appropriately for a bar chart
      const ctx = createCanvas(800, 500).getContext('2d');
      expect(ctx.fillRect).toHaveBeenCalled(); // For background
      expect(ctx.fillText).toHaveBeenCalled(); // For labels
    });
    
    it('should render line charts correctly', async () => {
      // Spy on private method
      const drawLineChartSpy = jest.spyOn(chartGenerator as any, 'drawLineChart');
      
      await chartGenerator.generateChart(sampleLineChartConfig);
      
      // Verify the correct drawing method was called
      expect(drawLineChartSpy).toHaveBeenCalled();
      
      // Verify the canvas context was used appropriately
      const ctx = createCanvas(800, 500).getContext('2d');
    });
    
    it('should render pie charts correctly', async () => {
      // Spy on private method
      const drawPieChartSpy = jest.spyOn(chartGenerator as any, 'drawPieChart');
      
      await chartGenerator.generateChart(samplePieChartConfig);
      
      // Verify the correct drawing method was called
      expect(drawPieChartSpy).toHaveBeenCalled();
      // Verify it was called with isDoughnut=false
      expect(drawPieChartSpy.mock.calls[0][4]).toBe(false);
    });
    
    it('should render doughnut charts correctly', async () => {
      // Spy on private method
      const drawPieChartSpy = jest.spyOn(chartGenerator as any, 'drawPieChart');
      
      await chartGenerator.generateChart(sampleDoughnutChartConfig);
      
      // Verify the correct drawing method was called
      expect(drawPieChartSpy).toHaveBeenCalled();
      // Verify it was called with isDoughnut=true
      expect(drawPieChartSpy.mock.calls[0][4]).toBe(true);
    });
    
    it('should render scatter charts correctly', async () => {
      // Spy on private method
      const drawScatterChartSpy = jest.spyOn(chartGenerator as any, 'drawScatterChart');
      
      await chartGenerator.generateChart(sampleScatterChartConfig);
      
      // Verify the correct drawing method was called
      expect(drawScatterChartSpy).toHaveBeenCalled();
    });
    
    it('should throw an error for unsupported chart types', async () => {
      // @ts-ignore - Deliberately using an unsupported type
      const invalidConfig: ChartConfig = {
        type: 'unsupported' as any,
        data: {
          labels: ['A', 'B'],
          datasets: [{ label: 'Test', data: [1, 2] }]
        }
      };
      
      await expect(chartGenerator.generateChart(invalidConfig))
        .rejects.toThrow('Failed to generate chart: Unsupported chart type: unsupported');
    });
  });

  describe('Utility methods', () => {
    it('should convert hex colors to RGBA format', () => {
      const convertToRGBA = (chartGenerator as any).convertToRGBA.bind(chartGenerator);
      
      // Test with a few colors
      expect(convertToRGBA('#FF0000', 0.5)).toBe('rgba(255, 0, 0, 0.5)');
      expect(convertToRGBA('#00FF00', 0.8)).toBe('rgba(0, 255, 0, 0.8)');
      expect(convertToRGBA('#0000FF', 0.3)).toBe('rgba(0, 0, 255, 0.3)');
      
      // Test with color without hash
      expect(convertToRGBA('FFFFFF', 1)).toBe('rgba(255, 255, 255, 1)');
    });
    
    it('should ensure a directory exists', async () => {
      const ensureDirectoryExists = (chartGenerator as any).ensureDirectoryExists.bind(chartGenerator);
      const testDir = '/test/dir';
      
      // Test when directory doesn't exist
      (fs.promises.access as jest.Mock).mockRejectedValueOnce(new Error('Dir not found'));
      await ensureDirectoryExists(testDir);
      expect(fs.promises.mkdir).toHaveBeenCalledWith(testDir, { recursive: true });
      
      // Test when directory exists
      jest.clearAllMocks();
      (fs.promises.access as jest.Mock).mockResolvedValueOnce(undefined);
      await ensureDirectoryExists(testDir);
      expect(fs.promises.mkdir).not.toHaveBeenCalled();
    });
  });

  describe('Drawing components', () => {
    it('should draw a legend for charts', () => {
      const drawLegend = (chartGenerator as any).drawLegend.bind(chartGenerator);
      const ctx = createCanvas(800, 500).getContext('2d');
      
      // Draw legend for a bar chart
      drawLegend(ctx, sampleBarChartConfig, 800, 500);
      
      // Verify legend drawing operations
      expect(ctx.fillStyle).toBe('black'); // Text color
      expect(ctx.fillText).toHaveBeenCalled(); // For legend labels
      expect(ctx.fillRect).toHaveBeenCalled(); // For legend color boxes
    });
    
    it('should skip legend for pie/doughnut charts', () => {
      const drawLegend = (chartGenerator as any).drawLegend.bind(chartGenerator);
      const ctx = createCanvas(800, 500).getContext('2d');
      
      // Clear mocks
      jest.clearAllMocks();
      
      // Draw legend for a pie chart
      drawLegend(ctx, samplePieChartConfig, 800, 500);
      
      // Verify no legend drawing operations were performed
      expect(ctx.fillText).not.toHaveBeenCalled();
      expect(ctx.fillRect).not.toHaveBeenCalled();
    });
  });
});
