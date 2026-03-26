# The Topological Manifold (TDA Canvas)

## Directed Cyclic Graphs (DCG)
While traditional workflow orchestrators rely on Directed Acyclic Graphs (DAGs) to push execution strictly forward, cognitive architectures (Swarms) require a different mathematical foundation. Agents must engage in critique loops, self-reflection, and recursive routing. This necessitates the rendering of **Directed Cyclic Graphs (DCGs)**.

Rendering DCGs with orthogonal edge routing is a computationally explosive task (NP-Hard routing constraints). Executing this math on the Chromium UI thread causes severe frame-rate degradation. Therefore, our architecture relies on the Eclipse Layout Kernel (ELK) compiled to WebAssembly (`elkjs`), which is strictly isolated and executed within a debounced Web Worker.

## The CST Bi-Directional Lens
The React Flow canvas possesses **zero intrinsic state**. It is not a data store; it is exclusively a visual projection of the underlying YAML file acting as a Concrete Syntax Tree (CST) lens. Unlike an AST, a CST preserves YAML comments and whitespace.

When a user interacts with the canvas (e.g., dragging an edge to connect two agents), the system does not update a local React state object. Instead, the mathematical physics are as follows:
1. The interaction maps the canvas coordinate to a specific CST array index.
2. The Webview sends a mutation intent across the IPC bridge to the Node.js Host.
3. The Host triggers a strict `vscode.WorkspaceEdit` to mutate the underlying YAML document on disk.
4. The file system change emits an event, closing the loop by re-rendering the updated CST projection on the canvas.
