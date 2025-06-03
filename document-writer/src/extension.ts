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

export function activate(context: vscode.ExtensionContext) {
    // Initialize services
    const templateManager = new TemplateManagerService(context);
    const clineIntegration = new ClineIntegration();
    const documentService = new DocumentService(context, templateManager, clineIntegration);
    const exportService = new ExportService(templateManager, documentService);
    
    // Initialize wizard
    const documentCreationWizard = new DocumentCreationWizard(context, documentService, templateManager);
    
    // Register document webview provider
    const documentWebviewProvider = new DocumentWebviewProvider(context, documentService, templateManager, exportService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DocumentWebviewProvider.viewType,
            documentWebviewProvider
        )
    );
    
    // Register document assistant provider
    const documentAssistant = new DocumentAssistant(context, documentService);
    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            DocumentAssistant.viewType,
            documentAssistant
        )
    );
    
    // Register document tree view provider
    const documentTreeProvider = new DocumentTreeProvider(context, documentService, templateManager);
    context.subscriptions.push(documentTreeProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('documentWriter.openEditor', (document?: any) => {
            documentWebviewProvider.openEditor(document);
        }),

        vscode.commands.registerCommand('documentWriter.createDocument', async () => {
            await documentCreationWizard.open();
        }),

        vscode.commands.registerCommand('documentWriter.openTemplate', async () => {
            documentWebviewProvider.createNewDocument();
        }),

        vscode.commands.registerCommand('documentWriter.saveDocument', async (document: any) => {
            try {
                await documentService.saveDocument(document);
                vscode.window.showInformationMessage('Document saved successfully!');
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to save document: ${error}`);
            }
        }),

        vscode.commands.registerCommand('documentWriter.previewDocument', async (document: any) => {
            try {
                const previewPath = await documentService.generatePreview(document);
                // Open preview in editor
                const doc = await vscode.workspace.openTextDocument(previewPath);
                await vscode.window.showTextDocument(doc);
            } catch (error) {
                vscode.window.showErrorMessage(`Failed to generate preview: ${error}`);
            }
        }),

        vscode.commands.registerCommand('documentWriter.generateDocument', async (document: any) => {
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
        vscode.commands.registerCommand('documentWriter.exportToPdf', async (document: any) => {
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
        vscode.commands.registerCommand('documentWriter.exportToHtml', async (document: any) => {
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
        vscode.commands.registerCommand('documentWriter.exportToMarkdown', async (document: any) => {
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
        })
    );

    // Command to open the document editor webview
    vscode.commands.executeCommand('documentWriter.openEditor');
}

export function deactivate() {}
