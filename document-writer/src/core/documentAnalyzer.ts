import { ContentSuggestionEngine, ContentSuggestion } from './contentSuggestionEngine';
import { EntityExtractor } from './entityExtractor';

export interface AnalysisResult {
    sentiment: string;
    keyPhrases: string[];
    entities: Map<string, string>;
    suggestions: ContentSuggestion[];
    readabilityScore: number;
    wordCount: number;
}

export class DocumentAnalyzer {
    private _contentSuggestionEngine: ContentSuggestionEngine;
    private _entityExtractor: EntityExtractor;

    constructor() {
        this._contentSuggestionEngine = new ContentSuggestionEngine();
        this._entityExtractor = new EntityExtractor();
    }

    async analyzeDocument(content: string): Promise<AnalysisResult> {
        // Extract entities and context from content
        const entities = await this._entityExtractor.extractEntities(content);
        const keywords = await this._entityExtractor.extractKeywords(content);
        const sentiment = await this._entityExtractor.extractSentiment(content);

        // Get content suggestions
        const suggestions = await this._contentSuggestionEngine.suggestContent(content, {
            context: content,
            tone: this.determineTone(sentiment)
        });

        // Calculate readability score (Flesch-Kincaid Grade Level - simplified)
        const readabilityScore = this.calculateReadabilityScore(content);

        // Calculate word count
        const wordCount = this.calculateWordCount(content);

        return {
            sentiment,
            keyPhrases: keywords,
            entities,
            suggestions,
            readabilityScore,
            wordCount
        };
    }

    private determineTone(sentiment: string): 'formal' | 'informal' | 'technical' | 'friendly' {
        switch (sentiment.toLowerCase()) {
            case 'positive':
                return 'friendly';
            case 'negative':
                return 'formal';
            case 'neutral':
                return 'technical';
            default:
                return 'formal';
        }
    }

    private calculateReadabilityScore(text: string): number {
        const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = text.split(/\s+/).filter(w => w.trim().length > 0);
        const syllables = this.countSyllables(text);

        if (words.length === 0 || sentences.length === 0) {
            return 0;
        }

        // Flesch-Kincaid Grade Level formula
        const score = 0.39 * (words.length / sentences.length) +
                     11.8 * (syllables / words.length) - 15.59;

        // Clamp score between 0 and 100
        return Math.min(Math.max(score, 0), 100);
    }

    private calculateWordCount(text: string): number {
        return text.split(/\s+/).filter(word => word.trim().length > 0).length;
    }

    private countSyllables(text: string): number {
        // Basic syllable counting - can be improved
        const words = text.toLowerCase().split(/\s+/);
        let count = 0;

        for (const word of words) {
            // Count vowel groups as syllables
            const syllables = word.match(/[aeiouy]+/g);
            if (syllables) {
                count += syllables.length;
            }

            // Adjust for silent e at end of words
            if (word.length > 2 && word.endsWith('e')) {
                count--;
            }
        }

        return Math.max(count, 1); // Ensure at least one syllable
    }

    async getKeyInsights(content: string): Promise<string[]> {
        const analysis = await this.analyzeDocument(content);
        const insights: string[] = [];

        // Add readability insights
        if (analysis.readabilityScore > 80) {
            insights.push('Document is very readable and clear');
        } else if (analysis.readabilityScore < 40) {
            insights.push('Consider simplifying the language for better readability');
        }

        // Add sentiment insights
        if (analysis.sentiment === 'negative') {
            insights.push('The tone is predominantly negative - consider revising for a more balanced approach');
        }

        // Add length insights
        if (analysis.wordCount < 100) {
            insights.push('Document is quite brief - consider adding more detail');
        } else if (analysis.wordCount > 5000) {
            insights.push('Document is very long - consider breaking into sections');
        }

        // Add key phrase insights
        if (analysis.keyPhrases.length > 0) {
            insights.push(`Key themes: ${analysis.keyPhrases.slice(0, 5).join(', ')}`);
        }

        // Add content suggestions
        analysis.suggestions.forEach(suggestion => {
            if (suggestion.confidence > 0.8) {
                insights.push(`Consider adding: ${suggestion.text}`);
            }
        });

        return insights;
    }

    async getSummaryStatistics(content: string): Promise<Record<string, number | string>> {
        const analysis = await this.analyzeDocument(content);

        return {
            wordCount: analysis.wordCount,
            readabilityScore: Math.round(analysis.readabilityScore),
            sentiment: analysis.sentiment,
            keyPhraseCount: analysis.keyPhrases.length,
            entityCount: analysis.entities.size,
            suggestionCount: analysis.suggestions.length
        };
    }
}
