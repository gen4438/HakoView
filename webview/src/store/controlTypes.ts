/** クリッピングモード */
export type ClippingMode = 'Off' | 'Slice' | 'Custom';

/** スライス軸 */
export type SliceAxis = 'X' | 'Y' | 'Z';

/** タブID */
export type TabId = 'display' | 'camera' | 'colors' | 'clipping';

/**
 * 全コントロール設定値の状態。
 * Zustandストアのstate部分に対応する。
 */
export interface ControlState {
  // ---- Initialization Info (read-only from tabs) ----
  /** ボクセル次元（initDefaultsで設定） */
  voxelDims: { x: number; y: number; z: number };
  /** 最大DPR（initDefaultsで設定） */
  maxDpr: number;

  // ---- Camera ----
  usePerspective: boolean;
  fov: number; // 10–120, step 1
  far: number; // 動的: maxDim基準

  // ---- Lighting ----
  lightIntensity: number; // 0.0–2.0, step 0.1
  ambientIntensity: number; // 0.0–1.0, step 0.1

  // ---- Display ----
  alpha: number; // 0.0–1.0, step 0.01
  dpr: number; // 0.5–maxDpr, step 0.1
  useOccupancy: boolean;
  showScaleBar: boolean;
  showBoundingBox: boolean;
  showGrid: boolean;

  // ---- Edge Highlight ----
  enableEdgeHighlight: boolean;
  edgeThickness: number; // 0.01–0.15, step 0.01
  edgeColor: string; // hex color e.g. '#ffffff'
  edgeIntensity: number; // 0.0–1.0, step 0.01
  edgeMaxDistance: number; // 動的: maxDim基準

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
  customDistance: number; // 動的: maxDim基準
  /** スライス平面の常時表示 (ssキーに対応) */
  alwaysShowSlicePlanes: boolean;
  /** 操作対象のスライス (1 or 2) — ドロワーとキーボード/マウスで共有 */
  activeSlice: 1 | 2;

  // ---- Camera Reset Request ----
  /** カメラリセット要求カウンタ（インクリメントでリセットをトリガー） */
  cameraResetRequest: number;

  // ---- Colors ----
  customColors: string[]; // length 16, hex color strings
  valueVisibility: boolean[]; // length 16
}

/**
 * ストアのアクション定義。
 * ControlState とは分離し、UIロジックからの操作を型安全に提供する。
 */
export interface ControlActions {
  /** 部分的な状態更新 */
  set: (partial: Partial<ControlState>) => void;
  /** 全設定をデフォルト値にリセット（initDefaults で渡された dims/maxDpr/colormap を再適用） */
  reset: () => void;
  /** 表示タブの設定をリセット */
  resetDisplay: () => void;
  /** カメラタブの設定をリセット（カメラ位置もリセット） */
  resetCamera: () => void;
  /** カメラリセットを要求（カメラ位置・姿勢を初期化） */
  requestCameraReset: () => void;
  /** カラータブの設定をリセット */
  resetColors: () => void;
  /** クリッピングタブの設定をリセット */
  resetClipping: () => void;
  /** 特定インデックスの色を更新 */
  updateColor: (index: number, color: string) => void;
  /** 特定インデックスの可視性を更新 */
  updateVisibility: (index: number, visible: boolean) => void;
  /** アクティブスライスの位置を更新 */
  setSlicePosition: (slice: 1 | 2, value: number) => void;
  /** デフォルト値を動的に設定（ボクセルデータ依存の値） */
  initDefaults: (
    dims: { x: number; y: number; z: number },
    maxDpr: number,
    colormap?: Record<string, string>
  ) => void;
}

/** ストア全体の型 */
export type ControlStore = ControlState & ControlActions;

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
