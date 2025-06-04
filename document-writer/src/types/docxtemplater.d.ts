declare module 'docxtemplater' {
    export interface DocxtemplaterOptions {
        paragraphLoop?: boolean;
        linebreaks?: boolean;
        delimiters?: {
            start: string;
            end: string;
        };
        nullGetter?: (part: any) => string;
        parser?: (tag: string) => any;
        modules?: any[];
    }

    class Docxtemplater {
        constructor(zip: any, options?: DocxtemplaterOptions);
        setData(data: Record<string, any>): void;
        render(): void;
        getZip(): any;
    }

    export default Docxtemplater;
}
