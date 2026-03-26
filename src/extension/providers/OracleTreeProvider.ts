import * as vscode from 'vscode';

export class OracleTreeProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | void> = this._onDidChangeTreeData.event;

    constructor() {}

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
            // Root items - mock stalled workflows
            const item = new vscode.TreeItem("swarm-run-77a9", vscode.TreeItemCollapsibleState.None);
            item.command = {
                command: 'coreason.resolveOracle',
                title: 'Resolve',
                arguments: [item.label]
            };
            return Promise.resolve([item]);
        }
    }
}
