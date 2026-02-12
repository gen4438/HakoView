import * as assert from 'assert';
import * as path from 'path';
import * as vscode from 'vscode';

function getActiveViewType(): string | undefined {
  const tab = vscode.window.tabGroups.activeTabGroup.activeTab;
  const input = tab?.input as { viewType?: string } | undefined;
  return input?.viewType;
}

async function waitForActiveViewType(expected: string, timeoutMs: number = 2000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (getActiveViewType() === expected) {
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.strictEqual(getActiveViewType(), expected);
}

suite('Integration: openFromEditor', () => {
  test('opens a .leS file in the voxel viewer from a text editor', async () => {
    const filePath = path.resolve(__dirname, '..', '..', '..', 'tmp', 'grid_11x20x29.leS');
    const uri = vscode.Uri.file(filePath);

    const doc = await vscode.workspace.openTextDocument(uri);
    await vscode.window.showTextDocument(doc, { preview: false });

    await vscode.commands.executeCommand('hakoview.openFromEditor');
    await waitForActiveViewType('hakoview.lesViewer');
  });
});
