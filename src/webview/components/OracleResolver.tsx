import React, { useState, useEffect } from 'react';
import { vscodeApi } from '../vscodeApi';

export const OracleResolver = () => {
    const [workflowId, setWorkflowId] = useState<string>('');
    const [resolutionData, setResolutionData] = useState<string>('{\n  "decision": "approve"\n}');
    const [status, setStatus] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message && message.type === 'SET_ORACLE_WORKFLOW') {
                setWorkflowId(message.payload);
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, []);

    const submitResolution = async () => {
        if (!workflowId) {
            setStatus('Error: Workflow ID is required.');
            return;
        }

        setIsLoading(true);
        setStatus('Submitting...');
        try {
            const parsedResolution = JSON.parse(resolutionData);
            vscodeApi.postMessage({ type: 'SUBMIT', payload: { workflowId, correctedIntent: parsedResolution } });
            setStatus('Success: Resolution submitted to host.');
        } catch (error: any) {
            setStatus(`Error: ${error.message || String(error)}`);
        } finally {
            setIsLoading(false);
        }
    };

    const resolveAction = () => {
        if (!workflowId) {
            setStatus('Error: Workflow ID is required.');
            return;
        }
        try {
            const parsedResolution = JSON.parse(resolutionData);
            vscodeApi.postMessage({ type: 'RESOLVE', payload: { workflowId, correctedIntent: parsedResolution } });
            setStatus('Success: Resolve action sent to host.');
        } catch (error: any) {
            setStatus(`Error: ${error.message || String(error)}`);
        }
    };

    return (
        <div style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '20px',
            padding: '40px',
            width: '100vw',
            height: '100vh',
            boxSizing: 'border-box',
            backgroundColor: 'var(--vscode-editor-background)',
            color: 'var(--vscode-editor-foreground)',
            fontFamily: 'var(--vscode-font-family)'
        }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '15px', width: '100%', maxWidth: '600px' }}>
                <h2 style={{ margin: 0, fontSize: '1.4em', borderBottom: '1px solid var(--vscode-panel-border)', paddingBottom: '10px', textAlign: 'center' }}>
                    Epistemic Oracle Resolution
                </h2>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Workflow ID</label>
                    <input
                        type="text"
                        value={workflowId}
                        onChange={(e) => setWorkflowId(e.target.value)}
                        placeholder="e.g. swarm-run-77a9"
                        style={{
                            padding: '8px',
                            background: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            borderRadius: '2px',
                            fontFamily: 'inherit',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    <label style={{ fontSize: '0.9em', fontWeight: 'bold' }}>Resolution Payload (JSON)</label>
                    <textarea
                        value={resolutionData}
                        onChange={(e) => setResolutionData(e.target.value)}
                        style={{
                            height: '200px',
                            padding: '10px',
                            background: 'var(--vscode-input-background)',
                            color: 'var(--vscode-input-foreground)',
                            border: '1px solid var(--vscode-input-border)',
                            fontFamily: 'var(--vscode-editor-font-family), monospace',
                            resize: 'vertical',
                            borderRadius: '2px',
                            width: '100%',
                            boxSizing: 'border-box'
                        }}
                    />
                </div>

                <div style={{ display: 'flex', gap: '10px', alignSelf: 'center', marginTop: '10px' }}>
                    <button
                        onClick={submitResolution}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        {isLoading ? 'Submitting...' : 'Submit Resolution'}
                    </button>
                    <button
                        onClick={resolveAction}
                        disabled={isLoading}
                        style={{
                            padding: '10px 20px',
                            background: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)',
                            border: 'none',
                            borderRadius: '2px',
                            cursor: isLoading ? 'not-allowed' : 'pointer',
                            fontWeight: 'bold',
                            opacity: isLoading ? 0.7 : 1
                        }}
                    >
                        Resolve
                    </button>
                </div>

                {status && (
                    <div style={{
                        marginTop: '20px',
                        padding: '15px',
                        background: 'var(--vscode-editorWidget-background)',
                        border: '1px solid var(--vscode-widget-border)',
                        borderRadius: '4px',
                        fontSize: '0.9em',
                        fontFamily: 'var(--vscode-editor-font-family), monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word'
                    }}>
                        {status}
                    </div>
                )}
            </div>
        </div>
    );
};
