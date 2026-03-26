# The Zero-Trust Sandbox (Capability Forge)

## Model Context Protocol (MCP)
Allowing an LLM to execute code autonomously represents an extreme security vulnerability. Our architecture adheres strictly to the **Model Context Protocol (MCP)**, treating all tool execution as constrained `MCPClientIntent` actions rather than raw scripting. The Capability Forge environment allows developers to craft and mock JSON `MCPClientIntent` payloads locally, executing tools deterministically before they are injected into a live Swarm.

## WASM Linear Memory Bounds
The Capability Forge leverages Extism to sandbox `.wasm` binaries. This guarantees deterministic, memory-isolated WebAssembly boundaries. The operational physics governing this boundary are explicitly defined:

1. **Memory Allocation:** The Node.js Host process provisions a strict, linear memory buffer.
2. **Data Marshaling:** The JSON `MCPClientIntent` payload is copied directly into this allocated buffer.
3. **Execution Boundary:** The Guest (the compiled Rust/Go WebAssembly binary) executes the intended operation. During this cycle, the guest context is mathematically blocked and completely sandboxed. It has **zero access** to the VS Code file system, the surrounding DOM context, or network resources (unless specific execution capability flags are explicitly granted).
4. **Buffer Extraction:** The Host process reads the deterministic output directly from the designated output buffer and immediately destroys the Extism WASM instance.
