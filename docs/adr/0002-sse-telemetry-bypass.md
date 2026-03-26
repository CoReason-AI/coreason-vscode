# ADR 0002: SSE Telemetry Bypass

**Status:** Accepted
**Date:** 2026-04-10

## Context
We need to stream high-frequency LLM tokens (real-time thoughts) to the visual agents. These streams are crucial for dynamic feedback but generate thousands of events within seconds.

## The Friction
Initially, we attempted to pipe these thousands of `TokenStreamChunk` events through the standard Node.js Inter-Process Communication (IPC) bridge. The sheer volume of this data transmission overwhelmed the IPC channel, causing severe lockups and freezing the entire IDE environment.

## The Resolution
We chose to bypass the IPC bridge entirely. By unsealing the Webview's Content Security Policy (CSP), we permitted the React UI (Chromium) to establish a direct connection to the Python daemon (running on Localhost Port 8000) using Server-Sent Events (SSE). This offloads the high-frequency telemetry from the Node.js Host, ensuring the IDE remains perfectly responsive while streaming thousands of tokens.
