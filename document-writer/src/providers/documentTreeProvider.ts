import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateManagerService } from '../services/templateManagerService';
import { DocumentService } from '../services/documentService';

/**
 * Interface for document template category
 */
export interface TemplateCategory {
    id: string;
    name: string;
    templates: DocumentTemplate[];
    description?: string;
    iconPath?: string;
    sortOrder?: number;
}

/**
 * Interface for document template
 */
export interface DocumentTemplate {
    id: string;
    name: string;
    description: string;
    type: string;
    path: string;
    iconPath?: string;
    dateCreated: Date;
    dateModified: Date;
    tags?: string[];
    author?: string;
    version?: string;
}

/**
 * Tree item types in the document explorer
 */
export enum TreeItemType {
    Category,
    Template,
    RecentlyUsed,
    Favorites
}

/**
 * Document tree item representing either a category or a template
 */
export class DocumentTreeItem extends vscode.TreeItem {
    public readonly type: TreeItemType;
    public readonly id: string;
    public readonly category?: string;
    public readonly template?: DocumentTemplate;
    
    /**
     * Constructor for a category tree item
     * @param id Category ID
     * @param label Category name
     */
    constructor(
        id: string,
        label: string,
        collapsibleState: vscode.TreeItemCollapsibleState,
        type: TreeItemType,
        template?: DocumentTemplate
    ) {
        super(label, collapsibleState);
        
        this.id = id;
        this.type = type;
        
        if (type === TreeItemType.Template && template) {
            this.template = template;
            this.description = template.description;
            this.tooltip = new vscode.MarkdownString(`**${template.name}**\n\n${template.description}\n\n*Type: ${template.type}*`);
            
            // Set the icon based on template type
            const iconName = this._getIconForTemplateType(template.type);
            this.iconPath = {
                light: vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'icons', 'light', iconName)),
                dark: vscode.Uri.file(path.join(__dirname, '..', '..', '..', 'resources', 'icons', 'dark', iconName))
            };
            
            // Set the command that is executed when the tree item is clicked
            this.command = {
                command: 'documentWriter.openTemplate',
                title: 'Open Template',
                arguments: [template]
            };
            
            // Set the context value for context menu contributions
            this.contextValue = template.tags?.includes('favorite') ? 'favoriteTemplate' : 'template';
        } else if (type === TreeItemType.RecentlyUsed) {
            // This is the "Recently Used" category
            this.contextValue = 'recentCategory';
            this.iconPath = new vscode.ThemeIcon('history');
        } else if (type === TreeItemType.Favorites) {
            // This is the "Favorites" category
            this.contextValue = 'favoritesCategory';
            this.iconPath = new vscode.ThemeIcon('star-full');
        } else {
            // This is a standard category
            this.contextValue = 'category';
            
            // Add an icon for the category if not using a custom icon
            if (!this.iconPath) {
                this.iconPath = new vscode.ThemeIcon('folder');
            }
        }
    }
    
    /**
     * Get the icon file name for a template type
     * @param type Template type
     * @returns Icon file name
     */
    private _getIconForTemplateType(type: string): string {
        switch (type.toLowerCase()) {
            case 'business-report':
            case 'letter':
            case 'memo':
            case 'proposal':
                return 'business-template.svg';
                
            case 'technical-specification':
            case 'manual':
            case 'documentation':
                return 'technical-template.svg';
                
            case 'academic-paper':
            case 'research-paper':
            case 'thesis':
                return 'academic-template.svg';
                
            default:
                return 'document.svg';
        }
    }
}

/**
 * Tree data provider for document templates
 */
