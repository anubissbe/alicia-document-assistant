import * as vscode from 'vscode';
import { ContentSuggestionEngine, SuggestionOptions, ContentSuggestion } from '../../core/contentSuggestionEngine.js';
import { EntityExtractor } from '../../core/entityExtractor.js';

// Silence console.error during tests
const originalConsoleError = console.error;
beforeAll(() => {
    console.error = jest.fn();
});
afterAll(() => {
    console.error = originalConsoleError;
});

// Mock EntityExtractor with shared mock implementation
const mockExtractEntities = jest.fn().mockResolvedValue(new Map([
    ['names', 'John Doe'],
    ['dates', '2025-06-04']
]));

const mockExtractKeywords = jest.fn().mockResolvedValue([
    'project', 'management', 'development'
]);

const mockExtractSentiment = jest.fn().mockResolvedValue('positive');

const mockEntityExtractorInstance = {
    extractEntities: mockExtractEntities,
    extractKeywords: mockExtractKeywords,
    extractSentiment: mockExtractSentiment
};

jest.mock('../../core/entityExtractor.js', () => ({
    EntityExtractor: jest.fn().mockImplementation(() => mockEntityExtractorInstance)
}));

// Mock VS Code extension context
const mockContext = {
    globalStoragePath: '/mock/path',
    subscriptions: [],
    workspaceState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([])
    },
    globalState: {
        get: jest.fn(),
        update: jest.fn(),
        keys: jest.fn().mockReturnValue([]),
        setKeysForSync: jest.fn()
    },
    extensionPath: '/mock/extension/path',
    asAbsolutePath: (relativePath: string) => `/mock/extension/path/${relativePath}`,
    extensionUri: {} as vscode.Uri,
    extensionMode: vscode.ExtensionMode.Development,
    logUri: {} as vscode.Uri,
    logPath: '/mock/log/path',
    storageUri: {} as vscode.Uri,
    globalStorageUri: {} as vscode.Uri,
    storagePath: '/mock/storage/path',
    secrets: {
        store: jest.fn(),
        get: jest.fn(),
        delete: jest.fn(),
        onDidChange: { event: jest.fn(), dispose: jest.fn() }
    }
} as unknown as vscode.ExtensionContext;

