import * as vscode from 'vscode';

/**
 * Sentiment analysis result
 */
export interface SentimentResult {
    score: number;       // Range from -1 (negative) to 1 (positive)
    magnitude: number;   // Strength of sentiment (0 to +∞)
    label: 'positive' | 'negative' | 'neutral' | 'mixed';
}

/**
 * SentimentAnalyzer analyzes the sentiment of text to improve response generation
 */
export class SentimentAnalyzer {
    // Positive and negative word dictionaries with sentiment scores
    private readonly positiveWords: Map<string, number> = new Map();
    private readonly negativeWords: Map<string, number> = new Map();
    
    /**
     * Constructor initializes the sentiment dictionaries
     */
    constructor() {
        this.initializeDictionaries();
    }
    
    /**
     * Initialize sentiment dictionaries with words and their scores
     */
    private initializeDictionaries(): void {
        // Positive words with sentiment scores (0 to 1)
        const positiveWords: [string, number][] = [
            ['excellent', 0.9],
            ['amazing', 0.9],
            ['outstanding', 0.9],
            ['great', 0.8],
            ['good', 0.7],
            ['nice', 0.7],
            ['helpful', 0.7],
            ['useful', 0.7],
            ['effective', 0.7],
            ['better', 0.6],
            ['improved', 0.6],
            ['clear', 0.6],
            ['informative', 0.6],
            ['well', 0.6],
            ['easy', 0.6],
            ['positive', 0.6],
            ['appreciate', 0.7],
            ['thanks', 0.7],
            ['thank', 0.7],
            ['like', 0.6],
            ['love', 0.8],
            ['enjoy', 0.7],
            ['happy', 0.8],
            ['pleased', 0.7],
            ['satisfied', 0.7],
            ['interesting', 0.6],
            ['impressive', 0.8],
            ['correct', 0.6],
            ['accurate', 0.7],
            ['perfect', 0.9],
            ['recommended', 0.7],
            ['valuable', 0.7],
            ['insightful', 0.7],
            ['professional', 0.6],
            ['convenient', 0.6],
            ['wonderful', 0.8],
            ['fantastic', 0.9],
            ['superb', 0.9],
            ['brilliant', 0.9],
            ['yes', 0.5]
        ];
        
        // Negative words with sentiment scores (-1 to 0)
        const negativeWords: [string, number][] = [
            ['terrible', -0.9],
            ['awful', -0.9],
            ['horrible', -0.9],
            ['bad', -0.7],
            ['poor', -0.7],
            ['disappointing', -0.7],
            ['useless', -0.8],
            ['difficult', -0.6],
            ['confusing', -0.7],
            ['unclear', -0.6],
            ['wrong', -0.7],
            ['error', -0.7],
            ['issue', -0.6],
            ['problem', -0.6],
            ['bug', -0.7],
            ['fail', -0.8],
            ['failed', -0.8],
            ['failure', -0.8],
            ['unhelpful', -0.7],
            ['frustrated', -0.8],
            ['frustrating', -0.8],
            ['annoying', -0.7],
            ['annoyed', -0.7],
            ['dissatisfied', -0.8],
            ['unhappy', -0.7],
            ['dislike', -0.7],
            ['hate', -0.9],
            ['slow', -0.6],
            ['broken', -0.7],
            ['crash', -0.8],
            ['complicated', -0.6],
            ['inconsistent', -0.6],
            ['inaccurate', -0.7],
            ['incorrect', -0.7],
            ['expensive', -0.6],
            ['waste', -0.7],
            ['worst', -0.9],
            ['horrible', -0.9],
            ['no', -0.5]
        ];
        
        // Add positive words to the dictionary
        for (const [word, score] of positiveWords) {
            this.positiveWords.set(word, score);
        }
        
        // Add negative words to the dictionary
        for (const [word, score] of negativeWords) {
            this.negativeWords.set(word, score);
        }
    }
    
    /**
     * Analyze the sentiment of text
     * @param text The text to analyze
     * @returns The sentiment analysis result
     */
    public analyzeSentiment(text: string): SentimentResult {
        if (!text || text.trim() === '') {
            return {
                score: 0,
                magnitude: 0,
                label: 'neutral'
            };
        }
        
        // Normalize the text: lowercase and remove punctuation
        const normalizedText = text.toLowerCase().replace(/[^\w\s]/g, '');
        
        // Split into words
        const words = normalizedText.split(/\s+/);
        
        let totalScore = 0;
        let matchedWords = 0;
        
        // Calculate sentiment based on dictionary matches
        for (const word of words) {
            if (this.positiveWords.has(word)) {
                totalScore += this.positiveWords.get(word) || 0;
                matchedWords++;
            } else if (this.negativeWords.has(word)) {
                totalScore += this.negativeWords.get(word) || 0;
                matchedWords++;
            }
        }
        
        // Calculate the average score
        const score = matchedWords > 0 ? totalScore / matchedWords : 0;
        
        // Calculate magnitude (strength of sentiment)
        // More matched words = higher magnitude
        const magnitude = Math.abs(score) * Math.min(1, matchedWords / 5);
        
        // Determine the sentiment label
        let label: 'positive' | 'negative' | 'neutral' | 'mixed';
        
        if (magnitude < 0.1) {
            label = 'neutral';
        } else if (score > 0.1) {
            label = 'positive';
        } else if (score < -0.1) {
            label = 'negative';
        } else {
            label = 'mixed';
        }
        
        return {
            score,
            magnitude,
            label
        };
    }
    
