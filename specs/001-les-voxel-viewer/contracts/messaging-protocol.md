# Extension-Webview メッセージングコントラクト

**Feature**: 001-les-voxel-viewer  
**Date**: 2026-02-12  
**Protocol Version**: 1.0

このドキュメントは、Extension Host（Node.js）とWebview（Browser）間の通信プロトコルを定義します。

---

## メッセージ送信方向

```
┌──────────────────┐
│ Extension Host   │
│  (Node.js)       │
└────────┬─────────┘
         │ webview.postMessage()
         ↓
    [ Messages ]
         ↓
┌──────────────────┐
│ Webview          │
│  (Browser)       │
└────────┬─────────┘
         │ vscode.postMessage()
         ↑
    [ Messages ]
```

---

## 1. Extension → Webview メッセージ

### 1.1 `loadVoxelData`

ボクセルデータをWebviewにロードする。

**Trigger**: ファイルが開かれた時、またはファイルが変更された時。

**Payload**:
```typescript
{
  type: 'loadVoxelData';
  data: {
    dimensions: { x: number; y: number; z: number };
    voxelLength: number;
    values: number[];  // Uint8Array → Array変換（postMessage対応）
    fileName: string;
    filePath?: string;
  };
}
```

**Example**:
```json
{
  "type": "loadVoxelData",
  "data": {
    "dimensions": { "x": 10, "y": 20, "z": 40 },
    "voxelLength": 2.0e-8,
    "values": [0, 1, 2, ...],
    "fileName": "sample.leS",
    "filePath": "/workspace/data/sample.leS"
  }
}
```

**Webview Response**: なし（一方向）

**Error Handling**: Webviewでパース失敗時は`showError`メッセージを送り返す。

---

### 1.2 `updateVoxelData`

既に開いているビューアーのデータを更新する（D&D後など）。

**Trigger**: ドラッグ&ドロップでファイルをロードした後。

**Payload**: 
`loadVoxelData`と同じ構造。

---

### 1.3 `clearViewer`

ビューアーをクリアし、初期状態に戻す。

**Trigger**: 空のビューアーを開いた時。

**Payload**:
```typescript
{
  type: 'clearViewer';
}
```

---

### 1.4 `restoreState`

Webviewの状態を復元する（リロード時）。

**Trigger**: Webviewが再起動された時、Extension側に保存されていた状態がある場合。

**Payload**:
```typescript
{
  type: 'restoreState';
  state: {
    cameraPosition: { x: number; y: number; z: number };
    cameraTarget: { x: number; y: number; z: number };
    cameraZoom: number;
    wireframe: boolean;
    showZeroValues: boolean;
    clippingEnabled: boolean;
    clippingPlane?: { normal: [number, number, number]; distance: number };
  };
}
```

---

## 2. Webview → Extension メッセージ

### 2.1 `ready`

Webviewの初期化完了を通知。

**Trigger**: Webviewのマウント完了時。

**Payload**:
```typescript
{
  command: 'ready';
}
```

**Extension Response**: `loadVoxelData`または`clearViewer`を送信。

---

### 2.2 `loadFile`

ドラッグ&ドロップされたファイルをロード要求。

**Trigger**: Webview内でファイルがドロップされた時。

**Payload**:
```typescript
{
  command: 'loadFile';
  fileName: string;
  data: number[];  // Uint8Array → Array変換
}
```

**Example**:
```json
{
  "command": "loadFile",
  "fileName": "dropped.leS",
  "data": [88, 32, 50, 48, ...]
}
```

**Extension Response**: 
- パース成功 → `updateVoxelData`を送信
- パース失敗 → `showError`を送信（またはExtension側でエラー表示）

---

### 2.3 `saveState`

Webviewの現在の状態を保存要求（カメラ位置、設定など）。

**Trigger**: カメラ移動、設定変更時（デバウンス付き）。

**Payload**:
```typescript
{
  command: 'saveState';
  state: {
    cameraPosition: { x: number; y: number; z: number };
    cameraTarget: { x: number; y: number; z: number };
    cameraZoom: number;
    wireframe: boolean;
    showZeroValues: boolean;
    clippingEnabled: boolean;
    clippingPlane?: { normal: [number, number, number]; distance: number };
  };
}
```

**Extension Response**: なし（Extension側で保存）

---

### 2.4 `showError`

Webview内でエラーが発生したことを通知。

**Trigger**: パース失敗、レンダリングエラー、GPU OOMなど。

**Payload**:
```typescript
{
  command: 'showError';
  message: string;
  details?: string;
}
```

**Example**:
```json
{
  "command": "showError",
  "message": "Failed to parse .leS file",
  "details": "Invalid header format at line 1"
}
```

**Extension Response**: VS Codeのエラー通知を表示（`vscode.window.showErrorMessage`）。

---

### 2.5 `showWarning`

警告メッセージを表示。

**Trigger**: ボクセル値が範囲外、データ整合性の問題など。

