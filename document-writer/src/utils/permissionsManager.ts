import * as vscode from 'vscode';
import { SecurityManager } from './securityManager';

/**
 * Access level for templates and other resources
 */
export enum AccessLevel {
    /**
     * Read-only access
     */
    READ = 'read',
    
    /**
     * Write access (includes read)
     */
    WRITE = 'write',
    
    /**
     * Full access (includes read, write, and sharing)
     */
    FULL = 'full',
    
    /**
     * No access
     */
    NONE = 'none'
}

/**
 * Permission entry for a resource
 */
export interface PermissionEntry {
    /**
     * Resource identifier
     */
    resourceId: string;
    
    /**
     * Type of resource
     */
    resourceType: string;
    
    /**
     * User or role identifier
     */
    principalId: string;
    
    /**
     * Type of principal (user, role, group)
     */
    principalType: 'user' | 'role' | 'group';
    
    /**
     * Access level granted
     */
    accessLevel: AccessLevel;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
    /**
     * Whether access is granted
     */
    granted: boolean;
    
    /**
     * Access level available
     */
    accessLevel?: AccessLevel;
    
    /**
     * Reason for access decision
     */
    reason?: string;
}

/**
 * PermissionsManager handles access control for templates and other resources
 * It provides a flexible permissions model that can be used to restrict access
 * to sensitive templates and operations
 */
export class PermissionsManager {
    private context: vscode.ExtensionContext;
    private securityManager: SecurityManager;
    private permissionsKey = 'document-writer.permissions';
    private permissions: Map<string, PermissionEntry[]> = new Map();
    private currentUser: string | undefined;
    private userRoles: Set<string> = new Set();
    
    /**
     * Creates a new PermissionsManager instance
     * @param context The extension context
     * @param securityManager The security manager instance
     */
    constructor(context: vscode.ExtensionContext, securityManager: SecurityManager) {
        this.context = context;
        this.securityManager = securityManager;
        
        // Set current user to VS Code's machineId (anonymized identifier)
        this.currentUser = vscode.env.machineId;
        
        // Load permissions from storage
        this.loadPermissions();
    }
    
    /**
     * Initializes the permissions system
     */
    public async initialize(): Promise<void> {
        await this.loadPermissions();
        
        // Add default roles for current user if none exist
        if (this.userRoles.size === 0) {
            this.userRoles.add('user');
        }
    }
    
    /**
     * Loads permissions from storage
     */
    private async loadPermissions(): Promise<void> {
        try {
            // Try to load from secure storage first
            const permissionsJson = await this.securityManager.getSecureData(this.permissionsKey);
            
            if (permissionsJson) {
                const parsedPermissions = JSON.parse(permissionsJson) as PermissionEntry[];
                
                // Convert to map for efficient lookups
                this.permissions.clear();
                for (const entry of parsedPermissions) {
                    const key = this.getPermissionKey(entry.resourceId, entry.resourceType);
                    if (!this.permissions.has(key)) {
                        this.permissions.set(key, []);
                    }
                    this.permissions.get(key)?.push(entry);
                }
            } else {
                // If no permissions found, initialize with defaults
                this.initializeDefaultPermissions();
            }
            
            // Load user roles
            await this.loadUserRoles();
        } catch (error) {
            console.error('Failed to load permissions:', error);
            // Initialize with defaults if loading fails
            this.initializeDefaultPermissions();
        }
    }
    
    /**
     * Initializes default permissions
     */
    private initializeDefaultPermissions(): void {
        // Clear existing permissions
        this.permissions.clear();
        
        // Add default permission for all users to access public templates
        this.grantAccess('public', 'template', 'role:user', AccessLevel.READ);
        
        // Save the default permissions
        this.savePermissions().catch(error => {
            console.error('Failed to save default permissions:', error);
        });
    }
    
    /**
     * Loads user roles from storage
     */
    private async loadUserRoles(): Promise<void> {
        try {
            if (!this.currentUser) {
                return;
            }
            
            const rolesKey = `document-writer.roles.${this.currentUser}`;
            const rolesJson = await this.securityManager.getSecureData(rolesKey);
            
            if (rolesJson) {
                const roles = JSON.parse(rolesJson) as string[];
                this.userRoles = new Set(roles);
            } else {
                // Initialize with default role
                this.userRoles = new Set(['user']);
                await this.saveUserRoles();
            }
        } catch (error) {
            console.error('Failed to load user roles:', error);
            // Initialize with default role
            this.userRoles = new Set(['user']);
        }
    }
    
