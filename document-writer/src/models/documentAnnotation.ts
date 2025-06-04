/**
 * documentAnnotation.ts
 * Defines types and classes for document annotations
 */

import * as vscode from 'vscode';

/**
 * Annotation type
 */
export enum AnnotationType {
    /**
     * Comment annotation
     */
    Comment = 'comment',
    
    /**
     * Highlight annotation
     */
    Highlight = 'highlight',
    
    /**
     * Suggestion annotation
     */
    Suggestion = 'suggestion',
    
    /**
     * Question annotation
     */
    Question = 'question',
    
    /**
     * Issue annotation
     */
    Issue = 'issue',
    
    /**
     * Custom annotation
     */
    Custom = 'custom'
}

/**
 * Annotation position interface
 */
export interface AnnotationPosition {
    /**
     * Start position
     */
    start: {
        /**
         * Line number (0-based)
         */
        line: number;
        
        /**
         * Character offset within line (0-based)
         */
        character?: number;
        
        /**
         * Page number (for paginated documents)
         */
        page?: number;
        
        /**
         * X coordinate (for visual documents)
         */
        x?: number;
        
        /**
         * Y coordinate (for visual documents)
         */
        y?: number;
    };
    
    /**
     * End position (optional for point annotations)
     */
    end?: {
        /**
         * Line number (0-based)
         */
        line?: number;
        
        /**
         * Character offset within line (0-based)
         */
        character?: number;
        
        /**
         * Page number (for paginated documents)
         */
        page?: number;
        
        /**
         * X coordinate (for visual documents)
         */
        x?: number;
        
        /**
         * Y coordinate (for visual documents)
         */
        y?: number;
    };
    
    /**
     * Content selector (CSS-like)
     */
    selector?: string;
}

/**
 * Annotation metadata interface
 */
export interface AnnotationMetadata {
    /**
     * Creation date
     */
    createdAt: Date;
    
    /**
     * Last modification date
     */
    modifiedAt: Date;
    
    /**
     * Creator information
     */
    creator: {
        /**
         * Creator name
         */
        name: string;
        
        /**
         * Creator ID
         */
        id?: string;
    };
    
    /**
     * Annotation color
     */
    color?: string;
    
    /**
     * Annotation tags
     */
    tags?: string[];
    
    /**
     * Annotation priority (0-5)
     */
    priority?: number;
    
    /**
     * Annotation state
     */
    state?: 'open' | 'resolved' | 'rejected' | 'deferred';
    
    /**
     * Custom metadata
     */
    custom?: { [key: string]: any };
}

/**
 * Document annotation interface
 */
export interface DocumentAnnotation {
    /**
     * Annotation ID
     */
    id: string;
    
    /**
     * Document URI
     */
    documentUri: string;
    
    /**
     * Annotation type
     */
    type: AnnotationType;
    
    /**
     * Annotation content
     */
    content: string;
    
    /**
     * Annotation position
     */
    position?: AnnotationPosition;
    
    /**
     * Associated text (from document)
     */
    associatedText?: string;
    
    /**
     * Annotation metadata
     */
    metadata: AnnotationMetadata;
    
    /**
     * Replies to this annotation
     */
    replies?: AnnotationReply[];
}

/**
 * Annotation reply interface
 */
export interface AnnotationReply {
    /**
     * Reply ID
     */
    id: string;
    
    /**
     * Reply content
     */
    content: string;
    
    /**
     * Creator information
     */
    creator: {
        /**
         * Creator name
         */
        name: string;
        
        /**
         * Creator ID
         */
        id?: string;
    };
    
    /**
     * Creation date
     */
    createdAt: Date;
    
    /**
     * Last modification date
     */
    modifiedAt?: Date;
}

/**
 * Annotation manager class
 */
export class AnnotationManager {
    /**
     * Singleton instance
     */
    private static instance: AnnotationManager;
    
    /**
     * Annotations map by document URI
     */
    private annotations: Map<string, DocumentAnnotation[]> = new Map();
    
    /**
     * Private constructor (singleton)
     */
    private constructor() {}
    
    /**
     * Get singleton instance
     */
    public static getInstance(): AnnotationManager {
        if (!AnnotationManager.instance) {
            AnnotationManager.instance = new AnnotationManager();
        }
        return AnnotationManager.instance;
    }
    
