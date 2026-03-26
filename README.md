# CoReason VS Code Projection Manifold

[![CI](https://github.com/coreason/coreason-vscode/actions/workflows/ci.yml/badge.svg)](https://github.com/coreason/coreason-vscode/actions/workflows/ci.yml)
[![Security](https://github.com/coreason/coreason-vscode/actions/workflows/security.yml/badge.svg)](https://github.com/coreason/coreason-vscode/actions/workflows/security.yml)
[![Codecov](https://codecov.io/gh/coreason/coreason-vscode/branch/main/graph/badge.svg)](https://codecov.io/gh/coreason/coreason-vscode)
[![License: Prosperity 3.0](https://img.shields.io/badge/License-Prosperity_3.0-blue.svg)](https://prosperitylicense.com/versions/3.0.0)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/coreason.coreason-vscode?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=coreason.coreason-vscode)
[![Open VSX](https://img.shields.io/open-vsx/v/coreason/coreason-vscode?label=Open%20VSX)](https://open-vsx.org/extension/coreason/coreason-vscode)
[![Installs](https://img.shields.io/visual-studio-marketplace/i/coreason.coreason-vscode)](https://marketplace.visualstudio.com/items?itemName=coreason.coreason-vscode)

*A Cybernetic Control Surface and Topological Canvas for the coreason-runtime Active Inference mesh.*

## The Feature Grid

- **Topological Manifold:** A zero-intrinsic-state React Flow canvas rendering Directed Cyclic Graphs (DCG) via an ELK WebAssembly layout math engine.
  [➔ Read the Operational Handbook](./docs/features/TDA_CANVAS.md)

- **Zero-Trust Sandbox:** A deterministic Capability Forge executing Model Context Protocol (MCP) intents within strict WebAssembly linear memory boundaries.
  [➔ Read the Operational Handbook](./docs/features/CAPABILITY_FORGE.md)

- **Human-AI Boundary Escalation:** An Epistemic Oracle handling Active Inference Markov Blanket piercing via strict state hydration routing.
  [➔ Read the Operational Handbook](./docs/features/ORACLE_INBOX.md)

- **Tensor-Driven Topology:** A Zero-Waste predictive synthesis render loop powered by local SGLang Tensor engines.
  [➔ Read the Operational Handbook](./docs/features/PREDICTIVE_SYNTHESIS.md)

## Zero-Waste Quickstart

```bash
git clone https://github.com/coreason/coreason-vscode.git
cd coreason-vscode
npm ci
npm run build
npm run watch
# Press F5 in VS Code to launch the Extension Development Host
```

## Installation & Deployment (Side-Loading)

### 1. Packaging the VSIX

To compile the extension into a standalone binary, run the following commands:
```bash
npm ci
npm run build
npx @vscode/vsce package
```

### 2. Installing on Native VS Code

The resulting `.vsix` file can be installed via the Extensions pane. Click on the `...` menu and select **Install from VSIX...**.

### 3. Installing on AI Forks (Antigravity, Cursor, Windsurf)

The extension is fully compatible with modern forks running Engine `^1.90.0`. To install on these IDEs, follow the same "Install from VSIX" step described above.

### 4. The Open VSX Dependency

**Crucial Note:** This extension relies on the `redhat.vscode-yaml` dependency. Because the extension uses this language server, forks that do not connect to the Microsoft Marketplace must resolve this dependency via the Open VSX Registry.

## Local Development & Troubleshooting

When developing or debugging the extension locally (e.g., pressing `F5`), you may encounter some environment-specific issues:

### 1. API Proposal Crashes (e.g., `chatSessionsProvider`)
If the Extension Development Host fails to launch with errors like `Extension ... CANNOT use API proposal: chatSessionsProvider`, it means one of your personally installed extensions is bleeding into the development instance and crashing it. 
**Fix:** We have configured `.vscode/launch.json` to include the `--disable-extensions` flag in its `args` array. This ensures the Host launches in an isolated, clean environment containing only `coreason-vscode`.

### 2. Missing Binary Errors (e.g., `Failed to find the "go" binary`)
If your native VS Code environment has global language extensions enabled (like `golang.go`), they might attempt to activate and crash if their respective binaries aren't found in your system's `PATH`.
**Fix:** Install the missing toolchain on your OS (e.g., `choco install golang`) or disable the offending extension specifically for the `coreason-vscode` workspace in your IDE's Extensions panel.
