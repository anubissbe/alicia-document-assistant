import * as vscode from 'vscode';
import { TemplateManagerService } from '../services/templateManagerService';
import { DocumentTemplate } from '../models/documentTemplate';
import { TemplateVariable } from '../models/templateMetadata';

/**
 * Document type definition
 */
export interface DocumentType {
    /**
     * Name of the document type
     */
    name: string;

    /**
     * Description of the document type
     */
    description: string;

    /**
     * Keywords associated with this document type
     */
    keywords: string[];

    /**
     * Recommended sections for this document type
     */
    recommendedSections: string[];

    /**
     * Recommended variables for this document type
     */
    recommendedVariables: TemplateVariable[];
}

/**
 * Section suggestion with content preview
 */
export interface SectionSuggestion {
    /**
     * Section name
     */
    name: string;
    
    /**
     * Purpose of the section
     */
    purpose: string;
    
    /**
     * Preview content for the section
     */
    previewContent: string;
    
    /**
     * Recommendation confidence (0-1)
     */
    confidence: number;
}

/**
 * Template recommendation with matching score
 */
export interface TemplateRecommendation {
    /**
     * The document template
     */
    template: DocumentTemplate;
    
    /**
     * Matching score (0-1)
     */
    score: number;
    
    /**
     * Reason for recommendation
     */
    reason: string;
}

/**
 * Document analysis result
 */
export interface DocumentAnalysisResult {
    /**
     * Document type
     */
    documentType: DocumentType | undefined;
    
    /**
     * Improvement suggestions
     */
    suggestions: string[];
    
    /**
     * Missing sections
     */
    missingSections: string[];
    
    /**
     * Content quality issues
     */
    contentIssues: string[];
    
    /**
     * Structure recommendations
     */
    structureRecommendations: string[];
}

/**
 * Result of analyzing document content
 */
export interface ContentAnalysisResult {
    /**
     * Document statistics
     */
    statistics: {
        wordCount: number;
        sentenceCount: number;
        paragraphCount: number;
        averageWordLength: number;
    };
    
    /**
     * Identified sections
     */
    sections: Array<{ title: string; wordCount: number }>;
    
    /**
     * Improvement suggestions
     */
    suggestions: string[];
    
    /**
     * Document type
     */
    documentType: string;
}

/**
 * Class that handles AI-driven document generation and analysis
 */
