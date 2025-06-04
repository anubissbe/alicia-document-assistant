import { EntityExtractor } from './entityExtractor';

export interface SuggestionOptions {
    maxSuggestions?: number;
    minConfidence?: number;
    context?: string;
    documentType?: string;
    tone?: 'formal' | 'informal' | 'technical' | 'friendly';
    purpose?: 'inform' | 'persuade' | 'describe' | 'analyze';
}

export interface ContentSuggestion {
    text: string;
    confidence: number;
    category: string;
    context?: string;
    metadata?: {
        source?: string;
        relevance?: number;
        timestamp?: string;
    };
}

export class ContentSuggestionEngine {
    private readonly entityExtractor: EntityExtractor;
    private readonly defaultOptions: SuggestionOptions = {
        maxSuggestions: 5,
        minConfidence: 0.7,
        tone: 'formal',
        purpose: 'inform'
    };

    constructor() {
        this.entityExtractor = new EntityExtractor();
    }

    async suggestContent(prompt: string, options?: SuggestionOptions): Promise<ContentSuggestion[]> {
        // Merge options with defaults
        const finalOptions = { ...this.defaultOptions, ...options };

        // Validate options
        this.validateOptions(finalOptions);

        // Extract entities and context from prompt
        const entities = await this.entityExtractor.extractEntities(prompt);
        const keywords = await this.entityExtractor.extractKeywords(prompt);
        const sentiment = await this.entityExtractor.extractSentiment(prompt);

        // Generate suggestions based on context and options
        const suggestions = await this.generateSuggestions(
            prompt,
            entities,
            keywords,
            sentiment,
            finalOptions
        );

        // Filter and sort suggestions
        return this.filterAndRankSuggestions(suggestions, finalOptions);
    }

    private validateOptions(options: SuggestionOptions): void {
        if (options.maxSuggestions && options.maxSuggestions < 1) {
            throw new Error('maxSuggestions must be greater than 0');
        }

        if (options.minConfidence && (options.minConfidence < 0 || options.minConfidence > 1)) {
            throw new Error('minConfidence must be between 0 and 1');
        }

        const validTones = ['formal', 'informal', 'technical', 'friendly'];
        if (options.tone && !validTones.includes(options.tone)) {
            throw new Error(`Invalid tone. Must be one of: ${validTones.join(', ')}`);
        }

        const validPurposes = ['inform', 'persuade', 'describe', 'analyze'];
        if (options.purpose && !validPurposes.includes(options.purpose)) {
            throw new Error(`Invalid purpose. Must be one of: ${validPurposes.join(', ')}`);
        }
    }

    private async generateSuggestions(
        prompt: string,
        entities: Map<string, string>,
        keywords: string[],
        sentiment: string,
        options: SuggestionOptions = {}
    ): Promise<ContentSuggestion[]> {
        const suggestions: ContentSuggestion[] = [];

        // Generate suggestions based on document type
        if (options?.documentType) {
            suggestions.push(...await this.generateDocumentTypeSuggestions(
                options.documentType,
                entities,
                options
            ));
        }

        // Generate suggestions based on purpose
        if (options.purpose) {
            suggestions.push(...await this.generatePurposeSuggestions(
                options.purpose,
                keywords,
                options
            ));
        }

        // Generate tone-specific suggestions
        if (options.tone) {
            suggestions.push(...await this.generateToneSuggestions(
                options.tone,
                sentiment,
                options
            ));
        }

        // Generate context-aware suggestions
        if (options.context) {
            suggestions.push(...await this.generateContextSuggestions(
                options.context,
                keywords,
                options
            ));
        }

        return suggestions;
    }

    private async generateDocumentTypeSuggestions(
        documentType: string,
        entities: Map<string, string>,
        options: SuggestionOptions
    ): Promise<ContentSuggestion[]> {
        const suggestions: ContentSuggestion[] = [];

        switch (documentType.toLowerCase()) {
            case 'report':
                suggestions.push(
                    {
                        text: 'Executive Summary',
                        confidence: 0.9,
                        category: 'structure',
                        metadata: { relevance: 1.0 }
                    },
                    {
                        text: 'Methodology',
                        confidence: 0.85,
                        category: 'structure',
                        metadata: { relevance: 0.9 }
                    }
                );
                break;
            case 'letter':
                if (entities.has('names')) {
                    suggestions.push({
                        text: `Dear ${entities.get('names')},`,
                        confidence: 0.95,
                        category: 'greeting',
                        metadata: { relevance: 1.0 }
                    });
                }
                break;
            case 'proposal':
                suggestions.push(
                    {
                        text: 'Project Scope',
                        confidence: 0.9,
                        category: 'structure',
                        metadata: { relevance: 1.0 }
                    },
                    {
                        text: 'Timeline and Deliverables',
                        confidence: 0.85,
                        category: 'structure',
                        metadata: { relevance: 0.9 }
                    }
                );
                break;
            case 'memo':
                suggestions.push({
                    text: 'Key Points Summary',
                    confidence: 0.9,
                    category: 'structure',
                    metadata: { relevance: 1.0 }
                });
                break;
        }

        return suggestions;
    }

