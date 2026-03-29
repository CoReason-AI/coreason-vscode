import * as vscode from 'vscode';
import { CoreasonSchemaProvider } from './providers/schemaProvider';
import { ManifoldPanel } from './panels/ManifoldPanel';
import { ForgePanel } from './panels/ForgePanel';
import { OraclePanel } from './panels/OraclePanel';
import { OracleTreeProvider } from './providers/OracleTreeProvider';
import { TelemetryClient } from './network/telemetryClient';

export function activate(context: vscode.ExtensionContext) {
    console.log('CoReason Projection Manifold activated.');

    // Register the schema provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('coreason-schema', new CoreasonSchemaProvider())
    );

    // Hijack YAML extension schemas
    try {
        const config = vscode.workspace.getConfiguration('yaml');
        const existingSchemas = { ...(config.get<Record<string, string[]>>('schemas') || {}) };
        existingSchemas['coreason-schema://schemas/swarm.json'] = ["*.coreason.yaml", "*.coreason.json"];
        
        const target = vscode.workspace.workspaceFolders 
            ? vscode.ConfigurationTarget.Workspace 
            : vscode.ConfigurationTarget.Global;
            
        config.update('schemas', existingSchemas, target);
    } catch (e) {
        console.warn('Could not update YAML schemas automatically:', e);
    }

    const disposable = vscode.commands.registerCommand('coreason.openManifold', () => {
        vscode.window.showInformationMessage('Initializing CoReason TDA Canvas...');
        ManifoldPanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(disposable);

    const forgeDisposable = vscode.commands.registerCommand('coreason.openForge', () => {
        vscode.window.showInformationMessage('Initializing CoReason Capability Forge...');
        ForgePanel.createOrShow(context.extensionUri);
    });

    context.subscriptions.push(forgeDisposable);

    const telemetryClient = new TelemetryClient();
    OraclePanel.telemetryClient = telemetryClient;

    const oracleTreeProvider = new OracleTreeProvider(telemetryClient);
    vscode.window.registerTreeDataProvider('coreason-oracle-inbox', oracleTreeProvider);

    const oracleDisposable = vscode.commands.registerCommand('coreason.resolveOracle', (workflowId?: string) => {
        OraclePanel.createOrShow(context.extensionUri, workflowId);
    });

    context.subscriptions.push(oracleDisposable);

    telemetryClient.on('agent_suspended', (workflowId, latentState, intent) => {
        const panel = OraclePanel.currentPanel;
        if (panel) {
            panel.triggerOracleLock(workflowId, latentState, intent);
        } else {
            OraclePanel.createOrShow(context.extensionUri, workflowId);
            const newPanel = OraclePanel.currentPanel;
            if (newPanel) {
                newPanel.triggerOracleLock(workflowId, latentState, intent);
            }
        }
    });
    telemetryClient.connect();

    const debounceTimers = new Map<string, NodeJS.Timeout>();

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (
                event.document.languageId === 'yaml' ||
                event.document.fileName.endsWith('.coreason.yaml')
            ) {
                const uriString = event.document.uri.toString();
                const timeout = debounceTimers.get(uriString);
                if (timeout) {
                    clearTimeout(timeout);
                }
                const newTimeout = setTimeout(() => {
                    if (ManifoldPanel.currentPanel) {
                        ManifoldPanel.currentPanel.updateCanvas(event.document);
                    }
                    debounceTimers.delete(uriString);
                }, 300);
                debounceTimers.set(uriString, newTimeout);
            }
        })
    );

    context.subscriptions.push(
        vscode.window.onDidChangeActiveTextEditor((editor) => {
            if (
                editor &&
                (editor.document.languageId === 'yaml' ||
                    editor.document.fileName.endsWith('.coreason.yaml'))
            ) {
                if (ManifoldPanel.currentPanel) {
                    ManifoldPanel.currentPanel.updateCanvas(editor.document);
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.workspace.onDidCloseTextDocument((document) => {
            const uriString = document.uri.toString();
            const timeout = debounceTimers.get(uriString);
            if (timeout) {
                clearTimeout(timeout);
                debounceTimers.delete(uriString);
            }
        })
    );
}

export function deactivate() {
    // Cleanup Temporal SSE connections here later
}
