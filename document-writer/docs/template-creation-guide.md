# Template Creation Guide for Document Writer

## Table of Contents
1. [Introduction](#introduction)
2. [Template System Overview](#template-system-overview)
3. [Supported Template Formats](#supported-template-formats)
4. [Creating Template Files](#creating-template-files)
5. [Template Metadata](#template-metadata)
6. [Sections and Placeholders](#sections-and-placeholders)
7. [Validation Rules](#validation-rules)
8. [Helper Functions](#helper-functions)
9. [Importing and Managing Templates](#importing-and-managing-templates)
10. [Testing Your Templates](#testing-your-templates)
11. [Best Practices](#best-practices)
12. [Examples](#examples)

## Introduction

The Document Writer extension allows you to create, use, and share document templates for various formats. This guide will walk you through the process of creating custom templates that can be used with the Document Writer extension.

Templates in Document Writer serve as blueprints for generating consistent, professional documents. They contain placeholders that can be filled with actual content, making document generation efficient and standardized.

## Template System Overview

The Document Writer template system consists of several components:

- **Template Files**: The actual files (DOCX, Markdown, HTML, PDF) that define the structure and appearance of documents.
- **Template Metadata**: Information about the template such as author, version, and category.
- **Sections**: Logical divisions within a template that can be included or excluded.
- **Placeholders**: Dynamic content markers that get replaced with actual data.
- **Validation Rules**: Constraints to ensure data meets specific requirements.
- **Helper Functions**: Built-in functions for formatting and manipulating data.

## Supported Template Formats

Document Writer supports the following template formats:

| Format | File Extension | Description |
|--------|---------------|-------------|
| DOCX | .docx | Microsoft Word document templates |
| Markdown | .md | Plain text formatting syntax |
| HTML | .html, .htm | Web page templates |
| PDF | .pdf | Portable Document Format templates |

Each format has its own advantages and limitations:

- **DOCX**: Best for professional documents with complex formatting. Supports all Document Writer features.
- **Markdown**: Ideal for simple documents, easy to edit, and good for version control.
- **HTML**: Perfect for web-ready documents or when you need interactive elements.
- **PDF**: Used primarily as a reference template for generating similar PDFs.

## Creating Template Files

### DOCX Templates

DOCX templates are the most feature-rich option in Document Writer. To create a DOCX template:

1. Start with a standard Microsoft Word document.
2. Add placeholders using the `{{placeholder}}` syntax.
3. Format the document with styles, headers, footers, and other Word features.
4. Save the file with a `.docx` extension.

**Example DOCX Placeholder:**
```
Dear {{recipientName}},

We are writing to confirm your appointment on {{formatDate appointmentDate "long"}}.

Sincerely,
{{senderName}}
```

### Markdown Templates

Markdown templates use standard Markdown syntax with Handlebars placeholders:

1. Create a new text file.
2. Write your document using Markdown syntax.
3. Add placeholders using the `{{placeholder}}` syntax.
4. Save the file with a `.md` extension.

**Example Markdown Template:**
```markdown
# {{documentTitle}}

## Introduction

{{introductionText}}

## Details

| Item | Quantity | Price |
|------|----------|-------|
{{#each items}}
| {{name}} | {{quantity}} | {{currency price}} |
{{/each}}

**Total:** {{currency totalAmount}}

## Conclusion

{{conclusionText}}
```

### HTML Templates

HTML templates allow for web-ready documents:

1. Create a standard HTML file.
2. Design your document using HTML, CSS, and JavaScript if needed.
3. Add placeholders using the `{{placeholder}}` syntax.
4. Save the file with `.html` or `.htm` extension.

**Example HTML Template:**
```html
<!DOCTYPE html>
<html>
<head>
    <title>{{title}}</title>
    <style>
        body { font-family: Arial, sans-serif; }
        .header { text-align: center; }
        .content { margin: 20px; }
    </style>
</head>
<body>
    <div class="header">
        <h1>{{company}}</h1>
        <h2>{{documentType}}</h2>
    </div>
    <div class="content">
        <p>Date: {{formatDate currentDate "long"}}</p>
        <p>To: {{recipient}}</p>
        <div>
            {{mainContent}}
        </div>
        <p>Regards,</p>
        <p>{{sender}}</p>
    </div>
</body>
</html>
```

## Template Metadata

Each template must have associated metadata that describes its purpose and properties. The metadata includes:

| Property | Description |
|----------|-------------|
| name | The display name of the template |
| description | A brief description of the template's purpose |
| author | The creator of the template |
| version | The template version (e.g., "1.0") |
| tags | Keywords associated with the template |
| category | The template category (e.g., "Business", "Academic") |

To define metadata for your template, create a JSON file with the same name as your template file, but with a `.json` extension.

**Example template metadata (BusinessLetter.json):**
```json
{
  "name": "Business Letter",
  "description": "A professional business letter template with company letterhead",
  "type": "letter",
  "version": "1.0",
  "author": "Document Writer Team",
  "variables": [
    {
      "name": "recipientName",
      "type": "string",
      "required": true,
      "description": "The name of the letter recipient"
    },
    {
      "name": "recipientAddress",
      "type": "string",
      "required": true,
      "description": "The address of the letter recipient"
    },
    {
      "name": "subject",
      "type": "string",
      "required": true,
      "description": "The subject of the letter"
    },
    {
      "name": "body",
      "type": "string",
      "required": true,
      "description": "The main content of the letter"
    },
    {
      "name": "senderName",
      "type": "string",
      "required": true,
      "description": "The name of the letter sender"
    },
    {
      "name": "senderTitle",
      "type": "string",
      "required": false,
      "description": "The title of the letter sender"
    }
  ],
  "sections": ["header", "address", "greeting", "body", "closing", "signature"]
}
```

## Sections and Placeholders

### Template Sections

Sections are logical divisions of your template that can be included or excluded based on user preferences. Each section should have:

- **ID**: A unique identifier for the section
- **Name**: A display name for the section
- **Description**: A brief explanation of the section's purpose
- **Required**: Whether the section is mandatory
- **Order**: The display order of the section

### Placeholders

Placeholders are the dynamic parts of your template that get replaced with actual data. Document Writer supports various placeholder types:

| Type | Description | Example |
|------|-------------|---------|
| TEXT | Simple text strings | `{{companyName}}` |
| NUMBER | Numeric values | `{{amount}}` |
| DATE | Date values | `{{dueDate}}` |
| BOOLEAN | True/false values | `{{isUrgent}}` |
| LIST | Arrays of items | `{{#each items}}{{name}}{{/each}}` |
| IMAGE | Image references | `{{image logoPath}}` |
| TABLE | Tabular data | `{{table dataTable}}` |
| RICH_TEXT | Formatted text | `{{richText description}}` |
| DYNAMIC | Dynamically generated content | `{{dynamic calculatedField}}` |

### Conditional Content

You can include conditional content in your templates using Handlebars conditionals:

```
{{#if isPremiumCustomer}}
  Thank you for being a premium customer!
{{else}}
  Consider upgrading to our premium service.
{{/if}}
```

### Loops and Iteration

For iterating over lists of items, use the `#each` helper:

```
<ul>
{{#each products}}
  <li>{{name}} - {{currency price}}</li>
{{/each}}
</ul>
```

## Validation Rules

You can define validation rules for placeholders to ensure data meets specific requirements:

| Rule | Description | Example |
|------|-------------|---------|
| REQUIRED | Value must be provided | `"type": "required"` |
| MIN_LENGTH | Minimum text length | `"type": "min_length", "params": 5` |
| MAX_LENGTH | Maximum text length | `"type": "max_length", "params": 100` |
| PATTERN | Regex pattern matching | `"type": "pattern", "params": "^[A-Z0-9]{5}$"` |
| MIN_VALUE | Minimum numeric value | `"type": "min_value", "params": 0` |
| MAX_VALUE | Maximum numeric value | `"type": "max_value", "params": 100` |
| CUSTOM | Custom validation function | `"type": "custom", "params": "validateEmail"` |

**Example placeholder with validation rules:**
```json
{
  "id": "email",
  "key": "email",
  "description": "Contact email address",
  "type": "TEXT",
  "isRequired": true,
  "validationRules": [
    {
      "type": "REQUIRED",
      "errorMessage": "Email is required"
    },
    {
      "type": "PATTERN",
      "params": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$",
      "errorMessage": "Please enter a valid email address"
    }
  ]
}
```

## Helper Functions

Document Writer provides several built-in helper functions to format and manipulate data in templates:

### Date Formatting

```
{{formatDate dueDate "short"}}   // 01/15/2025
{{formatDate dueDate "long"}}    // Tuesday, January 15, 2025
{{formatDate dueDate "time"}}    // 3:00:00 PM
{{formatDate dueDate "datetime"}}// 1/15/2025, 3:00:00 PM
```

### Currency Formatting

```
{{currency amount}}           // $1,234.56
{{currency amount "EUR"}}     // €1,234.56
```

### Percentage Formatting

```
{{percentage ratio}}          // 75.00%
{{percentage ratio 0}}        // 75%
```

### Conditional Helper

```
{{conditional isActive "Active" "Inactive"}}
```

### List Formatting

```
{{list categories}}           // Item1, Item2, Item3
{{list categories " | "}}     // Item1 | Item2 | Item3
```

### Custom Helpers

You can also define and register custom helpers for specific formatting needs.

## Importing and Managing Templates

### Importing Templates

To import a template into Document Writer:

1. In VS Code, open the Document Writer extension
2. Click on the "Templates" view in the sidebar
3. Click the "+" button to add a new template
4. Choose "Import Template" from the menu
5. Select your template file
6. Provide a name and description for the template
7. Click "Import"

### Managing Templates

You can manage your templates through the Templates view:

- **View Templates**: See all available templates
- **Edit Templates**: Modify existing templates
- **Delete Templates**: Remove templates you no longer need
- **Create New Templates**: Start templates from scratch or from existing ones

## Testing Your Templates

Before deploying a template, it's important to test it thoroughly:

1. **Preview**: Use the Document Writer preview feature to see how your template looks with sample data
2. **Validation**: Check that all placeholders and variables are correctly defined
3. **Edge Cases**: Test with minimum and maximum values for each field
4. **Required Fields**: Verify that required fields are properly enforced
5. **Formatting**: Ensure all content is properly formatted in the generated document

## Best Practices

### Naming Conventions

- Use clear, descriptive names for templates, sections, and placeholders
- Maintain consistent naming conventions across all templates
- Prefix related placeholders (e.g., customer_name, customer_email)

### Template Structure

- Organize templates into logical sections
- Use consistent styling within and across templates
- Include clear instructions for users

### Performance Considerations

- Keep templates as simple as possible
- Avoid extremely large templates that may slow down rendering
- Use optimal image resolutions for DOCX and HTML templates

### Security

- Never include sensitive data in template files
- Validate all input data before using it in templates
- Use the security manager for file path validation

### Version Control

- Maintain a version history for templates
- Document changes between versions
- Consider using a repository for template management

## Examples

### Basic Business Letter Template

**BusinessLetter.docx** content:
```
[Company Letterhead]

{{formatDate currentDate "long"}}

{{recipientName}}
{{recipientAddress}}

Subject: {{subject}}

Dear {{recipientName}},

{{body}}

Sincerely,

{{senderName}}
{{senderTitle}}
{{companyName}}
```

### Project Proposal Template

**ProjectProposal.md** content:
```markdown
# {{projectTitle}} - Project Proposal

**Prepared by:** {{authorName}}
**Date:** {{formatDate currentDate "long"}}
**Version:** {{version}}

## Executive Summary

{{executiveSummary}}

## Project Scope

{{projectScope}}

## Timeline

| Phase | Start Date | End Date | Deliverables |
|-------|------------|----------|--------------|
{{#each phases}}
| {{name}} | {{formatDate startDate "short"}} | {{formatDate endDate "short"}} | {{deliverables}} |
{{/each}}

## Budget

**Total Budget:** {{currency totalBudget}}

### Budget Breakdown

| Category | Amount | Percentage |
|----------|--------|------------|
{{#each budgetItems}}
| {{category}} | {{currency amount}} | {{percentage percentOfTotal}} |
{{/each}}

## Team

{{#each teamMembers}}
- **{{name}}** - {{role}}
{{/each}}

## Conclusion

{{conclusion}}

{{#if includeAttachments}}
## Attachments

{{attachmentsDescription}}
{{/if}}
```

### Invoice Template

**Invoice.html** content:
```html
<!DOCTYPE html>
<html>
<head>
    <title>Invoice #{{invoiceNumber}}</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; }
        .invoice-header { background-color: #f5f5f5; padding: 20px; }
        .company-details { float: left; }
        .invoice-details { float: right; text-align: right; }
        .invoice-body { clear: both; margin-top: 30px; }
        table { width: 100%; border-collapse: collapse; }
        th { background-color: #f0f0f0; text-align: left; }
        td, th { padding: 8px; border-bottom: 1px solid #ddd; }
        .total-row { font-weight: bold; }
        .footer { margin-top: 30px; text-align: center; }
    </style>
</head>
<body>
    <div class="invoice-header">
        <div class="company-details">
            <h1>{{companyName}}</h1>
            <p>{{companyAddress}}</p>
            <p>{{companyEmail}}</p>
            <p>{{companyPhone}}</p>
        </div>
        <div class="invoice-details">
            <h2>INVOICE</h2>
            <p><strong>Invoice #:</strong> {{invoiceNumber}}</p>
            <p><strong>Date:</strong> {{formatDate invoiceDate "short"}}</p>
            <p><strong>Due Date:</strong> {{formatDate dueDate "short"}}</p>
        </div>
    </div>

    <div class="invoice-body">
        <div class="client-details">
            <h3>Bill To:</h3>
            <p>{{clientName}}</p>
            <p>{{clientAddress}}</p>
            <p>{{clientEmail}}</p>
        </div>

        <h3>Items</h3>
        <table>
            <thead>
                <tr>
                    <th>Description</th>
                    <th>Quantity</th>
                    <th>Unit Price</th>
                    <th>Total</th>
                </tr>
            </thead>
            <tbody>
                {{#each items}}
                <tr>
                    <td>{{description}}</td>
                    <td>{{quantity}}</td>
                    <td>{{currency unitPrice}}</td>
                    <td>{{currency total}}</td>
                </tr>
                {{/each}}
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">Subtotal:</td>
                    <td>{{currency subtotal}}</td>
                </tr>
                <tr>
                    <td colspan="3" style="text-align: right;">Tax ({{percentage taxRate}}):</td>
                    <td>{{currency taxAmount}}</td>
                </tr>
                <tr class="total-row">
                    <td colspan="3" style="text-align: right;">Total:</td>
                    <td>{{currency totalAmount}}</td>
                </tr>
            </tbody>
        </table>

        <div class="payment-details">
            <h3>Payment Details</h3>
            <p><strong>Payment Method:</strong> {{paymentMethod}}</p>
            {{#if bankDetails}}
            <p><strong>Bank Name:</strong> {{bankDetails.name}}</p>
            <p><strong>Account Number:</strong> {{bankDetails.accountNumber}}</p>
            <p><strong>Routing Number:</strong> {{bankDetails.routingNumber}}</p>
            {{/if}}
        </div>

        {{#if notes}}
        <div class="notes">
            <h3>Notes</h3>
            <p>{{notes}}</p>
        </div>
        {{/if}}
    </div>

    <div class="footer">
        <p>Thank you for your business!</p>
        {{#if termsAndConditions}}
        <p><small>{{termsAndConditions}}</small></p>
        {{/if}}
    </div>
</body>
</html>
```

---

This guide covers the fundamentals of creating templates for the Document Writer extension. By following these guidelines, you can create professional, reusable templates for various document types.

For additional help, refer to the [User Guide](./user-guide.md) or the [API Documentation](./api-documentation.md).
