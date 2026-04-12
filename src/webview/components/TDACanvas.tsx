import React, { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { ReactFlow, Controls, Background, Node, Edge, Panel, applyNodeChanges, applyEdgeChanges, addEdge, Connection, EdgeChange, NodeChange } from '@xyflow/react';
// @ts-ignore
import '@xyflow/react/dist/style.css';
import { AgentNode } from './AgentNode';
import YAML from 'yaml';
import ElkWorker from '../workers/elkWorker.ts?worker&inline';

import { vscodeApi } from '../vscodeApi';

export const TDACanvas = () => {
    const [rawDoc, setRawDoc] = useState<string>('');
    const [userPrompt, setUserPrompt] = useState<string>('');
    const [isSynthesizing, setIsSynthesizing] = useState<boolean>(false);
    const [toastMessage, setToastMessage] = useState<string | null>(null);
    const [ghostCursor, setGhostCursor] = useState<{x: number, y: number} | null>(null);
    const [nodes, setNodes] = useState<Node[]>([{
        id: 'debug-init',
        position: { x: 50, y: 50 },
        data: { label: 'Awaiting Extension Telemetry...' },
        type: 'agent'
    }]);
    const [edges, setEdges] = useState<Edge[]>([]);

    // History state for Undo/Redo (Backward/Forward)
    const historyRef = useRef<string[]>([]);
    const currentIndexRef = useRef<number>(-1);
    const [canUndo, setCanUndo] = useState(false);
    const [canRedo, setCanRedo] = useState(false);

    const worker = useMemo(() => new ElkWorker(), []);
    const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

    const pushToHistory = useCallback((newDoc: string) => {
        if (historyRef.current[currentIndexRef.current] === newDoc) return;
        const newHistory = historyRef.current.slice(0, currentIndexRef.current + 1);
        newHistory.push(newDoc);
        historyRef.current = newHistory;
        currentIndexRef.current = newHistory.length - 1;
        setCanUndo(currentIndexRef.current > 0);
        setCanRedo(false);
    }, []);

    const handleUndo = useCallback(() => {
        if (currentIndexRef.current > 0) {
            const newIndex = currentIndexRef.current - 1;
            currentIndexRef.current = newIndex;
            const doc = historyRef.current[newIndex];
            setRawDoc(doc);
            vscodeApi.postMessage({ type: 'WRITE_DOCUMENT', payload: doc });
            worker.postMessage(doc);
            setCanUndo(newIndex > 0);
            setCanRedo(true);
        }
    }, [worker]);

    const handleRedo = useCallback(() => {
        if (currentIndexRef.current < historyRef.current.length - 1) {
            const newIndex = currentIndexRef.current + 1;
            currentIndexRef.current = newIndex;
            const doc = historyRef.current[newIndex];
            setRawDoc(doc);
            vscodeApi.postMessage({ type: 'WRITE_DOCUMENT', payload: doc });
            worker.postMessage(doc);
            setCanUndo(true);
            setCanRedo(newIndex < historyRef.current.length - 1);
        }
    }, [worker]);

    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);

    const handleSynthesize = useCallback(() => {
        if (isSynthesizing) return;
        setIsSynthesizing(true);
        vscodeApi.postMessage({ type: 'REQUEST_SYNTHESIS', payload: { user_prompt: userPrompt } });
    }, [userPrompt, isSynthesizing]);

    const onConnect = useCallback((connection: Connection) => {
        setEdges((eds) => addEdge({ ...connection, id: `e-${Date.now()}` }, eds));

        try {
            const yamlData = YAML.parse(rawDoc);
            // Support WorkflowManifest (edges under topology) and flat topology docs
            const topologyTarget = yamlData?.topology ?? yamlData;
            if (!topologyTarget.edges) topologyTarget.edges = [];

            topologyTarget.edges.push([connection.source, connection.target]);

            const isJson = rawDoc.trim().startsWith('{');
            const newDoc = isJson ? JSON.stringify(yamlData, null, 2) : YAML.stringify(yamlData);

            setRawDoc(newDoc);
            pushToHistory(newDoc);
            vscodeApi.postMessage({ type: 'WRITE_DOCUMENT', payload: newDoc });
        } catch (e: any) {
            console.error("Failed to serialize edge creation:", e);
        }
    }, [rawDoc]);

    useEffect(() => {
        const handleMessage = async (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'YAML_UPDATE') {
                if (!message.payload) return;
                setRawDoc(message.payload);
                pushToHistory(message.payload);
                setIsSynthesizing(false);
                worker.postMessage(message.payload);
                setToastMessage(`YAML Updated (${message.payload.length} bytes)`);
                setTimeout(() => setToastMessage(null), 3000);
            } else if (message.type === 'SYNTHESIS_ERROR' || message.type === 'SYNTHESIS_DONE') {
                setIsSynthesizing(false);
                if (message.payload) {
                    setToastMessage(message.payload);
                    setTimeout(() => setToastMessage(null), 3000);
                }
            } else if (message.type === 'SYNTHESIS_STATUS') {
                setToastMessage(message.payload);
            } else if (message.type === 'TAXONOMIC_RESTRUCTURE') {
                setToastMessage(`Restructuring Workspace UI applying topology heuristic: ${message.payload.heuristic}`);
                setTimeout(() => setToastMessage(null), 3000);
                worker.postMessage(rawDoc); 
            } else if (message.type === 'SPATIAL_KINEMATIC') {
                const targetCoordinate = message.payload.target_coordinate || message.payload.terminal_coordinate;
                if (targetCoordinate) {
                    setGhostCursor({ x: targetCoordinate.x, y: targetCoordinate.y });
                    setTimeout(() => setGhostCursor(null), message.payload.trajectory_duration_ms || 1000);
                }
                setToastMessage(`Spatial Kinematic Execution mapping boundary: [${message.payload.action_class || message.payload.action}]`);
                setTimeout(() => setToastMessage(null), 3000);
            }
        };
        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [worker]);

    useEffect(() => {
        worker.onmessage = (event: MessageEvent) => {
            if (event.data.type === 'LAYOUT_COMPLETE') {
                setNodes(event.data.nodes);
                setEdges(event.data.edges);
            } else if (event.data.type === 'ERROR') {
                console.error("ELK Layout Error:", event.data.message);
                setNodes([{
                    id: 'error',
                    position: { x: 50, y: 50 },
                    data: { label: `ELK Error: ${event.data.message}` },
                    type: 'agent'
                }]);
            }
        };
    }, [worker]);

    return (
        <div style={{ width: '100vw', height: '100vh', position: 'relative' }}>
            {ghostCursor && (
                <div style={{
                    position: 'absolute',
                    left: ghostCursor.x,
                    top: ghostCursor.y,
                    width: '12px',
                    height: '12px',
                    borderRadius: '50%',
                    backgroundColor: 'rgba(255, 100, 100, 0.8)',
                    border: '2px solid white',
                    boxShadow: '0 0 10px rgba(255,100,100,0.5)',
                    zIndex: 9999,
                    pointerEvents: 'none',
                    transition: 'all 0.3s ease'
                }} />
            )}
            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                fitView
                colorMode="dark"
            >
                <Panel position="bottom-center">
                    <div style={{
                        display: 'flex',
                        flexDirection: 'row',
                        gap: '8px',
                        alignItems: 'center',
                        background: 'var(--vscode-input-background)',
                        padding: '8px 16px',
                        borderRadius: '24px',
                        border: '1px solid var(--vscode-widget-border, #444)',
                        boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                        width: '600px',
                        marginBottom: '24px'
                    }}>
                        <textarea
                            placeholder="Prompt: Build a multi-agent scraping swarm..."
                            value={userPrompt}
                            onChange={(e) => setUserPrompt(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    handleSynthesize();
                                }
                            }}
                            rows={1}
                            style={{
                                flex: 1,
                                padding: '8px',
                                border: 'none',
                                background: 'transparent',
                                color: 'var(--vscode-input-foreground)',
                                minHeight: '24px',
                                maxHeight: '350px',
                                fontFamily: 'inherit',
                                resize: 'vertical',
                                outline: 'none',
                                overflowY: 'auto'
                            }}
                        />
                        <button
                            onClick={handleSynthesize}
                            disabled={isSynthesizing}
                            style={{
                                background: 'var(--vscode-button-background)',
                                color: 'var(--vscode-button-foreground)',
                                border: 'none',
                                padding: '8px 16px',
                                cursor: isSynthesizing ? 'wait' : 'pointer',
                                fontWeight: 'bold',
                                borderRadius: '18px',
                                opacity: isSynthesizing ? 0.7 : 1,
                                display: 'flex',
                                alignItems: 'center',
                                gap: '6px'
                            }}
                        >
                            {isSynthesizing ? '⏳' : '✨ Generate'}
                        </button>
                    </div>
                </Panel>
                <Panel position="top-left">
                    <div style={{ display: 'flex', gap: '8px' }}>
                        <button
                            onClick={handleUndo}
                            disabled={!canUndo}
                            style={{
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: '1px solid var(--vscode-button-border, transparent)',
                                padding: '8px 12px',
                                cursor: canUndo ? 'pointer' : 'not-allowed',
                                opacity: canUndo ? 1 : 0.5,
                                borderRadius: '4px'
                            }}
                        >
                            ◀ Backward
                        </button>
                        <button
                            onClick={handleRedo}
                            disabled={!canRedo}
                            style={{
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: '1px solid var(--vscode-button-border, transparent)',
                                padding: '8px 12px',
                                cursor: canRedo ? 'pointer' : 'not-allowed',
                                opacity: canRedo ? 1 : 0.5,
                                borderRadius: '4px'
                            }}
                        >
                            Forward ▶
                        </button>
                        <button
                            onClick={() => vscodeApi.postMessage({ type: 'READY' })}
                            style={{
                                background: 'var(--vscode-button-secondaryBackground)',
                                color: 'var(--vscode-button-secondaryForeground)',
                                border: '1px solid var(--vscode-button-border, transparent)',
                                padding: '8px 12px',
                                cursor: 'pointer',
                                borderRadius: '4px'
                            }}
                        >
                            🔄 Refresh
                        </button>
                    </div>
                </Panel>
                <Panel position="top-right">
                    {toastMessage && (
                        <div style={{
                            background: 'var(--vscode-button-background, #007acc)',
                            color: 'var(--vscode-button-foreground, white)',
                            padding: '6px 12px',
                            borderRadius: '4px',
                            boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                            fontSize: '12px',
                            fontWeight: 'bold',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '6px',
                            transition: 'opacity 0.3s ease-in-out'
                        }}>
                            <span>📌</span> {toastMessage}
                        </div>
                    )}
                </Panel>
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};