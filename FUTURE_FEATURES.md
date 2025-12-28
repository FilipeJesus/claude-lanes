# Claude Lanes - Future Features Roadmap

This document outlines potential features for future development of the Claude Lanes VS Code extension.

---

## Session Management Enhancements

### 1. Session Archiving
**Priority: Medium**

Archive completed sessions without deleting data.

- Move to "Archived" section in sidebar
- Compress worktree to save disk space
- Restore archived sessions on demand
- Export session history (prompts, features, timeline) as markdown

### 2. Session Search & Filtering
**Priority: Medium**

Find sessions quickly as the list grows.

- Text search across session names and prompts
- Filter by status (active, waiting, error, archived)
- Filter by date (created today, this week, etc.)
- Group sessions by branch prefix or tag
- Quick toggle to hide/show completed sessions

### 3. Batch Operations
**Priority: Low**

Manage multiple sessions at once.

- Select multiple sessions with checkboxes
- Bulk delete selected sessions
- Bulk archive sessions
- Create multiple sessions from a list of prompts

---

## Terminal & Claude Integration

### 4. Terminal Recovery & Health Monitoring
**Priority: High**

Automatic recovery when Claude process exits unexpectedly.

- Detect when Claude CLI exits or crashes
- Option to auto-restart with the same session ID
- Health status indicator in sidebar (process running/stopped)
- Notification when Claude needs user input but terminal is hidden

---

## UI & UX Improvements

### 5. Progress Dashboard
**Priority: High**

Visual overview of all session progress.

- Progress bar showing features completed
- Timeline view of session activity
- Time spent per session
- Aggregate metrics (sessions completed this week, etc.)

### 6. Quick Actions Panel
**Priority: Medium**

Frequently used actions in one place.

- Quick resume last session
- Quick create session from clipboard
- Recent sessions list
- Keyboard shortcuts for common actions

### 7. Session Details View
**Priority: Medium**

Expanded view with full session information.

- Full prompt and acceptance criteria
- Features.json progress with checkmarks
- File changes summary
- Terminal output preview
- Quick actions (resume, delete, merge, archive)

### 8. Dark/Light Theme Support
**Priority: Low**

Consistent theming across UI components.

- Match VS Code theme automatically
- Custom accent colors for different session statuses
- High contrast mode support

---

## Multi-Repository Support

### 9. Workspace Folder Support
**Priority: High**

Manage sessions across multiple repos in a workspace.

- Session list grouped by repository
- Create session in any workspace folder
- Cross-repo session templates

### 10. Monorepo Support
**Priority: Medium**

Specialized handling for monorepos.

- Partial worktree (specific packages only)
- Package-specific session templates
- Dependency-aware session creation

---

## Advanced Features

### 11. A/B Session Comparison
**Priority: Medium**

Compare approaches from different sessions.

- Side-by-side diff of two session branches
- Merge best parts from each
- Performance/quality comparison metrics

### 12. Custom Agent Support
**Priority: Low**

Use different AI agents or models.

- Configure alternative Claude models per session
- Support for local LLMs (Ollama, etc.)
- Custom agent commands and flags

---

## Configuration & Customization

### 13. Per-Project Settings
**Priority: Medium**

Different settings per repository.

- Project-specific templates
- Custom worktree location per project
- Default prompts per project

### 14. Keyboard Shortcuts Customization
**Priority: Low**

User-defined keyboard shortcuts.

- Customizable keybindings for all commands
- Vim-style navigation in session list
- Quick session switching shortcuts
