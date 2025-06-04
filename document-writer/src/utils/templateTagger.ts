/**
 * templateTagger.ts
 * Utility for managing tags and metadata for document templates
 */

import * as vscode from 'vscode';
import { DocumentTemplate } from '../models/documentTemplate';
import { DocumentFormat } from '../models/documentFormat';

/**
 * Interface for tag metadata
 */
export interface TagMetadata {
    /**
     * Tag name
     */
    name: string;
    
    /**
     * Tag color (CSS color)
     */
    color?: string;
    
    /**
     * Tag description
     */
    description?: string;
    
    /**
     * Count of templates with this tag
     */
    count: number;
    
    /**
     * Is this a system tag
     */
    isSystem?: boolean;
}

/**
 * TemplateTagger class for managing document template tags
 */
export class TemplateTagger {
    /**
     * Singleton instance
     */
    private static instance: TemplateTagger;
    
    /**
     * Map of tag names to tag metadata
     */
    private tagMetadata: Map<string, TagMetadata> = new Map();
    
    /**
     * System tags that cannot be removed
     */
    private readonly systemTags: string[] = [
        'favorite',
        'recent',
        'business',
        'technical',
        'academic',
        'personal'
    ];
    
    /**
     * Default tag colors
     */
    private readonly defaultTagColors: { [key: string]: string } = {
        'favorite': '#FFD700', // Gold
        'recent': '#87CEFA',   // Light sky blue
        'business': '#4682B4', // Steel blue
        'technical': '#2E8B57', // Sea green
        'academic': '#9370DB', // Medium purple
        'personal': '#FF6347'  // Tomato
    };
    
    /**
     * Storage context for persisting tag data
     */
    private storageContext?: vscode.Memento;
    
    /**
     * Private constructor for singleton pattern
     */
    private constructor(storageContext?: vscode.Memento) {
        this.storageContext = storageContext;
        this.loadTagMetadata();
        this.initializeSystemTags();
    }
    
    /**
     * Get the singleton instance
     */
    public static getInstance(storageContext?: vscode.Memento): TemplateTagger {
        if (!TemplateTagger.instance) {
            TemplateTagger.instance = new TemplateTagger(storageContext);
        }
        return TemplateTagger.instance;
    }
    
    /**
     * Initialize system tags
     */
    private initializeSystemTags(): void {
        for (const tag of this.systemTags) {
            if (!this.tagMetadata.has(tag)) {
                this.tagMetadata.set(tag, {
                    name: tag,
                    color: this.defaultTagColors[tag] || '#CCCCCC',
                    count: 0,
                    isSystem: true,
                    description: this.getSystemTagDescription(tag)
                });
            } else {
                // Ensure existing tag is marked as system
                const metadata = this.tagMetadata.get(tag)!;
                metadata.isSystem = true;
                if (!metadata.color) {
                    metadata.color = this.defaultTagColors[tag] || '#CCCCCC';
                }
                if (!metadata.description) {
                    metadata.description = this.getSystemTagDescription(tag);
                }
            }
        }
        
        this.saveTagMetadata();
    }
    
    /**
     * Get description for system tag
     */
    private getSystemTagDescription(tag: string): string {
        switch (tag) {
            case 'favorite':
                return 'Marked as favorite template';
            case 'recent':
                return 'Recently used template';
            case 'business':
                return 'Business-related document';
            case 'technical':
                return 'Technical documentation';
            case 'academic':
                return 'Academic or research document';
            case 'personal':
                return 'Personal document';
            default:
                return `System tag: ${tag}`;
        }
    }
    
    /**
     * Load tag metadata from storage
     */
    private loadTagMetadata(): void {
        if (this.storageContext) {
            const savedMetadata = this.storageContext.get<Record<string, TagMetadata>>('templateTags', {});
            
            this.tagMetadata.clear();
            for (const [tag, metadata] of Object.entries(savedMetadata)) {
                this.tagMetadata.set(tag, metadata);
            }
        }
    }
    
    /**
     * Save tag metadata to storage
     */
    private saveTagMetadata(): void {
        if (this.storageContext) {
            const metadataObject: Record<string, TagMetadata> = {};
            
            for (const [tag, metadata] of this.tagMetadata.entries()) {
                metadataObject[tag] = metadata;
            }
            
            this.storageContext.update('templateTags', metadataObject);
        }
    }
    
