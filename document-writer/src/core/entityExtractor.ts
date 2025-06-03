import * as vscode from 'vscode';

/**
 * Represents the different types of message intents
 */
export type MessageIntent = 
    | 'analyze_document'
    | 'suggest_improvements'
    | 'help_formatting'
    | 'create_section'
    | 'generate_content'
    | 'ask_capability'
    | 'provide_feedback'
    | 'request_example'
    | 'general_question';

/**
 * Entity representation with name, value, and type
 */
export interface Entity {
    name: string;
    value: string;
    type: string;
}

/**
 * Confidence level for intent detection
 */
export interface IntentConfidence {
    intent: MessageIntent;
    confidence: number;
}

/**
 * EntityExtractor is responsible for extracting intent and entities from user messages
 */
export class EntityExtractor {
    // Intent patterns for improved detection
    private readonly intentPatterns: Record<MessageIntent, RegExp[]> = {
        'analyze_document': [
            /\b(?:analyze|analyse|review|check|evaluate|assess|examine)\b/i,
            /\b(?:document|content|text|writing)\b/i,
            /\bwhat(?:'s| is)?\b.+\b(?:wrong|issue|problem)\b/i
        ],
        'suggest_improvements': [
            /\b(?:improve|enhance|upgrade|better|suggestions?|recommend|optimize)\b/i,
            /\b(?:how\s+(?:can|could|should)\s+I\s+improve)\b/i,
            /\b(?:make\s+(?:it|this)\s+better)\b/i
        ],
        'help_formatting': [
            /\b(?:format|style|layout|design|appearance|look)\b/i,
            /\b(?:markdown|heading|bold|italic|list|table|indent)\b/i,
            /\b(?:how\s+(?:do|can|should)\s+I\s+format)\b/i
        ],
        'create_section': [
            /\b(?:create|add|insert|make|generate)\s+(?:a|new|another)?\s+(?:section|part|chapter|heading)\b/i,
            /\b(?:section|part|chapter)\s+(?:for|about|on)\b/i,
            /\b(?:need|want)\s+(?:a|new|another)?\s+(?:section|part|chapter)\b/i
        ],
        'generate_content': [
            /\b(?:generate|create|write|draft|compose)\s+(?:content|text|paragraph|sentence)\b/i,
            /\b(?:help\s+(?:me|us)?\s+write)\b/i,
            /\b(?:content\s+for|text\s+about)\b/i
        ],
        'ask_capability': [
            /\b(?:what\s+can\s+you|can\s+you|are\s+you\s+able\s+to|do\s+you\s+support)\b/i,
            /\b(?:how\s+do\s+you|how\s+to|how\s+can\s+I)\b/i,
            /\b(?:feature|ability|capability|function)\b/i
        ],
        'provide_feedback': [
            /\b(?:feedback|opinion|thought|suggest)\b/i,
            /\b(?:like|love|hate|dislike)\b/i,
            /\b(?:good|great|excellent|terrible|awful|bad)\b/i
        ],
        'request_example': [
            /\b(?:example|sample|template|demonstration|show\s+me)\b/i,
            /\b(?:how\s+would|what\s+would)\b/i,
            /\b(?:can\s+you\s+show|give\s+me\s+an\s+example)\b/i
        ],
        'general_question': [
            /\b(?:what|how|why|when|where|who|which)\b/i,
            /\b(?:explain|tell|describe)\b/i,
            /\?$/
        ]
    };
    
    /**
     * Constructor
     */
    constructor() {
        // Initialize any needed resources
    }
    
    /**
     * Extract intent from a user message
     * @param message The user message
     * @returns The extracted intent
     */
    public async extractIntent(message: string): Promise<MessageIntent> {
        const confidenceScores = this.calculateIntentConfidence(message);
        
        // Return the intent with the highest confidence
        return confidenceScores[0].intent;
    }
    
    /**
     * Calculate confidence scores for all possible intents
     * @param message The user message
     * @returns Array of intents with confidence scores, sorted by confidence (highest first)
     */
    public calculateIntentConfidence(message: string): IntentConfidence[] {
        const confidenceScores: IntentConfidence[] = [];
        const lowerMessage = message.toLowerCase();
        
        // Calculate confidence for each intent
        for (const [intent, patterns] of Object.entries(this.intentPatterns)) {
            let matchCount = 0;
            
            // Check each pattern for the intent
            for (const pattern of patterns) {
                if (pattern.test(lowerMessage)) {
                    matchCount++;
                }
            }
            
            // Calculate confidence based on match count and pattern count
            const confidence = patterns.length > 0 ? matchCount / patterns.length : 0;
            
            confidenceScores.push({
                intent: intent as MessageIntent,
                confidence
            });
        }
        
        // Sort by confidence (highest first)
        return confidenceScores.sort((a, b) => b.confidence - a.confidence);
    }
    
    /**
     * Extract entities from a user message
     * @param message The user message
     * @returns Array of extracted entities
     */
    public async extractEntities(message: string): Promise<Entity[]> {
        // In a real implementation, this would use NLP to extract entities
        const entities: Entity[] = [];
        
        // Extract document type entities
        const documentTypeRegex = /(report|letter|paper|article|memo|proposal|thesis|resume|cv|manual|guide|specification|review)/gi;
        let match;
        
        while ((match = documentTypeRegex.exec(message)) !== null) {
            entities.push({
                name: 'document_type',
                value: match[0],
                type: 'document_type'
            });
        }
        
        // Extract section type entities
        const sectionRegex = /(introduction|conclusion|methodology|results|discussion|abstract|summary|background|literature review|references|appendix|acknowledgements|executive summary|recommendation)/gi;
        
        while ((match = sectionRegex.exec(message)) !== null) {
            entities.push({
                name: 'section_type',
                value: match[0],
                type: 'section_type'
            });
        }
        
        // Extract formatting entities
        const formattingRegex = /(bold|italic|heading|list|bullet|numbered|table|code|quote|font|color|size|margin|spacing|indent|alignment|justify|center|right|left)/gi;
        
        while ((match = formattingRegex.exec(message)) !== null) {
            entities.push({
                name: 'formatting',
                value: match[0],
                type: 'formatting'
            });
        }
        
        // Extract tone/style entities
        const toneRegex = /(formal|informal|professional|casual|academic|technical|friendly|serious|persuasive|informative|creative|concise)/gi;
        
        while ((match = toneRegex.exec(message)) !== null) {
            entities.push({
                name: 'tone',
                value: match[0],
                type: 'tone'
            });
        }
        
        // Extract audience entities
        const audienceRegex = /(student|professor|manager|client|customer|reader|user|audience|stakeholder|team|colleague)/gi;
        
        while ((match = audienceRegex.exec(message)) !== null) {
            entities.push({
                name: 'audience',
                value: match[0],
                type: 'audience'
            });
        }
        
        // Extract content requirement entities
        const requirementRegex = /(word count|length|deadline|requirement|guideline|instruction|rubric|criteria|standard|constraint)/gi;
        
        while ((match = requirementRegex.exec(message)) !== null) {
            entities.push({
                name: 'requirement',
                value: match[0],
                type: 'requirement'
            });
        }
        
        // Extract numeric entities (like word counts, page numbers)
        const numericRegex = /(\d+)\s*(words?|pages?|paragraphs?|sections?|characters?)/gi;
        
        while ((match = numericRegex.exec(message)) !== null) {
            entities.push({
                name: 'numeric',
                value: `${match[1]} ${match[2]}`,
                type: 'numeric'
            });
        }
        
        // Extract subject/topic entities using a simple approach
        // This is just capturing nouns that might be topics - in a real implementation,
        // this would use more sophisticated NLP techniques
        const words = message.split(/\s+/);
        const stopWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'with', 'by', 'about', 'like', 'through', 'over', 'before', 'after', 'since', 'of', 'from']);
        const potentialTopics = words.filter(word => 
            word.length > 3 && 
            !stopWords.has(word.toLowerCase()) && 
            /^[A-Z]/.test(word) && // Starts with capital letter (might be a proper noun)
            !/^(I|You|He|She|We|They|It|This|That|These|Those)$/i.test(word) // Not a pronoun
        );
        
