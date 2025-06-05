/**
 * AI Client for connecting to LM Studio
 * LM Studio provides an OpenAI-compatible API at localhost:1234
 */
class AIClient {
    constructor(baseUrl = 'http://127.0.0.1:1234/v1') {
        this.baseUrl = baseUrl;
        this.isConnected = false;
        this.model = null;
        this.checkConnection();
    }

    /**
     * Check if LM Studio is running and accessible
     */
    async checkConnection() {
        try {
            const response = await fetch(`${this.baseUrl}/models`);
            const data = await response.json();
            
            if (data.data && data.data.length > 0) {
                this.isConnected = true;
                this.model = data.data[0].id; // Use the first available model
                this.updateStatus('connected', `Connected to ${this.model}`);
                console.log('Connected to LM Studio:', this.model);
            } else {
                throw new Error('No models available');
            }
        } catch (error) {
            this.isConnected = false;
            this.updateStatus('disconnected', 'LM Studio not accessible');
            console.error('Failed to connect to LM Studio:', error);
        }
    }

    /**
     * Update connection status in the UI
     */
    updateStatus(status, message) {
        const indicator = document.getElementById('status-indicator');
        const text = document.getElementById('status-text');
        
        if (indicator && text) {
            indicator.className = `status-indicator ${status}`;
            text.textContent = message;
        }
    }

    /**
     * Generate text using the AI model
     */
    async generateText(prompt, options = {}) {
        if (!this.isConnected) {
            throw new Error('Not connected to LM Studio. Please ensure LM Studio is running on port 1234.');
        }

        const requestBody = {
            model: this.model,
            messages: [
                {
                    role: 'user',
                    content: prompt
                }
            ],
            temperature: options.temperature || 0.7,
            max_tokens: options.maxTokens || 2000,
            top_p: options.topP || 0.9,
            stream: false
        };

        try {
            const response = await fetch(`${this.baseUrl}/chat/completions`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            
            if (data.choices && data.choices.length > 0) {
                return data.choices[0].message.content;
            } else {
                throw new Error('No response generated');
            }
        } catch (error) {
            console.error('Error generating text:', error);
            throw error;
        }
    }

    /**
     * Generate image descriptions for document enhancement
     */
    async generateImageDescriptions(documentContent, documentType) {
        const prompt = `Based on the following ${documentType} document content, suggest 2-3 high-value images, charts, or visualizations that would significantly enhance the document:

${documentContent.substring(0, 2000)}...

For each suggested image, provide:
1. Type: (photo/chart/diagram/infographic)
2. Description: A detailed description for generating the image
3. Placement: Where in the document it should appear
4. Caption: A suggested caption

Format as JSON array.`;

        try {
            const response = await this.generateText(prompt, {
                temperature: 0.6,
                maxTokens: 1000
            });
            
            // Try to parse JSON, fallback to simple parsing if needed
            try {
                return JSON.parse(response);
            } catch {
                // Fallback: create simple suggestions
                return [
                    {
                        type: "chart",
                        description: "bar chart showing key metrics",
                        placement: "After introduction",
                        caption: "Key Performance Indicators"
                    }
                ];
            }
        } catch (error) {
            console.error('Error generating image descriptions:', error);
            return [];
        }
    }

    /**
     * Generate document content based on document details
     */
    async generateDocument(documentDetails) {
        const { title, type, description, sections, author } = documentDetails;
        
        let prompt = `Generate a professional ${type} document with the following details:

Title: ${title}
Author: ${author || 'Document Writer'}
Description: ${description || 'No description provided'}

Please create a well-structured document with the following characteristics:
- Professional tone appropriate for a ${type} document
- Clear headings and sections
- Comprehensive content that fulfills the document's purpose
- Proper formatting suitable for business use

`;

        if (sections && sections.length > 0) {
            prompt += `Please include these specific sections:
${sections.map((section, index) => `${index + 1}. ${section.title}${section.content ? ': ' + section.content : ''}`).join('\n')}

`;
        } else {
            prompt += `Please create appropriate sections for this type of document.

`;
        }

        prompt += `Format the response as a complete document with proper markdown formatting. Include headers, bullet points, and other formatting as appropriate.

If appropriate for the document type, you may include 1-3 image placeholders in the format: [IMAGE: description of image] where visual content would significantly enhance understanding. Only suggest images if they truly add value to the document.`;

        const content = await this.generateText(prompt, {
            temperature: 0.7,
            maxTokens: 3000
        });

        // If we have the image generator, process image placeholders
        if (window.documentGenerator && window.documentGenerator.imageGenerator) {
            return await this.processImagePlaceholders(content, documentDetails.type);
        }

        return content;
    }

    /**
     * Process image placeholders in content
     */
    async processImagePlaceholders(content, documentType) {
        const imageGenerator = window.documentGenerator.imageGenerator;
        const placeholderRegex = /\[IMAGE:\s*([^\]]+)\]/g;
        let enhancedContent = content;
        let matches = [];
        let match;
        
        // First collect all matches to avoid infinite loops
        while ((match = placeholderRegex.exec(content)) !== null) {
            matches.push({
                fullMatch: match[0],
                description: match[1].trim()
            });
        }
        
        // Limit to maximum 5 images per document
        if (matches.length > 5) {
            console.warn(`Found ${matches.length} image placeholders, limiting to 5`);
            matches = matches.slice(0, 5);
        }
        
        // Process each match
        for (const matchData of matches) {
            const description = matchData.description;
            
            try {
                // Determine image type from description
                let imageType = 'photo';
                const lowerDesc = description.toLowerCase();
                
                // Check for data-related keywords that suggest a chart
                if (lowerDesc.includes('chart') || lowerDesc.includes('graph') || 
                    lowerDesc.includes('data') || lowerDesc.includes('statistics') ||
                    lowerDesc.includes('metrics') || lowerDesc.includes('percentage') ||
                    lowerDesc.includes('comparison') || lowerDesc.includes('trend') ||
                    lowerDesc.includes('analytics') || lowerDesc.includes('numbers') ||
                    lowerDesc.includes('sales') || lowerDesc.includes('revenue') ||
                    lowerDesc.includes('performance') || lowerDesc.includes('kpi') ||
                    lowerDesc.includes('dashboard')) {
                    imageType = 'chart';
                    console.log(`[AI CLIENT] Detected chart/data visualization: "${description}"`);
                } else if (lowerDesc.includes('diagram') || lowerDesc.includes('flow') || 
                          lowerDesc.includes('process') || lowerDesc.includes('workflow') ||
                          lowerDesc.includes('architecture') || lowerDesc.includes('schema') ||
                          lowerDesc.includes('structure') || lowerDesc.includes('hierarchy')) {
                    imageType = 'diagram';
                    console.log(`[AI CLIENT] Detected diagram: "${description}"`);
                } else if (lowerDesc.includes('infographic') || lowerDesc.includes('summary') ||
                          lowerDesc.includes('overview') || lowerDesc.includes('highlights')) {
                    imageType = 'infographic';
                    console.log(`[AI CLIENT] Detected infographic: "${description}"`);
                } else {
                    console.log(`[AI CLIENT] Detected photo/illustration: "${description}"`);
                }

                // Generate the image
                const imageData = await imageGenerator.generateImage(description, imageType);
                
                // Replace placeholder with actual image markdown
                const imageMarkdown = `\n\n![${imageData.alt}](${imageData.url})\n*${imageData.caption}*\n\n`;
                enhancedContent = enhancedContent.replace(matchData.fullMatch, imageMarkdown);
                
            } catch (error) {
                console.error('Error generating image:', error);
                // Keep the placeholder if image generation fails
            }
        }

        return enhancedContent;
    }

