# Claude Harness

For long-running agent sessions that span multiple context windows, we recommend setting up a **Claude Harness** - a structured approach to task management that helps Claude maintain continuity across sessions.

This pattern is based on Anthropic's research on [Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents).

## Why Use a Harness?

Each new Claude session begins with no memory of what came before. A harness solves this by:

- **Defining scope** - A structured feature list prevents over-ambition and premature completion claims
- **Tracking progress** - Clear pass/fail status for each feature
- **Enabling handoffs** - Fresh sessions can quickly assess the current state

Lanes supports two harness approaches: a simple **features.json** approach for straightforward tasks, and a more sophisticated **MCP Workflow System** for complex, multi-phase development work.

---

## Simple Approach: features.json

For straightforward tasks where you want to track a list of features without complex orchestration, use the features.json approach.

### Setting Up

Add the following instructions to your project's `CLAUDE.md` file (or create one in your repository root):

```markdown
## Task Planning

When starting a new task, create a `features.json` file to track all features:

\`\`\`json
{
  "features": [
    {
      "id": "unique-feature-id",
      "description": "What needs to be implemented",
      "passes": false
    }
  ]
}
\`\`\`

### Rules:
- Break down the user's request into discrete, testable features
- All features start with `passes: false`
- Work on one feature at a time
- Only set `passes: true` after the feature is fully implemented and tested
- Commit changes after completing each feature
- Delete `features.json` when the task is complete
```

### Required Fields

Lanes expects the following structure in `features.json`:

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| `features` | array | Yes | Array of feature objects |
| `features[].id` | string | Yes | Unique identifier for the feature |
| `features[].description` | string | Yes | What needs to be implemented |
| `features[].passes` | boolean | Yes | Whether the feature is complete |

> **Note:** Your harness can include additional fields (e.g., `priority`, `dependencies`, `assignee`) - Lanes only requires the fields listed above. Feel free to extend the schema to suit your workflow.

### Example Workflow

1. **User requests**: "Add user authentication with login and logout"
2. **Claude creates** `features.json`:
   ```json
   {
     "features": [
       { "id": "login-form", "description": "Create login form UI", "passes": false },
       { "id": "auth-api", "description": "Implement authentication API endpoint", "passes": false },
       { "id": "logout", "description": "Add logout functionality", "passes": false },
       { "id": "session-persistence", "description": "Persist user session across page reloads", "passes": false }
     ]
   }
   ```
3. **Claude works** on each feature incrementally, marking `passes: true` as each is completed
4. **On completion**, Claude deletes the file and updates progress notes

---

## MCP Workflow System

For more complex development work that requires structured phases (planning, implementation, testing, review), Lanes provides an MCP (Model Context Protocol) based workflow system.

### What is the Workflow System?

The MCP Workflow System guides Claude through structured development phases using:

- **Workflow Templates** - YAML files that define the sequence of steps
- **Specialized Agents** - Sub-agents with specific roles and tool restrictions
- **Reusable Loops** - Sub-workflows that iterate over tasks
- **MCP Tools** - Functions Claude uses to navigate the workflow

The system automatically syncs workflow progress with `features.json` so you get the benefits of both approaches.

### Key Concepts

#### 1. Workflow Templates

Workflow templates are YAML files that define:
- **Agents** - Specialized roles with allowed/disallowed tools
- **Loops** - Reusable sub-workflows that iterate over tasks
- **Steps** - The main workflow sequence

**Template Locations:**
- Built-in templates: `workflows/` (feature, bugfix, refactor, default)
- Custom templates: `.claude/lanes/workflows/` (appear in VS Code dropdown)

**Example Template Structure:**

```yaml
name: feature
description: Plan and implement a new feature

agents:
  orchestrator:
    description: Plans work and coordinates
    tools: [Read, Glob, Grep, Task]
    cannot: [Write, Edit, Bash, commit]

  implementer:
    description: Writes code
    tools: [Read, Write, Edit, Bash, Glob, Grep]
    cannot: [commit, Task]

loops:
  feature_development:
    - id: implement
      agent: implementer
      instructions: |
        Implement: {task.title}
        ...
    - id: test
      agent: tester
      instructions: ...
    - id: review
      agent: reviewer
      instructions: ...

steps:
  - id: plan
    type: action
    agent: orchestrator
    instructions: Analyze the goal...

  - id: feature_development
    type: loop

  - id: final_review
    type: action
    agent: reviewer
    instructions: ...
```

