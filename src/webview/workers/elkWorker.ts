import YAML from 'yaml';
// @ts-ignore
import ELK from 'elkjs/lib/elk.bundled.js';
import { WorkerMessage } from '../../shared/types';

const elk = new ELK();

self.onmessage = async (event: MessageEvent) => {
    try {
        const yamlString = event.data;
        if (!yamlString) return;

        const yamlData = YAML.parse(yamlString);
        if (!yamlData || !yamlData.nodes) {
            return;
        }

        const nodes: any[] = [];
        const edges: any[] = [];

        if (yamlData.nodes && typeof yamlData.nodes === 'object') {
            for (const key of Object.keys(yamlData.nodes)) {
                nodes.push({ id: key, width: 250, height: 100 });
            }
        }

        if (yamlData.edges && Array.isArray(yamlData.edges)) {
            yamlData.edges.forEach((edge: any, index: number) => {
                if (edge.source && edge.target) {
                    edges.push({
                        id: edge.id || `e-${index}`,
                        sources: [edge.source],
                        targets: [edge.target],
                    });
                }
            });
        }

        const graph = {
            id: 'root',
            layoutOptions: { 'elk.algorithm': 'layered', 'elk.direction': 'RIGHT' },
            children: nodes,
            edges: edges,
        };

        const layoutedGraph = await elk.layout(graph);

        const reactFlowNodes = (layoutedGraph.children || []).map((node: any) => ({
            id: node.id,
            position: { x: node.x || 0, y: node.y || 0 },
            data: { label: node.id },
            type: 'default',
        }));

        const reactFlowEdges = (layoutedGraph.edges || []).map((edge: any) => ({
            id: edge.id,
            source: edge.sources[0],
            target: edge.targets[0],
        }));

        const message: WorkerMessage = {
            type: 'LAYOUT_COMPLETE',
            nodes: reactFlowNodes,
            edges: reactFlowEdges,
        };

        self.postMessage(message);
    } catch (error: any) {
        const errorMessage: WorkerMessage = { type: 'ERROR', message: error.message || 'Unknown error' };
        self.postMessage(errorMessage);
    }
};