import React from 'react';

interface LoadingStateProps {
  message?: string;
}

export const LoadingState: React.FC<LoadingStateProps> = ({ message }) => {
  return (
    <div className="loading" style={{ display: 'flex', flexDirection: 'column' }}>
      <div>{message ?? 'Loading voxel data...'}</div>
      <div
        style={{
          fontSize: '12px',
          marginTop: '10px',
          color: 'var(--vscode-descriptionForeground)',
        }}
      >
        Please wait while the viewer updates
      </div>
    </div>
  );
};
