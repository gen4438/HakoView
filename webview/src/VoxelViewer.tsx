import React, { useCallback, useState } from 'react';
import { useExtensionMessage } from './hooks/useExtensionMessage';
import { ErrorDisplay } from './components/ErrorDisplay';
import { LoadingState } from './components/LoadingState';
import { VoxelRenderer } from './VoxelRenderer';

export const VoxelViewer: React.FC = () => {
  const { voxelData, error, isLoading, loadFile, reportError } = useExtensionMessage();
  const [isDragOver, setIsDragOver] = useState(false);

  const handleDragOver = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleDrop = useCallback(
    async (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault();
      setIsDragOver(false);

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
    [loadFile, reportError]
  );

  if (isLoading) {
    return <LoadingState />;
  }

  if (error) {
    return <ErrorDisplay message={error} />;
  }

  if (!voxelData) {
    return (
      <div
        className="loading"
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        style={{
          display: 'flex',
          flexDirection: 'column',
          border: isDragOver ? '2px dashed var(--vscode-focusBorder)' : '2px dashed transparent',
          padding: '24px',
          borderRadius: '12px',
        }}
      >
        <div>{isDragOver ? 'Drop .leS file to load' : 'No voxel data loaded.'}</div>
        <div
          style={{
            fontSize: '12px',
            marginTop: '10px',
            color: 'var(--vscode-descriptionForeground)',
          }}
        >
          Drag and drop a .leS file here or open one from the file tree
        </div>
      </div>
    );
  }

  return <VoxelRenderer voxelData={voxelData} />;
};
