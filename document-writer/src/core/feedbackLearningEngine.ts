import * as vscode from 'vscode';
import { MessageIntent } from './entityExtractor';

/**
 * Interface for feedback data
 */
export interface SuggestionFeedback {
    suggestionId?: string;
    rating?: number;
    used?: boolean;
    timestamp?: Date;
    context?: string;
    userComment?: string;
    suggestion: string;
    accepted: boolean;
    documentType: string;
}

/**
 * Engine for learning from user feedback and improving suggestions
 */
export class FeedbackLearningEngine {
    private _feedbackData: SuggestionFeedback[] = [];
    private _context: vscode.ExtensionContext;
    private _storageKey = 'document-writer.feedbackData';
    private _maxFeedbackItems = 500;
    
    /**
     * Constructor
     * @param context VS Code extension context
     */
    constructor(context: vscode.ExtensionContext) {
        this._context = context;
        this._loadFeedbackData();
    }
    
    /**
     * Learn from an interaction between the user and the assistant
     * @param suggestion The suggestion text
     * @param accepted Whether the suggestion was accepted
     * @param documentType The type of document
     * @param context Optional context about the interaction
     * @param rating Optional user rating
     */
    public learnFromInteraction(
        suggestion: string,
        accepted: boolean,
        documentType: string,
        context?: string,
        rating?: number
    ): void {
        // Create feedback item
        const feedbackItem: SuggestionFeedback = {
            suggestion,
            accepted,
            documentType,
            context,
            rating,
            timestamp: new Date()
        };
        
        // Add to feedback data
        this._feedbackData.push(feedbackItem);
        
        // Limit the size of feedback data
        if (this._feedbackData.length > this._maxFeedbackItems) {
            this._feedbackData = this._feedbackData.slice(-this._maxFeedbackItems);
        }
        
        // Save feedback data
        this._saveFeedbackData();
    }
    
    /**
     * Get similar feedback data for a given suggestion
     * @param suggestion The suggestion to find similar feedback for
     * @param count The number of similar items to return
     * @returns Array of similar feedback items
     */
    public getSimilarFeedback(suggestion: string, count: number = 5): SuggestionFeedback[] {
        // This is a very simplistic similarity calculation
        // In a real implementation, this would use more sophisticated NLP techniques
        
        // Calculate similarity scores
        const scoredFeedback = this._feedbackData.map(feedback => {
            const similarity = this._calculateSimilarity(suggestion, feedback.suggestion);
            return {
                feedback,
                similarity
            };
        });
        
        // Sort by similarity and return top matches
        return scoredFeedback
            .sort((a, b) => b.similarity - a.similarity)
            .slice(0, count)
            .map(item => item.feedback);
    }
    
    /**
     * Calculate similarity between two strings
     * @param str1 First string
     * @param str2 Second string
     * @returns Similarity score (0-1)
     */
    private _calculateSimilarity(str1: string, str2: string): number {
        // Convert strings to lowercase
        const s1 = str1.toLowerCase();
        const s2 = str2.toLowerCase();
        
        // Calculate Jaccard similarity of word sets
        const words1 = new Set(s1.split(/\s+/).filter(word => word.length > 0));
        const words2 = new Set(s2.split(/\s+/).filter(word => word.length > 0));
        
        // Count common words
        let intersection = 0;
        for (const word of words1) {
            if (words2.has(word)) {
                intersection++;
            }
        }
        
        // Calculate Jaccard similarity
        const union = words1.size + words2.size - intersection;
        return union > 0 ? intersection / union : 0;
    }
    
    /**
     * Get top-rated suggestions for similar suggestions
     * @param suggestion The suggestion to find responses for
     * @param count The number of suggestions to return
     * @returns Array of top-rated suggestions
     */
    public getTopRatedSuggestions(suggestion: string, count: number = 3): string[] {
        // Get similar feedback
        const similarFeedback = this.getSimilarFeedback(suggestion, 10);
        
        // Filter for items with ratings and accepted status
        const ratedFeedback = similarFeedback.filter(feedback => 
            feedback.rating !== undefined || feedback.accepted === true
        );
        
        // Sort by rating and acceptance
        ratedFeedback.sort((a, b) => {
            // If both have ratings, compare them
            if (a.rating !== undefined && b.rating !== undefined) {
                return b.rating - a.rating;
            }
            
            // Prioritize items with ratings over items without
            if (a.rating !== undefined) return -1;
            if (b.rating !== undefined) return 1;
            
            // If both have acceptance status, use that
            if (a.accepted === true && b.accepted !== true) return -1;
            if (a.accepted !== true && b.accepted === true) return 1;
            
            // Default case
            return 0;
        });
        
        // Return top suggestions
        return ratedFeedback.slice(0, count).map(feedback => feedback.suggestion);
    }
    
