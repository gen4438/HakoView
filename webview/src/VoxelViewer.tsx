import React, { useCallback, useState, useRef, useEffect } from 'react';
import { useExtensionMessage } from './hooks/useExtensionMessage';
import { ErrorDisplay } from './components/ErrorDisplay';
import { LoadingState } from './components/LoadingState';
import { HeaderInfo } from './components/HeaderInfo';
import { SaveImageModal, ImageSize, PRESET_SIZES } from './components/SaveImageModal';
import { VoxelRenderer, VoxelRendererRef } from './VoxelRenderer';
import { useWindowSize } from 'react-use';

export const VoxelViewer: React.FC = () => {
  const {
    voxelData,
    settings,
    error,
    isLoading,
    loadFile,
    loadFileFromPath,
    openAsText,
    reportError,
    saveImage,
  } = useExtensionMessage();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const rendererRef = useRef<VoxelRendererRef>(null);
  const { width: viewWidth, height: viewHeight } = useWindowSize();

  // 画像サイズ設定を記憶（セッション内で保持）
  const [savedPreset, setSavedPreset] = useState<string>('current');
  const [savedCustomWidth, setSavedCustomWidth] = useState<string>('1920');
  const [savedCustomHeight, setSavedCustomHeight] = useState<string>('1080');

  // 画像保存ハンドラ（サイズ指定付き）- VSCode APIを使用
  const handleSaveImageWithSize = useCallback(
    async (size: ImageSize, preset: string, customWidth: string, customHeight: string) => {
      try {
        if (!rendererRef.current) {
          reportError('レンダラーが初期化されていません');
          return;
        }

        // 設定を記憶
        setSavedPreset(preset);
        setSavedCustomWidth(customWidth);
        setSavedCustomHeight(customHeight);

        // 画像をキャプチャ
        // 「現在のビューサイズ」の場合はサイズ指定なし（画面レンダラーをそのままキャプチャ、ギズモ含む）
        // それ以外はサイズ指定（オフスクリーンレンダラー、ギズモなし）
        const dataURL =
          preset === 'current'
            ? await rendererRef.current.captureImage()
            : await rendererRef.current.captureImage(size.width, size.height);

        // デフォルトのファイル名を生成
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, -5);
        const defaultFileName = voxelData?.fileName
          ? `${voxelData.fileName.replace(/\.les(\.gz)?$/i, '')}_${size.width}x${size.height}_${timestamp}.png`
          : `voxel_${size.width}x${size.height}_${timestamp}.png`;

        // VSCode拡張機能に保存を依頼（元のファイルパスも送信）
        saveImage(dataURL, defaultFileName, voxelData?.filePath);
      } catch (error) {
        console.error('画像の保存に失敗しました:', error);
        reportError(
          `画像の保存に失敗しました: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    },
    [voxelData, reportError, saveImage]
  );

  // 直接保存ハンドラ（前回の設定で保存）
  const handleSaveImage = useCallback(async () => {
    let size: ImageSize;

    if (savedPreset === 'current') {
      size = {
        width: viewWidth,
        height: viewHeight,
        label: '現在のビューサイズ',
      };
    } else if (savedPreset === 'custom') {
      const width = parseInt(savedCustomWidth, 10);
      const height = parseInt(savedCustomHeight, 10);

      if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        reportError('有効な画像サイズを設定してください');
        return;
      }

      size = {
        width,
        height,
        label: `カスタム (${width}×${height})`,
      };
    } else {
      const preset = PRESET_SIZES.find((p) => p.label === savedPreset);
      if (!preset) {
        // プリセットが見つからない場合は現在のビューサイズで保存
        size = {
          width: viewWidth,
          height: viewHeight,
          label: '現在のビューサイズ',
        };
      } else {
        size = preset;
      }
    }

    await handleSaveImageWithSize(size, savedPreset, savedCustomWidth, savedCustomHeight);
  }, [
    viewWidth,
    viewHeight,
    savedPreset,
    savedCustomWidth,
    savedCustomHeight,
    handleSaveImageWithSize,
    reportError,
  ]);

  // Ctrl+Sショートカット
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Ctrl+S (Windows/Linux) または Cmd+S (Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 's') {
        event.preventDefault();
        if (voxelData) {
          handleSaveImage();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [voxelData, handleSaveImage]);

  const handleDragEnter = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(true);
  }, []);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    // VS Codeにドロップを受け入れることを伝える
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy';
    }
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.stopPropagation();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      event.stopPropagation();
      setIsDragOver(false);

      // VS Codeからのファイルパス（URI形式）を取得
      const uriList = event.dataTransfer.getData('text/uri-list');
      if (uriList) {
        const uri = uriList.split('\n')[0].trim();
        if (uri && uri.toLowerCase().endsWith('.les')) {
          loadFileFromPath(uri);
          return;
        }
      }

      // 通常のファイルドロップ（外部から）
      const file = event.dataTransfer.files?.[0];
      if (!file) {
        return;
      }

      if (!file.name.toLowerCase().endsWith('.les')) {
        reportError('Please drop a .leS file.');
        return;
      }

      const buffer = await file.arrayBuffer();
      loadFile(file.name, buffer);
    },
    [loadFile, loadFileFromPath, reportError]
  );

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  // ドラッグオーバー時のオーバーレイ
  const dropOverlay = (isDragOver || isLoading) && (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.7)',
        backdropFilter: 'blur(4px)',
        border: isDragOver ? '3px dashed var(--vscode-focusBorder)' : 'none',
        borderRadius: '12px',
        pointerEvents: isDragOver ? 'none' : 'auto',
      }}
    >
      {isLoading ? (
        <LoadingState />
      ) : (
        <>
          <div
            style={{
              fontSize: '28px',
              fontWeight: 'bold',
              color: 'var(--vscode-editor-foreground)',
            }}
          >
            Drop .leS file here
          </div>
          <div
            style={{
              fontSize: '18px',
              marginTop: '12px',
              padding: '8px 20px',
              background: 'var(--vscode-badge-background)',
              color: 'var(--vscode-badge-foreground)',
              borderRadius: '6px',
              fontWeight: 'bold',
            }}
          >
            Shift + Drag to load in this tab
          </div>
        </>
      )}
    </div>
  );

  if (!voxelData && !isLoading) {
    return (
      <div
        className="loading"
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          padding: '24px',
        }}
      >
        {isDragOver && dropOverlay}
        <div style={{ fontSize: '16px' }}>No voxel data loaded.</div>
        <div
          style={{
            fontSize: '13px',
            marginTop: '12px',
            color: 'var(--vscode-descriptionForeground)',
            textAlign: 'center',
            lineHeight: '1.6',
          }}
        >
          Open a .leS file from the file tree, or
          <br />
          <strong>Shift + Drag</strong> a .leS file here to load
        </div>
      </div>
    );
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
      }}
    >
      {dropOverlay}
      {voxelData && <VoxelRenderer ref={rendererRef} voxelData={voxelData} settings={settings} />}
      {voxelData && (
        <>
          <HeaderInfo
            voxelData={voxelData}
            onOpenAsText={openAsText}
            onSaveImage={handleSaveImage}
            onOpenSettings={() => setIsSettingsOpen(true)}
          />
          <SaveImageModal
            isOpen={isSettingsOpen}
            onClose={() => setIsSettingsOpen(false)}
            onSave={handleSaveImageWithSize}
            currentViewSize={{ width: viewWidth, height: viewHeight }}
            initialPreset={savedPreset}
            initialCustomWidth={savedCustomWidth}
            initialCustomHeight={savedCustomHeight}
          />
        </>
      )}
    </div>
  );
};
