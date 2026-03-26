# ADR 0003: IPC Ready Handshake

**Status:** Accepted
**Date:** 2026-04-10

## Context
During initial development, the Oracle and Forge routes intermittently failed to load their content on startup. These routes depend on immediate state injection from the Extension Host upon initialization.

## The Friction
The root cause was a fundamental race condition in the multi-process architecture. The Node.js Extension Host was executing the `SET_ROUTE` (and subsequent initialization intents) much faster than Chromium could fully parse the React DOM, mount components, and attach its `vscodeApi.postMessage` event listeners.

## The Resolution
We implemented deterministic IPC mounting through a strict `READY` beacon handshake. The Extension Host spins up the Webview and immediately enters a blocking queue state. The Chromium React Webview finishes mounting, verifies its listeners are active, and fires a single `READY` intent across the IPC bridge. Once the Host receives the `READY` intent, it unlocks its queue and transmits the pending state, ensuring the Webview never misses an initial route or configuration message.