describe('ContentSuggestionEngine', () => {
    let contentSuggestionEngine: ContentSuggestionEngine;
    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();
        (console.error as jest.Mock).mockClear();
        
        // Reset EntityExtractor mock methods
        mockExtractEntities.mockClear();
        mockExtractKeywords.mockClear();
        mockExtractSentiment.mockClear();
        
        // Create instance of ContentSuggestionEngine
        contentSuggestionEngine = new ContentSuggestionEngine();
    });

    afterEach(() => {
        // Verify all mocks were called as expected
        expect(mockExtractEntities).toHaveBeenCalled();
        expect(mockExtractKeywords).toHaveBeenCalled();
        expect(mockExtractSentiment).toHaveBeenCalled();
    });

    describe('constructor', () => {
        it('should initialize with default properties', () => {
            // Create a new instance to test constructor
            const engine = new ContentSuggestionEngine();
            
            // Verify EntityExtractor is created
            expect((engine as any).entityExtractor).toBeInstanceOf(EntityExtractor);
            
            // Verify default options
            expect((engine as any).defaultOptions).toEqual({
                maxSuggestions: 5,
                minConfidence: 0.7,
                tone: 'formal',
                purpose: 'inform'
            });
        });
    });

    describe('suggestContent', () => {
        it('should generate suggestions based on document type', async () => {
            const result = await contentSuggestionEngine.suggestContent('Write a report about project progress', {
                documentType: 'report'
            });
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Executive Summary',
                category: 'structure',
                confidence: expect.any(Number),
                metadata: expect.objectContaining({
                    relevance: expect.any(Number)
                })
            }));
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Methodology',
                category: 'structure',
                confidence: expect.any(Number),
                metadata: expect.objectContaining({
                    relevance: expect.any(Number)
                })
            }));
        });

        it('should generate suggestions based on purpose', async () => {
            const result = await contentSuggestionEngine.suggestContent('Analyze the market trends', {
                purpose: 'analyze'
            });
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Data Analysis',
                category: 'content'
            }));
        });

        it('should generate suggestions based on tone', async () => {
            const result = await contentSuggestionEngine.suggestContent('Write a formal business proposal', {
                tone: 'formal'
            });
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Professional Introduction',
                category: 'tone'
            }));
        });

        it('should respect maxSuggestions option', async () => {
            const result = await contentSuggestionEngine.suggestContent('Write a report', {
                documentType: 'report',
                maxSuggestions: 1
            });
            
            expect(result.length).toBe(1);
        });

        it('should filter by minConfidence', async () => {
            const result = await contentSuggestionEngine.suggestContent('Write a proposal', {
                documentType: 'proposal',
                minConfidence: 0.9
            });
            
            result.forEach(suggestion => {
                expect(suggestion.confidence).toBeGreaterThanOrEqual(0.9);
            });
        });

        describe('invalid options handling', () => {
            const invalidOptionsTests = [
                {
                    name: 'maxSuggestions',
                    options: { maxSuggestions: 0 },
                    expectedError: 'maxSuggestions must be greater than 0'
                },
                {
                    name: 'minConfidence',
                    options: { minConfidence: 1.5 },
                    expectedError: 'minConfidence must be between 0 and 1'
                },
                {
                    name: 'tone',
                    options: { tone: 'invalid' as any },
                    expectedError: 'Invalid tone'
                },
                {
                    name: 'purpose',
                    options: { purpose: 'invalid' as any },
                    expectedError: 'Invalid purpose'
                }
            ];

            test.each(invalidOptionsTests)(
                'should throw error for invalid $name',
                async ({ options, expectedError }) => {
                    await expect(contentSuggestionEngine.suggestContent('test', options))
                        .rejects.toThrow(expectedError);
                    
                    expect(console.error).toHaveBeenCalledWith(
                        expect.stringContaining('Invalid options:'),
                        expect.any(Error)
                    );
                }
            );
        });
    });

    describe('generateDocumentTypeSuggestions', () => {
        it('should generate suggestions for reports', async () => {
            const entities = new Map([['names', 'John Doe']]);
            const result = await (contentSuggestionEngine as any).generateDocumentTypeSuggestions('report', entities, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Executive Summary',
                category: 'structure'
            }));
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Methodology',
                category: 'structure'
            }));
        });

        it('should generate suggestions for letters', async () => {
            const entities = new Map([['names', 'John Doe']]);
            const result = await (contentSuggestionEngine as any).generateDocumentTypeSuggestions('letter', entities, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Dear John Doe,',
                category: 'greeting'
            }));
        });

        it('should generate suggestions for proposals', async () => {
            const entities = new Map();
            const result = await (contentSuggestionEngine as any).generateDocumentTypeSuggestions('proposal', entities, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Project Scope',
                category: 'structure'
            }));
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Timeline and Deliverables',
                category: 'structure'
            }));
        });

        it('should generate suggestions for memos', async () => {
            const entities = new Map();
            const result = await (contentSuggestionEngine as any).generateDocumentTypeSuggestions('memo', entities, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Key Points Summary',
                category: 'structure'
            }));
        });
    });

    describe('generatePurposeSuggestions', () => {
        it('should generate suggestions for inform purpose', async () => {
            const keywords = ['project', 'status'];
            const result = await (contentSuggestionEngine as any).generatePurposeSuggestions('inform', keywords, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Background Information',
                category: 'content'
            }));
        });

        it('should generate suggestions for persuade purpose', async () => {
            const keywords = ['proposal', 'benefits'];
            const result = await (contentSuggestionEngine as any).generatePurposeSuggestions('persuade', keywords, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Supporting Evidence',
                category: 'content'
            }));
        });

        it('should generate suggestions for describe purpose', async () => {
            const keywords = ['features', 'specifications'];
            const result = await (contentSuggestionEngine as any).generatePurposeSuggestions('describe', keywords, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Detailed Specifications',
                category: 'content'
            }));
        });

        it('should generate suggestions for analyze purpose', async () => {
            const keywords = ['data', 'trends'];
            const result = await (contentSuggestionEngine as any).generatePurposeSuggestions('analyze', keywords, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Data Analysis',
                category: 'content'
            }));
        });
    });

    describe('generateToneSuggestions', () => {
        it('should generate suggestions for formal tone', async () => {
            const result = await (contentSuggestionEngine as any).generateToneSuggestions('formal', 'positive', {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Professional Introduction',
                category: 'tone'
            }));
        });

        it('should generate suggestions for informal tone', async () => {
            const result = await (contentSuggestionEngine as any).generateToneSuggestions('informal', 'positive', {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Casual Opening',
                category: 'tone'
            }));
        });

        it('should generate suggestions for technical tone', async () => {
            const result = await (contentSuggestionEngine as any).generateToneSuggestions('technical', 'neutral', {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Technical Specifications',
                category: 'tone'
            }));
        });

        it('should generate suggestions for friendly tone', async () => {
            const result = await (contentSuggestionEngine as any).generateToneSuggestions('friendly', 'positive', {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Personal Anecdote',
                category: 'tone'
            }));
        });
    });

    describe('filterAndRankSuggestions', () => {
        it('should filter suggestions by confidence threshold', async () => {
            const suggestions = [
                { text: 'High', confidence: 0.9, category: 'test', metadata: { relevance: 0.8 } },
                { text: 'Low', confidence: 0.6, category: 'test', metadata: { relevance: 0.7 } },
                { text: 'Medium', confidence: 0.8, category: 'test', metadata: { relevance: 0.9 } }
            ];

            const result = await (contentSuggestionEngine as any).filterAndRankSuggestions(
                suggestions,
                { minConfidence: 0.8 }
            );

            expect(result).toHaveLength(2);
            expect(result[0].text).toBe('High');
            expect(result[1].text).toBe('Medium');
        });

        it('should rank suggestions by combined confidence and relevance', async () => {
            const suggestions = [
                { text: 'First', confidence: 0.9, category: 'test', metadata: { relevance: 0.9 } },
                { text: 'Second', confidence: 0.8, category: 'test', metadata: { relevance: 0.8 } },
                { text: 'Third', confidence: 0.7, category: 'test', metadata: { relevance: 0.7 } }
            ];

            const result = await (contentSuggestionEngine as any).filterAndRankSuggestions(
                suggestions,
                { minConfidence: 0.6 }
            );

            expect(result).toHaveLength(3);
            expect(result[0].text).toBe('First');
            expect(result[1].text).toBe('Second');
            expect(result[2].text).toBe('Third');
        });

        it('should limit suggestions to maxSuggestions', async () => {
            const suggestions = [
                { text: 'One', confidence: 0.9, category: 'test', metadata: { relevance: 0.9 } },
                { text: 'Two', confidence: 0.8, category: 'test', metadata: { relevance: 0.8 } },
                { text: 'Three', confidence: 0.7, category: 'test', metadata: { relevance: 0.7 } }
            ];

            const result = await (contentSuggestionEngine as any).filterAndRankSuggestions(
                suggestions,
                { maxSuggestions: 2, minConfidence: 0.6 }
            );

            expect(result).toHaveLength(2);
            expect(result[0].text).toBe('One');
            expect(result[1].text).toBe('Two');
        });
    });

    describe('generateContextSuggestions', () => {
        it('should generate suggestions for previous context', async () => {
            const keywords = ['previous', 'communication'];
            const result = await (contentSuggestionEngine as any).generateContextSuggestions('previous', keywords, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Reference to Previous Communication',
                category: 'context'
            }));
        });

        it('should generate suggestions for follow-up context', async () => {
            const keywords = ['follow', 'up', 'next'];
            const result = await (contentSuggestionEngine as any).generateContextSuggestions('follow', keywords, {});
            
            expect(result).toContainEqual(expect.objectContaining({
                text: 'Follow-up Actions',
                category: 'context'
            }));
        });
    });
});
