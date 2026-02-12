import React, { useCallback, useState } from 'react';
import { useExtensionMessage } from './hooks/useExtensionMessage';
import { ErrorDisplay } from './components/ErrorDisplay';
import { LoadingState } from './components/LoadingState';
import { HeaderInfo } from './components/HeaderInfo';
import { VoxelRenderer } from './VoxelRenderer';

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
  } = useExtensionMessage();
  const [isDragOver, setIsDragOver] = useState(false);

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
      {voxelData && <VoxelRenderer voxelData={voxelData} settings={settings} />}
      {voxelData && <HeaderInfo voxelData={voxelData} onOpenAsText={openAsText} />}
    </div>
  );
};
