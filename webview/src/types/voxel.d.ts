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
 * Note: postMessageの構造化クローンはUint8Arrayをサポートしているため、
 * 大きなデータセットでもメモリ効率よく送信できます
 */
export interface VoxelDataMessage {
  dimensions: Dimensions;
  voxelLength: number;
  values: Uint8Array | number[]; // postMessageで直接Uint8Arrayを送信可能
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
  colormap?: Record<string, string>;
  devicePixelRatio?: number | null;
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
  | { type: 'updateSettings'; settings: ViewerSettings }
  | { type: 'clearViewer' }
  | { type: 'restoreState'; state: ViewerState }
  | { type: 'showError'; message: string }
  | { type: 'viewStateChanged'; active: boolean; visible: boolean };

/**
 * Webview→Extensionメッセージ型
 */
export type WebviewMessage =
  | { command: 'ready' }
  | { command: 'loadFile'; fileName: string; data: number[] }
  | { command: 'loadFileFromPath'; filePath: string }
  | { command: 'saveState'; state: ViewerState }
  | { command: 'showError'; message: string }
  | { command: 'openAsText' }
  | { command: 'reportMetrics'; metrics: RenderingMetrics }
  | { command: 'saveImage'; imageData: string; defaultFileName: string; originalFilePath?: string }
  | { command: 'saveColorSettings'; colormap: Record<string, string> }
  | { command: 'openSettings' };
