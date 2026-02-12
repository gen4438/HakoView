# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリで作業する際のガイダンスを提供します。

## プロジェクト概要

**Hakoview** は、`.leS`（leSフォーマット）ファイル用の3Dボクセルビューアーを提供するVSCode拡張機能です。React、Three.js、カスタムWebGLシェーダーを使用してVSCode内でボクセルモデルを直接レンダリングします。本プロジェクトは、効率的なGPUベースレンダリングで大規模ボクセルデータセット（最大1024³）を対象としています。

## 必須コマンド

### ビルドと開発

```bash
# 依存関係のインストール
pnpm install
cd webview && pnpm install

# ウォッチモードで開発ビルド（拡張機能とwebviewの両方を並列ビルド）
pnpm run watch

# 型チェックのみ
pnpm run check-types

# Lint実行
pnpm run lint

# プロダクションビルド
pnpm run build:prod

# テスト実行
pnpm run test
```

### 個別コンポーネントのビルド

```bash
# 拡張機能のみビルド
node esbuild.js

# Webviewのみビルド
node esbuild.webview.js

# 拡張機能をウォッチモード
node esbuild.js --watch

# Webviewをウォッチモード
node esbuild.webview.js --watch
```

### VSCodeでのテスト

- `F5`キーを押して拡張機能開発ホストを起動
- `.leS`ファイルを開いてビューアーをテスト
- `pnpm test`またはVS CodeのTest Explorerでテストを実行

## アーキテクチャ概要

この拡張機能は、カスタムUIを持つVSCode拡張機能に必要な**デュアルアーキテクチャパターン**を使用しています。

### Extension Host（`src/`）

- Node.js環境で実行
- ファイルI/O、パース、VSCode API統合を処理
- `.leS`ファイル用の`CustomEditorProvider`を実装
- **主要コンポーネント:**
  - `VoxelEditorProvider`: CustomEditorProvider実装
  - `VoxelDocument`: ボクセルファイルのドキュメントモデル
  - `LesParser`: .leSファイル形式をVoxelDatasetにパース
  - `validation.ts`: ファイル形式の検証（specのFR-005, FR-008, FR-011）

### Webview（`webview/`）

- ブラウザ環境で実行（拡張機能から分離）
- React + Three.jsで3Dボクセルビジュアライゼーションをレンダリング
- **独立したビルドパイプライン**（esbuild.webview.js）
- **独立した依存関係**（webview/package.json）
- **主要コンポーネント:**
  - `VoxelViewer.tsx`: メインReactコンポーネント
  - `VoxelRenderer.tsx`: カスタムシェーダーを使ったThree.jsレンダリング
  - `shaders/`: ボクセルレイマーチング用のGLSL頂点シェーダーとフラグメントシェーダー
  - `hooks/useExtensionMessage.ts`: 拡張機能 ↔ Webview間の通信

### 通信フロー

```
Extension Host (Node.js)          Webview (Browser)
─────────────────────             ─────────────────
1. .leSファイルを読み込み
2. LesParserでパース
3. フォーマット検証
4. VoxelDataset作成
5. ──[postMessage]──────────────> 6. データセット受信
                                   7. 3Dテクスチャ作成
                                   8. シェーダーでレンダリング
                                   9. ボクセルモデル表示
```

## .leSファイル形式

この形式を理解することは、パーサーとレンダラーの作業において重要です。

### ファイル構造

```
X Y Z [voxel_length]              ← ヘッダー（空白区切り）
data[0,0,0] data[0,0,1] ... data[0,0,Z-1]   ← 行1 (x=0, y=0, Z個の値)
data[0,1,0] data[0,1,1] ... data[0,1,Z-1]   ← 行2 (x=0, y=1, Z個の値)
...
data[X-1,Y-1,0] ... data[X-1,Y-1,Z-1]       ← 行X*Y
```

### 重要な詳細

- **ヘッダー**: `X Y Z`の次元（必須）、`voxel_length`メートル単位（オプション）
- **データレイアウト**: X\*Y行、各行にZ個の値（空白区切りの整数）
- **行のマッピング**: 行インデックス`i` → `(x=i÷Y, y=i%Y)`でZ方向の値
- **値の範囲**: 0-255（uint8）、0=空、1-255は16色に循環マッピング
- **制約**: 1 ≤ X,Y,Z ≤ 1024（validation.tsで強制）
- **転置不要**: ファイル構造はメモリレイアウト`(X, Y, Z)`と直接一致

### 例

```
2 3 4 1.0e-9
1 0 0 0        # x=0, y=0, Z方向の値
0 0 0 0        # x=0, y=1, Z方向の値
0 0 0 0        # x=0, y=2, Z方向の値
0 0 10 0       # x=1, y=0, Z方向の値
0 0 0 0        # x=1, y=1, Z方向の値
0 0 0 20       # x=1, y=2, Z方向の値
```

完全な仕様は`specs/001-les-voxel-viewer/les-format-spec.md`を参照してください。

## 主要な設計判断

### レンダリング戦略

- カスタムGLSLシェーダーを使った**GPUベースのレイマーチング**（メッシュベースではない）
- 効率的なボクセル格納のためGPUにアップロードされる**3Dデータテクスチャ**（R8形式）
- マテリアルから色へのマッピング用の**カラーパレットテクスチャ**（1×16 RGB）
- **パフォーマンス目標**: 200³ボクセルを初回レンダリング5秒以内（NFR-001）

