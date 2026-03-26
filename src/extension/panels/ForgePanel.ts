import * as vscode from 'vscode';
import { WebviewMessage } from '../../shared/types';

export class ForgePanel {
    public static currentPanel: ForgePanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ForgePanel.currentPanel) {
            ForgePanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'coreasonForge',
            'CoReason Capability Forge',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
            }
        );

        ForgePanel.currentPanel = new ForgePanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'READY') {
                this.panel.webview.postMessage({ type: 'SET_ROUTE', payload: 'FORGE' });
            } else if (message.type === 'CRYSTALLIZE_TEST') {
                await this.crystallizeTest(message.payload);
            }
        }, null, this.disposables);
    }

    private escapeForPythonJsonLoads(str: string): string {
        return JSON.stringify(str).slice(1, -1).replace(/'/g, "\\'");
    }

    private async crystallizeTest(payload: { capability: string; state: string; intent: string; output: string }) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders || workspaceFolders.length === 0) {
            vscode.window.showErrorMessage('No workspace folder open. Cannot crystallize test.');
            return;
        }

        const rootUri = workspaceFolders[0].uri;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `test_capability_${payload.capability}_${timestamp}.py`;
        const testUri = vscode.Uri.joinPath(rootUri, 'tests', 'sandbox', fileName);

        const safeState = this.escapeForPythonJsonLoads(payload.state);
        const safeIntent = this.escapeForPythonJsonLoads(payload.intent);
        const safeOutput = this.escapeForPythonJsonLoads(payload.output);

        const fileContent = `import pytest
import json

def test_${payload.capability}_crystallized():
    # Latent State Context
    latent_state = json.loads('${safeState}')

    # Execution Intent
    intent = json.loads('${safeIntent}')

    # Expected Output
    expected_output = json.loads('${safeOutput}')

    # TODO: Implement actual sandbox execution assertion here
    # result = execute_capability("${payload.capability}", latent_state, intent)
    # assert result == expected_output

    assert True
`;

        const edit = new vscode.WorkspaceEdit();
        edit.createFile(testUri, { ignoreIfExists: false });
        edit.insert(testUri, new vscode.Position(0, 0), fileContent);

        try {
            await vscode.workspace.applyEdit(edit);
            vscode.window.showInformationMessage('✨ Epistemic Proof Crystallized.');
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to crystallize proof: ${error}`);
        }
    }

    private update() {
        const webview = this.panel.webview;
        this.panel.webview.html = this.getHtmlForWebview(webview);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
        );

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta http-equiv="Content-Security-Policy" content="connect-src http://localhost:8000;">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CoReason Capability Forge</title>
    <style>
        html, body {
            margin: 0;
            padding: 0;
            width: 100vw;
            height: 100vh;
            overflow: hidden;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        #root {
            width: 100%;
            height: 100%;
        }
    </style>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose() {
        ForgePanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}