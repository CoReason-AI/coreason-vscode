# CoReason Projection Manifold Architecture

## System Boundaries and Data Flow

```mermaid
stateDiagram-v2
    direction TB

    state "VS Code Realm" {
        FS : VS Code File System
        Node : Extension Host
    }

    state "Webview Realm" {
        React : React Webview
        WASM : ELK Web Worker
    }

    state "Localhost Edge" {
        Python : coreason-runtime
    }

    FS --> Node: YAML/JSON Read
    Node --> FS: YAML/JSON Write
    Node --> React: Extension Intents (IPC)
    React --> Node: Webview Intents (IPC)
    React --> WASM: Layout Graph Request
    WASM --> React: Layout Graph Response
    Python --> React: SSE Telemetry (Port 8000)
    React --> Python: API Requests (Port 8000)
```

## The Zero-Waste Mandate
To maintain a high-performance, predictable execution environment, this project strictly adheres to the Zero-Waste Mandate. A key component of this mandate is how we handle Web Workers. Due to the strict `vscode-webview://` protocol enforced by VS Code, standard URL-based web worker instantiations fail (as the IDE blocks fetching secondary assets via virtual URIs).

To bypass this, we rely on Vite's `?worker&inline` compilation strategy. This forces Vite to compile the worker (such as our ELK WASM layout math engine) into an IIFE Base64 blob string and execute it directly from memory, entirely bypassing the virtual URI fetching restrictions.

## The Dual-Framework Testing Matrix
Given the complex, multi-process nature of the Projection Manifold, testing cannot rely on a single framework. We utilize a Dual-Framework Testing Matrix:

*   **Vitest with jsdom (Pillars 1 & 2):** Used exclusively for pure logic and UI components. It mocks the VS Code API and runs extremely fast, providing immediate feedback during development and CI for our React Webview layer.
*   **Mocha with @vscode/test-electron (Pillar 3):** Used for headless IDE physics. This framework spins up a real instance of VS Code (headless Electron), boots our Node.js Extension Host, and tests the actual integration with the VS Code File System and Extension API. It validates the end-to-end integration points that jsdom cannot accurately simulate.