### なぜデュアルビルドパイプラインか？

- 拡張機能コードはNode.js API（`vscode`モジュール）を必要とする
- WebviewはブラウザAPI（DOM、WebGL）を必要とする
- `webview/`内の独立した`package.json`がReact/Three.js依存関係を分離
- 2つのesbuild設定: `esbuild.js`（Node/CJS）と`esbuild.webview.js`（Browser/IIFE）

### シェーダーの読み込み

- シェーダー（`.vert`、`.frag`）はesbuildのローダー設定でテキストとして読み込み
- CSP（Content Security Policy）準拠 - インラインスクリプトなし
- `webview/src/shaders/`に配置

## 開発ワークフロー

### 拡張機能側に機能を追加する場合

1. `src/`にTypeScriptコードを追加
2. 型定義は`@types/vscode`を参照
3. `node esbuild.js`でビルド
4. 拡張機能コードは`vscode.*` APIにアクセス可能

### Webview側に機能を追加する場合

1. `webview/src/`にReact/Three.jsコードを追加
2. 依存関係を`webview/package.json`にインストール（ルートではない！）
3. `node esbuild.webview.js`でビルド
4. Webviewコードは`vscode` APIに直接アクセス**不可** - メッセージングを使用

### 拡張機能とWebview間の通信

`specs/001-les-voxel-viewer/contracts/messaging-protocol.md`で定義

**拡張機能 → Webview:**

```typescript
webviewPanel.webview.postMessage({
  command: 'loadVoxelData',
  data: voxelDataset,
});
```

**Webview → 拡張機能:**

```typescript
const vscode = acquireVsCodeApi();
vscode.postMessage({
  command: 'ready',
});
```

## テスト戦略

### ユニットテスト（`src/test/`）

- **LesParser**: フォーマットパース、検証ルール
- **VoxelData**: インデックスマッピング、座標変換
- テストファイルはMochaフレームワーク（`@vscode/test-electron`）を使用

### 統合テスト

- ファイルツリーからのCustomEditor起動
- コマンドパレットのアクション
- 不正なファイルのエラーハンドリング

### 手動テストケース（spec.mdより）

1. **User Story 1**: ファイルツリーから`.leS`を開く → ビューアーが開く
2. **User Story 2**: `.leS`をテキストとして開き、コマンドでビューアーに切り替え
3. **User Story 3**: コマンドパレット → 空のビューアー → ファイルをドラッグ&ドロップ

## 仕様駆動開発

このプロジェクトは**仕様駆動開発**に従っています。すべての機能は`specs/001-les-voxel-viewer/`内の要件を参照します:

- **spec.md**: 機能要件（FR-001〜FR-016）、ユーザーストーリー
- **plan.md**: 実装計画、プロジェクト構造
- **data-model.md**: TypeScriptインターフェース、データフロー
- **les-format-spec.md**: ファイル形式仕様
- **contracts/**: コマンドとメッセージングのAPIコントラクト

機能を実装する際は、常に:

1. spec.mdからFR-XXX要件コードを参照
2. 受け入れ基準に対して検証
3. `specs/001-les-voxel-viewer/tasks.md`のチェックリストを更新

## よくある落とし穴

### ❌ ルートにwebviewの依存関係をインストールしない

```bash
# 誤り
pnpm add react  # ルートのpackage.jsonにインストールされる

# 正しい
cd webview && pnpm add react
```

### ❌ webviewコードでvscode APIをインポートしない

```typescript
// 誤り - webview/src/VoxelViewer.tsx
import * as vscode from 'vscode'; // 実行時に失敗

// 正しい - メッセージングを使用
const vscode = acquireVsCodeApi();
```

### ❌ 拡張機能とwebviewの両方をビルドし忘れない

```bash
# 誤り - 拡張機能のみビルド
node esbuild.js

# 正しい - 両方ビルド
pnpm run build
# または開発時はウォッチモード
pnpm run watch
```

## 重要なファイルパス

| パス                                     | 用途                                           |
| ---------------------------------------- | ---------------------------------------------- |
| `src/extension.ts`                       | 拡張機能のエントリポイント、アクティベーション |
| `src/voxelEditor/VoxelEditorProvider.ts` | カスタムエディタ実装                           |
| `src/voxelParser/LesParser.ts`           | .leSファイルパーサー                           |
| `webview/src/VoxelViewer.tsx`            | メインReactコンポーネント                      |
| `webview/src/VoxelRenderer.tsx`          | Three.jsレンダリングロジック                   |
| `webview/src/shaders/`                   | ボクセルレンダリング用GLSLシェーダー           |
| `specs/001-les-voxel-viewer/`            | 完全な機能仕様                                 |
| `esbuild.js`                             | 拡張機能のビルド設定                           |
| `esbuild.webview.js`                     | Webviewのビルド設定                            |

## パフォーマンスに関する考慮事項

- **目標**: 200×200×200ボクセルを5秒以内（NFR-001）
- 大規模データセット（1024³）は約1GBのメモリを使用 - 検証で制限を超えるファイルを拒否
- シェーダーベースレンダリングは、密なボクセルデータに対してメッシュベースより効率的
- GPU状態を保持するため、webviewオプションで`retainContextWhenHidden: true`を使用

## 言語とドキュメント

- **すべての仕様とドキュメントは日本語**（NFR-005）
- ユーザー向けメッセージとエラーテキストは日本語にすべき
- コードコメントは英語でも可、ただし機能ドキュメントは日本語必須
