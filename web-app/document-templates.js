/**
 * Document templates for quick start
 */
class DocumentTemplates {
    constructor() {
        this.templates = {
            business: {
                'business-proposal': {
                    name: 'Business Proposal',
                    icon: '📋',
                    description: 'Professional business proposal with executive summary',
                    sections: [
                        { title: 'Executive Summary', content: 'Brief overview of the proposal' },
                        { title: 'Company Background', content: 'Information about your company' },
                        { title: 'Problem Statement', content: 'The problem or opportunity being addressed' },
                        { title: 'Proposed Solution', content: 'Your proposed solution or approach' },
                        { title: 'Benefits & Value Proposition', content: 'Key benefits and value' },
                        { title: 'Implementation Timeline', content: 'Project timeline and milestones' },
                        { title: 'Budget & Pricing', content: 'Cost breakdown and pricing structure' },
                        { title: 'Terms & Conditions', content: 'Legal terms and conditions' },
                        { title: 'Next Steps', content: 'Call to action and next steps' }
                    ]
                },
                'business-plan': {
                    name: 'Business Plan',
                    icon: '📊',
                    description: 'Comprehensive business plan for startups or new ventures',
                    sections: [
                        { title: 'Executive Summary', content: 'Business overview and key highlights' },
                        { title: 'Company Description', content: 'Detailed company information' },
                        { title: 'Market Analysis', content: 'Industry and target market analysis' },
                        { title: 'Organization & Management', content: 'Organizational structure' },
                        { title: 'Products & Services', content: 'Offerings description' },
                        { title: 'Marketing & Sales Strategy', content: 'Go-to-market strategy' },
                        { title: 'Financial Projections', content: 'Revenue and expense forecasts' },
                        { title: 'Funding Requirements', content: 'Capital needs and use of funds' },
                        { title: 'Appendix', content: 'Supporting documents' }
                    ]
                },
                'meeting-minutes': {
                    name: 'Meeting Minutes',
                    icon: '📝',
                    description: 'Professional meeting minutes template',
                    sections: [
                        { title: 'Meeting Details', content: 'Date, time, location, attendees' },
                        { title: 'Agenda Items', content: 'Topics discussed' },
                        { title: 'Key Discussions', content: 'Main points of discussion' },
                        { title: 'Decisions Made', content: 'Agreed decisions' },
                        { title: 'Action Items', content: 'Tasks and responsibilities' },
                        { title: 'Next Meeting', content: 'Date and agenda for next meeting' }
                    ]
                }
            },
            technical: {
                'technical-specification': {
                    name: 'Technical Specification',
                    icon: '⚙️',
                    description: 'Detailed technical specification document',
                    sections: [
                        { title: 'Overview', content: 'System overview and purpose' },
                        { title: 'Scope & Objectives', content: 'Project scope and goals' },
                        { title: 'System Architecture', content: 'High-level architecture design' },
                        { title: 'Functional Requirements', content: 'Detailed functional specs' },
                        { title: 'Non-Functional Requirements', content: 'Performance, security, etc.' },
                        { title: 'Data Model', content: 'Database and data structures' },
                        { title: 'API Specifications', content: 'API endpoints and contracts' },
                        { title: 'Security Considerations', content: 'Security requirements' },
                        { title: 'Testing Strategy', content: 'Test plans and criteria' },
                        { title: 'Deployment Plan', content: 'Deployment process and requirements' }
                    ]
                },
                'user-guide': {
                    name: 'User Guide',
                    icon: '📖',
                    description: 'Comprehensive user documentation',
                    sections: [
                        { title: 'Introduction', content: 'Product overview' },
                        { title: 'Getting Started', content: 'Initial setup and configuration' },
                        { title: 'User Interface Overview', content: 'UI components and navigation' },
                        { title: 'Features & Functions', content: 'Detailed feature descriptions' },
                        { title: 'Step-by-Step Tutorials', content: 'How-to guides' },
                        { title: 'Troubleshooting', content: 'Common issues and solutions' },
                        { title: 'FAQ', content: 'Frequently asked questions' },
                        { title: 'Glossary', content: 'Technical terms and definitions' }
                    ]
                }
            },
            academic: {
                'research-paper': {
                    name: 'Research Paper',
                    icon: '🔬',
                    description: 'Academic research paper with standard sections',
                    sections: [
                        { title: 'Abstract', content: 'Brief summary of the research' },
                        { title: 'Introduction', content: 'Background and research question' },
                        { title: 'Literature Review', content: 'Review of existing research' },
                        { title: 'Methodology', content: 'Research methods and approach' },
                        { title: 'Results', content: 'Research findings and data' },
                        { title: 'Discussion', content: 'Analysis and interpretation' },
                        { title: 'Conclusion', content: 'Summary and implications' },
                        { title: 'References', content: 'Bibliography and citations' },
                        { title: 'Appendices', content: 'Supplementary materials' }
                    ]
                },
                'thesis': {
                    name: 'Thesis/Dissertation',
                    icon: '🎓',
                    description: 'Graduate thesis or dissertation template',
                    sections: [
                        { title: 'Title Page', content: 'Title, author, institution' },
                        { title: 'Abstract', content: 'Research summary' },
                        { title: 'Acknowledgments', content: 'Thanks and recognition' },
                        { title: 'Table of Contents', content: 'Document structure' },
                        { title: 'Introduction', content: 'Research context and objectives' },
                        { title: 'Literature Review', content: 'Theoretical framework' },
                        { title: 'Methodology', content: 'Research design and methods' },
                        { title: 'Results', content: 'Findings presentation' },
                        { title: 'Discussion', content: 'Analysis and implications' },
                        { title: 'Conclusion', content: 'Summary and future work' },
                        { title: 'Bibliography', content: 'References' },
                        { title: 'Appendices', content: 'Supporting materials' }
                    ]
                }
            },
            report: {
                'project-report': {
                    name: 'Project Report',
                    icon: '📈',
                    description: 'Comprehensive project status report',
                    sections: [
                        { title: 'Executive Summary', content: 'Project overview and status' },
                        { title: 'Project Objectives', content: 'Goals and deliverables' },
                        { title: 'Progress Update', content: 'Work completed to date' },
                        { title: 'Milestones & Timeline', content: 'Schedule and milestones' },
                        { title: 'Budget Status', content: 'Financial summary' },
                        { title: 'Risks & Issues', content: 'Current challenges' },
                        { title: 'Next Steps', content: 'Upcoming activities' },
                        { title: 'Recommendations', content: 'Suggested actions' }
                    ]
                },
                'annual-report': {
                    name: 'Annual Report',
                    icon: '📅',
                    description: 'Company or department annual report',
                    sections: [
                        { title: 'Letter from Leadership', content: 'Executive message' },
                        { title: 'Year in Review', content: 'Key highlights and achievements' },
                        { title: 'Financial Performance', content: 'Financial summary and analysis' },
                        { title: 'Operational Highlights', content: 'Major activities and projects' },
                        { title: 'Market Analysis', content: 'Industry trends and position' },
                        { title: 'Sustainability & CSR', content: 'Social responsibility initiatives' },
                        { title: 'Future Outlook', content: 'Strategy and projections' },
                        { title: 'Financial Statements', content: 'Detailed financials' }
                    ]
                }
            }
        };
    }
    
