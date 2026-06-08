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
  const maxDpr = useControlStore((s) => s.maxDpr);
  const useOccupancy = useControlStore((s) => s.useOccupancy);
  const showScaleBar = useControlStore((s) => s.showScaleBar);
  const showBoundingBox = useControlStore((s) => s.showBoundingBox);
  const showGrid = useControlStore((s) => s.showGrid);
  const enableEdgeHighlight = useControlStore((s) => s.enableEdgeHighlight);
  const edgeThickness = useControlStore((s) => s.edgeThickness);
  const edgeIntensity = useControlStore((s) => s.edgeIntensity);
  const edgeMaxDistance = useControlStore((s) => s.edgeMaxDistance);
  const smoothMode = useControlStore((s) => s.smoothMode);
  const smoothStepSize = useControlStore((s) => s.smoothStepSize);
  const smoothRefineIterations = useControlStore((s) => s.smoothRefineIterations);
  const smoothMovingStepSize = useControlStore((s) => s.smoothMovingStepSize);
  const smoothMovingRefineIterations = useControlStore((s) => s.smoothMovingRefineIterations);
  const voxelDims = useControlStore((s) => s.voxelDims);
  const set = useControlStore((s) => s.set);

  const maxDim = Math.max(voxelDims.x, voxelDims.y, voxelDims.z);
  // エッジハイライトの最大距離: ボクセル対角線の約1.5倍
  const edgeMaxDistanceMax = Math.max(200, Math.ceil(maxDim * 1.5));

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
        max={Math.max(maxDpr, 4.0)}
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
      <Accordion label="スムース表示" defaultOpen={false}>
        <ToggleControl label="有効" checked={smoothMode} onChange={(v) => set({ smoothMode: v })} />
        <SliderControl
          label="ステップ幅 (停止時)"
          value={smoothStepSize}
          min={0.1}
          max={1.0}
          step={0.05}
          onChange={(v) => set({ smoothStepSize: v })}
        />
        <SliderControl
          label="境界精度 (停止時)"
          value={smoothRefineIterations}
          min={1}
          max={8}
          step={1}
          onChange={(v) => set({ smoothRefineIterations: v })}
        />
        <SliderControl
          label="ステップ幅 (操作中)"
          value={smoothMovingStepSize}
          min={0.2}
          max={2.0}
          step={0.05}
          onChange={(v) => set({ smoothMovingStepSize: v })}
        />
        <SliderControl
          label="境界精度 (操作中)"
          value={smoothMovingRefineIterations}
          min={0}
          max={6}
          step={1}
          onChange={(v) => set({ smoothMovingRefineIterations: v })}
        />
      </Accordion>
      <Accordion label="エッジハイライト" defaultOpen={false}>
        <ToggleControl
          label="有効"
          checked={enableEdgeHighlight}
          onChange={(v) => set({ enableEdgeHighlight: v })}
        />
        <SliderControl
          label="太さ"
          value={edgeThickness}
          min={0.01}
          max={0.15}
          step={0.01}
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
          min={10}
          max={edgeMaxDistanceMax}
          step={5}
          onChange={(v) => set({ edgeMaxDistance: v })}
        />
      </Accordion>
      {/* 表示タブのリセット */}
      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid var(--vscode-widget-border, #454545)',
          paddingTop: '12px',
        }}
      >
        <ButtonControl
          label="表示をリセット"
          onClick={() => useControlStore.getState().resetDisplay()}
        />
      </div>
    </div>
  );
};
