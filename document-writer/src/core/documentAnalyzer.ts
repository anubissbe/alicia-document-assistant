import * as vscode from 'vscode';
import { DocumentFormat } from './formatProcessor';
import { SentimentAnalyzer } from './sentimentAnalyzer';

/**
 * Interface for document analysis results
 */
export interface DocumentAnalysisResult {
    documentType: string;
    wordCount: number;
    readingTime: number;
    readabilityScore: number;
    readabilityLevel: 'Easy' | 'Medium' | 'Hard';
    keyTopics: string[];
    sentimentScore?: number;
    sentimentLabel?: 'positive' | 'negative' | 'neutral' | 'mixed';
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
    suggestions: string[];
}

/**
 * DocumentAnalyzer provides analysis functionality for documents
 */
export class DocumentAnalyzer {
    private _sentimentAnalyzer: SentimentAnalyzer;
    
    /**
     * Constructor
     * @param sentimentAnalyzer The sentiment analyzer
     */
    constructor(sentimentAnalyzer: SentimentAnalyzer) {
        this._sentimentAnalyzer = sentimentAnalyzer;
    }
    
    /**
     * Analyze a document
     * @param content The document content
     * @param documentName The document name
     * @param format The document format
     * @returns Analysis results
     */
    public async analyzeDocument(
        content: string,
        documentName: string,
        format: DocumentFormat
    ): Promise<DocumentAnalysisResult> {
        // Extract document structure
        const structure = this._extractDocumentStructure(content, format);
        
        // Calculate statistics
        const statistics = this._calculateDocumentStatistics(content);
        
        // Detect document type
        const documentType = this._detectDocumentType(content, documentName, format);
        
        // Calculate word count
        const wordCount = this._countWords(content);
        
        // Calculate reading time (average reading speed: 200 words per minute)
        const readingTime = Math.ceil(wordCount / 200);
        
        // Calculate readability metrics
        const readabilityMetrics = this._calculateReadabilityMetrics(content);
        
        // Extract key topics
        const keyTopics = await this._extractKeyTopics(content);
        
        // Analyze sentiment if appropriate for the document type
        let sentimentScore = undefined;
        let sentimentLabel = undefined;
        
        if (['Email', 'Letter', 'Review', 'Social Media Post'].includes(documentType)) {
            const sentiment = this._sentimentAnalyzer.analyzeSentiment(content);
            sentimentScore = sentiment.score;
            sentimentLabel = sentiment.label;
        }
        
        // Generate suggestions based on analysis
        const suggestions = this._generateSuggestions(
            documentType,
            structure,
            statistics,
            readabilityMetrics.score,
            wordCount
        );
        
        return {
            documentType,
            wordCount,
            readingTime,
            readabilityScore: readabilityMetrics.score,
            readabilityLevel: readabilityMetrics.level,
            keyTopics,
            sentimentScore,
            sentimentLabel,
            structure,
            statistics,
            suggestions
        };
    }
    
