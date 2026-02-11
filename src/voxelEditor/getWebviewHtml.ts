import * as vscode from 'vscode';

/**
 * WebviewのHTML生成オプション
 */
export interface WebviewHtmlOptions {
	/** Webviewインスタンス */
	webview: vscode.Webview;
	/** 拡張機能のコンテキスト */
	extensionUri: vscode.Uri;
	/** CSP nonce（生成する場合は省略可） */
	nonce?: string;
}

/**
 * WebviewのHTMLコンテンツを生成
 */
export function getWebviewHtml(options: WebviewHtmlOptions): string {
	const { webview, extensionUri, nonce: customNonce } = options;

	// Webview用スクリプトのURI取得
	const scriptUri = webview.asWebviewUri(
		vscode.Uri.joinPath(extensionUri, 'webview', 'dist', 'webview.js')
	);

	// CSP用のnonce生成（セキュリティ）
	const nonce = customNonce || getNonce();

	// CSP (Content Security Policy) 設定
	// - script-src: スクリプトの読み込み元を制限
	// - style-src: スタイルの読み込み元を制限
	// - img-src: 画像の読み込み元を制限
	const csp = [
		`default-src 'none'`,
		`script-src 'nonce-${nonce}'`,
		`style-src ${webview.cspSource} 'unsafe-inline'`,
		`img-src ${webview.cspSource} https: data:`,
		`connect-src ${webview.cspSource}`,
		`font-src ${webview.cspSource}`,
	].join('; ');

	return `<!DOCTYPE html>
<html lang="ja">
<head>
	<meta charset="UTF-8">
	<meta http-equiv="Content-Security-Policy" content="${csp}">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Voxel Viewer</title>
	<style>
		* {
			margin: 0;
			padding: 0;
			box-sizing: border-box;
		}
		html, body {
			width: 100%;
			height: 100%;
			overflow: hidden;
			font-family: var(--vscode-font-family);
			font-size: var(--vscode-font-size);
			color: var(--vscode-foreground);
			background-color: var(--vscode-editor-background);
		}
		#root {
			width: 100%;
			height: 100%;
		}
		canvas {
			display: block;
			width: 100%;
			height: 100%;
			outline: none;
		}
		.loading {
			display: flex;
			align-items: center;
			justify-content: center;
			height: 100%;
			font-size: 16px;
			color: var(--vscode-descriptionForeground);
		}
		.error {
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100%;
			padding: 20px;
			color: var(--vscode-errorForeground);
		}
		.error-title {
			font-size: 18px;
			font-weight: bold;
			margin-bottom: 10px;
		}
		.error-message {
			font-size: 14px;
			text-align: center;
			max-width: 600px;
		}
	</style>
</head>
<body>
	<div id="root"></div>
	<script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

/**
 * ランダムなnonceを生成（CSP用）
 */
function getNonce(): string {
	let text = '';
	const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
	for (let i = 0; i < 32; i++) {
		text += possible.charAt(Math.floor(Math.random() * possible.length));
	}
	return text;
}
