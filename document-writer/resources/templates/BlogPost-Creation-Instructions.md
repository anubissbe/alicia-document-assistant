# Blog Post Template (.docx) Creation Instructions

This document provides detailed instructions for creating the BlogPost.docx template file for the Document Writer extension.

## Overview

The Blog Post Template is a comprehensive content creation template designed for bloggers, content creators, and digital marketers. It includes all necessary sections for professional blog post creation with SEO optimization and social media integration.

## Template Structure

The .docx file should be created with the following structure and formatting:

### 1. Document Setup
- **Font:** Segoe UI or Arial, 11pt for body text
- **Margins:** 1 inch on all sides
- **Line Spacing:** 1.15
- **Page Orientation:** Portrait

### 2. Title Page
```
{{title}}
[Style: Heading 1, 32pt, Bold, Color: #2c3e50]

{{#if subtitle}}
{{subtitle}}
[Style: Heading 2, 20pt, Color: #7f8c8d]
{{/if}}

Author: {{author}}
Publication Date: {{formatDate publishDate 'long'}}
Tags: {{tags}}
{{#if readingTime}}Reading Time: {{readingTime}} minutes{{/if}}
{{#if wordCount}}Target Word Count: {{wordCount}} words{{/if}}
```

### 3. SEO Metadata Section
Create a professional table with the following structure:

