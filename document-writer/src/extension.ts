import * as vscode from 'vscode';
import { DocumentService } from './services/documentService';
import { TemplateManagerService } from './services/templateManagerService';
import { DocumentFormat } from './models/documentTemplate';
import { ClineIntegration } from './integrations/clineIntegration';

export function activate(context: vscode.ExtensionContext) {
    console.log('Document Writer extension is now active');

    // Initialize services
    const documentService = new DocumentService(context);
    const templateManagerService = new TemplateManagerService(context);
    
    // Initialize Cline integration
    const clineIntegration = new ClineIntegration(context);
    context.subscriptions.push(clineIntegration);
    
    // Initialize MCP server
    clineIntegration.initialize().then(success => {
        if (success) {
            vscode.window.showInformationMessage('Document Writer MCP server started successfully');
        } else {
            vscode.window.showWarningMessage('Failed to start Document Writer MCP server');
        }
    });

    // Register commands
    registerCommands(context, documentService, templateManagerService, clineIntegration);

    // Show welcome message on first activation
    const hasShownWelcome = context.globalState.get('document-writer.hasShownWelcome');
    if (!hasShownWelcome) {
        showWelcomeMessage();
        context.globalState.update('document-writer.hasShownWelcome', true);
    }
}

/**
 * Register all extension commands
 */