    /**
     * Generate content suggestions for a specific section
     */
    async generateSectionContent(sectionTitle, documentContext) {
        const prompt = `You are helping to write a ${documentContext.type} document titled "${documentContext.title}".

Please generate content for the section titled: "${sectionTitle}"

Document context:
- Type: ${documentContext.type}
- Title: ${documentContext.title}
- Description: ${documentContext.description || 'No description provided'}

Generate professional, relevant content for this section that fits well with the overall document. The content should be:
- Appropriate for the document type and context
- Well-structured with clear points
- Professional in tone
- Detailed enough to be useful

Return only the content for this section, formatted in markdown.`;

        return await this.generateText(prompt, {
            temperature: 0.6,
            maxTokens: 1000
        });
    }

    /**
     * Improve existing content
     */
    async improveContent(content, improvementType = 'general') {
        let prompt = '';
        
        switch (improvementType) {
            case 'grammar':
                prompt = `Please review and correct any grammar, spelling, and punctuation errors in the following text. Maintain the original meaning and tone:

${content}`;
                break;
            case 'clarity':
                prompt = `Please rewrite the following text to improve clarity and readability while maintaining the original meaning:

${content}`;
                break;
            case 'professional':
                prompt = `Please rewrite the following text to make it more professional and formal in tone:

${content}`;
                break;
            default:
                prompt = `Please improve the following text by making it clearer, more professional, and better structured:

${content}`;
        }

        return await this.generateText(prompt, {
            temperature: 0.5,
            maxTokens: 2000
        });
    }

    /**
     * Generate document outline
     */
    async generateOutline(documentDetails) {
        const { title, type, description } = documentDetails;
        
        const prompt = `Create a detailed outline for a ${type} document with the title "${title}".

Description: ${description || 'No description provided'}

Please generate a well-structured outline that includes:
- Main sections and subsections
- Brief descriptions of what each section should contain
- Logical flow and organization
- Professional structure appropriate for this document type

Format the outline using markdown with proper heading levels (##, ###, etc.) and bullet points.`;

        return await this.generateText(prompt, {
            temperature: 0.6,
            maxTokens: 1500
        });
    }

    /**
     * Generate title suggestions
     */
    async generateTitleSuggestions(documentType, description) {
        const prompt = `Generate 5 professional title suggestions for a ${documentType} document.

Context/Description: ${description || 'No description provided'}

Requirements:
- Titles should be professional and appropriate for the document type
- Clear and descriptive
- Engaging but not overly creative
- Suitable for business or academic use

Return only the 5 titles, one per line, without numbering or bullet points.`;

        return await this.generateText(prompt, {
            temperature: 0.8,
            maxTokens: 300
        });
    }
}

// Create global AI client instance
window.aiClient = new AIClient();