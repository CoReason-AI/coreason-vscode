import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Controls, Background, Node, Edge, Panel } from '@xyflow/react';
// @ts-ignore
import '@xyflow/react/dist/style.css';
import ElkWorker from '../workers/elkWorker.ts?worker&inline';
import { AgentNode } from './AgentNode';

import { vscodeApi } from '../vscodeApi';

export const TDACanvas = () => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    const worker = useMemo(() => new ElkWorker(), []);
    const nodeTypes = useMemo(() => ({ agent: AgentNode }), []);

    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'YAML_UPDATE') {
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
            }
        };
    }, [worker]);

    return (
        <div style={{ width: '100vw', height: '100vh' }}>
            <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView colorMode="dark">
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
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};