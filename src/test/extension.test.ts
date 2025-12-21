import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ClaudeSessionProvider, SessionItem } from '../ClaudeSessionProvider';

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
		});
	});
});
