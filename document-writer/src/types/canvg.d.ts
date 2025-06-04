declare module 'canvg' {
    import type { CanvasRenderingContext2D } from 'canvas';
    
    export class Canvg {
        static from(ctx: any, svg: string): Promise<Canvg>;
        toString(): string;
    }
}
