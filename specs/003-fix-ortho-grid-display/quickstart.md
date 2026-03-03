# Quickstart: 各IDのfraction表示とOrtho Viewエッジ表示修正

**Branch**: `003-fix-ortho-grid-display`

## 前提条件

- Node.js 18+
- pnpm

## セットアップ

```bash
git checkout 003-fix-ortho-grid-display
pnpm install
cd webview && pnpm install && cd ..
```

## 開発

```bash
# ウォッチモードで開発
pnpm run watch

# VSCodeで拡張機能テスト（F5キー）
# .leSファイルを開いてテスト
```

## 変更対象ファイル

### Fraction表示（User Story 1）

1. `webview/src/store/controlTypes.ts` - VoxelStatistics型とstore拡張
2. `webview/src/store/controlDefaults.ts` - デフォルト値追加
3. `webview/src/components/tabs/ColorsTab.tsx` - 統計情報のUI表示
4. ボクセルデータ受信時の統計計算ロジック追加

### エッジハイライト修正（User Story 2）

1. `webview/src/shaders/voxel.frag` - Ortho View用エッジ太さ補正
2. `webview/src/VoxelRenderer.tsx` - uOrthoScale uniform追加・更新

## テスト手順

### Fraction表示の確認

1. F5で拡張機能を起動
2. `.leS`ファイルを開く
3. カラータブを確認 → 各ID横にボクセル数と割合が表示されること

### エッジハイライトの確認

1. `.leS`ファイルを開く
2. `E`キーでエッジハイライトを有効化
3. `P`キーでOrtho Viewに切り替え
4. エッジが等間隔で均一に表示されること（歯抜けなし）
5. ズームイン・ズームアウトでもエッジの均一性が維持されること

## ビルドと検証

```bash
# 型チェック
pnpm run check-types

# Lint
pnpm run lint

# テスト
pnpm run test

# プロダクションビルド
pnpm run build:prod
```
