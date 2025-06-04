import type { CanvasRenderingContext2D } from 'canvas';

declare module 'chart.js' {
    type ChartType = 'bar' | 'line' | 'pie' | 'doughnut' | 'radar';
    type DefaultDataPoint<T extends ChartType> = number[];
    
    interface ChartConfiguration<TType extends ChartType = ChartType, TData = DefaultDataPoint<TType>, TLabel = unknown> {
        type: TType;
        data: any;
        options?: any;
    }

    // Extend Canvas to be compatible with Chart.js
    interface Canvas {
        getContext(contextId: '2d'): CanvasRenderingContext2D;
    }

    export class Chart<
        TType extends ChartType = ChartType,
        TData = DefaultDataPoint<TType>,
        TLabel = unknown
    > {
        constructor(canvas: Canvas | CanvasRenderingContext2D, config: ChartConfiguration<TType, TData, TLabel>);
        toBase64Image(): string;
        resize(width?: number, height?: number): void;
        update(mode?: 'resize' | 'reset' | 'none' | 'hide' | 'show' | 'normal' | undefined): void;

        static register(...items: any[]): void;
    }

    export const registerables: any[];
}
