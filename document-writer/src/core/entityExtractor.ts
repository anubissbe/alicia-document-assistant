export class EntityExtractor {
    private readonly intents = new Set([
        'create',
        'update',
        'delete',
        'view',
        'export',
        'import',
        'share',
        'print'
    ]);

    private readonly documentTypes = new Set([
        'report',
        'letter',
        'proposal',
        'memo',
        'contract',
        'invoice',
        'resume',
        'presentation',
        'specification',
        'documentation'
    ]);

    private readonly sentiments = new Set([
        'positive',
        'negative',
        'neutral',
        'mixed'
    ]);

    private readonly dateFormats = [
        /\d{4}-\d{2}-\d{2}/,                    // YYYY-MM-DD
        /\d{1,2}\/\d{1,2}\/\d{4}/,             // MM/DD/YYYY or DD/MM/YYYY
        /\d{1,2}\s(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{4}/i,  // DD Mon YYYY
        /(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s\d{1,2},\s\d{4}/i   // Mon DD, YYYY
    ];

    async extractIntent(text: string): Promise<string> {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid input: text must be a non-empty string');
            }

            const lowercaseText = text.toLowerCase();
            
            // Check for explicit intent keywords
            for (const intent of this.intents) {
                if (lowercaseText.includes(intent)) {
                    return intent;
                }
            }

            // Infer intent from context with expanded keywords
            const intentPatterns = {
                create: ['new', 'write', 'start', 'generate', 'make', 'compose'],
                update: ['edit', 'modify', 'revise', 'change', 'update', 'amend'],
                delete: ['remove', 'erase', 'delete', 'destroy', 'clear'],
                view: ['show', 'display', 'open', 'see', 'read', 'preview'],
                export: ['export', 'download', 'save', 'extract'],
                import: ['import', 'upload', 'load'],
                share: ['share', 'send', 'distribute', 'publish'],
                print: ['print', 'output', 'render']
            };

            for (const [intent, patterns] of Object.entries(intentPatterns)) {
                if (patterns.some(pattern => lowercaseText.includes(pattern))) {
                    return intent;
                }
            }

            // Default to 'view' if no intent is detected
            return 'view';
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to extract intent: ${errorMessage}`);
        }
    }

    async extractEntities(text: string): Promise<Map<string, string>> {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid input: text must be a non-empty string');
            }

            const entities = new Map<string, string>();
            const lowercaseText = text.toLowerCase();

            // Extract document type
            for (const docType of this.documentTypes) {
                if (lowercaseText.includes(docType)) {
                    entities.set('documentType', docType);
                    break;
                }
            }

            // Extract dates using multiple formats
            for (const format of this.dateFormats) {
                const dateMatch = text.match(format);
                if (dateMatch) {
                    try {
                        const date = new Date(dateMatch[0]);
                        if (!isNaN(date.getTime())) {
                            entities.set('date', date.toISOString().split('T')[0]);
                            break;
                        }
                    } catch {
                        continue;
                    }
                }
            }

            // Extract names (basic implementation - looks for capitalized words)
            const nameMatches = text.match(/[A-Z][a-z]+(?:\s[A-Z][a-z]+)*/g);
            if (nameMatches) {
                entities.set('names', nameMatches.join(', '));
            }

            // Extract email addresses
            const emailMatch = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
            if (emailMatch) {
                entities.set('email', emailMatch[0]);
            }

            // Extract numbers
            const numbers = text.match(/\b\d+(?:\.\d+)?\b/g);
            if (numbers) {
                entities.set('numbers', numbers.join(', '));
            }

            return entities;
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to extract entities: ${errorMessage}`);
        }
    }

    async extractKeywords(text: string): Promise<string[]> {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid input: text must be a non-empty string');
            }

            const words = text.toLowerCase()
                .replace(/[^\w\s]/g, '') // Remove punctuation
                .split(/\s+/) // Split on whitespace
                .filter(word => word.length > 0); // Remove empty strings

            if (words.length === 0) {
                return [];
            }

            // Remove common stop words
            const stopWords = new Set([
                'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for',
                'from', 'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on',
                'that', 'the', 'to', 'was', 'were', 'will', 'with'
            ]);

            // Filter out stop words and count word frequency
            const wordFrequency = new Map<string, number>();
            for (const word of words) {
                if (!stopWords.has(word) && word.length > 2) {
                    wordFrequency.set(word, (wordFrequency.get(word) || 0) + 1);
                }
            }

            // Sort by frequency and get top keywords
            return Array.from(wordFrequency.entries())
                .sort((a, b) => b[1] - a[1])
                .slice(0, 10)
                .map(([word]) => word);
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to extract keywords: ${errorMessage}`);
        }
    }

    async extractSentiment(text: string): Promise<string> {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid input: text must be a non-empty string');
            }

            const lowercaseText = text.toLowerCase();
            
            // Enhanced sentiment analysis with weighted keywords
            const sentimentWords = {
                positive: new Map([
                    ['excellent', 2.0], ['amazing', 2.0], ['outstanding', 2.0],
                    ['great', 1.5], ['wonderful', 1.5], ['fantastic', 1.5],
                    ['good', 1.0], ['nice', 1.0], ['happy', 1.0], ['pleased', 1.0],
                    ['success', 1.0], ['helpful', 1.0], ['effective', 1.0]
                ]),
                negative: new Map([
                    ['terrible', 2.0], ['horrible', 2.0], ['awful', 2.0],
                    ['bad', 1.5], ['poor', 1.5], ['disappointing', 1.5],
                    ['fail', 1.0], ['error', 1.0], ['problem', 1.0], ['unhappy', 1.0],
                    ['difficult', 1.0], ['wrong', 1.0], ['broken', 1.0]
                ])
            };

            // Initialize sentiment scores
            let positiveScore = 0;
            let negativeScore = 0;

            // Split text into words and analyze each
            const words = lowercaseText.split(/\s+/);
            for (const word of words) {
                positiveScore += sentimentWords.positive.get(word) || 0;
                negativeScore += sentimentWords.negative.get(word) || 0;
            }

            // Consider context modifiers
            const negationWords = new Set(['not', 'no', 'never', "don't", "doesn't", "didn't"]);
            words.forEach((word, index) => {
                if (negationWords.has(word)) {
                    // Check next word for sentiment and reverse it
                    const nextWord = words[index + 1];
                    if (nextWord) {
                        if (sentimentWords.positive.has(nextWord)) {
                            positiveScore -= sentimentWords.positive.get(nextWord)! * 2;
                            negativeScore += sentimentWords.positive.get(nextWord)!;
                        } else if (sentimentWords.negative.has(nextWord)) {
                            negativeScore -= sentimentWords.negative.get(nextWord)! * 2;
                            positiveScore += sentimentWords.negative.get(nextWord)!;
                        }
                    }
                }
            });

            // Determine overall sentiment with thresholds
            const totalScore = positiveScore - negativeScore;
            const threshold = 0.5;

            if (Math.abs(totalScore) < threshold) {
                return 'neutral';
            } else if (positiveScore > 0 && negativeScore > 0) {
                return Math.abs(totalScore) < threshold * 2 ? 'mixed' : (totalScore > 0 ? 'positive' : 'negative');
            } else {
                return totalScore > 0 ? 'positive' : 'negative';
            }
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to extract sentiment: ${errorMessage}`);
        }
    }

    async analyzeComplexity(text: string): Promise<{
        wordCount: number;
        sentenceCount: number;
        averageWordLength: number;
        complexityScore: number;
        readingLevel: string;
    }> {
        try {
            if (!text || typeof text !== 'string') {
                throw new Error('Invalid input: text must be a non-empty string');
            }

            const words = text.split(/\s+/).filter(w => w.length > 0);
            if (words.length === 0) {
                return {
                    wordCount: 0,
                    sentenceCount: 0,
                    averageWordLength: 0,
                    complexityScore: 0,
                    readingLevel: 'N/A'
                };
            }

            const sentences = text.split(/[.!?]+/).filter(s => s.trim().length > 0);
            const totalCharacters = words.reduce((sum, word) => sum + word.length, 0);

            const wordCount = words.length;
            const sentenceCount = sentences.length;
            const averageWordLength = totalCharacters / wordCount;

            // Calculate complexity score (0-100)
            // Based on average word length and words per sentence
            const wordsPerSentence = wordCount / sentenceCount;
            const complexityScore = Math.min(
                ((averageWordLength * 10) + (wordsPerSentence / 2)) * 4,
                100
            );

            // Determine reading level based on complexity score
            let readingLevel: string;
            if (complexityScore < 30) {
                readingLevel = 'Basic';
            } else if (complexityScore < 50) {
                readingLevel = 'Intermediate';
            } else if (complexityScore < 70) {
                readingLevel = 'Advanced';
            } else {
                readingLevel = 'Technical';
            }

            return {
                wordCount,
                sentenceCount,
                averageWordLength,
                complexityScore,
                readingLevel
            };
        } catch (error: unknown) {
            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
            throw new Error(`Failed to analyze complexity: ${errorMessage}`);
        }
    }
}
