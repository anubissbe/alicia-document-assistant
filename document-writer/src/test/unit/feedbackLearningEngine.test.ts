import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { FeedbackLearningEngine } from '../../core/feedbackLearningEngine';
import { SuggestionFeedback } from '../../core/contentSuggestionEngine';

// Mock file system for test isolation
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
}));

describe('FeedbackLearningEngine', () => {
    let feedbackLearningEngine: FeedbackLearningEngine;
    let mockContext: vscode.ExtensionContext;
    let mockFeedbackDataPath: string;
    let mockFeedbackData: any;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create mock context
        mockContext = {
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
        
        // Set up mock feedback data path
        mockFeedbackDataPath = path.join(mockContext.globalStoragePath, 'suggestion-feedback.json');
        
        // Create initial feedback data
        mockFeedbackData = {
            suggestions: [],
            documentTypeWeights: {},
            lastUpdated: new Date().toISOString()
        };
        
        // Mock file system behavior
        (fs.existsSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === mockFeedbackDataPath) {
                return true; // Feedback data file exists
            }
            if (filePath === path.dirname(mockFeedbackDataPath)) {
                return true; // Directory exists
            }
            return false;
        });
        
        (fs.readFileSync as jest.Mock).mockImplementation((filePath: string) => {
            if (filePath === mockFeedbackDataPath) {
                return JSON.stringify(mockFeedbackData);
            }
            throw new Error(`Unexpected file read: ${filePath}`);
        });
        
        (fs.writeFileSync as jest.Mock).mockImplementation((filePath: string, data: string) => {
            if (filePath === mockFeedbackDataPath) {
                mockFeedbackData = JSON.parse(data);
            }
        });
        
        // Create instance of FeedbackLearningEngine
        feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
    });

    describe('constructor', () => {
        it('should initialize feedback data from storage if it exists', () => {
            // Set up mock data
            const existingData = {
                suggestions: [
                    { suggestion: 'Test suggestion', accepted: true, documentType: 'report', context: 'test' }
                ],
                documentTypeWeights: {
                    report: { content: 1.05, style: 0.95 }
                },
                lastUpdated: new Date().toISOString()
            };
            
            (fs.readFileSync as jest.Mock).mockReturnValueOnce(JSON.stringify(existingData));
            
            // Create new instance
            const engine = new FeedbackLearningEngine(mockContext);
            
            // Verify data was loaded
            expect(fs.readFileSync).toHaveBeenCalledWith(mockFeedbackDataPath, 'utf8');
            
            // Verify weights are loaded correctly
            expect(engine.getWeightsForDocumentType('report')).toEqual({
                content: 1.05,
                style: 0.95,
                structure: 1.0,  // Default value for non-specified weight
                visualization: 1.0,
                grammar: 1.0,
                template: 1.0
            });
        });

        it('should initialize with default feedback data if storage file does not exist', () => {
            // Mock file does not exist
            (fs.existsSync as jest.Mock).mockReturnValueOnce(false);
            
            // Create new instance
            const engine = new FeedbackLearningEngine(mockContext);
            
            // Verify default weights
            const weights = engine.getWeightsForDocumentType('report');
            expect(weights).toEqual({
                content: 1.0,
                style: 1.0,
                structure: 1.0,
                visualization: 1.0,
                grammar: 1.0,
                template: 1.0
            });
        });

        it('should handle errors during file loading', () => {
            // Mock file read error
            (fs.readFileSync as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Mock file read error');
            });
            
            // Spy on console.error
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            
            // Create new instance
            const engine = new FeedbackLearningEngine(mockContext);
            
            // Verify error was logged
            expect(consoleSpy).toHaveBeenCalled();
            
            // Verify default weights
            const weights = engine.getWeightsForDocumentType('report');
            expect(weights).toEqual({
                content: 1.0,
                style: 1.0,
                structure: 1.0,
                visualization: 1.0,
                grammar: 1.0,
                template: 1.0
            });
            
            // Restore console.error
            consoleSpy.mockRestore();
        });
    });

    describe('recordFeedback', () => {
        it('should add feedback to collection and update weights', () => {
            // Create feedback
            const feedback: SuggestionFeedback = {
                suggestion: 'Add more details to introduction',
                accepted: true,
                documentType: 'report',
                context: 'content improvement'
            };
            
            // Record feedback
            feedbackLearningEngine.recordFeedback(feedback);
            
            // Verify feedback was added
            expect(mockFeedbackData.suggestions).toContainEqual(feedback);
            
            // Verify weights were updated
            expect(mockFeedbackData.documentTypeWeights).toHaveProperty('report');
            expect(mockFeedbackData.documentTypeWeights.report).toHaveProperty('content');
            
            // Verify file was saved
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockFeedbackDataPath,
                expect.any(String),
                'utf8'
            );
        });

        it('should initialize weights for a new document type', () => {
            // Create feedback for a new document type
            const feedback: SuggestionFeedback = {
                suggestion: 'Use more formal language',
                accepted: false,
                documentType: 'proposal',
                context: 'style improvement'
            };
            
            // Record feedback
            feedbackLearningEngine.recordFeedback(feedback);
            
            // Verify weights were initialized for new document type
            expect(mockFeedbackData.documentTypeWeights).toHaveProperty('proposal');
            expect(mockFeedbackData.documentTypeWeights.proposal).toEqual(expect.objectContaining({
                content: 1.0,
                style: expect.any(Number),  // Should be adjusted based on feedback
                structure: 1.0,
                visualization: 1.0,
                grammar: 1.0,
                template: 1.0
            }));
        });

        it('should increase weight for accepted suggestions', () => {
            // Set up initial weights
            mockFeedbackData.documentTypeWeights = {
                report: {
                    content: 1.0,
                    style: 1.0,
                    structure: 1.0,
                    visualization: 1.0,
                    grammar: 1.0,
                    template: 1.0
                }
            };
            
            // Create feedback with an accepted content suggestion
            const feedback: SuggestionFeedback = {
                suggestion: 'Add more content details to the document',
                accepted: true,
                documentType: 'report',
                context: 'content improvement'
            };
            
            // Record feedback
            feedbackLearningEngine.recordFeedback(feedback);
            
            // Verify content weight increased
            expect(mockFeedbackData.documentTypeWeights.report.content).toBeGreaterThan(1.0);
        });

        it('should decrease weight for rejected suggestions', () => {
            // Set up initial weights
            mockFeedbackData.documentTypeWeights = {
                report: {
                    content: 1.0,
                    style: 1.0,
                    structure: 1.0,
                    visualization: 1.0,
                    grammar: 1.0,
                    template: 1.0
                }
            };
            
            // Create feedback with a rejected style suggestion
            const feedback: SuggestionFeedback = {
                suggestion: 'Use more formal language in the report',
                accepted: false,
                documentType: 'report',
                context: 'style improvement'
            };
            
            // Record feedback
            feedbackLearningEngine.recordFeedback(feedback);
            
            // Verify style weight decreased
            expect(mockFeedbackData.documentTypeWeights.report.style).toBeLessThan(1.0);
        });

        it('should handle errors during file saving', () => {
            // Mock file write error
            (fs.writeFileSync as jest.Mock).mockImplementationOnce(() => {
                throw new Error('Mock file write error');
            });
            
            // Spy on console.error and window.showErrorMessage
            const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
            const showErrorSpy = jest.spyOn(vscode.window, 'showErrorMessage').mockImplementation();
            
            // Create feedback
            const feedback: SuggestionFeedback = {
                suggestion: 'Test suggestion',
                accepted: true,
                documentType: 'report',
                context: 'test'
            };
            
            // Record feedback
            feedbackLearningEngine.recordFeedback(feedback);
            
            // Verify error was logged
            expect(consoleSpy).toHaveBeenCalled();
            expect(showErrorSpy).toHaveBeenCalled();
            
            // Restore mocks
            consoleSpy.mockRestore();
            showErrorSpy.mockRestore();
        });
    });

    describe('getWeightsForDocumentType', () => {
        it('should return existing weights for a document type', () => {
            // Set up weights
            mockFeedbackData.documentTypeWeights = {
                report: {
                    content: 1.2,
                    style: 0.8,
                    structure: 1.1,
                    visualization: 0.9,
                    grammar: 1.0,
                    template: 1.0
                }
            };
            
            // Re-create instance to load mock data
            feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            
            // Get weights
            const weights = feedbackLearningEngine.getWeightsForDocumentType('report');
            
            // Verify weights
            expect(weights).toEqual({
                content: 1.2,
                style: 0.8,
                structure: 1.1,
                visualization: 0.9,
                grammar: 1.0,
                template: 1.0
            });
        });

        it('should return default weights for a new document type', () => {
            // Get weights for a new document type
            const weights = feedbackLearningEngine.getWeightsForDocumentType('newType');
            
            // Verify default weights
            expect(weights).toEqual({
                content: 1.0,
                style: 1.0,
                structure: 1.0,
                visualization: 1.0,
                grammar: 1.0,
                template: 1.0
            });
        });
    });

    describe('getSuggestionStrengthMultiplier', () => {
        it('should return neutral multiplier if no related feedback exists', () => {
            // Get multiplier for a suggestion with no history
            const multiplier = feedbackLearningEngine.getSuggestionStrengthMultiplier(
                'content',
                'New suggestion with no history',
                'report'
            );
            
            // Verify neutral multiplier
            expect(multiplier).toBe(1.0);
        });

        it('should return higher multiplier for suggestions similar to previously accepted ones', () => {
            // Add feedback history
            mockFeedbackData.suggestions = [
                {
                    suggestion: 'Add more details to introduction section',
                    accepted: true,
                    documentType: 'report',
                    context: 'content improvement'
                },
                {
                    suggestion: 'Consider adding examples to the introduction',
                    accepted: true,
                    documentType: 'report',
                    context: 'content improvement'
                }
            ];
            
            // Re-create instance to load mock data
            feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            
            // Get multiplier for a similar suggestion
            const multiplier = feedbackLearningEngine.getSuggestionStrengthMultiplier(
                'content',
                'Add more introduction details with examples',
                'report'
            );
            
            // Verify multiplier is higher than neutral
            expect(multiplier).toBeGreaterThan(1.0);
        });

        it('should return lower multiplier for suggestions similar to previously rejected ones', () => {
            // Add feedback history
            mockFeedbackData.suggestions = [
                {
                    suggestion: 'Use more formal language',
                    accepted: false,
                    documentType: 'report',
                    context: 'style improvement'
                },
                {
                    suggestion: 'Make language more formal and professional',
                    accepted: false,
                    documentType: 'report',
                    context: 'style improvement'
                }
            ];
            
            // Re-create instance to load mock data
            feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            
            // Get multiplier for a similar suggestion
            const multiplier = feedbackLearningEngine.getSuggestionStrengthMultiplier(
                'style',
                'Consider using more formal language in this document',
                'report'
            );
            
            // Verify multiplier is lower than neutral
            expect(multiplier).toBeLessThan(1.0);
        });

        it('should consider only feedback for the specified document type', () => {
            // Add feedback history for different document types
            mockFeedbackData.suggestions = [
                {
                    suggestion: 'Add more details to introduction',
                    accepted: true,
                    documentType: 'report',
                    context: 'content improvement'
                },
                {
                    suggestion: 'Add more details to introduction',
                    accepted: false,
                    documentType: 'proposal',
                    context: 'content improvement'
                }
            ];
            
            // Re-create instance to load mock data
            feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            
            // Get multiplier for report
            const reportMultiplier = feedbackLearningEngine.getSuggestionStrengthMultiplier(
                'content',
                'Add more details to introduction section',
                'report'
            );
            
            // Get multiplier for proposal
            const proposalMultiplier = feedbackLearningEngine.getSuggestionStrengthMultiplier(
                'content',
                'Add more details to introduction section',
                'proposal'
            );
            
            // Verify multipliers reflect different feedback
            expect(reportMultiplier).toBeGreaterThan(1.0);
            expect(proposalMultiplier).toBeLessThan(1.0);
        });
    });

    describe('getSuggestionPriorities', () => {
        it('should return suggestion types sorted by weight', () => {
            // Set up weights with different values
            mockFeedbackData.documentTypeWeights = {
                report: {
                    content: 1.2,
                    style: 0.8,
                    structure: 1.1,
                    visualization: 0.9,
                    grammar: 0.7,
                    template: 1.0
                }
            };
            
            // Re-create instance to load mock data
            feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            
            // Get priorities
            const priorities = feedbackLearningEngine.getSuggestionPriorities('report');
            
            // Verify order based on weights
            expect(priorities[0]).toBe('content');     // Highest weight
            expect(priorities[1]).toBe('structure');   // Second highest
            expect(priorities[priorities.length - 1]).toBe('grammar'); // Lowest weight
        });

        it('should return default priorities for a new document type', () => {
            // Get priorities for a new document type
            const priorities = feedbackLearningEngine.getSuggestionPriorities('newType');
            
            // All weights are 1.0, so order is arbitrary but should include all types
            expect(priorities).toContain('content');
            expect(priorities).toContain('style');
            expect(priorities).toContain('structure');
            expect(priorities).toContain('visualization');
            expect(priorities).toContain('grammar');
            expect(priorities).toContain('template');
            expect(priorities.length).toBe(6);
        });
    });

    describe('resetLearningData', () => {
        it('should reset all feedback and learning data', () => {
            // Set up existing data
            mockFeedbackData = {
                suggestions: [
                    { suggestion: 'Test suggestion', accepted: true, documentType: 'report', context: 'test' }
                ],
                documentTypeWeights: {
                    report: { content: 1.2, style: 0.8 }
                },
                lastUpdated: '2023-01-01T00:00:00.000Z'
            };
            
            // Re-create instance to load mock data
            feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            
            // Reset data
            feedbackLearningEngine.resetLearningData();
            
            // Verify data was reset
            expect(mockFeedbackData.suggestions).toEqual([]);
            expect(mockFeedbackData.documentTypeWeights).toEqual({});
            expect(mockFeedbackData.lastUpdated).not.toBe('2023-01-01T00:00:00.000Z');
            
            // Verify file was saved
            expect(fs.writeFileSync).toHaveBeenCalledWith(
                mockFeedbackDataPath,
                expect.any(String),
                'utf8'
            );
        });
    });

    describe('determineSuggestionType', () => {
        // Test the private method using any type cast
        it('should determine suggestion type based on keywords', () => {
            // Test content suggestion
            const contentType = (feedbackLearningEngine as any).determineSuggestionType(
                'Add more detailed information about the project background'
            );
            expect(contentType).toBe('content');
            
            // Test style suggestion
            const styleType = (feedbackLearningEngine as any).determineSuggestionType(
                'Use more formal tone and academic phrasing in this document'
            );
            expect(styleType).toBe('style');
            
            // Test structure suggestion
            const structureType = (feedbackLearningEngine as any).determineSuggestionType(
                'Add clear section headings to improve document structure'
            );
            expect(structureType).toBe('structure');
            
            // Test visualization suggestion
            const visualType = (feedbackLearningEngine as any).determineSuggestionType(
                'Consider adding a chart to visualize the data'
            );
            expect(visualType).toBe('visualization');
            
            // Test grammar suggestion
            const grammarType = (feedbackLearningEngine as any).determineSuggestionType(
                'Fix grammar issues in the third paragraph'
            );
            expect(grammarType).toBe('grammar');
            
            // Test template suggestion
            const templateType = (feedbackLearningEngine as any).determineSuggestionType(
                'Use a different template format for this document type'
            );
            expect(templateType).toBe('template');
        });

        it('should return null if suggestion type cannot be determined', () => {
            const unknownType = (feedbackLearningEngine as any).determineSuggestionType(
                'XYZ ABC 123'
            );
            expect(unknownType).toBeNull();
        });
    });

    describe('isSimilarSuggestion', () => {
        // Test the private method using any type cast
        it('should identify similar suggestions based on key words', () => {
            // Test similar suggestions
            const similar1 = (feedbackLearningEngine as any).isSimilarSuggestion(
                'Add more details to the introduction section',
                'Consider adding additional details to your introduction'
            );
            expect(similar1).toBe(true);
            
            const similar2 = (feedbackLearningEngine as any).isSimilarSuggestion(
                'Use more formal language in your document',
                'Consider using formal language for this type of document'
            );
            expect(similar2).toBe(true);
        });

        it('should identify different suggestions', () => {
            const different1 = (feedbackLearningEngine as any).isSimilarSuggestion(
                'Add more details to the introduction section',
                'Fix grammar issues in the conclusion'
            );
            expect(different1).toBe(false);
            
            const different2 = (feedbackLearningEngine as any).isSimilarSuggestion(
                'Add a chart to visualize the data',
                'Use consistent formatting throughout the document'
            );
            expect(different2).toBe(false);
        });
        
        it('should handle short words and edge cases', () => {
            // Short words should be filtered out in similarity check
            const shortWords = (feedbackLearningEngine as any).isSimilarSuggestion(
                'The is a to for', 
                'The is a to for but with different meaning'
            );
            expect(shortWords).toBe(false);
            
            // Empty strings
            const emptyStrings = (feedbackLearningEngine as any).isSimilarSuggestion('', '');
            expect(emptyStrings).toBe(false);
        });
    });
});
