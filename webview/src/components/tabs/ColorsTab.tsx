/**
 * ColorsTab — ボクセルカラー管理タブ（T040, T041）
 * 16個のカラーコントロール + 可視性チェックボックス
 * アクションボタン: コピー、設定に保存、設定を開く（FR-019）
 * Zustand ストアと双方向バインディング（FR-015）
 */
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import type { ColorProfile } from '../../store/controlTypes';
import { ColorControl } from '../controls/ColorControl';
import { ButtonControl } from '../controls/ButtonControl';
import { SelectControl } from '../controls/SelectControl';

export interface ColorsTabProps {
  /** 色設定をクリップボードにコピー */
  onCopyColors?: () => void;
  /** 色設定をVSCode設定に保存 */
  onSaveColorSettings?: (colormap: Record<string, string>, colorProfile: string) => void;
  /** VSCode設定パネルを開く */
  onOpenSettings?: () => void;
}

export const ColorsTab: React.FC<ColorsTabProps> = ({
  onCopyColors,
  onSaveColorSettings,
  onOpenSettings,
}) => {
  const colorProfile = useControlStore((s) => s.colorProfile);
  const setColorProfile = useControlStore((s) => s.setColorProfile);
  const customColors = useControlStore((s) => s.customColors);
  const valueVisibility = useControlStore((s) => s.valueVisibility);
  const updateColor = useControlStore((s) => s.updateColor);
  const updateVisibility = useControlStore((s) => s.updateVisibility);

  const handleCopyColors = () => {
    if (onCopyColors) {
      onCopyColors();
      return;
    }
    // フォールバック: クリップボードに直接コピー
    const colormap: Record<string, string> = {};
    customColors.forEach((color, index) => {
      colormap[index.toString()] = color;
    });
    navigator.clipboard
      .writeText(JSON.stringify(colormap, null, 2))
      .catch((err) => console.error('クリップボードへのコピーに失敗:', err));
  };

  const handleSave = () => {
    if (!onSaveColorSettings) return;
    const colormap: Record<string, string> = {};
    customColors.forEach((color, index) => {
      colormap[index.toString()] = color;
    });
    // HakoView上の「設定に保存」ボタンは、「カラーマップをcustomプロファイルとして保存」
    onSaveColorSettings(colormap, 'custom');
  };

  return (
    <div className="tab-content">
      {/* プロファイル選択 */}
      <SelectControl
        label="カラープロファイル"
        value={colorProfile}
        options={[
          { label: 'Hako', value: 'hako' },
          { label: 'SEM', value: 'sem' },
          { label: 'Grayscale', value: 'grayscale' },
          { label: 'Rainbow', value: 'rainbow' },
          { label: 'Tab10 (Categorical)', value: 'tab10' },
          { label: 'Set1 (Categorical)', value: 'set1' },
          { label: 'Set2 (Categorical)', value: 'set2' },
          { label: 'Set3 (Categorical)', value: 'set3' },
          { label: 'Custom', value: 'custom' },
        ]}
        onChange={(val) => setColorProfile(val as ColorProfile)}
      />

      {/* アクションボタン */}
      <div className="colors-actions">
        <ButtonControl label="カラーをコピー" onClick={handleCopyColors} />
        <ButtonControl label="Custom カラーマップとして保存" onClick={handleSave} />
        <ButtonControl label="設定を開く" onClick={() => onOpenSettings?.()} />
      </div>

      {/* 16個のカラーコントロール（0〜15）- グリッド配置 */}
      <div className="color-grid">
        {Array.from({ length: 16 }, (_, i) => (
          <ColorControl
            key={i}
            label={`${i}`}
            value={customColors[i] ?? '#000000'}
            onChange={(color) => {
              const wasCustom = useControlStore.getState().colorProfile === 'custom';
              updateColor(i, color);

              if (wasCustom && onSaveColorSettings) {
                const colormap: Record<string, string> = {};
                useControlStore.getState().customColors.forEach((c, idx) => {
                  colormap[idx.toString()] = c;
                });
                onSaveColorSettings(colormap, 'custom');
              }
            }}
            showVisibility={true}
            visible={valueVisibility[i] ?? i !== 0}
            onVisibilityChange={(visible) => updateVisibility(i, visible)}
          />
        ))}
      </div>
      {/* カラータブのリセット */}
      <div
        style={{
          marginTop: '12px',
          borderTop: '1px solid var(--vscode-widget-border, #454545)',
          paddingTop: '12px',
        }}
      >
        <ButtonControl
          label="カラーをリセット"
          onClick={() => useControlStore.getState().resetColors()}
        />
      </div>
    </div>
  );
};
