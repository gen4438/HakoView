# データモデル設計: leSボクセルビューアー

**Feature**: 001-les-voxel-viewer  
**Date**: 2026-02-12  
**Status**: Phase 1 設計

このドキュメントは、feature specから抽出したKey Entitiesを詳細化し、システムで扱うデータ構造を定義します。

---

## 1. VoxelDataset

**説明**: .leSファイルから読み込んだボクセルデータ全体。

### Properties

| Property | Type | Description | Validation |
|----------|------|-------------|------------|
| `dimensions` | `{ x: number, y: number, z: number }` | ボクセル配列のサイズ | 各次元 1 ≤ size ≤ 1000 |
| `voxelLength` | `number` | ボクセル間隔（メートル単位） | > 0（表示には非使用、メタデータのみ） |
| `values` | `Uint8Array` | ボクセル値の1次元配列（X*Y*Z要素） | length === X * Y * Z |
| `fileName` | `string` | 元ファイル名 | - |
| `filePath` | `string \| undefined` | ファイルパス（untitled時はundefined） | - |

### Index Mapping

2次元ファイル表現 → 3次元配列のマッピング：
```
Row index i (0 ≤ i < X*Y) → (x, y) = (i÷Y, i%Y)
Row i の Z方向値: values[i, 0], values[i, 1], ..., values[i, Z-1]
```

3次元配列 → 1次元配列のマッピング：
```typescript
function getVoxelIndex(x: number, y: number, z: number, dimensions: Dimensions): number {
  return (x * dimensions.y + y) * dimensions.z + z;
}

function getVoxelValue(x: number, y: number, z: number, dataset: VoxelDataset): number {
  const index = getVoxelIndex(x, y, z, dataset.dimensions);
  return dataset.values[index];
}
```

### State Transitions

```
[未ロード] 
  → (ファイル選択/D&D) → [ロード中] 
  → (パース成功) → [表示可能]
  → (編集) → [変更済み]
  → (保存) → [表示可能]
  
[ロード中] → (エラー) → [エラー状態]
```

### Example

```typescript
const dataset: VoxelDataset = {
  dimensions: { x: 10, y: 20, z: 40 },
  voxelLength: 2.0e-8,  // 20nm
  values: new Uint8Array(10 * 20 * 40),  // 8000要素
  fileName: "sample.leS",
  filePath: "/workspace/data/sample.leS"
};
```

---

## 2. VoxelGrid

**説明**: Three.js描画に使用する3次元格子情報。

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `size` | `{ x: number, y: number, z: number }` | グリッドサイズ（VoxelDataset.dimensionsと同一） |
| `origin` | `{ x: number, y: number, z: number }` | グリッド原点（描画座標系） |
| `dataTexture` | `THREE.DataTexture3D` | R8形式の3Dテクスチャ（ボクセル値） |
| `occupancyTexture` | `THREE.DataTexture3D \| undefined` | Occupancy情報（最適化用、Phase 2で実装） |

### Coordinate System

VS Code / Three.js標準座標系：
- X軸: 右方向
- Y軸: 上方向
- Z軸: 手前方向（右手系）

原点設定：
```typescript
// グリッド中心を原点に配置
origin = {
  x: -size.x / 2,
  y: -size.y / 2,
  z: -size.z / 2
};
```

### DataTexture構築

```typescript
function createDataTexture(dataset: VoxelDataset): THREE.DataTexture3D {
  const { x, y, z } = dataset.dimensions;
  
  const texture = new THREE.DataTexture3D(
    dataset.values,  // Uint8Array
    x, y, z
  );
  
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;
  
  return texture;
}
```

---

## 3. PaletteMapping

**説明**: ボクセル値と表示色の対応テーブル。

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `colors` | `THREE.Color[16]` | 16色のカラーパレット |
| `paletteTexture` | `THREE.DataTexture` | 1×16のRGB8テクスチャ |

### Value to Color Mapping

仕様（FR-007）に基づく循環マッピング：
```typescript
function getColorIndex(voxelValue: number): number {
  if (voxelValue === 0) return 0;  // 空ボクセル（透明）
  return ((voxelValue - 1) % 16) + 1;  // 1-255 → 1-16の循環
}
```

### Default Palette

