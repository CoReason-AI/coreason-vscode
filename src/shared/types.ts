// Strict IPC Message Definitions between Node.js and the React Webview
export type WebviewMessage =
  | { type: 'READY' }
  | { type: 'SCHEMA_UPDATE'; payload: unknown }
  | { type: 'SET_ROUTE'; payload: 'MANIFOLD' | 'FORGE' | 'ORACLE' }
  | { type: 'SET_ORACLE_WORKFLOW'; payload: string }
  | { type: 'EDGE_CREATED'; payload: { source: string; target: string } }
  | { type: 'REQUEST_SYNTHESIS' };

export type ExtensionMessage =
  | { type: 'REQUEST_SCHEMA' }
  | { type: 'OPEN_FILE'; target: string }
  | { type: 'YAML_UPDATE'; payload: string };

export type WorkerMessage =
  | { type: 'LAYOUT_COMPLETE'; nodes: any[]; edges: any[] }
  | { type: 'ERROR'; message: string };
