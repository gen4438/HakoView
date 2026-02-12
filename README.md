# Hako View

**Hako View** は、`.leS` ボクセルファイルを VS Code 内で高速に 3D 可視化する拡張機能です。GPU ベースのレイマーチングシェーダーにより、最大 1024³ のボクセルモデルをシームレスに表示できます。

## 🌟 機能

- **カスタムエディタとして `.leS` ファイルを開く** - ファイルエクスプローラーから直接ボクセルビューアーで表示
- **テキストエディタから切り替え** - 「Open in Voxel Viewer」コマンドで `.leS` をテキストエディタから 3D ビューに変更
- **ドラッグ & ドロップ読み込み** - コマンドパレットから空のビューアーを開き、ファイルを D&D で読み込み
- **高速レンダリング** - 200³ ボクセルを 5 秒以内に初回描画
- **インタラクティブ操作** - マウスでの回転・ズーム、リアルタイム表示

## 📋 必要環境

- **VS Code**: 1.109.0 以上
- **WebGL2**: GPU レンダリング対応の環境（WebGL2 が利用可能なブラウザ対応 GPU）

## 🚀 インストール手順

### オプション 1: ローカルビルドしてインストール（推奨・開発向け）

```bash
# リポジトリをクローン
git clone https://github.com/gen4438/HakoView.git
cd HakoView

# 依存関係をインストール
pnpm install
cd webview && pnpm install && cd ..

# VSIXパッケージをビルド
pnpm run vsix
```

VS Code で 拡張機能をインストール:

1. **Ctrl+Shift+X** / **Cmd+Shift+X** で拡張機能パネルを開く
2. 「**...**」メニュー → 「**VSIX からインストール...**」を選択
3. `dist/hakoview.vsix` ファイルを選択

### オプション 2: GitHub Release からダウンロード

（将来的に GitHub Release で配布予定）

## 📖 使い方

### 方法 1: ファイルエクスプローラーから開く

1. VS Code のエクスプローラーで `.leS` ファイルを右クリック
2. 「Open With」から **LES Voxel Viewer** を選択

### 方法 2: テキストエディタから切り替え

1. `.leS` ファイルをテキスト表示で開く
2. コマンドパレット（**Ctrl+Shift+P**）から「Hakoview: Open in Voxel Viewer」を実行

### 方法 3: ドラッグ & ドロップで読み込み

1. コマンドパレット（**Ctrl+Shift+P**）から「Hakoview: Open Voxel Viewer」を実行
2. 空のビューアーに `.leS` ファイルをドラッグ & ドロップ

## 🛠️ 開発セットアップ

### 依存関係のインストール

```bash
# ルートディレクトリ
pnpm install

# Webview 依存関係（独立した package.json）
cd webview && pnpm install && cd ..
```

### ビルドコマンド

```bash
# ウォッチモードで開発（拡張機能 + Webview を並列ビルド）
pnpm run watch

# 本番ビルド（最適化）
pnpm run build:prod

# 型チェックのみ
pnpm run check-types

# Lint チェック
pnpm run lint

# テスト実行
pnpm run test

# VSIXパッケージ作成
pnpm run vsix
```

### 個別コンポーネントのビルド

```bash
# 拡張機能のみ（ウォッチ付き）
node esbuild.js --watch

# Webview のみ（ウォッチ付き）
node esbuild.webview.js --watch
```

### 拡張機能ホストで実行

1. **F5** キーを押すか、「Run and Debug」パネルで「Extension」を実行
2. VS Code の新しいウィンドウが起動（デバッグモード）
3. `.leS` ファイルを開いてビューアーをテスト

## 🏗️ アーキテクチャ

### デュアルプロセスアーキテクチャ

```
Extension Host (Node.js)           Webview (Browser)
─────────────────────              ────────────────
src/                              webview/src/
├── extension.ts              ├── VoxelViewer.tsx
├── commands/                 ├── VoxelRenderer.tsx
├── voxelEditor/              ├── shaders/
│   ├── VoxelEditorProvider   │   ├── voxel.vert
│   ├── VoxelDocument         │   └── voxel.frag
│   └── messaging.ts          ├── hooks/
├── voxelParser/              └── components/
│   ├── LesParser.ts
│   ├── VoxelData.ts
│   └── validation.ts
```

**拡張機能側（src/）:**

- Node.js 環境で実行
- ファイル I/O、パース、VS Code API 統合
- `.leS` ファイルのカスタムエディタ実装

**Webview 側（webview/）:**

