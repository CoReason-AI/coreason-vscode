import React, { useState, useEffect } from 'react';

import { vscodeApi } from '../vscodeApi';

export const CapabilityForge = () => {
    const [capabilities, setCapabilities] = useState<string[]>([]);
    const [selectedTool, setSelectedTool] = useState<string>('');
    const [intentJson, setIntentJson] = useState<string>('{\n  "arguments": {}\n}');
    const [latentState, setLatentState] = useState<string>('{\n  "workflowId": "mock-123"\n}');
    const [receipt, setReceipt] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'output' | 'stdout' | 'physics'>('output');
    const [isLoading, setIsLoading] = useState(false);
    const [isAgentDriving, setIsAgentDriving] = useState(false);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message && message.type === 'SET_AGENT_DRIVING') {
                setIsAgentDriving(message.payload);
            } else if (message && message.type === 'AGENT_SUSPENDED') {
                setIsAgentDriving(message.payload.isAgentDriving);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    useEffect(() => {
        // Fetch capabilities on mount
        fetch('http://localhost:8000/api/v1/schema/capabilities')
            .then(res => res.json())
            .then(data => {
                // Assuming data is an array of capability names or objects with a name property
                const caps = Array.isArray(data) ? data.map((c: any) => c.name || c) : [];
                setCapabilities(caps);
                if (caps.length > 0) {
                    setSelectedTool(caps[0]);
                }
            })
            .catch(err => {
                console.error("Failed to fetch capabilities:", err);
                // Fallback for UI if API is down
                setCapabilities(['math_calculator', 'string_processor', 'shell_executor']);
                setSelectedTool('math_calculator');
            });
    }, []);

    const executeSandbox = async () => {
        setIsLoading(true);
        setReceipt('Executing...');
        try {
            const parsedIntent = JSON.parse(intentJson);
            const parsedState = JSON.parse(latentState);

            const payload = {
                intent: parsedIntent,
                state: parsedState
            };

            const response = await fetch('http://localhost:8000/api/v1/sandbox/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(payload)
            });

            const data = await response.json();
            setReceipt(JSON.stringify(data, null, 2));
        } catch (error: any) {
            setReceipt(`Error: ${error.message || String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleCrystallize = () => {
        vscodeApi.postMessage({
            type: 'CRYSTALLIZE_TEST',
            payload: {
                capability: selectedTool,
                state: latentState,
                intent: intentJson,
                output: receipt
            }
        });
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
                    <button
                        onClick={() => setIsAgentDriving(false)}
                        style={{
                            padding: '10px',
                            background: 'var(--vscode-errorForeground)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                        }}
                    >
                        Override & Execute
                    </button>
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
                            disabled={isLoading || !receipt || receipt === 'Executing...' || receipt.startsWith('Error:')}
                            style={{
                                padding: '10px',
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: '1px solid var(--vscode-button-border)',
                                borderRadius: '2px',
                                cursor: isLoading || !receipt || receipt === 'Executing...' || receipt.startsWith('Error:') ? 'not-allowed' : 'pointer',
                                fontWeight: 'bold',
                                opacity: isLoading || !receipt || receipt === 'Executing...' || receipt.startsWith('Error:') ? 0.7 : 1
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
                    {activeTab === 'output' && (
                        <pre style={{ margin: 0, fontFamily: 'var(--vscode-editor-font-family), monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}>
                            <code>{receipt}</code>
                        </pre>
                    )}
                    {activeTab === 'stdout' && (
                        <pre style={{ margin: 0, fontFamily: 'var(--vscode-editor-font-family), monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap', color: 'var(--vscode-terminal-foreground)' }}>
                            <code>{receipt ? '[Mock] System logged execution context.\n[Mock] Binary initialized successfully.' : ''}</code>
                        </pre>
                    )}
                    {activeTab === 'physics' && (
                        <pre style={{ margin: 0, fontFamily: 'var(--vscode-editor-font-family), monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap', color: 'var(--vscode-terminal-ansiBrightCyan)' }}>
                            <code>{receipt ? 'Latency: 42ms\nMemory Allocation: 1.8MB out of 2.0MB limit\nCPU Time: 12ms' : ''}</code>
                        </pre>
                    )}
                </div>
            </div>
        </div>
    );
};