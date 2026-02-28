# Data Model: カスタムコントロールドロワー

**Feature**: 002-custom-control-drawer
**Date**: 2026-02-28

## エンティティ定義

### 1. ControlState（コントロール設定値）

Zustandストアに格納される全コントロール設定値の型定義。

```typescript
/** クリッピングモード */
export type ClippingMode = 'Off' | 'Slice' | 'Custom';

/** スライス軸 */
export type SliceAxis = 'X' | 'Y' | 'Z';

/**
 * 全コントロール設定値の状態。
 * Zustandストアのstate部分に対応する。
 */
export interface ControlState {
  // ---- Camera ----
  usePerspective: boolean;
  fov: number; // 0–180, step 5
  far: number; // 500–3000, step 100

  // ---- Lighting ----
  lightIntensity: number; // 0.0–2.0, step 0.01
  ambientIntensity: number; // 0.0–1.0, step 0.01

  // ---- Display ----
  alpha: number; // 0.0–1.0, step 0.01
  dpr: number; // 0.5–maxDpr, step 0.1
  useOccupancy: boolean;
  showScaleBar: boolean;
  showBoundingBox: boolean;
  showGrid: boolean;

  // ---- Edge Highlight ----
  enableEdgeHighlight: boolean;
  edgeThickness: number; // 0.02–0.15, step 0.01
  edgeColor: string; // hex color e.g. '#ffffff'
  edgeIntensity: number; // 0.0–1.0, step 0.01
  edgeMaxDistance: number; // 50–max(edgeMaxRange, 200), step 10

  // ---- Clipping ----
  clippingMode: ClippingMode;
  sliceAxis: SliceAxis;
  slicePosition1X: number; // 0–dimX, step 1
  slicePosition2X: number;
  slicePosition1Y: number; // 0–dimY, step 1
  slicePosition2Y: number;
  slicePosition1Z: number; // 0–dimZ, step 1
  slicePosition2Z: number;
  customNormalX: number; // -1–1, step 0.01
  customNormalY: number;
  customNormalZ: number;
  customDistance: number; // -distanceRange–distanceRange, step 1

  // ---- Colors ----
  customColors: string[]; // length 16, hex color strings
  valueVisibility: boolean[]; // length 16
}
```

**検証ルール**:

- `fov`: 0 ≤ fov ≤ 180
- `far`: 500 ≤ far ≤ 3000
- `alpha`, `ambientIntensity`, `edgeIntensity`: 0.0 ≤ v ≤ 1.0
- `lightIntensity`: 0.0 ≤ v ≤ 2.0
- `customColors`: 長さ16の配列。各要素は `#rrggbb` 形式の文字列
- `valueVisibility`: 長さ16の配列
- スライスポジション: 各軸の次元サイズ以下の非負整数

### 2. ControlActions（ストアアクション）

```typescript
/**
 * ストアのアクション定義。
 * ControlState とは分離し、UIロジックからの操作を型安全に提供する。
 */
export interface ControlActions {
  /** 部分的な状態更新 */
  set: (partial: Partial<ControlState>) => void;
  /** 全設定をデフォルト値にリセット */
  reset: () => void;
  /** 特定インデックスの色を更新 */
  updateColor: (index: number, color: string) => void;
  /** 特定インデックスの可視性を更新 */
  updateVisibility: (index: number, visible: boolean) => void;
  /** アクティブスライスの位置を更新 */
  setSlicePosition: (slice: 1 | 2, value: number) => void;
  /** デフォルト値を動的に設定（ボクセルデータ依存の値） */
  initDefaults: (dims: { x: number; y: number; z: number }, maxDpr: number) => void;
}

/** ストア全体の型 */
export type ControlStore = ControlState & ControlActions;
```

### 3. ControlMeta（コントロールメタデータ）

UIコンポーネントのレンダリングに使用する各コントロールの表示情報。

```typescript
/** コントロールの種類 */
export type ControlType = 'slider' | 'toggle' | 'color' | 'select' | 'button';

/**
 * 個々のコントロールUIの表示メタデータ。
 * Zustandストアには含めず、描画側で定数として定義する。
 */
export interface ControlMeta {
  /** ストアのキー名 */
  key: keyof ControlState;
  /** UIに表示するラベル */
  label: string;
  /** コントロールの種類 */
  type: ControlType;
  /** スライダー用: 最小値 */
  min?: number;
  /** スライダー用: 最大値 */
  max?: number;
  /** スライダー用: ステップ */
  step?: number;
  /** セレクト用: 選択肢 */
  options?: string[];
  /** 条件付き表示: この関数がtrueを返すときのみ表示 */
  visible?: (state: ControlState) => boolean;
}
```

