import React from 'react';
import { createRoot } from 'react-dom/client';
import { VoxelViewer } from './VoxelViewer';

console.log('Webview script loaded');

const container = document.getElementById('root');
if (container) {
	console.log('Root container found, mounting React app');
	try {
		const root = createRoot(container);
		root.render(<VoxelViewer />);
		console.log('React app mounted successfully');
	} catch (error) {
		console.error('Error mounting React app:', error);
	}
} else {
	console.error('Root container not found');
}
