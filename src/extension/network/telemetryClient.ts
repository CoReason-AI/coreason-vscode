import * as http from 'http';
import { EventEmitter } from 'events';
import * as vscode from 'vscode';
import { resumeOracleWorkflow } from './edgeClient';

export class TelemetryClient extends EventEmitter {
    private retryCount = 0;
    private maxRetries = 10;
    private baseRetryDelayMs = 1000;
    private isConnected = false;

    constructor() {
        super();
    }

    public connect() {
        if (this.isConnected) return;

        const port = vscode.workspace.getConfiguration('coreason.telemetry').get('meshPort') || 8000;
        const url = `http://localhost:${port}/api/v1/telemetry/stream`;

        console.log(`[TelemetryClient] Connecting to SSE stream at ${url}...`);

        const request = http.get(url, (res) => {
            if (res.statusCode !== 200) {
                console.error(`[TelemetryClient] Failed to connect, status code: ${res.statusCode}`);
                this.scheduleReconnect();
                return;
            }

            this.isConnected = true;
            this.retryCount = 0;
            console.log('[TelemetryClient] Connected successfully.');

            let buffer = '';

            res.on('data', (chunk: Buffer) => {
                buffer += chunk.toString('utf8');

                let boundary = buffer.indexOf('\n\n');
                while (boundary !== -1) {
                    const message = buffer.slice(0, boundary).trim();
                    buffer = buffer.slice(boundary + 2);

                    if (message.startsWith('data:')) {
                        const dataStr = message.slice(5).trim();
                        if (dataStr) {
                            try {
                                const event = JSON.parse(dataStr);
                                this.handleEvent(event);
                            } catch (e) {
                                // Error parsing JSON chunk, likely noise or incomplete data not following SSE perfectly, ignore.
                            }
                        }
                    }

                    boundary = buffer.indexOf('\n\n');
                }
            });

            res.on('end', () => {
                console.log('[TelemetryClient] Connection ended by server.');
                this.isConnected = false;
                this.scheduleReconnect();
            });

            res.on('error', (err) => {
                console.error(`[TelemetryClient] Connection error: ${err.message}`);
                this.isConnected = false;
                this.scheduleReconnect();
            });
        });

        request.on('error', (err) => {
            console.error(`[TelemetryClient] Request error: ${err.message}`);
            this.isConnected = false;
            this.scheduleReconnect();
        });

        request.end();
    }

    private handleEvent(event: any) {
        if (!event || !event.event_type) return;

        if (event.event_type === 'TokenStreamChunk' || event.event_type === 'NodeStartedEvent') {
            // Markov Filter: Drop noise
            return;
        }

        if (event.event_type === 'AgentSuspendedEvent') {
            const workflowId = event.workflow_id;
            const latentState = event.latent_state;
            const intent = event.failed_intent || event.intent; // Handle both possibilities based on prompt language

            console.log(`[TelemetryClient] Trap triggered! Agent suspended for workflow ${workflowId}.`);
            this.emit('agent_suspended', workflowId, latentState, intent);
        }

        if (event.event_type === 'AgentResumedEvent') {
            this.emit('agent_resumed', event.workflow_id);
        }
    }

    public async resumeWorkflow(workflowId: string, correctedIntent: any): Promise<void> {
        const success = await resumeOracleWorkflow(workflowId, JSON.stringify(correctedIntent));
        if (success) {
            this.emit('agent_resumed', workflowId);
        }
    }

    private scheduleReconnect() {
        this.isConnected = false;
        if (this.retryCount >= this.maxRetries) {
            console.error(`[TelemetryClient] Max retries (${this.maxRetries}) reached. Stopping reconnect attempts.`);
            return;
        }

        const delay = Math.min(30000, this.baseRetryDelayMs * Math.pow(2, this.retryCount));
        this.retryCount++;

        console.log(`[TelemetryClient] Attempting to reconnect in ${delay}ms (Attempt ${this.retryCount}/${this.maxRetries})...`);

        setTimeout(() => {
            this.connect();
        }, delay);
    }
}