#### 2. Agents

Agents are specialized roles that execute specific workflow steps. Each agent has:
- A **description** of its role
- A list of **tools** it can use (Read, Write, Edit, Bash, Grep, Glob, Task, commit)
- A list of actions it **cannot** perform

**Built-in Agent Examples:**
- **orchestrator** - Plans work, breaks down tasks, coordinates (cannot modify code)
- **implementer** - Writes code (cannot commit or spawn sub-tasks)
- **tester** - Runs tests and fixes failures (cannot modify feature code)
- **reviewer** - Reviews code quality (cannot modify code directly)

**Agent Field is Optional:** You can omit the `agent:` field on any step or sub-step. When omitted, the main Claude agent handles that step directly instead of delegating to a sub-agent. This is useful for simpler workflows.

```yaml
# With agent (delegated to sub-agent)
- id: implement
  agent: implementer
  instructions: Write the code...

# Without agent (main Claude handles it)
- id: cleanup
  instructions: Clean up temp files...
```

#### 3. Loops and Steps

**Steps** are the main workflow sequence. Each step has:
- **id** - Unique identifier
- **type** - Either `action` (single operation) or `loop` (iterate over tasks)
- **agent** - (optional) Agent to execute the step
- **instructions** - What to do (for action steps)

**Loops** are reusable sub-workflows that iterate over a list of tasks. Each loop contains sub-steps that execute for each task:

```yaml
loops:
  feature_development:
    - id: implement
      agent: implementer
      instructions: |
        Implement: {task.title}
        Description: {task.description}
    - id: test
      agent: tester
      instructions: Run tests for {task.title}
    - id: review
      agent: reviewer
      instructions: Review {task.title}

steps:
  - id: plan
    type: action
    instructions: Break down the goal into tasks

  - id: feature_development  # References the loop above
    type: loop
```

**Task Variables:** Within loop instructions, you can reference:
- `{task.id}` - Task identifier
- `{task.title}` - Task title
- `{task.description}` - Task description

#### 4. MCP Tools

Claude uses these MCP tools to navigate the workflow:

| Tool | Purpose | Usage |
|------|---------|-------|
| `workflow_start` | Initialize workflow | Called with workflow name and optional summary |
| `workflow_set_tasks` | Associate tasks with a loop | Called with loop ID and task list |
| `workflow_status` | Get current position | Returns step, agent, instructions, progress |
| `workflow_advance` | Complete step and move to next | Called with output/summary of current step |
| `workflow_context` | Get outputs from previous steps | Returns record of all step outputs |

**Example Usage Flow:**

```
1. Claude calls workflow_start("feature", "Add user authentication")
   → Returns: "Step 1: plan" with instructions

2. Claude reads code, plans the work
   Claude calls workflow_advance("Planned 3 features: login, logout, session")
   → Returns: "Step 2: define_tasks" with instructions

3. Claude calls workflow_set_tasks("feature_development", [
     {id: "login", title: "Login form", ...},
     {id: "logout", title: "Logout", ...},
     {id: "session", title: "Session persistence", ...}
   ])
   → Returns: "Task 1/3: implement login" with instructions

4. Claude implements the feature
   Claude calls workflow_advance("Implemented login form with validation")
   → Returns: "Task 1/3: test login" with instructions

5. Claude runs tests, fixes issues
   Claude calls workflow_advance("All tests pass")
   → Returns: "Task 1/3: review login" with instructions

... and so on
```

### Built-in Workflow Templates

Lanes includes four built-in workflow templates:

#### 1. feature.yaml
**Purpose:** Plan and implement a new feature

**Phases:**
1. Plan - Analyze goal, break into tasks
2. Define tasks - Create task list
3. Feature development loop (for each task):
   - Implement (implementer agent)
   - Test (tester agent)
   - Review (reviewer agent)
   - Resolution (main agent addresses issues)
4. Final review - Review implementation as a whole
5. Final resolution - Address any final issues

**Best for:** New features, significant additions, multi-part implementations

#### 2. bugfix.yaml
**Purpose:** Diagnose and fix bugs

**Phases:**
1. Diagnose - Identify root cause
2. Plan fixes - Break into discrete fixes
3. Fix loop (for each fix):
   - Implement fix
   - Test
   - Review
   - Resolution
4. Final verification

**Best for:** Bug fixes, issue resolution

#### 3. refactor.yaml
**Purpose:** Improve code quality without changing behavior

