import React, { useEffect } from 'react';
import { useExtensionMessage } from './hooks/useExtensionMessage';
import { ErrorDisplay } from './components/ErrorDisplay';
import { VoxelRenderer } from './VoxelRenderer';

export const VoxelViewer: React.FC = () => {
	const { voxelData, error, isLoading } = useExtensionMessage();

	if (isLoading) {
		return <div className="loading">Loading voxel data...</div>;
	}

	if (error) {
		return <ErrorDisplay message={error} />;
	}

	if (!voxelData) {
		return (
			<div className="loading">
				<div>No voxel data loaded.</div>
				<div style={{ fontSize: '12px', marginTop: '10px', color: 'var(--vscode-descriptionForeground)' }}>
					Open a .leS file to view voxels
				</div>
			</div>
		);
	}

	return <VoxelRenderer voxelData={voxelData} />;
};
