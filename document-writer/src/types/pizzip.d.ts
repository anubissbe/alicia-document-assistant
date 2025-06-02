declare module 'pizzip' {
    interface PizZipOptions {
        base64?: boolean;
        checkCRC32?: boolean;
        optimizedBinaryString?: boolean;
        createFolders?: boolean;
        decodeFileName?: (filename: string) => string;
    }
    
    interface PizZipGenerateOptions {
        type: 'nodebuffer' | 'string' | 'base64' | 'array' | 'binarystring' | 'uint8array' | 'arraybuffer' | 'blob';
        compression?: 'STORE' | 'DEFLATE';
        compressionOptions?: {
            level: number;
        };
        comment?: string;
        mimeType?: string;
        platform?: 'DOS' | 'UNIX';
        encodeFileName?: (filename: string) => string;
    }
    
    interface PizZipObject {
        name: string;
        dir: boolean;
        date: Date;
        comment: string;
        unixPermissions: number;
        dosPermissions: number;
        options: PizZipOptions;
        
        async(type: string): Promise<any>;
        nodeStream(type: string): NodeJS.ReadableStream;
    }
    
    class PizZip {
        constructor(data?: string | ArrayBuffer | Uint8Array | Buffer, options?: PizZipOptions);
        
        file(name: string): PizZipObject | null;
        file(regex: RegExp): PizZipObject[];
        file(name: string, data: string | ArrayBuffer | Uint8Array | Buffer, options?: PizZipOptions): PizZip;
        
        folder(name: string): PizZip;
        folder(name: RegExp): Record<string, PizZipObject>;
        
        filter(predicate: (relativePath: string, file: PizZipObject) => boolean): PizZipObject[];
        
        remove(name: string): PizZip;
        
        generate(options: PizZipGenerateOptions): any;
        
        forEach(callback: (relativePath: string, file: PizZipObject) => void): void;
    }
    
    namespace PizZip {
        function loadAsync(data: string | ArrayBuffer | Uint8Array | Buffer, options?: PizZipOptions): Promise<PizZip>;
    }
    
    export default PizZip;
}
