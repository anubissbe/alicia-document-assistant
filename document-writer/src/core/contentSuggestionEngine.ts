import * as vscode from 'vscode';
import { EntityExtractor, MessageIntent, Entity } from './entityExtractor';
import { FeedbackLearningEngine } from './feedbackLearningEngine';

/**
 * Types of message intents
 */
export { MessageIntent } from './entityExtractor';

/**
 * Interface for conversation message history
 */
export interface HistoryMessage {
    content: string;
    sender: 'user' | 'assistant' | 'system';
    timestamp: number;
    intent?: MessageIntent;
}

/**
 * Content suggestion engine for generating responses and suggestions
 */
export class ContentSuggestionEngine {
    private readonly _entityExtractor: EntityExtractor;
    private readonly _feedbackEngine: FeedbackLearningEngine;
    private _maxGenerationTokens: number = 1000;
    private _maxContextTokens: number = 4000;
    private _activeDocument?: vscode.TextDocument;
    
    // Suggestion templates by intent
    private readonly _suggestionsByIntent: { [key in MessageIntent]?: string[] } = {
        'analyze_document': [
            'Show me the document structure',
            'Check document readability',
            'Analyze writing style',
            'Identify key themes',
            'Generate a summary'
        ],
        'suggest_improvements': [
            'Improve clarity',
            'Enhance structure',
            'Add more examples',
            'Strengthen conclusion',
            'Improve transitions between sections'
        ],
        'help_formatting': [
            'How do I create tables?',
            'Show me heading styles',
            'Help with citations',
            'Format bullet points',
            'Add page numbers'
        ],
        'create_section': [
            'Create an introduction',
            'Add a conclusion',
            'Insert a methodology section',
            'Generate a literature review',
            'Add an executive summary'
        ],
        'general_question': [
            'Tell me more about document writing',
            'What are best practices for academic writing?',
            'How can I make my document more engaging?',
            'Tips for writing clearly',
            'How to organize my ideas effectively'
        ]
    };
    
    /**
     * Constructor
     * @param entityExtractor The entity extractor to use
     * @param feedbackEngine The feedback learning engine to use
     */
    constructor(entityExtractor: EntityExtractor, feedbackEngine: FeedbackLearningEngine) {
        this._entityExtractor = entityExtractor;
        this._feedbackEngine = feedbackEngine;
    }
    
    /**
     * Set the active document for context
     * @param document The document to set as active
     */
    public setActiveDocument(document: vscode.TextDocument): void {
        this._activeDocument = document;
    }
    
    /**
     * Generate a response based on the user message and conversation history
     * @param message The user message
     * @param history The conversation history
     * @param entities Optional extracted entities
     * @returns The generated response
     */
    public async generateResponse(
        message: string, 
        history: HistoryMessage[], 
        entities?: Entity[]
    ): Promise<string> {
        // First, check for similar previous interactions to learn from
        const topRatedResponses = this._feedbackEngine.getTopRatedResponses(message);
        if (topRatedResponses.length > 0 && Math.random() > 0.3) {
            // 70% chance to use a previous highly-rated response if available
            return topRatedResponses[0];
        }
        
        // Extract intent if not provided
        let intent: MessageIntent;
        if (entities && entities.some(e => e.name === 'intent')) {
            intent = entities.find(e => e.name === 'intent')?.value as MessageIntent;
        } else {
            intent = await this._entityExtractor.extractIntent(message) as MessageIntent;
        }
        
        // In a real implementation, this would use an LLM or other AI technology
        // For now, we'll use a rule-based approach with templates for different intents
        
        // Check for document-related questions
        if (message.toLowerCase().includes('word count')) {
            if (this._activeDocument) {
                const text = this._activeDocument.getText();
                const wordCount = text.split(/\s+/).filter(word => word.length > 0).length;
                return `Your document has approximately ${wordCount} words.`;
            } else {
                return "I don't have an active document to check. Please open a document first.";
            }
        }
        
        // Generate response based on intent
        switch (intent) {
            case 'analyze_document':
                if (this._activeDocument) {
                    const analysis = await this.analyzeDocument(this._activeDocument.getText());
                    return this._formatDocumentAnalysis(analysis);
                } else {
                    return "I'd be happy to analyze your document, but I don't see an active document. Please open the document you'd like me to analyze.";
                }
                
            case 'suggest_improvements':
                if (this._activeDocument) {
                    const suggestions = this.suggestImprovements(this._activeDocument.getText());
                    return this._formatImprovementSuggestions(suggestions);
                } else {
                    return "I'd be happy to suggest improvements, but I don't see an active document. Please open the document you'd like me to help with.";
                }
                
            case 'help_formatting':
                return `
                    Here are some formatting tips:
                    
                    - **Headings**: Use # for main headings, ## for subheadings
                    - **Emphasis**: Use *italic* or **bold** for emphasis
                    - **Lists**: Use - or * for bullet points, 1. for numbered lists
                    - **Tables**: Create tables using | and - characters
                    - **Code blocks**: Use \`\`\` for code blocks
                    
                    Would you like more specific formatting advice for a particular element?
                `;
                
            case 'create_section':
                // Check for section type in entities
                let sectionType = 'general';
                if (entities) {
                    const sectionEntity = entities.find(e => e.name === 'section_type');
                    if (sectionEntity) {
                        sectionType = sectionEntity.value;
                    }
                }
                
                return this._generateSectionTemplate(sectionType);
                
            case 'general_question':
            default:
                return `
                    I understand you're asking about "${message}". 
                    
                    I can help you with document analysis, formatting suggestions, content improvements, 
                    and creating new sections. What specific aspect would you like assistance with?
                `;
        }
    }
    
