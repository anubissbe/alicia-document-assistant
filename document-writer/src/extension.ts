import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import { DocumentWebviewProvider } from './providers/documentWebviewProvider';
import { DocumentService } from './services/documentService';
import { TemplateManagerService } from './services/templateManagerService';
import { DocumentCreationWizard } from './providers/documentCreationWizard';
import { DocumentAssistant } from './providers/documentAssistant';
import { DocumentTreeProvider } from './providers/documentTreeProvider';
import { ExportService } from './services/exportService';
import { ClineIntegration } from './integrations/clineIntegration';
import { FormatProcessor } from './core/formatProcessor';
import { ConversationHistoryManager } from './providers/conversationHistoryManager';
import { EntityExtractor } from './core/entityExtractor';
import { ContentSuggestionEngine } from './core/contentSuggestionEngine';
import { FeedbackLearningEngine } from './core/feedbackLearningEngine';
import { SentimentAnalyzer } from './core/sentimentAnalyzer';
import { StatusBarManager } from './providers/statusBarManager';
import { AutoSaveManager } from './providers/autoSaveManager';
import { ProjectManager } from './providers/projectManager';
import { DocumentShareProvider } from './providers/documentShareProvider';
import { VersionHistoryProvider } from './providers/versionHistoryProvider';
import { PrintPreviewProvider } from './providers/printPreviewProvider';
import { cacheManager } from './utils/cacheManager';
import { memoryManager } from './utils/memoryManager';
import { webviewOptimizer } from './utils/webviewOptimizer';

