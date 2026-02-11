import { useEffect, useState } from 'react';
import type {
  ExtensionMessage,
  WebviewMessage,
  VoxelDataMessage,
  ViewerState,
  VSCodeAPI,
} from '../types/voxel';

// VS Code APIの取得（1回のみ）
declare const acquireVsCodeApi: () => VSCodeAPI;
const vscode = acquireVsCodeApi();

/**
 * Extension-Webview通信フック
 */
export function useExtensionMessage() {
  const [voxelData, setVoxelData] = useState<VoxelDataMessage | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);

  useEffect(() => {
    // Extensionからのメッセージハンドラー
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'loadVoxelData':
          setIsLoading(true);
          setVoxelData(message.data);
          setError(null);
          setIsLoading(false);
          break;

        case 'updateVoxelData':
          setIsLoading(true);
          setVoxelData(message.data);
          setError(null);
          setIsLoading(false);
          break;

        case 'clearViewer':
          setVoxelData(null);
          setError(null);
          break;

        case 'restoreState':
          // 状態復元は後で実装（カメラ位置など）
          console.log('Restoring state:', message.state);
          break;

        case 'showError':
          setError(message.message);
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    // Webview準備完了を通知
    postMessage({ command: 'ready' });

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  /**
   * Extensionにメッセージを送信
   */
  const postMessage = (message: WebviewMessage) => {
    vscode.postMessage(message);
  };

  /**
   * ファイルをロード（D&D用）
   */
  const loadFile = (fileName: string, data: ArrayBuffer) => {
    const uint8Array = new Uint8Array(data);
    postMessage({
      command: 'loadFile',
      fileName,
      data: Array.from(uint8Array),
    });
  };

  /**
   * 状態を保存
   */
  const saveState = (state: ViewerState) => {
    postMessage({
      command: 'saveState',
      state,
    });
    vscode.setState(state);
  };

  /**
   * テキストエディタで開く
   */
  const openAsText = () => {
    postMessage({ command: 'openAsText' });
  };

  /**
   * エラーを報告
   */
  const reportError = (message: string) => {
    setError(message);
    postMessage({
      command: 'showError',
      message,
    });
  };

  return {
    voxelData,
    error,
    isLoading,
    loadFile,
    saveState,
    openAsText,
    reportError,
  };
}
