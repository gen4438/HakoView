import * as vscode from 'vscode';
import { VoxelDataset } from '../voxelParser/VoxelData';

/**
 * Extension→Webviewメッセージ型
 */
export type ExtensionToWebviewMessage =
  | { type: 'loadVoxelData'; data: VoxelDataMessage }
  | { type: 'updateVoxelData'; data: VoxelDataMessage }
  | { type: 'updateSettings'; settings: ViewerSettings }
  | { type: 'clearViewer' }
  | { type: 'restoreState'; state: ViewerState }
  | { type: 'showError'; message: string };

/**
 * ビューアーの設定
 */
export interface ViewerSettings {
  colormap?: Record<string, string>;
  devicePixelRatio?: number | null;
}

/**
 * Webview→Extensionメッセージ型
 */
export type WebviewToExtensionMessage =
  | { command: 'ready' }
  | { command: 'loadFile'; fileName: string; data: number[] }
  | { command: 'loadFileFromPath'; filePath: string }
  | { command: 'saveState'; state: ViewerState }
  | { command: 'showError'; message: string }
  | { command: 'openAsText' }
  | { command: 'reportMetrics'; metrics: RenderingMetrics }
  | { command: 'saveImage'; imageData: string; defaultFileName: string; originalFilePath?: string };

/**
 * ボクセルデータメッセージ（postMessage用）
 * Note: Uint8ArrayはpostMessageの構造化クローンでサポートされているため、
 * 大きなデータセットでも効率的に送信できます
 */
export interface VoxelDataMessage {
  dimensions: { x: number; y: number; z: number };
  voxelLength: number;
  values: Uint8Array | number[];
  fileName: string;
  filePath?: string;
}

/**
 * ビューアーの永続化状態
 */
export interface ViewerState {
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  cameraZoom: number;
  wireframe: boolean;
  showZeroValues: boolean;
  clippingEnabled: boolean;
  clippingPlane?: {
    normal: [number, number, number];
    distance: number;
  };
}

export interface RenderingMetrics {
  loadMetrics: {
    parseTime: number;
    textureUploadTime: number;
  };
  renderMetrics: {
    timeToFirstFrame: number;
    averageFps: number;
    frameTime: number;
  };
  resourceMetrics: {
    cpuMemoryMB: number;
    textureMemoryMB: number;
  };
}

/**
 * VoxelDatasetをpostMessage用に変換
 * Note: Uint8Arrayをそのまま送信することで、大きなデータセット（例：600³）でも
 * メモリ効率よく送信できます。postMessageの構造化クローンがUint8Arrayをサポートしています。
 */
export function convertToMessage(dataset: VoxelDataset): VoxelDataMessage {
  return {
    dimensions: dataset.dimensions,
    voxelLength: dataset.voxelLength,
    values: dataset.values, // Uint8Arrayをそのまま送信
    fileName: dataset.fileName,
    filePath: dataset.filePath,
  };
}

/**
 * postMessageデータをVoxelDatasetに変換
 */
export function convertFromMessage(message: VoxelDataMessage): VoxelDataset {
  return {
    dimensions: message.dimensions,
    voxelLength: message.voxelLength,
    values: new Uint8Array(message.values),
    fileName: message.fileName,
    filePath: message.filePath,
  };
}

/**
 * Webviewにメッセージを送信する汎用ヘルパー
 */
export function postMessageToWebview(
  webview: vscode.Webview,
  message: ExtensionToWebviewMessage
): void {
  webview.postMessage(message);
}

/**
 * ボクセルデータをWebviewに送信
 */
export function sendVoxelData(
  webview: vscode.Webview,
  dataset: VoxelDataset,
  isUpdate: boolean = false
): void {
  const message = convertToMessage(dataset);
  postMessageToWebview(webview, {
    type: isUpdate ? 'updateVoxelData' : 'loadVoxelData',
    data: message,
  });
}

/**
 * エラーをWebviewに送信
 */
export function sendError(webview: vscode.Webview, message: string): void {
  postMessageToWebview(webview, {
    type: 'showError',
    message,
  });
}

/**
 * ビューアーをクリア
 */
export function clearViewer(webview: vscode.Webview): void {
  postMessageToWebview(webview, { type: 'clearViewer' });
}

/**
 * 状態を復元
 */
export function restoreState(webview: vscode.Webview, state: ViewerState): void {
  postMessageToWebview(webview, {
    type: 'restoreState',
    state,
  });
}