export class DocumentTreeProvider implements vscode.TreeDataProvider<DocumentTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<DocumentTreeItem | undefined | null | void> = new vscode.EventEmitter<DocumentTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<DocumentTreeItem | undefined | null | void> = this._onDidChangeTreeData.event;
    
    private _templateManager: TemplateManagerService;
    private _categories: TemplateCategory[] = [];
    private _recentlyUsedTemplates: DocumentTemplate[] = [];
    private _favoriteTemplates: DocumentTemplate[] = [];
    private _searchResults: DocumentTemplate[] = [];
    private _isSearchActive: boolean = false;
    private _autoRefreshEnabled: boolean = true;
    private _refreshInterval?: NodeJS.Timeout;
    private readonly _maxRecentItems: number = 5;
    private _documentService: DocumentService;
    private _dragAndDropEnabled: boolean = true;
    
    /**
     * Constructor
     * @param templateManager The template manager service
     * @param documentService The document service
     */
    constructor(
        templateManager: TemplateManagerService,
        documentService: DocumentService
    ) {
        this._templateManager = templateManager;
        this._documentService = documentService;
        this._initializeCategories();
        
        // Set up auto refresh if enabled
        if (this._autoRefreshEnabled) {
            this._startAutoRefresh();
        }
        
        // Register commands for context menu actions
        this._registerCommands();
        
        // Register drag and drop handler
        this._registerDragAndDropHandler();
    }
    
    /**
     * Register commands for context menu actions
     */
    private _registerCommands(): void {
        // Register refresh command
        vscode.commands.registerCommand('documentWriter.refreshTemplates', () => {
            this.refresh();
            vscode.window.showInformationMessage('Template list refreshed');
        });
        
        // Register add to favorites command
        vscode.commands.registerCommand('documentWriter.addToFavorites', (item: DocumentTreeItem) => {
            if (item.template) {
                const isFavorite = this.toggleFavorite(item.template.id);
                vscode.window.showInformationMessage(
                    isFavorite 
                        ? `Added "${item.template.name}" to favorites` 
                        : `Removed "${item.template.name}" from favorites`
                );
            }
        });
        
        // Register create new document from template command
        vscode.commands.registerCommand('documentWriter.createFromTemplate', (item: DocumentTreeItem) => {
            if (item.template) {
                vscode.commands.executeCommand('documentWriter.openDocumentWizard', item.template.id);
            }
        });
        
        // Register edit template command
        vscode.commands.registerCommand('documentWriter.editTemplate', (item: DocumentTreeItem) => {
            if (item.template) {
                vscode.commands.executeCommand('documentWriter.openTemplateEditor', item.template.id);
            }
        });
        
        // Register delete template command
        vscode.commands.registerCommand('documentWriter.deleteTemplate', async (item: DocumentTreeItem) => {
            if (item.template) {
                const result = await vscode.window.showWarningMessage(
                    `Are you sure you want to delete "${item.template.name}"?`,
                    { modal: true },
                    'Delete',
                    'Cancel'
                );
                
                if (result === 'Delete') {
                    try {
                        this.removeTemplate(item.template.id);
                        vscode.window.showInformationMessage(`Deleted "${item.template.name}"`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Error deleting template: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        });
        
        // Register create new category command
        vscode.commands.registerCommand('documentWriter.createCategory', async () => {
            const categoryName = await vscode.window.showInputBox({
                placeHolder: 'Enter category name',
                prompt: 'Create a new template category'
            });
            
            if (categoryName) {
                try {
                    const categoryId = categoryName.toLowerCase().replace(/\s+/g, '-');
                    
                    // Check if category already exists
                    if (this._categories.some(c => c.id === categoryId)) {
                        vscode.window.showErrorMessage(`Category "${categoryName}" already exists`);
                        return;
                    }
                    
                    this.addCategory({
                        id: categoryId,
                        name: categoryName,
                        description: `Templates for ${categoryName}`,
                        templates: []
                    });
                    
                    vscode.window.showInformationMessage(`Created category "${categoryName}"`);
                } catch (error) {
                    vscode.window.showErrorMessage(`Error creating category: ${error instanceof Error ? error.message : 'Unknown error'}`);
                }
            }
        });
        
        // Register rename category command
        vscode.commands.registerCommand('documentWriter.renameCategory', async (item: DocumentTreeItem) => {
            if (item.type === TreeItemType.Category) {
                const category = this._categories.find(c => c.id === item.id);
                
                if (category) {
                    const newName = await vscode.window.showInputBox({
                        placeHolder: 'Enter new category name',
                        prompt: 'Rename category',
                        value: category.name
                    });
                    
                    if (newName && newName !== category.name) {
                        try {
                            this.renameCategory(category.id, newName);
                            vscode.window.showInformationMessage(`Renamed category to "${newName}"`);
                        } catch (error) {
                            vscode.window.showErrorMessage(`Error renaming category: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                }
            }
        });
        
        // Register delete category command
        vscode.commands.registerCommand('documentWriter.deleteCategory', async (item: DocumentTreeItem) => {
            if (item.type === TreeItemType.Category) {
                const category = this._categories.find(c => c.id === item.id);
                
                if (category) {
                    // Check if category has templates
                    if (category.templates.length > 0) {
                        const result = await vscode.window.showWarningMessage(
                            `Category "${category.name}" contains ${category.templates.length} template(s). Are you sure you want to delete it?`,
                            { modal: true },
                            'Delete',
                            'Cancel'
                        );
                        
                        if (result !== 'Delete') {
                            return;
                        }
                    } else {
                        const result = await vscode.window.showWarningMessage(
                            `Are you sure you want to delete category "${category.name}"?`,
                            { modal: true },
                            'Delete',
                            'Cancel'
                        );
                        
                        if (result !== 'Delete') {
                            return;
                        }
                    }
                    
                    try {
                        this.removeCategory(category.id);
                        vscode.window.showInformationMessage(`Deleted category "${category.name}"`);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Error deleting category: ${error instanceof Error ? error.message : 'Unknown error'}`);
                    }
                }
            }
        });
    }
    
    /**
     * Register drag and drop handler
     */
    private _registerDragAndDropHandler(): void {
        if (!this._dragAndDropEnabled) {
            return;
        }
        
        // Register tree drag and drop controller
        const dragAndDropController: vscode.TreeDragAndDropController<DocumentTreeItem> = {
            dropMimeTypes: ['application/vnd.code.tree.documentWriter'],
            dragMimeTypes: ['application/vnd.code.tree.documentWriter'],
            
            /**
             * Handle drag start
             */
            handleDrag: (source: readonly DocumentTreeItem[], dataTransfer: vscode.DataTransfer): void => {
                // Only allow dragging templates
                const templates = source.filter(item => item.type === TreeItemType.Template && item.template);
                
                if (templates.length > 0) {
                    // Store the dragged templates
                    dataTransfer.set('application/vnd.code.tree.documentWriter', new vscode.DataTransferItem(
                        templates.map(item => ({
                            id: item.id,
                            type: item.type,
                            templateId: item.template?.id
                        }))
                    ));
                }
            },
            
            /**
             * Handle drop
             */
            handleDrop: async (target: DocumentTreeItem | undefined, dataTransfer: vscode.DataTransfer): Promise<void> => {
                const transferItem = dataTransfer.get('application/vnd.code.tree.documentWriter');
                
                if (!transferItem) {
                    return;
                }
                
                const draggedItems: {id: string, type: TreeItemType, templateId?: string}[] = transferItem.value;
                
                // Only allow dropping onto categories
                if (!target || target.type !== TreeItemType.Category) {
                    vscode.window.showErrorMessage('Templates can only be moved to categories');
                    return;
                }
                
                // Move each template to the target category
                for (const item of draggedItems) {
                    if (item.type === TreeItemType.Template && item.templateId) {
                        try {
                            this.moveTemplate(item.templateId, target.id);
                        } catch (error) {
                            vscode.window.showErrorMessage(`Error moving template: ${error instanceof Error ? error.message : 'Unknown error'}`);
                        }
                    }
                }
                
                // Refresh the tree view
                this.refresh();
                
                vscode.window.showInformationMessage(`Moved ${draggedItems.length} template(s) to ${target.label}`);
            }
        };
        
        // Return the drag and drop controller
        Object.defineProperty(this, 'dragAndDropController', {
            get: () => dragAndDropController
        });
    }
    
    /**
     * Initialize template categories
     */
    private async _initializeCategories(): Promise<void> {
        try {
            // In a real implementation, we would get categories from the template manager
            // For now, we'll create some sample categories
            this._categories = [
                {
                    id: 'business',
                    name: 'Business Documents',
                    description: 'Templates for business use cases',
                    sortOrder: 1,
                    templates: [
                        {
                            id: 'business-report',
                            name: 'Business Report',
                            description: 'A professional business report template',
                            type: 'business-report',
                            path: '/path/to/business-report.docx',
                            dateCreated: new Date('2025-01-15'),
                            dateModified: new Date('2025-05-20'),
                            tags: ['report', 'business']
                        },
                        {
                            id: 'letter',
                            name: 'Business Letter',
                            description: 'A formal business letter template',
                            type: 'letter',
                            path: '/path/to/letter.docx',
                            dateCreated: new Date('2025-02-10'),
                            dateModified: new Date('2025-05-15'),
                            tags: ['letter', 'business']
                        }
                    ]
                },
                {
                    id: 'technical',
                    name: 'Technical Documents',
                    description: 'Templates for technical documentation',
                    sortOrder: 2,
                    templates: [
                        {
                            id: 'technical-spec',
                            name: 'Technical Specification',
                            description: 'A detailed technical specification template',
                            type: 'technical-specification',
                            path: '/path/to/technical-specification.docx',
                            dateCreated: new Date('2025-03-05'),
                            dateModified: new Date('2025-05-10'),
                            tags: ['technical', 'specification']
                        },
                        {
                            id: 'user-manual',
                            name: 'User Manual',
                            description: 'A comprehensive user manual template',
                            type: 'manual',
                            path: '/path/to/user-manual.docx',
                            dateCreated: new Date('2025-04-12'),
                            dateModified: new Date('2025-06-01'),
                            tags: ['technical', 'manual']
                        }
                    ]
                },
                {
                    id: 'academic',
                    name: 'Academic Documents',
                    description: 'Templates for academic and research papers',
                    sortOrder: 3,
                    templates: [
                        {
                            id: 'research-paper',
                            name: 'Research Paper',
                            description: 'A formal academic research paper template',
                            type: 'academic-paper',
                            path: '/path/to/research-paper.docx',
                            dateCreated: new Date('2025-01-20'),
                            dateModified: new Date('2025-04-15'),
                            tags: ['academic', 'research']
                        }
                    ]
                }
            ];
            
            // Initialize recently used templates (would normally be loaded from storage)
            this._recentlyUsedTemplates = [
                this._categories[0].templates[0], // Business Report
                this._categories[1].templates[0]  // Technical Specification
            ];
            
            // Initialize favorite templates (would normally be loaded from storage)
            this._favoriteTemplates = [
                this._categories[1].templates[1], // User Manual
            ];
            
            // Mark templates as favorites
            this._favoriteTemplates.forEach(template => {
                if (!template.tags) {
                    template.tags = [];
                }
                if (!template.tags.includes('favorite')) {
                    template.tags.push('favorite');
                }
            });
            
            // Notify the tree view that data has changed
            this.refresh();
        } catch (error) {
            console.error('Error initializing categories:', error);
            vscode.window.showErrorMessage('Error loading document templates');
        }
    }
    
    /**
     * Start auto-refresh of the tree view
     */
    private _startAutoRefresh(): void {
        // Refresh every 5 minutes to check for template updates
        this._refreshInterval = setInterval(() => {
            this.refresh();
        }, 5 * 60 * 1000);
    }
    
    /**
     * Stop auto-refresh of the tree view
     */
    private _stopAutoRefresh(): void {
        if (this._refreshInterval) {
            clearInterval(this._refreshInterval);
            this._refreshInterval = undefined;
        }
    }
    
    /**
     * Dispose of resources
     */
    public dispose(): void {
        this._stopAutoRefresh();
    }
    
    /**
     * Refresh the tree view
     * @param item Optional specific item to refresh
     */
    public refresh(item?: DocumentTreeItem): void {
        this._onDidChangeTreeData.fire(item);
    }
    
    /**
     * Get tree item for a given element
     * @param element The tree item element
     * @returns The tree item
     */
    getTreeItem(element: DocumentTreeItem): vscode.TreeItem {
        return element;
    }
    
    /**
     * Get children of a given element
     * @param element The parent element
     * @returns Array of child tree items
     */
    getChildren(element?: DocumentTreeItem): Thenable<DocumentTreeItem[]> {
        // If search is active, return search results
        if (this._isSearchActive && !element) {
            // Group search results by category
            const categorizedResults = new Map<string, DocumentTemplate[]>();
            
            for (const template of this._searchResults) {
                // Find the category
                let categoryName = 'Other';
                let categoryId = 'other';
                
                for (const category of this._categories) {
                    if (category.templates.some(t => t.id === template.id)) {
                        categoryName = category.name;
                        categoryId = category.id;
                        break;
                    }
                }
                
                // Add to the category
                if (!categorizedResults.has(categoryId)) {
                    categorizedResults.set(categoryId, []);
                }
                
                categorizedResults.get(categoryId)?.push(template);
            }
            
            // Create tree items for each category with results
            const items: DocumentTreeItem[] = [];
            
            for (const [categoryId, templates] of categorizedResults.entries()) {
                // Find the category name
                const category = this._categories.find(c => c.id === categoryId);
                const categoryName = category?.name || 'Other';
                
                // Add the category
                const categoryItem = new DocumentTreeItem(
                    categoryId,
                    `${categoryName} (${templates.length})`,
                    vscode.TreeItemCollapsibleState.Expanded,
                    TreeItemType.Category
                );
                
                items.push(categoryItem);
                
                // Add the templates
                items.push(
                    ...templates.map(template => 
                        new DocumentTreeItem(
                            template.id,
                            template.name,
                            vscode.TreeItemCollapsibleState.None,
                            TreeItemType.Template,
                            template
                        )
                    )
                );
            }
            
            return Promise.resolve(items);
        }
        
        if (!element) {
            // Root level - return special categories and regular categories
            const items: DocumentTreeItem[] = [];
            
            // Add "Recently Used" category if there are recent templates
            if (this._recentlyUsedTemplates.length > 0) {
                items.push(
                    new DocumentTreeItem(
                        'recent',
                        'Recently Used',
                        vscode.TreeItemCollapsibleState.Expanded,
                        TreeItemType.RecentlyUsed
                    )
                );
            }
            
            // Add "Favorites" category if there are favorite templates
            if (this._favoriteTemplates.length > 0) {
                items.push(
                    new DocumentTreeItem(
                        'favorites',
                        'Favorites',
                        vscode.TreeItemCollapsibleState.Expanded,
                        TreeItemType.Favorites
                    )
                );
            }
            
            // Add regular categories, sorted by sortOrder if available
            const sortedCategories = [...this._categories].sort((a, b) => {
                const aOrder = a.sortOrder !== undefined ? a.sortOrder : Number.MAX_SAFE_INTEGER;
                const bOrder = b.sortOrder !== undefined ? b.sortOrder : Number.MAX_SAFE_INTEGER;
                return aOrder - bOrder;
            });
            
            items.push(
                ...sortedCategories.map(category => 
                    new DocumentTreeItem(
                        category.id,
                        category.name,
                        vscode.TreeItemCollapsibleState.Collapsed,
                        TreeItemType.Category
                    )
                )
            );
            
            return Promise.resolve(items);
        } else if (element.type === TreeItemType.RecentlyUsed) {
            // Recently Used category - return recent templates
            return Promise.resolve(
                this._recentlyUsedTemplates.map(template => 
                    new DocumentTreeItem(
                        template.id,
                        template.name,
                        vscode.TreeItemCollapsibleState.None,
                        TreeItemType.Template,
                        template
                    )
                )
            );
        } else if (element.type === TreeItemType.Favorites) {
            // Favorites category - return favorite templates
            return Promise.resolve(
                this._favoriteTemplates.map(template => 
                    new DocumentTreeItem(
                        template.id,
                        template.name,
                        vscode.TreeItemCollapsibleState.None,
                        TreeItemType.Template,
                        template
                    )
                )
            );
        } else if (element.type === TreeItemType.Category) {
            // Category level - return templates in the category
            const category = this._categories.find(c => c.id === element.id);
            
            if (category) {
                // Sort templates by name
                const sortedTemplates = [...category.templates].sort((a, b) => 
                    a.name.localeCompare(b.name)
                );
                
                return Promise.resolve(
                    sortedTemplates.map(template => 
                        new DocumentTreeItem(
                            template.id,
                            template.name,
                            vscode.TreeItemCollapsibleState.None,
                            TreeItemType.Template,
                            template
                        )
                    )
                );
            }
        }
        
        return Promise.resolve([]);
    }
    
    /**
     * Get parent of a given element
     * @param element The child element
     * @returns The parent tree item
     */
    getParent(element: DocumentTreeItem): Thenable<DocumentTreeItem | undefined> {
        if (element.type === TreeItemType.Template && element.template) {
            // Check if it's in recently used
            if (this._recentlyUsedTemplates.some(t => t.id === element.template?.id)) {
                return Promise.resolve(
                    new DocumentTreeItem(
                        'recent',
                        'Recently Used',
                        vscode.TreeItemCollapsibleState.Expanded,
                        TreeItemType.RecentlyUsed
                    )
                );
            }
            
            // Check if it's in favorites
            if (this._favoriteTemplates.some(t => t.id === element.template?.id)) {
                return Promise.resolve(
                    new DocumentTreeItem(
                        'favorites',
                        'Favorites',
                        vscode.TreeItemCollapsibleState.Expanded,
                        TreeItemType.Favorites
                    )
                );
            }
            
            // Find the parent category
            const parentCategory = this._categories.find(category => 
                category.templates.some(template => template.id === element.template?.id)
            );
            
            if (parentCategory) {
                return Promise.resolve(
                    new DocumentTreeItem(
                        parentCategory.id,
                        parentCategory.name,
                        vscode.TreeItemCollapsibleState.Expanded,
                        TreeItemType.Category
                    )
                );
            }
        }
        
        return Promise.resolve(undefined);
    }
    
    /**
     * Add a template to recently used
     * @param templateId The template ID
     */
    public addToRecentlyUsed(templateId: string): void {
        const template = this.getTemplateById(templateId);
        
        if (template) {
            // Remove if already in list
            this._recentlyUsedTemplates = this._recentlyUsedTemplates.filter(t => t.id !== templateId);
            
            // Add to the beginning of the list
            this._recentlyUsedTemplates.unshift(template);
            
            // Limit to max items
            if (this._recentlyUsedTemplates.length > this._maxRecentItems) {
                this._recentlyUsedTemplates = this._recentlyUsedTemplates.slice(0, this._maxRecentItems);
            }
            
            // Save to storage (would normally be implemented)
            this._saveRecentlyUsedToStorage();
            
            // Refresh the tree view
            this.refresh();
        }
    }
    
    /**
     * Toggle favorite status for a template
     * @param templateId The template ID
     * @returns True if the template is now a favorite, false otherwise
     */
    public toggleFavorite(templateId: string): boolean {
        const template = this.getTemplateById(templateId);
        
        if (template) {
            const isFavorite = this._favoriteTemplates.some(t => t.id === templateId);
            
            if (isFavorite) {
                // Remove from favorites
                this._favoriteTemplates = this._favoriteTemplates.filter(t => t.id !== templateId);
                
                // Update tags
                if (template.tags) {
                    template.tags = template.tags.filter(tag => tag !== 'favorite');
                }
            } else {
                // Add to favorites
                this._favoriteTemplates.push(template);
                
                // Update tags
                if (!template.tags) {
                    template.tags = [];
                }
                if (!template.tags.includes('favorite')) {
                    template.tags.push('favorite');
                }
            }
            
            // Save to storage (would normally be implemented)
            this._saveFavoritesToStorage();
            
            // Refresh the tree view
            this.refresh();
            
            return !isFavorite;
        }
        
        return false;
    }
    
    /**
     * Check if a template is a favorite
     * @param templateId The template ID
     * @returns True if the template is a favorite, false otherwise
     */
    public isFavorite(templateId: string): boolean {
        return this._favoriteTemplates.some(t => t.id === templateId);
    }
    
    /**
     * Start a search
     * @param query The search query
     */
    public startSearch(query: string): void {
        if (!query.trim()) {
            this.cancelSearch();
            return;
        }
        
        this._searchResults = this.searchTemplates(query);
        this._isSearchActive = true;
        this.refresh();
    }
    
    /**
     * Cancel the current search
     */
    public cancelSearch(): void {
        this._searchResults = [];
        this._isSearchActive = false;
        this.refresh();
    }
    
    /**
     * Add a new template to a category
     * @param template The template to add
     * @param categoryId The category ID
     */
    public addTemplate(template: DocumentTemplate, categoryId: string): void {
        // Find the category
        const category = this._categories.find(c => c.id === categoryId);
        
        if (category) {
            // Add the template to the category
            category.templates.push(template);
            
            // Notify the tree view that data has changed
            this.refresh();
        } else {
            throw new Error(`Category with ID ${categoryId} not found`);
        }
    }
    
    /**
     * Remove a template
     * @param templateId The template ID
     */
    public removeTemplate(templateId: string): void {
        // Find the category containing the template
        const category = this._categories.find(c => 
            c.templates.some(t => t.id === templateId)
        );
        
        if (category) {
            // Remove the template from the category
            category.templates = category.templates.filter(t => t.id !== templateId);
            
            // Also remove from recently used and favorites
            this._recentlyUsedTemplates = this._recentlyUsedTemplates.filter(t => t.id !== templateId);
            this._favoriteTemplates = this._favoriteTemplates.filter(t => t.id !== templateId);
            
            // Save to storage
            this._saveRecentlyUsedToStorage();
            this._saveFavoritesToStorage();
            
            // Notify the tree view that data has changed
            this.refresh();
        } else {
            throw new Error(`Template with ID ${templateId} not found`);
        }
    }
    
    /**
     * Add a new category
     * @param category The category to add
     */
    public addCategory(category: TemplateCategory): void {
        // Check if a category with the same ID already exists
        if (this._categories.some(c => c.id === category.id)) {
            throw new Error(`Category with ID ${category.id} already exists`);
        }
        
        // Add the category
        this._categories.push(category);
        
        // Notify the tree view that data has changed
        this.refresh();
    }
    
    /**
     * Remove a category
     * @param categoryId The category ID
     */
    public removeCategory(categoryId: string): void {
        // Check if the category exists
        if (!this._categories.some(c => c.id === categoryId)) {
            throw new Error(`Category with ID ${categoryId} not found`);
        }
        
        // Remove the category
        this._categories = this._categories.filter(c => c.id !== categoryId);
        
        // Notify the tree view that data has changed
        this.refresh();
    }
    
    /**
     * Rename a category
     * @param categoryId The category ID
     * @param newName The new name for the category
     */
    public renameCategory(categoryId: string, newName: string): void {
        // Find the category
        const category = this._categories.find(c => c.id === categoryId);
        
        if (category) {
            // Update the name
            category.name = newName;
            
            // Notify the tree view that data has changed
            this.refresh();
        } else {
            throw new Error(`Category with ID ${categoryId} not found`);
        }
    }
    
    /**
     * Move a template to a different category
     * @param templateId The template ID
     * @param targetCategoryId The target category ID
     */
    public moveTemplate(templateId: string, targetCategoryId: string): void {
        // Find the source category
        const sourceCategory = this._categories.find(c => 
            c.templates.some(t => t.id === templateId)
        );
        
        // Find the target category
        const targetCategory = this._categories.find(c => c.id === targetCategoryId);
        
        if (!sourceCategory) {
            throw new Error(`Template with ID ${templateId} not found`);
        }
        
        if (!targetCategory) {
            throw new Error(`Category with ID ${targetCategoryId} not found`);
        }
        
        // Find the template
        const templateIndex = sourceCategory.templates.findIndex(t => t.id === templateId);
        
        if (templateIndex !== -1) {
            // Remove from source category
            const template = sourceCategory.templates.splice(templateIndex, 1)[0];
            
            // Add to target category
            targetCategory.templates.push(template);
            
            // Notify the tree view that data has changed
            this.refresh();
        }
    }
    
    /**
     * Search for templates
     * @param query The search query
     * @returns Array of matching templates
     */
    public searchTemplates(query: string): DocumentTemplate[] {
        const results: DocumentTemplate[] = [];
        const queryLower = query.toLowerCase();
        
        // Search through all categories and templates
        for (const category of this._categories) {
            for (const template of category.templates) {
                if (
                    template.name.toLowerCase().includes(queryLower) ||
                    template.description.toLowerCase().includes(queryLower) ||
                    template.type.toLowerCase().includes(queryLower) ||
                    template.tags?.some(tag => tag.toLowerCase().includes(queryLower))
                ) {
                    results.push(template);
                }
            }
        }
        
        return results;
    }
    
    /**
     * Get a template by ID
     * @param templateId The template ID
     * @returns The template or undefined if not found
     */
    public getTemplateById(templateId: string): DocumentTemplate | undefined {
        // Check favorites and recently used first (for performance)
        let template = this._favoriteTemplates.find(t => t.id === templateId);
        if (template) {
            return template;
        }
        
        template = this._recentlyUsedTemplates.find(t => t.id === templateId);
        if (template) {
            return template;
        }
        
        // Check all categories
        for (const category of this._categories) {
            template = category.templates.find(t => t.id === templateId);
            if (template) {
                return template;
            }
        }
        
        return undefined;
    }
    
    /**
     * Get all templates
     * @returns Array of all templates
     */
    public getAllTemplates(): DocumentTemplate[] {
        const allTemplates: DocumentTemplate[] = [];
        
        for (const category of this._categories) {
            allTemplates.push(...category.templates);
        }
        
        return allTemplates;
    }
    
    /**
     * Get templates by type
     * @param type The template type
     * @returns Array of templates of the specified type
     */
    public getTemplatesByType(type: string): DocumentTemplate[] {
        const templates: DocumentTemplate[] = [];
        
        for (const category of this._categories) {
            templates.push(...category.templates.filter(t => t.type === type));
        }
        
        return templates;
    }
    
    /**
     * Save recently used templates to storage
     */
    private _saveRecentlyUsedToStorage(): void {
        // In a real implementation, this would save to vscode.ExtensionContext.globalState
        // For now, we'll just log to the console
        console.log('Saving recently used templates to storage');
    }
    
    /**
     * Save favorite templates to storage
     */
    private _saveFavoritesToStorage(): void {
        // In a real implementation, this would save to vscode.ExtensionContext.globalState
        // For now, we'll just log to the console
        console.log('Saving favorite templates to storage');
    }
    
    /**
     * Get the drag and drop controller
     */
    public get dragAndDropController(): vscode.TreeDragAndDropController<DocumentTreeItem> {
        // This property is defined in _registerDragAndDropHandler
        return {} as vscode.TreeDragAndDropController<DocumentTreeItem>;
    }
}
