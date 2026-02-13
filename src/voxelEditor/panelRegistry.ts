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

/**
 * 指定グループ以外にあるPreview ModeのhakoviewタブをInspect
 * @param excludeColumn 除外するビューカラム（通常は新しいパネルのカラム）
 * @returns Preview Modeのタブとそのグループのビューカラム、見つからない場合はundefined
 */
export function findPreviewTabInOtherGroup(
  excludeColumn: vscode.ViewColumn | undefined
): { tab: vscode.Tab; viewColumn: vscode.ViewColumn } | undefined {
  if (excludeColumn === undefined) {
    return undefined;
  }

  for (const tabGroup of vscode.window.tabGroups.all) {
    if (tabGroup.viewColumn === excludeColumn) {
      continue;
    }
    for (const tab of tabGroup.tabs) {
      if (
        tab.input instanceof vscode.TabInputCustom &&
        tab.input.viewType === 'hakoview.lesViewer' &&
        tab.isPreview
      ) {
        return { tab, viewColumn: tabGroup.viewColumn };
      }
    }
  }
  return undefined;
}