    /**
     * Analyze user preferences from feedback data
     * @returns Analysis of user preferences
     */
    public analyzeUserPreferences(): {
        preferredTopics: string[];
        preferredSuggestions: string[];
        avgRating: number;
    } {
        // Count accepted suggestions
        const suggestionCounts: Record<string, number> = {};
        
        for (const feedback of this._feedbackData) {
            if (feedback.accepted) {
                suggestionCounts[feedback.suggestion] = 
                    (suggestionCounts[feedback.suggestion] || 0) + 1;
            }
        }
        
        // Extract topics from document types and suggestions (very simplistic)
        const topics: Record<string, number> = {};
        
        for (const feedback of this._feedbackData) {
            // Count document types
            topics[feedback.documentType] = (topics[feedback.documentType] || 0) + 1;
            
            // Extract words from suggestions
            const words = feedback.suggestion.toLowerCase().split(/\s+/);
            for (const word of words) {
                if (word.length > 4) {  // Simple filter for potential topics
                    topics[word] = (topics[word] || 0) + 1;
                }
            }
        }
        
        // Calculate average rating
        const ratings = this._feedbackData
            .filter(feedback => feedback.rating !== undefined)
            .map(feedback => feedback.rating as number);
        
        const avgRating = ratings.length > 0
            ? ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length
            : 0;
        
        // Get top topics and suggestions
        const topTopics = Object.entries(topics)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5)
            .map(([topic]) => topic);
        
        const topSuggestions = Object.entries(suggestionCounts)
            .sort(([, countA], [, countB]) => countB - countA)
            .slice(0, 5)
            .map(([suggestion]) => suggestion);
        
