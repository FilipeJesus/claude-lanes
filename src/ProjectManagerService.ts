/**
 * ProjectManagerService - Integrates with the Project Manager VS Code extension
 *
 * This service provides a clean API for interacting with the Project Manager extension
 * (ID: alefragnani.project-manager) using the VS Code extension API.
 *
 * Note: The Project Manager extension primarily provides commands for user interaction
 * (Save Project, Edit Project, List Projects, etc.) rather than a programmatic API.
 * This service attempts to use any exported API if available, and provides methods
 * that can be extended when/if the extension adds programmatic support.
 *
 * Available Project Manager Commands:
 * - projectManager.saveProject: Save the current folder/workspace as a new project
 * - projectManager.editProjects: Edit your projects manually (projects.json)
 * - projectManager.listProjects: List all saved/detected projects and pick one
 * - projectManager.listProjectsNewWindow: List projects and open in new window
 * - projectManager.filterProjectsByTag: Filter projects by selected tags
 *
 * @see https://marketplace.visualstudio.com/items?itemName=alefragnani.project-manager
 */

import * as vscode from 'vscode';

/**
 * The extension ID for Project Manager by Alessandro Fragnani.
 */
const PROJECT_MANAGER_EXTENSION_ID = 'alefragnani.project-manager';

/**
 * Represents a project entry in Project Manager.
 * This interface matches the structure used in projects.json.
 */
export interface ProjectEntry {
    /** Display name of the project */
    name: string;
    /** Absolute path to the project root */
    rootPath: string;
    /** Whether the project is enabled/visible in the list */
    enabled: boolean;
    /** Optional tags for organizing projects */
    tags?: string[];
    /** Optional group for organizing projects */
    group?: string;
}

/**
 * Expected API structure exported by the Project Manager extension.
 *
 * Note: The Project Manager extension may not export a programmatic API.
 * This interface defines what we would expect if it did. If the extension
 * adds API support in the future, this interface should be updated accordingly.
 */
export interface ProjectManagerApi {
    /**
     * Get all saved projects
     */
    getProjects?: () => Promise<ProjectEntry[]>;

    /**
     * Alternative method name for getting projects
     */
    listProjects?: () => Promise<ProjectEntry[]>;

    /**
     * Add or save a new project
     */
    addProject?: (project: Partial<ProjectEntry>) => Promise<boolean | void>;

    /**
     * Alternative method name for adding projects
     */
    saveProject?: (project: Partial<ProjectEntry>) => Promise<boolean | void>;

    /**
     * Delete/remove a project by path
     */
    deleteProject?: (rootPath: string) => Promise<boolean | void>;

    /**
     * Alternative method name for deleting projects
     */
    removeProject?: (rootPath: string) => Promise<boolean | void>;

    /**
     * Refresh the project list (trigger UI update)
     */
    refresh?: () => Promise<void> | void;

    /**
     * Any other properties the extension might export
     */
    [key: string]: unknown;
}

/**
 * Cached reference to the Project Manager extension
 */
let cachedExtension: vscode.Extension<ProjectManagerApi> | undefined;

/**
 * Cached reference to the activated API
 */
let cachedApi: ProjectManagerApi | undefined;

/**
 * Check if the Project Manager extension is installed.
 *
 * @returns true if the extension is installed, false otherwise
 */
export function isProjectManagerAvailable(): boolean {
    const extension = vscode.extensions.getExtension<ProjectManagerApi>(PROJECT_MANAGER_EXTENSION_ID);
    return extension !== undefined;
}

/**
 * Get the Project Manager extension instance.
 * Uses caching to avoid repeated lookups.
 *
 * @returns The extension instance or undefined if not installed
 */
function getExtension(): vscode.Extension<ProjectManagerApi> | undefined {
    if (cachedExtension) {
        return cachedExtension;
    }

    cachedExtension = vscode.extensions.getExtension<ProjectManagerApi>(PROJECT_MANAGER_EXTENSION_ID);
    return cachedExtension;
}

/**
 * Get the Project Manager API, activating the extension if needed.
 *
 * Note: The Project Manager extension may not export a programmatic API.
 * This function will return undefined if no API is available, even if the
 * extension is installed.
 *
 * @returns The Project Manager API, or undefined if not available
 */