    /**
     * Saves user roles to storage
     */
    private async saveUserRoles(): Promise<void> {
        try {
            if (!this.currentUser) {
                return;
            }
            
            const rolesKey = `document-writer.roles.${this.currentUser}`;
            const rolesJson = JSON.stringify(Array.from(this.userRoles));
            
            await this.securityManager.storeSecureData(rolesKey, rolesJson);
        } catch (error) {
            console.error('Failed to save user roles:', error);
        }
    }
    
    /**
     * Saves permissions to storage
     */
    private async savePermissions(): Promise<void> {
        try {
            // Flatten the map to an array for storage
            const permissionsArray: PermissionEntry[] = [];
            for (const entries of this.permissions.values()) {
                permissionsArray.push(...entries);
            }
            
            const permissionsJson = JSON.stringify(permissionsArray);
            
            // Store in secure storage
            await this.securityManager.storeSecureData(this.permissionsKey, permissionsJson);
        } catch (error) {
            console.error('Failed to save permissions:', error);
        }
    }
    
    /**
     * Gets a key for looking up permissions
     * @param resourceId Resource identifier
     * @param resourceType Resource type
     * @returns Permission lookup key
     */
    private getPermissionKey(resourceId: string, resourceType: string): string {
        return `${resourceType}:${resourceId}`;
    }
    
    /**
     * Checks if the current user has the required access to a resource
     * @param resourceId Resource identifier
     * @param resourceType Resource type
     * @param requiredLevel Required access level
     * @returns Permission check result
     */
    public checkAccess(resourceId: string, resourceType: string, requiredLevel: AccessLevel): PermissionCheckResult {
        if (!this.currentUser) {
            return {
                granted: false,
                reason: 'No user context available'
            };
        }
        
        // Always grant full access to administrator role
        if (this.userRoles.has('administrator')) {
            return {
                granted: true,
                accessLevel: AccessLevel.FULL,
                reason: 'Administrator role'
            };
        }
        
        const key = this.getPermissionKey(resourceId, resourceType);
        const entries = this.permissions.get(key) || [];
        
        // Check direct user permissions
        const userEntry = entries.find(e => 
            e.principalType === 'user' && e.principalId === this.currentUser
        );
        
        if (userEntry) {
            const granted = this.isAccessLevelSufficient(userEntry.accessLevel, requiredLevel);
            return {
                granted,
                accessLevel: userEntry.accessLevel,
                reason: granted ? 'Direct user permission' : 'Insufficient user permission'
            };
        }
        
        // Check role-based permissions
        for (const role of this.userRoles) {
            const roleEntry = entries.find(e => 
                e.principalType === 'role' && e.principalId === `role:${role}`
            );
            
            if (roleEntry) {
                const granted = this.isAccessLevelSufficient(roleEntry.accessLevel, requiredLevel);
                return {
                    granted,
                    accessLevel: roleEntry.accessLevel,
                    reason: granted ? `Role permission: ${role}` : `Insufficient role permission: ${role}`
                };
            }
        }
        
        // Check group-based permissions (for future use)
        // Implementation would go here
        
        // Default: no access
        return {
            granted: false,
            accessLevel: AccessLevel.NONE,
            reason: 'No matching permission found'
        };
    }
    
    /**
     * Determines if a given access level is sufficient for the required level
     * @param givenLevel Access level granted
     * @param requiredLevel Access level required
     * @returns Whether the given level is sufficient
     */
    private isAccessLevelSufficient(givenLevel: AccessLevel, requiredLevel: AccessLevel): boolean {
        if (givenLevel === AccessLevel.NONE) {
            return false;
        }
        
        if (givenLevel === AccessLevel.FULL) {
            return true;
        }
        
        if (givenLevel === AccessLevel.WRITE) {
            return requiredLevel === AccessLevel.READ || requiredLevel === AccessLevel.WRITE;
        }
        
        if (givenLevel === AccessLevel.READ) {
            return requiredLevel === AccessLevel.READ;
        }
        
        return false;
    }
    
