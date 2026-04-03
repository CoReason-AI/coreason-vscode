import * as vscode from 'vscode';
import { CoreasonSchemaProvider } from './providers/schemaProvider';
import { fetchTopologySchema } from './network/edgeClient';
import { ManifoldPanel } from './panels/ManifoldPanel';
import { ForgePanel } from './panels/ForgePanel';
import { OraclePanel } from './panels/OraclePanel';
import { OracleTreeProvider } from './providers/OracleTreeProvider';
import { TelemetryClient } from './network/telemetryClient';
import * as yaml from 'yaml';

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

    const newSwarmDisposable = vscode.commands.registerCommand('coreason.newSwarm', async () => {
        let agentTemplate: any = {
            type: "agent",
            description: "This is a placeholder agent. Describe what it should do here."
        };

        try {
            const schemaStr = await fetchTopologySchema();
            if (schemaStr) {
                const schema = JSON.parse(schemaStr);
                const agentProfileProps = schema?.$defs?.AgentNodeProfile?.properties;
                if (agentProfileProps) {
                    const dynamicTemplate: any = {};
                    for (const [k, v] of Object.entries<any>(agentProfileProps)) {
                        if (v.default !== undefined) {
                            dynamicTemplate[k] = v.default;
                        } else if (v.type === 'string') {
                            dynamicTemplate[k] = "";
                            if (k === 'description') dynamicTemplate[k] = "This is a placeholder agent. Describe what it should do here.";
                            if (k === 'type') dynamicTemplate[k] = "agent";
                        } else if (v.type === 'array') {
                            dynamicTemplate[k] = [];
                        } else if (v.type === 'object') {
                            dynamicTemplate[k] = {};
                        } else if (v.type === 'number' || v.type === 'integer') {
                            dynamicTemplate[k] = 0;
                        } else if (v.type === 'boolean') {
                            dynamicTemplate[k] = false;
                        } else {
                            dynamicTemplate[k] = null;
                        }
                    }
                    agentTemplate = dynamicTemplate;
                }
            }
        } catch (e) {
            console.warn("Failed to dynamically generate schema template, falling back to static boilerplate:", e);
        }

        const boilerplateObj = {
            manifest_version: "1.0.0",
            tenant_id: "default-tenant",
            session_id: "local-dev-session-001",
            genesis_provenance: {
                extracted_by: "did:coreason:local-dev-user",
                source_event_id: "dev-001"
            },
            topology: {
                type: "swarm",
                nodes: {
                    "did:coreason:draft-agent": agentTemplate
                },
                edges: []
            }
        };

        const boilerplate = JSON.stringify(boilerplateObj, null, 2);
        const document = await vscode.workspace.openTextDocument({ content: boilerplate, language: 'json' });
        await vscode.window.showTextDocument(document);
    });

    context.subscriptions.push(newSwarmDisposable);

    let outputChannel: vscode.OutputChannel | undefined;

    const runSwarmDisposable = vscode.commands.registerCommand('coreason.runSwarm', async () => {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage("Please open a valid CoReason manifest (.json or .yaml) to execute it.");
            return;
        }

        const document = editor.document;
        let manifestData: any;
        
        try {
            const text = document.getText();
            if (document.languageId === 'json' || document.fileName.endsWith('.json')) {
                manifestData = JSON.parse(text);
            } else if (document.languageId === 'yaml' || document.fileName.endsWith('.yaml')) {
                manifestData = yaml.parse(text);
            } else {
                vscode.window.showErrorMessage("Manifest must be JSON or YAML.");
                return;
            }
        } catch (e) {
            vscode.window.showErrorMessage("Failed to parse manifest: " + e);
            return;
        }

        const query = await vscode.window.showInputBox({ 
            prompt: "Enter your dynamic CLI query for the master agent (optional):",
            placeHolder: "e.g., In patients with epilepsy..."
        });

        if (query === undefined) {
            return; // Cancelled
        }

        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: "Executing CoReason Swarm Engine...",
            cancellable: false
        }, async (progress) => {
            try {
                const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
                
                const response = await fetch(`http://localhost:${port}/api/v1/state/execute`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        manifest: manifestData,
                        query: query === "" ? null : query
                    })
                });

                if (!response.ok) {
                    const errText = await response.text();
                    let errMsg = errText;
                    try { errMsg = JSON.parse(errText).detail || errText; } catch {}
                    throw new Error(`HTTP error! status: ${response.status} - ${errMsg}`);
                }

                const data = await response.json();
                
                if (!outputChannel) {
                    outputChannel = vscode.window.createOutputChannel('CoReason');
                }
                
                outputChannel.clear();
                outputChannel.appendLine("================ COREASON SWARM EXECUTION ================");
                outputChannel.appendLine(`Query: ${query ?? "N/A"}`);
                outputChannel.appendLine("Status: SUCCESS");
                outputChannel.appendLine(JSON.stringify(data, null, 2));
                outputChannel.show(true);

            } catch (e: any) {
                vscode.window.showErrorMessage("Execution failed: " + e.message);
            }
        });
    });

    context.subscriptions.push(runSwarmDisposable);

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
                event.document.fileName.endsWith('.coreason.yaml') ||
                event.document.fileName.endsWith('.coreason.json')
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
                    editor.document.fileName.endsWith('.coreason.yaml') ||
                    editor.document.fileName.endsWith('.coreason.json'))
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
