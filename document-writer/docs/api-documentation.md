# Document Writer Extension API Documentation

## Table of Contents

- [Introduction](#introduction)
- [Core Services](#core-services)
- [MCP Tools](#mcp-tools)
- [Providers](#providers)
- [Utilities](#utilities)
- [Models and Interfaces](#models-and-interfaces)

## Introduction

This document provides comprehensive API documentation for the Document Writer VS Code extension. It covers all public interfaces, classes, and methods that developers may use when extending or interacting with the Document Writer extension.

The Document Writer extension is built using TypeScript and follows a modular architecture with clear separation of concerns. This documentation aims to help developers understand the internal structure and API of the extension.

## Core Services

### DocumentService

The central service responsible for document creation, manipulation, and management.

```typescript
/**
 * DocumentService provides core functionality for creating and managing documents
 */
export class DocumentService {
  /**
   * Creates a new document from a template
   * 
   * @param template - The document template to use
   * @param data - Data to populate the template with
   * @param options - Additional options for document creation
   * @returns A promise that resolves to the created document
   * 
   * @example
   * const template = await templateManager.getTemplate('business-report');
   * const data = { title: 'Quarterly Report', author: 'John Doe', content: '...' };
   * const document = await documentService.createDocument(template, data);
   */
  public async createDocument(
    template: DocumentTemplate, 
    data: Record<string, any>, 
    options?: DocumentCreationOptions
  ): Promise<Document>;

  /**
   * Saves a document to the file system
   * 
   * @param document - The document to save
   * @param path - Path where the document should be saved
   * @param format - The format to save the document in
   * @returns A promise that resolves when the document is saved
   * 
   * @example
   * await documentService.saveDocument(document, '/path/to/save', 'docx');
   */
  public async saveDocument(
    document: Document, 
    path: string, 
    format: DocumentFormat
  ): Promise<void>;

  /**
   * Analyzes a document and provides insights and suggestions
   * 
   * @param document - The document to analyze
   * @param options - Analysis options
   * @returns A promise that resolves to document analysis results
   * 
   * @example
   * const analysis = await documentService.analyzeDocument(document);
   * console.log(analysis.suggestions);
   */
  public async analyzeDocument(
    document: Document, 
    options?: AnalysisOptions
  ): Promise<DocumentAnalysis>;
}
```

### TemplateManagerService

Manages document templates, including loading, saving, and retrieving templates.

```typescript
/**
 * TemplateManagerService handles all template-related operations
 */
export class TemplateManagerService {
  /**
   * Gets a template by its ID
   * 
   * @param id - The template ID
   * @returns A promise that resolves to the template
   * 
   * @example
   * const template = await templateManager.getTemplate('business-report');
   */
  public async getTemplate(id: string): Promise<DocumentTemplate>;

  /**
   * Gets all available templates
   * 
   * @param category - Optional category to filter templates
   * @returns A promise that resolves to an array of templates
   * 
   * @example
   * const businessTemplates = await templateManager.getAllTemplates('business');
   */
  public async getAllTemplates(category?: string): Promise<DocumentTemplate[]>;

  /**
   * Saves a template
   * 
   * @param template - The template to save
   * @returns A promise that resolves when the template is saved
   * 
   * @example
   * await templateManager.saveTemplate(myCustomTemplate);
   */
  public async saveTemplate(template: DocumentTemplate): Promise<void>;

  /**
   * Deletes a template
   * 
   * @param id - The ID of the template to delete
   * @returns A promise that resolves when the template is deleted
   * 
   * @example
   * await templateManager.deleteTemplate('outdated-template');
   */
  public async deleteTemplate(id: string): Promise<void>;
}
```

### ExportService

Handles document export to various formats.

```typescript
/**
 * ExportService handles the export of documents to different formats
 */
export class ExportService {
  /**
   * Exports a document to a specific format
   * 
   * @param document - The document to export
   * @param format - The target format
   * @param options - Export options
   * @returns A promise that resolves to the exported document data
   * 
   * @example
   * const pdfData = await exportService.exportDocument(document, 'pdf');
   */
  public async exportDocument(
    document: Document, 
    format: DocumentFormat, 
    options?: ExportOptions
  ): Promise<Buffer>;

  /**
   * Gets available export formats
   * 
   * @returns An array of supported export formats
   * 
   * @example
   * const formats = exportService.getAvailableFormats();
   * // Returns ['docx', 'pdf', 'html', 'markdown']
   */
  public getAvailableFormats(): DocumentFormat[];
}
```

## MCP Tools

### CreateDocumentTool

MCP tool for creating documents through Cline.

```typescript
/**
 * CreateDocumentTool provides document creation capabilities through MCP
 */
export class CreateDocumentTool implements MCPTool {
  /**
   * Gets the tool name
   * 
   * @returns The name of the tool
   */
  public getName(): string;

  /**
   * Gets the tool description
   * 
   * @returns Description of the tool's functionality
   */
  public getDescription(): string;

  /**
   * Gets the schema for tool arguments
   * 
   * @returns JSON schema for the tool's arguments
   */
  public getArgsSchema(): Record<string, any>;

  /**
   * Executes the document creation tool
   * 
   * @param args - Tool arguments including template, data, and options
   * @returns A promise that resolves to the tool execution result
   * 
   * @example
   * // This would be called through the MCP system
   * const result = await createDocumentTool.execute({
   *   templateId: 'business-report',
   *   data: { title: 'Report', content: '...' },
   *   format: 'docx'
   * });
   */
  public async execute(args: Record<string, any>): Promise<MCPToolResult>;
}
```

### AnalyzeDocumentTool

MCP tool for analyzing document content and structure.

```typescript
/**
 * AnalyzeDocumentTool provides document analysis capabilities through MCP
 */
export class AnalyzeDocumentTool implements MCPTool {
  /**
   * Gets the tool name
   * 
   * @returns The name of the tool
   */
  public getName(): string;

  /**
   * Gets the tool description
   * 
   * @returns Description of the tool's functionality
   */
  public getDescription(): string;

  /**
   * Gets the schema for tool arguments
   * 
   * @returns JSON schema for the tool's arguments
   */
  public getArgsSchema(): Record<string, any>;

  /**
   * Executes the document analysis tool
   * 
   * @param args - Tool arguments including document content or path
   * @returns A promise that resolves to the analysis results
   * 
   * @example
   * // This would be called through the MCP system
   * const analysis = await analyzeDocumentTool.execute({
   *   documentPath: '/path/to/document.docx',
   *   analysisOptions: { deepAnalysis: true }
   * });
   */
  public async execute(args: Record<string, any>): Promise<MCPToolResult>;
}
```

### GenerateChartTool

MCP tool for generating charts and visualizations.

```typescript
/**
 * GenerateChartTool provides chart generation capabilities through MCP
 */
export class GenerateChartTool implements MCPTool {
  /**
   * Gets the tool name
   * 
   * @returns The name of the tool
   */
  public getName(): string;

  /**
   * Gets the tool description
   * 
   * @returns Description of the tool's functionality
   */
  public getDescription(): string;

  /**
   * Gets the schema for tool arguments
   * 
   * @returns JSON schema for the tool's arguments
   */
  public getArgsSchema(): Record<string, any>;

  /**
   * Executes the chart generation tool
   * 
   * @param args - Tool arguments including chart type, data, and options
   * @returns A promise that resolves to the generated chart
   * 
   * @example
   * // This would be called through the MCP system
   * const chart = await generateChartTool.execute({
   *   type: 'bar',
   *   data: { labels: ['A', 'B', 'C'], datasets: [{ data: [1, 2, 3] }] },
   *   options: { title: 'My Chart' }
   * });
   */
  public async execute(args: Record<string, any>): Promise<MCPToolResult>;
}
```

## Providers

### DocumentTreeProvider

Tree view provider for document templates.

```typescript
/**
 * DocumentTreeProvider provides a tree view of document templates
 */
export class DocumentTreeProvider implements vscode.TreeDataProvider<TemplateTreeItem> {
  /**
   * Gets tree items for the document tree view
   * 
   * @param element - The element to get children for
   * @returns A promise that resolves to an array of tree items
   */
  public getChildren(element?: TemplateTreeItem): Thenable<TemplateTreeItem[]>;

  /**
   * Gets the tree item for a given element
   * 
   * @param element - The element to get the tree item for
   * @returns The tree item
   */
  public getTreeItem(element: TemplateTreeItem): vscode.TreeItem;

  /**
   * Refreshes the tree view
   */
  public refresh(): void;
}
```

### DocumentWebviewProvider

Provides webview-based document editing and preview.

```typescript
/**
 * DocumentWebviewProvider provides webview-based document editing
 */
export class DocumentWebviewProvider implements vscode.WebviewViewProvider {
  /**
   * Resolves the webview view
   * 
   * @param webviewView - The webview view to resolve
   * @param context - The webview context
   * @param token - Cancellation token
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView, 
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void;

  /**
   * Shows a document in the webview
   * 
   * @param document - The document to show
   */
  public showDocument(document: Document): void;

  /**
   * Updates the webview content
   * 
   * @param content - The content to update with
   */
  public updateContent(content: string): void;
}
```

### DocumentCreationWizard

Wizard interface for creating new documents.

```typescript
/**
 * DocumentCreationWizard provides a step-by-step interface for document creation
 */
export class DocumentCreationWizard {
  /**
   * Shows the document creation wizard
   * 
   * @returns A promise that resolves to the created document or undefined if cancelled
   * 
   * @example
   * const document = await wizard.show();
   * if (document) {
   *   await documentService.saveDocument(document, '/path/to/save', 'docx');
   * }
   */
  public show(): Promise<Document | undefined>;

  /**
   * Sets the initial template for the wizard
   * 
   * @param templateId - The ID of the template to start with
   * 
   * @example
   * wizard.setInitialTemplate('business-report');
   * await wizard.show();
   */
  public setInitialTemplate(templateId: string): void;
}
```

### DocumentAssistant

Chat-based assistant for document creation and editing.

```typescript
/**
 * DocumentAssistant provides chat-based assistance for document creation
 */
export class DocumentAssistant implements vscode.WebviewViewProvider {
  /**
   * Resolves the webview view
   * 
   * @param webviewView - The webview view to resolve
   * @param context - The webview context
   * @param token - Cancellation token
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView, 
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void;

  /**
   * Sends a message to the assistant
   * 
   * @param message - The message to send
   * @returns A promise that resolves to the assistant's response
   * 
   * @example
   * const response = await assistant.sendMessage('Create a business report template');
   * console.log(response);
   */
  public sendMessage(message: string): Promise<AssistantResponse>;

  /**
   * Sets the current document context
   * 
   * @param document - The document to set as context
   * 
   * @example
   * assistant.setDocumentContext(currentDocument);
   */
  public setDocumentContext(document: Document): void;
}
```

## Utilities

### FormatConverter

Utilities for converting between document formats.

```typescript
/**
 * FormatConverter provides utilities for converting between document formats
 */
export class FormatConverter {
  /**
   * Converts a document from one format to another
   * 
   * @param content - The document content
   * @param sourceFormat - The source format
   * @param targetFormat - The target format
   * @returns A promise that resolves to the converted content
   * 
   * @example
   * const htmlContent = await FormatConverter.convert(docxContent, 'docx', 'html');
   */
  public static async convert(
    content: Buffer | string, 
    sourceFormat: DocumentFormat, 
    targetFormat: DocumentFormat
  ): Promise<Buffer | string>;

  /**
   * Checks if conversion between two formats is supported
   * 
   * @param sourceFormat - The source format
   * @param targetFormat - The target format
   * @returns True if conversion is supported, false otherwise
   * 
   * @example
   * if (FormatConverter.isConversionSupported('docx', 'pdf')) {
   *   // Conversion is supported
   * }
   */
  public static isConversionSupported(
    sourceFormat: DocumentFormat, 
    targetFormat: DocumentFormat
  ): boolean;
}
```

### SecurityManager

Security utilities for validating and sanitizing content.

```typescript
/**
 * SecurityManager provides security utilities for content validation and sanitization
 */
export class SecurityManager {
  /**
   * Validates if a file path is secure (no path traversal)
   * 
   * @param path - The path to validate
   * @returns True if the path is secure, false otherwise
   * 
   * @example
   * if (SecurityManager.isPathSafe('/safe/path/file.txt')) {
   *   // Path is safe to use
   * }
   */
  public static isPathSafe(path: string): boolean;

  /**
   * Sanitizes HTML content
   * 
   * @param html - The HTML content to sanitize
   * @returns Sanitized HTML content
   * 
   * @example
   * const safeHtml = SecurityManager.sanitizeHtml(userProvidedHtml);
   */
  public static sanitizeHtml(html: string): string;

  /**
   * Validates template content for security issues
   * 
   * @param templateContent - The template content to validate
   * @returns Validation result with issues if any
   * 
   * @example
   * const validation = SecurityManager.validateTemplate(templateContent);
   * if (!validation.isValid) {
   *   console.error(validation.issues);
   * }
   */
  public static validateTemplate(templateContent: string): TemplateValidationResult;
}
```

### PerformanceManager

Utilities for monitoring and optimizing performance.

```typescript
/**
 * PerformanceManager provides utilities for performance monitoring
 */
export class PerformanceManager {
  /**
   * Starts a performance measurement
   * 
   * @param label - Label for the measurement
   * 
   * @example
   * PerformanceManager.startMeasure('document-generation');
   * // ... document generation code ...
   * const metrics = PerformanceManager.endMeasure('document-generation');
   */
  public static startMeasure(label: string): void;

  /**
   * Ends a performance measurement
   * 
   * @param label - Label for the measurement
   * @returns Performance metrics
   * 
   * @example
   * const metrics = PerformanceManager.endMeasure('document-generation');
   * console.log(`Generation took ${metrics.duration}ms`);
   */
  public static endMeasure(label: string): PerformanceMetrics;

  /**
   * Gets all performance metrics
   * 
   * @returns Object containing all collected metrics
   * 
   * @example
   * const allMetrics = PerformanceManager.getAllMetrics();
   * console.log(allMetrics);
   */
  public static getAllMetrics(): Record<string, PerformanceMetrics>;
}
```

## Models and Interfaces

### DocumentTemplate

Interface for document templates.

```typescript
/**
 * DocumentTemplate represents a template for document generation
 */
export interface DocumentTemplate {
  /**
   * Unique identifier for the template
   */
  id: string;

  /**
   * Human-readable name of the template
   */
  name: string;

  /**
   * Template description
   */
  description: string;

  /**
   * Template category (e.g., business, technical, academic)
   */
  category: string;

  /**
   * Template content
   */
  content: string | Buffer;

  /**
   * Template format (e.g., docx, html)
   */
  format: DocumentFormat;

  /**
   * Template metadata
   */
  metadata: TemplateMetadata;
}
```

### Document

Interface for documents.

```typescript
/**
 * Document represents a document generated from a template
 */
export interface Document {
  /**
   * Document ID
   */
  id: string;

  /**
   * Document title
   */
  title: string;

  /**
   * Document content
   */
  content: string | Buffer;

  /**
   * Document format
   */
  format: DocumentFormat;

  /**
   * Template ID used to generate the document
   */
  templateId: string;

  /**
   * Document metadata
   */
  metadata: Record<string, any>;

  /**
   * Creation timestamp
   */
  createdAt: Date;

  /**
   * Last modification timestamp
   */
  modifiedAt: Date;
}
```

### MCPTool

Interface for MCP tools.

```typescript
/**
 * MCPTool represents a tool that can be registered with the MCP system
 */
export interface MCPTool {
  /**
   * Gets the tool name
   * 
   * @returns The name of the tool
   */
  getName(): string;

  /**
   * Gets the tool description
   * 
   * @returns Description of the tool's functionality
   */
  getDescription(): string;

  /**
   * Gets the schema for tool arguments
   * 
   * @returns JSON schema for the tool's arguments
   */
  getArgsSchema(): Record<string, any>;

  /**
   * Executes the tool with the provided arguments
   * 
   * @param args - The arguments for the tool
   * @returns A promise that resolves to the tool execution result
   */
  execute(args: Record<string, any>): Promise<MCPToolResult>;
}
```

### TemplateMetadata

Interface for template metadata.

```typescript
/**
 * TemplateMetadata contains metadata for document templates
 */
export interface TemplateMetadata {
  /**
   * Template author
   */
  author?: string;

  /**
   * Template version
   */
  version?: string;

  /**
   * Creation date
   */
  createdAt?: Date;

  /**
   * Last modification date
   */
  modifiedAt?: Date;

  /**
   * Template tags
   */
  tags?: string[];

  /**
   * Required variables for the template
   */
  requiredVariables?: string[];

  /**
   * Optional variables for the template
   */
  optionalVariables?: string[];

  /**
   * Template preview image or thumbnail URL
   */
  previewImage?: string;

  /**
   * Template schema for validation
   */
  schema?: Record<string, any>;
}
```

### Common Types

Common types used throughout the extension.

```typescript
/**
 * Document format types
 */
export type DocumentFormat = 'docx' | 'pdf' | 'html' | 'markdown' | 'txt';

/**
 * Document creation options
 */
export interface DocumentCreationOptions {
  /**
   * Whether to include default metadata
   */
  includeDefaultMetadata?: boolean;

  /**
   * Whether to validate the document against schema
   */
  validate?: boolean;

  /**
   * Custom formatters to use during template processing
   */
  formatters?: Record<string, (value: any) => string>;
}

/**
 * Export options
 */
export interface ExportOptions {
  /**
   * Quality for image-based exports (0-100)
   */
  quality?: number;

  /**
   * Whether to include document metadata
   */
  includeMetadata?: boolean;

  /**
   * Whether to encrypt the document (for supported formats)
   */
  encrypt?: boolean;

  /**
   * Password for encrypted documents
   */
  password?: string;
}

/**
 * Analysis options
 */
export interface AnalysisOptions {
  /**
   * Whether to perform deep analysis
   */
  deepAnalysis?: boolean;

  /**
   * Whether to check grammar
   */
  checkGrammar?: boolean;

  /**
   * Whether to analyze style
   */
  analyzeStyle?: boolean;
}

/**
 * Result of document analysis
 */
export interface DocumentAnalysis {
  /**
   * Word count
   */
  wordCount: number;

  /**
   * Reading time in minutes
   */
  readingTime: number;

  /**
   * Document structure analysis
   */
  structure: DocumentStructure;

  /**
   * Content suggestions
   */
  suggestions: Suggestion[];

  /**
   * Style analysis
   */
  styleAnalysis?: StyleAnalysis;

  /**
   * Grammar issues
   */
  grammarIssues?: GrammarIssue[];
}

/**
 * Performance metrics
 */
export interface PerformanceMetrics {
  /**
   * Operation label
   */
  label: string;

  /**
   * Start timestamp
   */
  startTime: number;

  /**
   * End timestamp
   */
  endTime: number;

  /**
   * Duration in milliseconds
   */
  duration: number;

  /**
   * Memory usage in bytes
   */
  memoryUsage?: number;
}

/**
 * Template validation result
 */
export interface TemplateValidationResult {
  /**
   * Whether the template is valid
   */
  isValid: boolean;

  /**
   * Validation issues
   */
  issues: string[];
}
