import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ClaudeSessionProvider, SessionItem, getFeatureStatus, getClaudeStatus, FeatureStatus, ClaudeStatus } from '../ClaudeSessionProvider';
import { SessionFormProvider } from '../SessionFormProvider';

suite('Claude Lanes Extension Test Suite', () => {

	let tempDir: string;
	let worktreesDir: string;

	// Create a temp directory structure before tests
	setup(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-lanes-test-'));
		worktreesDir = path.join(tempDir, '.worktrees');
	});

	// Clean up after each test
	teardown(() => {
		fs.rmSync(tempDir, { recursive: true, force: true });
	});

	suite('SessionItem', () => {

		test('should create item with correct label and path', () => {
			const item = new SessionItem(
				'test-session',
				'/path/to/worktree',
				vscode.TreeItemCollapsibleState.None
			);

			assert.strictEqual(item.label, 'test-session');
			assert.strictEqual(item.worktreePath, '/path/to/worktree');
		});

		test('should have correct tooltip', () => {
			const item = new SessionItem(
				'my-session',
				'/some/path',
				vscode.TreeItemCollapsibleState.None
			);

			assert.strictEqual(item.tooltip, 'Path: /some/path');
		});

		test('should have "Active" description', () => {
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None
			);

			assert.strictEqual(item.description, 'Active');
		});

		test('should have git-branch icon', () => {
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None
			);

			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			assert.strictEqual((item.iconPath as vscode.ThemeIcon).id, 'git-branch');
		});

		test('should have openSession command attached', () => {
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None
			);

			assert.ok(item.command);
			assert.strictEqual(item.command.command, 'claudeWorktrees.openSession');
			assert.deepStrictEqual(item.command.arguments, [item]);
		});

		test('should have sessionItem context value', () => {
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None
			);

			assert.strictEqual(item.contextValue, 'sessionItem');
		});

		test('should show feature ID when current feature exists', () => {
			const featureStatus: FeatureStatus = {
				currentFeature: { id: 'feature-abc', description: 'Test feature', passes: false },
				allComplete: false
			};
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				featureStatus
			);

			assert.strictEqual(item.description, 'feature-abc');
		});

		test('should show "Complete" when allComplete is true', () => {
			const featureStatus: FeatureStatus = {
				currentFeature: null,
				allComplete: true
			};
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				featureStatus
			);

			assert.strictEqual(item.description, 'Complete');
		});

		test('should show "Active" when no features (featureStatus with no current and not complete)', () => {
			const featureStatus: FeatureStatus = {
				currentFeature: null,
				allComplete: false
			};
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				featureStatus
			);

			assert.strictEqual(item.description, 'Active');
		});
	});

	suite('getFeatureStatus', () => {

		test('should return first incomplete feature', () => {
			const featuresJson = {
				features: [
					{ id: 'feature-1', description: 'First feature', passes: false },
					{ id: 'feature-2', description: 'Second feature', passes: false }
				]
			};
			fs.writeFileSync(path.join(tempDir, 'features.json'), JSON.stringify(featuresJson));

			const result = getFeatureStatus(tempDir);

			assert.ok(result.currentFeature);
			assert.strictEqual(result.currentFeature.id, 'feature-1');
			assert.strictEqual(result.allComplete, false);
		});

		test('should return null when all features are complete with allComplete true', () => {
			const featuresJson = {
				features: [
					{ id: 'feature-1', description: 'First feature', passes: true },
					{ id: 'feature-2', description: 'Second feature', passes: true }
				]
			};
			fs.writeFileSync(path.join(tempDir, 'features.json'), JSON.stringify(featuresJson));

			const result = getFeatureStatus(tempDir);

			assert.strictEqual(result.currentFeature, null);
			assert.strictEqual(result.allComplete, true);
		});

		test('should return null when features.json does not exist', () => {
			// tempDir exists but has no features.json
			const result = getFeatureStatus(tempDir);

			assert.strictEqual(result.currentFeature, null);
			assert.strictEqual(result.allComplete, false);
		});

		test('should return null for invalid JSON (graceful fallback)', () => {
			fs.writeFileSync(path.join(tempDir, 'features.json'), 'not valid json {{{');

			const result = getFeatureStatus(tempDir);

			assert.strictEqual(result.currentFeature, null);
			assert.strictEqual(result.allComplete, false);
		});

		test('should return null for empty features array', () => {
			const featuresJson = { features: [] };
			fs.writeFileSync(path.join(tempDir, 'features.json'), JSON.stringify(featuresJson));

			const result = getFeatureStatus(tempDir);

			assert.strictEqual(result.currentFeature, null);
			assert.strictEqual(result.allComplete, false);
		});

		test('should skip completed features and return first incomplete', () => {
			const featuresJson = {
				features: [
					{ id: 'feature-1', description: 'First', passes: true },
					{ id: 'feature-2', description: 'Second', passes: false },
					{ id: 'feature-3', description: 'Third', passes: false }
				]
			};
			fs.writeFileSync(path.join(tempDir, 'features.json'), JSON.stringify(featuresJson));

			const result = getFeatureStatus(tempDir);

			assert.ok(result.currentFeature);
			assert.strictEqual(result.currentFeature.id, 'feature-2');
		});
	});

	suite('ClaudeSessionProvider', () => {

		test('should return empty array when workspace is undefined', async () => {
			const provider = new ClaudeSessionProvider(undefined);
			const children = await provider.getChildren();

			assert.deepStrictEqual(children, []);
		});

		test('should return empty array when .worktrees folder does not exist', async () => {
			const provider = new ClaudeSessionProvider(tempDir);
			const children = await provider.getChildren();

			assert.deepStrictEqual(children, []);
		});

		test('should return empty array when .worktrees folder is empty', async () => {
			fs.mkdirSync(worktreesDir);

			const provider = new ClaudeSessionProvider(tempDir);
			const children = await provider.getChildren();

			assert.deepStrictEqual(children, []);
		});

		test('should discover sessions in .worktrees folder', async () => {
			fs.mkdirSync(worktreesDir);
			fs.mkdirSync(path.join(worktreesDir, 'session-one'));
			fs.mkdirSync(path.join(worktreesDir, 'session-two'));

			const provider = new ClaudeSessionProvider(tempDir);
			const children = await provider.getChildren();

			assert.strictEqual(children.length, 2);

			const labels = children.map(c => c.label).sort();
			assert.deepStrictEqual(labels, ['session-one', 'session-two']);
		});

		test('should ignore files in .worktrees folder (only directories)', async () => {
			fs.mkdirSync(worktreesDir);
			fs.mkdirSync(path.join(worktreesDir, 'valid-session'));
			fs.writeFileSync(path.join(worktreesDir, 'not-a-session.txt'), 'test');

			const provider = new ClaudeSessionProvider(tempDir);
			const children = await provider.getChildren();

			assert.strictEqual(children.length, 1);
			assert.strictEqual(children[0].label, 'valid-session');
		});

		test('should set correct worktreePath on discovered sessions', async () => {
			fs.mkdirSync(worktreesDir);
			fs.mkdirSync(path.join(worktreesDir, 'my-session'));

			const provider = new ClaudeSessionProvider(tempDir);
			const children = await provider.getChildren();

			assert.strictEqual(children[0].worktreePath, path.join(worktreesDir, 'my-session'));
		});

		test('should return empty array for child elements (flat list)', async () => {
			fs.mkdirSync(worktreesDir);
			fs.mkdirSync(path.join(worktreesDir, 'session'));

			const provider = new ClaudeSessionProvider(tempDir);
			const sessions = await provider.getChildren();

			// Asking for children of a session should return empty
			const children = await provider.getChildren(sessions[0]);
			assert.deepStrictEqual(children, []);
		});

		test('getTreeItem should return the same item', () => {
			const provider = new ClaudeSessionProvider(tempDir);
			const item = new SessionItem('test', '/path', vscode.TreeItemCollapsibleState.None);

			assert.strictEqual(provider.getTreeItem(item), item);
		});

		test('refresh should fire onDidChangeTreeData event', (done) => {
			const provider = new ClaudeSessionProvider(tempDir);

			provider.onDidChangeTreeData(() => {
				done();
			});

			provider.refresh();
		});

		test('should show current feature in session description (integration)', async () => {
			// Create worktrees directory with a session
			fs.mkdirSync(worktreesDir);
			const sessionPath = path.join(worktreesDir, 'test-session');
			fs.mkdirSync(sessionPath);

			// Create features.json with an incomplete feature in the session worktree
			const featuresJson = {
				features: [
					{ id: 'impl-feature-x', description: 'Implement feature X', passes: false },
					{ id: 'impl-feature-y', description: 'Implement feature Y', passes: false }
				]
			};
			fs.writeFileSync(path.join(sessionPath, 'features.json'), JSON.stringify(featuresJson));

			const provider = new ClaudeSessionProvider(tempDir);
			const children = await provider.getChildren();

			assert.strictEqual(children.length, 1);
			assert.strictEqual(children[0].label, 'test-session');
			assert.strictEqual(children[0].description, 'impl-feature-x');
		});
	});

	suite('Extension Activation', () => {

		test('extension should be present', () => {
			// Extension ID format is publisher.name, may not be available in test environment
			// This is more of a smoke test that the test harness works
			assert.ok(vscode.extensions !== undefined);
		});

		test('commands should be registered after activation', async () => {
			// Trigger extension activation by executing one of its commands
			// Using openSession with no args - it will fail gracefully but activates the extension
			try {
				await vscode.commands.executeCommand('claudeWorktrees.openSession');
			} catch {
				// Expected to fail without proper args, but extension is now activated
			}

			const commands = await vscode.commands.getCommands(true);

			assert.ok(commands.includes('claudeWorktrees.createSession'), 'createSession command should exist');
			assert.ok(commands.includes('claudeWorktrees.openSession'), 'openSession command should exist');
			assert.ok(commands.includes('claudeWorktrees.deleteSession'), 'deleteSession command should exist');
			assert.ok(commands.includes('claudeWorktrees.setupStatusHooks'), 'setupStatusHooks command should exist');
		});

		test('SessionFormProvider webview should be registered', async () => {
			// Trigger extension activation
			try {
				await vscode.commands.executeCommand('claudeWorktrees.openSession');
			} catch {
				// Expected to fail without proper args, but extension is now activated
			}

			// The webview view is registered with the viewType 'claudeSessionFormView'
			// We can verify this by checking that the SessionFormProvider's viewType matches
			// what is expected in package.json
			assert.strictEqual(
				SessionFormProvider.viewType,
				'claudeSessionFormView',
				'SessionFormProvider should use the correct view type'
			);

			// Note: VS Code does not expose a way to query registered webview views directly.
			// The best we can do is verify the viewType constant matches what's in package.json
			// and trust that the extension.ts registers it correctly.
		});
	});

	suite('getClaudeStatus', () => {

		test('should return correct status for valid waiting_for_user .claude-status file', () => {
			// Arrange: Create a .claude-status file with waiting_for_user status
			const statusData = { status: 'waiting_for_user' };
			fs.writeFileSync(path.join(tempDir, '.claude-status'), JSON.stringify(statusData));

			// Act
			const result = getClaudeStatus(tempDir);

			// Assert
			assert.ok(result, 'Result should not be null');
			assert.strictEqual(result.status, 'waiting_for_user');
		});

		test('should return correct status for valid working .claude-status file', () => {
			// Arrange: Create a .claude-status file with working status
			const statusData = { status: 'working' };
			fs.writeFileSync(path.join(tempDir, '.claude-status'), JSON.stringify(statusData));

			// Act
			const result = getClaudeStatus(tempDir);

			// Assert
			assert.ok(result, 'Result should not be null');
			assert.strictEqual(result.status, 'working');
		});

		test('should return null when .claude-status file does not exist', () => {
			// Arrange: tempDir exists but has no .claude-status file

			// Act
			const result = getClaudeStatus(tempDir);

			// Assert
			assert.strictEqual(result, null);
		});

		test('should return null for invalid JSON in .claude-status', () => {
			// Arrange: Create a .claude-status file with invalid JSON
			fs.writeFileSync(path.join(tempDir, '.claude-status'), 'not valid json {{{');

			// Act
			const result = getClaudeStatus(tempDir);

			// Assert
			assert.strictEqual(result, null);
		});

		test('should return null when status field is not a valid value', () => {
			// Arrange: Create a .claude-status file with invalid status value
			const statusData = { status: 'invalid' };
			fs.writeFileSync(path.join(tempDir, '.claude-status'), JSON.stringify(statusData));

			// Act
			const result = getClaudeStatus(tempDir);

			// Assert
			assert.strictEqual(result, null);
		});

		test('should correctly parse optional timestamp and message fields', () => {
			// Arrange: Create a .claude-status file with all fields
			const statusData = {
				status: 'waiting_for_user',
				timestamp: '2025-12-21T10:30:00Z',
				message: 'Waiting for user confirmation'
			};
			fs.writeFileSync(path.join(tempDir, '.claude-status'), JSON.stringify(statusData));

			// Act
			const result = getClaudeStatus(tempDir);

			// Assert
			assert.ok(result, 'Result should not be null');
			assert.strictEqual(result.status, 'waiting_for_user');
			assert.strictEqual(result.timestamp, '2025-12-21T10:30:00Z');
			assert.strictEqual(result.message, 'Waiting for user confirmation');
		});
	});

	suite('SessionItem Visual Indicators', () => {

		test('should display bell icon with yellow color for waiting_for_user status', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'waiting_for_user' };

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				claudeStatus
			);

			// Assert
			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			const themeIcon = item.iconPath as vscode.ThemeIcon;
			assert.strictEqual(themeIcon.id, 'bell');
			assert.ok(themeIcon.color, 'Icon should have a color');
		});

		test('should display sync~spin icon for working status', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'working' };

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				claudeStatus
			);

			// Assert
			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			const themeIcon = item.iconPath as vscode.ThemeIcon;
			assert.strictEqual(themeIcon.id, 'sync~spin');
		});

		test('should display error icon with red color for error status', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'error' };

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				claudeStatus
			);

			// Assert
			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			const themeIcon = item.iconPath as vscode.ThemeIcon;
			assert.strictEqual(themeIcon.id, 'error');
			assert.ok(themeIcon.color, 'Icon should have a color');
		});

		test('should display git-branch icon for idle status', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'idle' };

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				claudeStatus
			);

			// Assert
			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			const themeIcon = item.iconPath as vscode.ThemeIcon;
			assert.strictEqual(themeIcon.id, 'git-branch');
		});

		test('should display git-branch icon when claudeStatus is null', () => {
			// Arrange & Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				null
			);

			// Assert
			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			const themeIcon = item.iconPath as vscode.ThemeIcon;
			assert.strictEqual(themeIcon.id, 'git-branch');
		});

		test('should display "Waiting for input" description for waiting_for_user status without feature', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'waiting_for_user' };

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				claudeStatus
			);

			// Assert
			assert.strictEqual(item.description, 'Waiting for input');
		});

		test('should display "Waiting - {feature-id}" for waiting_for_user status with current feature', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'waiting_for_user' };
			const featureStatus: FeatureStatus = {
				currentFeature: { id: 'feature-abc', description: 'Test feature', passes: false },
				allComplete: false
			};

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				featureStatus,
				claudeStatus
			);

			// Assert
			assert.strictEqual(item.description, 'Waiting - feature-abc');
		});

		test('should display "Working..." description for working status without feature', () => {
			// Arrange
			const claudeStatus: ClaudeStatus = { status: 'working' };

			// Act
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				undefined,
				claudeStatus
			);

			// Assert
			assert.strictEqual(item.description, 'Working...');
		});

		test('should work correctly when claudeStatus is undefined (backwards compatibility)', () => {
			// Arrange
			const featureStatus: FeatureStatus = {
				currentFeature: { id: 'legacy-feature', description: 'Legacy feature', passes: false },
				allComplete: false
			};

			// Act: Note: claudeStatus parameter is not passed (undefined)
			const item = new SessionItem(
				'session',
				'/path',
				vscode.TreeItemCollapsibleState.None,
				featureStatus
			);

			// Assert: Should behave as before - git-branch icon and feature-based description
			assert.ok(item.iconPath instanceof vscode.ThemeIcon);
			const themeIcon = item.iconPath as vscode.ThemeIcon;
			assert.strictEqual(themeIcon.id, 'git-branch');
			assert.strictEqual(item.description, 'legacy-feature');
		});
	});

	suite('SessionFormProvider', () => {

		let tempDir: string;
		let extensionUri: vscode.Uri;

		setup(() => {
			tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'session-form-test-'));
			extensionUri = vscode.Uri.file(tempDir);
		});

		teardown(() => {
			fs.rmSync(tempDir, { recursive: true, force: true });
		});

		/**
		 * Helper to create a mock WebviewView for testing
		 */
		function createMockWebviewView(): {
			webviewView: vscode.WebviewView;
			capturedHtml: { value: string };
			messageHandler: { callback: ((message: unknown) => void) | null };
			postMessageSpy: { messages: unknown[] };
		} {
			const capturedHtml = { value: '' };
			const messageHandler: { callback: ((message: unknown) => void) | null } = { callback: null };
			const postMessageSpy: { messages: unknown[] } = { messages: [] };

			const mockWebview = {
				options: {} as vscode.WebviewOptions,
				html: '',
				onDidReceiveMessage: (callback: (message: unknown) => void) => {
					messageHandler.callback = callback;
					return { dispose: () => { messageHandler.callback = null; } };
				},
				postMessage: (message: unknown) => {
					postMessageSpy.messages.push(message);
					return Promise.resolve(true);
				},
				asWebviewUri: (uri: vscode.Uri) => uri,
				cspSource: 'test-csp-source'
			};

			// Create a proxy to capture html assignment
			const webviewProxy = new Proxy(mockWebview, {
				set(target, prop, value) {
					if (prop === 'html') {
						capturedHtml.value = value as string;
					}
					(target as Record<string, unknown>)[prop as string] = value;
					return true;
				},
				get(target, prop) {
					return (target as Record<string, unknown>)[prop as string];
				}
			});

			const mockWebviewView = {
				webview: webviewProxy as unknown as vscode.Webview,
				viewType: 'claudeSessionFormView',
				title: undefined,
				description: undefined,
				badge: undefined,
				visible: true,
				onDidDispose: () => ({ dispose: () => {} }),
				onDidChangeVisibility: () => ({ dispose: () => {} }),
				show: () => {}
			} as unknown as vscode.WebviewView;

			return { webviewView: mockWebviewView, capturedHtml, messageHandler, postMessageSpy };
		}

		test('should render HTML form with name input field', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, capturedHtml } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			// Assert
			assert.ok(capturedHtml.value.includes('id="name"'), 'HTML should contain input field with id="name"');
			assert.ok(capturedHtml.value.includes('type="text"'), 'Name input should be of type text');
		});

		test('should render HTML form with prompt textarea', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, capturedHtml } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			// Assert
			assert.ok(capturedHtml.value.includes('id="prompt"'), 'HTML should contain textarea with id="prompt"');
			assert.ok(capturedHtml.value.includes('<textarea'), 'HTML should contain a textarea element');
		});

		test('should render HTML form with submit button', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, capturedHtml } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			// Assert
			assert.ok(capturedHtml.value.includes('type="submit"'), 'HTML should contain a submit button');
			assert.ok(capturedHtml.value.includes('Create Session'), 'Submit button should have "Create Session" text');
		});

		test('should use VS Code CSS variables for theming', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, capturedHtml } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			// Assert
			assert.ok(
				capturedHtml.value.includes('--vscode-input-background'),
				'HTML should use VS Code CSS variable --vscode-input-background'
			);
			assert.ok(
				capturedHtml.value.includes('--vscode-button-background'),
				'HTML should use VS Code CSS variable --vscode-button-background'
			);
			assert.ok(
				capturedHtml.value.includes('--vscode-foreground'),
				'HTML should use VS Code CSS variable --vscode-foreground'
			);
		});

		test('should invoke onSubmit callback when createSession message is received', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, messageHandler } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			let capturedName = '';
			let capturedPrompt = '';

			provider.setOnSubmit((name, prompt) => {
				capturedName = name;
				capturedPrompt = prompt;
			});

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			// Simulate webview posting a createSession message
			assert.ok(messageHandler.callback, 'Message handler should be registered');
			messageHandler.callback({
				command: 'createSession',
				name: 'test-session',
				prompt: 'Fix the bug in login.ts'
			});

			// Assert
			assert.strictEqual(capturedName, 'test-session', 'Callback should receive the session name');
			assert.strictEqual(capturedPrompt, 'Fix the bug in login.ts', 'Callback should receive the prompt');
		});

		test('should post clearForm message after successful submission', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, messageHandler, postMessageSpy } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			provider.setOnSubmit(() => {
				// Empty callback
			});

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			assert.ok(messageHandler.callback, 'Message handler should be registered');
			messageHandler.callback({
				command: 'createSession',
				name: 'my-session',
				prompt: ''
			});

			// Assert
			assert.strictEqual(postMessageSpy.messages.length, 1, 'Should post one message after submission');
			assert.deepStrictEqual(
				postMessageSpy.messages[0],
				{ command: 'clearForm' },
				'Should post clearForm command'
			);
		});

		test('should handle createSession message without onSubmit callback set', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView, messageHandler } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			// Note: NOT setting onSubmit callback

			// Act & Assert - should not throw
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			assert.ok(messageHandler.callback, 'Message handler should be registered');
			const callback = messageHandler.callback;
			assert.doesNotThrow(() => {
				callback({
					command: 'createSession',
					name: 'test-session',
					prompt: 'Some prompt'
				});
			}, 'Should handle message gracefully when no callback is set');
		});

		test('should have correct viewType static property', () => {
			// Assert
			assert.strictEqual(
				SessionFormProvider.viewType,
				'claudeSessionFormView',
				'viewType should be claudeSessionFormView'
			);
		});

		test('should enable scripts in webview options', () => {
			// Arrange
			const provider = new SessionFormProvider(extensionUri);
			const { webviewView } = createMockWebviewView();
			const mockContext = {} as vscode.WebviewViewResolveContext;
			const mockToken = new vscode.CancellationTokenSource().token;

			// Act
			provider.resolveWebviewView(webviewView, mockContext, mockToken);

			// Assert
			assert.strictEqual(
				webviewView.webview.options.enableScripts,
				true,
				'Webview should have scripts enabled'
			);
		});
	});
});
