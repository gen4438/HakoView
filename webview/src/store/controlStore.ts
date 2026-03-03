import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import type { ControlStore, ControlState, ColorProfile } from './controlTypes';
import {
  DEFAULT_CONTROL_STATE,
  DEFAULT_PALETTE,
  DEFAULT_VISIBILITY,
  SEM_PALETTE,
  GRAYSCALE_PALETTE,
  RAINBOW_PALETTE,
  TAB10_PALETTE,
  SET1_PALETTE,
  SET2_PALETTE,
  SET3_PALETTE,
} from './controlDefaults';

// initDefaults で渡された初期化パラメータを記憶（reset 時に再適用するため）
let _initDims: { x: number; y: number; z: number } | null = null;
let _initMaxDpr = 1.0;
let _initColormap: Record<string, string> | null = null;

/** コントロール設定値を管理するZustandストア。
 *
 * - subscribeWithSelector ミドルウェアにより、細粒度のセレクタ購読が可能。
 * - React外からは useControlStore.getState() / useControlStore.setState() でアクセス。
 * - Three.js useFrame 内では getState() で毎フレーム参照する（再レンダリング不要）。
 */
export const useControlStore = create<ControlStore>()(
  subscribeWithSelector((zustandSet, zustandGet) => ({
    ...DEFAULT_CONTROL_STATE,

    set: (partial: Partial<ControlState>) => {
      zustandSet(partial);
    },

    reset: () => {
      // デフォルト値にリセット
      zustandSet({
        ...DEFAULT_CONTROL_STATE,
        customColors: [...DEFAULT_CONTROL_STATE.customColors],
        valueVisibility: [...DEFAULT_CONTROL_STATE.valueVisibility],
      });
      // initDefaults で渡された dims/maxDpr を再適用
      if (_initDims) {
        zustandSet({
          voxelDims: { ..._initDims },
          maxDpr: _initMaxDpr,
          dpr: _initMaxDpr,
          slicePosition1X: _initDims.x,
          slicePosition1Y: _initDims.y,
          slicePosition1Z: _initDims.z,
        });
      }
      // VSCode設定からのカラーマップを再適用
      if (_initColormap) {
        const colors = [...DEFAULT_CONTROL_STATE.customColors];
        Object.entries(_initColormap).forEach(([key, color]) => {
          const index = parseInt(key, 10);
          if (!isNaN(index) && index >= 0 && index < 16) {
            colors[index] = color;
          }
        });
        zustandSet({ customColors: colors });
      }
    },

    resetDisplay: () => {
      zustandSet({
        alpha: DEFAULT_CONTROL_STATE.alpha,
        dpr: _initDims ? _initMaxDpr : DEFAULT_CONTROL_STATE.dpr,
        useOccupancy: DEFAULT_CONTROL_STATE.useOccupancy,
        showScaleBar: DEFAULT_CONTROL_STATE.showScaleBar,
        showBoundingBox: DEFAULT_CONTROL_STATE.showBoundingBox,
        showGrid: DEFAULT_CONTROL_STATE.showGrid,
        enableEdgeHighlight: DEFAULT_CONTROL_STATE.enableEdgeHighlight,
        edgeThickness: DEFAULT_CONTROL_STATE.edgeThickness,
        edgeColor: DEFAULT_CONTROL_STATE.edgeColor,
        edgeIntensity: DEFAULT_CONTROL_STATE.edgeIntensity,
        edgeMaxDistance: DEFAULT_CONTROL_STATE.edgeMaxDistance,
      });
    },

    resetCamera: () => {
      zustandSet({
        usePerspective: DEFAULT_CONTROL_STATE.usePerspective,
        fov: DEFAULT_CONTROL_STATE.fov,
        far: DEFAULT_CONTROL_STATE.far,
        lightIntensity: DEFAULT_CONTROL_STATE.lightIntensity,
        ambientIntensity: DEFAULT_CONTROL_STATE.ambientIntensity,
        cameraResetRequest: zustandGet().cameraResetRequest + 1,
      });
    },

    requestCameraReset: () => {
      zustandSet({ cameraResetRequest: zustandGet().cameraResetRequest + 1 });
    },

    resetColors: () => {
      const colors = [...DEFAULT_PALETTE];
      let profile: ColorProfile = 'hako';
      if (_initColormap) {
        Object.entries(_initColormap).forEach(([key, color]) => {
          const index = parseInt(key, 10);
          if (!isNaN(index) && index >= 0 && index < 16) {
            colors[index] = color;
          }
        });
      }
      zustandSet({
        colorProfile: profile,
        customColors: colors,
        valueVisibility: [...DEFAULT_VISIBILITY],
      });
    },

    resetClipping: () => {
      zustandSet({
        clippingMode: DEFAULT_CONTROL_STATE.clippingMode,
        sliceAxis: DEFAULT_CONTROL_STATE.sliceAxis,
        slicePosition1X: _initDims ? _initDims.x : DEFAULT_CONTROL_STATE.slicePosition1X,
        slicePosition1Y: _initDims ? _initDims.y : DEFAULT_CONTROL_STATE.slicePosition1Y,
        slicePosition1Z: _initDims ? _initDims.z : DEFAULT_CONTROL_STATE.slicePosition1Z,
        slicePosition2X: DEFAULT_CONTROL_STATE.slicePosition2X,
        slicePosition2Y: DEFAULT_CONTROL_STATE.slicePosition2Y,
        slicePosition2Z: DEFAULT_CONTROL_STATE.slicePosition2Z,
        customNormalX: DEFAULT_CONTROL_STATE.customNormalX,
        customNormalY: DEFAULT_CONTROL_STATE.customNormalY,
        customNormalZ: DEFAULT_CONTROL_STATE.customNormalZ,
        customDistance: DEFAULT_CONTROL_STATE.customDistance,
        alwaysShowSlicePlanes: DEFAULT_CONTROL_STATE.alwaysShowSlicePlanes,
        activeSlice: DEFAULT_CONTROL_STATE.activeSlice,
      });
    },

    updateColor: (index: number, color: string) => {
      const current = zustandGet().customColors;
      const next = [...current];
      next[index] = color;
      zustandSet({ customColors: next, colorProfile: 'custom' });
    },

    updateVisibility: (index: number, visible: boolean) => {
      const current = zustandGet().valueVisibility;
      const next = [...current];
      next[index] = visible;
      zustandSet({ valueVisibility: next, colorProfile: 'custom' });
    },

    setColorProfile: (profile: ColorProfile) => {
      let nextColors = [...DEFAULT_PALETTE];
      let nextVisibility = [...DEFAULT_VISIBILITY];

      switch (profile) {
        case 'hako':
          nextColors = [...DEFAULT_PALETTE];
          break;
        case 'sem':
          nextColors = [...SEM_PALETTE];
          nextVisibility[0] = true; // SEMモードは 0 もデフォルト表示
          break;
        case 'grayscale':
          nextColors = [...GRAYSCALE_PALETTE];
          break;
        case 'rainbow':
          nextColors = [...RAINBOW_PALETTE];
          break;
        case 'tab10':
          nextColors = [...TAB10_PALETTE];
          break;
        case 'set1':
          nextColors = [...SET1_PALETTE];
          break;
        case 'set2':
          nextColors = [...SET2_PALETTE];
          break;
        case 'set3':
          nextColors = [...SET3_PALETTE];
          break;
        case 'custom':
          // VSCode設定から渡された初期カラーマップ(カスタム設定)を復元
          nextColors = [...DEFAULT_PALETTE];
          if (_initColormap) {
            Object.entries(_initColormap).forEach(([key, color]) => {
              const index = parseInt(key, 10);
              if (!isNaN(index) && index >= 0 && index < 16) {
                nextColors[index] = color;
              }
            });
          }
          break;
      }

      zustandSet({
        colorProfile: profile,
        customColors: nextColors,
        valueVisibility: nextVisibility,
      });
    },

    setVoxelStatistics: (stats) => {
      zustandSet({ voxelStatistics: stats });
    },

    setSlicePosition: (slice: 1 | 2, value: number) => {
      const { sliceAxis } = zustandGet();
      if (sliceAxis === 'X') {
        if (slice === 1) {
          zustandSet({ slicePosition1X: value });
        } else {
          zustandSet({ slicePosition2X: value });
        }
      } else if (sliceAxis === 'Y') {
        if (slice === 1) {
          zustandSet({ slicePosition1Y: value });
        } else {
          zustandSet({ slicePosition2Y: value });
        }
      } else {
        // Z
        if (slice === 1) {
          zustandSet({ slicePosition1Z: value });
        } else {
          zustandSet({ slicePosition2Z: value });
        }
      }
    },

    updateGlobalColormap: (colormap: Record<string, string>) => {
      _initColormap = colormap;
    },

    initDefaults: (
      dims: { x: number; y: number; z: number },
      maxDpr: number,
      colormap?: Record<string, string>,
      colorProfile?: string
    ) => {
      // パラメータを記憶（reset 時に再利用）
      _initDims = dims;
      _initMaxDpr = maxDpr;
      if (colormap !== undefined) {
        _initColormap = colormap;
      }

      // colormapが渡されている場合、customColorsの初期配列を作る
      let initialCustomColors = [...DEFAULT_PALETTE];
      if (colormap !== undefined && Object.keys(colormap).length > 0) {
        Object.entries(colormap).forEach(([key, color]) => {
          const index = parseInt(key, 10);
          if (!isNaN(index) && index >= 0 && index < 16) {
            initialCustomColors[index] = color;
          }
        });
      }

      let profileToSet: ColorProfile = 'hako';
      if (colorProfile) {
        profileToSet = colorProfile as ColorProfile;
      }

      zustandSet({
        colorProfile: profileToSet,
        customColors: initialCustomColors,
      });

      // そのプロファイル固有の変更（tab10 等のアクティベーション）はsetColorProfileと同じロジックを通すため、
      // 便宜上一度同じアクションを呼ぶか、直接更新する
      // ここでは zustandSet を使って、指定されたプロファイルによる書き換えを行う
      let nextColors = initialCustomColors;
      let nextVisibility = [...DEFAULT_VISIBILITY];

      switch (profileToSet) {
        case 'hako':
          nextColors = [...DEFAULT_PALETTE];
          break;
        case 'sem':
          nextColors = [...SEM_PALETTE];
          // ID 0 を表示するように
          nextVisibility[0] = true;
          break;
        case 'grayscale':
          nextColors = [...GRAYSCALE_PALETTE];
          break;
        case 'rainbow':
          nextColors = [...RAINBOW_PALETTE];
          break;
        case 'tab10':
          nextColors = [...TAB10_PALETTE];
          break;
        case 'set1':
          nextColors = [...SET1_PALETTE];
          break;
        case 'set2':
          nextColors = [...SET2_PALETTE];
          break;
        case 'set3':
          nextColors = [...SET3_PALETTE];
          break;
        case 'custom':
          // custom の場合は上でマージした initialCustomColors をそのまま使う
          break;
      }

      zustandSet({
        customColors: nextColors,
        valueVisibility: nextVisibility,
      });

      zustandSet({
        voxelDims: { ...dims },
        maxDpr,
        dpr: maxDpr,
        // slicePosition1 = Pos (上限) = 各軸の寸法値 (levaのデフォルトと同じ)
        // slicePosition2 = Neg (下限) = 0 (DEFAULT_CONTROL_STATE のデフォルト値のまま)
        slicePosition1X: dims.x,
        slicePosition1Y: dims.y,
        slicePosition1Z: dims.z,
      });
    },
  }))
);
