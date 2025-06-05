/**
 * categoryOrganizer.ts
 * Utility for organizing documents and templates into categories for the tree view
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentTemplate } from '../models/documentTemplate';

/**
 * Interface for categorized item
 */
export interface CategorizedItem {
    id: string;
    label: string;
    description?: string;
    category: string;
    path?: string;
    iconPath?: string | vscode.ThemeIcon;
    contextValue?: string;
    children?: CategorizedItem[];
    template?: DocumentTemplate;
}

/**
 * Interface for tree view category
 */
export interface TreeViewCategory {
    id: string;
    label: string;
    description?: string;
    iconPath?: string | vscode.ThemeIcon;
    items: CategorizedItem[];
    contextValue?: string;
    collapsibleState?: vscode.TreeItemCollapsibleState;
}

/**
 * Interface representing a node in the category tree structure
 */
export interface CategoryNode {
    id: string;
    label: string;
    description?: string;
    children?: CategoryNode[];
    template?: DocumentTemplate;
    path?: string;
    contextValue?: string;
    iconPath?: string | vscode.ThemeIcon;
    category?: string;
}

/**
 * CategoryOrganizer class for organizing documents and templates
 */
export class CategoryOrganizer {
    
    // Default categories
    private static readonly DEFAULT_CATEGORIES: string[] = [
        'Business',
        'Academic',
        'Technical',
        'Personal',
        'Other'
    ];

    // Keep track of custom categories
    private customCategories: string[] = [];

    // Keep track of item categories
    private itemCategories: Map<string, string> = new Map();

    // Keep track of templates
    private templates: Map<string, DocumentTemplate> = new Map();

    // Keep track of categories with templates
    private categoriesWithTemplates: Map<string, DocumentTemplate[]> = new Map();

    // Extension URI
    private readonly extensionUri: vscode.Uri;

    /**
     * Constructor for CategoryOrganizer
     * @param extensionUri Extension URI
     */
    constructor(extensionUri: vscode.Uri) {
        this.extensionUri = extensionUri;
        this.loadCustomCategories();
        this.loadItemCategories();
    }

    /**
     * Load custom categories from configuration
     */
    private loadCustomCategories(): void {
        const config = vscode.workspace.getConfiguration('documentWriter.categories');
        const customCategories = config.get<string[]>('custom', []);
        
        this.customCategories = customCategories;
    }

    /**
     * Get all categories (default + custom)
     * @returns Array of category names
     */
    public getAllCategories(): string[] {
        return [...CategoryOrganizer.DEFAULT_CATEGORIES, ...this.customCategories];
    }

    /**
     * Add custom category
     * @param category Category name
     * @returns true if added, false if already exists
     */
    public addCustomCategory(category: string): boolean {
        if (this.getAllCategories().includes(category)) {
            return false;
        }
        
        this.customCategories.push(category);
        this.saveCustomCategories();
        return true;
    }

    /**
     * Remove custom category
     * @param category Category name
     * @returns true if removed, false if not found or is a default category
     */
    public removeCustomCategory(category: string): boolean {
        if (CategoryOrganizer.DEFAULT_CATEGORIES.includes(category)) {
            return false;
        }
        
        const index = this.customCategories.indexOf(category);
        if (index === -1) {
            return false;
        }
        
        this.customCategories.splice(index, 1);
        this.saveCustomCategories();
        
        // Update items in this category to 'Other'
        this.updateCategoryItems(category, 'Other');
        
        return true;
    }

    /**
     * Save custom categories to configuration
     */
    private saveCustomCategories(): void {
        const config = vscode.workspace.getConfiguration('documentWriter.categories');
        config.update('custom', this.customCategories, vscode.ConfigurationTarget.Global);
    }

    /**
     * Update all items from one category to another
     * @param fromCategory Category to move items from
     * @param toCategory Category to move items to
     */
    private updateCategoryItems(fromCategory: string, toCategory: string): void {
        for (const [itemId, category] of this.itemCategories.entries()) {
            if (category === fromCategory) {
                this.itemCategories.set(itemId, toCategory);
            }
        }
        this.saveItemCategories();
    }

    /**
     * Set category for an item
     * @param itemId Item ID
     * @param category Category name
     */
    public setItemCategory(itemId: string, category: string): void {
        if (!this.getAllCategories().includes(category)) {
            category = 'Other';
        }
        
        this.itemCategories.set(itemId, category);
        this.saveItemCategories();
    }

