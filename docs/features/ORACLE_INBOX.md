# Human-AI Boundary Escalation (Epistemic Oracle)

## Markov Blankets
The coreason-runtime is constructed on Karl Friston's principles of **Active Inference**. A Swarm agent operates strictly within a **Markov Blanket**—a mathematical boundary separating its internal state mechanics from the unobservable external world.

During execution, when an agent encounters **Epistemic Uncertainty** (meaning it lacks the tools, context, or confidence to minimize its Expected Free Energy and determine the next valid state), it is mathematically compelled to halt. It must pierce its Markov Blanket to escalate the unresolvable query to the human Topologist. This Human-in-the-Loop (HITL) resolution is handled via the Epistemic Oracle.

## State Hydration Routing
The Epistemic Oracle is the operational interface for navigating human intervention. The precise pipeline of State Hydration Routing is strictly defined:

1. **State Suspension:** The active Swarm agent running on the Python daemon encounters Epistemic Uncertainty, pauses execution, and yields a suspended `workflowId` (e.g., `swarm-run-77a9`).
2. **UI Hydration:** The VS Code native Extension Host detects the suspended workflow. The `OracleTreeProvider` receives the event and hydrates the native Sidebar with the stalled state context.
3. **User Action:** The user selects the suspended workflow from the IDE Sidebar.
4. **IPC Forwarding:** The `OraclePanel.ts` route invokes the IPC bridge, safely tunneling the paused context state across the boundary to the React Webview.
5. **Human Resolution:** The user submits a manual JSON payload via the React UI, which is then securely POSTed back across the `localhost:8000` boundary via the `fetch` API, enabling the state machine to resume operation.
