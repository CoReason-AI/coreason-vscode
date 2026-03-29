import * as vscode from 'vscode';
import { WebviewMessage } from '../../shared/types';
import { TelemetryClient } from '../network/telemetryClient';

export class OraclePanel {
    public static currentPanel: OraclePanel | undefined;
    public static telemetryClient: TelemetryClient | undefined;
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    private _isReady: boolean = false;
    private _isOracleReady: boolean = false;
    private _messageQueue: any[] = [];

    public static createOrShow(extensionUri: vscode.Uri, workflowId?: string) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        if (OraclePanel.currentPanel) {
            OraclePanel.currentPanel.panel.reveal(column);
            if (workflowId) {
                const message: WebviewMessage = { type: 'SET_ORACLE_WORKFLOW', payload: workflowId };
                if (OraclePanel.currentPanel._isOracleReady) {
                    OraclePanel.currentPanel.panel.webview.postMessage(message);
                } else {
                    OraclePanel.currentPanel._messageQueue.push(message);
                }
            }
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'coreasonOracle',
            'CoReason Epistemic Oracle',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')],
            }
        );

        OraclePanel.currentPanel = new OraclePanel(panel, extensionUri, workflowId);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, workflowId?: string) {
        this.panel = panel;
        this.extensionUri = extensionUri;

        if (workflowId) {
            this._messageQueue.push({ type: 'SET_ORACLE_WORKFLOW', payload: workflowId });
        }

        this.update();

        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);

        this.panel.webview.onDidReceiveMessage(async (message) => {
            if (message.type === 'READY') {
                this._isReady = true;
                this.panel.webview.postMessage({ type: 'SET_ROUTE', payload: 'ORACLE' });
            } else if (message.type === 'READY_ORACLE') {
                this._isOracleReady = true;
                while (this._messageQueue.length > 0) {
                    const queuedMsg = this._messageQueue.shift();
                    this.panel.webview.postMessage(queuedMsg);
                }
            } else if (message.type === 'SUBMIT' || message.type === 'RESOLVE') {
                if (OraclePanel.telemetryClient) {
                    await OraclePanel.telemetryClient.resumeWorkflow(
                        (message as any).payload.workflowId,
                        (message as any).payload.correctedIntent
                    );
                }
            }
        }, null, this.disposables);
    }

    public triggerOracleLock(workflowId: string, latentState: any, intent: any) {
        const message = {
            type: 'AGENT_SUSPENDED',
            payload: {
                isAgentDriving: true,
                workflowId,
                latentState,
                intent
            }
        };
        if (!this._isOracleReady) {
            this._messageQueue.push(message);
        } else {
            this.panel.webview.postMessage(message);
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
        const nonce = Math.random().toString(36).substring(2, 15);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
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
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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
