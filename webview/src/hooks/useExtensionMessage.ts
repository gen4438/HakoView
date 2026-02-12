import { useEffect, useRef, useState } from 'react';
import type {
  ExtensionMessage,
  WebviewMessage,
  RenderingMetrics,
  VoxelDataMessage,
  ViewerState,
  VSCodeAPI,
  ViewerSettings,
} from '../types/voxel';

// VS Code APIの取得（1回のみ）
declare const acquireVsCodeApi: () => VSCodeAPI;
const vscode = acquireVsCodeApi();

/**
 * Extension-Webview通信フック
 */
export function useExtensionMessage() {
  const [voxelData, setVoxelData] = useState<VoxelDataMessage | null>(null);
  const [settings, setSettings] = useState<ViewerSettings | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const loadStartRef = useRef<number | null>(null);

  useEffect(() => {
    // Extensionからのメッセージハンドラー
    const handleMessage = (event: MessageEvent<ExtensionMessage>) => {
      const message = event.data;

      switch (message.type) {
        case 'loadVoxelData':
          setIsLoading(true);
          loadStartRef.current = performance.now();
          setVoxelData(message.data);
          setError(null);
          break;

        case 'updateVoxelData':
          setIsLoading(true);
          loadStartRef.current = performance.now();
          setVoxelData(message.data);
          setError(null);
          break;

        case 'clearViewer':
          setVoxelData(null);
          setError(null);
          setIsLoading(false);
          break;

        case 'restoreState':
          // 状態復元は後で実装（カメラ位置など）
          console.log('Restoring state:', message.state);
          break;

        case 'updateSettings':
          setSettings(message.settings);
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

  useEffect(() => {
    if (!voxelData || loadStartRef.current === null) {
      return;
    }

    const start = loadStartRef.current;
    requestAnimationFrame(() => {
      const timeToFirstFrame = performance.now() - start;
      const metrics: RenderingMetrics = {
        loadMetrics: {
          parseTime: 0,
          textureUploadTime: 0,
        },
        renderMetrics: {
          timeToFirstFrame,
          averageFps: 0,
          frameTime: 0,
        },
        resourceMetrics: {
          cpuMemoryMB: 0,
          textureMemoryMB: 0,
        },
      };

      postMessage({ command: 'reportMetrics', metrics });
      loadStartRef.current = null;
      setIsLoading(false);
    });
  }, [voxelData]);

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
   * ファイルパスからロード（ワークスペース内のファイルD&D用）
   */
  const loadFileFromPath = (filePath: string) => {
    postMessage({
      command: 'loadFileFromPath',
      filePath,
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

  /**
   * 画像を保存
   */
  const saveImage = (imageData: string, defaultFileName: string, originalFilePath?: string) => {
    postMessage({
      command: 'saveImage',
      imageData,
      defaultFileName,
      originalFilePath,
    });
  };

  /**
   * カラー設定を保存
   */
  const saveColorSettings = (colormap: Record<string, string>) => {
    postMessage({
      command: 'saveColorSettings',
      colormap,
    });
  };

  /**
   * 設定を開く
   */
  const openSettings = () => {
    postMessage({
      command: 'openSettings',
    });
  };

  return {
    voxelData,
    settings,
    error,
    isLoading,
    loadFile,
    loadFileFromPath,
    saveState,
    openAsText,
    reportError,
    saveImage,
    saveColorSettings,
    openSettings,
  };
}