export async function getProjectManagerApi(): Promise<ProjectManagerApi | undefined> {
    // Return cached API if available and extension is still active
    if (cachedApi) {
        const extension = getExtension();
        if (extension?.isActive) {
            return cachedApi;
        }
        // Extension was deactivated, clear cache
        cachedApi = undefined;
    }

    const extension = getExtension();

    if (!extension) {
        console.warn('Claude Lanes: Project Manager extension is not installed. ' +
            `Install extension '${PROJECT_MANAGER_EXTENSION_ID}' for enhanced project management.`);
        return undefined;
    }

    try {
        // Activate the extension if not already active
        if (!extension.isActive) {
            console.log('Claude Lanes: Activating Project Manager extension...');
            await extension.activate();
        }

        // Get the exported API
        const api = extension.exports;

        // Check if there's actually an API exported
        if (!api || (typeof api === 'object' && Object.keys(api).length === 0)) {
            console.warn('Claude Lanes: Project Manager extension does not export a programmatic API. ' +
                'Project management features may be limited.');
            return undefined;
        }

        // Cache the API for future use
        cachedApi = api;
        return api;

    } catch (err) {
        console.error('Claude Lanes: Failed to activate Project Manager extension:', err);
        return undefined;
    }
}

/**
 * Get all projects from Project Manager.
 *
 * @returns Array of projects, or empty array if not available
 */
export async function getProjects(): Promise<ProjectEntry[]> {
    const api = await getProjectManagerApi();

    if (!api) {
        return [];
    }

    try {
        // Try different method names that the API might use
        if (typeof api.getProjects === 'function') {
            return await api.getProjects();
        }

        if (typeof api.listProjects === 'function') {
            return await api.listProjects();
        }

        console.warn('Claude Lanes: Project Manager API does not have a getProjects or listProjects method.');
        return [];

    } catch (err) {
        console.error('Claude Lanes: Failed to get projects from Project Manager:', err);
        return [];
    }
}

/**
 * Add a project to Project Manager.
 *
 * @param name Display name for the project
 * @param rootPath Absolute path to the project root
 * @param tags Optional tags for organizing the project
 * @returns true if the project was added successfully, false otherwise
 */
export async function addProject(
    name: string,
    rootPath: string,
    tags?: string[]
): Promise<boolean> {
    // Validate inputs
    if (!name || !name.trim()) {
        console.warn('Claude Lanes: addProject called with empty name');
        return false;
    }

    if (!rootPath || !rootPath.trim()) {
        console.warn('Claude Lanes: addProject called with empty rootPath');
        return false;
    }

    const api = await getProjectManagerApi();

    if (!api) {
        return false;
    }

    const project: Partial<ProjectEntry> = {
        name,
        rootPath,
        enabled: true,
        tags: tags || ['claude-lanes']
    };

    try {
        // Try different method names that the API might use
        if (typeof api.addProject === 'function') {
            const result = await api.addProject(project);
            // If the method returns void, assume success
            if (result === undefined) {
                // Trigger a refresh if available to update the UI
                if (typeof api.refresh === 'function') {
                    await api.refresh();
                }
                return true;
            }
            return !!result;
        }

        if (typeof api.saveProject === 'function') {
            const result = await api.saveProject(project);
            if (result === undefined) {
                if (typeof api.refresh === 'function') {
                    await api.refresh();
                }
                return true;
            }
            return !!result;
        }

        console.warn('Claude Lanes: Project Manager API does not have an addProject or saveProject method.');
        return false;

    } catch (err) {
        console.error('Claude Lanes: Failed to add project to Project Manager:', err);
        return false;
    }
}

/**
 * Remove a project from Project Manager by its root path.
 *
 * @param rootPath Absolute path to the project root
 * @returns true if the project was removed successfully, false otherwise
 */
export async function removeProject(rootPath: string): Promise<boolean> {
    // Validate input
    if (!rootPath || !rootPath.trim()) {
        console.warn('Claude Lanes: removeProject called with empty rootPath');
        return false;
    }

    const api = await getProjectManagerApi();

    if (!api) {
        return false;
    }

    try {
        // Try different method names that the API might use
        if (typeof api.deleteProject === 'function') {
            const result = await api.deleteProject(rootPath);
            if (result === undefined) {
                if (typeof api.refresh === 'function') {
                    await api.refresh();
                }
                return true;
            }
            return !!result;
        }

        if (typeof api.removeProject === 'function') {
            const result = await api.removeProject(rootPath);
            if (result === undefined) {
                if (typeof api.refresh === 'function') {
                    await api.refresh();
                }
                return true;
            }
            return !!result;
        }

        console.warn('Claude Lanes: Project Manager API does not have a deleteProject or removeProject method.');
        return false;

    } catch (err) {
        console.error('Claude Lanes: Failed to remove project from Project Manager:', err);
        return false;
    }
}

/**
 * Clear the cached extension and API references.
 * Useful for testing or when the extension is reinstalled/updated.
 */
export function clearCache(): void {
    cachedExtension = undefined;
    cachedApi = undefined;
}

/**
 * Get the extension ID being used for Project Manager.
 * Useful for debugging and error messages.
 *
 * @returns The extension ID string
 */
export function getExtensionId(): string {
    return PROJECT_MANAGER_EXTENSION_ID;
}
