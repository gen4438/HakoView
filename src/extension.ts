// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { VoxelEditorProvider } from './voxelEditor/VoxelEditorProvider';
import { registerOpenVoxelViewerCommand } from './commands/openVoxelViewer';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
  console.log('Hakoview extension is now active!');

  try {
    // Register custom editor provider
    context.subscriptions.push(VoxelEditorProvider.register(context));
    console.log('VoxelEditorProvider registered successfully');
  } catch (error) {
    console.error('Failed to register VoxelEditorProvider:', error);
    throw error;
  }

  // Register openAsText command
  context.subscriptions.push(
    vscode.commands.registerCommand('hakoview.openAsText', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;

      if (!targetUri) {
        vscode.window.showErrorMessage('No file is open.');
        return;
      }

      await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default');
    })
  );

  // Register openFromEditor command (User Story 2)
  context.subscriptions.push(
    vscode.commands.registerCommand('hakoview.openFromEditor', async (uri?: vscode.Uri) => {
      const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;

      if (!targetUri) {
        vscode.window.showErrorMessage('No .leS file is open.');
        return;
      }

      await vscode.commands.executeCommand('vscode.openWith', targetUri, 'hakoview.lesViewer');
    })
  );

  // Register openVoxelViewer command (User Story 3)
  context.subscriptions.push(registerOpenVoxelViewerCommand(context));
}

// This method is called when your extension is deactivated
export function deactivate() {}