export function activate(context: vscode.ExtensionContext) {
    try {
        console.log('Alicia - Your Personal Document Assistant is activating...');
        vscode.window.showInformationMessage('Welcome to Alicia - Your Personal Document Assistant!');
        
        // Register a simple test command first
        context.subscriptions.push(
            vscode.commands.registerCommand('document-writer.test', () => {
                vscode.window.showInformationMessage('Alicia test command works!');
            })
        );
        
        // Initialize core services
        const templateManager = new TemplateManagerService(context);
        const clineIntegration = new ClineIntegration(context);
        const documentService = new DocumentService();
        const exportService = new ExportService(templateManager, documentService);
        const formatProcessor = new FormatProcessor();
        
        // Initialize AI services for DocumentAssistant
        const conversationHistoryManager = new ConversationHistoryManager();
        const entityExtractor = new EntityExtractor();
        const contentSuggestionEngine = new ContentSuggestionEngine();
        const feedbackLearningEngine = new FeedbackLearningEngine(context);
        const sentimentAnalyzer = new SentimentAnalyzer();
        
        // Initialize status bar manager
        const statusBarManager = new StatusBarManager(context, clineIntegration, documentService);
        context.subscriptions.push(statusBarManager);
        
        // Set status bar manager on document service
        documentService.setStatusBarManager(statusBarManager);
        
        // Initialize auto-save manager
        const autoSaveManager = new AutoSaveManager(context, documentService, statusBarManager);
        context.subscriptions.push(autoSaveManager);
        
        // Initialize project manager
        const projectManager = new ProjectManager(context, documentService, templateManager, statusBarManager);
        context.subscriptions.push(projectManager);
        
        // Initialize document share provider
        const documentShareProvider = new DocumentShareProvider(context, documentService, statusBarManager);
        context.subscriptions.push(documentShareProvider);
        
        // Initialize version history provider
        const versionHistoryProvider = new VersionHistoryProvider(context, documentService, statusBarManager);
        context.subscriptions.push(versionHistoryProvider);
        
        // Initialize print preview provider
        const printPreviewProvider = new PrintPreviewProvider(context, documentService, statusBarManager);
        context.subscriptions.push(printPreviewProvider);
        
        // Initialize performance managers
        console.log('Initializing performance optimization systems...');
        
        // Set context for cache manager
        cacheManager['context'] = context;
        
        // Start memory monitoring in production mode
        memoryManager.startMonitoring();
        
        // Monitor extension memory usage
        memoryManager.registerCleanupStrategy({
            name: 'Extension cache cleanup',
            priority: 50,
            condition: (stats) => stats.heapUsedPercentage > 80,
            action: () => {
                console.log('Running extension cache cleanup...');
                cacheManager.cleanupAll();
            }
        });
        
        // Add dispose handlers for performance managers
        context.subscriptions.push({
            dispose: () => {
                console.log('Disposing performance managers...');
                memoryManager.dispose();
                cacheManager.dispose();
                webviewOptimizer.dispose();
            }
        });
    
    // Initialize wizard
    const documentCreationWizard = new DocumentCreationWizard(context.extensionUri, documentService, templateManager);
    
    // Register document webview provider
    const documentWebviewProvider = new DocumentWebviewProvider(context.extensionUri, documentService, formatProcessor);
    documentWebviewProvider.setAutoSaveManager(autoSaveManager);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DocumentWebviewProvider.viewType,
            documentWebviewProvider
        )
    );
    
    // Initialize document assistant (it registers its own commands)
    const documentAssistant = new DocumentAssistant(
        context.extensionUri, 
        conversationHistoryManager,
        entityExtractor,
        contentSuggestionEngine,
        feedbackLearningEngine,
        sentimentAnalyzer
    );
    
    // Register document tree view provider
    const documentTreeProvider = new DocumentTreeProvider(templateManager, documentService, context.extensionUri);
    context.subscriptions.push(documentTreeProvider);
    
    // Register the tree view
    const treeView = vscode.window.createTreeView('documentWriter.documentExplorer', {
        treeDataProvider: documentTreeProvider,
        showCollapseAll: true,
        canSelectMany: false
    });
    context.subscriptions.push(treeView);
    
    // Register tree view commands
    documentTreeProvider.registerCommands(context);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('document-writer.openEditor', (document?: any) => {
            documentWebviewProvider.openEditor(document);
        }),

        vscode.commands.registerCommand('document-writer.createDocument', async () => {
            await documentCreationWizard.showWizard();
        }),

        vscode.commands.registerCommand('document-writer.openTemplate', async () => {
            documentWebviewProvider.createNewDocument();
        }),

        vscode.commands.registerCommand('document-writer.saveDocument', async (document: any) => {
            try {
                await documentService.saveDocument(document);
                vscode.window.showInformationMessage('Document saved successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save document: ${error}`);
            }
        }),

        vscode.commands.registerCommand('document-writer.previewDocument', async (document: any) => {
            try {
                const previewPath = await documentService.generatePreview(document);
                // Open preview in editor
                const doc = await vscode.workspace.openTextDocument(previewPath);
                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate preview: ${error}`);
            }
        }),

        vscode.commands.registerCommand('document-writer.generateDocument', async (document: any) => {
            try {
                const outputPath = await documentService.generateDocument(document);
                vscode.window.showInformationMessage(
                    `Document generated successfully!`,
                    'Open Document'
                ).then(selection => {
                    if (selection === 'Open Document') {
                        vscode.env.openExternal(vscode.Uri.file(outputPath));
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate document: ${error}`);
            }
        }),

        // Export document to PDF
        vscode.commands.registerCommand('document-writer.exportToPdf', async (document: any) => {
            try {
                // Get the output path
                const defaultPath = vscode.workspace.getConfiguration('documentWriter').get('outputPath') as string || './generated-documents';
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                const outputDir = defaultPath.startsWith('./') ? path.join(workspacePath, defaultPath.substring(2)) : defaultPath;
                
                // Ensure the output directory exists
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                // Set the output file path
                const outputPath = path.join(outputDir, `${document.title || 'document'}.pdf`);
                
                // Export to PDF
                const pdfPath = await exportService.exportToPdf(document, outputPath);
                
                vscode.window.showInformationMessage(
                    `Document exported to PDF successfully!`,
                    'Open PDF'
                ).then(selection => {
                    if (selection === 'Open PDF') {
                        vscode.env.openExternal(vscode.Uri.file(pdfPath));
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export document to PDF: ${error}`);
            }
        }),
        
        // Export document to HTML
        vscode.commands.registerCommand('document-writer.exportToHtml', async (document: any) => {
            try {
                // Get the output path
                const defaultPath = vscode.workspace.getConfiguration('documentWriter').get('outputPath') as string || './generated-documents';
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                const outputDir = defaultPath.startsWith('./') ? path.join(workspacePath, defaultPath.substring(2)) : defaultPath;
                
                // Ensure the output directory exists
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                // Set the output file path
                const outputPath = path.join(outputDir, `${document.title || 'document'}.html`);
                
                // Export to HTML
                const htmlPath = await exportService.exportToHtml(document, outputPath);
                
                vscode.window.showInformationMessage(
                    `Document exported to HTML successfully!`,
                    'Open HTML'
                ).then(selection => {
                    if (selection === 'Open HTML') {
                        vscode.env.openExternal(vscode.Uri.file(htmlPath));
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export document to HTML: ${error}`);
            }
        }),
        
        // Export document to Markdown
        vscode.commands.registerCommand('document-writer.exportToMarkdown', async (document: any) => {
            try {
                // Get the output path
                const defaultPath = vscode.workspace.getConfiguration('documentWriter').get('outputPath') as string || './generated-documents';
                const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
                const outputDir = defaultPath.startsWith('./') ? path.join(workspacePath, defaultPath.substring(2)) : defaultPath;
                
                // Ensure the output directory exists
                if (!fs.existsSync(outputDir)) {
                    fs.mkdirSync(outputDir, { recursive: true });
                }
                
                // Set the output file path
                const outputPath = path.join(outputDir, `${document.title || 'document'}.md`);
                
                // Export to Markdown
                const mdPath = await exportService.exportToMarkdown(document, outputPath);
                
                vscode.window.showInformationMessage(
                    `Document exported to Markdown successfully!`,
                    'Open Markdown'
                ).then(selection => {
                    if (selection === 'Open Markdown') {
                        vscode.env.openExternal(vscode.Uri.file(mdPath));
                    }
                });
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to export document to Markdown: ${error}`);
            }
        }),

        // Add missing commands that are declared in package.json
        vscode.commands.registerCommand('document-writer.addTemplate', async () => {
            try {
                const templateFiles = await vscode.window.showOpenDialog({
                    canSelectFiles: true,
                    canSelectFolders: false,
                    canSelectMany: false,
                    filters: {
                        'Templates': ['docx', 'doc', 'md', 'html']
                    },
                    title: 'Select a template file to add'
                });
                
                if (templateFiles && templateFiles.length > 0) {
                    const templatePath = templateFiles[0].fsPath;
                    // Add template logic here (for now just show success message)
                    vscode.window.showInformationMessage(`Template added: ${path.basename(templatePath)}`);
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to add template: ${error}`);
            }
        }),

        vscode.commands.registerCommand('document-writer.generateFromTemplate', async () => {
            try {
                // Show template selection
                const templates = ['Business Report', 'Technical Specification', 'Academic Paper'];
                const selectedTemplate = await vscode.window.showQuickPick(templates, {
                    placeHolder: 'Select a template to generate from'
                });
                
                if (selectedTemplate) {
                    await documentCreationWizard.showWizard();
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate from template: ${error}`);
            }
        }),

        vscode.commands.registerCommand('document-writer.cloneTemplate', async () => {
            try {
                vscode.window.showInformationMessage('Clone template functionality not yet implemented');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to clone template: ${error}`);
            }
        }),

        vscode.commands.registerCommand('document-writer.openDocument', async (filePath?: string) => {
            try {
                if (filePath) {
                    // Open specific document
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(doc);
                } else {
                    // Show file picker to open document
                    const documentFiles = await vscode.window.showOpenDialog({
                        canSelectFiles: true,
                        canSelectFolders: false,
                        canSelectMany: false,
                        filters: {
                            'Documents': ['docx', 'doc', 'md', 'html', 'pdf', 'txt']
                        },
                        title: 'Select a document to open'
                    });
                    
                    if (documentFiles && documentFiles.length > 0) {
                        const doc = await vscode.workspace.openTextDocument(documentFiles[0]);
                        await vscode.window.showTextDocument(doc);
                    }
                }
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to open document: ${error}`);
            }
        }),

        vscode.commands.registerCommand('documentWriter.startMcpServer', async () => {
            try {
                statusBarManager.showProgress('Starting MCP server...');
                await clineIntegration.initialize();
                statusBarManager.hideProgress();
                statusBarManager.updateAiConnectionStatus();
                vscode.window.showInformationMessage('MCP server started successfully!');
            } catch (error) {
                statusBarManager.hideProgress();
                vscode.window.showErrorMessage(`Failed to start MCP server: ${error}`);
            }
        }),

        vscode.commands.registerCommand('documentWriter.showWizard', async () => {
            await documentCreationWizard.showWizard();
        }),

        vscode.commands.registerCommand('documentWriter.exportDocument', async () => {
            const quickPicks = [
                { label: '$(file-pdf) PDF', description: 'Export as PDF document', format: 'pdf' },
                { label: '$(file-code) HTML', description: 'Export as HTML file', format: 'html' },
                { label: '$(markdown) Markdown', description: 'Export as Markdown file', format: 'markdown' },
                { label: '$(file-text) Word', description: 'Export as Word document', format: 'docx' }
            ];
            
            const selection = await vscode.window.showQuickPick(quickPicks, {
                placeHolder: 'Select export format'
            });
            
            if (selection) {
                const activeDocument = documentWebviewProvider.getActiveDocument();
                if (activeDocument) {
                    switch (selection.format) {
                        case 'pdf':
                            vscode.commands.executeCommand('document-writer.exportToPdf', activeDocument);
                            break;
                        case 'html':
                            vscode.commands.executeCommand('document-writer.exportToHtml', activeDocument);
                            break;
                        case 'markdown':
                            vscode.commands.executeCommand('document-writer.exportToMarkdown', activeDocument);
                            break;
                        case 'docx':
                            vscode.commands.executeCommand('document-writer.generateDocument', activeDocument);
                            break;
                    }
                } else {
                    vscode.window.showWarningMessage('No active document to export');
                }
            }
        }),

        vscode.commands.registerCommand('documentWriter.generateChart', async () => {
            // TODO: Implement chart generation interface
            vscode.window.showInformationMessage('Chart generation interface coming soon!');
        }),

        vscode.commands.registerCommand('documentWriter.openTemplateManager', async () => {
            // Open template manager webview
            const panel = vscode.window.createWebviewPanel(
                'templateManager',
                'Template Manager',
                vscode.ViewColumn.One,
                {
                    enableScripts: true,
                    retainContextWhenHidden: true
                }
            );
            
            // TODO: Load template manager HTML content
            panel.webview.html = '<h1>Template Manager</h1><p>Coming soon...</p>';
        }),

        vscode.commands.registerCommand('documentWriter.showAssistant', async () => {
            documentAssistant.open();
        }),

        vscode.commands.registerCommand('documentWriter.previewDocument', async () => {
            const activeDocument = documentWebviewProvider.getActiveDocument();
            if (activeDocument) {
                vscode.commands.executeCommand('document-writer.previewDocument', activeDocument);
            } else {
                vscode.window.showWarningMessage('No active document to preview');
            }
        })
    );

    // Command to open the document editor webview
    vscode.commands.executeCommand('document-writer.openEditor');
    
    console.log('Alicia - Your Personal Document Assistant activated successfully!');
    } catch (error) {
        console.error('Alicia extension failed to activate:', error);
        vscode.window.showErrorMessage(`Alicia extension failed to activate: ${error}`);
        throw error;
    }
}

export function deactivate() {}
