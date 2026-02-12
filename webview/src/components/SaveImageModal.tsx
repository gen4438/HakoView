import React, { useState, useEffect } from 'react';

export interface ImageSize {
  width: number;
  height: number;
  label: string;
}

interface SaveImageModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (size: ImageSize) => void;
  currentViewSize: { width: number; height: number };
}

const PRESET_SIZES: ImageSize[] = [
  { width: 1920, height: 1080, label: 'Full HD (1920×1080)' },
  { width: 2560, height: 1440, label: '2K (2560×1440)' },
  { width: 3840, height: 2160, label: '4K (3840×2160)' },
  { width: 7680, height: 4320, label: '8K (7680×4320)' },
];

export const SaveImageModal: React.FC<SaveImageModalProps> = ({
  isOpen,
  onClose,
  onSave,
  currentViewSize,
}) => {
  const [selectedPreset, setSelectedPreset] = useState<string>('current');
  const [customWidth, setCustomWidth] = useState<string>('1920');
  const [customHeight, setCustomHeight] = useState<string>('1080');

  // モーダルが開いたときにカスタムサイズをリセット
  useEffect(() => {
    if (isOpen) {
      setSelectedPreset('current');
      setCustomWidth('1920');
      setCustomHeight('1080');
    }
  }, [isOpen]);

  const handleSave = () => {
    let size: ImageSize;

    if (selectedPreset === 'current') {
      size = {
        width: currentViewSize.width,
        height: currentViewSize.height,
        label: '現在のビューサイズ',
      };
    } else if (selectedPreset === 'custom') {
      const width = parseInt(customWidth, 10);
      const height = parseInt(customHeight, 10);

      if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        alert('有効な画像サイズを入力してください');
        return;
      }

      if (width > 16384 || height > 16384) {
        alert('画像サイズは16384px以下にしてください');
        return;
      }

      size = {
        width,
        height,
        label: `カスタム (${width}×${height})`,
      };
    } else {
      const preset = PRESET_SIZES.find((p) => p.label === selectedPreset);
      if (!preset) return;
      size = preset;
    }

    onSave(size);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSave();
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--vscode-editor-background)',
          border: '1px solid var(--vscode-panel-border)',
          borderRadius: '8px',
          padding: '24px',
          minWidth: '400px',
          maxWidth: '500px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <h2
          style={{
            margin: '0 0 20px 0',
            fontSize: '16px',
            fontWeight: 'bold',
            color: 'var(--vscode-editor-foreground)',
          }}
        >
          画像サイズ設定
        </h2>

        <div style={{ marginBottom: '20px' }}>
          {/* 現在のビューサイズ */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              marginBottom: '8px',
              cursor: 'pointer',
              borderRadius: '4px',
              background:
                selectedPreset === 'current'
                  ? 'var(--vscode-list-activeSelectionBackground)'
                  : 'transparent',
              color:
                selectedPreset === 'current'
                  ? 'var(--vscode-list-activeSelectionForeground)'
                  : 'var(--vscode-editor-foreground)',
            }}
          >
            <input
              type="radio"
              name="imageSize"
              value="current"
              checked={selectedPreset === 'current'}
              onChange={(e) => setSelectedPreset(e.target.value)}
              style={{ marginRight: '10px' }}
            />
            <span>
              現在のビューサイズ ({currentViewSize.width}×{currentViewSize.height})
            </span>
          </label>

          {/* プリセットサイズ */}
          {PRESET_SIZES.map((preset) => (
            <label
              key={preset.label}
              style={{
                display: 'flex',
                alignItems: 'center',
                padding: '10px',
                marginBottom: '8px',
                cursor: 'pointer',
                borderRadius: '4px',
                background:
                  selectedPreset === preset.label
                    ? 'var(--vscode-list-activeSelectionBackground)'
                    : 'transparent',
                color:
                  selectedPreset === preset.label
                    ? 'var(--vscode-list-activeSelectionForeground)'
                    : 'var(--vscode-editor-foreground)',
              }}
            >
              <input
                type="radio"
                name="imageSize"
                value={preset.label}
                checked={selectedPreset === preset.label}
                onChange={(e) => setSelectedPreset(e.target.value)}
                style={{ marginRight: '10px' }}
              />
              <span>{preset.label}</span>
            </label>
          ))}

          {/* カスタムサイズ */}
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              padding: '10px',
              cursor: 'pointer',
              borderRadius: '4px',
              background:
                selectedPreset === 'custom'
                  ? 'var(--vscode-list-activeSelectionBackground)'
                  : 'transparent',
              color:
                selectedPreset === 'custom'
                  ? 'var(--vscode-list-activeSelectionForeground)'
                  : 'var(--vscode-editor-foreground)',
            }}
          >
            <input
              type="radio"
              name="imageSize"
              value="custom"
              checked={selectedPreset === 'custom'}
              onChange={(e) => setSelectedPreset(e.target.value)}
              style={{ marginRight: '10px' }}
            />
            <span>カスタム</span>
          </label>

          {selectedPreset === 'custom' && (
            <div
              style={{
                display: 'flex',
                gap: '12px',
                marginTop: '12px',
                paddingLeft: '30px',
              }}
            >
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '12px',
                    color: 'var(--vscode-descriptionForeground)',
                  }}
                >
                  幅 (px)
                </label>
                <input
                  type="number"
                  value={customWidth}
                  onChange={(e) => setCustomWidth(e.target.value)}
                  min="1"
                  max="16384"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label
                  style={{
                    display: 'block',
                    marginBottom: '4px',
                    fontSize: '12px',
                    color: 'var(--vscode-descriptionForeground)',
                  }}
                >
                  高さ (px)
                </label>
                <input
                  type="number"
                  value={customHeight}
                  onChange={(e) => setCustomHeight(e.target.value)}
                  min="1"
                  max="16384"
                  style={{
                    width: '100%',
                    padding: '6px 8px',
                    background: 'var(--vscode-input-background)',
                    color: 'var(--vscode-input-foreground)',
                    border: '1px solid var(--vscode-input-border)',
                    borderRadius: '4px',
                    fontSize: '13px',
                  }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ボタン */}
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end' }}>
          <button
            onClick={onClose}
            style={{
              padding: '8px 16px',
              background: 'var(--vscode-button-secondaryBackground)',
              color: 'var(--vscode-button-secondaryForeground)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'var(--vscode-font-family)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--vscode-button-secondaryHoverBackground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--vscode-button-secondaryBackground)';
            }}
          >
            キャンセル
          </button>
          <button
            onClick={handleSave}
            style={{
              padding: '8px 16px',
              background: 'var(--vscode-button-background)',
              color: 'var(--vscode-button-foreground)',
              border: 'none',
              borderRadius: '4px',
              fontSize: '13px',
              cursor: 'pointer',
              fontFamily: 'var(--vscode-font-family)',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'var(--vscode-button-hoverBackground)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'var(--vscode-button-background)';
            }}
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
