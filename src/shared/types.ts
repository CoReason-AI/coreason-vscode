// Strict IPC Message Definitions between Node.js and the React Webview
export interface SandboxTelemetry {
  latency_ns: number;
  peak_memory_bytes: number;
}

export interface SandboxLogs {
  stdout: string;
  stderr: string;
}

export interface SandboxReceipt {
  intent_hash: string;
  success: boolean;
  output?: string | Record<string, any>;
  telemetry?: SandboxTelemetry;
  logs?: SandboxLogs;
  error?: string;
}

export type WebviewMessage =
  | { type: 'READY' }
  | { type: 'SCHEMA_UPDATE'; payload: unknown }
  | { type: 'SET_ROUTE'; payload: 'MANIFOLD' | 'FORGE' | 'ORACLE' }
  | { type: 'SET_ORACLE_WORKFLOW'; payload: string }
  | { type: 'EDGE_CREATED'; payload: { source: string; target: string } }
  | { type: 'REQUEST_SYNTHESIS' }
  | { type: 'CRYSTALLIZE_TEST'; payload: { capability: string; state: string; intent: string; output: string } }
  | { type: 'OVERRIDE_AGENT_INTENT'; payload: { workflowId: string; correctedIntent: string } }
  | {
      type: 'AGENT_SUSPENDED';
      payload: {
        isAgentDriving: boolean;
        workflowId?: string;
        latentState?: any;
        intent?: any;
      }
    }
  | { type: 'EXECUTE_CAPABILITY'; payload: { toolName: string; intent: any } };

export type ExtensionMessage =
  | { type: 'REQUEST_SCHEMA' }
  | { type: 'OPEN_FILE'; target: string }
  | { type: 'YAML_UPDATE'; payload: string }
  | { type: 'SET_AGENT_DRIVING'; payload: boolean }
  | { type: 'CAPABILITY_EXECUTED'; payload: SandboxReceipt };

export type WorkerMessage =
  | { type: 'LAYOUT_COMPLETE'; nodes: any[]; edges: any[] }
  | { type: 'ERROR'; message: string };