- ブラウザ環境で実行（拡張機能から分離）
- React + Three.js で 3D ボクセル可視化
- 独立したビルドパイプライン（esbuild.webview.js）
- 独立した依存関係管理（webview/package.json）

### 通信フロー

```
1. 拡張機能が .leS ファイルを読み込み
2. LesParser でパース、フォーマット検証
3. VoxelDataset を作成
        ↓
4. postMessage() で Webview へデータを送信
        ↓
5. Webview が 3D テクスチャを作成
6. カスタム GLSL シェーダーでレイマーチング
7. ボクセルモデルをリアルタイム表示
```

## 📄 .leS ファイル形式（概要）

完全な仕様は [specs/001-les-voxel-viewer/les-format-spec.md](specs/001-les-voxel-viewer/les-format-spec.md) を参照。

```
X Y Z [voxel_length]              ← ヘッダー（次元とオプション単位）
data[0,0,0] ... data[0,0,Z-1]    ← 行 1 (x=0, y=0)
data[0,1,0] ... data[0,1,Z-1]    ← 行 2 (x=0, y=1)
...
data[X-1,Y-1,0] ... data[X-1,Y-1,Z-1]  ← 最終行
```

- **次元**: 1 ～ 1024
- **データ**: 空白区切りの整数（0='空'、1-255='ボクセル'）
- **制約**: ファイルサイズは最大 ~1 GB

**例:**

```
2 3 4 1.0e-9
1 0 0 0
0 0 0 0
0 0 0 0
0 0 10 0
0 0 0 0
0 0 0 20
```

## 🧪 テスト

```bash
# すべてのテストを実行
pnpm run test

# ウォッチモードでテスト実行
pnpm run watch-tests

# テストエクスプローラーで実行（VS Code UI）
# 「Testing」パネルから「Hako View Tests」を選択
```

**テストカバレッジ:**

- **ユニットテスト**: LesParser、VoxelData、フォーマット検証
- **統合テスト**: CustomEditor、3 つの導線（ファイルツリー、コマンド、D&D）

## 📚 開発ガイド

詳細は以下のドキュメントを参照：

| ドキュメント                                                                         | 内容                                                           |
| ------------------------------------------------------------------------------------ | -------------------------------------------------------------- |
| [CLAUDE.md](CLAUDE.md)                                                               | プロジェクト概要、アーキテクチャ、開発ワークフロー（**必読**） |
| [specs/001-les-voxel-viewer/plan.md](specs/001-les-voxel-viewer/plan.md)             | 実装計画、技術選択根拠                                         |
| [specs/001-les-voxel-viewer/spec.md](specs/001-les-voxel-viewer/spec.md)             | 機能仕様、要件、ユーザーストーリー                             |
| [specs/001-les-voxel-viewer/data-model.md](specs/001-les-voxel-viewer/data-model.md) | データモデル、型定義                                           |
| [specs/001-les-voxel-viewer/contracts/](specs/001-les-voxel-viewer/contracts/)       | API コントラクト、メッセージングプロトコル                     |
| [docs/release.md](docs/release.md)                                                   | リリース・配布ガイド                                           |

## ⚠️ よくある落とし穴

### ❌ Webview 依存関係をルートにインストールしない

```bash
# 誤り ❌
pnpm add react

# 正しい ✅
cd webview && pnpm add react
```

### ❌ Webview コードで `vscode` API を直接使用しない

```typescript
// 誤り ❌ - webview/src/VoxelViewer.tsx
import * as vscode from 'vscode';

// 正しい ✅ - メッセージング経由
const vscode = acquireVsCodeApi();
vscode.postMessage({ command: 'ready' });
```

### ❌ ビルドし忘れ

```bash
# 誤り ❌ - 拡張機能のみビルド
node esbuild.js

# 正しい ✅ - 両方とも必須
pnpm run watch
# または
pnpm run build:prod
```

## 💡 パフォーマンス目標

- **200³ ボクセル**: 初回レンダリング < 5 秒
- **1024³ ボクセル**: 初回レンダリング < 15 秒
- **操作時フレームレート**: 30 fps 以上

## 📄 ライセンス

このプロジェクトは MIT ライセンス下で公開されています。

## 🔗 参考リンク

- [VS Code Extension API Documentation](https://code.visualstudio.com/api)
- [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)
- [Three.js Documentation](https://threejs.org/docs/index.html)
- [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/)

---

**問題報告・機能リクエスト**: [GitHub Issues](https://github.com/gen4438/HakoView/issues)