    /**
     * Get category for an item
     * @param itemId Item ID
     * @param defaultCategory Default category if not found
     * @returns Category name
     */
    public getItemCategory(itemId: string, defaultCategory: string = 'Other'): string {
        return this.itemCategories.get(itemId) || defaultCategory;
    }
        
    /**
     * Save item categories
     */
    private saveItemCategories(): void {
        // Convert Map to Object for storage
        const itemCategoriesObject: { [key: string]: string } = {};
        
        for (const [itemId, category] of this.itemCategories.entries()) {
            itemCategoriesObject[itemId] = category;
        }
        
        const config = vscode.workspace.getConfiguration('documentWriter.categories');
        config.update('itemCategories', itemCategoriesObject, vscode.ConfigurationTarget.Global);
    }

    /**
     * Load item categories
     */
    private loadItemCategories(): void {
        const config = vscode.workspace.getConfiguration('documentWriter.categories');
        const itemCategoriesObject = config.get<{ [key: string]: string }>('itemCategories', {});
        
        this.itemCategories.clear();
        
        for (const [itemId, category] of Object.entries(itemCategoriesObject)) {
            this.itemCategories.set(itemId, category);
        }
    }

    /**
     * Organize items into categories
     * @param items Items to organize
     * @returns Organized categories with items
     */
    public organizeIntoCategories(items: CategorizedItem[]): TreeViewCategory[] {
        // Initialize categories
        const categories = this.getAllCategories().map(category => ({
            id: `category-${category}`,
            label: category,
            description: '',
            items: [] as CategorizedItem[],
            contextValue: 'category',
            collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
            iconPath: undefined as unknown as vscode.ThemeIcon
        }));
        
        // Add appropriate icon paths for default categories
        categories.forEach(category => {
            if (category.label === 'Business') {
                category.iconPath = new vscode.ThemeIcon('briefcase');
            } else if (category.label === 'Academic') {
                category.iconPath = new vscode.ThemeIcon('mortar-board');
            } else if (category.label === 'Technical') {
                category.iconPath = new vscode.ThemeIcon('gear');
            } else if (category.label === 'Personal') {
                category.iconPath = new vscode.ThemeIcon('person');
            } else {
                category.iconPath = new vscode.ThemeIcon('folder');
            }
        });
        
        // Organize items into categories
        for (const item of items) {
            const category = this.getItemCategory(item.id, item.category || 'Other');
            const categoryObj = categories.find(c => c.label === category);
            
            if (categoryObj) {
                categoryObj.items.push({
                    ...item,
                    category
                });
            } else {
                // If category not found (shouldn't happen), add to Other
                const otherCategory = categories.find(c => c.label === 'Other');
                if (otherCategory) {
                    otherCategory.items.push({
                        ...item,
                        category: 'Other'
                    });
                }
            }
        }
        
        // Filter out empty categories and sort items within each category
        return categories
            .filter(category => category.items.length > 0)
            .map(category => ({
                ...category,
                items: category.items.sort((a, b) => a.label.localeCompare(b.label))
            }));
    }

    /**
     * Auto-categorize a document based on its content or metadata
     * @param documentPath Path to the document
     * @param templateName Template name (optional)
     * @returns Suggested category
     */
    public suggestCategory(documentPath: string, templateName?: string): string {
        // Simple categorization based on filename and template
        const fileName = path.basename(documentPath).toLowerCase();
        
        // Check template name first
        if (templateName) {
            if (templateName.includes('business') || 
                templateName.includes('letter') || 
                templateName.includes('invoice') || 
                templateName.includes('report')) {
                return 'Business';
            } else if (templateName.includes('academic') || 
                       templateName.includes('thesis') || 
                       templateName.includes('paper')) {
                return 'Academic';
            } else if (templateName.includes('technical') || 
                       templateName.includes('spec') || 
                       templateName.includes('documentation')) {
                return 'Technical';
            } else if (templateName.includes('personal') || 
                       templateName.includes('resume') || 
                       templateName.includes('cv')) {
                return 'Personal';
            }
        }
        
        // Check filename
        if (fileName.includes('business') || 
            fileName.includes('letter') || 
            fileName.includes('invoice') || 
            fileName.includes('report')) {
            return 'Business';
        } else if (fileName.includes('academic') || 
                  fileName.includes('thesis') || 
                  fileName.includes('paper')) {
            return 'Academic';
        } else if (fileName.includes('technical') || 
                  fileName.includes('spec') || 
                  fileName.includes('documentation')) {
            return 'Technical';
        } else if (fileName.includes('personal') || 
                  fileName.includes('resume') || 
                  fileName.includes('cv')) {
            return 'Personal';
        }
        
        // Default to Other if no category determined
        return 'Other';
    }

