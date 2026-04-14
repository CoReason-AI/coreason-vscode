import * as vscode from 'vscode';
import { CoreasonSchemaProvider } from './providers/schemaProvider';
import { fetchTopologySchema, synthesizeAgent } from './network/edgeClient';
import { ManifoldPanel } from './panels/ManifoldPanel';
import { ForgePanel } from './panels/ForgePanel';
import { OraclePanel } from './panels/OraclePanel';
import { OracleTreeProvider } from './providers/OracleTreeProvider';
import { TelemetryClient } from './network/telemetryClient';
import * as yaml from 'yaml';

export function activate(context: vscode.ExtensionContext) {
    console.log('CoReason Projection Manifold activated.');

    // Register the schema provider
    const schemaProvider = new CoreasonSchemaProvider();
    context.subscriptions.push(
        vscode.workspace.registerTextDocumentContentProvider('coreason-schema', schemaProvider)
    );

    // Provide a way to manually flush the VS Code JSON schema cache
    context.subscriptions.push(vscode.commands.registerCommand('coreason.refreshSchema', () => {
        schemaProvider.onDidChangeEmitter.fire(vscode.Uri.parse('coreason-schema://schemas/swarm.json'));
        vscode.window.showInformationMessage('CoReason: Dynamic Ontology Schema fully re-synced from Backend.');
    }));

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
        const topologyOptions = [
            'swarm', 'dag', 'council', 'evaluator-optimizer',
            'digital-twin', 'evolutionary', 'capability-forge',
            'consensus-federation', 'smpc'
        ];
        
        const selectedTopology = await vscode.window.showQuickPick(topologyOptions, {
            placeHolder: 'Select the topology type for your new manifest',
            title: 'CoReason Scaffolding'
        });

        if (!selectedTopology) {
            return;
        }

        let boilerplateObj: any = {};
        
        try {
            // Fetch live Pydantic JSON Schema from your backend endpoint
            const schemaStr = await fetchTopologySchema();
            if (schemaStr) {
                const schema = JSON.parse(schemaStr);
                const definitions = schema.$defs || {};

                // 1. Recursive Schema Builder
                const buildFromSchema = (schemaNode: any): any => {
                    // Resolve Pydantic Definitions
                    if (schemaNode.$ref) {
                        const refName = schemaNode.$ref.split('/').pop();
                        if (refName && definitions[refName]) {
                            return buildFromSchema(definitions[refName]);
                        }
                    }
                    if (schemaNode.anyOf) {
                        // Pick the primary non-null valid schema route
                        const validOption = schemaNode.anyOf.find((n: any) => n.type !== 'null');
                        return validOption ? buildFromSchema(validOption) : null;
                    }

                    // Enforce Defaults
                    if (schemaNode.default !== undefined) {
                        return schemaNode.default;
                    }
                    
                    // Route by Primitives
                    if (schemaNode.type === 'string') return "";
                    if (schemaNode.type === 'integer' || schemaNode.type === 'number') return 0;
                    if (schemaNode.type === 'boolean') return false;
                    
                    // Build Arrays (Like `edges`)
                    if (schemaNode.type === 'array') return [];
                    
                    // Recursively build nested Objects
                    if (schemaNode.type === 'object' || schemaNode.properties) {
                        const obj: Record<string, any> = {};
                        if (schemaNode.properties) {
                            for (const [key, value] of Object.entries<any>(schemaNode.properties)) {
                                if (key === 'target_epistemic_deficit') continue;
                                obj[key] = buildFromSchema(value);
                            }
                        }
                        return obj;
                    }
                    return null;
                };

                // 2. Generate the full baseline envelope
                boilerplateObj = buildFromSchema(schema);

                // 3. Map selected string to actual Pydantic schema class block
                const topologyTypeMap: Record<string, string> = {
                    'swarm': 'SwarmTopologyManifest',
                    'dag': 'DAGTopologyManifest',
                    'council': 'CouncilTopologyManifest',
                    'evaluator-optimizer': 'EvaluatorOptimizerTopologyManifest',
                    'digital-twin': 'DigitalTwinTopologyManifest',
                    'evolutionary': 'EvolutionaryTopologyManifest',
                    'capability-forge': 'CapabilityForgeTopologyManifest',
                    'consensus-federation': 'ConsensusFederationTopologyManifest',
                    'smpc': 'SMPCTopologyManifest'
                };
                
                const defName = topologyTypeMap[selectedTopology];
                
                // 4. Overwrite abstract baseline topology with specific targeted topology object
                if (defName && definitions[defName]) {
                    boilerplateObj.topology = buildFromSchema(definitions[defName]);
                    boilerplateObj.topology.type = selectedTopology;

                    // Automatically generate placeholder nodes
                    if (boilerplateObj.topology.nodes) {
                        boilerplateObj.topology.nodes["did:coreason:draft-agent"] = definitions['AgentNodeProfile'] ? buildFromSchema(definitions['AgentNodeProfile']) : {};
                    }
                }
                
                // Cosmetic cleanup to look like standard boilerplate template
                if (boilerplateObj.genesis_provenance) {
                    boilerplateObj.genesis_provenance.extracted_by = "did:coreason:local-dev-user";
                    boilerplateObj.genesis_provenance.source_event_id = "dev-001";
                }
                
            } else {
                throw new Error("Empty schema returned");
            }
        } catch (e: any) {
            vscode.window.showErrorMessage("Failed to dynamically generate schema template: " + e.message);
            return;
        }

        const boilerplate = JSON.stringify(boilerplateObj, null, 2);
        const document = await vscode.workspace.openTextDocument({ content: boilerplate, language: 'json' });
        await vscode.window.showTextDocument(document);
    });

    context.subscriptions.push(newSwarmDisposable);

    const synthesizeDisposable = vscode.commands.registerCommand('coreason.synthesizeIntent', async () => {
        const prompt = await vscode.window.showInputBox({ 
            prompt: "Enter your intent to rigorosly synthesize a new agent framework:",
            placeHolder: "e.g., Build an agent that fetches live stock market sentiment"
        });

        if (!prompt) return;

        vscode.window.showInformationMessage('Synthesizing zero-day Agent on the Epistemic Edge. Check your backend terminal!');
        
        try {
            const data = await synthesizeAgent(prompt);
            
            if (data) {
                vscode.window.showInformationMessage(`Compilation complete! Manifest JSON resolved.`);
                
                // Autonomically inject the synthesized payload directly into the active canvas JSON backing file
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    await editor.edit(editBuilder => {
                        editBuilder.replace(
                            new vscode.Range(0, 0, editor.document.lineCount, 0),
                            JSON.stringify(data, null, 4)
                        );
                    });
                }
            } else {
                vscode.window.showErrorMessage(`Synthesis failed. Please check the CoReason Engine backend logs.`);
            }
        } catch(e: any) {
            vscode.window.showErrorMessage(`System failure during synthesis request: ${e.message}`);
        }
    });

    context.subscriptions.push(synthesizeDisposable);

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
