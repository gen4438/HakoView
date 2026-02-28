/**
 * DisplayTab — 表示設定タブ（T030）
 * alpha, dpr, useOccupancy, showScaleBar, showBoundingBox, showGrid +
 * エッジハイライトアコーディオン
 * FR-015 準拠: Zustand ストアと双方向バインディング
 */
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import { SliderControl } from '../controls/SliderControl';
import { ToggleControl } from '../controls/ToggleControl';
import { ButtonControl } from '../controls/ButtonControl';
import { Accordion } from '../drawer/Accordion';

export const DisplayTab: React.FC = () => {
  const alpha = useControlStore((s) => s.alpha);
  const dpr = useControlStore((s) => s.dpr);
  const useOccupancy = useControlStore((s) => s.useOccupancy);
  const showScaleBar = useControlStore((s) => s.showScaleBar);
  const showBoundingBox = useControlStore((s) => s.showBoundingBox);
  const showGrid = useControlStore((s) => s.showGrid);
  const enableEdgeHighlight = useControlStore((s) => s.enableEdgeHighlight);
  const edgeThickness = useControlStore((s) => s.edgeThickness);
  const edgeIntensity = useControlStore((s) => s.edgeIntensity);
  const edgeMaxDistance = useControlStore((s) => s.edgeMaxDistance);
  const set = useControlStore((s) => s.set);

  return (
    <div className="tab-content">
      <SliderControl
        label="透明度"
        value={alpha}
        min={0}
        max={1}
        step={0.01}
        onChange={(v) => set({ alpha: v })}
      />
      <SliderControl
        label="解像度 (DPR)"
        value={dpr}
        min={0.5}
        max={typeof window !== 'undefined' ? window.devicePixelRatio || 2 : 2}
        step={0.1}
        onChange={(v) => set({ dpr: v })}
      />
      <ToggleControl
        label="Occupancy Grid"
        checked={useOccupancy}
        onChange={(v) => set({ useOccupancy: v })}
      />
      <ToggleControl
        label="スケールバー"
        checked={showScaleBar}
        onChange={(v) => set({ showScaleBar: v })}
      />
      <ToggleControl
        label="バウンディングボックス"
        checked={showBoundingBox}
        onChange={(v) => set({ showBoundingBox: v })}
      />
      <ToggleControl label="グリッド" checked={showGrid} onChange={(v) => set({ showGrid: v })} />
      <Accordion label="エッジハイライト" defaultOpen={false}>
        <ToggleControl
          label="有効"
          checked={enableEdgeHighlight}
          onChange={(v) => set({ enableEdgeHighlight: v })}
        />
        <SliderControl
          label="太さ"
          value={edgeThickness}
          min={0.1}
          max={5}
          step={0.1}
          onChange={(v) => set({ edgeThickness: v })}
        />
        <SliderControl
          label="強度"
          value={edgeIntensity}
          min={0}
          max={1}
          step={0.01}
          onChange={(v) => set({ edgeIntensity: v })}
        />
        <SliderControl
          label="最大距離"
          value={edgeMaxDistance}
          min={50}
          max={2000}
          step={10}
          onChange={(v) => set({ edgeMaxDistance: v })}
        />
      </Accordion>
      {/* FR-019: 全設定リセット */}
      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid var(--vscode-widget-border, #454545)',
          paddingTop: '12px',
        }}
      >
        <ButtonControl
          label="全設定をリセット"
          onClick={() => useControlStore.getState().reset()}
        />
      </div>
    </div>
  );
};
