import * as vscode from 'vscode';
import { SandboxReceipt } from '../../shared/types';

let outputChannel: vscode.OutputChannel | undefined;

export async function fetchTopologySchema(): Promise<string | null> {
    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
    try {
        const response = await fetch(`http://localhost:${port}/api/v1/schema/topology/swarm`);
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

export async function executeSandbox(toolName: string, intent: any): Promise<SandboxReceipt> {
    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
    try {
        const payload = {
            intent: intent.intent,
            state: intent.state
        };

        const response = await fetch(`http://localhost:${port}/api/v1/sandbox/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        return data as SandboxReceipt;
    } catch (error: any) {
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('CoReason');
        }
        outputChannel.appendLine(`[Error] Failed to execute capability ${toolName} on Epistemic Edge: ${error}`);
        return {
            intent_hash: 'error_hash',
            success: false,
            error: error.message || String(error)
        };
    }
}

export async function resumeOracleWorkflow(workflowId: string, correctedIntent: string): Promise<boolean> {
    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
    try {
        const payload = {
            corrected_intent: JSON.parse(correctedIntent)
        };

        const response = await fetch(`http://localhost:${port}/api/v1/oracle/resume/${workflowId}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        return true;
    } catch (error: any) {
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('CoReason');
        }
        outputChannel.appendLine(`[Error] Failed to resume oracle workflow ${workflowId} on Epistemic Edge: ${error}`);
        return false;
    }
}