    /**
     * Add tag to a template
     * @param template Template to tag
     * @param tag Tag to add
     * @returns True if tag was added, false if already present
     */
    public addTag(template: DocumentTemplate, tag: string): boolean {
        // Normalize tag (lowercase, trim, no spaces)
        tag = this.normalizeTag(tag);
        
        if (!tag) {
            return false;
        }
        
        // Initialize metadata if needed
        if (!template.metadata) {
            template.metadata = {};
        }
        
        // Initialize tags array if needed
        if (!template.metadata.tags) {
            template.metadata.tags = [];
        }
        
        // Check if tag already exists
        if (template.metadata.tags.includes(tag)) {
            return false;
        }
        
        // Add tag to template
        template.metadata.tags.push(tag);
        
        // Update tag metadata
        this.updateTagCount(tag);
        
        return true;
    }
    
    /**
     * Remove tag from a template
     * @param template Template to modify
     * @param tag Tag to remove
     * @returns True if tag was removed, false if not found or is system tag
     */
    public removeTag(template: DocumentTemplate, tag: string): boolean {
        // Normalize tag
        tag = this.normalizeTag(tag);
        
        if (!tag || !template.metadata || !template.metadata.tags) {
            return false;
        }
        
        // Check if the tag exists
        const index = template.metadata.tags.indexOf(tag);
        if (index === -1) {
            return false;
        }
        
        // Remove tag
        template.metadata.tags.splice(index, 1);
        
        // Update tag metadata
        this.updateTagCount(tag, -1);
        
        return true;
    }
    
    /**
     * Update tag count
     * @param tag Tag to update
     * @param delta Change in count (default 1)
     */
    private updateTagCount(tag: string, delta: number = 1): void {
        if (!this.tagMetadata.has(tag)) {
            // Create new tag metadata
            this.tagMetadata.set(tag, {
                name: tag,
                count: Math.max(0, delta),
                isSystem: this.systemTags.includes(tag),
                color: this.defaultTagColors[tag] || this.generateTagColor(tag)
            });
        } else {
            // Update existing tag metadata
            const metadata = this.tagMetadata.get(tag)!;
            metadata.count = Math.max(0, metadata.count + delta);
            
            // If count is zero and not a system tag, consider removing metadata
            if (metadata.count === 0 && !metadata.isSystem) {
                this.tagMetadata.delete(tag);
            }
        }
        
        this.saveTagMetadata();
    }
    
    /**
     * Generate a consistent color for a tag based on its name
     * @param tag Tag name
     * @returns CSS color
     */
    private generateTagColor(tag: string): string {
        // Generate a deterministic hash from the tag name
        let hash = 0;
        for (let i = 0; i < tag.length; i++) {
            hash = tag.charCodeAt(i) + ((hash << 5) - hash);
        }
        
        // Convert to a pastel color
        const h = Math.abs(hash) % 360;
        const s = 50 + (Math.abs(hash) % 30); // 50-80%
        const l = 60 + (Math.abs(hash) % 20); // 60-80%
        
        return `hsl(${h}, ${s}%, ${l}%)`;
    }
    
    /**
     * Set tag color
     * @param tag Tag name
     * @param color CSS color
     */
    public setTagColor(tag: string, color: string): void {
        tag = this.normalizeTag(tag);
        
        if (!tag) {
            return;
        }
        
        if (this.tagMetadata.has(tag)) {
            const metadata = this.tagMetadata.get(tag)!;
            metadata.color = color;
        } else {
            this.tagMetadata.set(tag, {
                name: tag,
                color: color,
                count: 0,
                isSystem: this.systemTags.includes(tag)
            });
        }
        
        this.saveTagMetadata();
    }
    