    /**
     * Generate suggestions based on the conversation context
     * @param message The current message
     * @param history The conversation history
     * @returns Array of suggested responses
     */
    public async generateSuggestions(message: string, history: HistoryMessage[]): Promise<string[]> {
        // Extract intent to provide relevant suggestions
        const intent = await this._entityExtractor.extractIntent(message) as MessageIntent;
        
        // Get suggestions based on intent
        const intentSuggestions = this._suggestionsByIntent[intent] || this._suggestionsByIntent['general_question'] || [];
        
        // If we have user preference data, use it to personalize suggestions
        const userPreferences = this._feedbackEngine.analyzeUserPreferences();
        
        // If user has preferred suggestions, include some of them
        if (userPreferences.preferredSuggestions.length > 0) {
            // Mix in 1-2 preferred suggestions that aren't already in our list
            for (const preferred of userPreferences.preferredSuggestions) {
                if (!intentSuggestions.includes(preferred) && intentSuggestions.length < 5) {
                    intentSuggestions.push(preferred);
                }
                if (intentSuggestions.length >= 5) break;
            }
        }
        
        // If we have active document, also add document-specific suggestions
        if (this._activeDocument) {
            const docContent = this._activeDocument.getText();
            
            // For analyze intent, suggest document-specific analysis
            if (intent === 'analyze_document') {
                // Check if document has headings
                const hasHeadings = /^#+ /m.test(docContent);
                if (!hasHeadings) {
                    intentSuggestions.push('Add document structure with headings');
                }
                
                // Check if document is long enough for a summary
                const wordCount = docContent.split(/\s+/).length;
                if (wordCount > 500) {
                    intentSuggestions.push('Generate an executive summary');
                }
            }
            
            // For improvement intent, suggest document-specific improvements
            if (intent === 'suggest_improvements') {
                // Check if paragraphs are too long
                const paragraphs = docContent.split(/\n\s*\n/);
                const longParagraphs = paragraphs.some(p => p.split(/\s+/).length > 150);
                if (longParagraphs) {
                    intentSuggestions.push('Break up long paragraphs');
                }
                
                // Check if document lacks a conclusion
                const hasConclusion = /conclusion|summary|finally|in summary|to conclude/i.test(docContent);
                if (!hasConclusion) {
                    intentSuggestions.push('Add a conclusion section');
                }
            }
        }
        
        // Return up to 5 suggestions
        return intentSuggestions.slice(0, 5);
    }
    
