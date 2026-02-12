import * as vscode from 'vscode';
import { getWebviewHtml } from '../voxelEditor/getWebviewHtml';
import { LesParser } from '../voxelParser/LesParser';
import type { VoxelDataset } from '../voxelParser/VoxelData';
import {
  clearViewer,
  sendError,
  sendVoxelData,
  WebviewToExtensionMessage,
} from '../voxelEditor/messaging';
import { ParseError } from '../voxelParser/validation';
import { registerViewerPanel } from '../voxelEditor/panelRegistry';

function getErrorMessage(error: unknown): string {
  if (error instanceof ParseError) {
    return `Failed to parse voxel file: ${error.message}`;
  }
  if (error instanceof Error) {
    return `Failed to load voxel file: ${error.message}`;
  }
  return `Failed to load voxel file: ${String(error)}`;
}

export function registerOpenVoxelViewerCommand(
  context: vscode.ExtensionContext
): vscode.Disposable {
  return vscode.commands.registerCommand('hakoview.openVoxelViewer', () => {
    const targetColumn = vscode.window.activeTextEditor
      ? vscode.ViewColumn.Active
      : vscode.ViewColumn.One;
    const panel = vscode.window.createWebviewPanel(
      'hakoview.viewer',
      'Voxel Viewer',
      targetColumn,
      {
        enableScripts: true,
        retainContextWhenHidden: true,
      }
    );

    panel.webview.html = getWebviewHtml({
      webview: panel.webview,
      extensionUri: context.extensionUri,
    });

    // パネルをレジストリに登録（D&Dリダイレクト用）
    registerViewerPanel(panel);

    let currentDataset: VoxelDataset | null = null;
    let currentError: string | null = null;

    panel.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      switch (message.command) {
        case 'ready':
          if (currentDataset) {
            sendVoxelData(panel.webview, currentDataset, true);
          } else if (currentError) {
            sendError(panel.webview, currentError);
          } else {
            clearViewer(panel.webview);
          }
          break;

        case 'loadFile':
          try {
            const data = new Uint8Array(message.data);
            currentDataset = LesParser.parse(data, message.fileName);
            currentError = null;
            sendVoxelData(panel.webview, currentDataset, true);
            panel.title = message.fileName;
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            currentError = errorMessage;
            sendError(panel.webview, errorMessage);
            vscode.window.showErrorMessage(errorMessage);
          }
          break;

        case 'loadFileFromPath':
          try {
            let uri: vscode.Uri;
            try {
              uri = vscode.Uri.parse(message.filePath);
            } catch {
              uri = vscode.Uri.file(message.filePath);
            }
            const fileData = await vscode.workspace.fs.readFile(uri);
            const fileName = uri.path.split('/').pop() || 'unknown.leS';
            currentDataset = LesParser.parse(fileData, fileName);
            currentError = null;
            sendVoxelData(panel.webview, currentDataset, true);
            panel.title = fileName;
          } catch (error) {
            const errorMessage = getErrorMessage(error);
            currentError = errorMessage;
            sendError(panel.webview, errorMessage);
            vscode.window.showErrorMessage(errorMessage);
          }
          break;

        case 'saveState':
          break;

        case 'showError':
          vscode.window.showErrorMessage(message.message);
          break;

        case 'openAsText':
          vscode.window.showInformationMessage('No file to reopen as text. Drop a .leS file.');
          break;

        case 'reportMetrics':
          console.log('Voxel rendering metrics:', message.metrics);
          break;
      }
    });
  });
}