### 4. DrawerState（ドロワーUI状態）

ドロワー固有のUI状態。コントロール設定値とは独立して管理する。

```typescript
/** タブID */
export type TabId = 'display' | 'camera' | 'colors' | 'clipping';

/**
 * ドロワーのUI状態。
 * コントロール設定値（ControlState）とは分離して管理する。
 */
export interface DrawerState {
  /** ドロワーの開閉状態 */
  isOpen: boolean;
  /** アクティブタブ */
  activeTab: TabId;
  /** アコーディオンの展開状態（キー: セクションID） */
  expandedSections: Record<string, boolean>;
}
```

### 5. TabDefinition（タブ定義）

```typescript
/**
 * タブの定義。表示順序とアイコン情報を含む。
 */
export interface TabDefinition {
  id: TabId;
  label: string;
  icon?: string; // FontAwesome icon name
}
```

## エンティティ間の関係

```
┌─────────────────────┐     ┌──────────────────────┐
│     DrawerState      │     │    ControlState       │
│  (UI状態)            │     │  (設定値)             │
│                      │     │                       │
│  isOpen              │     │  usePerspective       │
│  activeTab           │     │  alpha                │
│  expandedSections    │     │  customColors[16]     │
│                      │     │  valueVisibility[16]  │
│  ※ Zustand store     │     │  ...40+ fields        │
│    または useState    │     │                       │
└─────────────────────┘     │  ※ Zustand store       │
                             └───────────┬───────────┘
                                         │
                    ┌────────────────────┼────────────────────┐
                    │                    │                    │
                    ▼                    ▼                    ▼
          ┌─────────────┐    ┌──────────────────┐   ┌────────────────┐
          │ Drawer UI   │    │ Keyboard Handler │   │ VoxelScene     │
          │ (React)     │    │ (vanilla event)  │   │ (Three.js)     │
          │             │    │                  │   │                │
          │ useStore()  │    │ getState()       │   │ getState()     │
          │ セレクタ購読 │    │ setState()       │   │ → uniforms     │
          └─────────────┘    └──────────────────┘   └────────────────┘
```

## 状態遷移

### DrawerState

```
[閉じている] --toggleButton click--> [開いている]
[開いている] --toggleButton click--> [閉じている]

[任意のタブ] --tabClick(id)--> [指定タブがアクティブ]

[セクション閉じ] --headerClick--> [セクション開き]
[セクション開き] --headerClick--> [セクション閉じ]
```

### ControlState (リセット)

```
[任意の設定状態] --reset()--> [全フィールドがデフォルト値]
[任意の設定状態] --initDefaults(dims, maxDpr)--> [次元依存フィールドが初期化]
```

### ClippingMode 遷移

```
[Off] --select/cc--> [Slice]
[Slice] --select--> [Custom]
[Custom] --select--> [Off]
[Slice] --cc--> [Off]
[Custom] --cc--> [Off]
```

## デフォルト値

```typescript
export const DEFAULT_PALETTE: string[] = [
  '#000000', // 0 (空ボクセル)
  '#ff0000',
  '#00ff00',
  '#0000ff',
  '#ffff00',
  '#ff00ff',
  '#00ffff',
  '#ff8000',
  '#8000ff',
  '#0080ff',
  '#ff0080',
  '#80ff00',
  '#00ff80',
  '#804000',
  '#404040',
  '#c0c0c0',
];

export const DEFAULT_VISIBILITY: boolean[] = [
  false, // 0 (空)は非表示
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
  true,
];

export const DEFAULT_CONTROL_STATE: ControlState = {
  // Camera
  usePerspective: true,
  fov: 50,
  far: 2000,
  // Lighting
  lightIntensity: 0.8,
  ambientIntensity: 0.4,
  // Display
  alpha: 1.0,
  dpr: 1.0, // initDefaults()で maxDpr に更新
  useOccupancy: true,
  showScaleBar: true,
  showBoundingBox: false,
  showGrid: true,
  // Edge Highlight
  enableEdgeHighlight: true,
  edgeThickness: 0.03,
  edgeColor: '#ffffff',
  edgeIntensity: 0.8,
  edgeMaxDistance: 200,
  // Clipping
  clippingMode: 'Off',
  sliceAxis: 'Z',
  slicePosition1X: 0,
  slicePosition2X: 0,
  slicePosition1Y: 0,
  slicePosition2Y: 0,
  slicePosition1Z: 0,
  slicePosition2Z: 0,
  customNormalX: 0,
  customNormalY: 0,
  customNormalZ: 1,
  customDistance: 0,
  // Colors
  customColors: DEFAULT_PALETTE,
  valueVisibility: DEFAULT_VISIBILITY,
};
```
