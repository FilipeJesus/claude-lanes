/**
 * OpenCodeAgent - Implementation of CodeAgent for OpenCode
 *
 * This module provides OpenCode-specific implementations for all code agent
 * behaviors including command building, session management, and plugin support.
 */

import * as path from 'path';
import {
    CodeAgent,
    SessionData,
    AgentStatus,
    PermissionMode,
    HookConfig,
    StartCommandOptions,
    ResumeCommandOptions,
    McpConfig
} from './CodeAgent';

/**
 * OpenCode implementation of the CodeAgent interface
 *
 * Provides all OpenCode-specific behavior including:
 * - Permission mode handling (ask, allow, deny)
 * - Plugin configuration for session tracking and status updates
 * - MCP server integration for workflow support (MCP config in opencode.json)
 */
export class OpenCodeAgent extends CodeAgent {
    /**
     * Create a new OpenCodeAgent instance with OpenCode-specific configuration
     */
    constructor() {
        super({
            name: 'opencode',
            displayName: 'OpenCode',
            cliCommand: 'opencode',
            sessionFileExtension: '.opencode-session',
            statusFileExtension: '.opencode-status',
            settingsFileName: 'opencode.json',
            defaultDataDir: '.opencode'
        });
    }

    // --- File Naming ---

    getSessionFileName(): string {
        return this.config.sessionFileExtension;
    }

    getStatusFileName(): string {
        return this.config.statusFileExtension;
    }

    getSettingsFileName(): string {
        return this.config.settingsFileName;
    }

    getDataDirectory(): string {
        return this.config.defaultDataDir;
    }

    // --- Terminal Configuration ---

    getTerminalName(sessionName: string): string {
        return `OpenCode: ${sessionName}`;
    }

    getTerminalIcon(): { id: string; color?: string } {
        return {
            id: 'terminal',
            color: 'terminal.ansiBlue'
        };
    }

    // --- Command Building ---

