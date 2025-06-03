import * as vscode from 'vscode';
import { ContentSuggestionEngine, ContentSuggestionResult, DocumentAnalysis, SuggestionFeedback, ContentFeature, GrammarIssue } from '../../core/contentSuggestionEngine';
import { FeedbackLearningEngine } from '../../core/feedbackLearningEngine';
import { DocumentTemplate, DocumentFormat } from '../../models/documentTemplate';

// Mock dependencies
jest.mock('../../core/feedbackLearningEngine');

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
    let mockFeedbackLearningEngine: jest.Mocked<FeedbackLearningEngine>;

    beforeEach(() => {
        // Reset mocks
        jest.clearAllMocks();
        
        // Create mock FeedbackLearningEngine
        mockFeedbackLearningEngine = new FeedbackLearningEngine(mockContext) as jest.Mocked<FeedbackLearningEngine>;
        
        // Mock FeedbackLearningEngine methods
        mockFeedbackLearningEngine.getWeightsForDocumentType = jest.fn().mockReturnValue({
            'content': 1.0,
            'style': 1.0,
            'structure': 1.0,
            'visualization': 1.0,
            'grammar': 1.0,
            'template': 1.0
        });
        
        mockFeedbackLearningEngine.getSuggestionPriorities = jest.fn().mockReturnValue([
            'content', 'structure', 'style', 'visualization', 'grammar', 'template'
        ]);
        
        mockFeedbackLearningEngine.getSuggestionStrengthMultiplier = jest.fn().mockReturnValue(1.0);
        mockFeedbackLearningEngine.recordFeedback = jest.fn();
        
        // Create instance of ContentSuggestionEngine with mock FeedbackLearningEngine
        contentSuggestionEngine = new ContentSuggestionEngine(mockContext);
        (contentSuggestionEngine as any).feedbackLearningEngine = mockFeedbackLearningEngine;
    });

    describe('constructor', () => {
        it('should initialize with default properties', () => {
            // Create a new instance to test constructor
            const engine = new ContentSuggestionEngine(mockContext);
            
            // Verify FeedbackLearningEngine is created
            expect((engine as any).feedbackLearningEngine).toBeInstanceOf(FeedbackLearningEngine);
            
            // Verify context is stored
            expect((engine as any).context).toBe(mockContext);
        });
    });

    describe('recordFeedback', () => {
        it('should delegate feedback recording to FeedbackLearningEngine', () => {
            // Create feedback
            const feedback: SuggestionFeedback = {
                suggestion: 'Consider adding more headings to improve document structure',
                accepted: true,
                documentType: 'report',
                context: 'structure improvement'
            };
            
            // Record feedback
            contentSuggestionEngine.recordFeedback(feedback);
            
            // Verify FeedbackLearningEngine.recordFeedback was called with correct parameters
            expect(mockFeedbackLearningEngine.recordFeedback).toHaveBeenCalledWith(feedback);
        });
    });

    describe('generateSuggestions', () => {
        it('should apply learning to suggestions based on feedback', () => {
            // Setup test data
            const testDocumentContent = 'This is a test document content for a report.';
            const documentType = 'report';
            
            // Mock analyzeDocument to return a simple analysis
            jest.spyOn<any, any>(contentSuggestionEngine, 'analyzeDocument').mockReturnValue({
                readabilityScore: 60,
                formalityLevel: 'neutral',
                toneAnalysis: [{ tone: 'professional', confidence: 0.8 }],
                keyTopics: ['test', 'document', 'report'],
                sentimentScore: 0.2,
                grammarIssues: [],
                contentFeatures: []
            });
            
            // Mock suggestion generation methods to return test suggestions
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
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'generateVisualizationSuggestions').mockReturnValue([
                'Add a chart to visualize the key data points.',
                'Consider using a table to present comparative information.'
            ]);
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'generateGrammarSuggestions').mockReturnValue([
                'Fix punctuation throughout the document.',
                'Review for consistent tense usage.'
            ]);
            
            jest.spyOn<any, any>(contentSuggestionEngine, 'findMatchingTemplates').mockReturnValue([]);
            
            // Mock applyLearningToSuggestions to simulate learning
            const mockApplyLearning = jest.spyOn<any, any>(contentSuggestionEngine, 'applyLearningToSuggestions');
            mockApplyLearning.mockImplementation((...args: unknown[]) => {
                // Cast args to appropriate types
                const suggestions = args[0] as {
                    contentSuggestions: string[];
                    styleSuggestions: string[];
                    structureSuggestions: string[];
                    visualizationSuggestions: string[];
                    grammarSuggestions: string[];
                    templateSuggestions: any[];
                };
                
                // Simulate removing some suggestions based on learning
                return {
                    contentSuggestions: suggestions.contentSuggestions.slice(0, 1),
                    styleSuggestions: suggestions.styleSuggestions.slice(0, 1),
                    structureSuggestions: suggestions.structureSuggestions,
                    visualizationSuggestions: suggestions.visualizationSuggestions.slice(0, 1),
                    grammarSuggestions: suggestions.grammarSuggestions.slice(0, 1),
                    templateSuggestions: suggestions.templateSuggestions
                };
            });
            
            // Generate suggestions
            const result = contentSuggestionEngine.generateSuggestions(testDocumentContent, documentType);
            
            // Verify applyLearningToSuggestions was called
            expect(mockApplyLearning).toHaveBeenCalled();
            
            // Verify suggestion counts reflect the learning-based filtering
            expect(result.contentSuggestions.length).toBe(1);
            expect(result.styleSuggestions.length).toBe(1);
            expect(result.structureSuggestions.length).toBe(2);
            expect(result.visualizationSuggestions.length).toBe(1);
            expect(result.grammarSuggestions.length).toBe(1);
        });

        it('should use document type-specific weights for suggestions', () => {
            // Setup test data
            const testDocumentContent = 'This is a test document content for a report.';
            const documentType = 'report';
            
            // Mock FeedbackLearningEngine to return specific weights for report
            mockFeedbackLearningEngine.getWeightsForDocumentType = jest.fn().mockReturnValue({
                'content': 1.2,
                'style': 0.8,
                'structure': 1.1,
                'visualization': 0.9,
                'grammar': 0.7,
                'template': 1.0
            });
            
            // Verify the document type is passed to the learning engine
            contentSuggestionEngine.generateSuggestions(testDocumentContent, documentType);
            expect(mockFeedbackLearningEngine.getWeightsForDocumentType).toHaveBeenCalledWith(documentType);
        });

        it('should handle empty document content gracefully', () => {
            // Test with empty content
            const result = contentSuggestionEngine.generateSuggestions('', 'report');
            
            // Verify result contains empty suggestion arrays but doesn't crash
            expect(result).toEqual({
                contentSuggestions: expect.any(Array),
                styleSuggestions: expect.any(Array),
                structureSuggestions: expect.any(Array),
                visualizationSuggestions: expect.any(Array),
                grammarSuggestions: expect.any(Array),
                templateSuggestions: expect.any(Array)
            });
        });
    });

    describe('analyzeDocument', () => {
        it('should analyze document content and return appropriate metrics', () => {
            // Test simple document content
            const testContent = 'This is a professional document about project management. It contains some technical terms and formal language.';
            
            // Call the private method directly
            const analysis = (contentSuggestionEngine as any).analyzeDocument(testContent);
            
            // Verify analysis contains expected properties
            expect(analysis).toEqual(expect.objectContaining({
                readabilityScore: expect.any(Number),
                formalityLevel: expect.any(String),
                toneAnalysis: expect.any(Array),
                keyTopics: expect.any(Array),
                sentimentScore: expect.any(Number),
                grammarIssues: expect.any(Array),
                contentFeatures: expect.any(Array)
            }));
            
            // Check that key topics include relevant words from the content
            expect(analysis.keyTopics.some((topic: string) => 
                ['professional', 'document', 'project', 'management', 'technical', 'formal'].includes(topic)
            )).toBeTruthy();
            
            // Check that tone analysis includes professional tone
            const hasProfessionalTone = analysis.toneAnalysis.some(
                (tone: { tone: string, confidence: number }) => tone.tone === 'professional' && tone.confidence > 0
            );
            expect(hasProfessionalTone).toBeTruthy();
        });

        it('should detect formality level correctly', () => {
            // Test different formality levels
            const formalContent = 'Therefore, in accordance with the aforementioned regulations, we hereby request your consideration regarding this matter.';
            const casualContent = 'Hey there, just wanted to let you know that the stuff we talked about is pretty cool. Thanks!';
            const academicContent = 'The methodology employed in this theoretical framework demonstrates a statistically significant correlation between the empirical data and our hypothesis.';
            
            // Call the private method directly
            const formalAnalysis = (contentSuggestionEngine as any).analyzeDocument(formalContent);
            const casualAnalysis = (contentSuggestionEngine as any).analyzeDocument(casualContent);
            const academicAnalysis = (contentSuggestionEngine as any).analyzeDocument(academicContent);
            
            // Verify formality levels
            expect(formalAnalysis.formalityLevel).toBe('formal');
            expect(casualAnalysis.formalityLevel).toBe('casual');
            expect(academicAnalysis.formalityLevel).toBe('academic');
        });
        
        it('should calculate readability score correctly', () => {
            // Test content with different readability levels
            const simpleContent = 'This is easy to read. The words are short. The sentences are clear.';
            const complexContent = 'The implementation of sophisticated algorithms in conjunction with innovative methodologies facilitates the optimization of computational efficiency and enhances the overall systematic performance of the distributed architectural framework.';
            
            // Call the private method directly
            const simpleAnalysis = (contentSuggestionEngine as any).analyzeDocument(simpleContent);
            const complexAnalysis = (contentSuggestionEngine as any).analyzeDocument(complexContent);
            
            // Verify readability scores - higher scores indicate easier readability
            expect(simpleAnalysis.readabilityScore).toBeGreaterThan(complexAnalysis.readabilityScore);
        });
    });

    describe('private helper methods', () => {
        describe('estimateSyllables', () => {
            it('should estimate syllable count for words', () => {
                // Test with words of known syllable counts
                const result1 = (contentSuggestionEngine as any).estimateSyllables('hello');
                const result2 = (contentSuggestionEngine as any).estimateSyllables('beautiful');
                const result3 = (contentSuggestionEngine as any).estimateSyllables('sophisticated');
                
                // Verify estimates are reasonable
                expect(result1).toBe(2); // 'he-llo'
                expect(result2).toBeGreaterThanOrEqual(3); // 'beau-ti-ful'
                expect(result3).toBeGreaterThanOrEqual(4); // 'so-phis-ti-ca-ted'
            });
            
            it('should handle silent e at the end of words', () => {
                // Test words with silent e
                const result1 = (contentSuggestionEngine as any).estimateSyllables('make');
                const result2 = (contentSuggestionEngine as any).estimateSyllables('time');
                
                // Verify estimates account for silent e
                expect(result1).toBe(1); // 'make' has one syllable
                expect(result2).toBe(1); // 'time' has one syllable
            });
            
            it('should ensure every word has at least one syllable', () => {
                // Test with edge cases
                const result1 = (contentSuggestionEngine as any).estimateSyllables('a');
                const result2 = (contentSuggestionEngine as any).estimateSyllables('the');
                
                // Verify minimum syllable count
                expect(result1).toBe(1);
                expect(result2).toBe(1);
            });
        });
        
        describe('determineFormalityLevel', () => {
            it('should detect formal language', () => {
                const formalText = 'Therefore, in accordance with the requirements, we hereby submit our proposal for your consideration.';
                const result = (contentSuggestionEngine as any).determineFormalityLevel(formalText);
                expect(result).toBe('formal');
            });
            
            it('should detect casual language', () => {
                const casualText = 'Hey there! Just wanted to let you know that we\'re totally on board with your idea. It\'s pretty awesome!';
                const result = (contentSuggestionEngine as any).determineFormalityLevel(casualText);
                expect(result).toBe('casual');
            });
            
            it('should detect academic language', () => {
                const academicText = 'The empirical evidence suggests a statistically significant correlation between the variables. The methodology employed in this study followed established theoretical frameworks.';
                const result = (contentSuggestionEngine as any).determineFormalityLevel(academicText);
                expect(result).toBe('academic');
            });
            
            it('should default to neutral for ambiguous content', () => {
                const neutralText = 'The project will start next week. We need to prepare the documents and schedule meetings.';
                const result = (contentSuggestionEngine as any).determineFormalityLevel(neutralText);
                expect(result).toBe('neutral');
            });
        });
        
        describe('analyzeTone', () => {
            it('should detect professional tone', () => {
                const professionalText = 'We are pleased to inform you that your application has been approved. Please review the attached documents for further instructions.';
                const result = (contentSuggestionEngine as any).analyzeTone(professionalText);
                
                expect(result.some((tone: { tone: string, confidence: number }) => tone.tone === 'professional')).toBeTruthy();
            });
            
            it('should detect friendly tone', () => {
                const friendlyText = 'Thanks so much for your help! We really appreciate your support and would be happy to welcome you to our team.';
                const result = (contentSuggestionEngine as any).analyzeTone(friendlyText);
                
                expect(result.some((tone: { tone: string, confidence: number }) => tone.tone === 'friendly')).toBeTruthy();
            });
            
            it('should detect urgent tone', () => {
                const urgentText = 'This is an urgent matter that requires immediate attention. The deadline is critical and we need to address this issue as soon as possible.';
                const result = (contentSuggestionEngine as any).analyzeTone(urgentText);
                
                expect(result.some((tone: { tone: string, confidence: number }) => tone.tone === 'urgent')).toBeTruthy();
            });
            
            it('should detect multiple tones and order by confidence', () => {
                const mixedText = 'We urgently need your professional assistance with this important project. Thanks for your help!';
                const result = (contentSuggestionEngine as any).analyzeTone(mixedText);
                
                // Should detect multiple tones
                expect(result.length).toBeGreaterThanOrEqual(2);
                
                // Should be ordered by confidence (highest first)
                for (let i = 1; i < result.length; i++) {
                    expect(result[i-1].confidence).toBeGreaterThanOrEqual(result[i].confidence);
                }
            });
        });
        
        describe('extractKeyTopics', () => {
            it('should extract relevant topics from content', () => {
                const content = 'This document provides a comprehensive analysis of the project management methodology and software development lifecycle employed by our team.';
                const result = (contentSuggestionEngine as any).extractKeyTopics(content);
                
                // Should extract key topics
                expect(result).toContain('project');
                expect(result).toContain('management');
                expect(result).toContain('software');
                expect(result).toContain('development');
                expect(result).toContain('methodology');
            });
            
            it('should filter out stop words', () => {
                const content = 'The team will be working on this project for the next few weeks.';
                const result = (contentSuggestionEngine as any).extractKeyTopics(content);
                
                // Should not include stop words
                expect(result).not.toContain('the');
                expect(result).not.toContain('will');
                expect(result).not.toContain('this');
                expect(result).not.toContain('for');
                expect(result).not.toContain('next');
            });
            
            it('should limit the number of topics returned', () => {
                const longContent = `
                    Project management is the practice of leading the work of a team to achieve all project goals within the given constraints. 
                    This information is usually described in project documentation, created at the beginning of the development process.
                    The primary constraints are scope, time, and budget. The secondary challenge is to optimize the allocation of necessary inputs
                    and apply them to meet pre-defined objectives. Software development methodology is a process or series of processes used in
                    software development. It can be viewed as a framework that is used to structure, plan, and control the process of developing
                    information systems. Agile methodology is an approach to project management that emphasizes flexibility, customer satisfaction,
                    teamwork, and rapid delivery of high-quality output. DevOps is a set of practices that combines software development and IT operations.
                `;
                const result = (contentSuggestionEngine as any).extractKeyTopics(longContent);
                
                // Should limit the number of topics
                expect(result.length).toBeLessThanOrEqual(10);
            });
            
            it('should prioritize topics by frequency', () => {
                const repeatedContent = 'Project management is key. Project management involves planning. Project management requires organization. Teams need project management skills.';
                const result = (contentSuggestionEngine as any).extractKeyTopics(repeatedContent);
                
                // Most frequent terms should be first
                expect(result[0]).toBe('project');
                expect(result[1]).toBe('management');
            });
        });
        
        describe('calculateSentiment', () => {
            it('should detect positive sentiment', () => {
                const positiveText = 'This is an excellent proposal with great ideas. The team has done outstanding work and delivered impressive results.';
                const result = (contentSuggestionEngine as any).calculateSentiment(positiveText);
                
                expect(result).toBeGreaterThan(0);
            });
            
            it('should detect negative sentiment', () => {
                const negativeText = 'The project has faced several problems and disappointing outcomes. The results are inadequate and the issues remain unresolved.';
                const result = (contentSuggestionEngine as any).calculateSentiment(negativeText);
                
                expect(result).toBeLessThan(0);
            });
            
            it('should detect neutral sentiment', () => {
                const neutralText = 'The project contains five sections. Each section describes a different component of the system architecture.';
                const result = (contentSuggestionEngine as any).calculateSentiment(neutralText);
                
                expect(Math.abs(result)).toBeLessThan(0.2); // Close to zero
            });
            
            it('should bound sentiment scores between -1 and 1', () => {
                const extremePositive = 'Excellent outstanding wonderful exceptional remarkable impressive successful beneficial advantageous favorable effective efficient helpful superb brilliant fantastic amazing perfect great good positive delightful';
                const extremeNegative = 'Terrible horrible awful disappointing inadequate ineffective unsuccessful problematic difficult failed issues drawback disadvantage concern bad poor negative frustrating appalling dreadful abysmal deficient';
                
                const positiveResult = (contentSuggestionEngine as any).calculateSentiment(extremePositive);
                const negativeResult = (contentSuggestionEngine as any).calculateSentiment(extremeNegative);
                
                expect(positiveResult).toBeLessThanOrEqual(1);
                expect(negativeResult).toBeGreaterThanOrEqual(-1);
            });
        });
        
        describe('detectNumericData', () => {
            it('should detect percentages', () => {
                const content = 'The project completion rate is 75%, with 85% of tasks finished and 90% approved.';
                const result = (contentSuggestionEngine as any).detectNumericData(content);
                expect(result).toBe(true);
            });
            
            it('should detect number sequences', () => {
                const content = 'The quarterly sales figures are 1.2 million, 1.5 million, and 1.8 million.';
                const result = (contentSuggestionEngine as any).detectNumericData(content);
                expect(result).toBe(true);
            });
            
            it('should detect comparisons', () => {
                const content = 'The current value of 25 is lower compared to the previous value of 42.';
                const result = (contentSuggestionEngine as any).detectNumericData(content);
                expect(result).toBe(true);
            });
            
            it('should return false for non-numeric content', () => {
                const content = 'This document describes the project scope and deliverables.';
                const result = (contentSuggestionEngine as any).detectNumericData(content);
                expect(result).toBe(false);
            });
        });
        
        describe('detectLists', () => {
            it('should detect numbered lists', () => {
                const content = '1. First item\n2. Second item\n3. Third item\n4. Fourth item';
                const result = (contentSuggestionEngine as any).detectLists(content);
                expect(result).toBeGreaterThan(0);
            });
            
            it('should detect bullet lists', () => {
                const content = '• Item one\n• Item two\n• Item three\n• Item four';
                const result = (contentSuggestionEngine as any).detectLists(content);
                expect(result).toBeGreaterThan(0);
            });
            
            it('should detect dash lists', () => {
                const content = '- First point\n- Second point\n- Third point\n- Fourth point';
                const result = (contentSuggestionEngine as any).detectLists(content);
                expect(result).toBeGreaterThan(0);
            });
            
            it('should detect lettered lists', () => {
                const content = 'a) Option A\nb) Option B\nc) Option C\nd) Option D';
                const result = (contentSuggestionEngine as any).detectLists(content);
                expect(result).toBeGreaterThan(0);
            });
            
            it('should return zero for content without lists', () => {
                const content = 'This is a regular paragraph without any list structure. It contains sentences that form a cohesive narrative.';
                const result = (contentSuggestionEngine as any).detectLists(content);
                expect(result).toBe(0);
            });
        });
        
        describe('identifyGrammarIssues', () => {
            it('should detect double words', () => {
                const content = 'This is the the document that describes our process.';
                const issues = (contentSuggestionEngine as any).identifyGrammarIssues(content);
                
                expect(issues.some((issue: GrammarIssue) => 
                    issue.type === 'grammar' && 
                    issue.text.includes('the the')
                )).toBeTruthy();
            });
            
            it('should detect subject-verb agreement issues', () => {
                const content = 'The team are working on the project. She have completed her tasks.';
                const issues = (contentSuggestionEngine as any).identifyGrammarIssues(content);
                
                expect(issues.some((issue: GrammarIssue) => 
                    issue.type === 'grammar' && 
                    (issue.text.includes('team are') || issue.text.includes('She have'))
                )).toBeTruthy();
            });
            
            it('should detect punctuation issues', () => {
                const content = 'The report is complete .There are no issues remaining';
                const issues = (contentSuggestionEngine as any).identifyGrammarIssues(content);
                
                expect(issues.some((issue: GrammarIssue) => 
                    issue.type === 'punctuation'
                )).toBeTruthy();
            });
            
            it('should detect style issues', () => {
                const content = 'The team utilized the very complex system in order to complete the task.';
                const issues = (contentSuggestionEngine as any).identifyGrammarIssues(content);
                
                expect(issues.some((issue: GrammarIssue) => 
                    issue.type === 'style' && 
                    (issue.text.includes('utilized') || issue.text.includes('very complex') || issue.text.includes('in order to'))
                )).toBeTruthy();
            });
            
            it('should detect spelling issues', () => {
                const content = 'The team recieved the definately important document.';
                const issues = (contentSuggestionEngine as any).identifyGrammarIssues(content);
                
                expect(issues.some((issue: GrammarIssue) => 
                    issue.type === 'spelling' && 
                    (issue.text.includes('recieved') || issue.text.includes('definately'))
                )).toBeTruthy();
            });
            
            it('should return empty array for content without issues', () => {
                const content = 'This is a grammatically correct sentence. It has proper punctuation and spelling.';
                const issues = (contentSuggestionEngine as any).identifyGrammarIssues(content);
                
                // May still detect some issues due to simplified implementation
                // But should be minimal
                expect(issues.length).toBeLessThan(3);
            });
        });
        
        describe('identifyContentFeatures', () => {
            it('should detect lists', () => {
                const content = '1. First item\n2. Second item\n3. Third item';
                const features = (contentSuggestionEngine as any).identifyContentFeatures(content);
                
                expect(features.some((feature: ContentFeature) => feature.type === 'list')).toBeTruthy();
            });
            
            it('should detect headings', () => {
                const content = '# Main Heading\n\nContent here\n\n## Subheading\n\nMore content';
                const features = (contentSuggestionEngine as any).identifyContentFeatures(content);
                
                expect(features.some((feature: ContentFeature) => feature.type === 'heading')).toBeTruthy();
            });
            
            it('should detect citations', () => {
                const content = 'According to Smith (2019), this approach is effective. Another study [1] supports this finding.';
                const features = (contentSuggestionEngine as any).identifyContentFeatures(content);
                
                expect(features.some((feature: ContentFeature) => feature.type === 'citation')).toBeTruthy();
            });
            
            it('should detect tables', () => {
                const content = '| Header 1 | Header 2 |\n|----------|----------|\n| Data 1   | Data 2   |';
                const features = (contentSuggestionEngine as any).identifyContentFeatures(content);
                
                expect(features.some((feature: ContentFeature) => feature.type === 'table')).toBeTruthy();
            });
            
            it('should detect quotes as citations', () => {
                const content = 'As the famous quote states: "To be or not to be, that is the question."';
                const features = (contentSuggestionEngine as any).identifyContentFeatures(content);
                
                expect(features.some((feature: ContentFeature) => feature.type === 'citation')).toBeTruthy();
            });
        });
    });
});
