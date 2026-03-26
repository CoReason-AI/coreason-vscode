import React, { useEffect, useMemo, useState } from 'react';
import { ReactFlow, Controls, Background, Node, Edge } from '@xyflow/react';
// @ts-ignore
import '@xyflow/react/dist/style.css';

export const TDACanvas = () => {
    const [nodes, setNodes] = useState<Node[]>([]);
    const [edges, setEdges] = useState<Edge[]>([]);

    const worker = useMemo(() => new Worker(new URL('../workers/elkWorker.ts', import.meta.url), { type: 'module' }), []);

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
            <ReactFlow nodes={nodes} edges={edges} fitView colorMode="dark">
                <Background />
                <Controls />
            </ReactFlow>
        </div>
    );
};