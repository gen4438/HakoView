/**
 * ClippingTab — クリッピング設定タブ
 * T044 [US5] FR-018 準拠
 *
 * - ClippingMode: Off / Slice / Custom
 * - Slice モード時: スライス軸 (X/Y/Z)、開始・終了ポジションスライダー
 * - Custom モード時: 法線ベクトル (X/Y/Z)、平面距離
 */
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import { SliderControl } from '../controls/SliderControl';
import { SelectControl } from '../controls/SelectControl';
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
  const set = useControlStore((s) => s.set);

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
          <SliderControl
            label="スライス位置（開始）"
            value={currentSlicePos1}
            min={0}
            max={1023}
            step={1}
            onChange={handleSlicePos1}
          />
          <SliderControl
            label="スライス位置（終了）"
            value={currentSlicePos2}
            min={0}
            max={1023}
            step={1}
            onChange={handleSlicePos2}
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
            min={-512}
            max={512}
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
