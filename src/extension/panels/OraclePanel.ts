import * as vscode from 'vscode';
import { WebviewMessage } from '../../shared/types';

export class OraclePanel {
    public static currentPanel: OraclePanel | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, workflowId?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (OraclePanel.currentPanel) {
            OraclePanel.currentPanel.panel.reveal(column);
            if (workflowId) {
                const message: WebviewMessage = { type: 'SET_ORACLE_WORKFLOW', payload: workflowId };
                OraclePanel.currentPanel.panel.webview.postMessage(message);
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'coreasonOracle',
            'CoReason Epistemic Oracle',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
            }
        );

        OraclePanel.currentPanel = new OraclePanel(panel, extensionUri, workflowId);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workflowId?: string) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage((message) => {
            if (message.type === 'READY') {
                this.panel.webview.postMessage({ type: 'SET_ROUTE', payload: 'ORACLE' });
                if (workflowId) {
                    this.panel.webview.postMessage({ type: 'SET_ORACLE_WORKFLOW', payload: workflowId });
                }
            }
        }, null, this.disposables);
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
    <title>CoReason Epistemic Oracle</title>
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
        OraclePanel.currentPanel = undefined;

        this.panel.dispose();

        while (this.disposables.length) {
            const x = this.disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}
