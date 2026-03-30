import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { ReactFlow, Controls, Background, Node, Edge, Panel, applyNodeChanges, applyEdgeChanges, addEdge, Connection, EdgeChange, NodeChange } from '@xyflow/react';
// @ts-ignore
import '@xyflow/react/dist/style.css';
import { AgentNode } from './AgentNode';
import YAML from 'yaml';
import ElkWorker from '../workers/elkWorker.ts?worker&inline';

import { vscodeApi } from '../vscodeApi';

export const TDACanvas = () => {
    const [rawDoc, setRawDoc] = useState<string>('');
    const [nodes, setNodes] = useState<Node[]>([{
        id: 'debug-init',
        position: { x: 50, y: 50 },
        data: { label: 'Awaiting Extension Telemetry...' },
        type: 'agent'
    }]);
    const [edges, setEdges] = useState<Edge[]>([]);

    const worker = useMemo(() => new ElkWorker(), []);
    const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

    const onNodesChange = useCallback((changes: NodeChange[]) => setNodes((nds) => applyNodeChanges(changes, nds)), []);
    const onEdgesChange = useCallback((changes: EdgeChange[]) => setEdges((eds) => applyEdgeChanges(changes, eds)), []);
    
    const onConnect = useCallback((connection: Connection) => {
        setEdges((eds) => addEdge({ ...connection, id: `e-${Date.now()}` }, eds));
        
        try {
            const yamlData = YAML.parse(rawDoc);
            if (!yamlData.edges) yamlData.edges = [];
            
            yamlData.edges.push([connection.source, connection.target]);
            
            const isJson = rawDoc.trim().startsWith('{');
            const newDoc = isJson ? JSON.stringify(yamlData, null, 2) : YAML.stringify(yamlData);
            
            setRawDoc(newDoc);
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
                worker.postMessage(message.payload);
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
                    <button
                        onClick={() => vscodeApi.postMessage({ type: 'REQUEST_SYNTHESIS' })}
                        style={{
                            background: 'var(--vscode-button-background)',
                            color: 'var(--vscode-button-foreground)',
                            border: 'none',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            fontWeight: 'bold',
                            borderRadius: '2px',
                            boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                        }}
                    >
                        ✨ Synthesize Next Agent
                    </button>
                </Panel>
                <Panel position="top-left">
                    <button
                        onClick={() => vscodeApi.postMessage({ type: 'READY' })}
                        style={{
                            background: 'var(--vscode-button-secondaryBackground)',
                            color: 'var(--vscode-button-secondaryForeground)',
                            border: '1px solid var(--vscode-button-border, transparent)',
                            padding: '8px 12px',
                            cursor: 'pointer',
                            borderRadius: '2px'
                        }}
                    >
                        🔄 Force Refresh Topology
                    </button>
                </Panel>
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};