function registerCommands(
    context: vscode.ExtensionContext,
    documentService: DocumentService,
    templateManagerService: TemplateManagerService,
    clineIntegration: ClineIntegration
) {
    // Template management commands
    context.subscriptions.push(
        vscode.commands.registerCommand('document-writer.createTemplate', () => {
            createTemplateCommand(templateManagerService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('document-writer.importTemplate', () => {
            importTemplateCommand(templateManagerService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('document-writer.listTemplates', () => {
            listTemplatesCommand(templateManagerService);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('document-writer.deleteTemplate', () => {
            deleteTemplateCommand(templateManagerService);
        })
    );

    // Document generation commands
    context.subscriptions.push(
        vscode.commands.registerCommand('document-writer.generateDocument', async () => {
            generateDocumentCommand(templateManagerService, documentService);
        })
    );
}

/**
 * Show welcome message and quick start guide
 */
async function showWelcomeMessage() {
    const message = 'Welcome to Document Writer! Would you like to see a quick start guide?';
    const result = await vscode.window.showInformationMessage(message, 'Yes', 'No');

    if (result === 'Yes') {
        // TODO: Show quick start guide
        vscode.window.showInformationMessage(
            'Document Writer helps you create and manage document templates, and generate documents from them.\n\n' +
            'To get started, use the command palette (Ctrl+Shift+P) and search for "Document Writer" commands.'
        );
    }
}

/**
 * Command to create a new template
 */
async function createTemplateCommand(templateManagerService: TemplateManagerService) {
    vscode.window.showInformationMessage('Create template command not implemented yet');
    // TODO: Implement template creation UI in Phase 2
}

/**
 * Command to import a template from a file
 */
async function importTemplateCommand(templateManagerService: TemplateManagerService) {
    try {
        // Prompt for template file
        const fileUris = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: false,
            filters: {
                'Templates': ['docx', 'md', 'html', 'htm', 'pdf'],
                'All Files': ['*']
            },
            title: 'Select Template File'
        });

        if (!fileUris || fileUris.length === 0) {
            return;
        }

        const filePath = fileUris[0].fsPath;

        // Prompt for template name
        const name = await vscode.window.showInputBox({
            prompt: 'Enter a name for the template',
            placeHolder: 'Template Name',
            validateInput: (value) => {
                return value && value.trim().length > 0 ? null : 'Name is required';
            }
        });

        if (!name) {
            return;
        }

        // Prompt for template description
        const description = await vscode.window.showInputBox({
            prompt: 'Enter a description for the template',
            placeHolder: 'Template Description'
        }) || '';

        // Import the template
        const template = await templateManagerService.importTemplate(filePath, name, description);
        
        vscode.window.showInformationMessage(`Template "${template.name}" imported successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to import template: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Command to list all templates
 */
async function listTemplatesCommand(templateManagerService: TemplateManagerService) {
    try {
        const templates = templateManagerService.getTemplates();

        if (templates.length === 0) {
            vscode.window.showInformationMessage('No templates found. Import or create a template first.');
            return;
        }

        // Show templates in a quick pick
        const selected = await vscode.window.showQuickPick(
            templates.map(template => ({
                label: template.name,
                description: template.format,
                detail: template.description,
                template: template
            })),
            {
                placeHolder: 'Select a template to view details',
                title: 'Available Templates'
            }
        );

        if (selected) {
            // Show template details
            vscode.window.showInformationMessage(
                `Template: ${selected.template.name}\n` +
                `Format: ${selected.template.format}\n` +
                `Description: ${selected.template.description}\n` +
                `Path: ${selected.template.templatePath}`
            );
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to list templates: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Command to delete a template
 */
async function deleteTemplateCommand(templateManagerService: TemplateManagerService) {
    try {
        const templates = templateManagerService.getTemplates();

        if (templates.length === 0) {
            vscode.window.showInformationMessage('No templates found to delete.');
            return;
        }

        // Show templates in a quick pick
        const selected = await vscode.window.showQuickPick(
            templates.map(template => ({
                label: template.name,
                description: template.format,
                detail: template.description,
                template: template
            })),
            {
                placeHolder: 'Select a template to delete',
                title: 'Delete Template'
            }
        );

        if (!selected) {
            return;
        }

        // Confirm deletion
        const confirm = await vscode.window.showWarningMessage(
            `Are you sure you want to delete the template "${selected.template.name}"?`,
            { modal: true },
            'Delete',
            'Cancel'
        );

        if (confirm !== 'Delete') {
            return;
        }

        // Delete the template
        await templateManagerService.deleteTemplate(selected.template.id);
        
        vscode.window.showInformationMessage(`Template "${selected.template.name}" deleted successfully`);
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to delete template: ${error instanceof Error ? error.message : String(error)}`);
    }
}

/**
 * Command to generate a document from a template
 */
async function generateDocumentCommand(
    templateManagerService: TemplateManagerService,
    documentService: DocumentService
) {
    try {
        const templates = templateManagerService.getTemplates();

        if (templates.length === 0) {
            vscode.window.showInformationMessage('No templates found. Import or create a template first.');
            return;
        }

        // Show templates in a quick pick
        const selected = await vscode.window.showQuickPick(
            templates.map(template => ({
                label: template.name,
                description: template.format,
                detail: template.description,
                template: template
            })),
            {
                placeHolder: 'Select a template to generate a document',
                title: 'Generate Document'
            }
        );

        if (!selected) {
            return;
        }

        // In Phase 1, we'll use a simple key-value form for template data
        // In Phase 2, we'll create a more sophisticated form based on template sections and placeholders
        const data: Record<string, any> = {};
        
        // This is a simplified implementation - Phase 2 will have a proper form UI
        if (selected.template.format === DocumentFormat.DOCX || 
            selected.template.format === DocumentFormat.MARKDOWN) {
            // Get a few sample fields for demo purposes
            const title = await vscode.window.showInputBox({
                prompt: 'Enter a title for the document',
                placeHolder: 'Document Title'
            });
            
            if (title === undefined) {
                return; // User cancelled
            }
            
            data.title = title;
            
            const author = await vscode.window.showInputBox({
                prompt: 'Enter the author name',
                placeHolder: 'Author Name'
            });
            
            if (author === undefined) {
                return; // User cancelled
            }
            
            data.author = author;
            
            const content = await vscode.window.showInputBox({
                prompt: 'Enter some content for the document',
                placeHolder: 'Document Content'
            });
            
            if (content === undefined) {
                return; // User cancelled
            }
            
            data.content = content;
        }
        
        // Prompt for output directory
        const outputDirUris = await vscode.window.showOpenDialog({
            canSelectFiles: false,
            canSelectFolders: true,
            canSelectMany: false,
            title: 'Select Output Directory'
        });

        if (!outputDirUris || outputDirUris.length === 0) {
            return;
        }

        const outputPath = outputDirUris[0].fsPath;

        // Generate the document
        const documentPath = await documentService.generateDocument(
            selected.template,
            data,
            outputPath
        );
        
        vscode.window.showInformationMessage(
            `Document generated successfully: ${documentPath}`,
            'Open Document'
        ).then(selection => {
            if (selection === 'Open Document') {
                // Open the document with the default application
                const uri = vscode.Uri.file(documentPath);
                vscode.env.openExternal(uri);
            }
        });
    } catch (error) {
        vscode.window.showErrorMessage(`Failed to generate document: ${error instanceof Error ? error.message : String(error)}`);
    }
}

export function deactivate() {
    console.log('Document Writer extension is now deactivated');
}
