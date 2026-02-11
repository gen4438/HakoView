import * as vscode from 'vscode';
import { VoxelDataset } from '../voxelParser/VoxelData';

/**
 * Extension→Webviewメッセージ型
 */
export type ExtensionToWebviewMessage =
	| { type: 'loadVoxelData'; data: VoxelDataMessage }
	| { type: 'updateVoxelData'; data: VoxelDataMessage }
	| { type: 'clearViewer' }
	| { type: 'restoreState'; state: ViewerState }
	| { type: 'showError'; message: string };

/**
 * Webview→Extensionメッセージ型
 */
export type WebviewToExtensionMessage =
	| { command: 'ready' }
	| { command: 'loadFile'; fileName: string; data: number[] }
	| { command: 'saveState'; state: ViewerState }
	| { command: 'showError'; message: string }
	| { command: 'openAsText' };

/**
 * ボクセルデータメッセージ（postMessage用にUint8Array→Array変換）
 */
export interface VoxelDataMessage {
	dimensions: { x: number; y: number; z: number };
	voxelLength: number;
	values: number[];
	fileName: string;
	filePath?: string;
}

/**
 * ビューアーの永続化状態
 */
export interface ViewerState {
	cameraPosition: { x: number; y: number; z: number };
	cameraTarget: { x: number; y: number; z: number };
	cameraZoom: number;
	wireframe: boolean;
	showZeroValues: boolean;
	clippingEnabled: boolean;
	clippingPlane?: {
		normal: [number, number, number];
		distance: number;
	};
}

/**
 * VoxelDatasetをpostMessage用に変換
 */
export function convertToMessage(dataset: VoxelDataset): VoxelDataMessage {
	return {
		dimensions: dataset.dimensions,
		voxelLength: dataset.voxelLength,
		values: Array.from(dataset.values),
		fileName: dataset.fileName,
		filePath: dataset.filePath
	};
}

/**
 * postMessageデータをVoxelDatasetに変換
 */
export function convertFromMessage(message: VoxelDataMessage): VoxelDataset {
	return {
		dimensions: message.dimensions,
		voxelLength: message.voxelLength,
		values: new Uint8Array(message.values),
		fileName: message.fileName,
		filePath: message.filePath
	};
}

/**
 * Webviewにメッセージを送信する汎用ヘルパー
 */
export function postMessageToWebview(
	webview: vscode.Webview,
	message: ExtensionToWebviewMessage
): void {
	webview.postMessage(message);
}

/**
 * ボクセルデータをWebviewに送信
 */
export function sendVoxelData(
	webview: vscode.Webview,
	dataset: VoxelDataset,
	isUpdate: boolean = false
): void {
	const message = convertToMessage(dataset);
	postMessageToWebview(webview, {
		type: isUpdate ? 'updateVoxelData' : 'loadVoxelData',
		data: message
	});
}

/**
 * エラーをWebviewに送信
 */
export function sendError(webview: vscode.Webview, message: string): void {
	postMessageToWebview(webview, {
		type: 'showError',
		message
	});
}

/**
 * ビューアーをクリア
 */
export function clearViewer(webview: vscode.Webview): void {
	postMessageToWebview(webview, { type: 'clearViewer' });
}

/**
 * 状態を復元
 */
export function restoreState(webview: vscode.Webview, state: ViewerState): void {
	postMessageToWebview(webview, {
		type: 'restoreState',
		state
	});
}
