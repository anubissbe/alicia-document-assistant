import { ContentSuggestionEngine, ContentSuggestion } from './contentSuggestionEngine';
import { EntityExtractor } from './entityExtractor';

export interface AnalysisResult {
    documentType: string;
    wordCount: number;
    readingTime: number;
    readabilityLevel: string;
    readabilityScore: number;
    sentimentScore?: number;
    sentimentLabel?: string;
    keyTopics: string[];
    suggestions: string[];
    structure: {
        hasSections: boolean;
        sectionCount: number;
        sectionTitles: string[];
    };
    statistics: {
        paragraphCount: number;
        sentenceCount: number;
        averageSentenceLength: number;
        longSentences: number;
    };
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
        const complexity = await this._entityExtractor.analyzeComplexity(content);

        // Get content suggestions
        const contentSuggestions = await this._contentSuggestionEngine.suggestContent(content, {
            context: content,
            tone: this.determineTone(sentiment)
        });

        // Calculate readability score (Flesch-Kincaid Grade Level - simplified)
        const readabilityScore = this.calculateReadabilityScore(content);

        // Calculate word count
        const wordCount = this.calculateWordCount(content);

        // Calculate reading time (average 200 words per minute)
        const readingTime = Math.ceil(wordCount / 200);

        // Determine document type
        const documentType = this.determineDocumentType(content);

        // Analyze structure
        const structure = this.analyzeStructure(content);

        // Calculate statistics
        const statistics = this.calculateStatistics(content);

        // Convert sentiment to numeric score (-1 to 1)
        const sentimentScore = this.convertSentimentToScore(sentiment);

        // Convert content suggestions to string array
        const suggestions = contentSuggestions.map(s => s.text);

        // Determine readability level
        const readabilityLevel = this.determineReadabilityLevel(readabilityScore);

        return {
            documentType,
            wordCount,
            readingTime,
            readabilityLevel,
            readabilityScore,
            sentimentScore,
            sentimentLabel: sentiment,
            keyTopics: keywords,
            suggestions,
            structure,
            statistics
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

    private determineDocumentType(content: string): string {
        const lower = content.toLowerCase();
        
        if (lower.includes('dear ') && (lower.includes('sincerely') || lower.includes('regards'))) {
            return 'Letter';
        } else if (lower.includes('abstract') || lower.includes('methodology') || lower.includes('references')) {
            return 'Academic Paper';
        } else if (lower.includes('executive summary') || lower.includes('recommendation')) {
            return 'Business Report';
        } else if (lower.includes('# ') || lower.includes('## ')) {
            return 'Markdown Document';
        } else if (lower.includes('<html>') || lower.includes('<body>')) {
            return 'HTML Document';
        } else {
            return 'General Document';
        }
    }

    private analyzeStructure(content: string): {
        hasSections: boolean;
        sectionCount: number;
        sectionTitles: string[];
    } {
        // Look for markdown headers and common section patterns
        const headingPatterns = [
            /^#{1,6}\s+(.+)$/gm,           // Markdown headers
            /^(.+)\n[=-]{3,}$/gm,         // Underlined headers
            /^\*{1,3}\s*(.+)\s*\*{1,3}$/gm // Bold section headers
        ];

        const sectionTitles: string[] = [];
        
        for (const pattern of headingPatterns) {
            let match;
            while ((match = pattern.exec(content)) !== null) {
                const title = match[1].trim();
                if (title.length > 0 && title.length < 100) {
                    sectionTitles.push(title);
                }
            }
        }

        return {
            hasSections: sectionTitles.length > 0,
            sectionCount: sectionTitles.length,
            sectionTitles
        };
    }

    private calculateStatistics(content: string): {
        paragraphCount: number;
        sentenceCount: number;
        averageSentenceLength: number;
        longSentences: number;
    } {
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const sentences = content.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = content.split(/\s+/).filter(w => w.length > 0);

        const wordsPerSentence = sentences.map(s => s.split(/\s+/).filter(w => w.length > 0).length);
        const averageSentenceLength = wordsPerSentence.length > 0 
            ? wordsPerSentence.reduce((sum, len) => sum + len, 0) / wordsPerSentence.length 
            : 0;

        const longSentences = wordsPerSentence.filter(len => len > 30).length;

        return {
            paragraphCount: paragraphs.length,
            sentenceCount: sentences.length,
            averageSentenceLength,
            longSentences
        };
    }

    private convertSentimentToScore(sentiment: string): number {
        switch (sentiment.toLowerCase()) {
            case 'positive': return 0.7;
            case 'negative': return -0.7;
            case 'mixed': return 0.0;
            case 'neutral': 
            default: return 0.0;
        }
    }

    private determineReadabilityLevel(score: number): string {
        if (score < 30) return 'Very Easy';
        if (score < 50) return 'Easy';
        if (score < 60) return 'Fairly Easy';
        if (score < 70) return 'Standard';
        if (score < 80) return 'Fairly Hard';
        if (score < 90) return 'Hard';
        return 'Very Hard';
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
        if (analysis.sentimentLabel === 'negative') {
            insights.push('The tone is predominantly negative - consider revising for a more balanced approach');
        }

        // Add length insights
        if (analysis.wordCount < 100) {
            insights.push('Document is quite brief - consider adding more detail');
        } else if (analysis.wordCount > 5000) {
            insights.push('Document is very long - consider breaking into sections');
        }

        // Add key phrase insights
        if (analysis.keyTopics.length > 0) {
            insights.push(`Key themes: ${analysis.keyTopics.slice(0, 5).join(', ')}`);
        }

        // Add content suggestions
        analysis.suggestions.forEach(suggestion => {
            insights.push(`Consider adding: ${suggestion}`);
        });

        return insights;
    }

    async getSummaryStatistics(content: string): Promise<Record<string, number | string>> {
        const analysis = await this.analyzeDocument(content);

        return {
            wordCount: analysis.wordCount,
            readabilityScore: Math.round(analysis.readabilityScore),
            sentiment: analysis.sentimentLabel || 'neutral',
            keyPhraseCount: analysis.keyTopics.length,
            entityCount: 0, // We don't store entities in this interface anymore
            suggestionCount: analysis.suggestions.length
        };
    }
}