    private async generatePurposeSuggestions(
        purpose: string,
        keywords: string[],
        options: SuggestionOptions
    ): Promise<ContentSuggestion[]> {
        const suggestions: ContentSuggestion[] = [];

        switch (purpose) {
            case 'inform':
                suggestions.push({
                    text: 'Background Information',
                    confidence: 0.85,
                    category: 'content',
                    metadata: { relevance: 0.9 }
                });
                break;
            case 'persuade':
                suggestions.push({
                    text: 'Supporting Evidence',
                    confidence: 0.9,
                    category: 'content',
                    metadata: { relevance: 1.0 }
                });
                break;
            case 'describe':
                suggestions.push({
                    text: 'Detailed Specifications',
                    confidence: 0.85,
                    category: 'content',
                    metadata: { relevance: 0.9 }
                });
                break;
            case 'analyze':
                suggestions.push({
                    text: 'Data Analysis',
                    confidence: 0.9,
                    category: 'content',
                    metadata: { relevance: 1.0 }
                });
                break;
        }

        return suggestions;
    }

    private async generateToneSuggestions(
        tone: string,
        sentiment: string,
        options: SuggestionOptions
    ): Promise<ContentSuggestion[]> {
        const suggestions: ContentSuggestion[] = [];

        switch (tone) {
            case 'formal':
                suggestions.push({
                    text: 'Professional Introduction',
                    confidence: 0.9,
                    category: 'tone',
                    metadata: { relevance: 1.0 }
                });
                break;
            case 'informal':
                suggestions.push({
                    text: 'Casual Opening',
                    confidence: 0.85,
                    category: 'tone',
                    metadata: { relevance: 0.9 }
                });
                break;
            case 'technical':
                suggestions.push({
                    text: 'Technical Specifications',
                    confidence: 0.9,
                    category: 'tone',
                    metadata: { relevance: 1.0 }
                });
                break;
            case 'friendly':
                suggestions.push({
                    text: 'Personal Anecdote',
                    confidence: 0.85,
                    category: 'tone',
                    metadata: { relevance: 0.9 }
                });
                break;
        }

        return suggestions;
    }

    private async generateContextSuggestions(
        context: string,
        keywords: string[],
        options: SuggestionOptions
    ): Promise<ContentSuggestion[]> {
        // Generate suggestions based on provided context
        const suggestions: ContentSuggestion[] = [];

        // Add context-specific suggestions
        if (context.includes('previous')) {
            suggestions.push({
                text: 'Reference to Previous Communication',
                confidence: 0.85,
                category: 'context',
                context: 'previous',
                metadata: { relevance: 0.9 }
            });
        }

        if (context.includes('follow')) {
            suggestions.push({
                text: 'Follow-up Actions',
                confidence: 0.9,
                category: 'context',
                context: 'follow-up',
                metadata: { relevance: 1.0 }
            });
        }

        return suggestions;
    }

    private filterAndRankSuggestions(
        suggestions: ContentSuggestion[],
        options: SuggestionOptions
    ): ContentSuggestion[] {
        // Filter by confidence threshold
        let filtered = suggestions.filter(s => 
            s.confidence >= (options.minConfidence || this.defaultOptions.minConfidence!)
        );

        // Sort by confidence and relevance
        filtered.sort((a, b) => {
            const scoreA = (a.confidence + (a.metadata?.relevance || 0)) / 2;
            const scoreB = (b.confidence + (b.metadata?.relevance || 0)) / 2;
            return scoreB - scoreA;
        });

        // Limit number of suggestions
        return filtered.slice(0, options.maxSuggestions || this.defaultOptions.maxSuggestions);
    }
}
