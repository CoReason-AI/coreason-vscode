import * as vscode from 'vscode';

let outputChannel: vscode.OutputChannel | undefined;

export async function fetchTopologySchema(): Promise<string | null> {
    try {
        const response = await fetch('http://localhost:8000/api/v1/schema/topology/swarm');
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.text();
    } catch (error) {
        // Create or reuse an output channel
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('CoReason');
        }
        outputChannel.appendLine(`[Warning] Failed to fetch topology schema from Epistemic Edge: ${error}`);
        return null;
    }
}