```typescript
const defaultPalette: string[] = [
  "#ffffff",  // 0: 空（白色背景、実際は透明）
  "#0000FF",  // 1: 青
  "#FF0000",  // 2: 赤
  "#FFFF00",  // 3: 黄
  "#00FF00",  // 4: 緑
  "#FF00FF",  // 5: マゼンタ
  "#1f77b4",  // 6-16: 追加色
  "#ff7f0e",
  "#2ca02c",
  "#d62728",
  "#9467bd",
  "#8c564b",
  "#e377c2",
  "#7f7f7f",
  "#bcbd22",
  "#17becf"
];
```

### PaletteTexture構築

```typescript
function createPaletteTexture(colors: THREE.Color[]): THREE.DataTexture {
  const data = new Uint8Array(16 * 3);  // RGB * 16
  
  colors.forEach((color, i) => {
    data[i * 3 + 0] = Math.floor(color.r * 255);
    data[i * 3 + 1] = Math.floor(color.g * 255);
    data[i * 3 + 2] = Math.floor(color.b * 255);
  });
  
  const texture = new THREE.DataTexture(data, 16, 1);
  texture.format = THREE.RGBFormat;
  texture.type = THREE.UnsignedByteType;
  texture.needsUpdate = true;
  
  return texture;
}
```

---

## 4. ViewerSession

**説明**: ビューアーの表示状態とユーザー設定。

### Properties

| Property | Type | Description | Default | Persistence |
|----------|------|-------------|---------|-------------|
| `currentFile` | `string \| undefined` | 現在表示中のファイル名 | undefined | No |
| `cameraPosition` | `{ x, y, z }` | カメラ位置 | Auto | Yes (vscode.setState) |
| `cameraTarget` | `{ x, y, z }` | カメラ注視点 | (0, 0, 0) | Yes |
| `cameraZoom` | `number` | ズーム倍率 | 1.0 | Yes |
| `wireframe` | `boolean` | ワイヤーフレーム表示 | false | Yes |
| `showZeroValues` | `boolean` | 0値ボクセル表示 | false | Yes |
| `clippingEnabled` | `boolean` | クリッピング有効 | false | Yes |
| `clippingPlane` | `{ normal: vec3, distance: number }` | クリッピングプレーン | - | Yes |

### State Persistence

Webview再起動時に状態を復元：
```typescript
const vscode = acquireVsCodeApi();

// 状態保存
function saveState(session: ViewerSession) {
  vscode.setState(session);
}

// 状態復元
function restoreState(): ViewerSession | undefined {
  return vscode.getState();
}
```

### Initial Camera Position

ボクセルグリッドに応じたカメラ初期位置：
```typescript
function calculateInitialCamera(dimensions: Dimensions) {
  const maxDim = Math.max(dimensions.x, dimensions.y, dimensions.z);
  const distance = maxDim * 2.0;  // グリッドから2倍離れた位置
  
  return {
    position: { x: distance, y: distance, z: distance },
    target: { x: 0, y: 0, z: 0 },
    zoom: 1.0
  };
}
```

---

## 5. ParsedLesFile

**説明**: .leSファイルのパース中間結果。

### Properties

| Property | Type | Description |
|----------|------|-------------|
| `header` | `LesHeader` | ヘッダ情報 |
| `rows` | `number[][]` | 2次元配列（X*Y行、各Z値） |
| `errors` | `ParseError[]` | パースエラーリスト |
| `warnings` | `ParseWarning[]` | 警告リスト |

### LesHeader

| Property | Type | Description |
|----------|------|-------------|
| `x` | `number` | X方向サイズ |
| `y` | `number` | Y方向サイズ |
| `z` | `number` | Z方向サイズ |
| `voxelLength` | `number \| undefined` | ボクセル間隔（オプション） |

### ParseError / ParseWarning

```typescript
interface ParseError {
  line: number;
  message: string;
  severity: 'error';
}

interface ParseWarning {
  line: number;
  message: string;
  severity: 'warning';
}
```

### Validation Rules (FR-005, FR-011)

| Rule | Description | Error/Warning |
|------|-------------|---------------|
| **Header format** | "X Y Z [voxelLength]" 形式 | Error |
| **Size range** | 1 ≤ X,Y,Z ≤ 1000 | Error (FR-008) |
| **Row count** | 行数 === X * Y | Error (FR-011) |
| **Values per row** | 各行のZ値数 === Z | Error (FR-011) |
| **Value range** | 0 ≤ value ≤ 255 | Warning（自動clamp） |
| **Negative values** | 負値の検出 | Warning（0に変換） |

