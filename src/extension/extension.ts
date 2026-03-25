import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
    console.log('CoReason Projection Manifold activated.');

    const disposable = vscode.commands.registerCommand('coreason.openManifold', () => {
        vscode.window.showInformationMessage('Initializing CoReason TDA Canvas...');
        // Webview logic will be injected here during Epic 2
    });

    context.subscriptions.push(disposable);
}

export function deactivate() {
    // Cleanup Temporal SSE connections here later
}
