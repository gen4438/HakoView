import * as vscode from 'vscode';
import * as zlib from 'zlib';
import { VoxelDataset } from '../voxelParser/VoxelData';
import { LesParser } from '../voxelParser/LesParser';
import { ParseError } from '../voxelParser/validation';

/**
 * カスタムドキュメントクラス
 * .leSファイルのドキュメント状態を管理
 */
export class VoxelDocument implements vscode.CustomDocument {
  private _uri: vscode.Uri;
  private _dataset: VoxelDataset | null = null;
  private _error: Error | null = null;
  private _edits: VoxelEdit[] = [];
  private _savedEdits: VoxelEdit[] = [];

  constructor(uri: vscode.Uri, initialContent: Uint8Array | null, backupId?: string) {
    this._uri = uri;

    if (initialContent) {
      this.loadContent(initialContent);
    }
  }

  /**
   * ドキュメントのURI
   */
  get uri(): vscode.Uri {
    return this._uri;
  }

  /**
   * ボクセルデータセット
   */
  get dataset(): VoxelDataset | null {
    return this._dataset;
  }

  /**
   * パースエラー
   */
  get error(): Error | null {
    return this._error;
  }

  /**
   * ドキュメントが変更されているか
   */
  get isDirty(): boolean {
    return this._edits.length > this._savedEdits.length;
  }

  /**
   * ファイル内容をロード
   */
  private loadContent(content: Uint8Array): void {
    try {
      const fileName = this._uri.path.split('/').pop() || 'untitled.leS';
      const filePath = this._uri.fsPath;

      // gzip圧縮されているか確認
      let processedContent = content;
      if (fileName.toLowerCase().endsWith('.gz')) {
        // gzip解凍
        processedContent = zlib.gunzipSync(content);
      }

      this._dataset = LesParser.parse(processedContent, fileName, filePath);
      this._error = null;
    } catch (error) {
      this._error = error instanceof Error ? error : new Error(String(error));
      this._dataset = null;

      // エラーをユーザーに通知
      if (error instanceof ParseError) {
        vscode.window.showErrorMessage(`Failed to parse voxel file: ${error.message}`);
      } else {
        vscode.window.showErrorMessage(`Failed to load voxel file: ${error}`);
      }
    }
  }

  /**
   * ファイルを再読み込み
   */
  async reload(): Promise<void> {
    const content = await vscode.workspace.fs.readFile(this._uri);
    this.loadContent(content);
    this._edits = [];
    this._savedEdits = [];
  }

  /**
   * ドキュメントを保存
   */
  async save(cancellation: vscode.CancellationToken): Promise<void> {
    if (!this._dataset) {
      throw new Error('No data to save');
    }

    const content = LesParser.serialize(this._dataset);
    const buffer = Buffer.from(content, 'utf-8');

    await vscode.workspace.fs.writeFile(this._uri, buffer);
    this._savedEdits = Array.from(this._edits);
  }

  /**
   * 名前を付けて保存
   */
  async saveAs(targetResource: vscode.Uri, cancellation: vscode.CancellationToken): Promise<void> {
    if (!this._dataset) {
      throw new Error('No data to save');
    }

    const content = LesParser.serialize(this._dataset);
    const buffer = Buffer.from(content, 'utf-8');

    await vscode.workspace.fs.writeFile(targetResource, buffer);
  }

  /**
   * 元に戻す操作が可能か
   */
  canUndo(): boolean {
    return this._edits.length > 0;
  }

  /**
   * やり直し操作が可能か
   */
  canRedo(): boolean {
    return this._savedEdits.length > this._edits.length;
  }

  /**
   * 編集を適用（将来の機能拡張用）
   */
  makeEdit(edit: VoxelEdit): void {
    this._edits.push(edit);

    // 編集をデータセットに適用
    // 現在は読み取り専用なので、実装は省略
  }

  /**
   * バックアップ作成（Hot Exit用）
   */
  async backup(
    destination: vscode.Uri,
    cancellation: vscode.CancellationToken
  ): Promise<vscode.CustomDocumentBackup> {
    if (!this._dataset) {
      throw new Error('No data to backup');
    }

    const content = LesParser.serialize(this._dataset);
    const buffer = Buffer.from(content, 'utf-8');

    await vscode.workspace.fs.writeFile(destination, buffer);

    return {
      id: destination.toString(),
      delete: async () => {
        try {
          await vscode.workspace.fs.delete(destination);
        } catch {
          // 削除失敗は無視
        }
      },
    };
  }

  /**
   * ドキュメントを破棄
   */
  dispose(): void {
    // クリーンアップ処理
    this._dataset = null;
    this._error = null;
    this._edits = [];
    this._savedEdits = [];
  }
}

/**
 * ボクセル編集操作（将来の機能拡張用）
 */
export interface VoxelEdit {
  type: 'setValue' | 'fill' | 'clear';
  x?: number;
  y?: number;
  z?: number;
  value?: number;
}