        return {
            preferredTopics: topTopics,
            preferredSuggestions: topSuggestions,
            avgRating: avgRating
        };
    }
    
    /**
     * Load feedback data from storage
     */
    private _loadFeedbackData(): void {
        try {
            const data = this._context.globalState.get<SuggestionFeedback[]>(this._storageKey);
            if (data) {
                this._feedbackData = data;
            }
        } catch (error) {
            console.error('Error loading feedback data:', error);
            this._feedbackData = [];
        }
    }
    
    /**
     * Save feedback data to storage
     */
    private _saveFeedbackData(): void {
        try {
            this._context.globalState.update(this._storageKey, this._feedbackData);
        } catch (error) {
            console.error('Error saving feedback data:', error);
        }
    }
    
    /**
     * Clear all feedback data
     */
    public clearFeedbackData(): void {
        this._feedbackData = [];
        this._saveFeedbackData();
    }
    
    /**
     * Export feedback data to a file
     * @param filePath The path to export to
     * @returns True if successful, false otherwise
     */
    public exportFeedbackData(filePath: string): boolean {
        try {
            const fs = require('fs');
            fs.writeFileSync(filePath, JSON.stringify(this._feedbackData, null, 2), 'utf8');
            return true;
        } catch (error) {
            console.error('Error exporting feedback data:', error);
            return false;
        }
    }
    
    /**
     * Import feedback data from a file
     * @param filePath The path to import from
     * @returns True if successful, false otherwise
     */
    public importFeedbackData(filePath: string): boolean {
        try {
            const fs = require('fs');
            const data = fs.readFileSync(filePath, 'utf8');
            const parsedData = JSON.parse(data);
            
            if (Array.isArray(parsedData)) {
                // Merge with existing data
                this._feedbackData = [...this._feedbackData, ...parsedData];
                
                // Limit size
                if (this._feedbackData.length > this._maxFeedbackItems) {
                    this._feedbackData = this._feedbackData.slice(-this._maxFeedbackItems);
                }
                
                this._saveFeedbackData();
                return true;
            }
            
            return false;
        } catch (error) {
            console.error('Error importing feedback data:', error);
            return false;
        }
    }

    /**
     * Get weights for document type
     */
    public getWeightsForDocumentType(docType: string): Record<string, number> {
        // Load from feedback data if available
        const storedWeights = this._feedbackData
            .filter(f => f.documentType === docType)
            .reduce((weights, feedback) => {
                const suggestionType = this.determineSuggestionType(feedback.suggestion);
                if (suggestionType) {
                    const adjustment = feedback.accepted ? 0.05 : -0.05;
                    weights[suggestionType] = (weights[suggestionType] || 1.0) + adjustment;
                }
                return weights;
            }, {} as Record<string, number>);
        
        // Default weights
        const defaultWeights = {
            content: 1.0,
            style: 1.0,
            structure: 1.0,
            visualization: 1.0,
            grammar: 1.0,
            template: 1.0
        };
        
        // Merge with stored weights
        return { ...defaultWeights, ...storedWeights };
    }

    /**
     * Get suggestion strength multiplier
     */
    public getSuggestionStrengthMultiplier(_suggestionType: string, suggestion: string, docType: string): number {
        // Find similar suggestions in feedback data
        const similarFeedback = this._feedbackData.filter(feedback => 
            feedback.documentType === docType && 
            this.isSimilarSuggestion(suggestion, feedback.suggestion)
        );
        
        if (similarFeedback.length === 0) {
            return 1.0; // Neutral multiplier if no history
        }
        
        // Calculate multiplier based on historical acceptance
        const acceptedCount = similarFeedback.filter(f => f.accepted).length;
        const rejectedCount = similarFeedback.length - acceptedCount;
        
        if (acceptedCount > rejectedCount) {
            return 1.1; // Higher multiplier for previously accepted suggestions
        } else if (rejectedCount > acceptedCount) {
            return 0.9; // Lower multiplier for previously rejected suggestions
        } else {
            return 1.0; // Neutral if equal
        }
    }

    /**
     * Get suggestion priorities
     */
    public getSuggestionPriorities(docType: string): string[] {
        const weights = this.getWeightsForDocumentType(docType);
        
        // Sort suggestion types by weight (highest first)
        return Object.entries(weights)
            .sort(([, weightA], [, weightB]) => weightB - weightA)
            .map(([type]) => type);
    }

    /**
     * Record feedback
     */
    public recordFeedback(feedback: SuggestionFeedback): void {
        this._feedbackData.push(feedback);
        
        // Limit the size of feedback data
        if (this._feedbackData.length > this._maxFeedbackItems) {
            this._feedbackData = this._feedbackData.slice(-this._maxFeedbackItems);
        }
        
        // Save feedback data
        this._saveFeedbackData();
    }

    /**
     * Reset learning data
     */
    public resetLearningData(): void {
        this._feedbackData = [];
        this._saveFeedbackData();
    }

    /**
     * Determine suggestion type based on keywords
     */
    private determineSuggestionType(suggestion: string): string | null {
        const lowerSuggestion = suggestion.toLowerCase();
        
        // Content keywords
        if (lowerSuggestion.includes('add') || lowerSuggestion.includes('detail') || 
            lowerSuggestion.includes('information') || lowerSuggestion.includes('content') ||
            lowerSuggestion.includes('expand') || lowerSuggestion.includes('include')) {
            return 'content';
        }
        
        // Style keywords
        if (lowerSuggestion.includes('formal') || lowerSuggestion.includes('tone') ||
            lowerSuggestion.includes('style') || lowerSuggestion.includes('language') ||
            lowerSuggestion.includes('phrasing') || lowerSuggestion.includes('academic')) {
            return 'style';
        }
        
        // Structure keywords
        if (lowerSuggestion.includes('section') || lowerSuggestion.includes('heading') ||
            lowerSuggestion.includes('structure') || lowerSuggestion.includes('organize') ||
            lowerSuggestion.includes('paragraph') || lowerSuggestion.includes('outline')) {
            return 'structure';
        }
        
        // Visualization keywords
        if (lowerSuggestion.includes('chart') || lowerSuggestion.includes('graph') ||
            lowerSuggestion.includes('diagram') || lowerSuggestion.includes('visual') ||
            lowerSuggestion.includes('table') || lowerSuggestion.includes('image')) {
            return 'visualization';
        }
        
        // Grammar keywords
        if (lowerSuggestion.includes('grammar') || lowerSuggestion.includes('fix') ||
            lowerSuggestion.includes('correct') || lowerSuggestion.includes('error') ||
            lowerSuggestion.includes('spelling') || lowerSuggestion.includes('punctuation')) {
            return 'grammar';
        }
        
        // Template keywords
        if (lowerSuggestion.includes('template') || lowerSuggestion.includes('format') ||
            lowerSuggestion.includes('layout') || lowerSuggestion.includes('design')) {
            return 'template';
        }
        
        return null;
    }

    /**
     * Check if two suggestions are similar
     */
    private isSimilarSuggestion(suggestion1: string, suggestion2: string): boolean {
        const words1 = suggestion1.toLowerCase().split(/\s+/)
            .filter(word => word.length > 3); // Filter out short words
        const words2 = suggestion2.toLowerCase().split(/\s+/)
            .filter(word => word.length > 3);
        
        if (words1.length === 0 || words2.length === 0) {
            return false;
        }
        
        // Calculate word overlap
        const set1 = new Set(words1);
        const set2 = new Set(words2);
        
        let intersection = 0;
        for (const word of set1) {
            if (set2.has(word)) {
                intersection++;
            }
        }
        
        // Consider similar if at least 30% of words overlap
        const similarity = intersection / Math.min(set1.size, set2.size);
        return similarity >= 0.3;
    }
}
