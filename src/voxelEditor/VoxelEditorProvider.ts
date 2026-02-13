import * as vscode from 'vscode';
import * as zlib from 'zlib';
import { VoxelDocument } from './VoxelDocument';
import { getWebviewHtml } from './getWebviewHtml';
import {
  sendVoxelData,
  sendError,
  WebviewToExtensionMessage,
  postMessageToWebview,
} from './messaging';
import { LesParser } from '../voxelParser/LesParser';
import { ParseError } from '../voxelParser/validation';
import { registerViewerPanel, findPreviewTabInOtherGroup } from './panelRegistry';

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
    _token: vscode.CancellationToken
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
    _token: vscode.CancellationToken
  ): Promise<void> {
    try {
      console.log('Resolving custom editor for:', document.uri.toString());

      // 他のグループにPreview Modeのhakoviewタブがある場合を検出
      // Note: webviewPanel.viewColumnはresolveCustomEditor時点ではundefinedの場合があるため、
      // activeTabGroupのviewColumnをフォールバックとして使用
      const currentColumn = webviewPanel.viewColumn ?? vscode.window.tabGroups.activeTabGroup.viewColumn;
      const existingPreview = findPreviewTabInOtherGroup(currentColumn);

      // Webviewパネルのタイトルを設定
      const fileName = document.uri.path.split('/').pop() || 'Voxel Viewer';
      webviewPanel.title = fileName;

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

      // パネルのactive/visible状態をWebviewに通知（描画の重複防止）
      webviewPanel.onDidChangeViewState((e) => {
        postMessageToWebview(e.webviewPanel.webview, {
          type: 'viewStateChanged',
          active: e.webviewPanel.active,
          visible: e.webviewPanel.visible,
        });
      });
      console.log('Message handling setup complete');

      // 初期データ送信（パース成功時）
      if (document.dataset) {
        sendVoxelData(webviewPanel.webview, document.dataset);
        console.log('Voxel data sent to webview');
      } else if (document.error) {
        sendError(webviewPanel.webview, document.error.message);
        console.log('Error sent to webview:', document.error.message);
      }

      // 既存のPreviewタブがあったグループにエディタタブごと移動
      if (existingPreview) {
        const targetColumn = existingPreview.viewColumn;
        const targetTab = existingPreview.tab;
        console.log('Found existing preview tab in group', targetColumn, ', will move new panel there');
        // resolveCustomEditor完了後にVS Codeが内部セットアップを終えてからタブを移動
        // 150msの遅延でVS Codeのレイアウト処理が完了するのを待つ
        setTimeout(async () => {
          try {
            if (webviewPanel.active) {
              // 先にタブを移動（移動先グループがまだ存在する状態で）
              await vscode.commands.executeCommand('moveActiveEditor', {
                to: 'position',
                by: 'group',
                value: targetColumn,
              });
              // 移動後に古いプレビュータブを閉じる
              try {
                await vscode.window.tabGroups.close(targetTab);
              } catch {
                // タブが既に閉じられている場合は無視
              }
            }
          } catch (e) {
            console.error('Failed to move editor to target group:', e);
          }
        }, 150);
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
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.save(_cancellation);
  }

  /**
   * 名前を付けて保存
   */
  async saveCustomDocumentAs(
    document: VoxelDocument,
    destination: vscode.Uri,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.saveAs(destination, _cancellation);
  }

  /**
   * 元に戻す
   */
  async revertCustomDocument(
    document: VoxelDocument,
    _cancellation: vscode.CancellationToken
  ): Promise<void> {
    return document.reload();
  }

  /**
   * バックアップ作成（Hot Exit用）
   */
  async backupCustomDocument(
    document: VoxelDocument,
    context: vscode.CustomDocumentBackupContext,
    _cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    return document.backup(context.destination, _cancellation);
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
   * 設定をWebviewに送信
   */
  private sendSettings(webview: vscode.Webview): void {
    const config = vscode.workspace.getConfiguration('hakoview');
    const colormap = config.get<Record<string, string>>('defaultColormap');
    const devicePixelRatio = config.get<number | null>('devicePixelRatio');

    postMessageToWebview(webview, {
      type: 'updateSettings',
      settings: {
        colormap,
        devicePixelRatio,
      },
    });
  }

  /**
   * Webviewメッセージハンドリング設定
   */
  private setupMessageHandling(document: VoxelDocument, webviewPanel: vscode.WebviewPanel): void {
    // 設定変更の監視
    const configListener = vscode.workspace.onDidChangeConfiguration((e) => {
      if (
        e.affectsConfiguration('hakoview.defaultColormap') ||
        e.affectsConfiguration('hakoview.devicePixelRatio')
      ) {
        this.sendSettings(webviewPanel.webview);
      }
    });

    // パネル破棄時にリスナーを解除
    webviewPanel.onDidDispose(() => {
      configListener.dispose();
    });

    webviewPanel.webview.onDidReceiveMessage(async (message: WebviewToExtensionMessage) => {
      switch (message.command) {
        case 'ready':
          // Webview準備完了時にデータを送信
          this.sendSettings(webviewPanel.webview);
          // 初期のactive/visible状態を送信
          postMessageToWebview(webviewPanel.webview, {
            type: 'viewStateChanged',
            active: webviewPanel.active,
            visible: webviewPanel.visible,
          });
          if (document.dataset) {
            sendVoxelData(webviewPanel.webview, document.dataset);
          } else if (document.error) {
            sendError(webviewPanel.webview, document.error.message);
          }
          break;

        case 'loadFile':
          try {
            let data = new Uint8Array(message.data);

            // gzip圧縮されているか確認
            if (message.fileName.toLowerCase().endsWith('.gz')) {
              data = zlib.gunzipSync(data);
            }

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
            let fileData = await vscode.workspace.fs.readFile(uri);
            const fileName = uri.path.split('/').pop() || 'unknown.leS';

            // gzip圧縮されているか確認
            if (fileName.toLowerCase().endsWith('.gz')) {
              fileData = zlib.gunzipSync(fileData);
            }

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

        case 'saveImage':
          // 画像保存ダイアログを表示
          try {
            // 元のファイルと同じディレクトリをデフォルトにする
            let defaultUri: vscode.Uri;
            if (message.originalFilePath) {
              const originalUri = vscode.Uri.parse(message.originalFilePath);
              const directory = vscode.Uri.joinPath(originalUri, '..');
              defaultUri = vscode.Uri.joinPath(directory, message.defaultFileName);
            } else {
              // ドキュメントのURIを使用
              const directory = vscode.Uri.joinPath(document.uri, '..');
              defaultUri = vscode.Uri.joinPath(directory, message.defaultFileName);
            }

            const saveUri = await vscode.window.showSaveDialog({
              defaultUri,
              filters: {
                PNG画像: ['png'],
              },
              saveLabel: '保存',
            });

            if (saveUri) {
              // Base64データからバイナリに変換
              const base64Data = message.imageData.split(',')[1];
              const buffer = Buffer.from(base64Data, 'base64');

              // ファイルに書き込み
              await vscode.workspace.fs.writeFile(saveUri, buffer);

              // 成功メッセージを表示
              vscode.window.showInformationMessage(`画像を保存しました: ${saveUri.fsPath}`);
            }
          } catch (error) {
            const errorMessage = `画像の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`;
            vscode.window.showErrorMessage(errorMessage);
          }
          break;

        case 'saveColorSettings':
          // カラー設定をVSCodeの設定に保存
          try {
            const config = vscode.workspace.getConfiguration('hakoview');
            await config.update(
              'defaultColormap',
              message.colormap,
              vscode.ConfigurationTarget.Global
            );
            vscode.window.showInformationMessage('カラー設定を保存しました');
          } catch (error) {
            const errorMessage = `カラー設定の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`;
            vscode.window.showErrorMessage(errorMessage);
          }
          break;

        case 'openSettings':
          // VSCodeの設定を開く（hakoviewの設定にフォーカス）
          await vscode.commands.executeCommand('workbench.action.openSettings', 'hakoview');
          break;
      }
    });
  }
}
