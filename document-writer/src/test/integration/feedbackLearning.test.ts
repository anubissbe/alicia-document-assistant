import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { ContentSuggestionEngine, SuggestionFeedback } from '../../core/contentSuggestionEngine';
import { FeedbackLearningEngine } from '../../core/feedbackLearningEngine';

// Mock file system for test isolation
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    mkdirSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn()
}));

describe('Feedback Learning Integration', () => {
    let contentSuggestionEngine: ContentSuggestionEngine;
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
        
        // Create actual (non-mocked) instances of the engines
        feedbackLearningEngine = new FeedbackLearningEngine(mockContext);
        contentSuggestionEngine = new ContentSuggestionEngine(mockContext);
        
        // Replace the FeedbackLearningEngine in ContentSuggestionEngine with our instance
        (contentSuggestionEngine as any).feedbackLearningEngine = feedbackLearningEngine;
    });

    describe('Feedback-based Learning Flow', () => {
        it('should learn from user feedback and adjust future suggestions', () => {
            // Setup initial document
            const documentContent = 'This is a test document for a report. It contains some basic information about a project.';
            const documentType = 'report';
            
            // Mock the internal suggestion methods to return consistent results
            jest.spyOn<any, any>(contentSuggestionEngine, 'analyzeDocument').mockReturnValue({
                readabilityScore: 60,
                formalityLevel: 'neutral',
                toneAnalysis: [{ tone: 'professional', confidence: 0.8 }],
                keyTopics: ['test', 'document', 'report'],
                sentimentScore: 0.2,
                grammarIssues: [],
                contentFeatures: []
            });
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'generateContentSuggestions').mockReturnValue([
                'Add more details to the introduction section.',
                'Consider expanding on the key points with examples.'
            ]);
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'generateStyleSuggestions').mockReturnValue([
                'Use more formal language for a professional report.',
                'Consider varying sentence length for better readability.'
            ]);
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'generateStructureSuggestions').mockReturnValue([
                'Add clear section headings to organize content.',
                'Consider adding a summary section at the end.'
            ]);
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'findMatchingTemplates').mockReturnValue([]);
            
            // Use spies on key learning methods to track usage
            const getWeightsSpy = jest.spyOn(feedbackLearningEngine, 'getWeightsForDocumentType');
            const getStrengthSpy = jest.spyOn(feedbackLearningEngine, 'getSuggestionStrengthMultiplier');
            const recordFeedbackSpy = jest.spyOn(feedbackLearningEngine, 'recordFeedback');
            
            // Step 1: Generate initial suggestions
            const initialSuggestions = contentSuggestionEngine.generateSuggestions(documentContent, documentType);
            
            // Verify initial suggestion counts
            expect(initialSuggestions.contentSuggestions.length).toBe(2);
            expect(initialSuggestions.styleSuggestions.length).toBe(2);
            expect(initialSuggestions.structureSuggestions.length).toBe(2);
            
            // Verify learning engine methods were used
            expect(getWeightsSpy).toHaveBeenCalledWith(documentType);
            expect(getStrengthSpy).toHaveBeenCalled();
            
            // Step 2: Provide feedback (accept one, reject one)
            const positiveFeedback: SuggestionFeedback = {
                suggestion: initialSuggestions.contentSuggestions[0],
                accepted: true,
                documentType: documentType,
                context: 'content improvement'
            };
            
            const negativeFeedback: SuggestionFeedback = {
                suggestion: initialSuggestions.styleSuggestions[0],
                accepted: false,
                documentType: documentType,
                context: 'style improvement'
            };
            
            // Record feedback
            contentSuggestionEngine.recordFeedback(positiveFeedback);
            contentSuggestionEngine.recordFeedback(negativeFeedback);
            
            // Verify feedback was recorded
            expect(recordFeedbackSpy).toHaveBeenCalledTimes(2);
            expect(fs.writeFileSync).toHaveBeenCalled();
            
            // Check that weights were updated in the mock data
            expect(mockFeedbackData.suggestions.length).toBe(2);
            expect(mockFeedbackData.documentTypeWeights).toHaveProperty(documentType);
            
            // Mock the learning result for the second round
            // 'content' weight should increase (positive feedback)
            // 'style' weight should decrease (negative feedback)
            getWeightsSpy.mockReturnValue({
                'content': 1.05, // Increased
                'style': 0.95,   // Decreased
                'structure': 1.0,
                'visualization': 1.0,
                'grammar': 1.0,
                'template': 1.0
            });
            
            // Mock strength multipliers based on previous feedback
            getStrengthSpy.mockImplementation((type, suggestion, docType) => {
                // Similar to the content suggestion that was accepted
                if (type === 'content' && suggestion === initialSuggestions.contentSuggestions[0]) {
                    return 1.1; // Higher multiplier for previously accepted suggestion
                }
                // Similar to the style suggestion that was rejected
                if (type === 'style' && suggestion === initialSuggestions.styleSuggestions[0]) {
                    return 0.9; // Lower multiplier for previously rejected suggestion
                }
                return 1.0; // Default
            });
            
            // Step 3: Generate suggestions again, after learning
            const updatedSuggestions = contentSuggestionEngine.generateSuggestions(documentContent, documentType);
            
            // Step 4: Verify learning affected the suggestions
            // This would depend on the actual implementation of applyLearningToSuggestions
            // But we can spy on that method to see what it received and returned
            
            const applyLearningSpy = jest.spyOn<any, any>(contentSuggestionEngine, 'applyLearningToSuggestions');
            
            // Call the method directly to verify its behavior with our mock data
            const rawSuggestions = {
                contentSuggestions: initialSuggestions.contentSuggestions,
                styleSuggestions: initialSuggestions.styleSuggestions,
                structureSuggestions: initialSuggestions.structureSuggestions,
                visualizationSuggestions: [],
                grammarSuggestions: [],
                templateSuggestions: []
            };
            
            const learnedSuggestions = (contentSuggestionEngine as any).applyLearningToSuggestions(
                rawSuggestions,
                documentType
            );
            
            // Verify the learning-based filtering logic works correctly
            // Content (positive feedback) should preserve more suggestions
            // Style (negative feedback) should filter more suggestions
            expect(learnedSuggestions.contentSuggestions.length).toBeGreaterThanOrEqual(
                learnedSuggestions.styleSuggestions.length
            );
            
            // Content suggestions should contain the previously accepted suggestion
            expect(learnedSuggestions.contentSuggestions).toContain(initialSuggestions.contentSuggestions[0]);
        });
    });
    
    describe('Persistence of Learning', () => {
        it('should persist learning data between sessions', () => {
            // Setup document data
            const documentType = 'report';
            
            // Manually set up feedback data to simulate previous learning
            mockFeedbackData = {
                suggestions: [
                    {
                        suggestion: 'Add more details to the introduction section.',
                        accepted: true,
                        documentType: documentType,
                        context: 'content improvement'
                    },
                    {
                        suggestion: 'Use more formal language for a professional report.',
                        accepted: false,
                        documentType: documentType,
                        context: 'style improvement'
                    }
                ],
                documentTypeWeights: {
                    [documentType]: {
                        'content': 1.05,
                        'style': 0.95,
                        'structure': 1.0,
                        'visualization': 1.0,
                        'grammar': 1.0,
                        'template': 1.0
                    }
                },
                lastUpdated: new Date().toISOString()
            };
            
            // Re-create instances to simulate a new session
            const newFeedbackLearningEngine = new FeedbackLearningEngine(mockContext);
            const newContentSuggestionEngine = new ContentSuggestionEngine(mockContext);
            (newContentSuggestionEngine as any).feedbackLearningEngine = newFeedbackLearningEngine;
            
            // Get weights for the document type
            const weights = newFeedbackLearningEngine.getWeightsForDocumentType(documentType);
            
            // Verify weights reflect previous learning
            expect(weights.content).toBe(1.05);
            expect(weights.style).toBe(0.95);
            
            // Get suggestion priorities
            const priorities = newFeedbackLearningEngine.getSuggestionPriorities(documentType);
            
            // Verify content is prioritized over style after learning
            expect(priorities.indexOf('content')).toBeLessThan(priorities.indexOf('style'));
            
            // Get strength multiplier for a previously accepted suggestion
            const contentMultiplier = newFeedbackLearningEngine.getSuggestionStrengthMultiplier(
                'content',
                'Add more details to the introduction section.',
                documentType
            );
            
            // Get strength multiplier for a previously rejected suggestion
            const styleMultiplier = newFeedbackLearningEngine.getSuggestionStrengthMultiplier(
                'style',
                'Use more formal language for a professional report.',
                documentType
            );
            
            // Verify multipliers reflect previous feedback
            expect(contentMultiplier).toBeGreaterThan(styleMultiplier);
        });
    });
});
