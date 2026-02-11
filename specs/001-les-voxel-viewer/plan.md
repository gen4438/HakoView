# Implementation Plan: [FEATURE]

このドキュメントは日本語で記載すること。

**Branch**: `[###-feature-name]` | **Date**: [DATE] | **Spec**: [link]
**Input**: Feature specification from `/specs/[###-feature-name]/spec.md`

**Note**: This template is filled in by the `/speckit.plan` command. See `.specify/templates/commands/plan.md` for the execution workflow.

## Summary

VS Code拡張機能として.leSボクセルファイルの3Dビューアーを実装する。ファイルツリーから直接開く、テキストエディタから切り替える、コマンドパレットからドラッグ&ドロップの3つの導線を提供。React Three Fiberをベースに、密な大規模ボクセル（最大1000³）をシェーダーベースでレンダリングし、200³で5秒以内の初回描画を実現する。

## Technical Context

**Language/Version**: TypeScript 5.9+ (VS Code Engine 1.109.0+)  
**Primary Dependencies**: React 18+, @react-three/fiber 8+, @react-three/drei 9+, three 0.150+ (研究結果→既存実装移植)  
**Storage**: N/A (ファイルシステムから.leSファイルを直接読み込み)  
**Testing**: VS Code Test Framework (@vscode/test-electron, Mocha)、パフォーマンスベンチマーク  
**Target Platform**: VS Code Extension (Webview/WebGL2環境)  
**Project Type**: VS Code Extension (CustomEditorProvider + Webview分離構造)  
**Performance Goals**: 200³で初回描画<5秒 (NFR-001)、操作時30fps以上 (NFR-002)、1000³で初回<15秒  
**Constraints**: 最大1000³ボクセル (~1GB)、WebGL2必須、CSP準拠、バンドルサイズ<2MB、密データが基本  
**Scale/Scope**: 単一機能拡張、3つの導線（Custom Editor既定、コマンド+D&D、テキスト切替）、効率的レイマーチング

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

### Phase 0評価（研究フェーズ前）
- ✅ コード品質: TypeScript strict mode、ESLint、型チェックを既存設定で適用
- ✅ テスト基準: VS Code Test Framework使用、パーサー・統合テストを計画
- ✅ UX一貫性: 3つの導線で統一されたコマンド名・エラー表示を要件に明記
- ⚠️ パフォーマンス: 目標値は定義済み（NFR-001/002）、測定方法はNEEDS CLARIFICATION
- ✅ 文書: spec、plan、今後の成果物すべて日本語で記述

**判定**: Phase 0へ進行可。パフォーマンス測定方法は研究フェーズで明確化する。

### Phase 1評価（設計フェーズ後）
- ✅ **コード品質**: 
  - TypeScript型定義を全エンティティに適用（data-model.md）
  - Extension/Webview分離で責務明確化（Project Structure）
  - 既存コードスタイルに準拠（tmp/実装を参考）

- ✅ **テスト基準**:
  - ユニットテスト計画（LesParser, VoxelData）
  - 統合テスト計画（CustomEditor, 3導線）
  - パフォーマンスベンチマーク（RenderingMetrics）
  - quickstart.mdにテストシナリオ明記

- ✅ **UX一貫性**:
  - コマンド名統一（contracts/command-api.md）
  - エラーメッセージ標準化（contracts/messaging-protocol.md）
  - 3導線の一貫した挙動定義（User Story 1-3対応）
  - VS Code標準UIパターン活用（Reopen With...等）

- ✅ **パフォーマンス**:
  - 目標値明確化（200³<5秒、1000³<15秒）
  - 測定フレームワーク定義（RenderingMetrics）
  - 最適化戦略4段階（research.md Phase 1-4）
  - ベンチマークスイート計画（3ファイル）

- ✅ **文書**:
  - 全ドキュメント日本語記述（spec, plan, research, data-model, contracts, quickstart）
  - 技術選択の根拠記録（research.md）
  - 実装ガイド整備（quickstart.md）

**判定**: ✅ **全原則に適合。Phase 2（実装フェーズ）へ進行可。**

**特記事項**: 
- Complexity Trackingに違反なし（標準的なVS Code Extension構造）
- パフォーマンス予算遵守の具体的戦略あり（階層的最適化）
- すべての設計判断に根拠とトレードオフ記録あり

## Project Structure

### Documentation (this feature)

```text
specs/[###-feature]/
├── plan.md              # This file (/speckit.plan command output)
├── research.md          # Phase 0 output (/speckit.plan command)
├── data-model.md        # Phase 1 output (/speckit.plan command)
├── quickstart.md        # Phase 1 output (/speckit.plan command)
├── contracts/           # Phase 1 output (/speckit.plan command)
└── tasks.md             # Phase 2 output (/speckit.tasks command - NOT created by /speckit.plan)
```

### Source Code (repository root)

```text
src/
├── extension.ts              # 拡張機能のエントリポイント（既存）
├── voxelEditor/              # Custom Editor実装
│   ├── VoxelEditorProvider.ts    # CustomEditorProvider実装
│   ├── VoxelDocument.ts          # カスタムドキュメント管理
│   └── messaging.ts              # Extension-Webview通信
├── voxelParser/              # .leSファイルパーサー
│   ├── LesParser.ts              # .leS形式の読み込み
│   ├── VoxelData.ts              # ボクセルデータモデル
│   └── validation.ts             # フォーマット検証
├── commands/                 # コマンド実装
│   ├── openVoxelViewer.ts        # コマンドパレットからビューアー起動
│   └── openFromEditor.ts         # テキストエディタからビューアー起動
└── test/                     # 既存テストディレクトリ
    ├── extension.test.ts
    ├── voxelParser/
    └── integration/

webview/                      # Webview UI (React + Three.js)
├── src/
│   ├── index.tsx                 # Webviewエントリポイント
│   ├── VoxelViewer.tsx           # メインビューアーコンポーネント
│   ├── VoxelRenderer.tsx         # Three.jsレンダリング (tmpから移植)
│   ├── shaders/
│   │   ├── voxel.vert            # 頂点シェーダー (tmpから移植)
│   │   └── voxel.frag            # フラグメントシェーダー (tmpから移植)
│   ├── components/
│   │   ├── Controls.tsx          # カメラ操作・設定UI
│   │   └── ErrorDisplay.tsx      # エラー表示
│   ├── hooks/
│   │   ├── useVoxelData.ts       # ボクセルデータ管理
│   │   └── useExtensionMessage.ts # メッセージング
│   └── types/
│       └── voxel.d.ts            # 型定義
├── dist/                     # ビルド出力
├── package.json              # Webview専用依存関係
└── tsconfig.json             # Webview用TypeScript設定

specs/001-les-voxel-viewer/   # 本機能のドキュメント
├── plan.md                   # このファイル
├── research.md               # Phase 0で生成
├── data-model.md             # Phase 1で生成
├── quickstart.md             # Phase 1で生成
└── contracts/                # Phase 1で生成
```

**Structure Decision**: VS Code拡張機能として、Extension Host側（src/）とWebview UI側（webview/）を分離。Webviewは独立したビルドパイプラインを持ち、esbuildで単一バンドルにパッケージング。既存のtmp/にあるReact実装とシェーダーをwebview/src/へ移植・統合する。

## Complexity Tracking

> **Fill ONLY if Constitution Check has violations that must be justified**

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |
