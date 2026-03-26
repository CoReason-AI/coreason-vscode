# IPC Protocol

## Cross-Process Communication Physics
The Projection Manifold relies on a strict Inter-Process Communication (IPC) bridge separating the VS Code Extension Host (Node.js) and the React UI (Chromium Webview).
*   **Node.js to Chromium:** The Extension Host pushes data to the Webview using `webview.postMessage(payload)`.
*   **Chromium to Node.js:** The Webview requests data or actions from the Extension Host using the global `vscodeApi.postMessage(payload)`.

## Webview Intents (React -> Host)

| Intent | Description | Payload Structure (Example) |
| :--- | :--- | :--- |
| `READY` | Sent when React has mounted the DOM. | `{ type: 'READY' }` |
| `SET_ROUTE` | Request to change the current application route. | `{ type: 'SET_ROUTE', payload: '/new-route' }` |
| `SET_ORACLE_WORKFLOW` | Request to set the Oracle workflow context. | `{ type: 'SET_ORACLE_WORKFLOW', payload: { id: 'workflow-1' } }` |
| `REQUEST_SYNTHESIS` | Request data synthesis from the Python edge. | `{ type: 'REQUEST_SYNTHESIS', payload: { query: 'summarize' } }` |
| `SCHEMA_UPDATE` | Update the schema structure stored in the Host. | `{ type: 'SCHEMA_UPDATE', payload: { newSchema: { ... } } }` |

## Extension Intents (Host -> React)

| Intent | Description | Payload Structure (Example) |
| :--- | :--- | :--- |
| `REQUEST_SCHEMA` | Request the current schema state from React. | `{ type: 'REQUEST_SCHEMA' }` |
| `OPEN_FILE` | Notify React to display a newly opened file. | `{ type: 'OPEN_FILE', payload: { filePath: '/path/to/file.yaml' } }` |
| `YAML_UPDATE` | Broadcast an update to the underlying YAML data. | `{ type: 'YAML_UPDATE', payload: { newYaml: 'key: value' } }` |
| `EDGE_CREATED` | Notify React that a new edge has been created. | `{ type: 'EDGE_CREATED', payload: { sourceId: 'n1', targetId: 'n2' } }` |

## The READY Handshake
The `READY` intent is critical for ensuring deterministic routing when the Webview boots up. During early development, we encountered intermittent routing failures to the Forge and Oracle components because the Node Host was firing `SET_ROUTE` intents *before* Chromium had finished parsing the React DOM and attaching its event listeners.

To mathematically prevent this race condition, we implemented the `READY` handshake:
1.  The Extension Host spins up the Webview and waits in a blocking state.
2.  The React Webview mounts and fires a single `READY` intent across the IPC bridge.
3.  Upon receiving the `READY` intent, the Extension Host unlocks its queue and transmits the initial state (such as the default route or currently active file).