    /**
     * Load annotations for document
     */
    public async loadAnnotations(documentUri: vscode.Uri): Promise<DocumentAnnotation[]> {
        const uriString = documentUri.toString();
        
        // Check if already loaded
        if (this.annotations.has(uriString)) {
            return this.annotations.get(uriString) || [];
        }
        
        try {
            // In a real implementation, this would load from persistent storage
            // For now, return an empty array
            this.annotations.set(uriString, []);
            return [];
        } catch (error) {
            console.error('Error loading annotations:', error);
            return [];
        }
    }
    
    /**
     * Save annotations for document
     */
    public async saveAnnotations(
        documentUri: vscode.Uri,
        annotations: DocumentAnnotation[]
    ): Promise<boolean> {
        const uriString = documentUri.toString();
        
        try {
            // In a real implementation, this would save to persistent storage
            this.annotations.set(uriString, annotations);
            return true;
        } catch (error) {
            console.error('Error saving annotations:', error);
            return false;
        }
    }
    
    /**
     * Add annotation to document
     */
    public async addAnnotation(
        documentUri: vscode.Uri,
        annotation: Omit<DocumentAnnotation, 'id' | 'metadata'>,
        position?: vscode.Position | vscode.Range,
        creatorName: string = 'User'
    ): Promise<DocumentAnnotation | null> {
        const uriString = documentUri.toString();
        
        // Load existing annotations
        const annotations = await this.loadAnnotations(documentUri);
        
        // Create new annotation
        const newAnnotation: DocumentAnnotation = {
            id: this.generateId(),
            documentUri: uriString,
            type: annotation.type,
            content: annotation.content,
            position: annotation.position || this.convertVSCodePosition(position),
            associatedText: annotation.associatedText,
            metadata: {
                createdAt: new Date(),
                modifiedAt: new Date(),
                creator: {
                    name: creatorName
                }
            },
            replies: []
        };
        
        // Add to list
        annotations.push(newAnnotation);
        
        // Save annotations
        const success = await this.saveAnnotations(documentUri, annotations);
        
        return success ? newAnnotation : null;
    }
    
    /**
     * Update annotation
     */
    public async updateAnnotation(
        documentUri: vscode.Uri,
        annotationId: string,
        updates: Partial<DocumentAnnotation>
    ): Promise<DocumentAnnotation | null> {
        const uriString = documentUri.toString();
        
        // Load existing annotations
        const annotations = await this.loadAnnotations(documentUri);
        
        // Find annotation index
        const index = annotations.findIndex(a => a.id === annotationId);
        
        if (index === -1) {
            return null;
        }
        
        // Update annotation
        const updatedAnnotation: DocumentAnnotation = {
            ...annotations[index],
            ...updates,
            metadata: {
                ...annotations[index].metadata,
                ...updates.metadata,
                modifiedAt: new Date()
            }
        };
        
        // Replace in array
        annotations[index] = updatedAnnotation;
        
        // Save annotations
        const success = await this.saveAnnotations(documentUri, annotations);
        
        return success ? updatedAnnotation : null;
    }
    
    /**
     * Delete annotation
     */
    public async deleteAnnotation(
        documentUri: vscode.Uri,
        annotationId: string
    ): Promise<boolean> {
        const uriString = documentUri.toString();
        
        // Load existing annotations
        const annotations = await this.loadAnnotations(documentUri);
        
        // Filter out annotation
        const filteredAnnotations = annotations.filter(a => a.id !== annotationId);
        
        // If nothing changed, annotation doesn't exist
        if (filteredAnnotations.length === annotations.length) {
            return false;
        }
        
        // Save annotations
        return await this.saveAnnotations(documentUri, filteredAnnotations);
    }
    
