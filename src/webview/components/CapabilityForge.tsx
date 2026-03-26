import React, { useState, useEffect } from 'react';

export const CapabilityForge = () => {
    const [capabilities, setCapabilities] = useState<string[]>([]);
    const [selectedTool, setSelectedTool] = useState<string>('');
    const [intentJson, setIntentJson] = useState<string>('{\n  "arguments": {}\n}');
    const [receipt, setReceipt] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

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

            const response = await fetch('http://localhost:8000/api/v1/sandbox/execute', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    capability: selectedTool,
                    intent: parsedIntent
                })
            });

            const data = await response.json();
            setReceipt(JSON.stringify(data, null, 2));
        } catch (error: any) {
            setReceipt(`Error: ${error.message || String(error)}`);
        } finally {
            setIsLoading(false);
        }
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
                            backgroundColor: 'var(--vscode-dropdown-background)',
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

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', flexGrow: 1 }}>
                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>MCP Client Intent (JSON)</label>
                    <textarea
                        value={intentJson}
                        onChange={(e) => setIntentJson(e.target.value)}
                        style={{
                            flexGrow: 1,
                            padding: '10px',
                            backgroundColor: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            fontFamily: 'var(--vscode-editor-font-family), monospace',
                            resize: 'none',
                            borderRadius: '2px'
                        }}
                    />
                </div>

                <button
                    onClick={executeSandbox}
                    disabled={isLoading}
                    style={{
                        padding: '10px',
                        backgroundColor: 'var(--vscode-button-background)',
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
            </div>

            {/* Right Column */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                <h2 style={{ margin: 0, fontSize: '1.2em', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '10px' }}>
                    Execution Receipt
                </h2>

                <div style={{
                    flexGrow: 1,
                    backgroundColor: 'var(--vscode-editorWidget-background)',
                    border: '1px solid var(--vscode-widget-border)',
                    borderRadius: '2px',
                    padding: '10px',
                    overflowY: 'auto'
                }}>
                    <pre style={{ margin: 0, fontFamily: 'var(--vscode-editor-font-family), monospace', fontSize: '0.9em', whiteSpace: 'pre-wrap' }}>
                        <code>{receipt}</code>
                    </pre>
                </div>
            </div>
        </div>
    );
};