    /**
     * Get sentiment-appropriate response modifiers
     * @param sentiment The sentiment analysis result
     * @returns Object with tone and emphasis modifiers
     */
    public getResponseModifiers(sentiment: SentimentResult): { tone: string, emphasis: string } {
        switch (sentiment.label) {
            case 'positive':
                return {
                    tone: sentiment.magnitude > 0.5 ? 'enthusiastic' : 'friendly',
                    emphasis: sentiment.magnitude > 0.5 ? 'strong' : 'light'
                };
                
            case 'negative':
                return {
                    tone: sentiment.magnitude > 0.5 ? 'empathetic' : 'supportive',
                    emphasis: sentiment.magnitude > 0.5 ? 'strong' : 'light'
                };
                
            case 'mixed':
                return {
                    tone: 'balanced',
                    emphasis: 'neutral'
                };
                
            case 'neutral':
            default:
                return {
                    tone: 'informative',
                    emphasis: 'neutral'
                };
        }
    }
    
    /**
     * Detect if the text contains urgent language or requests
     * @param text The text to analyze
     * @returns Whether the text contains urgent language
     */
    public detectUrgency(text: string): boolean {
        const urgentPatterns = [
            /\b(?:urgent|immediately|asap|right now|emergency|critical)\b/i,
            /\b(?:need|must|have to).{1,15}(?:quickly|immediately|now)\b/i,
            /\b(?:can't wait|deadline|due)\b/i,
            /\b(?:hurry|rush|expedite)\b/i
        ];
        
        return urgentPatterns.some(pattern => pattern.test(text));
    }
    
    /**
     * Analyze if the text indicates confusion or misunderstanding
     * @param text The text to analyze
     * @returns A score indicating confusion level (0-1)
     */
    public analyzeConfusion(text: string): number {
        const confusionPatterns = [
            /\b(?:confused|confusing|don't understand|not sure|unclear|what do you mean)\b/i,
            /\b(?:how does|how do|what is|why is|how can).{1,20}\?/i,
            /\b(?:explain|clarify|help me understand)\b/i,
            /\b(?:doesn't make sense|makes no sense)\b/i,
            /\?{2,}/
        ];
        
        let confusionScore = 0;
        const maxScore = confusionPatterns.length;
        
        for (const pattern of confusionPatterns) {
            if (pattern.test(text)) {
                confusionScore++;
            }
        }
        
        return confusionScore / maxScore;
    }
    
    /**
     * Analyze the formality level of the text
     * @param text The text to analyze
     * @returns A score indicating formality (-1 to 1, where -1 is very informal and 1 is very formal)
     */
    public analyzeFormalityLevel(text: string): number {
        // Formal language indicators
        const formalIndicators = [
            /\b(?:therefore|however|moreover|furthermore|consequently|thus|accordingly|hence)\b/i,
            /\b(?:regarding|concerning|with respect to|in relation to)\b/i,
            /\b(?:please|kindly|would you|could you|may I)\b/i,
            /\b(?:appreciate|acknowledge|inquire)\b/i,
            /\b(?:assist|provide|require|request)\b/i
        ];
        
        // Informal language indicators
        const informalIndicators = [
            /\b(?:hey|hi|hello|sup|yo|what's up)\b/i,
            /\b(?:gonna|wanna|gotta|kinda|sorta|dunno)\b/i,
            /\b(?:cool|awesome|great|nice|yeah|ok|okay|sure)\b/i,
            /\b(?:stuff|things|like|pretty much|basically)\b/i,
            /\b(?:btw|lol|haha|hehe|:D|:P)\b/i,
            /!{2,}/
        ];
        
        let formalScore = 0;
        let informalScore = 0;
        
        // Count formal indicators
        for (const pattern of formalIndicators) {
            if (pattern.test(text)) {
                formalScore++;
            }
        }
        
        // Count informal indicators
        for (const pattern of informalIndicators) {
            if (pattern.test(text)) {
                informalScore++;
            }
        }
        
        // Normalize scores (0-1)
        const normalizedFormalScore = formalScore / formalIndicators.length;
        const normalizedInformalScore = informalScore / informalIndicators.length;
        
        // Calculate overall formality score (-1 to 1)
        return normalizedFormalScore - normalizedInformalScore;
    }
    
    /**
     * Detect if the text contains feedback
     * @param text The text to analyze
     * @returns Object indicating if feedback is present and its type
     */
    public detectFeedback(text: string): { hasFeedback: boolean, type: 'positive' | 'negative' | 'neutral' | 'suggestion' | null } {
        const feedbackPatterns = [
            // General feedback indicators
            /\b(?:feedback|suggestion|opinion|thought|comment)\b/i,
            
            // Positive feedback indicators
            /\b(?:like|love|enjoy|great job|well done|good work)\b/i,
            
            // Negative feedback indicators
            /\b(?:don't like|didn't work|problem with|issue with|doesn't work)\b/i,
            
            // Suggestion indicators
            /\b(?:should|could|would be better|improve|enhance|suggest|recommend)\b/i
        ];
        
        // Check if any feedback pattern matches
        const hasFeedback = feedbackPatterns.some(pattern => pattern.test(text));
        
        if (!hasFeedback) {
            return { hasFeedback: false, type: null };
        }
        
        // Analyze the sentiment to determine feedback type
        const sentiment = this.analyzeSentiment(text);
        
        // Check for suggestion-specific patterns
        const suggestionPattern = /\b(?:should|could|would be better|improve|enhance|suggest|recommend)\b/i;
        const isSuggestion = suggestionPattern.test(text);
        
        if (isSuggestion) {
            return { hasFeedback: true, type: 'suggestion' };
        } else if (sentiment.label === 'positive') {
            return { hasFeedback: true, type: 'positive' };
        } else if (sentiment.label === 'negative') {
            return { hasFeedback: true, type: 'negative' };
        } else {
            return { hasFeedback: true, type: 'neutral' };
        }
    }
}
