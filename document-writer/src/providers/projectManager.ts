import * as vscode from 'vscode';
import * as path from 'path';
import { DocumentService } from '../services/documentService';
import { TemplateManagerService } from '../services/templateManagerService';
import { StatusBarManager } from './statusBarManager';

export interface ProjectData {
    version: string;
    name: string;
    description?: string;
    exportDate: string;
    workspace?: {
        folders?: string[];
        settings?: any;
    };
    documents: DocumentProjectItem[];
    templates?: TemplateProjectItem[];
    metadata?: {
        author?: string;
        tags?: string[];
        [key: string]: any;
    };
}

export interface DocumentProjectItem {
    relativePath: string;
    title: string;
    type: string;
    content: string;
    metadata?: any;
    lastModified?: string;
}

export interface TemplateProjectItem {
    name: string;
    category: string;
    content: string;
    metadata?: any;
}

export class ProjectManager {
    private static readonly PROJECT_VERSION = '1.0';
    private static readonly PROJECT_FILE_EXTENSION = '.dwproject';

    constructor(
        private context: vscode.ExtensionContext,
        private documentService: DocumentService,
        private templateManager: TemplateManagerService,
        private statusBarManager?: StatusBarManager
    ) {
        this.registerCommands();
    }

    private registerCommands(): void {
        this.context.subscriptions.push(
            vscode.commands.registerCommand('documentWriter.exportProject', () => {
                this.exportProject();
            }),
            vscode.commands.registerCommand('documentWriter.importProject', () => {
                this.importProject();
            }),
            vscode.commands.registerCommand('documentWriter.createProjectTemplate', () => {
                this.createProjectTemplate();
            })
        );
    }

