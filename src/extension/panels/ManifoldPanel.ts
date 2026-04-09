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
        const editor = vscode.window.activeTextEditor;
        const column = editor ? editor.viewColumn : undefined;

        let targetUri: vscode.Uri | undefined;
        if (editor && (editor.document.languageId === 'yaml' || editor.document.languageId === 'json' || editor.document.fileName.endsWith('.coreason.yaml') || editor.document.fileName.endsWith('.coreason.json'))) {
            targetUri = editor.document.uri;
        }

        if (ManifoldPanel.currentPanel) {
            ManifoldPanel.currentPanel.panel.reveal(column);
            if (targetUri) {
                ManifoldPanel.currentPanel.currentUri = targetUri;
                const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === targetUri?.toString());
                if (doc) ManifoldPanel.currentPanel.updateCanvas(doc);
            }
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

        ManifoldPanel.currentPanel = new ManifoldPanel(panel, extensionUri, targetUri);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, initialUri?: vscode.Uri) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.currentUri = initialUri;

        vscode.window.onDidChangeActiveTextEditor(e => {
            if (e && (e.document.languageId === 'yaml' || e.document.languageId === 'json' || e.document.fileName.endsWith('.coreason.yaml') || e.document.fileName.endsWith('.coreason.json'))) {
                this.currentUri = e.document.uri;
            }
        }, null, this.disposables);

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'READY') {
                if (this.currentUri) {
                    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === this.currentUri?.toString());
                    if (doc) {
                        this.updateCanvas(doc);
                    } else {
                        vscode.workspace.openTextDocument(this.currentUri).then(openedDoc => {
                            this.updateCanvas(openedDoc);
                        });
                    }
                }
                return;
            }

            if (message.type === 'WRITE_DOCUMENT') {
                if (this.currentUri) {
                    const edit = new vscode.WorkspaceEdit();
                    const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === this.currentUri?.toString());
                    if (doc) {
                        const fullRange = new vscode.Range(
                            doc.positionAt(0),
                            doc.positionAt(doc.getText().length)
                        );
                        edit.replace(this.currentUri, fullRange, message.payload);
                        vscode.workspace.applyEdit(edit).then(success => {
                            if (!success) vscode.window.showErrorMessage('Failed to write topology changes back to file.');
                        });
                    }
                }
                return;
            }

            if (message.type === 'REQUEST_SYNTHESIS') {
                const currentUri = this.currentUri;
                if (!currentUri) {
                    vscode.window.showErrorMessage('CoReason Synthesis aborted: No YAML file is linked to this TDA Canvas. Open a topology YAML file first.');
                    return;
                }
                const doc = vscode.workspace.textDocuments.find(d => d.uri.toString() === currentUri.toString());
                if (!doc) {
                    vscode.window.showErrorMessage('CoReason Synthesis aborted: The linked YAML file is no longer open in the editor.');
                    return;
                }

                try {
                    vscode.window.showInformationMessage('CoReason: Igniting DeepInfra Inference Engine...');
                    
                    const currentYamlText = doc.getText();
                    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
                    const userPrompt = message.payload?.user_prompt || "";

                    const response = await fetch(`http://localhost:${port}/api/v1/predict/topology`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({
                            topology: currentYamlText,
                            user_prompt: userPrompt
                        })
                    });

                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    
                    vscode.window.showInformationMessage('CoReason: Synthesis Successful! Morphing document topology...');

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
        const text = document.getText();
        vscode.window.showInformationMessage(`CoReason: Sending YAML_UPDATE payload to Canvas (length: ${text.length})`);
        const message: ExtensionMessage = { type: 'YAML_UPDATE', payload: text };
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
        const styleUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this.extensionUri, 'dist', 'webview.css')
        );
        const nonce = Math.random().toString(36).substring(2, 15);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource} blob:; worker-src blob:;">
    <title>CoReason TDA Canvas</title>
    <link href="${styleUri}" rel="stylesheet" />
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