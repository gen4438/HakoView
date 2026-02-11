/**
 * Webview側で使用するボクセルデータ型定義
 */

/**
 * 3次元サイズ
 */
export interface Dimensions {
  x: number;
  y: number;
  z: number;
}

/**
 * Extension→Webviewに送信されるボクセルデータ
 */
export interface VoxelDataMessage {
  dimensions: Dimensions;
  voxelLength: number;
  values: number[]; // Uint8Array → Array変換（postMessage対応）
  fileName: string;
  filePath?: string;
}

/**
 * カメラの位置と向き
 */
export interface CameraState {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
  zoom: number;
}

/**
 * ビューアーの設定
 */
export interface ViewerSettings {
  wireframe: boolean;
  showZeroValues: boolean;
  clippingEnabled: boolean;
  clippingPlane?: {
    normal: [number, number, number];
    distance: number;
  };
}

/**
 * Webviewの永続化状態
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

/**
 * VS Code API型定義（acquireVsCodeApi()の戻り値）
 */
export interface VSCodeAPI {
  postMessage(message: any): void;
  getState(): any;
  setState(state: any): void;
}

/**
 * Extension→Webviewメッセージ型
 */
export type ExtensionMessage =
  | { type: 'loadVoxelData'; data: VoxelDataMessage }
  | { type: 'updateVoxelData'; data: VoxelDataMessage }
  | { type: 'clearViewer' }
  | { type: 'restoreState'; state: ViewerState }
  | { type: 'showError'; message: string };

/**
 * Webview→Extensionメッセージ型
 */
export type WebviewMessage =
  | { command: 'ready' }
  | { command: 'loadFile'; fileName: string; data: number[] }
  | { command: 'saveState'; state: ViewerState }
  | { command: 'showError'; message: string }
  | { command: 'openAsText' };
