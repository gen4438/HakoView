/**
 * CameraTab — カメラ設定タブ（T031）
 * usePerspective, fov, far, lightIntensity, ambientIntensity + カメラ姿勢表示
 * FR-015 準拠: Zustand ストアと双方向バインディング
 */
import React, { useState, useEffect } from 'react';
import { useControlStore } from '../../store/controlStore';
import { SliderControl } from '../controls/SliderControl';
import { ToggleControl } from '../controls/ToggleControl';
import { ButtonControl } from '../controls/ButtonControl';
import { Accordion } from '../drawer/Accordion';

/** カメラ姿勢情報 (VoxelRendererから更新される) */
export interface CameraPose {
  position: { x: number; y: number; z: number };
  target: { x: number; y: number; z: number };
}

/** カメラ姿勢をグローバルに更新するためのイベントターゲット */
const cameraPoseEvent = new EventTarget();
let _currentPose: CameraPose = {
  position: { x: 0, y: 0, z: 0 },
  target: { x: 0, y: 0, z: 0 },
};

/** VoxelRendererから呼び出してカメラ姿勢を更新 */
export function updateCameraPose(pose: CameraPose) {
  _currentPose = pose;
  cameraPoseEvent.dispatchEvent(new Event('update'));
}

const fmt = (n: number) => n.toFixed(1);

export const CameraTab: React.FC = () => {
  const usePerspective = useControlStore((s) => s.usePerspective);
  const fov = useControlStore((s) => s.fov);
  const far = useControlStore((s) => s.far);
  const lightIntensity = useControlStore((s) => s.lightIntensity);
  const ambientIntensity = useControlStore((s) => s.ambientIntensity);
  const voxelDims = useControlStore((s) => s.voxelDims);
  const set = useControlStore((s) => s.set);

  const maxDim = Math.max(voxelDims.x, voxelDims.y, voxelDims.z);
  // 描画距離の上限: ボクセル対角線の約5倍（十分な余裕）
  const farMax = Math.max(2000, Math.ceil(maxDim * 5));

  // カメラ姿勢の表示
  const [pose, setPose] = useState<CameraPose>(_currentPose);
  useEffect(() => {
    const handler = () => setPose({ ..._currentPose });
    cameraPoseEvent.addEventListener('update', handler);
    return () => cameraPoseEvent.removeEventListener('update', handler);
  }, []);

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
        label="描画距離"
        value={far}
        min={100}
        max={farMax}
        step={100}
        onChange={(v) => set({ far: v })}
      />
      <Accordion label="ライティング" defaultOpen={true}>
        <SliderControl
          label="ライト強度"
          value={lightIntensity}
          min={0}
          max={2}
          step={0.1}
          onChange={(v) => set({ lightIntensity: v })}
        />
        <SliderControl
          label="環境光強度"
          value={ambientIntensity}
          min={0}
          max={1}
          step={0.1}
          onChange={(v) => set({ ambientIntensity: v })}
        />
      </Accordion>
      <Accordion label="カメラ姿勢" defaultOpen={false}>
        <div className="camera-pose-info">
          <div className="pose-row">
            <span className="pose-label">位置</span>
            <span className="pose-value">
              ({fmt(pose.position.x)}, {fmt(pose.position.y)}, {fmt(pose.position.z)})
            </span>
          </div>
          <div className="pose-row">
            <span className="pose-label">注視点</span>
            <span className="pose-value">
              ({fmt(pose.target.x)}, {fmt(pose.target.y)}, {fmt(pose.target.z)})
            </span>
          </div>
        </div>
      </Accordion>
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
