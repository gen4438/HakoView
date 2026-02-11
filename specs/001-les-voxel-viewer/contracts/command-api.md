# コマンドAPIコントラクト

**Feature**: 001-les-voxel-viewer  
**Date**: 2026-02-12  
**Version**: 1.0

このドキュメントは、VS Code拡張機能が提供するコマンドのAPIを定義します。

---

## コマンド一覧

| Command ID | Title | Category | When Visible |
|------------|-------|----------|--------------|
| `hakoview.openVoxelViewer` | Open Voxel Viewer | Hakoview | Always |
| `hakoview.openFromEditor` | Open in Voxel Viewer | Hakoview | editorLangId == plaintext && resourceExtname == .leS |
| `hakoview.openAsText` | Reopen as Text | Hakoview | activeCustomEditorId == hakoview.lesViewer |

---

## 1. `hakoview.openVoxelViewer`

空のボクセルビューアーを開く。ユーザーはファイルをドラッグ&ドロップして表示できる。

### Metadata

```json
{
  "command": "hakoview.openVoxelViewer",
  "title": "Open Voxel Viewer",
  "category": "Hakoview"
}
```

### Usage

**コマンドパレット**:
```
> Hakoview: Open Voxel Viewer
```

**プログラマティック**:
```typescript
await vscode.commands.executeCommand('hakoview.openVoxelViewer');
```

### Parameters

なし

### Behavior

1. 新しいWebviewPanelを作成
2. 空の状態（"Drop .leS file here"メッセージ）を表示
3. ドラッグ&ドロップ待機状態

### Return Value

`void`

### Example

```typescript
// Extension内で実行
vscode.commands.registerCommand('hakoview.openVoxelViewer', () => {
  const panel = vscode.window.createWebviewPanel(
    'hakoview.viewer',
    'New Voxel Scene',
    vscode.ViewColumn.Active,
    getWebviewOptions()
  );
  
  panel.webview.html = getWebviewContent(panel.webview, null);
  setupMessageHandling(panel);
});
```

### User Story Mapping

→ **User Story 3**: コマンドパレットとドラッグ・アンド・ドロップで開く (Priority: P3)

---

## 2. `hakoview.openFromEditor`

テキストエディタで開いている.leSファイルをボクセルビューアーで開く。

### Metadata

```json
{
  "command": "hakoview.openFromEditor",
  "title": "Open in Voxel Viewer",
  "category": "Hakoview"
}
```

### Usage

**コマンドパレット**（.leSファイルを開いている時のみ表示）:
```
> Hakoview: Open in Voxel Viewer
```

**エディタコンテキストメニュー** (package.json):
```json
{
  "menus": {
    "editor/title": [
      {
        "command": "hakoview.openFromEditor",
        "when": "resourceExtname == .leS",
        "group": "navigation"
      }
    ]
  }
}
```

### Parameters

```typescript
(uri?: vscode.Uri) => Promise<void>
```

- `uri`: 開くファイルのURI。省略時は`vscode.window.activeTextEditor.document.uri`

### Behavior

1. 指定されたファイルをCustomEditorで開く
2. 既にテキストエディタで開いている場合、ビューアーに切り替える

### Implementation

```typescript
vscode.commands.registerCommand('hakoview.openFromEditor', async (uri?: vscode.Uri) => {
  const targetUri = uri ?? vscode.window.activeTextEditor?.document.uri;
  
  if (!targetUri) {
    vscode.window.showErrorMessage('No .leS file is open.');
    return;
  }
  
  await vscode.commands.executeCommand('vscode.openWith', targetUri, 'hakoview.lesViewer');
});
```

### Return Value

`Promise<void>`

### User Story Mapping

→ **User Story 2**: エディタからビューアーを開く (Priority: P2)

---

## 3. `hakoview.openAsText`

CustomEditorで開いている.leSファイルをテキストエディタで開き直す。

### Metadata

```json
{
  "command": "hakoview.openAsText",
  "title": "Reopen as Text",
  "category": "Hakoview"
}
```

### Usage

**コマンドパレット**（CustomEditorで.leSを開いている時のみ）:
```
> Hakoview: Reopen as Text
```

**Webview内ボタン**（オプション）:
```html
<button onclick="openAsText()">Open as Text</button>
```

### Parameters

```typescript
(uri?: vscode.Uri) => Promise<void>
```

- `uri`: 開くファイルのURI。省略時は現在のCustomEditorのURI

### Behavior

1. VS Codeのデフォルトテキストエディタで開く
2. CustomEditorは閉じる（または並べて表示）

### Implementation