    /**
     * Extract document structure
     * @param content The document content
     * @param format The document format
     * @returns Document structure
     */
    private _extractDocumentStructure(
        content: string,
        format: DocumentFormat
    ): DocumentAnalysisResult['structure'] {
        const sectionTitles: string[] = [];
        
        // Extract sections based on format
        if (format === DocumentFormat.MARKDOWN) {
            // Extract markdown headings (# Heading)
            const headingRegex = /^(#{1,6})\s+(.+)$/gm;
            let match;
            
            while ((match = headingRegex.exec(content)) !== null) {
                sectionTitles.push(match[2].trim());
            }
        } else if (format === DocumentFormat.HTML) {
            // Extract HTML headings (<h1>-<h6>)
            const headingRegex = /<h[1-6][^>]*>(.+?)<\/h[1-6]>/gi;
            let match;
            
            while ((match = headingRegex.exec(content)) !== null) {
                sectionTitles.push(match[1].trim());
            }
        } else {
            // For other formats, try to detect section titles heuristically
            // Look for lines that might be headings (all caps, followed by newline, etc.)
            const lines = content.split('\n');
            for (let i = 0; i < lines.length; i++) {
                const line = lines[i].trim();
                
                // Check if line is potential heading (short, possibly all caps, etc.)
                if (
                    line.length > 0 &&
                    line.length < 100 &&
                    (line === line.toUpperCase() || /^[A-Z][a-z]/.test(line)) &&
                    !line.endsWith('.') &&
                    (i === 0 || lines[i - 1].trim() === '')
                ) {
                    sectionTitles.push(line);
                }
            }
        }
        
        return {
            hasSections: sectionTitles.length > 0,
            sectionCount: sectionTitles.length,
            sectionTitles
        };
    }
    
    /**
     * Calculate document statistics
     * @param content The document content
     * @returns Document statistics
     */
    private _calculateDocumentStatistics(
        content: string
    ): DocumentAnalysisResult['statistics'] {
        // Split into paragraphs (text blocks separated by one or more blank lines)
        const paragraphs = content.split(/\n\s*\n/).filter(p => p.trim().length > 0);
        const paragraphCount = paragraphs.length;
        
        // Split into sentences (very basic - splitting on ., !, ?)
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        const sentences = content.match(sentenceRegex) || [];
        const sentenceCount = sentences.length;
        
        // Calculate average sentence length
        const totalWords = this._countWords(content);
        const averageSentenceLength = sentenceCount > 0
            ? Math.round((totalWords / sentenceCount) * 10) / 10
            : 0;
        
        // Count long sentences (>30 words)
        const longSentences = sentences.filter(s => this._countWords(s) > 30).length;
        
        return {
            paragraphCount,
            sentenceCount,
            averageSentenceLength,
            longSentences
        };
    }
    
    /**
     * Detect the document type based on content and name
     * @param content The document content
     * @param documentName The document name
     * @param format The document format
     * @returns The detected document type
     */
    private _detectDocumentType(
        content: string,
        documentName: string,
        format: DocumentFormat
    ): string {
        // Check file name for clues
        const fileName = documentName.toLowerCase();
        
        if (fileName.includes('letter') || fileName.includes('correspondence')) {
            return 'Letter';
        } else if (fileName.includes('report')) {
            return 'Report';
        } else if (fileName.includes('proposal')) {
            return 'Proposal';
        } else if (fileName.includes('manual') || fileName.includes('guide')) {
            return 'Manual';
        } else if (fileName.includes('thesis') || fileName.includes('dissertation')) {
            return 'Academic Paper';
        } else if (fileName.includes('memo') || fileName.includes('memorandum')) {
            return 'Memo';
        } else if (fileName.includes('resume') || fileName.includes('cv')) {
            return 'Resume/CV';
        }
        
        // Check content for clues
        const contentLower = content.toLowerCase();
        
        if (
            (contentLower.includes('dear') && (
                contentLower.includes('sincerely') ||
                contentLower.includes('yours truly') ||
                contentLower.includes('regards')
            )) ||
            contentLower.includes('letter of')
        ) {
            return 'Letter';
        } else if (
            contentLower.includes('abstract') && 
            contentLower.includes('references') &&
            (contentLower.includes('methodology') || contentLower.includes('literature review'))
        ) {
            return 'Academic Paper';
        } else if (
            contentLower.includes('executive summary') || 
            contentLower.includes('findings') ||
            contentLower.includes('recommendations')
        ) {
            return 'Business Report';
        } else if (
            contentLower.includes('table of contents') &&
            contentLower.includes('chapter')
        ) {
            return 'Book';
        } else if (
            contentLower.includes('proposal') &&
            (contentLower.includes('scope') || contentLower.includes('deliverables'))
        ) {
            return 'Proposal';
        } else if (
            contentLower.includes('introduction') &&
            contentLower.includes('conclusion')
        ) {
            return 'Essay';
        } else if (
            contentLower.includes('instructions') ||
            contentLower.includes('step') ||
            contentLower.includes('guide')
        ) {
            return 'Manual';
        } else if (
            contentLower.includes('blog') ||
            (contentLower.includes('posted') && contentLower.includes('comments'))
        ) {
            return 'Blog Post';
        } else if (
            contentLower.includes('press release') ||
            contentLower.includes('for immediate release')
        ) {
            return 'Press Release';
        }
        
        // Check format for clues
        if (format === DocumentFormat.MARKDOWN) {
            return 'Markdown Document';
        } else if (format === DocumentFormat.HTML) {
            return 'HTML Document';
        } else if (format === DocumentFormat.DOCX) {
            return 'Word Document';
        } else if (format === DocumentFormat.PDF) {
            return 'PDF Document';
        }
        
        // Default
        return 'General Document';
    }
    
    /**
     * Count the number of words in a text
     * @param text The text to count words in
     * @returns The number of words
     */
    private _countWords(text: string): number {
        return text.split(/\s+/).filter(word => word.length > 0).length;
    }
    
    /**
     * Calculate readability metrics
     * @param content The document content
     * @returns Readability metrics
     */
    private _calculateReadabilityMetrics(
        content: string
    ): { score: number; level: 'Easy' | 'Medium' | 'Hard' } {
        // This is a simplified implementation of readability scoring
        // In a real implementation, you'd use established algorithms like Flesch-Kincaid
        
        // Get sentences and words
        const sentenceRegex = /[^.!?]+[.!?]+/g;
        const sentences = content.match(sentenceRegex) || [];
        const sentenceCount = sentences.length;
        
        const words = content.split(/\s+/).filter(word => word.length > 0);
        const wordCount = words.length;
        
        // Calculate average sentence length
        const avgSentenceLength = sentenceCount > 0 ? wordCount / sentenceCount : 0;
        
        // Calculate average word length
        const totalChars = words.reduce((sum, word) => sum + word.length, 0);
        const avgWordLength = wordCount > 0 ? totalChars / wordCount : 0;
        
        // Calculate a simple readability score (0-100)
        // Lower is easier to read
        let readabilityScore = Math.min(
            100,
            Math.max(
                0,
                Math.round((avgSentenceLength * 5 + avgWordLength * 10) - 10)
            )
        );
        
        // Determine readability level
        let readabilityLevel: 'Easy' | 'Medium' | 'Hard';
        
        if (readabilityScore < 30) {
            readabilityLevel = 'Easy';
        } else if (readabilityScore < 70) {
            readabilityLevel = 'Medium';
        } else {
            readabilityLevel = 'Hard';
        }
        
        return {
            score: readabilityScore,
            level: readabilityLevel
        };
    }
    
    /**
     * Extract key topics from the document content
     * @param content The document content
     * @returns Array of key topics
     */
    private async _extractKeyTopics(content: string): Promise<string[]> {
        // This is a simplified implementation
        // In a real implementation, you might use a more sophisticated NLP approach
        
        // Remove common words
        const commonWords = new Set([
            'the', 'be', 'to', 'of', 'and', 'a', 'in', 'that', 'have', 'I',
            'it', 'for', 'not', 'on', 'with', 'he', 'as', 'you', 'do', 'at',
            'this', 'but', 'his', 'by', 'from', 'they', 'we', 'say', 'her', 'she',
            'or', 'an', 'will', 'my', 'one', 'all', 'would', 'there', 'their', 'what',
            'so', 'up', 'out', 'if', 'about', 'who', 'get', 'which', 'go', 'me'
        ]);
        
        // Tokenize and count words
        const wordRegex = /\b[a-zA-Z]{3,}\b/g;
        const words = content.match(wordRegex) || [];
        
        // Count word frequency
        const wordCounts = new Map<string, number>();
        
        for (const word of words) {
            const normalizedWord = word.toLowerCase();
            
            if (!commonWords.has(normalizedWord)) {
                wordCounts.set(
                    normalizedWord,
                    (wordCounts.get(normalizedWord) || 0) + 1
                );
            }
        }
        
        // Sort by frequency
        const sortedWords = [...wordCounts.entries()]
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([word]) => word);
        
        return sortedWords;
    }
    