**Phases:**
1. Analyze - Identify refactoring opportunities
2. Plan refactors - Break into safe changes
3. Refactor loop (for each change):
   - Implement
   - Test (ensure behavior unchanged)
   - Review
   - Resolution
4. Final verification

**Best for:** Code cleanup, performance improvements, architectural changes

#### 4. default.yaml
**Purpose:** Standard development workflow

**Phases:**
1. Plan - Break down task
2. Implementation loop (for each task):
   - Code (coder agent)
   - Test (test-engineer agent)
   - Review (code-reviewer agent)
3. Cleanup - Finalize and clean up

**Best for:** General development work, simple tasks

### Creating Custom Workflows

To create a custom workflow for your project:

1. **Create the directory structure:**
   ```bash
   mkdir -p .claude/lanes/workflows
   ```

2. **Copy a built-in template as a starting point:**
   ```bash
   cp workflows/feature.yaml .claude/lanes/workflows/my-custom-workflow.yaml
   ```

3. **Customize the workflow:**
   - Edit the `name` and `description`
   - Define or modify agents (tools, restrictions)
   - Adjust the loop steps
   - Modify the main steps sequence

4. **Define corresponding agents (if needed):**
   ```bash
   mkdir -p .claude/agents
   # Create .claude/agents/my-agent.md with agent instructions
   ```

5. **The workflow will appear in VS Code:**
   - Open the Lanes sidebar
   - Click "Start Workflow"
   - Your custom workflow appears in the "Custom" section

**Note:** Agent names in the workflow (in the `agents:` section and `agent:` fields) must match either:
- Inline agent definitions in the workflow file, OR
- Agent files in `.claude/agents/` (e.g., `agent: orchestrator` requires `.claude/agents/orchestrator.md`)

Inline definitions take precedence over external files.

### Workflow State Persistence

The workflow system automatically persists state to `workflow-state.json` in your worktree. This enables:

- **Resume capability** - If Claude crashes or loses context, the workflow can resume
- **Context preservation** - All step outputs are stored and accessible
- **Progress tracking** - Current position, completed tasks, remaining work

The state file is automatically updated after each step and should not be manually edited.

### Integration with features.json

The workflow system automatically syncs with `features.json`:

- When you call `workflow_set_tasks`, tasks are written to `features.json` with `passes: false`
- When a task completes (all loop sub-steps done), the corresponding feature is marked `passes: true`
- The Lanes sidebar shows progress for both features.json and workflow state

This means you get the benefits of both systems: structured workflow guidance AND simple progress tracking.

---

## Progress Tracking with claude-progress.txt

For even better continuity across sessions, add a `claude-progress.txt` file that Claude updates at the end of each session:

```markdown
## Session: 2025-01-15

### Completed
- Implemented login form UI
- Created authentication API endpoint

### Next Steps
- Add logout functionality
- Test session persistence
```

This gives new sessions immediate context about what's been accomplished.

**Recommended Structure:**

```markdown
## Session: [Date]

### Completed
- [What was accomplished]

### Issues Encountered
- [Any blockers or problems]

### Next Steps
- [What should be done next]

### Notes
- [Any additional context]
```

---

## Choosing the Right Approach

| Use Case | Recommended Approach |
|----------|---------------------|
| Simple feature list | features.json |
| Quick bug fixes | features.json |
| Proof of concepts | features.json |
| Complex multi-phase development | MCP Workflow System |
| Large refactors requiring multiple steps | MCP Workflow System |
| Work requiring specialized agents | MCP Workflow System |
| Standardized team workflow | MCP Workflow System (custom template) |

You can also use both: start with features.json for quick work, then graduate to workflows for more complex tasks.

---

## Best Practices

1. **Always use a harness** - Even simple tasks benefit from structured tracking
2. **Break down work into discrete units** - Smaller features/tasks are easier to complete and verify
3. **Update claude-progress.txt at the end of each session** - Future sessions will thank you
4. **Delete ephemeral files when done** - Clean up features.json, tests.json, workflow-state.json
5. **Commit frequently** - Commit after each feature/task completion
6. **Use workflows for consistency** - Create custom workflows for your team's standard processes

---

## Further Reading

- [Anthropic: Effective Harnesses for Long-Running Agents](https://www.anthropic.com/engineering/effective-harnesses-for-long-running-agents)
- [Model Context Protocol (MCP) Specification](https://modelcontextprotocol.io/)
- Lanes Documentation: `CLAUDE.md` in the project root
