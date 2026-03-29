import * as vscode from 'vscode';
import { ExtensionMessage } from '../../shared/types';
import * as diff from 'diff';

export class ManifoldPanel {
    public static currentPanel: ManifoldPanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    private currentUri: vscode.Uri | undefined;

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

        const editor = vscode.window.activeTextEditor;
        if (editor && (editor.document.languageId === 'yaml' || editor.document.fileName.endsWith('.coreason.yaml'))) {
            this.currentUri = editor.document.uri;
        }

        vscode.window.onDidChangeActiveTextEditor(e => {
            if (e && (e.document.languageId === 'yaml' || e.document.fileName.endsWith('.coreason.yaml'))) {
                this.currentUri = e.document.uri;
            }
        }, null, this.disposables);

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'REQUEST_SYNTHESIS') {
                const currentUri = this.currentUri;
                if (!currentUri) {
                    return;
                }
                const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === currentUri.toString());
                if (!doc) {
                    return;
                }

                try {
                    const currentYamlText = doc.getText();
                    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;

                    const response = await fetch(`http://localhost:${port}/api/v1/predict/topology`, {
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

                    const document = await vscode.workspace.openTextDocument(currentUri);
                    const text = document.getText();

                    let hasConflict = false;

                    if (text !== currentYamlText) {
                        const userChanges = diff.diffLines(currentYamlText, text);
                        const llmChanges = diff.diffLines(currentYamlText, newYamlText);

                        let originalLineIndex = 0;
                        const userModifiedLines = new Set<number>();
                        for (const change of userChanges) {
                            if (change.added) {
                                userModifiedLines.add(originalLineIndex);
                            } else if (change.removed) {
                                const count = change.count || 0;
                                for (let i = 0; i < count; i++) {
                                    userModifiedLines.add(originalLineIndex + i);
                                }
                                originalLineIndex += count;
                            } else {
                                originalLineIndex += change.count || 0;
                            }
                        }

                        originalLineIndex = 0;
                        for (const change of llmChanges) {
                            if (change.added) {
                                if (userModifiedLines.has(originalLineIndex)) {
                                    hasConflict = true;
                                    break;
                                }
                            } else if (change.removed) {
                                const count = change.count || 0;
                                for (let i = 0; i < count; i++) {
                                    if (userModifiedLines.has(originalLineIndex + i)) {
                                        hasConflict = true;
                                        break;
                                    }
                                }
                                originalLineIndex += count;
                            } else {
                                originalLineIndex += change.count || 0;
                            }
                            if (hasConflict) break;
                        }
                    }

                    if (hasConflict) {
                        vscode.window.showWarningMessage('Synthesis aborted: Document was modified in the exact locations the LLM was targeting.');
                        return;
                    }

                    if (text !== newYamlText) {
                        // Apply patches to correctly map changes onto the potentially shifted lines of `text`.
                        // Using diff.createPatch and diff.applyPatch ensures we don't blindly overwrite user changes.
                        const patch = diff.createPatch(document.fileName, currentYamlText, newYamlText);
                        const patchedText = diff.applyPatch(text, patch);

                        if (patchedText !== false && patchedText !== text) {
                            const edit = new vscode.WorkspaceEdit();
                            const fullRange = new vscode.Range(
                                document.positionAt(0),
                                document.positionAt(text.length)
                            );
                            edit.replace(document.uri, fullRange, patchedText);
                            await vscode.workspace.applyEdit(edit);
                        } else if (patchedText === false) {
                            // If patch application failed, fallback to warning the user
                            vscode.window.showWarningMessage('Synthesis aborted: Unable to cleanly merge changes into the modified document.');
                        }
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