    /**
     * Generate improvement suggestions based on analysis
     * @param documentType The document type
     * @param structure The document structure
     * @param statistics The document statistics
     * @param readabilityScore The readability score
     * @param wordCount The word count
     * @returns Array of suggestions
     */
    private _generateSuggestions(
        documentType: string,
        structure: DocumentAnalysisResult['structure'],
        statistics: DocumentAnalysisResult['statistics'],
        readabilityScore: number,
        wordCount: number
    ): string[] {
        const suggestions: string[] = [];
        
        // Structural suggestions
        if (!structure.hasSections) {
            suggestions.push('Add clear section headings to organize your document');
        } else if (structure.sectionCount < 3 && wordCount > 500) {
            suggestions.push('Consider adding more sections to break up the content');
        }
        
        // Readability suggestions
        if (readabilityScore > 70) {
            suggestions.push('Simplify your language to improve readability');
            suggestions.push('Use shorter sentences to make your text easier to read');
        }
        
        if (statistics.averageSentenceLength > 25) {
            suggestions.push('Your sentences are quite long (average: ' + 
                statistics.averageSentenceLength.toFixed(1) + 
                ' words). Consider breaking them into shorter sentences');
        }
        
        if (statistics.longSentences > 5) {
            suggestions.push('You have ' + statistics.longSentences + 
                ' very long sentences (>30 words). Consider revising them');
        }
        
        // Document type specific suggestions
        if (documentType === 'Academic Paper') {
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('abstract') || 
                title.toLowerCase().includes('summary')
            )) {
                suggestions.push('Add an abstract or summary section');
            }
            
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('introduction')
            )) {
                suggestions.push('Add an introduction section');
            }
            
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('methodology') || 
                title.toLowerCase().includes('method')
            )) {
                suggestions.push('Add a methodology section');
            }
            
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('conclusion')
            )) {
                suggestions.push('Add a conclusion section');
            }
            
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('reference') || 
                title.toLowerCase().includes('bibliography')
            )) {
                suggestions.push('Add a references or bibliography section');
            }
        } else if (documentType === 'Business Report') {
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('executive summary')
            )) {
                suggestions.push('Add an executive summary section');
            }
            
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('recommendation')
            )) {
                suggestions.push('Add a recommendations section');
            }
        } else if (documentType === 'Letter') {
            // No specific suggestions for letters
        } else if (documentType === 'Manual') {
            if (statistics.paragraphCount > 10 && !structure.hasSections) {
                suggestions.push('Add clear section headings to organize your manual');
            }
            
            if (!structure.sectionTitles.some(title => 
                title.toLowerCase().includes('introduction') || 
                title.toLowerCase().includes('overview')
            )) {
                suggestions.push('Add an introduction or overview section');
            }
            
            if (wordCount > 500 && !structure.sectionTitles.some(title => 
                title.toLowerCase().includes('table of contents')
            )) {
                suggestions.push('Add a table of contents for easier navigation');
            }
        }
        
        // General suggestions
        if (statistics.paragraphCount < 3 && wordCount > 300) {
            suggestions.push('Break your content into more paragraphs for better readability');
        }
        
        if (wordCount < 100 && ['Report', 'Essay', 'Academic Paper'].includes(documentType)) {
            suggestions.push('Your document seems quite short for a ' + documentType + '. Consider expanding it.');
        }
        
        // Limit to 5 most important suggestions
        return suggestions.slice(0, 5);
    }
}
