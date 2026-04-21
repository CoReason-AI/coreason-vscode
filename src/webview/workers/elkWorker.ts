import YAML from 'yaml';
// @ts-ignore
import ELK from 'elkjs/lib/elk-api.js';
// @ts-ignore
import ElkInternalWorker from 'elkjs/lib/elk-worker.min.js?worker&inline';
import { WorkerMessage } from '../../shared/types';

let elkInstance: any = null;

self.onmessage = async (event: MessageEvent) => {
    try {
        if (!elkInstance) {
            const ElkConstructor = (ELK as any).default || ELK;
            if (typeof ElkConstructor !== 'function') {
                throw new Error("ELK constructor is not a function. It resolved to: " + typeof ElkConstructor);
            }
            
            elkInstance = new ElkConstructor({
                workerFactory: function (url: string) {
                    return new ElkInternalWorker();
                }
            });
        }

        const yamlString = event.data;
        if (!yamlString) return;

        const parsedDoc = YAML.parse(yamlString);
        console.log("ELK Worker: Parsed full document:", parsedDoc);
        
        // Support both a full WorkflowManifest (topology nested under 'topology' key)
        // and a flat topology-only document for backward compatibility.
        const yamlData = parsedDoc?.topology ?? parsedDoc;
        console.log("ELK Worker: Extracted topology target:", yamlData);

        if (!yamlData || !yamlData.nodes) {
            console.log("ELK Worker: yamlData.nodes is empty or undefined. Aborting layout.");
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
                if (Array.isArray(edge) && edge.length >= 2) {
                    edges.push({ id: `e-${index}`, sources: [edge[0]], targets: [edge[1]] });
                } else if (edge.source && edge.target) {
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

        const layoutedGraph = await elkInstance.layout(graph);

        const reactFlowNodes = (layoutedGraph.children || []).map((node: any) => ({
            id: node.id,
            position: { x: node.x || 0, y: node.y || 0 },
            data: { label: node.id },
            type: 'agent',
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
        // Now if ELK errors *during* layout, it will be safely caught and
        // the canvas will display the ELK layout error instead of freezing.
        const errorMessage: WorkerMessage = { type: 'ERROR', message: error.message || 'Unknown error' };
        self.postMessage(errorMessage);
    }
};
