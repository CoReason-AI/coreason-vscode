import * as vscode from 'vscode';
import { CoreasonSchemaProvider } from './providers/schemaProvider';
import { ManifoldPanel } from './panels/ManifoldPanel';
import { ForgePanel } from './panels/ForgePanel';
import { OraclePanel } from './panels/OraclePanel';
import { OracleTreeProvider } from './providers/OracleTreeProvider';

export function activate(context: vscode.ExtensionContext) {
    console.log('CoReason Projection Manifold activated.');

    // Register the schema provider
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('coreason-schema', new CoreasonSchemaProvider())
    );

    // Hijack YAML extension schemas
    const config = vscode.workspace.getConfiguration('yaml');
    const existingSchemas = config.get<Record<string, string[]>>('schemas') || {};
    existingSchemas['coreason-schema://schemas/swarm.json'] = ["*.coreason.yaml", "*.coreason.json"];
    config.update('schemas', existingSchemas, vscode.ConfigurationTarget.Workspace);

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

    const oracleTreeProvider = new OracleTreeProvider();
    vscode.window.registerTreeDataProvider('coreason-oracle-inbox', oracleTreeProvider);

    const oracleDisposable = vscode.commands.registerCommand('coreason.resolveOracle', (workflowId?: string) => {
        OraclePanel.createOrShow(context.extensionUri, workflowId);
    });

    context.subscriptions.push(oracleDisposable);

    let timeout: NodeJS.Timeout | undefined;

    context.subscriptions.push(
        vscode.workspace.onDidChangeTextDocument((event) => {
            if (
                event.document.languageId === 'yaml' ||
                event.document.fileName.endsWith('.coreason.yaml')
            ) {
                if (timeout) {
                    clearTimeout(timeout);
                }
                timeout = setTimeout(() => {
                    const text = event.document.getText();
                    if (ManifoldPanel.currentPanel) {
                        ManifoldPanel.currentPanel.updateCanvas(text);
                    }
                }, 300);
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
                const text = editor.document.getText();
                if (ManifoldPanel.currentPanel) {
                    ManifoldPanel.currentPanel.updateCanvas(text);
                }
            }
        })
    );
}

export function deactivate() {
    // Cleanup Temporal SSE connections here later
}