```typescript
vscode.commands.registerCommand('hakoview.openAsText', async (uri?: vscode.Uri) => {
  const targetUri = uri ?? vscode.window.activeCustomEditorId === 'hakoview.lesViewer' 
    ? getCurrentCustomEditorUri() 
    : undefined;
  
  if (!targetUri) {
    vscode.window.showErrorMessage('No .leS file is open in viewer.');
    return;
  }
  
  await vscode.commands.executeCommand('vscode.openWith', targetUri, 'default');
});
```

### Return Value

`Promise<void>`

### User Story Mapping

→ **FR-010**: ユーザーが必要に応じてテキストで開ける導線（再度開く）を提供すること

---

## 4. Internal Commands (ユーザー非公開)

### 4.1 `_hakoview.loadBenchmark`

ベンチマーク用の標準データセットをロードする（テスト・開発用）。

```typescript
vscode.commands.executeCommand('_hakoview.loadBenchmark', 'benchmark_200x200x200_dense.leS');
```

### 4.2 `_hakoview.showMetrics`

パフォーマンス計測結果を開発者パネルに表示する。

```typescript
vscode.commands.executeCommand('_hakoview.showMetrics');
```

---

## コマンド実行フロー

### Case 1: ファイルツリーから.leSを開く

```
User: ファイルツリーで .leS をクリック
  ↓
VS Code: CustomEditorProviderを自動選択（priority: "default"）
  ↓
Extension: openCustomDocument() 呼び出し
  ↓
Extension: resolveCustomEditor() でWebview構築
  ↓
Webview: loadVoxelData受信 → 描画
```

### Case 2: コマンドパレットから空のビューアーを開く

```
User: > Hakoview: Open Voxel Viewer
  ↓
Extension: hakoview.openVoxelViewer 実行
  ↓
Extension: WebviewPanel作成
  ↓
Webview: clearViewer受信 → D&D待機状態
  ↓
User: ファイルをドラッグ&ドロップ
  ↓
Webview: loadFile送信
  ↓
Extension: パース → updateVoxelData送信
  ↓
Webview: 描画
```

### Case 3: テキストエディタからビューアーに切り替え

```
User: .leS をテキストエディタで開いている
  ↓
User: > Hakoview: Open in Voxel Viewer
  ↓
Extension: hakoview.openFromEditor 実行
  ↓
Extension: vscode.openWith(uri, 'hakoview.lesViewer')
  ↓
VS Code: CustomEditorProviderで開く
  ↓
Webview: loadVoxelData受信 → 描画
```

---

## キーバインディング（オプション）

ユーザーが設定可能なキーボードショートカット：

```json
{
  "key": "ctrl+alt+v",
  "command": "hakoview.openVoxelViewer",
  "when": "!editorTextFocus"
},
{
  "key": "ctrl+alt+t",
  "command": "hakoview.openAsText",
  "when": "activeCustomEditorId == hakoview.lesViewer"
}
```

---

## エラーハンドリング

すべてのコマンドは以下のエラーを適切に処理：

| Error | Handling |
|-------|----------|
| ファイルが見つからない | `vscode.window.showErrorMessage('File not found')` |
| パース失敗 | 詳細なエラーメッセージを表示 |
| WebGL2未サポート | `'WebGL2 is required. Please use a compatible browser.'` |
| GPU OOM | `'GPU out of memory. Try reducing voxel size.'` |

---

## テストシナリオ

### Test 1: hakoview.openVoxelViewer
```typescript
test('should open empty viewer', async () => {
  await vscode.commands.executeCommand('hakoview.openVoxelViewer');
  assert(vscode.window.activeTextEditor === undefined);
  // Webview Panel が開いていることを確認
});
```

### Test 2: hakoview.openFromEditor
```typescript
test('should open .leS in viewer from text editor', async () => {
  const doc = await vscode.workspace.openTextDocument('test.leS');
  await vscode.window.showTextDocument(doc);
  await vscode.commands.executeCommand('hakoview.openFromEditor');
  // CustomEditor が開いていることを確認
});
```

### Test 3: hakoview.openAsText
```typescript
test('should reopen viewer as text', async () => {
  // CustomEditorで開く
  await vscode.commands.executeCommand('vscode.openWith', uri, 'hakoview.lesViewer');
  // テキストエディタに切り替え
  await vscode.commands.executeCommand('hakoview.openAsText');
  assert(vscode.window.activeTextEditor?.document.uri.toString() === uri.toString());
});
```

---

## まとめ

- **公開コマンド**: 3つ（空のビューアー、エディタから開く、テキストで開く）
- **内部コマンド**: 2つ（ベンチマーク、メトリクス表示）
- **統合ポイント**: コマンドパレット、エディタコンテキストメニュー、ファイルアソシエーション
- **エラーハンドリング**: 4種類の主要エラーシナリオ
- **テスト**: 3つの主要シナリオ

すべてのコマンドは、spec.mdのUser Storiesと要件に対応しています。