    /**
     * Set tag description
     * @param tag Tag name
     * @param description Description
     */
    public setTagDescription(tag: string, description: string): void {
        tag = this.normalizeTag(tag);
        
        if (!tag) {
            return;
        }
        
        if (this.tagMetadata.has(tag)) {
            const metadata = this.tagMetadata.get(tag)!;
            metadata.description = description;
        } else {
            this.tagMetadata.set(tag, {
                name: tag,
                description: description,
                count: 0,
                isSystem: this.systemTags.includes(tag)
            });
        }
        
        this.saveTagMetadata();
    }
    
    /**
     * Get all tags with metadata
     * @returns Array of tag metadata
     */
    public getAllTags(): TagMetadata[] {
        return Array.from(this.tagMetadata.values())
            .filter(metadata => metadata.count > 0 || metadata.isSystem)
            .sort((a, b) => {
                // System tags first, then by count (descending), then by name
                if (a.isSystem && !b.isSystem) return -1;
                if (!a.isSystem && b.isSystem) return 1;
                if (a.count !== b.count) return b.count - a.count;
                return a.name.localeCompare(b.name);
            });
    }
    
    /**
     * Get tag metadata
     * @param tag Tag name
     * @returns Tag metadata or undefined if not found
     */
    public getTagMetadata(tag: string): TagMetadata | undefined {
        tag = this.normalizeTag(tag);
        return this.tagMetadata.get(tag);
    }
    
    /**
     * Get templates with tag
     * @param tag Tag to search for
     * @param templates Array of templates to search
     * @returns Templates with the specified tag
     */
    public getTemplatesWithTag(tag: string, templates: DocumentTemplate[]): DocumentTemplate[] {
        tag = this.normalizeTag(tag);
        
        if (!tag) {
            return [];
        }
        
        return templates.filter(template => 
            template.metadata?.tags?.includes(tag)
        );
    }
    
    /**
     * Normalize tag (lowercase, trim, replace spaces with hyphens)
     * @param tag Tag to normalize
     * @returns Normalized tag
     */
    private normalizeTag(tag: string): string {
        return tag.toLowerCase().trim().replace(/\s+/g, '-');
    }
    
    /**
     * Suggest tags for a template based on content
     * @param template Template to analyze
     * @returns Array of suggested tags
     */
    public suggestTags(template: DocumentTemplate): string[] {
        const suggestions: string[] = [];
        
        // Simple rule-based suggestions
        const nameLower = template.name.toLowerCase();
        const formatLower = template.format.toString().toLowerCase();
        const descLower = template.description.toLowerCase();
        const categoryLower = template.metadata?.category?.toLowerCase() || '';
        
        // Add category-based tags
        if (categoryLower.includes('business') || 
            nameLower.includes('business') || 
            descLower.includes('business')) {
            suggestions.push('business');
        }
        
        if (categoryLower.includes('technical') || 
            nameLower.includes('technical') || 
            descLower.includes('technical')) {
            suggestions.push('technical');
        }
        
        if (categoryLower.includes('academic') || 
            nameLower.includes('academic') || 
            descLower.includes('academic') ||
            nameLower.includes('research') || 
            descLower.includes('research')) {
            suggestions.push('academic');
        }
        
        if (categoryLower.includes('personal') || 
            nameLower.includes('personal') || 
            descLower.includes('personal')) {
            suggestions.push('personal');
        }
        
        // Add document format tags
        switch(template.format) {
            case DocumentFormat.DOCX:
                suggestions.push('word');
                break;
            case DocumentFormat.HTML:
                suggestions.push('html');
                break;
            case DocumentFormat.MARKDOWN:
                suggestions.push('markdown');
                break;
            case DocumentFormat.PDF:
                suggestions.push('pdf');
                break;
        }
        
        // Add document type tags based on name and description
        if (nameLower.includes('letter') || 
            descLower.includes('letter')) {
            suggestions.push('letter');
        }
        
        if (nameLower.includes('report') || 
            descLower.includes('report')) {
            suggestions.push('report');
        }
        
        if (nameLower.includes('paper') || 
            descLower.includes('paper')) {
            suggestions.push('paper');
        }
        
        if (nameLower.includes('manual') || 
            descLower.includes('manual')) {
            suggestions.push('manual');
        }
        
        if (nameLower.includes('proposal') || 
            descLower.includes('proposal')) {
            suggestions.push('proposal');
        }
        
        if (nameLower.includes('specification') || 
            descLower.includes('specification') ||
            nameLower.includes('spec')) {
            suggestions.push('specification');
        }
        
        return [...new Set(suggestions)]; // Remove duplicates
    }
    
