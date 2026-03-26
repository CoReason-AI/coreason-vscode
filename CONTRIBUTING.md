# Topologist Onboarding Protocol

## Booting the Physics
Development within the CoReason Projection Manifold requires the orchestration of a "Dual-Process Loop". Because this architecture splits across a Node.js Host and a Chromium Webview, you must run the following command to manage the environment deterministically:

```bash
npm run watch
```

This command concurrently boots:
1. **Vite:** Handles the React Webview compilation and Hot Module Replacement (HMR).
2. **ESBuild:** Compiles the Node.js Extension Host into `dist/extension.js`.

## The Verification Matrix
The multi-process physics of the IDE mandate strict testing boundaries. Do not rely on a monolithic test command. You must understand the Three Pillars of Testing:

*   **Pillars 1 & 2 (The Math & Canvas):** For instantaneous, offline-capable unit testing of pure logic and React components, use `npm run test` (Vitest + jsdom). This executes exclusively within a mocked DOM context.
*   **Pillar 3 (Headless IDE Physics):** To physically boot Chromium and test the Virtual File System, Native APIs, and the Inter-Process Communication (IPC) bridge, use `npm run test:e2e` (Mocha + `@vscode/test-electron`). This tests the actual end-to-end integration boundaries.

## Strict PR Compliance
To maintain the mathematical and operational integrity of the repository, all Pull Requests are subject to rigorous automated gating. A Pull Request will only be authorized for merge if it successfully passes the multi-OS GitHub Actions CI matrix (which includes testing on Ubuntu via `xvfb` for headless environments) and explicitly maintains or improves the V8 Codecov coverage threshold.
