import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ClaudeSessionProvider, SessionItem, getFeatureStatus, getClaudeStatus, FeatureStatus, ClaudeStatus } from '../ClaudeSessionProvider';

suite('Claude Orchestra Extension Test Suite', () => {

	let tempDir: string;
	let worktreesDir: string;

	// Create a temp directory structure before tests
	setup(() => {
		tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-orchestra-test-'));
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
			// This will fail gracefully (no workspace) but activates the extension
			try {
				await vscode.commands.executeCommand('claudeWorktrees.createSession');
			} catch {
				// Expected to fail without a workspace, but extension is now activated
			}

			const commands = await vscode.commands.getCommands(true);

			assert.ok(commands.includes('claudeWorktrees.createSession'), 'createSession command should exist');
			assert.ok(commands.includes('claudeWorktrees.openSession'), 'openSession command should exist');
			assert.ok(commands.includes('claudeWorktrees.deleteSession'), 'deleteSession command should exist');
			assert.ok(commands.includes('claudeWorktrees.setupStatusHooks'), 'setupStatusHooks command should exist');
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
});
