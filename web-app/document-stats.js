/**
 * Document Statistics for Document Writer
 */
class DocumentStats {
    constructor() {
        this.statsContainer = null;
        this.updateInterval = null;
        this.init();
    }
    
    init() {
        // Create stats container
        this.createStatsContainer();
        
        // Start monitoring
        this.startMonitoring();
    }
    
    createStatsContainer() {
        this.statsContainer = document.createElement('div');
        this.statsContainer.id = 'document-stats';
        this.statsContainer.className = 'document-stats';
        this.statsContainer.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            background: var(--card-background, #fff);
            border: 1px solid var(--border-color, #ddd);
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 12px;
            color: var(--text-muted, #666);
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
            z-index: 100;
            transition: opacity 0.3s;
            display: none;
        `;
        
        document.body.appendChild(this.statsContainer);
    }
    
    startMonitoring() {
        // Update stats every 5 seconds when there's content
        this.updateInterval = setInterval(() => {
            if (window.app && window.app.wizardData.generatedContent) {
                this.updateStats();
                this.statsContainer.style.display = 'block';
            } else {
                this.statsContainer.style.display = 'none';
            }
        }, 5000);
        
        // Initial update
        this.updateStats();
    }
    
    updateStats() {
        if (!window.app || !window.app.wizardData) return;
        
        const content = window.app.wizardData.generatedContent || '';
        const stats = this.calculateStats(content);
        
        this.statsContainer.innerHTML = `
            <div style="display: flex; gap: 16px; align-items: center;">
                <div>📝 <strong>${stats.words}</strong> words</div>
                <div>📄 <strong>${stats.pages}</strong> pages</div>
                <div>📷 <strong>${stats.images}</strong> images</div>
                <div>⏱️ <strong>${stats.readingTime}</strong> min read</div>
            </div>
        `;
    }
    
    calculateStats(content) {
        // Word count
        const words = content.trim().split(/\s+/).filter(w => w.length > 0).length;
        
        // Page count (assuming 300 words per page)
        const pages = Math.ceil(words / 300);
        
        // Image count
        const images = (content.match(/!\[([^\]]*)\]\(([^)]+)\)/g) || []).length;
        
        // Reading time (assuming 200 words per minute)
        const readingTime = Math.ceil(words / 200);
        
        // Character count
        const characters = content.length;
        
        // Paragraph count
        const paragraphs = content.split(/\n\n+/).filter(p => p.trim().length > 0).length;
        
        return {
            words,
            pages,
            images,
            readingTime,
            characters,
            paragraphs
        };
    }
    
    getDetailedStats() {
        if (!window.app || !window.app.wizardData) return null;
        
        const content = window.app.wizardData.generatedContent || '';
        const stats = this.calculateStats(content);
        
        // Section analysis
        const sections = window.app.wizardData.sections || [];
        const sectionStats = sections.map(section => {
            const sectionContent = section.content || '';
            return {
                title: section.title,
                words: sectionContent.split(/\s+/).filter(w => w.length > 0).length
            };
        });
        
        // Heading analysis
        const headings = {
            h1: (content.match(/^# .+$/gm) || []).length,
            h2: (content.match(/^## .+$/gm) || []).length,
            h3: (content.match(/^### .+$/gm) || []).length
        };
        
        return {
            ...stats,
            sections: sectionStats,
            headings,
            documentType: window.app.wizardData.documentType,
            title: window.app.wizardData.documentTitle,
            author: window.app.wizardData.documentData.author,
            date: window.app.wizardData.documentData.date
        };
    }
    
    showDetailedStats() {
        const stats = this.getDetailedStats();
        if (!stats) {
            showToast('No document to analyze', 'warning');
            return;
        }
        
        const modal = document.createElement('div');
        modal.className = 'modal-overlay';
        modal.style.display = 'flex';
        
        const sectionList = stats.sections.map(s => 
            `<li>${s.title}: ${s.words} words</li>`
        ).join('');
        
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 600px;">
                <h2>📊 Document Statistics</h2>
                
                <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin: 20px 0;">
                    <div style="text-align: center; padding: 16px; background: var(--hover-background, #f5f5f5); border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--primary-color, #007acc);">${stats.words}</div>
                        <div style="font-size: 14px; color: var(--text-muted, #666);">Words</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--hover-background, #f5f5f5); border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--primary-color, #007acc);">${stats.pages}</div>
                        <div style="font-size: 14px; color: var(--text-muted, #666);">Pages</div>
                    </div>
                    <div style="text-align: center; padding: 16px; background: var(--hover-background, #f5f5f5); border-radius: 8px;">
                        <div style="font-size: 24px; font-weight: bold; color: var(--primary-color, #007acc);">${stats.readingTime}</div>
                        <div style="font-size: 14px; color: var(--text-muted, #666);">Min Read</div>
                    </div>
                </div>
                
                <h3>Document Details</h3>
                <table style="width: 100%; margin-bottom: 20px;">
                    <tr><td style="padding: 8px;"><strong>Title:</strong></td><td>${stats.title || 'Untitled'}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Type:</strong></td><td>${stats.documentType || 'Unknown'}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Author:</strong></td><td>${stats.author || 'Not specified'}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Characters:</strong></td><td>${stats.characters.toLocaleString()}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Paragraphs:</strong></td><td>${stats.paragraphs}</td></tr>
                    <tr><td style="padding: 8px;"><strong>Images:</strong></td><td>${stats.images}</td></tr>
                </table>
                
                <h3>Structure Analysis</h3>
                <p>H1 Headings: ${stats.headings.h1} | H2 Headings: ${stats.headings.h2} | H3 Headings: ${stats.headings.h3}</p>
                
                ${stats.sections.length > 0 ? `
                <h3>Section Breakdown</h3>
                <ul style="margin-left: 20px;">
                    ${sectionList}
                </ul>
                ` : ''}
                
                <div class="modal-actions">
                    <button class="primary-button" onclick="this.closest('.modal-overlay').remove()">Close</button>
                </div>
            </div>
        `;
        
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                modal.remove();
            }
        });
        
        document.body.appendChild(modal);
    }
    
    cleanup() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
        }
        if (this.statsContainer) {
            this.statsContainer.remove();
        }
    }
}

// Initialize document stats
document.addEventListener('DOMContentLoaded', () => {
    window.documentStats = new DocumentStats();
});

// Add keyboard shortcut
if (window.keyboardShortcuts) {
    window.keyboardShortcuts.register('ctrl+shift+i', () => {
        window.documentStats.showDetailedStats();
    }, 'Show document statistics');
}