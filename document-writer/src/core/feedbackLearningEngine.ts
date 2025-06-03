import * as vscode from 'vscode';
import { MessageIntent } from './entityExtractor';

/**
 * Interface for feedback data
 */
export interface SuggestionFeedback {
    prompt: string;
    response: string;
    userRating?: number;
    wasHelpful?: boolean;
    selectedSuggestion?: string;
    context?: any;
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
     * @param prompt The user's prompt/message
     * @param response The assistant's response
     * @param rating Optional user rating of the response
     * @param wasHelpful Whether the response was helpful
     * @param selectedSuggestion Optional suggestion that was selected
     * @param context Optional context about the interaction
     */
    public learnFromInteraction(
        prompt: string,
        response: string,
        rating?: number,
        wasHelpful?: boolean,
        selectedSuggestion?: string,
        context?: any
    ): void {
        // Create feedback item
        const feedbackItem: SuggestionFeedback = {
            prompt,
            response,
            userRating: rating,
            wasHelpful,
            selectedSuggestion,
            context
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
     * Get similar feedback data for a given prompt
     * @param prompt The prompt to find similar feedback for
     * @param count The number of similar items to return
     * @returns Array of similar feedback items
     */
    public getSimilarFeedback(prompt: string, count: number = 5): SuggestionFeedback[] {
        // This is a very simplistic similarity calculation
        // In a real implementation, this would use more sophisticated NLP techniques
        
        // Calculate similarity scores
        const scoredFeedback = this._feedbackData.map(feedback => {
            const similarity = this._calculateSimilarity(prompt, feedback.prompt);
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
     * Get top-rated responses for similar prompts
     * @param prompt The prompt to find responses for
     * @param count The number of responses to return
     * @returns Array of top-rated responses
     */
    public getTopRatedResponses(prompt: string, count: number = 3): string[] {
        // Get similar feedback
        const similarFeedback = this.getSimilarFeedback(prompt, 10);
        
        // Filter for items with ratings
        const ratedFeedback = similarFeedback.filter(feedback => 
            feedback.userRating !== undefined || feedback.wasHelpful === true
        );
        
        // Sort by rating
        ratedFeedback.sort((a, b) => {
            // If both have ratings, compare them
            if (a.userRating !== undefined && b.userRating !== undefined) {
                return b.userRating - a.userRating;
            }
            
            // Prioritize items with ratings over items without
            if (a.userRating !== undefined) return -1;
            if (b.userRating !== undefined) return 1;
            
            // If both have wasHelpful, use that
            if (a.wasHelpful === true && b.wasHelpful !== true) return -1;
            if (a.wasHelpful !== true && b.wasHelpful === true) return 1;
            
            // Default case
            return 0;
        });
        
        // Return top responses
        return ratedFeedback.slice(0, count).map(feedback => feedback.response);
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
        // Count suggestion selections
        const suggestionCounts: Record<string, number> = {};
        
        for (const feedback of this._feedbackData) {
            if (feedback.selectedSuggestion) {
                suggestionCounts[feedback.selectedSuggestion] = 
                    (suggestionCounts[feedback.selectedSuggestion] || 0) + 1;
            }
        }
        
        // Extract topics from prompts (very simplistic)
        const topics: Record<string, number> = {};
        
        for (const feedback of this._feedbackData) {
            const words = feedback.prompt.toLowerCase().split(/\s+/);
            
            for (const word of words) {
                if (word.length > 4) {  // Simple filter for potential topics
                    topics[word] = (topics[word] || 0) + 1;
                }
            }
        }
        
        // Calculate average rating
        const ratings = this._feedbackData
            .filter(feedback => feedback.userRating !== undefined)
            .map(feedback => feedback.userRating as number);
        
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
}
