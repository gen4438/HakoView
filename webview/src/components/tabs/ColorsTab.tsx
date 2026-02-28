/**
 * ColorsTab — ボクセルカラー管理タブ（T040, T041）
 * 16個のカラーコントロール + 可視性チェックボックス
 * アクションボタン: コピー、設定に保存、設定を開く（FR-019）
 * Zustand ストアと双方向バインディング（FR-015）
 */
import React from 'react';
import { useControlStore } from '../../store/controlStore';
import { ColorControl } from '../controls/ColorControl';
import { ButtonControl } from '../controls/ButtonControl';

export interface ColorsTabProps {
  /** 色設定をクリップボードにコピー */
  onCopyColors?: () => void;
  /** 色設定をVSCode設定に保存 */
  onSaveColorSettings?: (colormap: Record<string, string>) => void;
  /** VSCode設定パネルを開く */
  onOpenSettings?: () => void;
}

export const ColorsTab: React.FC<ColorsTabProps> = ({
  onCopyColors,
  onSaveColorSettings,
  onOpenSettings,
}) => {
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
    onSaveColorSettings(colormap);
  };

  return (
    <div className="tab-content">
      {/* アクションボタン */}
      <div className="colors-actions">
        <ButtonControl label="カラーをコピー" onClick={handleCopyColors} />
        <ButtonControl label="設定に保存" onClick={handleSave} />
        <ButtonControl label="設定を開く" onClick={() => onOpenSettings?.()} />
      </div>

      {/* 16個のカラーコントロール（0〜15） */}
      {Array.from({ length: 16 }, (_, i) => (
        <ColorControl
          key={i}
          label={`カラー ${i}`}
          value={customColors[i] ?? '#000000'}
          onChange={(color) => updateColor(i, color)}
          showVisibility={true}
          visible={valueVisibility[i] ?? i !== 0}
          onVisibilityChange={(visible) => updateVisibility(i, visible)}
        />
      ))}
    </div>
  );
};