    /**
     * Get templates for a specific document type
     */
    getTemplatesForType(documentType) {
        return this.templates[documentType] || {};
    }
    
    /**
     * Apply a template to the wizard data
     */
    applyTemplate(documentType, templateId) {
        const template = this.templates[documentType]?.[templateId];
        if (!template) return false;
        
        if (window.app) {
            // Set document type
            window.app.wizardData.documentType = documentType;
            window.app.steps[0].completed = true;
            
            // Set sections
            window.app.wizardData.sections = [...template.sections];
            
            // Update UI
            window.app.updateStepsNavigation();
            window.app.updateWizardContent();
            window.app.updateProgress();
            
            showToast(`Applied "${template.name}" template`, 'success');
            return true;
        }
        
        return false;
    }
    
    /**
     * Show template selection dialog
     */
    showTemplateDialog(documentType) {
        const templates = this.getTemplatesForType(documentType);
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        const templateCards = Object.entries(templates).map(([id, template]) => `
            <div class="template-card" data-template-id="${id}" style="cursor: pointer; padding: 16px; border: 1px solid #ddd; border-radius: 8px; margin-bottom: 12px; transition: all 0.3s;">
                <h3 style="margin: 0 0 8px 0;">
                    <span style="font-size: 24px; margin-right: 8px;">${template.icon}</span>
                    ${template.name}
                </h3>
                <p style="margin: 0 0 8px 0; color: #666; font-size: 14px;">${template.description}</p>
                <p style="margin: 0; color: #999; font-size: 12px;">${template.sections.length} sections</p>
            </div>
        `).join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px; max-height: 80vh; overflow-y: auto;">
                <h2>📄 Choose a Template</h2>
                <p style="color: #666; margin-bottom: 20px;">Select a template to quickly set up your document structure</p>
                ${templateCards}
                <div class="modal-actions" style="margin-top: 24px;">
                    <button class="secondary-button" onclick="this.closest('.modal-overlay').remove()">Cancel</button>
                    <button class="primary-button" onclick="this.closest('.modal-overlay').remove(); nextStep();">Skip Template</button>
                </div>
            </div>
        `;
        
        // Add hover effect
        modal.addEventListener('mouseover', (e) => {
            const card = e.target.closest('.template-card');
            if (card) {
                card.style.backgroundColor = '#f8f9fa';
                card.style.borderColor = '#007acc';
            }
        });
        
        modal.addEventListener('mouseout', (e) => {
            const card = e.target.closest('.template-card');
            if (card) {
                card.style.backgroundColor = 'white';
                card.style.borderColor = '#ddd';
            }
        });
        
        // Handle template selection
        modal.addEventListener('click', (e) => {
            const card = e.target.closest('.template-card');
            if (card) {
                const templateId = card.dataset.templateId;
                this.applyTemplate(documentType, templateId);
                modal.remove();
                nextStep(); // Move to next step
            } else if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }
}

// Create global templates instance
window.documentTemplates = new DocumentTemplates();