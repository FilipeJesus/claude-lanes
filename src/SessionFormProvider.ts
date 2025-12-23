import * as vscode from 'vscode';

/**
 * Callback type for when the session form is submitted
 */
export type SessionFormSubmitCallback = (name: string, prompt: string, acceptanceCriteria: string) => void;

/**
 * Provides a webview form for creating new Claude sessions.
 * Displays above the session list in the sidebar.
 */
export class SessionFormProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'claudeSessionFormView';

    private _view?: vscode.WebviewView;
    private _onSubmit?: SessionFormSubmitCallback;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    /**
     * Set the callback to be invoked when the form is submitted
     */
    public setOnSubmit(callback: SessionFormSubmitCallback): void {
        this._onSubmit = callback;
    }

    /**
     * Generate a random nonce for Content Security Policy
     */
    private _getNonce(): string {
        let text = '';
        const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        for (let i = 0; i < 32; i++) {
            text += possible.charAt(Math.floor(Math.random() * possible.length));
        }
        return text;
    }

    /**
     * Called when the webview view is resolved (becomes visible)
     */
    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        _context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ): void {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        // Note: Form state is automatically preserved via vscode.getState/setState
        // when the webview is hidden or recreated (e.g., switching tabs, collapsing)

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(message => {
            switch (message.command) {
                case 'createSession':
                    if (this._onSubmit) {
                        this._onSubmit(message.name, message.prompt, message.acceptanceCriteria || '');
                    }
                    // Clear the form after submission
                    this._view?.webview.postMessage({ command: 'clearForm' });
                    break;
            }
        });
    }

    /**
     * Generate the HTML content for the webview form
     */
    private _getHtmlForWebview(webview: vscode.Webview): string {
        const nonce = this._getNonce();
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>New Session</title>
    <style>
        * {
            box-sizing: border-box;
            margin: 0;
            padding: 0;
        }

        body {
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            color: var(--vscode-foreground);
            background-color: var(--vscode-sideBar-background);
            padding: 12px;
        }

        .form-group {
            margin-bottom: 12px;
        }

        label {
            display: block;
            margin-bottom: 4px;
            font-weight: 500;
            color: var(--vscode-foreground);
        }

        input[type="text"],
        textarea {
            width: 100%;
            padding: 6px 8px;
            border: 1px solid var(--vscode-input-border, var(--vscode-widget-border));
            border-radius: 2px;
            background-color: var(--vscode-input-background);
            color: var(--vscode-input-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
        }

        input[type="text"]:focus,
        textarea:focus {
            outline: 1px solid var(--vscode-focusBorder);
            border-color: var(--vscode-focusBorder);
        }

        input[type="text"]::placeholder,
        textarea::placeholder {
            color: var(--vscode-input-placeholderForeground);
        }

        textarea {
            min-height: 80px;
            resize: vertical;
        }

        button {
            width: 100%;
            padding: 8px 12px;
            border: none;
            border-radius: 2px;
            background-color: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            font-family: var(--vscode-font-family);
            font-size: var(--vscode-font-size);
            cursor: pointer;
            font-weight: 500;
        }

        button:hover {
            background-color: var(--vscode-button-hoverBackground);
        }

        button:focus {
            outline: 1px solid var(--vscode-focusBorder);
        }

        button:disabled {
            opacity: 0.5;
            cursor: not-allowed;
        }

        .button-secondary {
            background-color: transparent;
            color: var(--vscode-textLink-foreground);
            border: 1px solid var(--vscode-textLink-foreground);
            margin-bottom: 8px;
        }

        .button-secondary:hover {
            background-color: var(--vscode-textLink-foreground);
            color: var(--vscode-editor-background);
        }

        .hint {
            font-size: 11px;
            color: var(--vscode-descriptionForeground);
            margin-top: 2px;
        }
    </style>
</head>
<body>
    <form id="sessionForm">
        <div class="form-group">
            <label for="name">Session Name</label>
            <input
                type="text"
                id="name"
                name="name"
                placeholder="fix-login-bug"
                required
                autocomplete="off"
            />
            <div class="hint">Used as the Git branch name</div>
        </div>

        <div class="form-group">
            <label for="prompt">Starting Prompt (optional)</label>
            <textarea
                id="prompt"
                name="prompt"
                placeholder="Describe the task for Claude..."
            ></textarea>
            <div class="hint">Sent to Claude after the session starts</div>
        </div>

        <div class="form-group">
            <label for="acceptanceCriteria">Acceptance Criteria (optional)</label>
            <textarea
                id="acceptanceCriteria"
                name="acceptanceCriteria"
                placeholder="Define what success looks like..."
            ></textarea>
            <div class="hint">Criteria for Claude to meet</div>
        </div>

        <button type="button" id="harnessBtn" class="button-secondary">Implement Claude Harness</button>
        <button type="submit" id="submitBtn">Create Session</button>
    </form>

    <script nonce="${nonce}">
        const vscode = acquireVsCodeApi();
        const form = document.getElementById('sessionForm');
        const nameInput = document.getElementById('name');
        const promptInput = document.getElementById('prompt');
        const acceptanceCriteriaInput = document.getElementById('acceptanceCriteria');
        const harnessBtn = document.getElementById('harnessBtn');

        // Predefined content for Claude Harness implementation
        const harnessPrompt = \`I want you to implement a Claude Harness in this repository. A Claude Harness is a structured approach to task management that helps Claude maintain continuity across sessions.

Please add the following harness instructions to the CLAUDE.md file in the repository root (create it if it doesn't exist):

## Task Planning

When starting a new task, create a \\\`features.json\\\` file to track all features:

\\\`\\\`\\\`json
{
  "features": [
    {
      "id": "unique-feature-id",
      "description": "What needs to be implemented",
      "passes": false
    }
  ]
}
\\\`\\\`\\\`

### Rules:
- Break down the user's request into discrete, testable features
- All features start with \\\`passes: false\\\`
- Work on one feature at a time
- Only set \\\`passes: true\\\` after the feature is fully implemented and tested
- Commit changes after completing each feature
- Delete \\\`features.json\\\` when the task is complete

### Progress Tracking

Also add a section for maintaining a progress file:

For better continuity across sessions, maintain a \\\`claude-progress.txt\\\` file that you update at the end of each session:

\\\`\\\`\\\`
## Session: [Date]

### Completed
- [What was accomplished]

### Next Steps
- [What should be done next]
\\\`\\\`\\\`

This gives new sessions immediate context about what's been accomplished.\`;

        const harnessAcceptanceCriteria = \`* CLAUDE.md file exists in repository root with harness instructions
* CLAUDE.md contains Task Planning section with features.json schema
* CLAUDE.md contains Rules section explaining workflow
* CLAUDE.md contains Progress Tracking section explaining claude-progress.txt
* features.json schema includes required fields: features array with id, description, passes\`;

        // Handle harness button click - populates prompt and acceptance criteria
        harnessBtn.addEventListener('click', () => {
            promptInput.value = harnessPrompt;
            acceptanceCriteriaInput.value = harnessAcceptanceCriteria;
            saveState();
        });

        // Restore saved state when webview is recreated
        const previousState = vscode.getState();
        if (previousState) {
            nameInput.value = previousState.name || '';
            promptInput.value = previousState.prompt || '';
            acceptanceCriteriaInput.value = previousState.acceptanceCriteria || '';
        }

        // Save state whenever form values change
        function saveState() {
            vscode.setState({
                name: nameInput.value,
                prompt: promptInput.value,
                acceptanceCriteria: acceptanceCriteriaInput.value
            });
        }

        // Attach change listeners to all form inputs
        nameInput.addEventListener('input', saveState);
        promptInput.addEventListener('input', saveState);
        acceptanceCriteriaInput.addEventListener('input', saveState);

        form.addEventListener('submit', (e) => {
            e.preventDefault();

            const name = nameInput.value.trim();
            const prompt = promptInput.value.trim();
            const acceptanceCriteria = acceptanceCriteriaInput.value.trim();

            if (!name) {
                nameInput.focus();
                return;
            }

            // Send message to extension
            vscode.postMessage({
                command: 'createSession',
                name: name,
                prompt: prompt,
                acceptanceCriteria: acceptanceCriteria
            });
        });

        // Handle messages from extension
        window.addEventListener('message', (event) => {
            const message = event.data;
            switch (message.command) {
                case 'clearForm':
                    nameInput.value = '';
                    promptInput.value = '';
                    acceptanceCriteriaInput.value = '';
                    // Clear saved state after successful submission
                    vscode.setState({
                        name: '',
                        prompt: '',
                        acceptanceCriteria: ''
                    });
                    nameInput.focus();
                    break;
            }
        });
    </script>
</body>
</html>`;
    }
}
