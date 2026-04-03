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
            } else if (message.type === 'SYNTHESIS_ERROR' || message.type === 'SYNTHESIS_DONE') {
                setIsSynthesizing(false);
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
                    position: {x: 50, y: 50},
                    data: {label: `ELK Error: ${event.data.message}`},
                    type: 'agent'
                }]);
            }
        };
    }, [worker]);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
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
                <Panel position="top-right">
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', alignItems: 'flex-end' }}>
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
                            style={{
                                padding: '8px',
                                borderRadius: '4px',
                                border: '1px solid var(--vscode-input-border)',
                                background: 'var(--vscode-input-background)',
                                color: 'var(--vscode-input-foreground)',
                                width: '250px',
                                minHeight: '70px',
                                fontFamily: 'inherit',
                                resize: 'vertical'
                            }}
                        />
                        <button
                            onClick={handleSynthesize}
                            disabled={isSynthesizing}
                            style={{
                                background: 'var(--vscode-button-background)',
                                color: 'var(--vscode-button-foreground)',
                                border: 'none',
                                padding: '8px 12px',
                                cursor: isSynthesizing ? 'wait' : 'pointer',
                                fontWeight: 'bold',
                                borderRadius: '4px',
                                boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                                opacity: isSynthesizing ? 0.7 : 1
                            }}
                        >
                            {isSynthesizing ? '⏳ Synthesizing...' : '✨ Synthesize Next Agent'}
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
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};