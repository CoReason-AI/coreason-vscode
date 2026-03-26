import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Extension Test Suite', () => {
    vscode.window.showInformationMessage('Start all tests.');

    test('Extension should be present', () => {
        const ext = vscode.extensions.getExtension('coreason.coreason-vscode');
        assert.ok(ext);
    });

    test('Commands should be registered', async () => {
        const ext = vscode.extensions.getExtension('coreason.coreason-vscode');
        if (ext) {
            await ext.activate();
            const commands = await vscode.commands.getCommands(true);
            assert.ok(commands.includes('coreason.openManifold'));
            assert.ok(commands.includes('coreason.openForge'));
        } else {
            assert.fail('Extension coreason.coreason-vscode not found');
        }
    });
});