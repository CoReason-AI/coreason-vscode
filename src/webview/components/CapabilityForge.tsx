import React, { useState, useEffect } from 'react';

import { vscodeApi } from '../vscodeApi';
import { SandboxReceipt } from '../../shared/types';

export const CapabilityForge = () => {
    const [capabilities, setCapabilities] = useState<string[]>([]);
    const [selectedTool, setSelectedTool] = useState<string>('');
    const [intentJson, setIntentJson] = useState<string>('{\n  "arguments": {}\n}');
    const [latentState, setLatentState] = useState<string>('{\n  "workflowId": "mock-123"\n}');
    const [receipt, setReceipt] = useState<SandboxReceipt | null>(null);
    const [activeTab, setActiveTab] = useState<'output' | 'stdout' | 'physics'>('output');
    const [isLoading, setIsLoading] = useState(false);
    const [isAgentDriving, setIsAgentDriving] = useState(false);
    const [currentWorkflowId, setCurrentWorkflowId] = useState<string>('');

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message && message.type === 'SET_AGENT_DRIVING') {
                setIsAgentDriving(message.payload);
            } else if (message && message.type === 'AGENT_SUSPENDED') {
                setIsAgentDriving(message.payload.isAgentDriving);
                if (message.payload.workflowId) {
                    setCurrentWorkflowId(message.payload.workflowId);
                }
                if (message.payload.isAgentDriving) {
                    if (message.payload.latentState) {
                        setLatentState(JSON.stringify(message.payload.latentState, null, 2));
                    }
                    if (message.payload.intent) {
                        setIntentJson(JSON.stringify(message.payload.intent, null, 2));
                    }
                }
            } else if (message && message.type === 'CAPABILITY_EXECUTED') {
                setReceipt(message.payload);
                setIsLoading(false);
            } else if (message && message.type === 'CAPABILITIES_FETCHED') {
                const data = message.payload;
                const caps = Array.isArray(data) ? data.map((c: any) => c.name || c) : (data.enum || []);
                setCapabilities(caps);
                if (caps.length > 0) {
                    setSelectedTool(caps[0]);
                }
            } else if (message && message.type === 'CAPABILITIES_FETCHED_ERROR') {
                console.error("Failed to fetch capabilities:", message.payload);
                // Fallback for UI if API is down
                setCapabilities(['math_calculator', 'string_processor', 'shell_executor']);
                setSelectedTool('math_calculator');
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        vscodeApi.postMessage({ type: 'FETCH_CAPABILITIES' });
    }, []);

    const executeSandbox = async () => {
        setIsLoading(true);
        setReceipt(null);
        try {
            const parsedIntent = JSON.parse(intentJson);
            const parsedState = JSON.parse(latentState);

            const payload = {
                intent: parsedIntent,
                state: parsedState
            };

            vscodeApi.postMessage({
                type: 'EXECUTE_CAPABILITY',
                payload: { toolName: selectedTool, intent: payload }
            });
        } catch (error: any) {
            setReceipt({
                intent_hash: 'error_hash',
                success: false,
                error: `Error parsing JSON: ${error.message || String(error)}`
            });
            setIsLoading(false);
        }
    };

    const handleCrystallize = () => {
        if (!receipt) return;
        vscodeApi.postMessage({
            type: 'CRYSTALLIZE_TEST',
            payload: {
                capability: selectedTool,
                state: latentState,
                intent: intentJson,
                output: typeof receipt.output === 'string' ? receipt.output : JSON.stringify(receipt.output)
            }
        });
    };

    const handleOracleOverride = () => {
        vscodeApi.postMessage({
            type: 'OVERRIDE_AGENT_INTENT',
            payload: { workflowId: currentWorkflowId, correctedIntent: intentJson }
        });
        // Autonomic Release: Instantly unlock the UI
        setIsAgentDriving(false);
    };

    return (
        <div style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '20px',
            padding: '20px',
            width: '100vw',
            height: '100vh',
            boxSizing: 'border-box',
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
            fontFamily: 'var(--vscode-font-family)'
        }}>
            {/* Left Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2em', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '10px' }}>
                    Capability Forge
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Select Capability</label>
                    <select
                        value={selectedTool}
                        onChange={(e) => setSelectedTool(e.target.value)}
                        style={{
                            padding: '8px',
                            background: 'var(--vscode-dropdown-background)',
                            color: 'var(--vscode-dropdown-foreground)',
                            border: '1px solid var(--vscode-dropdown-border)',
                            borderRadius: '2px',
                            fontFamily: 'inherit'
                        }}
                    >
                        {capabilities.map(cap => (
                            <option key={cap} value={cap}>{cap}</option>
                        ))}
                    </select>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexGrow: 1, opacity: isAgentDriving ? 0.5 : 1, pointerEvents: isAgentDriving ? 'none' : 'auto' }}>
                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Markov Blanket Context (JSON)</label>
                    <textarea
                        value={latentState}
                        onChange={(e) => setLatentState(e.target.value)}
                        style={{
                            flexGrow: 1,
                            padding: '10px',
                            background: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            fontFamily: 'var(--vscode-editor-font-family), monospace',
                            resize: 'none',
                            borderRadius: '2px'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexGrow: 1, opacity: isAgentDriving ? 0.5 : 1, pointerEvents: isAgentDriving ? 'none' : 'auto' }}>
                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Capability Arguments (JSON)</label>
                    <textarea
                        value={intentJson}
                        onChange={(e) => setIntentJson(e.target.value)}
                        style={{
                            flexGrow: 1,
                            padding: '10px',
                            background: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            fontFamily: 'var(--vscode-editor-font-family), monospace',
                            resize: 'none',
                            borderRadius: '2px'
                        }}
                    />
                </div>

                {isAgentDriving ? (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={handleOracleOverride}
                            style={{
                                padding: '10px',
                                background: 'var(--vscode-errorForeground)',
                                color: 'var(--vscode-button-foreground)',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                flexGrow: 1
                            }}
                        >
                            Override & Execute
                        </button>
                        <button
                            onClick={() => {
                                vscodeApi.postMessage({ type: 'APPROVE_FORGE', payload: { workflowId: currentWorkflowId, attestation: "fido2_webauthn" } });
                                setIsAgentDriving(false);
                            }}
                            style={{
                                padding: '10px',
                                background: 'var(--vscode-button-background)',
                                color: 'var(--vscode-button-foreground)',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                flexGrow: 1
                            }}
                        >
                            <span style={{ marginRight: '5px' }}>🔐</span> Approve (FIDO2)
                        </button>
                    </div>
                ) : (
                    <div style={{ display: 'flex', gap: '10px' }}>
                        <button
                            onClick={executeSandbox}
                            disabled={isLoading}
                            style={{
                                flexGrow: 1,
                                padding: '10px',
                                background: 'var(--vscode-button-background)',
                                color: 'var(--vscode-button-foreground)',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: isLoading ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: isLoading ? 0.7 : 1
                            }}
                        >
                            {isLoading ? 'Executing...' : 'Execute Sandbox'}
                        </button>
                        <button
                            onClick={handleCrystallize}
                            disabled={isLoading || !receipt || !receipt.success}
                            style={{
                                padding: '10px',
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: '1px solid var(--vscode-button-border)',
                                borderRadius: '2px',
                                cursor: isLoading || !receipt || !receipt.success ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: isLoading || !receipt || !receipt.success ? 0.7 : 1
                            }}
                        >
                            ✨ Crystallize Contract
                        </button>
                    </div>
                )}
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2em', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '10px' }}>
                    Execution Receipt
                </h2>

                <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '5px' }}>
                    {(['output', 'stdout', 'physics'] as const).map((tab) => (
                        <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            style={{
                                padding: '5px 10px',
                                background: activeTab === tab ? 'var(--vscode-button-background)' : 'transparent',
                                color: activeTab === tab ? 'var(--vscode-button-foreground)' : 'var(--vscode-foreground)',
                                border: 'none',
                                borderRadius: '2px',
                                cursor: 'pointer',
                                textTransform: 'capitalize',
                                fontWeight: activeTab === tab ? 'bold' : 'normal'
                            }}
                        >
                            {tab === 'output' ? 'Output' : tab === 'stdout' ? 'StdOut / StdErr' : 'Physics'}
                        </button>
                    ))}
                </div>

                <div style={{
                    flexGrow: 1,
                    backgroundColor: 'var(--vscode-editorWidget-background)',
                    border: '1px solid var(--vscode-widget-border)',
                    borderRadius: '2px',
                    padding: '10px',
                    overflowY: 'auto'
                }}>
                    {activeTab === 'output' && receipt && (
                        receipt.success ? (
                            <pre style={{ margin: 0, fontFamily: 'var(--vscode-editor-font-family), monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}>
                                <code>{typeof receipt.output === 'string' ? receipt.output : JSON.stringify(receipt.output, null, 2)}</code>
                            </pre>
                        ) : (
                            <pre style={{
                                margin: 0,
                                fontFamily: 'var(--vscode-editor-font-family), monospace',
                                fontSize: '0.9em',
                                whiteSpace: 'pre-wrap',
                                color: 'var(--vscode-errorForeground)',
                                border: '1px solid var(--vscode-errorForeground)',
                                padding: '10px'
                            }}>
                                <code>{receipt.error || 'Unknown Error'}</code>
                            </pre>
                        )
                    )}
                    {activeTab === 'stdout' && receipt && (
                        <pre style={{ margin: 0, fontFamily: 'var(--vscode-editor-font-family), monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap', color: 'var(--vscode-terminal-foreground)' }}>
                            <code>
                                {receipt.logs?.stdout || ''}
                                {receipt.logs?.stderr && (
                                    <span style={{ color: 'var(--vscode-errorForeground)' }}>
                                        {receipt.logs?.stdout ? '\n' : ''}{receipt.logs.stderr}
                                    </span>
                                )}
                            </code>
                        </pre>
                    )}
                    {activeTab === 'physics' && receipt?.telemetry && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                            <div style={{
                                color: (receipt.telemetry.latency_ns / 1_000_000) > 500 ? 'var(--vscode-charts-orange)' : 'var(--vscode-foreground)'
                            }}>
                                <strong>Latency:</strong> {(receipt.telemetry.latency_ns / 1_000_000).toFixed(2)} ms
                            </div>
                            <div style={{
                                color: (receipt.telemetry.peak_memory_bytes / 1_048_576) > 2 ? 'var(--vscode-charts-orange)' : 'var(--vscode-foreground)'
                            }}>
                                <strong>Peak Memory:</strong> {(receipt.telemetry.peak_memory_bytes / 1_048_576).toFixed(2)} MB
                            </div>
                        </div>
                    )}
                </div>

                {receipt && (
                    <div style={{
                        marginTop: 'auto',
                        paddingTop: '10px',
                        borderTop: '1px solid var(--vscode-panel-border)',
                        fontFamily: 'var(--vscode-editor-font-family), monospace',
                        fontSize: '0.8em',
                        color: 'var(--vscode-descriptionForeground)'
                    }}>
                        Provenance Hash: {receipt.intent_hash}
                    </div>
                )}
            </div>
        </div>
    );
};