    /**
     * Create tree items from categorized items
     * @param categories Organized categories with items
     * @returns Tree items for tree view
     */
    public createTreeItems(categories: TreeViewCategory[]): vscode.TreeItem[] {
        return categories.map(category => {
            const treeItem = new vscode.TreeItem(
                category.label,
                category.collapsibleState || vscode.TreeItemCollapsibleState.Expanded
            );
            
            treeItem.id = category.id;
            treeItem.description = category.description;
            treeItem.iconPath = category.iconPath;
            treeItem.contextValue = category.contextValue;
            treeItem.tooltip = `${category.label} (${category.items.length} items)`;
            
            return treeItem;
        });
    }

    /**
     * Create tree items for a category's children
     * @param categoryLabel Category label
     * @param categories Organized categories with items
     * @returns Tree items for category's children
     */
    public createChildTreeItems(categoryLabel: string, categories: TreeViewCategory[]): vscode.TreeItem[] {
        const category = categories.find(c => c.label === categoryLabel);
        
        if (!category) {
            return [];
        }
        
        return category.items.map(item => {
            const treeItem = new vscode.TreeItem(
                item.label,
                item.children && item.children.length > 0 
                    ? vscode.TreeItemCollapsibleState.Collapsed 
                    : vscode.TreeItemCollapsibleState.None
            );
            
            treeItem.id = item.id;
            treeItem.description = item.description;
            treeItem.tooltip = item.description || item.label;
            treeItem.contextValue = item.contextValue;
            
            if (item.path) {
                treeItem.resourceUri = vscode.Uri.file(item.path);
                
                // Set command to open document when clicked
                treeItem.command = {
                    command: 'document-writer.openDocument',
                    title: 'Open Document',
                    arguments: [item.path]
                };
            }
            
            // Set appropriate icon based on file extension
            if (item.iconPath) {
                treeItem.iconPath = item.iconPath;
            } else if (item.path) {
                const extension = path.extname(item.path).toLowerCase();
                
                switch (extension) {
                    case '.docx':
                    case '.doc':
                        treeItem.iconPath = {
                            light: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'light', 'word-document.svg')),
                            dark: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'dark', 'word-document.svg'))
                        };
                        break;
                    case '.md':
                        treeItem.iconPath = {
                            light: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'light', 'markdown-document.svg')),
                            dark: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'dark', 'markdown-document.svg'))
                        };
                        break;
                    case '.pdf':
                        treeItem.iconPath = {
                            light: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'light', 'pdf-document.svg')),
                            dark: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'dark', 'pdf-document.svg'))
                        };
                        break;
                    case '.html':
                        treeItem.iconPath = {
                            light: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'light', 'html-document.svg')),
                            dark: vscode.Uri.file(path.join(this.extensionUri.fsPath, 'resources', 'icons', 'dark', 'html-document.svg'))
                        };
                        break;
                    default:
                        treeItem.iconPath = new vscode.ThemeIcon('file');
                }
            } else {
                treeItem.iconPath = new vscode.ThemeIcon('file');
            }
            
            return treeItem;
        });
    }

    /**
     * Get dragable data for a tree item
     * @param item Tree item
     * @returns Dragable data
     */
    public getDraggableData(item: CategorizedItem): string {
        return JSON.stringify({
            id: item.id,
            label: item.label,
            category: item.category,
            path: item.path,
            template: item.template
        });
    }

    /**
     * Initialize from legacy categories format
     * @param legacyCategories Legacy category format
     */
    public initializeFromLegacyCategories(legacyCategories: any[]): void {
        this.templates.clear();
        this.categoriesWithTemplates.clear();
        
        for (const category of legacyCategories) {
            const categoryName = category.name;
            this.categoriesWithTemplates.set(categoryName, []);
            
            for (const template of category.templates) {
                this.templates.set(template.id, template);
                this.setItemCategory(template.id, categoryName);
                
                const categoryTemplates = this.categoriesWithTemplates.get(categoryName) || [];
                categoryTemplates.push(template);
                this.categoriesWithTemplates.set(categoryName, categoryTemplates);
            }
        }
    }

    /**
     * Export to legacy format
     * @returns Legacy format categories
     */
    public exportToLegacyFormat(): any[] {
        const legacyCategories: any[] = [];
        
        for (const [categoryName, templates] of this.categoriesWithTemplates.entries()) {
            legacyCategories.push({
                id: categoryName.toLowerCase().replace(/\s+/g, '-'),
                name: categoryName,
                description: `Templates for ${categoryName}`,
                templates: templates,
                sortOrder: this.getAllCategories().indexOf(categoryName) + 1
            });
        }
        
        return legacyCategories;
    }

    /**
     * Get template by ID
     * @param templateId Template ID
     * @returns Template or undefined
     */
    public getTemplate(templateId: string): DocumentTemplate | undefined {
        return this.templates.get(templateId);
    }

    /**
     * Add template to a category
     * @param template Template to add
     * @param categoryName Category name
     */
    public addTemplate(template: DocumentTemplate, categoryName: string): void {
        this.templates.set(template.id, template);
        this.setItemCategory(template.id, categoryName);
        
        const categoryTemplates = this.categoriesWithTemplates.get(categoryName) || [];
        categoryTemplates.push(template);
        this.categoriesWithTemplates.set(categoryName, categoryTemplates);
    }

    /**
     * Remove template
     * @param templateId Template ID
     */
    public removeTemplate(templateId: string): void {
        const template = this.templates.get(templateId);
        if (template) {
            const categoryName = this.getItemCategory(templateId);
            const categoryTemplates = this.categoriesWithTemplates.get(categoryName) || [];
            const index = categoryTemplates.findIndex(t => t.id === templateId);
            if (index !== -1) {
                categoryTemplates.splice(index, 1);
                this.categoriesWithTemplates.set(categoryName, categoryTemplates);
            }
            
            this.templates.delete(templateId);
            this.itemCategories.delete(templateId);
        }
    }

    /**
     * Create category
     * @param categoryName Category name
     * @param parentCategory Parent category (unused in this implementation)
     * @param description Category description
     * @param iconPath Icon path
     * @param sortOrder Sort order
     */
    public createCategory(categoryName: string, _parentCategory: string | null, _description?: string, _iconPath?: string, _sortOrder?: number): void {
        if (!this.categoriesWithTemplates.has(categoryName)) {
            this.categoriesWithTemplates.set(categoryName, []);
            this.addCustomCategory(categoryName);
        }
    }

    /**
     * Delete category
     * @param categoryId Category ID (can be name or ID)
     */
    public deleteCategory(categoryId: string): void {
        // Try to find category by name first
        let categoryName = categoryId;
        if (!this.categoriesWithTemplates.has(categoryId)) {
            // Try to find by ID format
            categoryName = this.getAllCategories().find(cat => 
                cat.toLowerCase().replace(/\s+/g, '-') === categoryId
            ) || categoryId;
        }
        
        if (this.categoriesWithTemplates.has(categoryName)) {
            // Move all templates to 'Other' category
            const templates = this.categoriesWithTemplates.get(categoryName) || [];
            for (const template of templates) {
                this.setItemCategory(template.id, 'Other');
                const otherTemplates = this.categoriesWithTemplates.get('Other') || [];
                otherTemplates.push(template);
                this.categoriesWithTemplates.set('Other', otherTemplates);
            }
            
            this.categoriesWithTemplates.delete(categoryName);
            this.removeCustomCategory(categoryName);
        }
    }

    /**
     * Rename category
     * @param categoryId Category ID (can be name or ID)
     * @param newName New category name
     */
    public renameCategory(categoryId: string, newName: string): void {
        // Try to find category by name first
        let categoryName = categoryId;
        if (!this.categoriesWithTemplates.has(categoryId)) {
            // Try to find by ID format
            categoryName = this.getAllCategories().find(cat => 
                cat.toLowerCase().replace(/\s+/g, '-') === categoryId
            ) || categoryId;
        }
        
        if (this.categoriesWithTemplates.has(categoryName)) {
            const templates = this.categoriesWithTemplates.get(categoryName) || [];
            
            // Update all template categories
            for (const template of templates) {
                this.setItemCategory(template.id, newName);
            }
            
            // Move templates to new category
            this.categoriesWithTemplates.set(newName, templates);
            this.categoriesWithTemplates.delete(categoryName);
            
            // Update custom categories list
            this.removeCustomCategory(categoryName);
            this.addCustomCategory(newName);
        }
    }
}
