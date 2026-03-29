import * as vscode from 'vscode';
import { TelemetryClient } from '../network/telemetryClient';

export class OracleTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;
    private suspendedRuns = new Map<string, any>();

    constructor(private telemetryClient: TelemetryClient) {
        this.telemetryClient.on('agent_suspended', (id, state, intent) => this.handleSuspended(id, { state, intent }));
        this.telemetryClient.on('agent_resumed', (id) => this.handleResumed(id));
    }

    public handleSuspended(workflowId: string, data: any) {
        this.suspendedRuns.set(workflowId, data);
        this.refresh();
    }

    public handleResumed(workflowId: string) {
        this.suspendedRuns.delete(workflowId);
        this.refresh();
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (element) {
            return Promise.resolve([]);
        } else {
            const items: vscode.TreeItem[] = [];
            for (const workflowId of this.suspendedRuns.keys()) {
                const item = new vscode.TreeItem(workflowId, vscode.TreeItemCollapsibleState.None);
                item.command = {
                    command: 'coreason.resolveOracle',
                    title: 'Resolve',
                    arguments: [workflowId]
                };
                items.push(item);
            }
            return Promise.resolve(items);
        }
    }
}
