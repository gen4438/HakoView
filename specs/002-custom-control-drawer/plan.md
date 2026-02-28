# Implementation Plan: カスタムコントロールドロワー

**Branch**: `002-custom-control-drawer` | **Date**: 2026-02-28 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/002-custom-control-drawer/spec.md`

## Summary

levaライブラリを完全に除去し、画面右側にカスタムドロワーUIを構築する。Zustand v5による単一グローバルストアで約40のコントロール設定値を管理し、キーボードショートカット・ドロワーUI・Three.jsレンダラーの3者を双方向リアルタイム同期する。ドロワー内はタブ（4カテゴリ）とアコーディオン（折りたたみ）で構造化し、VSCode CSS変数でテーマ対応する。TDDで段階的に実装する。

## Technical Context

**Language/Version**: TypeScript 5.9, React 18.2, Three.js 0.160
**Primary Dependencies**: zustand@5（新規追加）, react, react-dom, @react-three/fiber, @react-three/drei ※leva@0.9.35 は削除対象
**Storage**: N/A（セッション中のみ。明示的操作でVSCode設定に保存）
**Testing**: vitest + @testing-library/react（webview側TDD）, mocha（extension側は変更なし）
**Target Platform**: VSCode webview (Chromium), esbuild IIFE output
**Project Type**: VSCode拡張機能のwebview (React + Three.js)
**Performance Goals**: コントロール操作→3Dビュー更新 100ms以内 (SC-001), キーボード→UI反映 100ms以内 (SC-002)
**Constraints**: バンドルサイズ削減（leva -40kB → zustand +1.1kB = 純減 ~39kB）, 単一IIFEバンドル（コード分割不可）
**Scale/Scope**: コントロール40項目以上、キーボードショートカット30種以上の移行

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

### Pre-Phase 0 チェック

| 原則                          | 判定    | 根拠                                                                                |
| ----------------------------- | ------- | ----------------------------------------------------------------------------------- |
| I. コード品質と保守性         | ✅ PASS | levaの巨大コンポーネント (2682行) を分割・構造化。型安全なZustandストアで一貫性向上 |
| II. テスト基準は必須          | ✅ PASS | TDDアプローチ。ストア・コンポーネント・統合テストを先行作成                         |
| III. ユーザー体験の一貫性     | ✅ PASS | 既存キーボードショートカット全維持（FR-017）、VSCodeテーマ準拠（FR-021）            |
| IV. パフォーマンス予算の遵守  | ✅ PASS | バンドル-39kB、細粒度再レンダリング、CSS composite-onlyアニメーション               |
| V. ドキュメントは日本語で維持 | ✅ PASS | 仕様・計画・リサーチ全て日本語                                                      |

### Post-Phase 1 再チェック

| 原則                          | 判定    | 根拠                                                                           |
| ----------------------------- | ------- | ------------------------------------------------------------------------------ |
| I. コード品質と保守性         | ✅ PASS | store/types/defaults分離、コンポーネント部品化、CSS変数によるテーマ一元管理    |
| II. テスト基準は必須          | ✅ PASS | vitest + @testing-library/react でストア・部品・統合テストをTDDで作成          |
| III. ユーザー体験の一貫性     | ✅ PASS | leva→カスタムUIの全設定1:1移行。操作フローは改善（タブ・アコーディオン構造化） |
| IV. パフォーマンス予算の遵守  | ✅ PASS | Zustandセレクタで細粒度更新。useFrame内getState()でReact再レンダリング回避     |
| V. ドキュメントは日本語で維持 | ✅ PASS | 全ドキュメント日本語。UIラベルは英語（既存levaラベルとの一貫性）               |

## Project Structure

### Documentation (this feature)

```text
specs/002-custom-control-drawer/
├── plan.md              # この計画書
├── research.md          # Phase 0: 技術調査
├── data-model.md        # Phase 1: データモデル定義
├── quickstart.md        # Phase 1: 開発クイックスタート
├── contracts/
│   ├── store-api.md     # Phase 1: Zustandストア契約
│   └── component-api.md # Phase 1: コンポーネントAPI契約
├── checklists/
│   └── requirements.md  # 仕様品質チェック
└── tasks.md             # Phase 2: タスク分割（/speckit.tasks で作成）
```

### Source Code (repository root)

```text
webview/src/
├── store/                    # 【新規】状態管理
│   ├── controlStore.ts       # Zustandストア定義
│   ├── controlDefaults.ts    # デフォルト値定数
│   └── controlTypes.ts       # 型定義
├── components/               # 【新規】UIコンポーネント
│   ├── drawer/
│   │   ├── Drawer.tsx        # ドロワーコンテナ
│   │   ├── Drawer.css
│   │   ├── TabBar.tsx        # タブバー
│   │   ├── TabBar.css
│   │   ├── Accordion.tsx     # 折りたたみセクション
│   │   └── Accordion.css
│   ├── controls/
│   │   ├── SliderControl.tsx # スライダー
│   │   ├── ToggleControl.tsx # トグル
│   │   ├── ColorControl.tsx  # カラーピッカー
│   │   ├── SelectControl.tsx # セレクト
│   │   ├── ButtonControl.tsx # ボタン
│   │   └── controls.css      # 共通スタイル
│   └── tabs/
│       ├── DisplayTab.tsx    # 表示設定タブ
│       ├── CameraTab.tsx     # カメラ・ライティングタブ
│       ├── ColorsTab.tsx     # カラータブ
│       └── ClippingTab.tsx   # クリッピングタブ
├── __tests__/                # 【新規】テスト
│   ├── store/
│   │   └── controlStore.test.ts
│   ├── components/
│   │   ├── SliderControl.test.tsx
│   │   ├── ToggleControl.test.tsx
│   │   ├── Accordion.test.tsx
│   │   ├── Drawer.test.tsx
│   │   └── TabBar.test.tsx
│   └── integration/
│       └── keyboardSync.test.ts
├── VoxelRenderer.tsx         # 【大幅変更】leva除去、Zustand統合
├── VoxelViewer.tsx           # 【変更】ドロワーコンポーネント配置
└── index.tsx                 # （変更なし想定）
```

**Structure Decision**: 既存のwebview/src/構造を維持しつつ、`store/` `components/drawer/` `components/controls/` `components/tabs/` を新規追加。テストは `__tests__/` 配下にミラー構造で配置。

## Complexity Tracking

違反なし。全原則をパス。