| SEO Element | Content | Best Practice |
|-------------|---------|---------------|
| Meta Title | {{metaTitle}} | 50-60 characters |
| Meta Description | {{metaDescription}} | 150-160 characters |
| URL Slug | {{urlSlug}} | Lowercase, hyphens |
| Primary Keywords | {{keywords}} | 3-5 focus keywords |
| Featured Image | {{featuredImage}} | High-resolution, relevant |
| Image Alt Text | {{featuredImageAlt}} | Descriptive, includes keywords |
| {{#if keywordDensity}}Keyword Density | {{percentage keywordDensity}} | 1-3% optimal range{{/if}} |

### 4. Content Structure
```
Opening Hook
[Text box with light red background]
{{hook}}

Introduction
{{introduction}}

{{section1Title}}
[Style: Heading 2]
{{section1Content}}

{{section2Title}}
[Style: Heading 2]
{{section2Content}}

{{section3Title}}
[Style: Heading 2]
{{section3Content}}

{{#if section4Title}}
{{section4Title}}
[Style: Heading 2]
{{section4Content}}
{{/if}}

{{#if section5Title}}
{{section5Title}}
[Style: Heading 2]
{{section5Content}}
{{/if}}

Conclusion
{{conclusion}}

Call to Action
[Text box with green border and light green background]
{{callToAction}}
```

### 5. SEO Optimization Guidelines
Create sections with the following content:

**Heading Structure Guidelines:**
- H1: Main title only (once per page)
- H2: Main section headings
- H3: Subsection headings
- Keywords: Include naturally in headings

**Link Strategy Table:**
| Link Type | Recommendations | Content |
|-----------|----------------|---------|
| Internal Links | 2-3 relevant internal pages | {{#if internalLinks}}{{internalLinks}}{{else}}Add relevant internal page links{{/if}} |
| External Links | 1-2 authoritative sources | {{#if externalLinks}}{{externalLinks}}{{else}}Add credible external sources{{/if}} |

### 6. Content Strategy Section
```
Target Audience
{{targetAudience}}

Content Goals & Objectives
{{contentGoals}}

Tone & Voice Guidelines
{{toneVoice}}

Content Category
{{contentCategory}}
```

### 7. Social Media Integration
```
Social Media Snippet
[Blue background text box]
{{socialSnippet}}

Hashtag Strategy
Recommended Hashtags: {{hashtags}}

Platform Adaptations:
Twitter: {{#if twitterAdaptation}}{{twitterAdaptation}}{{else}}Create 280-character adaptation{{/if}}
LinkedIn: {{#if linkedinAdaptation}}{{linkedinAdaptation}}{{else}}Create professional adaptation{{/if}}

Share-Worthy Quote
[Yellow background quote box]
"{{shareableQuote}}"
```

### 8. Analytics & Performance Tracking
Create a grid layout with metric cards:

**Traffic Goals:** {{trafficGoals}}
**Engagement Metrics:** {{engagementMetrics}}
**Conversion Objectives:** {{conversionObjectives}}

**KPI Tracking Table:**
| Metric | Target | Measurement Method |
|--------|--------|-------------------|
| Page Views | From traffic goals | Google Analytics |
| Time on Page | From engagement metrics | Google Analytics |
| Social Shares | From engagement metrics | Social media analytics |
| Conversions | From conversion objectives | Conversion tracking |

### 9. Content Checklist & Publishing
Create a checklist with checkbox symbols (☐):

**Pre-Publishing Checklist:**
☐ Title optimized for SEO (H1 tag)
☐ Meta title and description completed
☐ URL slug is SEO-friendly
☐ Featured image added with alt text
☐ Content includes target keywords naturally
☐ Internal links added (2-3 relevant pages)
☐ External links added (1-2 authoritative sources)
☐ All images have descriptive alt text
☐ Content flows logically with clear headings
☐ Call-to-action is compelling and clear
☐ Social media snippets prepared
☐ Hashtags researched and selected
☐ Content proofread for grammar and spelling
☐ Mobile-friendly formatting verified
☐ Analytics tracking set up

**Publishing Schedule & Timing:**
{{#if publishingSchedule}}{{publishingSchedule}}{{else}}Recommended: Tuesday-Thursday, 9-11 AM in your target audience's timezone{{/if}}

**Promotion Strategy:**
{{#if promotionStrategy}}{{promotionStrategy}}{{else}}
- Share on company social media accounts
- Include in email newsletter
- Post in relevant industry groups
- Reach out to mentioned sources
- Create social media quote graphics
{{/if}}

**Follow-Up Actions:**
{{#if followUpActions}}{{followUpActions}}{{else}}
- Monitor comments and respond within 24 hours
- Share in relevant online communities
- Create quote graphics for social media
- Track performance metrics weekly
- Repurpose content for other formats
- Plan follow-up content based on engagement
{{/if}}

## Formatting Guidelines

### Colors
- **Primary Headers:** #2c3e50 (Dark Blue-Gray)
- **Secondary Headers:** #34495e (Medium Blue-Gray)
- **Accent Color:** #3498db (Blue)
- **Success Color:** #28a745 (Green)
- **Warning Color:** #ffc107 (Yellow)
- **Info Color:** #17a2b8 (Cyan)

### Text Boxes and Highlights
- **Hook Section:** Light red background (#fff5f5)
- **Call-to-Action:** Light green background (#d4edda) with green border
- **Social Snippet:** Light blue background (#e3f2fd)
- **Quote Box:** Light yellow background (#fff3cd)
- **Strategy Sections:** Light gray background (#f8f9fa)

### Tables
- **Header Row:** Blue background (#3498db) with white text
- **Alternating Rows:** Light gray background (#f8f9fa)
- **Border:** 1px solid #ddd

### Page Breaks
Insert page breaks after each major section:
1. After Title Page
2. After SEO Metadata
3. After Content Structure
4. After SEO Guidelines
5. After Content Strategy
6. After Social Media Integration
7. After Analytics Section

## Handlebars Variables Used

The template uses the following Handlebars variables and helpers:

### Variables
- `title`, `subtitle`, `author`, `publishDate`, `tags`
- `metaTitle`, `metaDescription`, `keywords`, `urlSlug`
- `featuredImage`, `featuredImageAlt`
- `hook`, `introduction`, `conclusion`, `callToAction`
- `section1Title` through `section5Title` (sections 4-5 optional)
- `section1Content` through `section5Content` (sections 4-5 optional)
- `targetAudience`, `contentGoals`, `toneVoice`, `contentCategory`
- `socialSnippet`, `hashtags`, `shareableQuote`
- `twitterAdaptation`, `linkedinAdaptation` (optional)
- `trafficGoals`, `engagementMetrics`, `conversionObjectives`
- `keywordDensity`, `readingTime`, `wordCount` (optional)
- `internalLinks`, `externalLinks` (optional)
- `publishingSchedule`, `promotionStrategy`, `followUpActions` (optional)

### Handlebars Helpers
- `{{formatDate publishDate 'long'}}` - Long date format
- `{{formatDate publishDate 'datetime'}}` - Date and time format
- `{{percentage keywordDensity}}` - Percentage formatting
- `{{#if variable}}...{{/if}}` - Conditional content
- `{{#if variable}}...{{else}}...{{/if}}` - Conditional with fallback

## File Naming and Location

Save the template as:
`/mnt/c/Users/bertc/OneDrive/Documenten/Cline/document-writer/document-writer/resources/templates/BlogPost.docx`

## Notes for Implementation

1. **Word Document Creation:** Use Microsoft Word or LibreOffice Writer to create the .docx file
2. **Template Testing:** Test the template with sample data to ensure proper formatting
3. **Variable Placement:** Ensure all Handlebars variables are properly placed and formatted
4. **Styling Consistency:** Maintain consistent styling throughout the document
5. **Page Layout:** Use appropriate page breaks and section divisions
6. **Accessibility:** Ensure color contrast and font sizes meet accessibility standards

## Quality Assurance

Before finalizing the template:
- [ ] All Handlebars variables are correctly formatted
- [ ] Conditional sections work properly
- [ ] Table formatting is professional and readable
- [ ] Color scheme is consistent and professional
- [ ] Page breaks are appropriately placed
- [ ] Text boxes and highlights enhance readability
- [ ] Checklist items are properly formatted
- [ ] All sections flow logically

This comprehensive blog post template will provide content creators with a professional, SEO-optimized structure for creating high-quality blog content that drives engagement and conversions.