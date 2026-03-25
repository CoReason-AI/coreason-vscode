import * as vscode from 'vscode';
import { CoreasonSchemaProvider } from './providers/schemaProvider';

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
        // Webview logic will be injected here during Epic 2
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Cleanup Temporal SSE connections here later
}
