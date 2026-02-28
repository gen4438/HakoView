/**
 * CameraTab — カメラ設定タブ（T031）
 * usePerspective, fov, far, lightIntensity, ambientIntensity
 * FR-015 準拠: Zustand ストアと双方向バインディング
 */
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import { SliderControl } from '../controls/SliderControl';
import { ToggleControl } from '../controls/ToggleControl';
import { ButtonControl } from '../controls/ButtonControl';

export const CameraTab: React.FC = () => {
  const usePerspective = useControlStore((s) => s.usePerspective);
  const fov = useControlStore((s) => s.fov);
  const far = useControlStore((s) => s.far);
  const lightIntensity = useControlStore((s) => s.lightIntensity);
  const ambientIntensity = useControlStore((s) => s.ambientIntensity);
  const set = useControlStore((s) => s.set);

  return (
    <div className="tab-content">
      <ToggleControl
        label="パースペクティブ"
        checked={usePerspective}
        onChange={(v) => set({ usePerspective: v })}
      />
      <SliderControl
        label="視野角 (FOV)"
        value={fov}
        min={10}
        max={120}
        step={1}
        onChange={(v) => set({ fov: v })}
      />
      <SliderControl
        label="遠クリップ距離"
        value={far}
        min={100}
        max={100000}
        step={100}
        onChange={(v) => set({ far: v })}
      />
      <SliderControl
        label="ライト強度"
        value={lightIntensity}
        min={0}
        max={5}
        step={0.1}
        onChange={(v) => set({ lightIntensity: v })}
      />
      <SliderControl
        label="環境光強度"
        value={ambientIntensity}
        min={0}
        max={3}
        step={0.1}
        onChange={(v) => set({ ambientIntensity: v })}
      />
      {/* カメラタブのリセット */}
      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid var(--vscode-widget-border, #454545)',
          paddingTop: '12px',
        }}
      >
        <ButtonControl
          label="カメラをリセット"
          onClick={() => useControlStore.getState().resetCamera()}
        />
      </div>
    </div>
  );
};
