import * as vscode from 'vscode';
import { ExtensionMessage } from '../../shared/types';
import * as diff from 'diff';

export class ManifoldPanel {
    public static currentPanel: ManifoldPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (ManifoldPanel.currentPanel) {
            ManifoldPanel.currentPanel.panel.reveal(column);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'coreasonManifold',
            'CoReason TDA Canvas',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
            }
        );

        ManifoldPanel.currentPanel = new ManifoldPanel(panel, extensionUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'REQUEST_SYNTHESIS') {
                const editor = vscode.window.activeTextEditor;
                if (!editor) {
                    return;
                }

                try {
                    const currentYamlText = editor.document.getText();

                    const response = await fetch('http://localhost:8000/api/v1/predict/topology', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'text/plain'
                        },
                        body: currentYamlText
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }

                    const newYamlText = await response.text();

                    const document = await vscode.workspace.openTextDocument(this.currentUri);
                    const text = document.getText();

                    if (text !== newYamlText) {
                        const edit = new vscode.WorkspaceEdit();
                        const changes = diff.diffLines(text, newYamlText);
                        let currentLine = 0;

                        for (const change of changes) {
                            if (change.added) {
                                edit.insert(document.uri, new vscode.Position(currentLine, 0), change.value);
                            } else if (change.removed) {
                                const linesRemoved = change.count || 0;
                                const range = new vscode.Range(
                                    new vscode.Position(currentLine, 0),
                                    new vscode.Position(currentLine + linesRemoved, 0)
                                );
                                edit.delete(document.uri, range);
                                currentLine += linesRemoved;
                            } else {
                                currentLine += change.count || 0;
                            }
                        }

                        await vscode.workspace.applyEdit(edit);
                    }
                } catch (error) {
                    console.error('Synthesis failed:', error);
                    vscode.window.showErrorMessage('Synthesis Engine Offline');
                }
            }
        }, null, this.disposables);
    }

    public updateCanvas(document: vscode.TextDocument) {
        this.currentUri = document.uri;
        const message: ExtensionMessage = { type: 'YAML_UPDATE', payload: document.getText() };
        this.panel.webview.postMessage(message);
    }

    private update() {
        const webview = this.panel.webview;
        this.panel.webview.html = this.getHtmlForWebview(webview);
    }

    private getHtmlForWebview(webview: vscode.Webview): string {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.js')
        );
        const nonce = Math.random().toString(36).substring(2, 15);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
    <title>CoReason TDA Canvas</title>
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
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
    }

    public dispose() {
        ManifoldPanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}