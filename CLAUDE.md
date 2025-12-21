# Claude Orchestra - Development Guidelines

## Project Overview

Claude Orchestra is a VS Code extension that manages isolated Claude Code sessions using Git worktrees. Each session gets its own worktree and dedicated terminal.

## Key Files

| File | Purpose |
|------|---------|
| `src/extension.ts` | Main entry point, commands, terminal management |
| `src/ClaudeSessionProvider.ts` | Tree data provider for the sidebar |
| `package.json` | Extension manifest (commands, views, menus, keybindings) |
| `src/test/extension.test.ts` | Test suite |
| `claude-progress.txt` | Session progress tracking (persisted) |
| `features.json` | **Ephemeral** - Created per task, deleted when done |
| `tests.json` | **Ephemeral** - Created per task, deleted when done |

## Task Lifecycle

When a user requests work, follow this complete lifecycle:

### 1. Task Setup

Create ephemeral tracking files:

**features.json** - Break down the user's request into discrete features:
```json
{
  "features": [
    {
      "id": "feature-id",
      "description": "What needs to be implemented",
      "passes": false
    }
  ]
}
```

**tests.json** - Plan tests for each feature (empty initially, populated by coder):
```json
{
  "planned": []
}
```

### 2. For Each Feature

Execute this loop for each feature in `features.json`:

1. **coder** → Creates test plan in `tests.json`, then implements the feature
2. **test-engineer** → Implements tests from `tests.json`
3. **code-reviewer** → Reviews the implementation
4. Mark feature as `"passes": true` in `features.json`
5. Commit changes

### 3. Task Cleanup

When all features pass and user is satisfied:
- Delete `features.json`
- Delete `tests.json`
- Update `claude-progress.txt` with session summary

## Development Workflow (Detailed)

### 1. Plan & Create Tracking Files

When user requests a task:
- Understand the requirements fully
- Create `features.json` with all features needed (all `passes: false`)
- Create empty `tests.json`
- Use TodoWrite to track progress

### 2. Implement (per feature)

Delegate to the **coder** agent:
```
Use the coder agent to: implement [feature from features.json]
```

The coder agent will:
1. Plan tests first → update `tests.json`
2. Implement the feature
3. Consult `vscode-expert` for VS Code API logic
4. Consult `shell-ops` for git/shell operations

### 3. Test (per feature)

Delegate to the **test-engineer** agent:
```
Use the test-engineer agent to: implement tests from tests.json
```

The test-engineer will:
- Read `tests.json` for planned test cases
- Implement the tests
- Run tests and verify they pass
- Mark tests as `implemented: true`

### 4. Review (per feature)

Delegate to the **code-reviewer** agent:
```
Use the code-reviewer agent to: review changes for [feature]
```

### 5. Mark Complete

- Update `features.json`: set `passes: true` for the feature
- Run `npm test` to verify all tests pass
- Commit with descriptive message

### 6. Cleanup (when task is done)

When user confirms satisfaction:
```bash
rm features.json tests.json
```

Update `claude-progress.txt` with session summary.

## Ephemeral File Formats

### features.json

```json
{
  "features": [
    {
      "id": "unique-id",
      "description": "What to implement",
      "passes": false
    }
  ]
}
```

**Rules**:
- Created fresh for each user task
- All features start with `passes: false`
- Only modify `passes` field during implementation
- Delete when task is complete

### tests.json

```json
{
  "planned": [
    {
      "id": "test-id",
      "description": "What the test verifies",
      "file": "src/test/extension.test.ts",
      "suite": "Suite name",
      "priority": "critical|high|medium|low",
      "acceptance_criteria": ["Given X, when Y, then Z"],
      "implemented": false
    }
  ]
}
```

**Rules**:
- Created by coder agent before implementation
- Test-engineer implements tests and marks `implemented: true`
- Delete when task is complete

## Agent Summary

| Agent | Purpose | When to Use |
|-------|---------|-------------|
| `coder` | Plan tests + implement features | Each coding task |
| `vscode-expert` | VS Code API verification | Called by coder |
| `shell-ops` | Git/shell safety checks | Called by coder |
| `test-engineer` | Implement planned tests | After each feature |
| `code-reviewer` | Code quality review | After tests pass |

## Workflow Diagram

```
┌─────────────────────────────────────────────────────────┐
│                   USER REQUEST                          │
└─────────────────────┬───────────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│              1. CREATE TRACKING FILES                   │
│         features.json (all passes: false)               │
│         tests.json (empty)                              │
└─────────────────────┬───────────────────────────────────┘
                      │
        ┌─────────────────────────────┐
        │  For each feature:          │
        │                             │
        │  ┌───────────────────────┐  │
        │  │   2. coder agent      │  │
        │  │   (plan tests.json +  │  │
        │  │    implement)         │  │
        │  └───────────┬───────────┘  │
        │              │              │
        │              ▼              │
        │  ┌───────────────────────┐  │
        │  │  3. test-engineer     │  │
        │  │  (implement tests     │  │
        │  │   from tests.json)    │  │
        │  └───────────┬───────────┘  │
        │              │              │
        │              ▼              │
        │  ┌───────────────────────┐  │
        │  │  4. code-reviewer     │  │
        │  │  (quality review)     │  │
        │  └───────────┬───────────┘  │
        │              │              │
        │              ▼              │
        │  ┌───────────────────────┐  │
        │  │  5. mark passes:true  │  │
        │  │  + commit             │  │
        │  └───────────────────────┘  │
        │                             │
        └─────────────────────────────┘
                      │
                      ▼
┌─────────────────────────────────────────────────────────┐
│                  6. CLEANUP                             │
│    rm features.json tests.json                          │
│    update claude-progress.txt                           │
└─────────────────────────────────────────────────────────┘
```

## Progress Tracking (Persisted)

### claude-progress.txt

Update at the end of each session:

```
## Session: [Date]

### Completed
- [What was accomplished]

### Next Steps
- [What should be done next]
```

## Constraints

- Always run tests before committing: `npm test`
- Pre-commit hook enforces: compile, lint, and test
- Never commit code that breaks existing tests
- Keep changes focused and minimal
- Delete ephemeral files when task is complete

## Common Commands

```bash
# Development
npm run compile          # Compile TypeScript
npm run watch           # Watch mode
npm run lint            # Run ESLint
npm test                # Run full test suite

# Debugging
# Press F5 in VS Code to launch Extension Development Host
```