    /**
     * Grants access to a resource for a principal
     * @param resourceId Resource identifier
     * @param resourceType Resource type
     * @param principalId Principal identifier
     * @param accessLevel Access level to grant
     * @returns Whether the operation was successful
     */
    public grantAccess(resourceId: string, resourceType: string, principalId: string, accessLevel: AccessLevel): boolean {
        try {
            const key = this.getPermissionKey(resourceId, resourceType);
            
            if (!this.permissions.has(key)) {
                this.permissions.set(key, []);
            }
            
            const entries = this.permissions.get(key)!;
            
            // Determine principal type
            let principalType: 'user' | 'role' | 'group';
            
            if (principalId.startsWith('role:')) {
                principalType = 'role';
            } else if (principalId.startsWith('group:')) {
                principalType = 'group';
            } else {
                principalType = 'user';
            }
            
            // Check if entry already exists
            const existingIndex = entries.findIndex(e => 
                e.principalId === principalId && e.principalType === principalType
            );
            
            if (existingIndex >= 0) {
                // Update existing entry
                entries[existingIndex].accessLevel = accessLevel;
            } else {
                // Add new entry
                entries.push({
                    resourceId,
                    resourceType,
                    principalId,
                    principalType,
                    accessLevel
                });
            }
            
            // Save changes
            this.savePermissions().catch(error => {
                console.error('Failed to save permissions after grant:', error);
            });
            
            return true;
        } catch (error) {
            console.error('Failed to grant access:', error);
            return false;
        }
    }
    
    /**
     * Revokes access to a resource for a principal
     * @param resourceId Resource identifier
     * @param resourceType Resource type
     * @param principalId Principal identifier
     * @returns Whether the operation was successful
     */
    public revokeAccess(resourceId: string, resourceType: string, principalId: string): boolean {
        try {
            const key = this.getPermissionKey(resourceId, resourceType);
            
            if (!this.permissions.has(key)) {
                return true; // Nothing to revoke
            }
            
            const entries = this.permissions.get(key)!;
            
            // Determine principal type
            let principalType: 'user' | 'role' | 'group';
            
            if (principalId.startsWith('role:')) {
                principalType = 'role';
            } else if (principalId.startsWith('group:')) {
                principalType = 'group';
            } else {
                principalType = 'user';
            }
            
            // Remove matching entries
            const filteredEntries = entries.filter(e => 
                !(e.principalId === principalId && e.principalType === principalType)
            );
            
            if (filteredEntries.length > 0) {
                this.permissions.set(key, filteredEntries);
            } else {
                this.permissions.delete(key);
            }
            
            // Save changes
            this.savePermissions().catch(error => {
                console.error('Failed to save permissions after revoke:', error);
            });
            
            return true;
        } catch (error) {
            console.error('Failed to revoke access:', error);
            return false;
        }
    }
    
    /**
     * Gets all permissions for a resource
     * @param resourceId Resource identifier
     * @param resourceType Resource type
     * @returns Array of permission entries
     */
    public getPermissions(resourceId: string, resourceType: string): PermissionEntry[] {
        const key = this.getPermissionKey(resourceId, resourceType);
        return [...(this.permissions.get(key) || [])];
    }
    
    /**
     * Adds a role to the current user
     * @param role Role to add
     * @returns Whether the operation was successful
     */
    public async addUserRole(role: string): Promise<boolean> {
        try {
            if (!this.currentUser) {
                return false;
            }
            
            this.userRoles.add(role);
            await this.saveUserRoles();
            return true;
        } catch (error) {
            console.error('Failed to add user role:', error);
            return false;
        }
    }
    
    /**
     * Removes a role from the current user
     * @param role Role to remove
     * @returns Whether the operation was successful
     */
    public async removeUserRole(role: string): Promise<boolean> {
        try {
            if (!this.currentUser || !this.userRoles.has(role)) {
                return false;
            }
            
            // Prevent removing the last role
            if (this.userRoles.size <= 1) {
                return false;
            }
            
            this.userRoles.delete(role);
            await this.saveUserRoles();
            return true;
        } catch (error) {
            console.error('Failed to remove user role:', error);
            return false;
        }
    }
    
    /**
     * Gets all roles assigned to the current user
     * @returns Array of role names
     */
    public getUserRoles(): string[] {
        return Array.from(this.userRoles);
    }
}
