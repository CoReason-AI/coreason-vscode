# ADR 0001: Blob-Inlined Web Workers

**Status:** Accepted
**Date:** 2026-04-10

## Context
Our ELK WASM layout math engine is computationally heavy. Running these calculations directly on the Chromium Webview's UI thread would freeze the interface entirely when rendering complex Directed Cyclic Graphs. To preserve a responsive UI, we decided to offload this processing to a dedicated background Web Worker.

## The Friction
When using a standard, URL-based Web Worker in Vite (e.g., `import Worker from './worker.js?worker'`), the `vscode-webview://` protocol strictness caused immediate failures. The VS Code extension host deliberately blocks secondary asset fetching from the virtual URI to maintain strict security boundaries, preventing the worker script from loading.

## The Resolution
We resolved this by forcing Vite to compile the worker into an IIFE Base64 blob string using the `?worker&inline` parameter. This method bypasses the URI fetching restrictions completely. The Web Worker code is embedded as a data URI string directly in our bundled JavaScript. When instantiated, the string is executed entirely from memory, circumventing the host's strict virtual filesystem constraints and keeping the UI thread fluid.