export class AIDocumentGenerator {
    // Pre-defined document types
    private readonly documentTypes: DocumentType[] = [
        {
            name: 'Business Report',
            description: 'A formal report used in business contexts to present information, analysis, and recommendations',
            keywords: ['report', 'business', 'analysis', 'findings', 'recommendations', 'executive', 'summary'],
            recommendedSections: [
                'Executive Summary',
                'Introduction',
                'Background',
                'Methodology',
                'Findings',
                'Analysis',
                'Recommendations',
                'Conclusion',
                'References',
                'Appendices'
            ],
            recommendedVariables: [
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: 'Report title'
                },
                {
                    name: 'author',
                    type: 'string',
                    required: true,
                    description: 'Report author'
                },
                {
                    name: 'date',
                    type: 'date',
                    required: true,
                    description: 'Report date'
                },
                {
                    name: 'companyName',
                    type: 'string',
                    required: true,
                    description: 'Company name'
                },
                {
                    name: 'executiveSummary',
                    type: 'string',
                    required: true,
                    description: 'A brief overview of the report'
                }
            ]
        },
        {
            name: 'Technical Specification',
            description: 'A document that specifies technical requirements and details of a system or product',
            keywords: ['technical', 'specification', 'requirements', 'system', 'architecture', 'design', 'implementation'],
            recommendedSections: [
                'Introduction',
                'System Overview',
                'Requirements',
                'Architecture',
                'Design',
                'Implementation Details',
                'Testing Strategy',
                'Deployment',
                'Maintenance',
                'References'
            ],
            recommendedVariables: [
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: 'Specification title'
                },
                {
                    name: 'author',
                    type: 'string',
                    required: true,
                    description: 'Specification author'
                },
                {
                    name: 'version',
                    type: 'string',
                    required: true,
                    description: 'Specification version'
                },
                {
                    name: 'projectName',
                    type: 'string',
                    required: true,
                    description: 'Project name'
                },
                {
                    name: 'systemOverview',
                    type: 'string',
                    required: true,
                    description: 'Brief overview of the system'
                }
            ]
        },
        {
            name: 'Project Proposal',
            description: 'A document that proposes a project, outlining its scope, objectives, and plans',
            keywords: ['proposal', 'project', 'scope', 'objectives', 'timeline', 'budget', 'resources'],
            recommendedSections: [
                'Executive Summary',
                'Introduction',
                'Problem Statement',
                'Proposed Solution',
                'Scope',
                'Objectives',
                'Timeline',
                'Budget',
                'Resources',
                'Expected Outcomes',
                'Risks and Mitigation',
                'Conclusion'
            ],
            recommendedVariables: [
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: 'Proposal title'
                },
                {
                    name: 'author',
                    type: 'string',
                    required: true,
                    description: 'Proposal author'
                },
                {
                    name: 'date',
                    type: 'date',
                    required: true,
                    description: 'Proposal date'
                },
                {
                    name: 'clientName',
                    type: 'string',
                    required: true,
                    description: 'Client name'
                },
                {
                    name: 'projectDescription',
                    type: 'string',
                    required: true,
                    description: 'Brief description of the project'
                },
                {
                    name: 'budget',
                    type: 'number',
                    required: true,
                    description: 'Project budget'
                }
            ]
        },
        {
            name: 'User Manual',
            description: 'A document that provides instructions on how to use a product or service',
            keywords: ['manual', 'guide', 'instructions', 'user', 'tutorial', 'how-to', 'steps'],
            recommendedSections: [
                'Introduction',
                'Getting Started',
                'System Requirements',
                'Installation',
                'Basic Usage',
                'Advanced Features',
                'Troubleshooting',
                'FAQ',
                'Glossary',
                'Support Information'
            ],
            recommendedVariables: [
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: 'Manual title'
                },
                {
                    name: 'productName',
                    type: 'string',
                    required: true,
                    description: 'Product name'
                },
                {
                    name: 'version',
                    type: 'string',
                    required: true,
                    description: 'Product version'
                },
                {
                    name: 'releaseDate',
                    type: 'date',
                    required: true,
                    description: 'Release date'
                },
                {
                    name: 'companyName',
                    type: 'string',
                    required: true,
                    description: 'Company name'
                }
            ]
        },
        {
            name: 'Legal Contract',
            description: 'A formal legal agreement between parties',
            keywords: ['contract', 'agreement', 'legal', 'terms', 'conditions', 'parties', 'obligations', 'rights'],
            recommendedSections: [
                'Parties',
                'Definitions',
                'Scope of Work',
                'Term and Termination',
                'Payment Terms',
                'Confidentiality',
                'Intellectual Property',
                'Warranties',
                'Limitation of Liability',
                'Governing Law',
                'Dispute Resolution',
                'Signatures'
            ],
            recommendedVariables: [
                {
                    name: 'contractTitle',
                    type: 'string',
                    required: true,
                    description: 'Contract title'
                },
                {
                    name: 'effectiveDate',
                    type: 'date',
                    required: true,
                    description: 'Effective date'
                },
                {
                    name: 'party1Name',
                    type: 'string',
                    required: true,
                    description: 'First party name'
                },
                {
                    name: 'party1Address',
                    type: 'string',
                    required: true,
                    description: 'First party address'
                },
                {
                    name: 'party2Name',
                    type: 'string',
                    required: true,
                    description: 'Second party name'
                },
                {
                    name: 'party2Address',
                    type: 'string',
                    required: true,
                    description: 'Second party address'
                }
            ]
        },
        {
            name: 'Architecture Decision Record',
            description: 'A structured document for recording significant architectural decisions, their context, alternatives, and consequences',
            keywords: ['adr', 'architecture', 'decision', 'design', 'technical', 'solution', 'alternatives', 'consequences'],
            recommendedSections: [
                'ADR Header',
                'Context',
                'Decision',
                'Decision Matrix',
                'Consequences',
                'Implementation Notes',
                'Related Decisions',
                'Review Information',
                'References'
            ],
            recommendedVariables: [
                {
                    name: 'adrNumber',
                    type: 'string',
                    required: true,
                    description: 'ADR sequence number'
                },
                {
                    name: 'title',
                    type: 'string',
                    required: true,
                    description: 'Architecture decision title'
                },
                {
                    name: 'author',
                    type: 'string',
                    required: true,
                    description: 'Decision author or responsible team'
                },
                {
                    name: 'date',
                    type: 'date',
                    required: true,
                    description: 'Decision date'
                },
                {
                    name: 'status',
                    type: 'string',
                    required: true,
                    description: 'Decision status (Proposed, Accepted, Implemented, etc.)'
                },
                {
                    name: 'context',
                    type: 'string',
                    required: true,
                    description: 'Technical and business context for the decision'
                },
                {
                    name: 'decision',
                    type: 'string',
                    required: true,
                    description: 'The chosen solution and rationale'
                },
                {
                    name: 'alternatives',
                    type: 'string',
                    required: true,
                    description: 'Alternative options that were considered'
                },
                {
                    name: 'positiveConsequences',
                    type: 'string',
                    required: true,
                    description: 'Positive outcomes from this decision'
                },
                {
                    name: 'negativeConsequences',
                    type: 'string',
                    required: true,
                    description: 'Negative consequences and trade-offs'
                }
            ]
        }
    ];

    // Section purpose descriptions
    private readonly sectionPurposes: Record<string, string> = {
        'Executive Summary': 'Provides a brief overview of the entire document, highlighting key points and conclusions.',
        'Introduction': 'Introduces the document\'s purpose, scope, and background information.',
        'Background': 'Provides context and historical information relevant to the document.',
        'Methodology': 'Describes the methods, processes, and approaches used.',
        'Findings': 'Presents the results, data, and observations from research or analysis.',
        'Analysis': 'Interprets the findings, explaining their significance and implications.',
        'Recommendations': 'Suggests actions, solutions, or next steps based on the analysis.',
        'Conclusion': 'Summarizes the document and reinforces the main points and takeaways.',
        'System Overview': 'Provides a high-level description of the system architecture and components.',
        'Requirements': 'Specifies the functional and non-functional requirements of the system.',
        'Architecture': 'Describes the system\'s architectural design, components, and interactions.',
        'Design': 'Details the specific design decisions, patterns, and implementations.',
        'Implementation Details': 'Explains how the design is implemented, including code structures and technologies.',
        'Testing Strategy': 'Outlines the approach to testing, including test types, coverage, and procedures.',
        'Deployment': 'Describes how the system will be deployed, including environments and processes.',
        'Maintenance': 'Explains how the system will be maintained, including updates and support.',
        'Problem Statement': 'Clearly defines the problem that needs to be addressed.',
        'Proposed Solution': 'Outlines the solution being proposed to address the problem.',
        'Scope': 'Defines the boundaries of the project, including what is and isn\'t included.',
        'Objectives': 'Lists the specific goals and objectives that the project aims to achieve.',
        'Timeline': 'Presents the schedule and milestones for the project.',
        'Budget': 'Details the financial aspects of the project, including costs and resources.',
        'Resources': 'Identifies the resources required for the project, including personnel and equipment.',
        'Expected Outcomes': 'Describes the anticipated results and benefits of the project.',
        'Risks and Mitigation': 'Identifies potential risks and strategies to mitigate them.',
        'Getting Started': 'Provides initial setup and usage information for beginners.',
        'System Requirements': 'Lists the hardware and software requirements for using the product.',
        'Installation': 'Provides step-by-step instructions for installing the product.',
        'Basic Usage': 'Explains the fundamental operations and features of the product.',
        'Advanced Features': 'Describes more complex and specialized functionality.',
        'Troubleshooting': 'Provides solutions to common problems and issues.',
        'FAQ': 'Answers frequently asked questions about the product or service.',
        'Glossary': 'Defines specialized terms and concepts used in the document.',
        'Support Information': 'Provides contact information and resources for getting help.',
        'Parties': 'Identifies and describes the parties involved in the agreement.',
        'Definitions': 'Defines key terms used throughout the contract.',
        'Scope of Work': 'Describes the work to be performed under the contract.',
        'Term and Termination': 'Specifies the duration of the agreement and conditions for termination.',
        'Payment Terms': 'Details the payment amounts, schedules, and methods.',
        'Confidentiality': 'Addresses the handling of confidential information.',
        'Intellectual Property': 'Specifies ownership and rights to intellectual property.',
        'Warranties': 'Describes the guarantees made by each party.',
        'Limitation of Liability': 'Defines the extent of liability for each party.',
        'Governing Law': 'Specifies which laws govern the interpretation of the contract.',
        'Dispute Resolution': 'Outlines the process for resolving disputes between parties.',
        'Signatures': 'Provides space for parties to sign the agreement.',
        'ADR Header': 'Contains essential ADR metadata including number, title, status, author, date, and stakeholders.',
        'Context': 'Provides technical and business background, constraints, and forces that influenced the decision.',
        'Decision': 'States the chosen solution and the rationale behind selecting this option.',
        'Decision Matrix': 'Structured comparison of alternatives with pros, cons, and evaluation scores.',
        'Consequences': 'Documents positive, negative, and neutral outcomes resulting from this decision.',
        'Implementation Notes': 'Provides guidance on implementing the decision including timeline and considerations.',
        'Related Decisions': 'Links to other ADRs and architectural decisions that influence or are influenced by this decision.',
        'Review Information': 'Specifies review criteria and dates for re-evaluating this decision.',
        'References': 'Lists supporting documentation, research, and external resources.'
    };

    constructor(
        private readonly context: vscode.ExtensionContext,
        private readonly templateManagerService: TemplateManagerService
    ) {}

    /**
     * Detect the type of document based on content or keywords
     * @param content The document content or keywords
     * @returns The detected document type
     */
    public detectDocumentType(content: string): DocumentType | undefined {
        // Convert content to lowercase for case-insensitive matching
        const lowercaseContent = content.toLowerCase();

        // Calculate scores for each document type based on keyword matches and content analysis
        const scores: Map<DocumentType, number> = new Map();

        for (const docType of this.documentTypes) {
            let score = 0;
            
            // Check each keyword
            for (const keyword of docType.keywords) {
                // Count occurrences of the keyword in the content
                const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
                const matches = lowercaseContent.match(regex);
                
                if (matches) {
                    // Weight matches by their count and position (earlier matches are more important)
                    const matchCount = matches.length;
                    const firstPosition = lowercaseContent.indexOf(keyword.toLowerCase());
                    const positionWeight = firstPosition < 200 ? 1.5 : 1; // Higher weight for keywords appearing early
                    
                    score += matchCount * positionWeight;
                }
            }
            
            // Check for presence of recommended sections
            for (const section of docType.recommendedSections) {
                if (lowercaseContent.includes(section.toLowerCase())) {
                    score += 2; // Sections are strong indicators of document type
                }
            }
            
            // Check for structural patterns specific to document types
            if (docType.name === 'Business Report' && 
                (lowercaseContent.includes('executive summary') || lowercaseContent.includes('findings'))) {
                score += 5;
            } else if (docType.name === 'Technical Specification' && 
                (lowercaseContent.includes('architecture') || lowercaseContent.includes('implementation'))) {
                score += 5;
            } else if (docType.name === 'Project Proposal' && 
                (lowercaseContent.includes('proposed solution') || lowercaseContent.includes('budget'))) {
                score += 5;
            } else if (docType.name === 'User Manual' && 
                (lowercaseContent.includes('how to') || lowercaseContent.includes('step') || lowercaseContent.includes('troubleshooting'))) {
                score += 5;
            } else if (docType.name === 'Legal Contract' && 
                (lowercaseContent.includes('hereby agrees') || lowercaseContent.includes('terms and conditions'))) {
                score += 5;
            } else if (docType.name === 'Architecture Decision Record' && 
                (lowercaseContent.includes('adr') || lowercaseContent.includes('architecture decision') || 
                 lowercaseContent.includes('decision record') || lowercaseContent.includes('alternatives considered'))) {
                score += 5;
            }
            
            scores.set(docType, score);
        }

        // Find the document type with the highest score
        let bestMatch: DocumentType | undefined;
        let highestScore = 0;

        for (const [docType, score] of scores.entries()) {
            if (score > highestScore) {
                highestScore = score;
                bestMatch = docType;
            }
        }

        // Only return a match if the score is above a threshold
        const threshold = 3; // Minimum score to consider a valid match
        return highestScore >= threshold ? bestMatch : undefined;
    }

    /**
     * Suggest sections for a document based on its type and content
     * @param documentType The document type
     * @param existingContent Optional existing content to analyze
     * @returns An array of section suggestions with confidence scores
     */
    public suggestSections(documentType: DocumentType, existingContent?: string): SectionSuggestion[] {
        const suggestions: SectionSuggestion[] = [];
        const existingSections: Set<string> = new Set();
        
        // If existing content is provided, extract existing sections
        if (existingContent) {
            const potentialSections = this.extractSectionsFromContent(existingContent);
            potentialSections.forEach(section => existingSections.add(section));
        }
        
        // Create suggestions for recommended sections that don't already exist
        for (const section of documentType.recommendedSections) {
            if (!existingSections.has(section)) {
                // Calculate confidence score based on how essential the section is for this document type
                let confidence = 0.8; // Default confidence
                
                // Adjust confidence based on document type and section importance
                if (section === 'Executive Summary' && 
                    (documentType.name === 'Business Report' || documentType.name === 'Project Proposal')) {
                    confidence = 0.95; // Essential for these document types
                } else if (section === 'Requirements' && documentType.name === 'Technical Specification') {
                    confidence = 0.95; // Essential for tech specs
                } else if (section === 'Introduction') {
                    confidence = 0.9; // Generally important for all document types
                } else if (section === 'Conclusion') {
                    confidence = 0.85; // Generally important for most document types
                }
                
                // Lower confidence for optional sections
                if (section === 'Appendices' || section === 'References' || section === 'Glossary') {
                    confidence = 0.6;
                }
                
                // Create section suggestion
                suggestions.push({
                    name: section,
                    purpose: this.sectionPurposes[section] || `Standard section for ${documentType.name} documents`,
                    previewContent: this.generateSectionContent(documentType, section),
                    confidence
                });
            }
        }
        
        // Sort suggestions by confidence
        return suggestions.sort((a, b) => b.confidence - a.confidence);
    }

    /**
     * Extract section headings from document content
     * @param content Document content
     * @returns Array of identified section headings
     */
    private extractSectionsFromContent(content: string): string[] {
        const sections: string[] = [];
        const lines = content.split('\n');
        
        // Look for potential section headings
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();
            
            // Skip empty lines
            if (line.length === 0) {
                continue;
            }
            
            // Check for heading patterns:
            // 1. All caps line
            // 2. Line ending with colon
            // 3. Line with a common section name
            // 4. Line followed by underline characters (=== or ---)
            const isAllCaps = line === line.toUpperCase() && line.length > 3;
            const endsWithColon = line.endsWith(':');
            const isCommonSectionName = Object.keys(this.sectionPurposes).some(section => 
                line.toLowerCase() === section.toLowerCase());
            const isUnderlined = i < lines.length - 1 && 
                (lines[i + 1].trim().startsWith('===') || lines[i + 1].trim().startsWith('---'));
            
            if (isAllCaps || endsWithColon || isCommonSectionName || isUnderlined) {
                // Clean up the section name (remove trailing colon, etc.)
                let sectionName = line;
                if (endsWithColon) {
                    sectionName = sectionName.substring(0, sectionName.length - 1);
                }
                
                sections.push(sectionName);
            }
        }
        
        return sections;
    }

    /**
     * Identify data requirements for a document based on its type and content
     * @param documentType The document type
     * @param content Optional document content for context
     * @returns An array of required variables with additional context
     */
    public identifyDataRequirements(documentType: DocumentType, content?: string): Array<TemplateVariable & { suggested?: boolean; context?: string }> {
        // Start with the base requirements for the document type
        const requirements = [...documentType.recommendedVariables];
        
        // Enhance with additional context and suggestions
        const enhancedRequirements = requirements.map(variable => {
            const enhancedVariable: TemplateVariable & { suggested?: boolean; context?: string } = { 
                ...variable,
                suggested: false
            };
            
            // Add context based on variable name and document type
            switch (variable.name) {
                case 'title':
                    enhancedVariable.context = `The title should clearly reflect the purpose of the ${documentType.name.toLowerCase()}.`;
                    break;
                case 'author':
                    enhancedVariable.context = 'The individual or organization responsible for creating this document.';
                    break;
                case 'date':
                    enhancedVariable.context = 'The date when this document was created or last updated.';
                    break;
                case 'companyName':
                    enhancedVariable.context = 'The name of the company or organization this document is associated with.';
                    break;
                case 'executiveSummary':
                    enhancedVariable.context = 'A brief overview (1-2 paragraphs) highlighting the key points of the document.';
                    break;
                case 'budget':
                    enhancedVariable.context = 'The estimated total cost for the proposed project, including breakdowns if applicable.';
                    break;
            }
            
            return enhancedVariable;
        });
        
        // If content is provided, analyze it to suggest additional variables
        if (content) {
            // Extract potential variable values from content
            const extractedData = this.extractDataFromContent(content, documentType);
            
            // Add suggested variables based on content analysis
            for (const [key, value] of Object.entries(extractedData)) {
                // Check if this variable already exists in requirements
                const existingIndex = enhancedRequirements.findIndex(v => v.name === key);
                
                if (existingIndex >= 0) {
                    // Add context to existing variable
                    enhancedRequirements[existingIndex].context = 
                        `${enhancedRequirements[existingIndex].context || ''} Suggested value: "${value}"`;
                } else {
                    // Add as a new suggested variable
                    enhancedRequirements.push({
                        name: key,
                        type: typeof value === 'number' ? 'number' : 'string',
                        required: false,
                        description: `Auto-detected variable from document content`,
                        suggested: true,
                        context: `Suggested value: "${value}"`
                    });
                }
            }
        }
        
        return enhancedRequirements;
    }

    /**
     * Extract potential data values from document content
     * @param content Document content
     * @param documentType Document type for context
     * @returns Object with extracted key-value pairs
     */
    private extractDataFromContent(content: string, documentType: DocumentType): Record<string, string | number> {
        const extractedData: Record<string, string | number> = {};
        
        // Extract potential title (from first line or header section)
        const lines = content.split('\n');
        if (lines.length > 0 && lines[0].trim().length > 0) {
            extractedData.title = lines[0].trim();
        }
        
        // Extract potential dates (simple regex for common date formats)
        const dateMatches = content.match(/\b\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}\b/g);
        if (dateMatches && dateMatches.length > 0) {
            extractedData.date = dateMatches[0];
        }
        
        // Extract budget figures for proposals
        if (documentType.name === 'Project Proposal') {
            const budgetMatches = content.match(/budget:?\s*\$?(\d{1,3}(,\d{3})*(\.\d{2})?)/i);
            if (budgetMatches && budgetMatches.length > 1) {
                const budgetString = budgetMatches[1].replace(/,/g, '');
                extractedData.budget = parseFloat(budgetString);
            }
        }
        
        // Extract company or organization names
        // This is a simplified approach - a real implementation would use more sophisticated NER
        const companyIndicators = ['Inc.', 'LLC', 'Ltd.', 'Corporation', 'Company', 'GmbH'];
        for (const indicator of companyIndicators) {
            const regex = new RegExp(`\\b([A-Z][A-Za-z0-9]+(\\s[A-Z][A-Za-z0-9]+)*)\\s${indicator}\\b`);
            const match = content.match(regex);
            if (match && match.length > 1) {
                extractedData.companyName = `${match[1]} ${indicator}`;
                break;
            }
        }
        
        return extractedData;
    }

    /**
     * Recommend templates based on document type and context
     * @param documentType The document type
     * @param content Optional document content for context
     * @returns An array of template recommendations with scores and reasons
     */
    public recommendTemplates(documentType: DocumentType, content?: string): TemplateRecommendation[] {
        const allTemplates = this.templateManagerService.getTemplates();
        const recommendations: TemplateRecommendation[] = [];

        // Find templates that match the document type
        for (const template of allTemplates) {
            let score = 0;
            let reasons: string[] = [];
            
            // Check if template metadata exists and has a category that matches the document type
            if (template.metadata && template.metadata.category && 
                template.metadata.category.toLowerCase() === documentType.name.toLowerCase()) {
                score += 0.5;
                reasons.push(`Template category "${template.metadata.category}" matches document type`);
            }

            // Check if any tags match keywords
            if (template.metadata && template.metadata.tags) {
                const matchingTags = template.metadata.tags.filter((tag: string) => 
                    documentType.keywords.includes(tag.toLowerCase()));
                
                if (matchingTags.length > 0) {
                    const tagScore = 0.1 * matchingTags.length;
                    score += tagScore;
                    reasons.push(`Template has ${matchingTags.length} matching keywords: ${matchingTags.join(', ')}`);
                }
            }

            // Check for keyword matches in template name or description
            const templateNameLower = template.name.toLowerCase();
            const templateDescLower = template.description.toLowerCase();
            
            const nameMatches = documentType.keywords.filter(keyword => templateNameLower.includes(keyword));
            if (nameMatches.length > 0) {
                const nameScore = 0.2 * nameMatches.length;
                score += nameScore;
                reasons.push(`Template name contains matching keywords: ${nameMatches.join(', ')}`);
            }
            
            const descMatches = documentType.keywords.filter(keyword => templateDescLower.includes(keyword));
            if (descMatches.length > 0 && descMatches.some(match => !nameMatches.includes(match))) {
                const descScore = 0.1 * descMatches.length;
                score += descScore;
                reasons.push(`Template description contains matching keywords`);
            }
            
            // If content is provided, check for content relevance
            if (content) {
                // Count how many recommended sections for this document type appear in the content
                const contentLower = content.toLowerCase();
                const sectionMatches = documentType.recommendedSections.filter(section => 
                    contentLower.includes(section.toLowerCase()));
                
                if (sectionMatches.length > 0) {
                    const sectionMatchRatio = sectionMatches.length / documentType.recommendedSections.length;
                    const sectionScore = 0.3 * sectionMatchRatio;
                    score += sectionScore;
                    reasons.push(`Content includes ${sectionMatches.length} of ${documentType.recommendedSections.length} recommended sections`);
                }
            }
            
            // Only include templates with a minimum score
            if (score >= 0.2) {
                recommendations.push({
                    template,
                    score,
                    reason: reasons.join('. ')
                });
            }
        }

        // Sort recommendations by score (highest first)
        return recommendations.sort((a, b) => b.score - a.score);
    }

    /**
     * Generate content for a document section based on document type and section name
     * @param documentType The document type
     * @param sectionName The name of the section
     * @param context Optional context information to customize content
     * @returns Generated content for the section
     */
    public generateSectionContent(
        documentType: DocumentType, 
        sectionName: string,
        _context?: { [key: string]: any }
    ): string {
        // This is a simplified implementation - in a real application, this would use
        // AI APIs like OpenAI to generate more sophisticated content
        // Context parameter is available for future enhancement
        
        // For Phase 1, return placeholder content based on section name and document type
        const placeholders: Record<string, Record<string, string>> = {
            'Executive Summary': {
                'Business Report': 'This report provides an analysis of [topic] and offers recommendations for [goal]. Key findings include [finding 1], [finding 2], and [finding 3].',
                'Project Proposal': 'This proposal outlines a project to [objective] with an estimated budget of [amount] and timeline of [duration]. The proposed solution addresses [problem] through [approach].',
                default: 'This document provides an overview of [topic] and addresses [purpose].'
            },
            'Introduction': {
                default: 'This document aims to [purpose]. It provides information about [topic] and is intended for [audience].'
            },
            'Background': {
                default: 'The context for this document includes [historical information] and [current situation]. This background information is relevant because [explanation].'
            },
            'Methodology': {
                default: 'The approach used in this document involves [method 1], [method 2], and [method 3]. These methods were selected because [rationale].'
            },
            'Findings': {
                default: 'The key findings include: 1) [finding 1], 2) [finding 2], and 3) [finding 3]. These findings are based on [data source] and indicate [implication].'
            },
            'Analysis': {
                default: 'Analysis of the findings reveals [insight 1], [insight 2], and [insight 3]. These insights suggest [interpretation] with implications for [area of impact].'
            },
            'Recommendations': {
                default: 'Based on the analysis, the following recommendations are proposed: 1) [recommendation 1], 2) [recommendation 2], and 3) [recommendation 3].'
            },
            'Conclusion': {
                default: 'In conclusion, [summary of key points]. The next steps include [action 1], [action 2], and [action 3].'
            },
            'System Overview': {
                'Technical Specification': 'The system consists of [component 1], [component 2], and [component 3]. These components interact through [interface/protocol] to achieve [functionality].',
                default: 'The system includes multiple components that work together to achieve the intended functionality.'
            },
            'Requirements': {
                'Technical Specification': 'The system must meet the following requirements: 1) [requirement 1], 2) [requirement 2], and 3) [requirement 3]. These requirements are prioritized based on [criteria].',
                default: 'The requirements for this project include functional and non-functional specifications that must be met for successful implementation.'
            },
            'ADR Header': {
                'Architecture Decision Record': 'ADR Number: [ADR-XXX] | Title: [Decision Title] | Status: [Proposed/Accepted/Implemented] | Author: [Decision Author] | Date: [Decision Date]',
                default: 'Document header information including identification, status, and metadata.'
            },
            'Context': {
                'Architecture Decision Record': 'This decision addresses [problem statement] in the context of [system/project name]. Current constraints include [technical constraints], [business constraints], and [organizational constraints]. Key forces driving this decision are [performance requirements], [scalability needs], [maintainability concerns], and [team expertise].',
                default: 'Background information and context surrounding this topic.'
            },
            'Decision': {
                'Architecture Decision Record': 'We have decided to [chosen solution] because [primary rationale]. This approach was selected over alternatives due to [key differentiating factors] and aligns with our [architectural principles/goals].',
                default: 'The primary decision or conclusion reached.'
            },
            'Decision Matrix': {
                'Architecture Decision Record': 'The following alternatives were evaluated: 1) [Option 1] - Pros: [benefits], Cons: [drawbacks], Score: [X/10], 2) [Option 2] - Pros: [benefits], Cons: [drawbacks], Score: [Y/10], 3) [Option 3] - Pros: [benefits], Cons: [drawbacks], Score: [Z/10].',
                default: 'Comparison matrix of available options and their evaluation.'
            },
            'Consequences': {
                'Architecture Decision Record': 'Positive: [improved performance], [better maintainability], [reduced complexity]. Negative: [increased learning curve], [additional tooling requirements], [potential migration effort]. Neutral: [no significant impact on existing systems].',
                default: 'Expected outcomes and implications of this decision.'
            },
            'Implementation Notes': {
                'Architecture Decision Record': 'Implementation should begin with [first step], followed by [subsequent steps]. Key considerations include [technical requirements], [timeline constraints], and [resource allocation]. Expected completion: [timeframe].',
                default: 'Guidance and considerations for implementing this decision.'
            },
            'Related Decisions': {
                'Architecture Decision Record': 'This decision is related to [ADR-XXX: Related Decision 1] and may influence [ADR-YYY: Future Decision]. Dependencies include [prerequisite decisions] and impacts [downstream decisions].',
                default: 'Connections to other decisions and dependencies.'
            },
            'Review Information': {
                'Architecture Decision Record': 'This decision should be reviewed when [triggering conditions] occur, such as [performance issues], [technology changes], or [business requirement changes]. Next review date: [date].',
                default: 'Information about when and how this should be reviewed.'
            },
            'References': {
                'Architecture Decision Record': 'Supporting documentation: [link 1], [link 2]. Research sources: [article/paper references]. Benchmarks and analysis: [performance data], [comparison studies].',
                default: 'Supporting documentation and reference materials.'
            }
        };
        
        // Get placeholder content for the section
        const sectionPlaceholders = placeholders[sectionName] || { default: `Content for ${sectionName} section.` };
        const documentTypeName = documentType.name;
        const content = sectionPlaceholders[documentTypeName] || sectionPlaceholders.default;
        
        return content;
    }
    
    /**
     * Analyze document content and provide insights
     * @param content Document content to analyze
     * @param documentType Type of document (optional, will be detected if not provided)
     * @returns Analysis results with statistics and suggestions
     */
    public analyzeDocument(content: string, documentType?: string): ContentAnalysisResult {
        // For Phase 1, this is a simple implementation with mock data
        // In a real implementation, this would use more sophisticated analysis techniques
        
        // Calculate basic statistics
        const wordCount = this.countWords(content);
        const sentenceCount = this.countSentences(content);
        const paragraphCount = this.countParagraphs(content);
        const averageWordLength = this.calculateAverageWordLength(content);
        
        // Generate sections analysis
        const sections = this.identifySections(content);
        
        // Generate suggestions based on document type
        const suggestions = this.generateSuggestions(content, documentType || 'other', wordCount);
        
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
            documentType: documentType || 'other'
        };
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
        // This is a simplified implementation of section identification
        const sections: Array<{ title: string; wordCount: number }> = [];
        const potentialSections = this.extractSectionsFromContent(content);
        
        // For each identified section, calculate word count
        for (let i = 0; i < potentialSections.length; i++) {
            const sectionTitle = potentialSections[i];
            const nextSectionIndex = i < potentialSections.length - 1 ? 
                content.indexOf(potentialSections[i + 1]) : content.length;
            
            // Extract section content
            const sectionStartIndex = content.indexOf(sectionTitle) + sectionTitle.length;
            const sectionContent = content.substring(sectionStartIndex, nextSectionIndex);
            
            // Calculate word count for this section
            const wordCount = this.countWords(sectionContent);
            
            sections.push({
                title: sectionTitle,
                wordCount
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
        switch (documentType.toLowerCase()) {
            case 'report':
            case 'business report':
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
            case 'project proposal':
                if (!content.toLowerCase().includes('budget') && !content.toLowerCase().includes('cost')) {
                    suggestions.push('Proposals typically include budget or cost information.');
                }
                if (!content.toLowerCase().includes('timeline') && !content.toLowerCase().includes('schedule')) {
                    suggestions.push('Consider adding a timeline or schedule for the proposed work.');
                }
                break;
                
            case 'specification':
            case 'technical specification':
                if (!content.toLowerCase().includes('requirement')) {
                    suggestions.push('Technical specifications typically include clear requirements.');
                }
                break;
                
            case 'manual':
            case 'user manual':
                if (!content.toLowerCase().includes('step')) {
                    suggestions.push('User manuals typically include step-by-step instructions.');
                }
                break;
                
            case 'adr':
            case 'architecture decision record':
                if (!content.toLowerCase().includes('context') && !content.toLowerCase().includes('background')) {
                    suggestions.push('ADRs should include detailed context and background information.');
                }
                if (!content.toLowerCase().includes('alternative') && !content.toLowerCase().includes('option')) {
                    suggestions.push('Consider documenting alternative solutions that were evaluated.');
                }
                if (!content.toLowerCase().includes('consequence') && !content.toLowerCase().includes('impact')) {
                    suggestions.push('ADRs should document both positive and negative consequences of the decision.');
                }
                if (!content.toLowerCase().includes('rationale') && !content.toLowerCase().includes('reason')) {
                    suggestions.push('Include clear rationale for why this decision was made.');
                }
                if (!content.toLowerCase().includes('status')) {
                    suggestions.push('Specify the current status of the decision (Proposed, Accepted, Implemented, etc.).');
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
