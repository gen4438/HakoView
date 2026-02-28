# Quickstart: カスタムコントロールドロワー

**Feature**: 002-custom-control-drawer
**Date**: 2026-02-28

## 前提条件

```bash
# リポジトリクローン済み、develop ブランチから作業ブランチに切り替え済み
git checkout 002-custom-control-drawer

# 依存関係インストール
pnpm install
cd webview && pnpm install && cd ..
```

## 新規依存関係のインストール

```bash
# Zustand（状態管理ライブラリ）をwebview側に追加
cd webview && pnpm add zustand && cd ..
```

## 開発ビルド

```bash
# ウォッチモード（拡張機能 + webview 並列ビルド）
pnpm run watch
```

## テスト実行

```bash
# 全テスト
pnpm run test

# webview側のテスト（Zustandストアのユニットテスト等）
cd webview && pnpm test
```

## 開発の進め方 (TDD)

本機能はTDD（テスト駆動開発）で進める。各タスクで以下のサイクルを繰り返す:

1. **Red**: テストを先に書く（失敗することを確認）
2. **Green**: テストが通る最小限の実装を行う
3. **Refactor**: コードを整理する（テストが通ることを確認）

### テスト環境

```bash
# webview側にテストフレームワークを追加（未導入の場合）
cd webview && pnpm add -D vitest @testing-library/react @testing-library/jest-dom jsdom

# vitest設定ファイルが必要（webview/vitest.config.ts）
```

### テストファイル配置

```
webview/src/
  __tests__/
    store/
      controlStore.test.ts       # Zustandストアのユニットテスト
    components/
      SliderControl.test.tsx     # スライダー部品テスト
      ToggleControl.test.tsx     # トグル部品テスト
      Accordion.test.tsx         # アコーディオンテスト
      Drawer.test.tsx            # ドロワー開閉テスト
      TabBar.test.tsx            # タブ切り替えテスト
    integration/
      keyboardSync.test.ts       # キーボード→ストア→UI同期テスト
```

## ファイル構成（新規追加分）

```
webview/src/
  store/
    controlStore.ts          # Zustandストア定義
    controlDefaults.ts       # デフォルト値定数
    controlTypes.ts          # 型定義
  components/
    drawer/
      Drawer.tsx             # ドロワーコンテナ
      Drawer.css             # ドロワースタイル
      TabBar.tsx             # タブバー
      TabBar.css             # タブスタイル
      Accordion.tsx          # 折りたたみセクション
      Accordion.css          # アコーディオンスタイル
    controls/
      SliderControl.tsx      # スライダー部品
      ToggleControl.tsx      # トグル部品
      ColorControl.tsx       # カラーピッカー部品
      SelectControl.tsx      # セレクト部品
      ButtonControl.tsx      # ボタン部品
      controls.css           # 共通コントロールスタイル
    tabs/
      DisplayTab.tsx         # 表示タブ
      CameraTab.tsx          # カメラ・ライティングタブ
      ColorsTab.tsx          # カラータブ
      ClippingTab.tsx        # クリッピングタブ
```

## 主要な変更対象ファイル

| ファイル                        | 変更内容                         |
| ------------------------------- | -------------------------------- |
| `webview/package.json`          | zustand追加、leva削除            |
| `webview/src/VoxelRenderer.tsx` | leva → Zustand移行、ドロワー統合 |
| `webview/src/VoxelViewer.tsx`   | ドロワーコンポーネント配置       |
| `webview/src/index.tsx`         | （変更なしの想定）               |

## 動作確認手順

1. `F5` で拡張機能開発ホストを起動
2. `.leS` ファイルを開く
3. ドロワートグルボタンが画面右端に表示されることを確認
4. クリックでドロワーが開閉することを確認
5. 各タブで設定を変更し、3Dビューに即座に反映されることを確認
6. キーボードショートカット（`p`, `e`, `b` 等）で設定変更し、ドロワーが同期することを確認
7. ドロワーの入力フィールドにフォーカス中はショートカットが無効になることを確認
