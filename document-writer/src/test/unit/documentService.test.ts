import * as vscode from 'vscode';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as fsPromises from 'node:fs/promises';
import { DocumentService, Document, DocumentMetadata } from '../../services/documentService.js';

// Silence console.error during tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});
afterAll(() => {
    console.error = originalConsoleError;
});

// Mock dependencies
jest.mock('vscode');

// Mock fs and fs.promises
const mockFsPromises = {
    stat: jest.fn(),
    readFile: jest.fn(),
    writeFile: jest.fn(),
    mkdir: jest.fn(),
    readdir: jest.fn(),
    unlink: jest.fn(),
    rename: jest.fn(),
    access: jest.fn()
};

jest.mock('node:fs', () => {
    const actualFs = jest.requireActual('node:fs');
    return {
        ...actualFs,
        constants: {
            R_OK: 4,
            W_OK: 2
        },
        Stats: actualFs.Stats,
        promises: mockFsPromises,
        createReadStream: jest.fn(),
        createWriteStream: jest.fn(),
        readFile: jest.fn(),
        writeFile: jest.fn(),
        access: jest.fn(),
        existsSync: jest.fn()
    };
});

jest.mock('node:fs/promises', () => mockFsPromises);

// Error constructor with code property
class FileSystemError extends Error {
    code: string;
    constructor(code: string, message: string) {
        super(message);
        this.code = code;
    }
}

