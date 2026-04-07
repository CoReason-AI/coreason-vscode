import * as vscode from 'vscode';
import { SandboxReceipt } from '../../shared/types';

let outputChannel: vscode.OutputChannel | undefined;

export async function fetchTopologySchema(): Promise<string | null> {
    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
    try {
        // Fetch the WorkflowManifest schema — the root-level envelope that contains
        // manifest_version, tenant_id, session_id, genesis_provenance, AND the
        // AnyTopologyManifest discriminated union (dag/swarm) in its $defs.
        // Using this as the root fixes VS Code errors on top-level WorkflowManifest fields.
        const workflowRes = await fetch(`http://localhost:${port}/api/v1/schema/topology/workflow`);

        if (!workflowRes.ok) {
            throw new Error(`HTTP error! status: ${workflowRes.status}`);
        }

        const workflowSchema = await workflowRes.json();
        return JSON.stringify(workflowSchema);
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
            jsonrpc: "2.0",
            method: "mcp.ui.emit_intent",
            params: {
                intent: intent.intent,
                state: intent.state
            },
            id: `forge-${Date.now()}`
        };

        const response = await fetch(`http://localhost:${port}/api/v1/sandbox/execute?tool_name=${encodeURIComponent(toolName)}`, {
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

export async function synthesizeAgent(prompt: string): Promise<any> {
    const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
    try {
        const payload = {
            human_directive_intent: prompt,
            topological_manifold_bias: null,
            max_agents: 3
        };

        const response = await fetch(`http://localhost:${port}/api/v1/predict/synthesize`, {
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
        return data;
    } catch (error: any) {
        if (!outputChannel) {
            outputChannel = vscode.window.createOutputChannel('CoReason');
        }
        outputChannel.appendLine(`[Error] Failed to synthesize agent: ${error}`);
        return null;
    }
}
