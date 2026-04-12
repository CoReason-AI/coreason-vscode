import * as vscode from 'vscode';
import { WebviewMessage } from '../../shared/types';
import { executeSandbox, resumeOracleWorkflow, sendForgeApprovalAttestation } from '../network/edgeClient';

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
                retainContextWhenHidden: true,
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
            } else if (message.type === 'FETCH_CAPABILITIES') {
                const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
                try {
                    const response = await fetch(`http://localhost:${port}/api/v1/schema/capabilities`);
                    if (response.ok) {
                        const data = await response.json();
                        this.panel.webview.postMessage({ type: 'CAPABILITIES_FETCHED', payload: data });
                    } else {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                } catch (error) {
                    console.error("Failed to fetch capabilities:", error);
                    this.panel.webview.postMessage({ type: 'CAPABILITIES_FETCHED_ERROR', payload: error });
                }
            } else if (message.type === 'CRYSTALLIZE_TEST') {
                await this.crystallizeTest(message.payload);
            } else if (message.type === 'EXECUTE_CAPABILITY') {
                const receipt = await executeSandbox(message.payload.toolName, message.payload.intent);
                this.panel.webview.postMessage({ type: 'CAPABILITY_EXECUTED', payload: receipt });
            } else if (message.type === 'OVERRIDE_AGENT_INTENT') {
                const success = await resumeOracleWorkflow(message.payload.workflowId, message.payload.correctedIntent);
                if (success) {
                    vscode.window.showInformationMessage('✨ Epistemic Injection successful. Swarm thread resumed.');
                } else {
                    vscode.window.showErrorMessage('Failed to inject Epistemic Correction.');
                }
            } else if (message.type === 'APPROVE_FORGE') {
                const success = await sendForgeApprovalAttestation(message.payload.workflowId, message.payload.attestation);
                if (success) {
                    vscode.window.showInformationMessage('🔐 FIDO2 WebAuthn intent approved. Sandbox proceeding.');
                } else {
                    vscode.window.showErrorMessage('FIDO2 approval rejected or failed to transmit.');
                }
            }
        }, null, this.disposables);
    }

    public triggerOracleLock(workflowId: string, latentState: any, intent: any) {
        this.panel.webview.postMessage({
            type: 'AGENT_SUSPENDED',
            payload: {
                isAgentDriving: true,
                workflowId,
                latentState,
                intent
            }
        });
    }

    private async crystallizeTest(payload: { capability: string; state: string; intent: string; output: string }) {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        let rootUri: vscode.Uri | undefined;
        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const workspaceFolder = vscode.workspace.getWorkspaceFolder(editor.document.uri);
            rootUri = workspaceFolder?.uri;
        }
        if (!rootUri && workspaceFolders && workspaceFolders.length > 0) {
            rootUri = workspaceFolders[0].uri;
        }

        if (!rootUri) {
            vscode.window.showErrorMessage('No workspace folder open. Cannot crystallize test.');
            return;
        }

        const sanitizedId = payload.capability.replace(/-/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const fileName = `test_capability_${sanitizedId}_${timestamp}.py`;
        const testUri = vscode.Uri.joinPath(rootUri, 'tests', 'sandbox', fileName);
        const fixtureUri = vscode.Uri.joinPath(rootUri, 'tests', 'sandbox', `${sanitizedId}_fixture.json`);

        const fixtureData = {
            latent_state: JSON.parse(payload.state),
            intent: JSON.parse(payload.intent),
            expected_output: JSON.parse(payload.output)
        };
        const fixtureContent = new TextEncoder().encode(JSON.stringify(fixtureData, null, 2));

        const fileContent = `import pytest
import json
import extism

def test_${sanitizedId}_crystallized():
    with open("${sanitizedId}_fixture.json", "r") as f:
        fixture = json.load(f)

    # Latent State Context
    latent_state = fixture['latent_state']

    # Execution Intent
    intent = fixture['intent']

    # Expected Output
    expected_output = fixture['expected_output']

    plugin = extism.Plugin("${sanitizedId}.wasm")
    result = plugin.call("test", json.dumps(intent))

    assert json.loads(result) == expected_output
`;

        const edit = new vscode.WorkspaceEdit();
        edit.createFile(testUri, { ignoreIfExists: false });
        edit.insert(testUri, new vscode.Position(0, 0), fileContent);

        try {
            await vscode.workspace.fs.writeFile(fixtureUri, fixtureContent);
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
        const nonce = Math.random().toString(36).substring(2, 15);

        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}' ${webview.cspSource};">
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
    <script type="module" nonce="${nonce}" src="${scriptUri}"></script>
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