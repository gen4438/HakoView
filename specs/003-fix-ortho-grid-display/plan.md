# Implementation Plan: 各IDのfraction表示とOrtho Viewエッジ表示修正

**Branch**: `003-fix-ortho-grid-display` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)
**Input**: Feature specification from `/specs/003-fix-ortho-grid-display/spec.md`

## Summary

2つの改善を行う:

1. **Fraction表示**: カラータブに各ボクセルID（0-15）のボクセル数と割合（%）を表示する。統計計算はWebview側でボクセルデータ受信時に一度実行し、controlStoreに保存する
2. **Ortho Viewエッジ修正**: フラグメントシェーダーのエッジハイライトがOrtho Viewで歯抜けになる問題を修正する。Orthographicカメラのfrustumサイズからスケール補正値をuniformで渡し、エッジの太さをスクリーンスペースに適応させる

## Technical Context

**Language/Version**: TypeScript 5.x, GLSL ES 3.0 (WebGL2)
**Primary Dependencies**: React 18, Three.js (react-three-fiber), Zustand (状態管理)
**Storage**: N/A（ファイルベース、.leSファイル読み取り専用）
**Testing**: Mocha + @vscode/test-electron
**Target Platform**: VSCode拡張機能（Webview: ブラウザ環境、Extension: Node.js環境）
**Project Type**: VSCode拡張機能（デュアルアーキテクチャ: Extension Host + Webview）
**Performance Goals**: 200³ボクセルを5秒以内に初回表示（NFR-001）
**Constraints**: CSP準拠（インラインスクリプト不可）、WebGL2対応ブラウザ
**Scale/Scope**: 最大1024³ボクセル、16色パレット

## Constitution Check

_GATE: Must pass before Phase 0 research. Re-check after Phase 1 design._

| 原則                          | ステータス | 備考                                       |
| ----------------------------- | ---------- | ------------------------------------------ |
| I. コード品質と保守性         | PASS       | 既存コード構造に従い、小さな変更で対応     |
| II. テスト基準は必須          | PASS       | 統計計算のユニットテスト追加予定           |
| III. ユーザー体験の一貫性     | PASS       | 既存UIパターン（ColorsTab）に統合          |
| IV. パフォーマンス予算の遵守  | PASS       | 統計計算は初回のみ、シェーダー変更は最小限 |
| V. ドキュメントは日本語で維持 | PASS       | 仕様・ドキュメント全て日本語               |

**Post-Phase 1 再評価**: 全原則PASS。違反なし。

## Project Structure

### Documentation (this feature)

```text
specs/003-fix-ortho-grid-display/
├── plan.md              # This file
├── spec.md              # 機能仕様
├── research.md          # Phase 0: 技術調査
├── data-model.md        # Phase 1: データモデル定義
├── quickstart.md        # Phase 1: 開発クイックスタート
├── contracts/           # Phase 1: インターフェースコントラクト
│   └── store-extension.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code (repository root)

```text
# Extension Host（今回変更なし）
src/
├── extension.ts
├── voxelEditor/
│   └── VoxelEditorProvider.ts
└── voxelParser/
    └── LesParser.ts

# Webview（変更対象）
webview/src/
├── VoxelRenderer.tsx              # エッジuniform追加（uOrthoScale）
├── shaders/
│   └── voxel.frag                 # Ortho View用エッジ太さ補正
├── components/tabs/
│   └── ColorsTab.tsx              # Fraction表示UI追加
├── store/
│   ├── controlTypes.ts            # VoxelStatistics型追加
│   └── controlDefaults.ts         # デフォルト値追加
└── utils/
    └── voxelStatistics.ts         # 統計計算ユーティリティ（新規）

# テスト
src/test/
└── voxelStatistics.test.ts        # 統計計算のユニットテスト（新規）
```

**Structure Decision**: 既存のデュアルアーキテクチャ（Extension Host + Webview）を維持。変更はWebview側のみで、新規ファイルは統計計算ユーティリティ1つのみ。
