import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faGear, faFileLines, faFloppyDisk } from '@fortawesome/free-solid-svg-icons';
import type { VoxelDataMessage } from '../types/voxel';

interface HeaderInfoProps {
  voxelData: VoxelDataMessage;
  onOpenAsText: () => void;
  onSaveImage: () => void;
  onOpenSettings: () => void;
}

/**
 * メートル単位の値を適切な単位に変換
 */
function formatLength(meters: number): string {
  const absValue = Math.abs(meters);

  if (absValue >= 1) {
    return `${meters.toFixed(3)} m`;
  } else if (absValue >= 1e-3) {
    return `${(meters * 1e3).toFixed(3)} mm`;
  } else if (absValue >= 1e-6) {
    return `${(meters * 1e6).toFixed(3)} μm`;
  } else {
    return `${(meters * 1e9).toFixed(3)} nm`;
  }
}

export const HeaderInfo: React.FC<HeaderInfoProps> = ({
  voxelData,
  onOpenAsText,
  onSaveImage,
  onOpenSettings,
}) => {
  const { dimensions, voxelLength, fileName } = voxelData;

  return (
    <div
      style={{
        position: 'absolute',
        left: '12px',
        bottom: '12px',
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        pointerEvents: 'none',
      }}
    >
      {/* ヘッダー情報表示 */}
      <div
        style={{
          background: 'rgba(0, 0, 0, 0.7)',
          backdropFilter: 'blur(8px)',
          padding: '12px 16px',
          borderRadius: '8px',
          fontSize: '13px',
          fontFamily: 'var(--vscode-font-family)',
          color: 'var(--vscode-editor-foreground)',
          lineHeight: '1.6',
          border: '1px solid rgba(255, 255, 255, 0.1)',
          pointerEvents: 'auto',
        }}
      >
        <div style={{ marginBottom: '4px', opacity: 0.7, fontSize: '11px' }}>{fileName}</div>
        <div style={{ fontFamily: 'var(--vscode-editor-font-family)' }}>
          <div>
            サイズ:{' '}
            <strong>
              {dimensions.x} × {dimensions.y} × {dimensions.z}
            </strong>
          </div>
          <div>
            解像度: <strong>{formatLength(voxelLength)}</strong>
          </div>
        </div>
      </div>

      {/* テキストエディタを開くボタン */}
      <button
        onClick={onOpenAsText}
        style={{
          background: 'var(--vscode-button-background)',
          color: 'var(--vscode-button-foreground)',
          border: 'none',
          borderRadius: '6px',
          padding: '8px 16px',
          fontSize: '13px',
          fontFamily: 'var(--vscode-font-family)',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          transition: 'background 0.2s',
          pointerEvents: 'auto',
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)';
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = 'var(--vscode-button-background)';
        }}
      >
        <FontAwesomeIcon icon={faFileLines} />
        <span>テキストエディタで開く</span>
      </button>

      {/* 画像保存ボタン（2つに分割） */}
      <div
        style={{
          display: 'flex',
          gap: '4px',
          pointerEvents: 'auto',
        }}
      >
        {/* 左：保存ボタン */}
        <button
          onClick={onSaveImage}
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 16px',
            fontSize: '13px',
            fontFamily: 'var(--vscode-font-family)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'background 0.2s',
            flex: 1,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--vscode-button-background)';
          }}
        >
          <FontAwesomeIcon icon={faFloppyDisk} />
          <span>画像を保存</span>
        </button>

        {/* 右：設定ボタン（歯車アイコン） */}
        <button
          onClick={onOpenSettings}
          style={{
            background: 'var(--vscode-button-background)',
            color: 'var(--vscode-button-foreground)',
            border: 'none',
            borderRadius: '6px',
            padding: '8px 12px',
            fontSize: '13px',
            fontFamily: 'var(--vscode-font-family)',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'background 0.2s',
            minWidth: '36px',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'var(--vscode-button-background)';
          }}
          title="画像サイズ設定"
        >
          <FontAwesomeIcon icon={faGear} />
        </button>
      </div>
    </div>
  );
};