describe('DocumentService', () => {
    let documentService: DocumentService;
    
    // Sample document for testing
    const sampleDocument: Document = {
        path: '/test/documents/test-doc.txt',
        title: 'Test Document',
        type: 'txt',
        content: 'This is a test document',
        dateCreated: new Date('2025-06-04T10:00:00Z'),
        dateModified: new Date('2025-06-04T10:00:00Z'),
        author: 'Test User',
        tags: ['test'],
        properties: {
            version: '1.0'
        }
    };
    
    beforeEach(() => {
        // Create DocumentService instance
        documentService = new DocumentService();
        
        // Reset all mocks
        jest.clearAllMocks();
        (console.error as jest.Mock).mockClear();
        
        // Mock fs.promises methods with successful defaults
        mockFsPromises.stat.mockResolvedValue({
            birthtime: new Date('2025-06-04T10:00:00Z'),
            mtime: new Date('2025-06-04T10:00:00Z'),
            isDirectory: () => false
        });
        mockFsPromises.readFile.mockResolvedValue('This is a test document');
        mockFsPromises.writeFile.mockResolvedValue(undefined);
        mockFsPromises.mkdir.mockResolvedValue(undefined);
        mockFsPromises.readdir.mockResolvedValue(['test-doc.txt']);
        mockFsPromises.unlink.mockResolvedValue(undefined);
        mockFsPromises.rename.mockResolvedValue(undefined);
        mockFsPromises.access.mockResolvedValue(undefined);
    });
    
    describe('getDocument', () => {
        test('should get a document by path', async () => {
            const document = await documentService.getDocument('/test/documents/test-doc.txt');
            
            expect(fs.promises.stat).toHaveBeenCalled();
            expect(fs.promises.readFile).toHaveBeenCalled();
            expect(document).toEqual(expect.objectContaining({
                path: '/test/documents/test-doc.txt',
                content: 'This is a test document'
            }));
        });
        
        test('should return cached document if available', async () => {
            // First call to cache the document
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            // Reset mocks
            (fs.promises.stat as jest.Mock).mockClear();
            (fs.promises.readFile as jest.Mock).mockClear();
            
            // Second call should use cache
            const document = await documentService.getDocument('/test/documents/test-doc.txt');
            
            expect(fs.promises.stat).not.toHaveBeenCalled();
            expect(fs.promises.readFile).not.toHaveBeenCalled();
            expect(document).toEqual(expect.objectContaining({
                path: '/test/documents/test-doc.txt',
                content: 'This is a test document'
            }));
        });
        
        test('should throw error if document path is invalid', async () => {
            await expect(documentService.getDocument('')).rejects.toThrow('Invalid document path');
        });

        test('should throw error if document does not exist', async () => {
            (fs.promises.access as jest.Mock).mockRejectedValue(
                new FileSystemError('ENOENT', 'File not found')
            );
            
            await expect(documentService.getDocument('/test/documents/nonexistent.txt'))
                .rejects.toThrow('Document not found');
            
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Error getting document'),
                expect.any(Error)
            );
        });

        test('should throw error if access is denied', async () => {
            (fs.promises.access as jest.Mock).mockRejectedValue(
                new FileSystemError('EACCES', 'Permission denied')
            );
            
            await expect(documentService.getDocument('/test/documents/protected.txt'))
                .rejects.toThrow('Access denied');
            
            expect(console.error).toHaveBeenCalledWith(
                expect.stringContaining('Error getting document'),
                expect.any(Error)
            );
        });
    });
    
    describe('saveDocument', () => {
        test('should throw error if document is invalid', async () => {
            await expect(documentService.saveDocument({} as Document))
                .rejects.toThrow('Invalid document path');
        });

        test('should save a document with write access', async () => {
            const savedDoc = await documentService.saveDocument(sampleDocument);
            
            expect(fs.promises.access).toHaveBeenCalledWith(
                path.dirname(sampleDocument.path),
                fs.constants.W_OK
            );
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                sampleDocument.path,
                sampleDocument.content,
                'utf-8'
            );
            expect(savedDoc).toEqual(expect.objectContaining({
                path: sampleDocument.path,
                content: sampleDocument.content
            }));
        });

        test('should create directory if it does not exist', async () => {
            (fs.promises.access as jest.Mock).mockRejectedValue(
                new FileSystemError('ENOENT', 'Directory not found')
            );
            
            const savedDoc = await documentService.saveDocument(sampleDocument);
            
            expect(fs.promises.mkdir).toHaveBeenCalledWith(
                path.dirname(sampleDocument.path),
                { recursive: true }
            );
            expect(savedDoc).toEqual(expect.objectContaining({
                path: sampleDocument.path,
                content: sampleDocument.content
            }));
        });
        
        test('should throw error if write fails', async () => {
            (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));
            
            await expect(documentService.saveDocument(sampleDocument))
                .rejects.toThrow('Failed to save document');
        });
    });
    
    describe('deleteDocument', () => {
        test('should delete a document', async () => {
            const result = await documentService.deleteDocument('/test/documents/test-doc.txt');
            
            expect(fs.promises.stat).toHaveBeenCalled();
            expect(fs.promises.unlink).toHaveBeenCalled();
            expect(result).toBe(true);
        });
        
        test('should throw error if document does not exist', async () => {
            (fs.promises.stat as jest.Mock).mockRejectedValue(new Error('File not found'));
            
            await expect(documentService.deleteDocument('/test/documents/nonexistent.txt'))
                .rejects.toThrow('Failed to delete document');
        });
    });
    
    describe('getDocumentsInDirectory', () => {
        test('should throw error if directory path is invalid', async () => {
            await expect(documentService.getDocumentsInDirectory('')).rejects.toThrow('Invalid document path');
        });

        test('should throw error if directory does not exist', async () => {
            (fs.promises.stat as jest.Mock).mockRejectedValue(
                new FileSystemError('ENOENT', 'Directory not found')
            );
            
            await expect(documentService.getDocumentsInDirectory('/nonexistent'))
                .rejects.toThrow('Directory not found');
        });

        test('should throw error if path is not a directory', async () => {
            (fs.promises.stat as jest.Mock).mockResolvedValue({
                isDirectory: () => false,
                birthtime: new Date(),
                mtime: new Date()
            });
            
            await expect(documentService.getDocumentsInDirectory('/test/file.txt'))
                .rejects.toThrow('Invalid document path');
        });

        test('should throw error if access is denied', async () => {
            // Mock stat to return directory
            (fs.promises.stat as jest.Mock).mockResolvedValue({
                isDirectory: () => true,
                birthtime: new Date(),
                mtime: new Date()
            });
            
            // Mock access to throw permission denied
            (fs.promises.access as jest.Mock).mockRejectedValue(
                new FileSystemError('EACCES', 'Permission denied')
            );
            
            await expect(documentService.getDocumentsInDirectory('/protected'))
                .rejects.toThrow('Access denied');
        });

        test('should list all documents in a directory', async () => {
            // Mock stat for directory check
            (fs.promises.stat as jest.Mock).mockImplementation((path) => {
                return Promise.resolve({
                    isDirectory: () => path === '/test/documents',
                    birthtime: new Date(),
                    mtime: new Date()
                });
            });
            
            // Mock access to succeed
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            
            // Mock readdir to return test files
            (fs.promises.readdir as jest.Mock).mockResolvedValue(['test-doc.txt']);
            
            const documents = await documentService.getDocumentsInDirectory('/test/documents');
            
            expect(fs.promises.readdir).toHaveBeenCalled();
            expect(fs.promises.stat).toHaveBeenCalled();
            expect(documents).toHaveLength(1);
            expect(documents[0]).toEqual(expect.objectContaining({
                path: expect.stringContaining('test-doc.txt'),
                type: 'txt'
            }));
        });
        
        test('should handle empty directories', async () => {
            (fs.promises.stat as jest.Mock).mockResolvedValue({
                isDirectory: () => true,
                birthtime: new Date(),
                mtime: new Date()
            });
            (fs.promises.readdir as jest.Mock).mockResolvedValue([]);
            
            const documents = await documentService.getDocumentsInDirectory('/test/documents');
            
            expect(documents).toHaveLength(0);
        });
    });
    
    describe('searchDocuments', () => {
        test('should find documents matching search query', async () => {
            // Mock directory listing
            (fs.promises.stat as jest.Mock).mockImplementation((path) => {
                return Promise.resolve({
                    isDirectory: () => path === '/test/documents',
                    birthtime: new Date(),
                    mtime: new Date()
                });
            });
            
            // Mock access to succeed
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            
            // Mock readdir to return test files
            (fs.promises.readdir as jest.Mock).mockResolvedValue(['test-doc.txt']);
            
            // Mock readFile to return content
            (fs.promises.readFile as jest.Mock).mockResolvedValue('test content');
            
            const results = await documentService.searchDocuments('test', '/test/documents');
            
            expect(fs.promises.readdir).toHaveBeenCalled();
            expect(fs.promises.stat).toHaveBeenCalled();
            expect(fs.promises.readFile).toHaveBeenCalled();
            expect(results).toHaveLength(1);
            expect(results[0]).toEqual(expect.objectContaining({
                path: expect.stringContaining('test-doc.txt')
            }));
        });
        
        test('should return empty array for no matches', async () => {
            // Mock directory listing
            (fs.promises.stat as jest.Mock).mockImplementation((path) => {
                return Promise.resolve({
                    isDirectory: () => path === '/test/documents',
                    birthtime: new Date(),
                    mtime: new Date()
                });
            });
            
            // Mock access to succeed
            (fs.promises.access as jest.Mock).mockResolvedValue(undefined);
            
            // Mock readdir to return test files
            (fs.promises.readdir as jest.Mock).mockResolvedValue(['test-doc.txt']);
            
            // Mock readFile to return content that won't match
            (fs.promises.readFile as jest.Mock).mockResolvedValue('other content');
            
            const results = await documentService.searchDocuments('nonexistent', '/test/documents');
            
            expect(results).toHaveLength(0);
        });
    });

    describe('getDocumentMetadata', () => {
        test('should get metadata from cache if available', async () => {
            // First call to cache the document
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            // Reset mocks
            (fs.promises.stat as jest.Mock).mockClear();
            
            // Get metadata
            const metadata = await documentService.getDocumentMetadata('/test/documents/test-doc.txt');
            
            expect(fs.promises.stat).not.toHaveBeenCalled();
            expect(metadata).toEqual(expect.objectContaining({
                path: '/test/documents/test-doc.txt',
                title: 'test-doc',
                type: 'txt'
            }));
        });

        test('should get metadata from file system if not cached', async () => {
            const metadata = await documentService.getDocumentMetadata('/test/documents/test-doc.txt');
            
            expect(fs.promises.stat).toHaveBeenCalled();
            expect(metadata).toEqual(expect.objectContaining({
                path: '/test/documents/test-doc.txt',
                title: 'test-doc',
                type: 'txt'
            }));
        });

        test('should handle errors gracefully', async () => {
            (fs.promises.stat as jest.Mock).mockRejectedValue(new Error('Failed to get stats'));
            
            await expect(documentService.getDocumentMetadata('/test/documents/error.txt'))
                .rejects.toThrow('Failed to get document metadata');
        });
    });

    describe('createDocument', () => {
        test('should create a new document', async () => {
            const title = 'new-doc';
            const type = 'txt';
            const directoryPath = '/test/documents';
            const content = 'New document content';

            const document = await documentService.createDocument(title, type, directoryPath, content);

            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('new-doc.txt'),
                content,
                'utf-8'
            );
            expect(document).toEqual(expect.objectContaining({
                title,
                type,
                content,
                path: expect.stringContaining('new-doc.txt')
            }));
        });

        test('should handle type with leading dot', async () => {
            const document = await documentService.createDocument('new-doc', '.txt', '/test/documents');

            expect(document.type).toBe('txt');
            expect(document.path).toEqual(expect.stringContaining('new-doc.txt'));
        });

        test('should create document with empty content if not provided', async () => {
            const document = await documentService.createDocument('new-doc', 'txt', '/test/documents');

            expect(document.content).toBe('');
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('new-doc.txt'),
                '',
                'utf-8'
            );
        });

        test('should handle errors during creation', async () => {
            (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Write failed'));

            await expect(documentService.createDocument('error-doc', 'txt', '/test/documents'))
                .rejects.toThrow('Failed to create document');
        });
    });

    describe('renameDocument', () => {
        test('should rename a document', async () => {
            // Setup document in cache
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            const newTitle = 'renamed-doc';
            const document = await documentService.renameDocument('/test/documents/test-doc.txt', newTitle);
            
            expect(fs.promises.rename).toHaveBeenCalledWith(
                '/test/documents/test-doc.txt',
                expect.stringContaining('renamed-doc.txt')
            );
            expect(document).toEqual(expect.objectContaining({
                title: newTitle,
                path: expect.stringContaining('renamed-doc.txt')
            }));
        });

        test('should update cache after renaming', async () => {
            // Setup document in cache
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            const newTitle = 'renamed-doc';
            const newPath = '/test/documents/renamed-doc.txt';
            
            // Mock readFile for the new path
            (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
                if (path === newPath) {
                    return Promise.resolve('This is a test document');
                }
                return Promise.reject(new Error('File not found'));
            });
            
            // Mock access for the new path
            (fs.promises.access as jest.Mock).mockImplementation((path) => {
                if (path === newPath) {
                    return Promise.resolve();
                }
                return Promise.reject(new FileSystemError('ENOENT', 'File not found'));
            });
            
            await documentService.renameDocument('/test/documents/test-doc.txt', newTitle);
            
            // Try to get document with old path
            await expect(documentService.getDocument('/test/documents/test-doc.txt'))
                .rejects.toThrow('Document not found');
            
            // Document should be accessible with new path
            const document = await documentService.getDocument(newPath);
            expect(document.title).toBe(newTitle);
            expect(document.path).toBe(newPath);
        });

        test('should handle rename errors', async () => {
            (fs.promises.rename as jest.Mock).mockRejectedValue(new Error('Rename failed'));
            
            await expect(documentService.renameDocument('/test/documents/test-doc.txt', 'new-name'))
                .rejects.toThrow('Failed to rename document');
        });

        test('should preserve file extension', async () => {
            const document = await documentService.renameDocument('/test/documents/test-doc.txt', 'new-name');
            
            expect(document.type).toBe('txt');
            expect(document.path).toEqual(expect.stringContaining('new-name.txt'));
        });
    });

    describe('exportDocument', () => {
        test('should export document to specified format', async () => {
            const outputPath = '/test/documents/exported-doc.md';
            const exportedPath = await documentService.exportDocument(sampleDocument, 'md', outputPath);
            
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                outputPath,
                sampleDocument.content,
                'utf-8'
            );
            expect(exportedPath).toBe(outputPath);
        });

        test('should generate output path if not provided', async () => {
            const exportedPath = await documentService.exportDocument(sampleDocument, 'md');
            
            expect(exportedPath).toEqual(expect.stringContaining('test-doc.md'));
            expect(fs.promises.writeFile).toHaveBeenCalledWith(
                expect.stringContaining('test-doc.md'),
                sampleDocument.content,
                'utf-8'
            );
        });

        test('should handle export errors', async () => {
            (fs.promises.writeFile as jest.Mock).mockRejectedValue(new Error('Export failed'));
            
            await expect(documentService.exportDocument(sampleDocument, 'md'))
                .rejects.toThrow('Failed to export document');
        });
    });

    describe('updateDocumentMetadata', () => {
        test('should update document metadata', async () => {
            const metadata: Partial<DocumentMetadata> = {
                title: 'Updated Title',
                author: 'New Author',
                tags: ['new-tag']
            };
            
            const updatedMetadata = await documentService.updateDocumentMetadata('/test/documents/test-doc.txt', metadata);
            
            expect(updatedMetadata).toEqual(expect.objectContaining({
                title: 'Updated Title',
                author: 'New Author',
                tags: ['new-tag']
            }));
        });

        test('should handle path updates', async () => {
            // Setup initial document
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            const newPath = '/test/documents/moved-doc.txt';
            const metadata: Partial<DocumentMetadata> = {
                path: newPath
            };
            
            // Mock readFile for the new path
            (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
                if (path === newPath) {
                    return Promise.resolve('This is a test document');
                }
                return Promise.reject(new Error('File not found'));
            });
            
            const updatedMetadata = await documentService.updateDocumentMetadata('/test/documents/test-doc.txt', metadata);
            
            expect(fs.promises.rename).toHaveBeenCalledWith(
                '/test/documents/test-doc.txt',
                newPath
            );
            expect(updatedMetadata.path).toBe(newPath);
        });

        test('should update cache when path changes', async () => {
            // Setup document in cache
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            const newPath = '/test/documents/moved-doc.txt';
            
            // Mock readFile for the new path
            (fs.promises.readFile as jest.Mock).mockImplementation((path) => {
                if (path === newPath) {
                    return Promise.resolve('This is a test document');
                }
                return Promise.reject(new FileSystemError('ENOENT', 'File not found'));
            });
            
            // Mock access for the new path
            (fs.promises.access as jest.Mock).mockImplementation((path) => {
                if (path === newPath) {
                    return Promise.resolve();
                }
                return Promise.reject(new FileSystemError('ENOENT', 'File not found'));
            });
            
            await documentService.updateDocumentMetadata('/test/documents/test-doc.txt', { path: newPath });
            
            // Try to get document with old path
            await expect(documentService.getDocument('/test/documents/test-doc.txt'))
                .rejects.toThrow('Document not found');
            
            // Document should be accessible with new path
            const document = await documentService.getDocument(newPath);
            expect(document.path).toBe(newPath);
        });

        test('should handle update errors', async () => {
            // Setup initial document
            await documentService.getDocument('/test/documents/test-doc.txt');
            
            // Mock rename to fail
            (fs.promises.rename as jest.Mock).mockRejectedValue(new Error('Update failed'));
            
            await expect(documentService.updateDocumentMetadata('/test/documents/test-doc.txt', { path: 'new-path' }))
                .rejects.toThrow('Failed to update document metadata');
        });
    });
});
