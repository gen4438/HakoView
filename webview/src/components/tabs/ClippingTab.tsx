/**
 * ClippingTab — クリッピング設定タブ
 * T044 [US5] FR-018 準拠
 *
 * - ClippingMode: Off / Slice / Custom
 * - Slice モード時: スライス軸 (X/Y/Z)、開始・終了ポジションスライダー、
 *   スライス1/2切替、スライス面の表示切替
 * - Custom モード時: 法線ベクトル (X/Y/Z)、平面距離
 */
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import { SliderControl } from '../controls/SliderControl';
import { SelectControl } from '../controls/SelectControl';
import { ToggleControl } from '../controls/ToggleControl';
import { ButtonControl } from '../controls/ButtonControl';
import type { ClippingMode, SliceAxis } from '../../store/controlTypes';

/** ClippingMode の選択肢 */
const CLIPPING_MODE_OPTIONS: { value: ClippingMode; label: string }[] = [
  { value: 'Off', label: 'なし' },
  { value: 'Slice', label: 'スライス' },
  { value: 'Custom', label: 'カスタム平面' },
];

/** SliceAxis の選択肢 */
const SLICE_AXIS_OPTIONS: { value: SliceAxis; label: string }[] = [
  { value: 'X', label: 'X 軸' },
  { value: 'Y', label: 'Y 軸' },
  { value: 'Z', label: 'Z 軸' },
];

export const ClippingTab: React.FC = () => {
  const clippingMode = useControlStore((s) => s.clippingMode);
  const sliceAxis = useControlStore((s) => s.sliceAxis);
  const slicePosition1X = useControlStore((s) => s.slicePosition1X);
  const slicePosition2X = useControlStore((s) => s.slicePosition2X);
  const slicePosition1Y = useControlStore((s) => s.slicePosition1Y);
  const slicePosition2Y = useControlStore((s) => s.slicePosition2Y);
  const slicePosition1Z = useControlStore((s) => s.slicePosition1Z);
  const slicePosition2Z = useControlStore((s) => s.slicePosition2Z);
  const customNormalX = useControlStore((s) => s.customNormalX);
  const customNormalY = useControlStore((s) => s.customNormalY);
  const customNormalZ = useControlStore((s) => s.customNormalZ);
  const customDistance = useControlStore((s) => s.customDistance);
  const alwaysShowSlicePlanes = useControlStore((s) => s.alwaysShowSlicePlanes);
  const voxelDims = useControlStore((s) => s.voxelDims);
  const set = useControlStore((s) => s.set);

  // 現在操作対象のスライス (1 or 2) — ストアで共有
  const activeSlice = useControlStore((s) => s.activeSlice);

  // ボクセルサイズに基づく動的な最大値
  const sliceMaxX = voxelDims.x;
  const sliceMaxY = voxelDims.y;
  const sliceMaxZ = voxelDims.z;
  const currentSliceMax = sliceAxis === 'X' ? sliceMaxX : sliceAxis === 'Y' ? sliceMaxY : sliceMaxZ;

  // カスタム平面の距離範囲: ボクセル対角線の半径
  const maxDim = Math.max(voxelDims.x, voxelDims.y, voxelDims.z);
  const distanceRange = Math.ceil(maxDim);

  /** 現在の軸に対応するスライスポジションを返す */
  const currentSlicePos1 =
    sliceAxis === 'X' ? slicePosition1X : sliceAxis === 'Y' ? slicePosition1Y : slicePosition1Z;
  const currentSlicePos2 =
    sliceAxis === 'X' ? slicePosition2X : sliceAxis === 'Y' ? slicePosition2Y : slicePosition2Z;

  /**
   * スライスポジション変更のハンドラ
   * 軸に対応するフィールドを更新する
   */
  const handleSlicePos1 = (v: number) => {
    const key =
      sliceAxis === 'X'
        ? 'slicePosition1X'
        : sliceAxis === 'Y'
          ? 'slicePosition1Y'
          : 'slicePosition1Z';
    set({ [key]: v });
  };
  const handleSlicePos2 = (v: number) => {
    const key =
      sliceAxis === 'X'
        ? 'slicePosition2X'
        : sliceAxis === 'Y'
          ? 'slicePosition2Y'
          : 'slicePosition2Z';
    set({ [key]: v });
  };

  return (
    <div className="controls-grid">
      {/* クリッピングモード選択 */}
      <SelectControl
        label="クリッピング"
        value={clippingMode}
        options={CLIPPING_MODE_OPTIONS}
        onChange={(v) => set({ clippingMode: v as ClippingMode })}
      />

      {/* Slice モード時のみ表示 */}
      {clippingMode === 'Slice' && (
        <>
          <SelectControl
            label="スライス軸"
            value={sliceAxis}
            options={SLICE_AXIS_OPTIONS}
            onChange={(v) => set({ sliceAxis: v as SliceAxis })}
          />
          {/* 操作対象のスライス切替 */}
          <div className="control-row">
            <label className="control-label">操作対象</label>
            <div className="control-input">
              <div className="slice-toggle-group">
                <button
                  className={`slice-toggle-btn ${activeSlice === 1 ? 'active' : ''}`}
                  onClick={() => set({ activeSlice: 1 })}
                >
                  スライス 1
                </button>
                <button
                  className={`slice-toggle-btn ${activeSlice === 2 ? 'active' : ''}`}
                  onClick={() => set({ activeSlice: 2 })}
                >
                  スライス 2
                </button>
              </div>
            </div>
          </div>
          <SliderControl
            label={`スライス 1 (${sliceAxis})`}
            value={currentSlicePos1}
            min={0}
            max={currentSliceMax}
            step={1}
            onChange={handleSlicePos1}
          />
          <SliderControl
            label={`スライス 2 (${sliceAxis})`}
            value={currentSlicePos2}
            min={0}
            max={currentSliceMax}
            step={1}
            onChange={handleSlicePos2}
          />
          <ToggleControl
            label="スライス面を常時表示"
            checked={alwaysShowSlicePlanes}
            onChange={(v) => set({ alwaysShowSlicePlanes: v })}
          />
        </>
      )}

      {/* Custom モード時のみ表示 */}
      {clippingMode === 'Custom' && (
        <>
          <SliderControl
            label="法線 X"
            value={customNormalX}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => set({ customNormalX: v })}
          />
          <SliderControl
            label="法線 Y"
            value={customNormalY}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => set({ customNormalY: v })}
          />
          <SliderControl
            label="法線 Z"
            value={customNormalZ}
            min={-1}
            max={1}
            step={0.01}
            onChange={(v) => set({ customNormalZ: v })}
          />
          <SliderControl
            label="距離"
            value={customDistance}
            min={-distanceRange}
            max={distanceRange}
            step={1}
            onChange={(v) => set({ customDistance: v })}
          />
        </>
      )}
      {/* クリッピングタブのリセット */}
      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid var(--vscode-widget-border, #454545)',
          paddingTop: '12px',
        }}
      >
        <ButtonControl
          label="クリッピングをリセット"
          onClick={() => useControlStore.getState().resetClipping()}
        />
      </div>
    </div>
  );
};