**Payload**:
```typescript
{
  command: 'showWarning';
  message: string;
}
```

**Extension Response**: VS Codeの警告通知を表示（`vscode.window.showWarningMessage`）。

---

### 2.6 `reportMetrics`

パフォーマンス計測結果を報告。

**Trigger**: 初回描画完了時、定期計測時。

**Payload**:
```typescript
{
  command: 'reportMetrics';
  metrics: {
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
  };
}
```

**Extension Response**: ログに記録、またはデバッグパネルに表示。

---

### 2.7 `openAsText`

現在のファイルをテキストエディタで開き直す要求。

**Trigger**: UIボタンクリック（オプション機能）。

**Payload**:
```typescript
{
  command: 'openAsText';
}
```

**Extension Response**: `vscode.commands.executeCommand('vscode.openWith', uri, 'default')`を実行。

---

## 3. Request/Response パターン

非同期リクエストが必要な場合、Request IDを使用。

### 3.1 Extension → Webview Request

**Payload**:
```typescript
{
  type: 'request';
  requestId: number;
  method: string;
  params: any;
}
```

### 3.2 Webview → Extension Response

**Payload**:
```typescript
{
  command: 'response';
  requestId: number;
  result?: any;
  error?: string;
}
```

### Example: データ再読み込み要求

**Extension → Webview**:
```json
{
  "type": "request",
  "requestId": 123,
  "method": "getCurrentVoxelData",
  "params": {}
}
```

**Webview → Extension**:
```json
{
  "command": "response",
  "requestId": 123,
  "result": {
    "dimensions": { "x": 10, "y": 20, "z": 40 },
    "values": [...]
  }
}
```

---

## 4. エラーコード

| Code | Message | Description |
|------|---------|-------------|
| `PARSE_ERROR` | "Failed to parse .leS file" | パース失敗 |
| `INVALID_HEADER` | "Invalid header format" | ヘッダ形式エラー |
| `SIZE_EXCEEDED` | "Voxel size exceeds limit (1024³)" | サイズ上限超過 |
| `DATA_MISMATCH` | "Data size mismatch" | データとヘッダの不整合 |
| `GPU_OOM` | "GPU out of memory" | GPUメモリ不足 |
| `WEBGL_UNSUPPORTED` | "WebGL2 is not supported" | WebGL2未サポート |

---

## 5. メッセージシーケンス

### 5.1 ファイルを開く（標準フロー）

```
Extension                     Webview
    |                            |
    |------ loadVoxelData ------>|
    |                            | (パース & 描画)
    |<------- ready -------------|
    |                            | (初回フレーム描画)
    |<--- reportMetrics ---------|
    |                            |
    |    (カメラ操作)            |
    |<----- saveState -----------|
```

### 5.2 ドラッグ&ドロップ

```
Extension                     Webview
    |                            |
    |                            | (ファイルD&D)
    |<----- loadFile ------------|
    | (パース)                   |
    |                            |
    | [成功]                     |
    |--- updateVoxelData ------->|
    |                            | (再描画)
    |                            |
    | [失敗]                     |
    |------ showError ---------->|
    | (vscode.window.showError)  |
```

### 5.3 空のビューアーを開く

```
Extension                     Webview
    |                            |
    |------ clearViewer -------->|
    |                            | (空の状態表示)
    |<------- ready -------------|
    |                            |
    |    (ファイルD&D待機)       |
```

---

## 6. 型定義（TypeScript）

### Extension側（src/voxelEditor/messaging.ts）

```typescript
export type ExtensionToWebviewMessage =
  | { type: 'loadVoxelData'; data: VoxelDataset }
  | { type: 'updateVoxelData'; data: VoxelDataset }
  | { type: 'clearViewer' }
  | { type: 'restoreState'; state: ViewerSession };

export type WebviewToExtensionMessage =
  | { command: 'ready' }
  | { command: 'loadFile'; fileName: string; data: number[] }
  | { command: 'saveState'; state: ViewerSession }
  | { command: 'showError'; message: string; details?: string }
  | { command: 'showWarning'; message: string }
  | { command: 'reportMetrics'; metrics: RenderingMetrics }
  | { command: 'openAsText' };
```

### Webview側（webview/src/types/messaging.d.ts）

```typescript
export interface VsCodeApi {
  postMessage(message: WebviewToExtensionMessage): void;
  setState(state: any): void;
  getState(): any;
}

declare function acquireVsCodeApi(): VsCodeApi;
```

---

## まとめ

- **Extension → Webview**: 7種類のメッセージ（データロード、状態復元など）
- **Webview → Extension**: 7種類のコマンド（状態保存、エラー通知など）
- **Request/Response**: 非同期処理用のパターン定義
- **エラーコード**: 6種類の標準エラー
- **シーケンス**: 3つの主要フローを定義

すべてのメッセージは型安全で、TypeScript定義により実装時の誤りを防ぎます。