    /**
     * Export current workspace as a project
     */
    public async exportProject(): Promise<void> {
        try {
            // Show progress
            if (this.statusBarManager) {
                this.statusBarManager.showProgress('Preparing project export...');
            }

            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                vscode.window.showErrorMessage('No workspace folder open');
                return;
            }

            // Get project name
            const projectName = await vscode.window.showInputBox({
                prompt: 'Enter project name',
                value: path.basename(workspaceFolder.uri.fsPath),
                validateInput: (value) => {
                    if (!value || value.trim().length === 0) {
                        return 'Project name is required';
                    }
                    return null;
                }
            });

            if (!projectName) {
                return;
            }

            // Get project description
            const projectDescription = await vscode.window.showInputBox({
                prompt: 'Enter project description (optional)',
                placeHolder: 'A brief description of this document project'
            });

            // Collect documents
            const documents = await this.collectDocuments(workspaceFolder);
            
            // Collect templates
            const templates = await this.collectTemplates();

            // Create project data
            const projectData: ProjectData = {
                version: ProjectManager.PROJECT_VERSION,
                name: projectName,
                description: projectDescription,
                exportDate: new Date().toISOString(),
                workspace: {
                    folders: vscode.workspace.workspaceFolders?.map(f => f.name),
                    settings: vscode.workspace.getConfiguration('documentWriter')
                },
                documents,
                templates,
                metadata: {
                    author: vscode.workspace.getConfiguration('documentWriter').get('defaultAuthor'),
                    exportedBy: 'Document Writer Extension',
                    vsCodeVersion: vscode.version
                }
            };

            // Save project file
            const saveUri = await vscode.window.showSaveDialog({
                defaultUri: vscode.Uri.file(`${projectName}${ProjectManager.PROJECT_FILE_EXTENSION}`),
                filters: {
                    'Document Writer Project': ['dwproject'],
                    'JSON': ['json']
                }
            });

            if (saveUri) {
                const encoder = new TextEncoder();
                const projectJson = JSON.stringify(projectData, null, 2);
                await vscode.workspace.fs.writeFile(saveUri, encoder.encode(projectJson));

                if (this.statusBarManager) {
                    this.statusBarManager.hideProgress();
                }

                vscode.window.showInformationMessage(
                    `Project exported successfully: ${documents.length} documents, ${templates.length} templates`,
                    'Open File'
                ).then(selection => {
                    if (selection === 'Open File') {
                        vscode.workspace.openTextDocument(saveUri).then(doc => {
                            vscode.window.showTextDocument(doc);
                        });
                    }
                });
            }
        } catch (error) {
            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }
            console.error('Export project error:', error);
            vscode.window.showErrorMessage(`Failed to export project: ${error}`);
        }
    }

    /**
     * Import a project file
     */
    public async importProject(): Promise<void> {
        try {
            // Select project file
            const projectFiles = await vscode.window.showOpenDialog({
                canSelectFiles: true,
                canSelectFolders: false,
                canSelectMany: false,
                filters: {
                    'Document Writer Project': ['dwproject'],
                    'JSON': ['json']
                },
                title: 'Select Project File to Import'
            });

            if (!projectFiles || projectFiles.length === 0) {
                return;
            }

            // Show progress
            if (this.statusBarManager) {
                this.statusBarManager.showProgress('Importing project...');
            }

            // Read project file
            const projectUri = projectFiles[0];
            const projectContent = await vscode.workspace.fs.readFile(projectUri);
            const decoder = new TextDecoder();
            const projectData: ProjectData = JSON.parse(decoder.decode(projectContent));

            // Validate project data
            if (!this.validateProjectData(projectData)) {
                throw new Error('Invalid project file format');
            }

            // Show import options
            const importOption = await vscode.window.showQuickPick([
                { label: '$(folder) Import to current workspace', value: 'current' },
                { label: '$(folder-opened) Create new workspace', value: 'new' },
                { label: '$(files) Import documents only', value: 'documents' },
                { label: '$(file-text) Import templates only', value: 'templates' }
            ], {
                placeHolder: 'Select import option'
            });

            if (!importOption) {
                return;
            }

            switch (importOption.value) {
                case 'current':
                    await this.importToCurrentWorkspace(projectData);
                    break;
                case 'new':
                    await this.importToNewWorkspace(projectData);
                    break;
                case 'documents':
                    await this.importDocumentsOnly(projectData);
                    break;
                case 'templates':
                    await this.importTemplatesOnly(projectData);
                    break;
            }

            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }

        } catch (error) {
            if (this.statusBarManager) {
                this.statusBarManager.hideProgress();
            }
            console.error('Import project error:', error);
            vscode.window.showErrorMessage(`Failed to import project: ${error}`);
        }
    }

    /**
     * Create a project template
     */
    public async createProjectTemplate(): Promise<void> {
        const templates: vscode.QuickPickItem[] = [
            {
                label: '$(book) Technical Documentation',
                description: 'API docs, user guides, specifications',
                detail: 'Includes: README, API reference template, user guide template, changelog'
            },
            {
                label: '$(briefcase) Business Reports',
                description: 'Reports, proposals, presentations',
                detail: 'Includes: Executive summary, quarterly report, proposal templates'
            },
            {
                label: '$(mortar-board) Academic Papers',
                description: 'Research papers, dissertations, essays',
                detail: 'Includes: Research paper, literature review, dissertation chapter templates'
            },
            {
                label: '$(notebook) Personal Blog',
                description: 'Blog posts, articles, journals',
                detail: 'Includes: Blog post, tutorial, personal journal templates'
            },
            {
                label: '$(law) Legal Documents',
                description: 'Contracts, agreements, policies',
                detail: 'Includes: Contract, NDA, privacy policy templates'
            }
        ];

        const selection = await vscode.window.showQuickPick(templates, {
            placeHolder: 'Select a project template'
        });

        if (selection) {
            await this.createProjectFromTemplate(selection.label);
        }
    }

    /**
     * Collect documents from workspace
     */
    private async collectDocuments(workspaceFolder: vscode.WorkspaceFolder): Promise<DocumentProjectItem[]> {
        const documents: DocumentProjectItem[] = [];
        
        // Find all document files
        const pattern = new vscode.RelativePattern(workspaceFolder, '**/*.{md,txt,html,docx}');
        const files = await vscode.workspace.findFiles(pattern, '**/node_modules/**');

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const decoder = new TextDecoder();
                const text = decoder.decode(content);
                const relativePath = vscode.workspace.asRelativePath(file);
                
                documents.push({
                    relativePath,
                    title: path.basename(file.fsPath, path.extname(file.fsPath)),
                    type: path.extname(file.fsPath).substring(1),
                    content: text,
                    lastModified: new Date().toISOString()
                });
            } catch (error) {
                console.error(`Failed to collect document ${file.fsPath}:`, error);
            }
        }

        return documents;
    }

    /**
     * Collect templates
     */
    private async collectTemplates(): Promise<TemplateProjectItem[]> {
        const templates: TemplateProjectItem[] = [];
        
        // Get templates from template manager
        const allTemplates = await this.templateManager.getAllTemplates();
        
        for (const template of allTemplates) {
            templates.push({
                name: template.name,
                category: template.category || 'General',
                content: JSON.stringify(template),
                metadata: template.metadata
            });
        }

        return templates;
    }

    /**
     * Validate project data
     */
    private validateProjectData(data: ProjectData): boolean {
        if (!data.version || !data.name || !data.documents) {
            return false;
        }

        // Check version compatibility
        const majorVersion = data.version.split('.')[0];
        const currentMajor = ProjectManager.PROJECT_VERSION.split('.')[0];
        
        if (majorVersion !== currentMajor) {
            vscode.window.showWarningMessage(
                `Project was created with version ${data.version}, current version is ${ProjectManager.PROJECT_VERSION}`
            );
        }

        return true;
    }

    /**
     * Import to current workspace
     */
    private async importToCurrentWorkspace(projectData: ProjectData): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        let importedDocs = 0;
        let importedTemplates = 0;

        // Import documents
        for (const doc of projectData.documents) {
            try {
                const docPath = vscode.Uri.joinPath(workspaceFolder.uri, doc.relativePath);
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(docPath, encoder.encode(doc.content));
                importedDocs++;
            } catch (error) {
                console.error(`Failed to import document ${doc.relativePath}:`, error);
            }
        }

        // Import templates
        if (projectData.templates) {
            for (const template of projectData.templates) {
                try {
                    const templateData = JSON.parse(template.content);
                    await this.templateManager.saveTemplate(templateData);
                    importedTemplates++;
                } catch (error) {
                    console.error(`Failed to import template ${template.name}:`, error);
                }
            }
        }

        vscode.window.showInformationMessage(
            `Project imported: ${importedDocs} documents, ${importedTemplates} templates`
        );
    }

    /**
     * Import to new workspace
     */
    private async importToNewWorkspace(projectData: ProjectData): Promise<void> {
        // Select folder for new workspace
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select folder for new workspace'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const newWorkspaceFolder = folderUri[0];
        
        // Create project folder
        const projectFolder = vscode.Uri.joinPath(newWorkspaceFolder, projectData.name);
        await vscode.workspace.fs.createDirectory(projectFolder);

        // Import documents
        for (const doc of projectData.documents) {
            try {
                const docPath = vscode.Uri.joinPath(projectFolder, doc.relativePath);
                const docDir = vscode.Uri.joinPath(projectFolder, path.dirname(doc.relativePath));
                
                // Ensure directory exists
                await vscode.workspace.fs.createDirectory(docDir);
                
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(docPath, encoder.encode(doc.content));
            } catch (error) {
                console.error(`Failed to import document ${doc.relativePath}:`, error);
            }
        }

        // Open new workspace
        await vscode.commands.executeCommand('vscode.openFolder', projectFolder, false);
    }

    /**
     * Import documents only
     */
    private async importDocumentsOnly(projectData: ProjectData): Promise<void> {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('No workspace folder open');
        }

        let imported = 0;
        for (const doc of projectData.documents) {
            try {
                const docPath = vscode.Uri.joinPath(workspaceFolder.uri, doc.relativePath);
                const encoder = new TextEncoder();
                await vscode.workspace.fs.writeFile(docPath, encoder.encode(doc.content));
                imported++;
            } catch (error) {
                console.error(`Failed to import document ${doc.relativePath}:`, error);
            }
        }

        vscode.window.showInformationMessage(`Imported ${imported} documents`);
    }

    /**
     * Import templates only
     */
    private async importTemplatesOnly(projectData: ProjectData): Promise<void> {
        if (!projectData.templates) {
            vscode.window.showWarningMessage('No templates found in project');
            return;
        }

        let imported = 0;
        for (const template of projectData.templates) {
            try {
                const templateData = JSON.parse(template.content);
                await this.templateManager.saveTemplate(templateData);
                imported++;
            } catch (error) {
                console.error(`Failed to import template ${template.name}:`, error);
            }
        }

        vscode.window.showInformationMessage(`Imported ${imported} templates`);
    }

    /**
     * Create project from template
     */
    private async createProjectFromTemplate(templateType: string): Promise<void> {
        // This would create a new project with predefined structure and templates
        // based on the selected type
        vscode.window.showInformationMessage(
            `Creating ${templateType} project template... (Feature coming soon)`
        );
    }

    /**
     * Dispose resources
     */
    public dispose(): void {
        // Cleanup if needed
    }
}