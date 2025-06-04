import * as vscode from 'vscode';
import { DocumentTemplate } from '../providers/documentTreeProvider';

/**
 * A simplified version of the CategoryOrganizer class
 * This implementation is used to organize documents and templates into categories for the tree view
 */
export class CategoryOrganizerStub {
    // Default categories
    private static readonly DEFAULT_CATEGORIES = [
        'Business',
        'Academic',
        'Technical',
        'Personal',
        'Other'
    ];

    /**
     * Get all available categories
     * @returns Array of category names
     */
    public getAllCategories(): string[] {
        return CategoryOrganizerStub.DEFAULT_CATEGORIES;
    }

    /**
     * Get the category for an item
     * @param itemId The item ID
     * @param defaultCategory Default category to use if not found
     * @returns The category name
     */
    public getItemCategory(itemId: string, defaultCategory: string = 'Other'): string {
        // In a real implementation, this would look up the category from storage
        // For now, we'll determine the category based on the item ID
        
        if (itemId.includes('business') || itemId.includes('letter') || itemId.includes('memo') || itemId.includes('proposal')) {
            return 'Business';
        } else if (itemId.includes('academic') || itemId.includes('research') || itemId.includes('thesis')) {
            return 'Academic';
        } else if (itemId.includes('technical') || itemId.includes('spec') || itemId.includes('manual') || itemId.includes('documentation')) {
            return 'Technical';
        } else if (itemId.includes('personal') || itemId.includes('resume') || itemId.includes('cv')) {
            return 'Personal';
        }
        
        return defaultCategory;
    }

    /**
     * Determine the category for a template based on its type and tags
     * @param template The template
     * @returns The category name
     */
    public getCategoryForTemplate(template: DocumentTemplate): string {
        // Check if the template has category-related tags
        if (template.tags) {
            if (template.tags.includes('business')) {
                return 'Business';
            } else if (template.tags.includes('academic')) {
                return 'Academic';
            } else if (template.tags.includes('technical')) {
                return 'Technical';
            } else if (template.tags.includes('personal')) {
                return 'Personal';
            }
        }
        
        // Determine category based on template type
        const type = template.type.toLowerCase();
        if (type.includes('business') || type.includes('letter') || type.includes('memo') || type.includes('proposal')) {
            return 'Business';
        } else if (type.includes('academic') || type.includes('research') || type.includes('thesis')) {
            return 'Academic';
        } else if (type.includes('technical') || type.includes('manual') || type.includes('documentation')) {
            return 'Technical';
        } else if (type.includes('personal') || type.includes('resume') || type.includes('cv')) {
            return 'Personal';
        }
        
        // Default to Other if no category determined
        return 'Other';
    }

    /**
     * Get templates grouped by category
     * @param templates Array of templates to organize
     * @returns Map of category names to arrays of templates
     */
    public organizeTemplatesByCategory(templates: DocumentTemplate[]): Map<string, DocumentTemplate[]> {
        const categoriesByName = new Map<string, DocumentTemplate[]>();
        
        // Initialize categories
        for (const category of this.getAllCategories()) {
            categoriesByName.set(category, []);
        }
        
        // Organize templates by category
        for (const template of templates) {
            const categoryName = this.getCategoryForTemplate(template);
            const templatesInCategory = categoriesByName.get(categoryName) || [];
            templatesInCategory.push(template);
            categoriesByName.set(categoryName, templatesInCategory);
        }
        
        return categoriesByName;
    }
}
