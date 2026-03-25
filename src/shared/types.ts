// Strict IPC Message Definitions between Node.js and the React Webview
export type WebviewMessage =
  | { type: 'READY' }
  | { type: 'SCHEMA_UPDATE'; payload: unknown };

export type ExtensionMessage =
  | { type: 'REQUEST_SCHEMA' }
  | { type: 'OPEN_FILE'; target: string };
