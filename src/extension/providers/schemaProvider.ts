import * as vscode from 'vscode';
import { fetchTopologySchema } from '../network/edgeClient';
import * as path from 'path';

export class CoreasonSchemaProvider implements vscode.TextDocumentContentProvider {
    public onDidChangeEmitter = new vscode.EventEmitter<vscode.Uri>();
    public onDidChange = this.onDidChangeEmitter.event;

    async provideTextDocumentContent(uri: vscode.Uri): Promise<string> {
        const schema = await fetchTopologySchema();
        if (typeof schema === 'string') {
            return schema;
        }

        const fallbackPath = path.join(__dirname, '..', 'assets', 'fallback.schema.json');
        const fallbackUri = vscode.Uri.file(fallbackPath);
        const fileData = await vscode.workspace.fs.readFile(fallbackUri);
        return Buffer.from(fileData).toString('utf8');
    }
}
