# Predictive Keystroke Bias

1. **Webview Bias:** If operating in `src/webview/`, prioritize `@xyflow/react` hooks (`useNodes`, `useEdges`) and assume the global presence of `vscodeApi.postMessage` for outbound communication.
2. **Extension Host Bias:** If operating in `src/extension/`, prioritize `vscode.WorkspaceEdit` for all document mutations. Never attempt to use `document.getElementById` or React imports.
3. **Testing Bias:** If operating in `src/test/`, recognize the dual-framework matrix. Use `Vitest` with `jsdom` for UI component testing (Pillar 1/2) and `Mocha` with `@vscode/test-electron` for headless IDE integration testing (Pillar 3).