        // Add unique potential topics as subject entities
        new Set(potentialTopics).forEach(topic => {
            entities.push({
                name: 'subject',
                value: topic,
                type: 'subject'
            });
        });
        
        return entities;
    }
    
    /**
     * Extract entities and return them in a simplified format for the UI
     * @param message The user message
     * @returns Array of simplified entities
     */
    public async extractSimplifiedEntities(message: string): Promise<Array<{name: string, value: string, type: string}>> {
        const entities = await this.extractEntities(message);
        return entities.map(entity => ({
            name: entity.name,
            value: entity.value,
            type: entity.type
        }));
    }
    
    /**
     * Get context-aware suggestions based on extracted intent and entities
     * @param intent The detected intent
     * @param entities The extracted entities
     * @returns Array of context-aware suggestions
     */
    public getSuggestionsFromIntent(intent: MessageIntent, entities: Entity[]): string[] {
        const suggestions: string[] = [];
        
        // Group entities by type for easier access
        const entityMap: Record<string, string[]> = {};
        for (const entity of entities) {
            if (!entityMap[entity.type]) {
                entityMap[entity.type] = [];
            }
            entityMap[entity.type].push(entity.value);
        }
        
        // Generate suggestions based on intent
        switch (intent) {
            case 'analyze_document':
                suggestions.push('Analyze the document structure');
                suggestions.push('Check for readability issues');
                suggestions.push('Identify areas for improvement');
                
                // Add document type specific suggestions
                if (entityMap['document_type']) {
                    const documentType = entityMap['document_type'][0].toLowerCase();
                    if (documentType === 'report') {
                        suggestions.push('Evaluate the executive summary');
                        suggestions.push('Analyze the data presentation');
                    } else if (documentType === 'letter') {
                        suggestions.push('Check the formatting and layout');
                        suggestions.push('Evaluate the tone and formality');
                    } else if (documentType === 'article' || documentType === 'paper') {
                        suggestions.push('Assess the logical flow of arguments');
                        suggestions.push('Check the citations and references');
                    }
                }
                break;
                
            case 'suggest_improvements':
                suggestions.push('Suggest overall improvements');
                suggestions.push('Recommend structural changes');
                
                // Add section specific improvement suggestions
                if (entityMap['section_type']) {
                    const sectionType = entityMap['section_type'][0].toLowerCase();
                    suggestions.push(`Improve the ${sectionType} section`);
                    
                    if (sectionType === 'introduction') {
                        suggestions.push('Make the introduction more engaging');
                        suggestions.push('Clarify the purpose in the introduction');
                    } else if (sectionType === 'conclusion') {
                        suggestions.push('Strengthen the conclusion');
                        suggestions.push('Add future directions to the conclusion');
                    } else if (sectionType === 'results' || sectionType === 'discussion') {
                        suggestions.push('Add visualizations to support findings');
                        suggestions.push('Clarify the implications of results');
                    }
                }
                break;
                
            case 'help_formatting':
                suggestions.push('Show formatting options');
                suggestions.push('Help with document styling');
                
                // Add specific formatting suggestions
                if (entityMap['formatting']) {
                    for (const format of entityMap['formatting']) {
                        suggestions.push(`Help with ${format} formatting`);
                    }
                } else {
                    suggestions.push('Format headings and sections');
                    suggestions.push('Create tables and lists');
                    suggestions.push('Use emphasis (bold, italic)');
                }
                break;
                
            case 'create_section':
                suggestions.push('Create a new section');
                
                // Suggest specific sections based on document type or existing sections
                if (entityMap['document_type']) {
                    const documentType = entityMap['document_type'][0].toLowerCase();
                    if (documentType === 'report') {
                        suggestions.push('Add an executive summary');
                        suggestions.push('Create a methodology section');
                    } else if (documentType === 'paper' || documentType === 'article') {
                        suggestions.push('Add a literature review');
                        suggestions.push('Create a discussion section');
                    } else if (documentType === 'letter') {
                        suggestions.push('Add a formal closing');
                        suggestions.push('Create a signature block');
                    }
                }
                
                // Default section suggestions
                if (suggestions.length < 3) {
                    suggestions.push('Add an introduction section');
                    suggestions.push('Create a conclusion section');
                    suggestions.push('Add a references section');
                }
                break;
                
            case 'generate_content':
                suggestions.push('Generate sample content');
                
                // Generate content suggestions based on entities
                if (entityMap['section_type']) {
                    for (const section of entityMap['section_type']) {
                        suggestions.push(`Generate ${section} content`);
                    }
                }
                
                if (entityMap['tone']) {
                    for (const tone of entityMap['tone']) {
                        suggestions.push(`Write content in a ${tone} tone`);
                    }
                }
                
                // Default content generation suggestions
                if (suggestions.length < 3) {
                    suggestions.push('Write an introduction paragraph');
                    suggestions.push('Generate a conclusion paragraph');
                    suggestions.push('Create sample bullet points');
                }
                break;
                
            case 'request_example':
                suggestions.push('Show document examples');
                
                // Example suggestions based on entities
                if (entityMap['document_type']) {
                    for (const docType of entityMap['document_type']) {
                        suggestions.push(`Show ${docType} examples`);
                    }
                }
                
                if (entityMap['section_type']) {
                    for (const section of entityMap['section_type']) {
                        suggestions.push(`See ${section} examples`);
                    }
                }
                
                // Default example suggestions
                if (suggestions.length < 3) {
                    suggestions.push('View formatting examples');
                    suggestions.push('See template examples');
                    suggestions.push('Show writing style examples');
                }
                break;
                
            case 'general_question':
            default:
                suggestions.push('Analyze my document');
                suggestions.push('Suggest improvements');
                suggestions.push('Help with formatting');
                suggestions.push('Create a new section');
                break;
        }
        
        // Ensure we have at least 3 suggestions
        while (suggestions.length < 3) {
            suggestions.push('Analyze my document');
            suggestions.push('Suggest improvements');
            suggestions.push('Help with formatting');
        }
        
        // Return at most 5 suggestions
        return [...new Set(suggestions)].slice(0, 5);
    }
}