    /**
     * Analyze document content and provide insights
     * @param content The document content to analyze
     * @returns Analysis insights
     */
    public async analyzeDocument(content: string): Promise<any> {
        // In a real implementation, this would be more sophisticated
        // For now, we'll return basic metrics
        
        const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;
        const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
        const sentenceCount = sentences.length;
        const avgWordsPerSentence = sentenceCount > 0 ? wordCount / sentenceCount : 0;
        
        // Extract document structure
        const headings = content.match(/#{1,6}\s+(.+?)$/gm) || [];
        const headingsFormatted = headings.map(heading => {
            const level = heading.match(/^(#+)/)?.[0].length || 0;
            const text = heading.replace(/^#+\s+/, '');
            return { level, text };
        });
        
        // Count paragraphs (simplistic approach)
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const paragraphCount = paragraphs.length;
        
        // Estimate reading time (average reading speed: 200-250 words per minute)
        const readingTimeMinutes = Math.ceil(wordCount / 200);
        
        return {
            metrics: {
                wordCount,
                sentenceCount,
                paragraphCount,
                avgWordsPerSentence,
                readingTimeMinutes
            },
            structure: {
                headings: headingsFormatted,
                paragraphCount
            },
            readability: this._assessReadability(content)
        };
    }
    
    /**
     * Format document analysis for human-readable output
     * @param analysis Analysis object
     * @returns Formatted analysis string
     */
    private _formatDocumentAnalysis(analysis: any): string {
        const { metrics, structure, readability } = analysis;
        
        let headingStructure = '';
        if (structure.headings.length > 0) {
            headingStructure = '**Document Structure:**\n';
            for (const heading of structure.headings) {
                // Indent based on heading level
                const indent = '  '.repeat(heading.level - 1);
                headingStructure += `${indent}- ${heading.text}\n`;
            }
        } else {
            headingStructure = '**Document Structure:** No headings found.\n';
        }
        
        return `
            # Document Analysis
            
            ## Key Metrics
            - **Word Count:** ${metrics.wordCount} words
            - **Sentences:** ${metrics.sentenceCount}
            - **Paragraphs:** ${metrics.paragraphCount}
            - **Average Words Per Sentence:** ${metrics.avgWordsPerSentence.toFixed(1)}
            - **Estimated Reading Time:** ${metrics.readingTimeMinutes} minutes
            
            ## Readability
            ${readability}
            
            ## Structure
            ${headingStructure}
            
            Would you like more detailed analysis or suggestions for improvement?
        `;
    }
    
    /**
     * Assess document readability
     * @param content The document content
     * @returns Readability assessment
     */
    private _assessReadability(content: string): string {
        // This is a very simplistic readability assessment
        // In a real implementation, this would use established algorithms like Flesch-Kincaid
        
        const sentences = content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0);
        const words = content.split(/\s+/).filter(word => word.length > 0);
        
        if (sentences.length === 0 || words.length === 0) {
            return 'Cannot assess (insufficient content)';
        }
        
        const avgWordsPerSentence = words.length / sentences.length;
        
        // Very simplistic readability assessment
        if (avgWordsPerSentence > 25) {
            return 'Your document has a **Complex** readability level. Consider using shorter sentences to improve readability.';
        } else if (avgWordsPerSentence > 18) {
            return 'Your document has a **Moderate** readability level. Good for professional and academic documents.';
        } else if (avgWordsPerSentence > 12) {
            return 'Your document has a **Good** readability level. It should be easy to read and understand for most audiences.';
        } else {
            return 'Your document has a **Very Simple** readability level. It is accessible to general audiences.';
        }
    }
    
    /**
     * Suggest improvements for a document
     * @param content The document content
     * @returns Suggested improvements
     */
    public suggestImprovements(content: string): string[] {
        const suggestions: string[] = [];
        
        // Check for introduction
        if (!content.toLowerCase().includes('introduction') && !content.match(/^.*?(overview|background|context)/i)) {
            suggestions.push('Add an introduction to provide context for your document');
        }
        
        // Check for conclusion
        if (!content.toLowerCase().includes('conclusion') && !content.match(/(summary|final thoughts|in summary|to conclude)/i)) {
            suggestions.push('Add a conclusion to summarize key points');
        }
        
        // Check for headings
        if (!content.match(/#{1,6}\s+.+/)) {
            suggestions.push('Use headings to structure your document');
        }
        
        // Check for long paragraphs
        const paragraphs = content.split(/\n\s*\n/);
        const longParagraphs = paragraphs.filter(p => p.split(/\s+/).length > 150).length;
        
        if (longParagraphs > 0) {
            suggestions.push('Break up long paragraphs to improve readability');
        }
        
        // Check word variety (very simplistic)
        const words = content.toLowerCase().split(/\s+/);
        const wordFrequency: Record<string, number> = {};
        
        for (const word of words) {
            if (word.length > 3) {  // Ignore short words
                wordFrequency[word] = (wordFrequency[word] || 0) + 1;
            }
        }
        
        const overusedWords = Object.entries(wordFrequency)
            .filter(([word, count]) => count > 5 && word.length > 3)
            .map(([word]) => word);
        
        if (overusedWords.length > 0) {
            suggestions.push(`Consider using synonyms for frequently used words: ${overusedWords.slice(0, 3).join(', ')}`);
        }
        
        // Check for passive voice (very simplistic detection)
        const passiveVoiceIndicators = [
            /\b(?:is|are|was|were|be|been|being)\s+\w+ed\b/g,
            /\b(?:is|are|was|were|be|been|being)\s+\w+en\b/g
        ];
        
        let passiveVoiceCount = 0;
        for (const pattern of passiveVoiceIndicators) {
            const matches = content.match(pattern);
            if (matches) {
                passiveVoiceCount += matches.length;
            }
        }
        
        if (passiveVoiceCount > 5) {
            suggestions.push('Consider using more active voice in your writing');
        }
        
        // Check for citation/references if document seems academic
        const academicKeywords = [
            'research', 'study', 'analysis', 'data', 'findings', 
            'literature', 'methodology', 'results', 'hypothesis'
        ];
        
        const isAcademic = academicKeywords.some(keyword => 
            content.toLowerCase().includes(keyword)
        );
        
        const hasReferences = content.includes('references') || 
            content.includes('bibliography') || 
            content.includes('citation') ||
            /\[\d+\]/.test(content);
        
        if (isAcademic && !hasReferences) {
            suggestions.push('Add citations and a references section');
        }
        
        // Default suggestions if none found
        if (suggestions.length === 0) {
            suggestions.push('Consider adding more details or examples to strengthen your points');
            suggestions.push('Review for clarity and conciseness');
        }
        
        return suggestions;
    }
    
    /**
     * Format improvement suggestions for human-readable output
     * @param suggestions Array of suggestion strings
     * @returns Formatted suggestions string
     */
    private _formatImprovementSuggestions(suggestions: string[]): string {
        let result = '# Document Improvement Suggestions\n\n';
        
        for (const suggestion of suggestions) {
            result += `- ${suggestion}\n`;
        }
        
        result += '\nWould you like more detailed advice on any of these suggestions?';
        
        return result;
    }
    
    /**
     * Generate a section template based on section type
     * @param sectionType The type of section to generate
     * @returns Generated section template
     */
    private _generateSectionTemplate(sectionType: string): string {
        switch (sectionType.toLowerCase()) {
            case 'introduction':
                return `
                    # Introduction
                    
                    Begin with a hook to grab the reader's attention. This could be a surprising fact, 
                    a provocative question, or a relevant quote.
                    
                    Next, provide background information that helps readers understand the context of your topic.
                    This section should bridge the gap between what the reader already knows and what they need 
                    to know to understand your main points.
                    
                    Finally, present your thesis statement or main argument. This should clearly state the purpose 
                    or central claim of your document.
                    
                    *Would you like me to help you develop any part of this introduction further?*
                `;
                
            case 'conclusion':
                return `
                    # Conclusion
                    
                    Begin by restating your thesis or main argument in a new way.
                    
                    Summarize the key points you've made throughout the document. Don't simply repeat them 
                    verbatim, but synthesize them to reinforce your main message.
                    
                    Discuss the broader implications or significance of your topic. Help the reader understand 
                    why what you've written matters.
                    
                    End with a memorable closing statement that leaves the reader with something to think about.
                    
                    *Would you like me to help you develop this conclusion further?*
                `;
                
            case 'methodology':
                return `
                    # Methodology
                    
                    Begin by stating the overall approach or research design you used.
                    
                    ## Data Collection
                    Describe how you collected your data. Include:
                    - Sources used
                    - Selection criteria
                    - Timeline of collection
                    - Tools or instruments used
                    
                    ## Analysis Process
                    Explain how you analyzed the data:
                    - Methods used
                    - Steps followed
                    - Software or tools employed
                    
                    ## Limitations
                    Acknowledge any limitations or constraints that affected your work.
                    
                    *Would you like me to help you develop any part of this methodology section further?*
                `;
                
            case 'literature review':
                return `
                    # Literature Review
                    
                    Begin with an overview of the field and why this review is important.
                    
                    ## Current State of Knowledge
                    Summarize what is currently known about your topic. Group similar studies or perspectives together.
                    
                    ## Key Theories and Concepts
                    Explain the major theoretical frameworks relevant to your topic.
                    
                    ## Gaps and Limitations
                    Identify what's missing from the current research and how your work addresses these gaps.
                    
                    ## Synthesis and Conclusion
                    Connect the different studies and perspectives to show their relationship to your research.
                    
                    *Would you like me to help you develop any part of this literature review further?*
                `;
                
            default:
                return `
                    # New Section
                    
                    This is a template for a new section in your document. Here are some tips for 
                    developing this section effectively:
                    
                    - Begin with a clear heading that indicates the section's purpose
                    - Start with a topic sentence that introduces the main idea
                    - Provide supporting evidence, examples, or arguments
                    - End with a concluding sentence that transitions to the next section
                    
                    *Would you like me to help you develop a specific type of section? I can help with 
                    introductions, conclusions, methodology sections, literature reviews, and more.*
                `;
        }
    }
}