    /**
     * Add reply to annotation
     */
    public async addReplyToAnnotation(
        documentUri: vscode.Uri,
        annotationId: string,
        content: string,
        creatorName: string = 'User'
    ): Promise<AnnotationReply | null> {
        const uriString = documentUri.toString();
        
        // Load existing annotations
        const annotations = await this.loadAnnotations(documentUri);
        
        // Find annotation index
        const index = annotations.findIndex(a => a.id === annotationId);
        
        if (index === -1) {
            return null;
        }
        
        // Create new reply
        const newReply: AnnotationReply = {
            id: this.generateId(),
            content,
            creator: {
                name: creatorName
            },
            createdAt: new Date()
        };
        
        // Ensure replies array exists
        if (!annotations[index].replies) {
            annotations[index].replies = [];
        }
        
        // Add reply
        annotations[index].replies!.push(newReply);
        
        // Update modification date
        annotations[index].metadata.modifiedAt = new Date();
        
        // Save annotations
        const success = await this.saveAnnotations(documentUri, annotations);
        
        return success ? newReply : null;
    }
    
    /**
     * Generate annotation HTML
     */
    public getAnnotationHtml(annotation: DocumentAnnotation): string {
        // Create a simple HTML representation of the annotation
        const typeIcon = this.getTypeIcon(annotation.type);
        const formattedDate = annotation.metadata.createdAt.toLocaleString();
        const priorityClass = annotation.metadata.priority 
            ? `priority-${annotation.metadata.priority}` 
            : '';
        
        // Format replies
        let repliesHtml = '';
        if (annotation.replies && annotation.replies.length > 0) {
            repliesHtml = '<div class="annotation-replies">';
            
            annotation.replies.forEach(reply => {
                const replyDate = reply.createdAt.toLocaleString();
                
                repliesHtml += `
                    <div class="annotation-reply" data-reply-id="${reply.id}">
                        <div class="reply-header">
                            <span class="reply-author">${reply.creator.name}</span>
                            <span class="reply-date">${replyDate}</span>
                        </div>
                        <div class="reply-content">${reply.content}</div>
                    </div>
                `;
            });
            
            repliesHtml += '</div>';
        }
        
        // Build the HTML
        return `
            <div class="annotation ${priorityClass}" data-annotation-id="${annotation.id}" data-type="${annotation.type}">
                <div class="annotation-header">
                    <div class="annotation-type">
                        <i class="codicon ${typeIcon}"></i>
                        <span>${annotation.type}</span>
                    </div>
                    <div class="annotation-meta">
                        <span class="annotation-author">${annotation.metadata.creator.name}</span>
                        <span class="annotation-date">${formattedDate}</span>
                    </div>
                    <div class="annotation-actions">
                        <button class="edit-annotation" title="Edit"><i class="codicon codicon-edit"></i></button>
                        <button class="delete-annotation" title="Delete"><i class="codicon codicon-trash"></i></button>
                    </div>
                </div>
                <div class="annotation-content">${annotation.content}</div>
                ${annotation.associatedText ? `<div class="annotation-context">${annotation.associatedText}</div>` : ''}
                ${repliesHtml}
                <div class="annotation-reply-form">
                    <textarea placeholder="Add a reply..."></textarea>
                    <button class="add-reply-button">Reply</button>
                </div>
            </div>
        `;
    }
    
    /**
     * Get icon for annotation type
     */
    private getTypeIcon(type: AnnotationType): string {
        switch (type) {
            case AnnotationType.Comment:
                return 'codicon-comment';
            case AnnotationType.Highlight:
                return 'codicon-highlight';
            case AnnotationType.Suggestion:
                return 'codicon-lightbulb';
            case AnnotationType.Question:
                return 'codicon-question';
            case AnnotationType.Issue:
                return 'codicon-issues';
            case AnnotationType.Custom:
            default:
                return 'codicon-note';
        }
    }
    
    /**
     * Generate unique ID
     */
    private generateId(): string {
        return `annotation-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
    }
    
    /**
     * Convert VSCode position to annotation position
     */
    private convertVSCodePosition(
        position?: vscode.Position | vscode.Range
    ): AnnotationPosition | undefined {
        if (!position) {
            return undefined;
        }
        
        if (position instanceof vscode.Position) {
            return {
                start: {
                    line: position.line,
                    character: position.character
                }
            };
        }
        
        if (position instanceof vscode.Range) {
            return {
                start: {
                    line: position.start.line,
                    character: position.start.character
                },
                end: {
                    line: position.end.line,
                    character: position.end.character
                }
            };
        }
        
        return undefined;
    }
}
