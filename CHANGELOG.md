# Changelog

All notable changes to the Claude Lanes extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-12-21

### Added

- Initial release
- Create isolated Claude Code sessions via Git worktrees
- Sidebar view for session management
- Dedicated terminal per session
- Session status indicators (waiting/working/error)
- Auto-configured hooks for status updates
- Keyboard shortcut for quick session creation (`Cmd+Shift+C` / `Ctrl+Shift+C`)
- Session persistence across VS Code restarts
- One-click session cleanup (removes worktree, keeps branch)