    /**
     * Apply suggested tags to a template
     * @param template Template to tag
     * @returns Number of tags added
     */
    public applyTagSuggestions(template: DocumentTemplate): number {
        const suggestions = this.suggestTags(template);
        let tagsAdded = 0;
        
        for (const tag of suggestions) {
            if (this.addTag(template, tag)) {
                tagsAdded++;
            }
        }
        
        return tagsAdded;
    }
    
    /**
     * Get tag color
     * @param tag Tag name
     * @returns CSS color
     */
    public getTagColor(tag: string): string {
        tag = this.normalizeTag(tag);
        
        const metadata = this.tagMetadata.get(tag);
        if (metadata?.color) {
            return metadata.color;
        }
        
        // Return default color or generate one
        return this.defaultTagColors[tag] || this.generateTagColor(tag);
    }
    
    /**
     * Get CSS class for tag element
     * @param tag Tag name
     * @returns CSS class name
     */
    public getTagCssClass(tag: string): string {
        tag = this.normalizeTag(tag);
        return `document-tag-${tag}`;
    }
    
    /**
     * Generate CSS for all tags
     * @returns CSS string
     */
    public generateTagsCss(): string {
        let css = '';
        
        for (const [tag, metadata] of this.tagMetadata.entries()) {
            if (metadata.color) {
                css += `
.document-tag-${tag} {
    background-color: ${metadata.color};
    color: ${this.getContrastColor(metadata.color)};
}`;
            }
        }
        
        return css;
    }
    
    /**
     * Get contrasting text color (black or white) for a background color
     * @param backgroundColor Background color (CSS color string)
     * @returns Text color (black or white)
     */
    private getContrastColor(backgroundColor: string): string {
        // Convert color to RGB
        let r = 0, g = 0, b = 0;
        
        // Handle hex colors
        if (backgroundColor.startsWith('#')) {
            const hex = backgroundColor.slice(1);
            if (hex.length === 3) {
                r = parseInt(hex[0] + hex[0], 16);
                g = parseInt(hex[1] + hex[1], 16);
                b = parseInt(hex[2] + hex[2], 16);
            } else if (hex.length === 6) {
                r = parseInt(hex.slice(0, 2), 16);
                g = parseInt(hex.slice(2, 4), 16);
                b = parseInt(hex.slice(4, 6), 16);
            }
        } 
        // Handle rgb/rgba colors
        else if (backgroundColor.startsWith('rgb')) {
            const match = backgroundColor.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
            if (match) {
                r = parseInt(match[1]);
                g = parseInt(match[2]);
                b = parseInt(match[3]);
            }
        }
        // Handle hsl colors (approximate conversion)
        else if (backgroundColor.startsWith('hsl')) {
            const match = backgroundColor.match(/hsla?\((\d+),\s*(\d+)%,\s*(\d+)%/i);
            if (match) {
                const h = parseInt(match[1]) / 360;
                const s = parseInt(match[2]) / 100;
                const l = parseInt(match[3]) / 100;
                
                // Convert HSL to RGB
                if (s === 0) {
                    r = g = b = Math.round(l * 255);
                } else {
                    const hue2rgb = (p: number, q: number, t: number) => {
                        if (t < 0) t += 1;
                        if (t > 1) t -= 1;
                        if (t < 1/6) return p + (q - p) * 6 * t;
                        if (t < 1/2) return q;
                        if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
                        return p;
                    };
                    
                    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
                    const p = 2 * l - q;
                    
                    r = Math.round(hue2rgb(p, q, h + 1/3) * 255);
                    g = Math.round(hue2rgb(p, q, h) * 255);
                    b = Math.round(hue2rgb(p, q, h - 1/3) * 255);
                }
            }
        }
        
        // Calculate perceived brightness
        // Using the formula: (0.299*R + 0.587*G + 0.114*B)
        const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
        
        // Return black for bright colors, white for dark colors
        return brightness > 0.5 ? '#000000' : '#FFFFFF';
    }
}
