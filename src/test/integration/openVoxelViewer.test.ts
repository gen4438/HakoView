import * as vscode from 'vscode';

function collectWebviewViewTypes(): string[] {
  const viewTypes: string[] = [];
  for (const group of vscode.window.tabGroups.all) {
    for (const tab of group.tabs) {
      if (tab.input instanceof vscode.TabInputWebview) {
        viewTypes.push(tab.input.viewType);
      }
    }
  }
  return viewTypes;
}

async function waitForWebviewPanel(
  expectedViewType: string,
  timeoutMs: number = 8000
): Promise<void> {
  const check = () => {
    for (const group of vscode.window.tabGroups.all) {
      for (const tab of group.tabs) {
        if (
          tab.input instanceof vscode.TabInputWebview &&
          (tab.input.viewType === expectedViewType ||
            tab.input.viewType === `mainThreadWebview-${expectedViewType}`)
        ) {
          return true;
        }
      }
    }
    return false;
  };

  if (check()) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    let timeout: NodeJS.Timeout;

    const subscription = vscode.window.tabGroups.onDidChangeTabs(() => {
      if (check()) {
        clearTimeout(timeout);
        subscription.dispose();
        resolve();
      }
    });

    timeout = setTimeout(() => {
      subscription.dispose();
      const seenTypes = collectWebviewViewTypes();
      reject(
        new Error(
          `Timed out waiting for webview panel: ${expectedViewType}. ` +
            `tabs=${JSON.stringify(seenTypes)}`
        )
      );
    }, timeoutMs);
  });
}

suite('Integration: openVoxelViewer', function () {
  this.timeout(10000);

  test('opens an empty voxel viewer panel', async () => {
    // Close all editors first to ensure clean state
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');

    await vscode.commands.executeCommand('hakoview.openVoxelViewer');
    await waitForWebviewPanel('hakoview.viewer');
  });
});