---

## 6. RenderingMetrics

**説明**: パフォーマンス計測データ（NFR-001, NFR-002対応）。

### Properties

```typescript
interface RenderingMetrics {
  loadMetrics: {
    fetchTime: number;          // ファイル読み込み時間（ms）
    parseTime: number;          // パース時間（ms）
    textureUploadTime: number;  // GPU転送時間（ms）
  };
  
  renderMetrics: {
    timeToFirstFrame: number;   // 初回描画時間（ms）【Primary】
    averageFps: number;         // 平均FPS
    minFps: number;             // 最低FPS
    frameTime: number;          // 平均フレーム時間（ms）
  };
  
  resourceMetrics: {
    cpuMemoryMB: number;        // CPU RAM使用量（MB）
    textureMemoryMB: number;    // テクスチャメモリ（MB）
    triangleCount: number;      // レンダリング三角形数
  };
}
```

### Target Values (from research.md)

| Metric | 200³ Target | 1000³ Target |
|--------|-------------|--------------|
| `timeToFirstFrame` | <5000ms | <15000ms |
| `averageFps` | >30fps | >20fps |
| `cpuMemoryMB` | <100MB | <1200MB |

---

## エンティティ関係図

```
┌─────────────────┐
│  VoxelDataset   │  (ファイルから読み込み)
└────────┬────────┘
         │ 1
         │
         │ creates
         ↓
    ┌─────────────┐
    │  VoxelGrid  │  (Three.js描画用)
    └──────┬──────┘
           │ uses
           ↓
  ┌──────────────────┐
  │ PaletteMapping  │  (色情報)
  └──────────────────┘
  
┌──────────────────┐
│ ViewerSession    │  (UI状態)
└──────┬───────────┘
       │ manages
       ↓
  ┌─────────────┐
  │  VoxelGrid  │
  └─────────────┘

┌──────────────────┐
│ ParsedLesFile    │  (パース中間結果)
└────────┬─────────┘
         │ validates & converts
         ↓
    ┌─────────────────┐
    │  VoxelDataset   │
    └─────────────────┘
```

---

## データフロー

```
1. ファイル読み込み
   File/URI → Uint8Array (Extension側)

2. パース
   Uint8Array → ParsedLesFile (LesParser)
   → Validation → VoxelDataset

3. Webviewへ転送
   VoxelDataset → postMessage → Webview

4. Three.js描画構築
   VoxelDataset → VoxelGrid (DataTexture生成)
   PaletteMapping → paletteTexture

5. レンダリング
   VoxelGrid + ViewerSession → Three.js Canvas
```

---

## TypeScript型定義

```typescript
// src/voxelParser/VoxelData.ts
export interface Dimensions {
  x: number;
  y: number;
  z: number;
}

export interface VoxelDataset {
  dimensions: Dimensions;
  voxelLength: number;
  values: Uint8Array;
  fileName: string;
  filePath?: string;
}

// webview/src/types/voxel.d.ts
export interface VoxelGrid {
  size: Dimensions;
  origin: { x: number; y: number; z: number };
  dataTexture: THREE.DataTexture3D;
  occupancyTexture?: THREE.DataTexture3D;
}

export interface ViewerSession {
  currentFile?: string;
  cameraPosition: { x: number; y: number; z: number };
  cameraTarget: { x: number; y: number; z: number };
  cameraZoom: number;
  wireframe: boolean;
  showZeroValues: boolean;
  clippingEnabled: boolean;
  clippingPlane?: { normal: [number, number, number]; distance: number };
}
```

---

## まとめ

6つの主要エンティティを定義：
1. **VoxelDataset**: ファイルデータの論理表現
2. **VoxelGrid**: Three.js描画用の物理表現
3. **PaletteMapping**: 色情報管理
4. **ViewerSession**: UI状態・設定
5. **ParsedLesFile**: パース中間結果
6. **RenderingMetrics**: パフォーマンス計測

これらのエンティティは、spec.mdの要件とresearch.mdの技術選択に基づいて設計されています。
