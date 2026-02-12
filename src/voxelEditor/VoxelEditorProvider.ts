import * as vscode from 'vscode';
import { VoxelDocument } from './VoxelDocument';
import { getWebviewHtml } from './getWebviewHtml';
import { sendVoxelData, sendError, WebviewToExtensionMessage } from './messaging';
import { LesParser } from '../voxelParser/LesParser';
import { ParseError } from '../voxelParser/validation';
import { registerViewerPanel } from './panelRegistry';

/**
 * CustomEditorProvider for .leS voxel files
 */
export class VoxelEditorProvider implements vscode.CustomEditorProvider<VoxelDocument> {
  private static readonly viewType = 'hakoview.lesViewer';

  // Event emitter for document changes
  private readonly _onDidChangeCustomDocument = new vscode.EventEmitter<
    | vscode.CustomDocumentEditEvent<VoxelDocument>
    | vscode.CustomDocumentContentChangeEvent<VoxelDocument>
  >();

  public readonly onDidChangeCustomDocument = this._onDidChangeCustomDocument.event;

  /**
   * プロバイダを登録
   */
  public static register(context: vscode.ExtensionContext): vscode.Disposable {
    try {
      console.log('Registering VoxelEditorProvider...');
      const provider = new VoxelEditorProvider(context);
      const providerRegistration = vscode.window.registerCustomEditorProvider(
        VoxelEditorProvider.viewType,
        provider,
        {
          webviewOptions: {
            retainContextWhenHidden: true,
          },
          supportsMultipleEditorsPerDocument: false,
        }
      );
      console.log('VoxelEditorProvider registered with viewType:', VoxelEditorProvider.viewType);

      return providerRegistration;
    } catch (error) {
      console.error('Error in VoxelEditorProvider.register():', error);
      throw error;
    }
  }

  constructor(private readonly context: vscode.ExtensionContext) {}

  /**
   * カスタムドキュメントを開く
   */
  async openCustomDocument(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext,
    token: vscode.CancellationToken
  ): Promise<VoxelDocument> {
    try {
      console.log('Opening custom document:', uri.toString());
      const content = await this.readFile(uri, openContext);
      const document = new VoxelDocument(uri, content, openContext.backupId);
      console.log('Custom document created successfully');

      return document;
    } catch (error) {
      console.error('Error opening custom document:', error);
      throw error;
    }
  }

  /**
   * カスタムエディタを解決（Webviewを構築）
   */
  async resolveCustomEditor(
    document: VoxelDocument,
    webviewPanel: vscode.WebviewPanel,
    token: vscode.CancellationToken
  ): Promise<void> {
    try {
      console.log('Resolving custom editor for:', document.uri.toString());

      // Webviewオプション設定
      webviewPanel.webview.options = {
        enableScripts: true,
      };
      console.log('Webview options set');

      // HTML生成
      webviewPanel.webview.html = getWebviewHtml({
        webview: webviewPanel.webview,
        extensionUri: this.context.extensionUri,
      });
      console.log('Webview HTML generated');

      // パネルをレジストリに登録
      registerViewerPanel(webviewPanel);

      // メッセージハンドリング設定
      this.setupMessageHandling(document, webviewPanel);
      console.log('Message handling setup complete');

      // 初期データ送信（パース成功時）
      if (document.dataset) {
        sendVoxelData(webviewPanel.webview, document.dataset);
        console.log('Voxel data sent to webview');
      } else if (document.error) {
        sendError(webviewPanel.webview, document.error.message);
        console.log('Error sent to webview:', document.error.message);
      }
    } catch (error) {
      console.error('Error resolving custom editor:', error);
      throw error;
    }
  }

  /**
   * ドキュメント保存
   */
  async saveCustomDocument(
    document: VoxelDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.save(cancellation);
  }

  /**
   * 名前を付けて保存
   */
  async saveCustomDocumentAs(
    document: VoxelDocument,
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.saveAs(destination, cancellation);
  }

  /**
   * 元に戻す
   */
  async revertCustomDocument(
    document: VoxelDocument,
    cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.reload();
  }

  /**
   * バックアップ作成（Hot Exit用）
   */
  async backupCustomDocument(
    document: VoxelDocument,
    context: vscode.CustomDocumentBackupContext,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, cancellation);
  }

  /**
   * ファイルを読み込み
   */
  private async readFile(
    uri: vscode.Uri,
    openContext: vscode.CustomDocumentOpenContext
  ): Promise<Uint8Array> {
    // バックアップから復元する場合
    if (openContext.backupId) {
      const backupUri = vscode.Uri.parse(openContext.backupId);
      try {
        return await vscode.workspace.fs.readFile(backupUri);
      } catch {
        // バックアップ読み込み失敗時は通常のファイルを読む
      }
    }

    // 通常のファイル読み込み
    return await vscode.workspace.fs.readFile(uri);
  }

  /**
   * Webviewメッセージハンドリング設定
   */
  private setupMessageHandling(document: VoxelDocument, webviewPanel: vscode.WebviewPanel): void {
    webviewPanel.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      switch (message.command) {
        case 'ready':
          // Webview準備完了時に再送信
          if (document.dataset) {
            sendVoxelData(webviewPanel.webview, document.dataset);
          } else if (document.error) {
            sendError(webviewPanel.webview, document.error.message);
          }
          break;

        case 'loadFile':
          try {
            const data = new Uint8Array(message.data);
            const dataset = LesParser.parse(data, message.fileName);
            sendVoxelData(webviewPanel.webview, dataset, true);
            webviewPanel.title = message.fileName;
          } catch (error) {
            const errorMessage =
              error instanceof ParseError
                ? `Failed to parse voxel file: ${error.message}`
                : `Failed to load voxel file: ${error instanceof Error ? error.message : String(error)}`;
            sendError(webviewPanel.webview, errorMessage);
            vscode.window.showErrorMessage(errorMessage);
          }
          break;

        case 'loadFileFromPath':
          try {
            // URIをパース（file:// または vscode-resource:// など）
            let uri: vscode.Uri;
            try {
              uri = vscode.Uri.parse(message.filePath);
            } catch {
              // パースに失敗した場合はファイルパスとして扱う
              uri = vscode.Uri.file(message.filePath);
            }

            // ファイルを読み込み
            const fileData = await vscode.workspace.fs.readFile(uri);
            const fileName = uri.path.split('/').pop() || 'unknown.leS';

            // パース
            const dataset = LesParser.parse(fileData, fileName);
            sendVoxelData(webviewPanel.webview, dataset, true);
            webviewPanel.title = fileName;
          } catch (error) {
            const errorMessage =
              error instanceof ParseError
                ? `Failed to parse voxel file: ${error.message}`
                : `Failed to load voxel file: ${error instanceof Error ? error.message : String(error)}`;
            sendError(webviewPanel.webview, errorMessage);
            vscode.window.showErrorMessage(errorMessage);
          }
          break;

        case 'saveState':
          // 状態の永続化（カメラ位置など）
          // VS Codeの標準機能で自動保存されるため、特別な処理は不要
          break;

        case 'showError':
          // Webviewからのエラー報告
          vscode.window.showErrorMessage(message.message);
          break;

        case 'openAsText':
          // テキストエディタで開く
          await vscode.commands.executeCommand('vscode.openWith', document.uri, 'default');
          break;

        case 'reportMetrics':
          console.log('Voxel rendering metrics:', message.metrics);
          break;
      }
    });
  }
}