    /**
     * Escape a string for safe use in shell single quotes
     * Replaces single quotes with the shell escape sequence '\''
     */
    private escapeForSingleQuotes(str: string): string {
        return str.replace(/'/g, "'\\''");
    }

    /**
     * Validate that a session ID is safe for shell usage
     * OpenCode session IDs should be alphanumeric with hyphens
     * @throws Error if session ID contains unsafe characters
     */
    private validateSessionId(sessionId: string): void {
        const safePattern = /^[a-zA-Z0-9_-]+$/;
        if (!safePattern.test(sessionId)) {
            throw new Error(`Invalid session ID format: ${sessionId}. Expected alphanumeric with hyphens/underscores.`);
        }
    }

    buildStartCommand(options: StartCommandOptions): string {
        const parts: string[] = [this.config.cliCommand, 'run'];

        // Add MCP config first (if OpenCode supports it)
        if (options.mcpConfigPath) {
            const escapedPath = this.escapeForSingleQuotes(options.mcpConfigPath);
            parts.push(`--mcp-config '${escapedPath}'`);
        }

        // Add config file with proper escaping
        if (options.settingsPath) {
            const escapedPath = this.escapeForSingleQuotes(options.settingsPath);
            parts.push(`--config '${escapedPath}'`);
        }

        // Add permission mode flags if not default
        if (options.permissionMode && options.permissionMode !== 'default') {
            const flag = this.getPermissionFlag(options.permissionMode);
            if (flag) {
                parts.push(flag);
            }
        }

        // Add prompt with single quotes and proper escaping
        if (options.prompt) {
            const escapedPrompt = this.escapeForSingleQuotes(options.prompt);
            parts.push(`'${escapedPrompt}'`);
        }

        return parts.join(' ');
    }

    buildResumeCommand(sessionId: string, options: ResumeCommandOptions): string {
        // Validate session ID to prevent command injection
        this.validateSessionId(sessionId);

        const parts: string[] = [this.config.cliCommand];

        // Add MCP config first (if OpenCode supports it)
        if (options.mcpConfigPath) {
            const escapedPath = this.escapeForSingleQuotes(options.mcpConfigPath);
            parts.push(`--mcp-config '${escapedPath}'`);
        }

        // Add config file with proper escaping
        if (options.settingsPath) {
            const escapedPath = this.escapeForSingleQuotes(options.settingsPath);
            parts.push(`--config '${escapedPath}'`);
        }

        // Add session flag (OpenCode uses --session, not --resume)
        // Session ID is already validated at this point
        parts.push(`--session ${sessionId}`);

        return parts.join(' ');
    }

    // --- Session/Status Parsing ---

    /**
     * Pattern for validating session ID format
     * OpenCode session IDs should be alphanumeric with hyphens/underscores
     * This prevents command injection when session ID is used in shell commands
     */
    private static readonly SESSION_ID_PATTERN = /^[a-zA-Z0-9_-]+$/;

    parseSessionData(content: string): SessionData | null {
        try {
            const data = JSON.parse(content);

            // Session ID is required
            if (!data.sessionId || typeof data.sessionId !== 'string') {
                return null;
            }

            // Validate session ID format to prevent command injection
            if (!OpenCodeAgent.SESSION_ID_PATTERN.test(data.sessionId)) {
                return null;
            }

            return {
                sessionId: data.sessionId,
                timestamp: data.timestamp,
                workflow: data.workflow,
                agentName: this.config.name
            };
        } catch {
            return null;
        }
    }

    parseStatus(content: string): AgentStatus | null {
        try {
            const data = JSON.parse(content);

            // Status is required
            if (!data.status || typeof data.status !== 'string') {
                return null;
            }

            return {
                status: data.status,
                timestamp: data.timestamp,
                message: data.message
            };
        } catch {
            return null;
        }
    }

    getValidStatusStates(): string[] {
        return ['working', 'waiting_for_user', 'idle', 'error'];
    }

    // --- Permission Modes ---

    getPermissionModes(): PermissionMode[] {
        return [
            { id: 'default', label: 'Default' },
            { id: 'allowEdits', label: 'Allow Edits', flag: '--permission-edit allow' },
            { id: 'allowBash', label: 'Allow Bash', flag: '--permission-bash allow' },
            { id: 'allowAll', label: 'Allow All', flag: '--permission-edit allow --permission-bash allow' },
            { id: 'askAll', label: 'Ask All', flag: '--permission-edit ask --permission-bash ask' }
        ];
    }

    validatePermissionMode(mode: string): boolean {
        return this.getPermissionModes().some(m => m.id === mode);
    }

    getPermissionFlag(mode: string): string {
        const permissionMode = this.getPermissionModes().find(m => m.id === mode);
        return permissionMode?.flag || '';
    }

    // --- Hooks/Plugins ---

    getHookEvents(): string[] {
        // OpenCode uses plugin events, not hooks
        return ['session.created', 'session.status', 'session.idle', 'message.updated'];
    }

    /**
     * Generate plugin configuration for OpenCode
     * OpenCode uses JavaScript plugins in .opencode/plugin/ directory
     * instead of JSON hooks in settings file
     */
    generateHooksConfig(
        worktreePath: string,
        sessionFilePath: string,
        statusFilePath: string
    ): HookConfig[] {
        // For OpenCode, we generate a JavaScript plugin file
        // The plugin content will be written to .opencode/plugin/lanes-tracker.js

        const pluginContent = `
// Lanes session tracker plugin for OpenCode
// This plugin captures session IDs and tracks status changes

const fs = require('fs');
const path = require('path');

const SESSION_FILE = ${JSON.stringify(sessionFilePath)};
const STATUS_FILE = ${JSON.stringify(statusFilePath)};

// Write status to file
function writeStatus(status) {
    const data = {
        status: status,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(STATUS_FILE, JSON.stringify(data, null, 2));
}

// Write session ID to file (merge with existing data)
function writeSessionId(sessionId) {
    let existingData = {};
    try {
        const content = fs.readFileSync(SESSION_FILE, 'utf8');
        existingData = JSON.parse(content);
    } catch (err) {
        // File doesn't exist or is invalid, start fresh
    }

    const data = {
        ...existingData,
        sessionId: sessionId,
        timestamp: new Date().toISOString()
    };
    fs.writeFileSync(SESSION_FILE, JSON.stringify(data, null, 2));
}

// Export plugin hooks
module.exports = {
    name: 'lanes-tracker',
    version: '1.0.0',

    // Capture session ID when session is created
    'session.created': async (event) => {
        if (event.sessionId) {
            writeSessionId(event.sessionId);
        }
    },

    // Track status changes
    'session.status': async (event) => {
        if (event.status) {
            // Map OpenCode status to Lanes status
            let status = 'idle';
            if (event.status === 'thinking' || event.status === 'running') {
                status = 'working';
            } else if (event.status === 'waiting' || event.status === 'prompt') {
                status = 'waiting_for_user';
            } else if (event.status === 'error') {
                status = 'error';
            }
            writeStatus(status);
        }
    },

    // Mark as idle when session is idle
    'session.idle': async (event) => {
        writeStatus('idle');
    },

    // Update status on message changes (mark as working)
    'message.updated': async (event) => {
        if (event.message && event.message.role === 'assistant') {
            writeStatus('working');
        }
    }
};
`.trim();

        // Return a single hook that writes the plugin file
        // The actual plugin file will be created by the setup process
        const pluginDir = path.join(worktreePath, this.config.defaultDataDir, 'plugin');
        const pluginPath = path.join(pluginDir, 'lanes-tracker.js');

        // Escape paths for safe shell usage
        const escapedPluginDir = this.escapeForSingleQuotes(pluginDir);
        const escapedPluginPath = this.escapeForSingleQuotes(pluginPath);

        return [
            {
                event: 'SetupPlugin',
                commands: [
                    {
                        type: 'command',
                        command: `mkdir -p '${escapedPluginDir}' && cat > '${escapedPluginPath}' << 'PLUGIN_EOF'\n${pluginContent}\nPLUGIN_EOF`
                    }
                ]
            }
        ];
    }

    // --- MCP Support ---

    supportsMcp(): boolean {
        return true;
    }

    /**
     * Get MCP config for OpenCode
     * OpenCode expects MCP servers in the 'mcp' key of opencode.json,
     * not in a separate file like Claude
     */
    getMcpConfig(worktreePath: string, workflowPath: string): McpConfig | null {
        // Get the path to the MCP server (relative to the extension's out directory)
        const mcpServerPath = path.join(__dirname, 'mcp', 'server.js');

        return {
            mcpServers: {
                'lanes-workflow': {
                    command: 'node',
                    args: [mcpServerPath, '--worktree', worktreePath, '--workflow-path', workflowPath]
                }
            }
        };
    }
}
