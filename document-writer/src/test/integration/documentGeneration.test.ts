import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DocumentService } from '../../services/documentService';
import { DocumentTemplate, PlaceholderType } from '../../models/documentTemplate';
import { DocumentFormat } from '../../models/documentFormat';

/**
 * Integration test for document generation
 * This test uses actual template files and generates real documents
 */
describe('Document Generation Integration', () => {
  let documentService: DocumentService;
  let mockExtensionContext: vscode.ExtensionContext;
  let tempOutputDir: string;
  
  beforeEach(() => {
    // Create mock extension context
    mockExtensionContext = {
      subscriptions: [],
      extensionPath: path.resolve(__dirname, '../../../'),
      extensionUri: vscode.Uri.file(path.resolve(__dirname, '../../../')),
      storageUri: vscode.Uri.file(os.tmpdir()),
      globalStorageUri: vscode.Uri.file(os.tmpdir()),
      logUri: vscode.Uri.file(os.tmpdir()),
      extensionMode: vscode.ExtensionMode.Test,
      asAbsolutePath: (relativePath: string) => path.resolve(__dirname, '../../../', relativePath)
    } as unknown as vscode.ExtensionContext;
    
    // Create instance of DocumentService for testing
    documentService = new DocumentService(mockExtensionContext);
    
    // Create temporary output directory
    tempOutputDir = path.join(os.tmpdir(), `docwriter-test-${Date.now()}`);
    fs.mkdirSync(tempOutputDir, { recursive: true });
  });
  
  afterEach(() => {
    // Clean up temporary files
    try {
      const files = fs.readdirSync(tempOutputDir);
      for (const file of files) {
        fs.unlinkSync(path.join(tempOutputDir, file));
      }
      fs.rmdirSync(tempOutputDir);
    } catch (error) {
      console.error('Error cleaning up test files:', error);
    }
  });
  
  it('should generate a DOCX document from the Business Letter template', async () => {
    // Arrange
    const templatePath = path.resolve(__dirname, '../../../resources/templates/BusinessLetter.docx');
    
    // Ensure the template file exists
    expect(fs.existsSync(templatePath)).toBe(true);
    
    const template: DocumentTemplate = {
      id: 'business-letter',
      name: 'Business Letter',
      description: 'A professional business letter template',
      format: DocumentFormat.DOCX,
      templatePath: templatePath,
      metadata: {
        author: 'Document Writer',
        version: '1.0.0',
        tags: ['business', 'letter', 'professional'],
        category: 'Correspondence'
      },
      sections: [
        {
          id: 'header',
          name: 'Letter Header',
          description: 'Header information for the letter',
          placeholders: [
            {
              id: 'sender_name',
              key: 'sender_name',
              description: 'Name of the sender',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'sender_title',
              key: 'sender_title',
              description: 'Title of the sender',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'sender_company',
              key: 'sender_company',
              description: 'Company of the sender',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'recipient_name',
              key: 'recipient_name',
              description: 'Name of the recipient',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'recipient_title',
              key: 'recipient_title',
              description: 'Title of the recipient',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'recipient_company',
              key: 'recipient_company',
              description: 'Company of the recipient',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'date',
              key: 'date',
              description: 'Date of the letter',
              type: PlaceholderType.DATE,
              isRequired: true
            }
          ],
          isRequired: true,
          order: 1
        },
        {
          id: 'content',
          name: 'Letter Content',
          description: 'Main content of the letter',
          placeholders: [
            {
              id: 'subject',
              key: 'subject',
              description: 'Subject of the letter',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'body',
              key: 'body',
              description: 'Body of the letter',
              type: PlaceholderType.RICH_TEXT,
              isRequired: true
            },
            {
              id: 'closing',
              key: 'closing',
              description: 'Closing of the letter',
              type: PlaceholderType.TEXT,
              isRequired: true
            }
          ],
          isRequired: true,
          order: 2
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const data = {
      sender_name: 'John Smith',
      sender_title: 'Chief Executive Officer',
      sender_company: 'Acme Corporation',
      recipient_name: 'Jane Doe',
      recipient_title: 'Director of Operations',
      recipient_company: 'Widget Enterprises',
      date: new Date().toLocaleDateString(),
      subject: 'Partnership Proposal',
      body: 'I am writing to propose a strategic partnership between our companies. We believe that combining our expertise would lead to significant market opportunities and benefits for both organizations.\n\nWe would like to schedule a meeting to discuss this proposal in more detail. Please let me know your availability for the coming weeks.',
      closing: 'Sincerely'
    };
    
    // Act
    const result = await documentService.generateDocument(template, data, tempOutputDir);
    
    // Assert
    expect(result).toBeDefined();
    expect(fs.existsSync(result)).toBe(true);
    
    // Check that the file is a valid DOCX file (minimum size check)
    const stats = fs.statSync(result);
    expect(stats.size).toBeGreaterThan(1000); // DOCX files should be at least 1KB
  });
  
  it('should generate a Markdown document from a template', async () => {
    // Arrange
    // Create a temporary markdown template
    const mdTemplatePath = path.join(tempOutputDir, 'template.md');
    const templateContent = `# {{subject}}

Dear {{recipient_name}},

{{body}}

{{closing}},

{{sender_name}}
{{sender_title}}
{{sender_company}}
`;
    fs.writeFileSync(mdTemplatePath, templateContent);
    
    const template: DocumentTemplate = {
      id: 'md-letter',
      name: 'Markdown Letter',
      description: 'A simple markdown letter template',
      format: DocumentFormat.MARKDOWN,
      templatePath: mdTemplatePath,
      metadata: {
        author: 'Document Writer',
        version: '1.0.0',
        tags: ['markdown', 'letter'],
        category: 'Correspondence'
      },
      sections: [
        {
          id: 'content',
          name: 'Letter Content',
          description: 'Main content of the letter',
          placeholders: [
            {
              id: 'subject',
              key: 'subject',
              description: 'Subject of the letter',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'recipient_name',
              key: 'recipient_name',
              description: 'Name of the recipient',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'body',
              key: 'body',
              description: 'Body of the letter',
              type: PlaceholderType.RICH_TEXT,
              isRequired: true
            },
            {
              id: 'closing',
              key: 'closing',
              description: 'Closing of the letter',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'sender_name',
              key: 'sender_name',
              description: 'Name of the sender',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'sender_title',
              key: 'sender_title',
              description: 'Title of the sender',
              type: PlaceholderType.TEXT,
              isRequired: true
            },
            {
              id: 'sender_company',
              key: 'sender_company',
              description: 'Company of the sender',
              type: PlaceholderType.TEXT,
              isRequired: true
            }
          ],
          isRequired: true,
          order: 1
        }
      ],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const data = {
      subject: 'Important Announcement',
      recipient_name: 'Jane Doe',
      body: 'I am writing to inform you about our new product launch next month. We would be honored to have you join us for the unveiling ceremony.',
      closing: 'Best regards',
      sender_name: 'John Smith',
      sender_title: 'Marketing Director',
      sender_company: 'Acme Corporation'
    };
    
    // Act
    const result = await documentService.generateDocument(template, data, tempOutputDir);
    
    // Assert
    expect(result).toBeDefined();
    expect(fs.existsSync(result)).toBe(true);
    
    // Read the generated file and check its content
    const generatedContent = fs.readFileSync(result, 'utf-8');
    expect(generatedContent).toContain('# Important Announcement');
    expect(generatedContent).toContain('Dear Jane Doe');
    expect(generatedContent).toContain('Best regards');
    expect(generatedContent).toContain('John Smith');
    expect(generatedContent).toContain('Marketing Director');
    expect(generatedContent).toContain('Acme Corporation');
  });
  
  it('should throw an error when trying to generate HTML documents (not implemented)', async () => {
    // Arrange
    const template: DocumentTemplate = {
      id: 'html-template',
      name: 'HTML Template',
      description: 'An HTML template',
      format: DocumentFormat.HTML,
      templatePath: 'path/to/template.html',
      metadata: {
        author: 'Document Writer',
        version: '1.0.0',
        tags: ['html'],
        category: 'Web'
      },
      sections: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const data = { title: 'Test HTML' };
    
    // Act & Assert
    await expect(documentService.generateDocument(template, data, tempOutputDir))
      .rejects.toThrow('HTML document generation not yet implemented');
  });
  
  it('should throw an error when trying to generate PDF documents (not implemented)', async () => {
    // Arrange
    const template: DocumentTemplate = {
      id: 'pdf-template',
      name: 'PDF Template',
      description: 'A PDF template',
      format: DocumentFormat.PDF,
      templatePath: 'path/to/template.pdf',
      metadata: {
        author: 'Document Writer',
        version: '1.0.0',
        tags: ['pdf'],
        category: 'Print'
      },
      sections: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };
    
    const data = { title: 'Test PDF' };
    
    // Act & Assert
    await expect(documentService.generateDocument(template, data, tempOutputDir))
      .rejects.toThrow('PDF document generation not yet implemented');
  });
});
