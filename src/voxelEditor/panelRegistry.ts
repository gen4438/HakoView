import * as vscode from 'vscode';

/**
 * Hakoviewパネルの登録情報
 */
interface RegisteredPanel {
  panel: vscode.WebviewPanel;
  webview: vscode.Webview;
}

const panels = new Set<RegisteredPanel>();

/**
 * ビューアパネルをレジストリに登録
 */
export function registerViewerPanel(panel: vscode.WebviewPanel): void {
  const entry: RegisteredPanel = { panel, webview: panel.webview };
  panels.add(entry);

  panel.onDidDispose(() => {
    panels.delete(entry);
  });
}

/**
 * 指定されたビューカラムにある、指定パネル以外のビューアを検索
 */
export function findOtherPanelInColumn(
  column: vscode.ViewColumn | undefined,
  exclude: vscode.WebviewPanel
): RegisteredPanel | undefined {
  if (column === undefined) {
    return undefined;
  }
  for (const entry of panels) {
    if (entry.panel !== exclude && entry.panel.viewColumn === column && entry.panel.visible) {
      return entry;
    }
  }
  return undefined;
}
