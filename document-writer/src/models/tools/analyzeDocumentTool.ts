import { BaseMCPTool, MCPToolResponse } from '../mcpTool';

/**
 * Tool to analyze document content and provide insights
 */
export class AnalyzeDocumentTool extends BaseMCPTool {
    constructor() {
        super(
            'analyze_document',
            'Analyzes document content and provides insights and suggestions',
            {
                type: 'object',
                properties: {
                    content: {
                        type: 'string',
                        description: 'The document content to analyze'
                    },
                    documentType: {
                        type: 'string',
                        description: 'The type of document (e.g., report, letter, proposal)',
                        enum: ['report', 'letter', 'proposal', 'specification', 'manual', 'other']
                    }
                },
                required: ['content'],
                additionalProperties: false,
                $schema: 'http://json-schema.org/draft-07/schema#'
            }
        );
    }

    /**
     * Execute the document analysis
     * @param args Arguments for the tool
     * @returns Promise that resolves to the analysis results
     */
    async execute(args: { content: string; documentType?: string }): Promise<MCPToolResponse> {
        try {
            // Extract arguments
            const { content, documentType = 'other' } = args;

            // In a real implementation, this would perform more sophisticated analysis
            // For Phase 1, we'll implement a simple analysis with mock data

            // Calculate basic statistics
            const wordCount = this.countWords(content);
            const sentenceCount = this.countSentences(content);
            const paragraphCount = this.countParagraphs(content);
            const averageWordLength = this.calculateAverageWordLength(content);
            
            // Generate sections analysis
            const sections = this.identifySections(content);
            
            // Generate suggestions based on document type
            const suggestions = this.generateSuggestions(content, documentType, wordCount);

            // Return the analysis results
            return {
                statistics: {
                    wordCount,
                    sentenceCount,
                    paragraphCount,
                    averageWordLength
                },
                sections,
                suggestions,
                documentType
            };
        } catch (error) {
            console.error('Error analyzing document:', error);
            throw new Error(`Failed to analyze document: ${error instanceof Error ? error.message : String(error)}`);
        }
    }

    /**
     * Count the number of words in the content
     * @param content Document content
     * @returns Number of words
     */
    private countWords(content: string): number {
        return content.split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Count the number of sentences in the content
     * @param content Document content
     * @returns Number of sentences
     */
    private countSentences(content: string): number {
        // Simple sentence counting - not perfect but good enough for demo
        return content.split(/[.!?]+/).filter(sentence => sentence.trim().length > 0).length;
    }

    /**
     * Count the number of paragraphs in the content
     * @param content Document content
     * @returns Number of paragraphs
     */
    private countParagraphs(content: string): number {
        // Count paragraphs by looking for double line breaks
        return content.split(/\n\s*\n/).filter(paragraph => paragraph.trim().length > 0).length;
    }

    /**
     * Calculate the average word length in the content
     * @param content Document content
     * @returns Average word length
     */
    private calculateAverageWordLength(content: string): number {
        const words = content.split(/\s+/).filter(word => word.length > 0);
        if (words.length === 0) {
            return 0;
        }
        
        const totalLength = words.reduce((sum, word) => sum + word.length, 0);
        return Number((totalLength / words.length).toFixed(2));
    }

    /**
     * Identify sections in the document content
     * @param content Document content
     * @returns Array of identified sections
     */
    private identifySections(content: string): Array<{ title: string; wordCount: number }> {
        // In a real implementation, this would use more sophisticated analysis
        // For Phase 1, we'll implement a simple section identification based on headings
        
        const lines = content.split('\n');
        const sections: Array<{ title: string; wordCount: number }> = [];
        
        let currentSection = '';
        let currentSectionContent = '';
        
        for (const line of lines) {
            // Simple heading detection - lines that are short and end with a colon
            // or lines that have all uppercase letters
            const trimmedLine = line.trim();
            
            if (
                (trimmedLine.length > 0 && trimmedLine.length < 50 && trimmedLine.endsWith(':')) ||
                (trimmedLine.length > 0 && trimmedLine === trimmedLine.toUpperCase() && trimmedLine.length < 50)
            ) {
                // Save the previous section if it exists
                if (currentSection && currentSectionContent) {
                    sections.push({
                        title: currentSection,
                        wordCount: this.countWords(currentSectionContent)
                    });
                }
                
                // Start a new section
                currentSection = trimmedLine;
                currentSectionContent = '';
            } else {
                // Add the line to the current section content
                currentSectionContent += line + '\n';
            }
        }
        
        // Add the last section if it exists
        if (currentSection && currentSectionContent) {
            sections.push({
                title: currentSection,
                wordCount: this.countWords(currentSectionContent)
            });
        }
        
        return sections;
    }

    /**
     * Generate suggestions for improving the document
     * @param content Document content
     * @param documentType Type of document
     * @param wordCount Number of words in the document
     * @returns Array of suggestions
     */
    private generateSuggestions(content: string, documentType: string, wordCount: number): string[] {
        const suggestions: string[] = [];
        
        // Word count suggestions
        if (wordCount < 100) {
            suggestions.push('Consider adding more content to make your document more comprehensive.');
        } else if (wordCount > 2000) {
            suggestions.push('Your document is quite long. Consider breaking it into smaller sections for readability.');
        }
        
        // Document type specific suggestions
        switch (documentType) {
            case 'report':
                suggestions.push('Reports typically benefit from an executive summary at the beginning.');
                if (!content.toLowerCase().includes('conclusion')) {
                    suggestions.push('Consider adding a conclusion section to summarize your findings.');
                }
                break;
                
            case 'letter':
                if (!content.toLowerCase().includes('dear')) {
                    suggestions.push('Letters typically start with a greeting (e.g., "Dear Sir/Madam").');
                }
                if (!content.toLowerCase().includes('sincerely') && !content.toLowerCase().includes('regards')) {
                    suggestions.push('Consider adding a closing (e.g., "Sincerely" or "Best regards") at the end of your letter.');
                }
                break;
                
            case 'proposal':
                if (!content.toLowerCase().includes('budget') && !content.toLowerCase().includes('cost')) {
                    suggestions.push('Proposals typically include budget or cost information.');
                }
                if (!content.toLowerCase().includes('timeline') && !content.toLowerCase().includes('schedule')) {
                    suggestions.push('Consider adding a timeline or schedule for the proposed work.');
                }
                break;
                
            case 'specification':
                if (!content.toLowerCase().includes('requirement')) {
                    suggestions.push('Technical specifications typically include clear requirements.');
                }
                break;
                
            case 'manual':
                if (!content.toLowerCase().includes('step')) {
                    suggestions.push('User manuals typically include step-by-step instructions.');
                }
                break;
        }
        
        // General suggestions
        if (this.calculateAverageWordLength(content) > 8) {
            suggestions.push('Your document uses many long words. Consider simplifying your language for better readability.');
        }
        
        // If no specific suggestions, add a generic one
        if (suggestions.length === 0) {
            suggestions.push('Your document looks good! Consider adding images or diagrams to enhance visual appeal.');
        }
        
        return suggestions;
    }
}
