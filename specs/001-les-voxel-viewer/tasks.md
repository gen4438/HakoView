# Tasks: leSボクセルビューアー

このドキュメントは日本語で記載すること。

**Input**: Design documents from `/specs/001-les-voxel-viewer/`
**Prerequisites**: plan.md (required), spec.md (required for user stories), research.md, data-model.md, contracts/

**Tests**: 本仕様にはテストシナリオが含まれるため、テストタスクを含める。

**Organization**: タスクはユーザーストーリー単位で独立実装・独立テストできるように整理する。

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: プロジェクト初期化と基本構造

- [x] T001 予定のディレクトリ構造を作成する: src/voxelEditor/, src/voxelParser/, src/commands/, webview/src/components/, webview/src/hooks/, webview/src/shaders/, webview/src/types/, webview/dist/
- [x] T002 Webview用の依存関係とscriptsを追加した webview/package.json を作成する
- [x] T003 Webview用のTypeScript設定を webview/tsconfig.json に作成する
- [x] T004 Webviewバンドル設定を esbuild.webview.js に作成する
- [x] T005 [P] pre-commit を有効化するため、package.json と .husky/pre-commit と .lintstagedrc.json を追加・設定する
- [x] T006 [P] ルートのbuild/watch用scriptsを package.json に追加する

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: すべてのストーリーに共通の基盤

- [x] T007 VoxelDataset/Dimensions とヘルパーを src/voxelParser/VoxelData.ts に実装する
- [x] T008 [P] Webview側の型定義を webview/src/types/voxel.d.ts に追加する
- [x] T009 解析バリデーションの共通処理を src/voxelParser/validation.ts に実装する
- [x] T010 Extension-Webview通信の型/ユーティリティを src/voxelEditor/messaging.ts に実装する
- [x] T011 [P] Webview通信フックの骨組みを webview/src/hooks/useExtensionMessage.ts に実装する
- [x] T012 [P] CSP対応のHTML生成ヘルパーを src/voxelEditor/getWebviewHtml.ts に実装する

---

## Phase 3: User Story 1 - ファイルツリーから直接開く (Priority: P1) 🎯 MVP

**Goal**: .leSを既定でカスタムビューアーで開き、即座に描画できる

**Independent Test**: ファイルツリーで .leS を開き、ビューアーが起動して描画できること

### Tests for User Story 1

- [x] T013 [P] [US1] LesParserのユニットテストを src/test/voxelParser/LesParser.test.ts に作成する
- [x] T014 [P] [US1] ファイルツリーからの起動統合テストを src/test/integration/openFromTree.test.ts に作成する

### Implementation for User Story 1

- [x] T015 [P] [US1] .leSパーサー本体を src/voxelParser/LesParser.ts に実装する
- [x] T016 [P] [US1] VoxelDocumentを src/voxelEditor/VoxelDocument.ts に実装する
- [x] T017 [US1] CustomEditorProviderを src/voxelEditor/VoxelEditorProvider.ts に実装する
- [x] T018 [US1] Extension-Webviewメッセージングを src/voxelEditor/messaging.ts に接続する
- [x] T019 [US1] カスタムエディタ登録を package.json に追加する
- [x] T020 [P] [US1] Webviewエントリを webview/src/index.tsx に実装する
- [x] T021 [P] [US1] VoxelViewerコンポーネントを webview/src/VoxelViewer.tsx に実装する
- [x] T022 [P] [US1] シェーダーを webview/src/shaders/voxel.vert と webview/src/shaders/voxel.frag に移植する
- [x] T023 [P] [US1] VoxelRendererを webview/src/VoxelRenderer.tsx に実装する
- [x] T024 [P] [US1] エラー表示UIを webview/src/components/ErrorDisplay.tsx に実装する
- [x] T025 [US1] loadVoxelData処理を webview/src/hooks/useExtensionMessage.ts に実装する
- [x] T026 [US1] Webview HTML生成を src/voxelEditor/getWebviewHtml.ts に実装する
- [x] T027 [P] [US1] openAsTextコマンドを src/commands/openAsText.ts に実装する (inline in extension.ts)
- [x] T028 [US1] openAsText登録を package.json と src/extension.ts に追加する

**Checkpoint**: User Story 1 単体で描画が成立する

---

## Phase 4: User Story 2 - エディタからビューアーを開く (Priority: P2)

**Goal**: テキストエディタからコマンドでビューアーに切り替えられる

**Independent Test**: .leSをテキストで開いた状態でコマンドを実行し、同ファイルがビューアーで表示される

### Tests for User Story 2

- [x] T029 [P] [US2] openFromEditor統合テストを src/test/integration/openFromEditor.test.ts に作成する

### Implementation for User Story 2

- [x] T030 [P] [US2] openFromEditorコマンドを src/commands/openFromEditor.ts に実装する (inline in extension.ts)
- [x] T031 [US2] openFromEditorのcommand/menuを package.json に追加する
- [x] T032 [US2] コマンド登録を src/extension.ts に追加する

**Checkpoint**: User Story 2 単体で切り替えが成立する

---

## Phase 5: User Story 3 - コマンドパレットとドラッグ・アンド・ドロップで開く (Priority: P3)

**Goal**: 空のビューアーを開き、D&Dで表示できる

**Independent Test**: コマンドパレットから空のビューアーを開き、.leSをドロップして描画できる

### Tests for User Story 3

- [x] T033 [P] [US3] openVoxelViewer統合テストを src/test/integration/openVoxelViewer.test.ts に作成する

### Implementation for User Story 3

- [x] T034 [P] [US3] openVoxelViewerコマンドを src/commands/openVoxelViewer.ts に実装する
- [x] T035 [US3] D&D処理を webview/src/VoxelViewer.tsx に実装する
- [x] T036 [US3] loadFile/updateVoxelData処理を src/voxelEditor/messaging.ts に実装する
- [x] T037 [US3] openVoxelViewer登録を package.json と src/extension.ts に追加する

**Checkpoint**: User Story 3 単体でD&D表示が成立する

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: ストーリー横断の品質改善

- [x] T038 [P] パフォーマンス計測の記録を webview/src/hooks/useExtensionMessage.ts に追加する
- [x] T039 [P] 読み込み中UIを webview/src/components/LoadingState.tsx に追加する
- [x] T040 quickstart.mdの検証チェックリストを specs/001-les-voxel-viewer/quickstart.md に追記する
- [x] T041 [P] ユーザー向け利用説明を README.md に追記する

---

## Dependencies & Execution Order

### Phase Dependencies

- Setup (Phase 1) → Foundational (Phase 2) → User Stories (Phase 3-5) → Polish (Phase 6)

### User Story Dependencies

- US1 (P1): Foundational完了後に開始、他ストーリーに依存しない
- US2 (P2): Foundational完了後に開始、US1と独立
- US3 (P3): Foundational完了後に開始、US1/US2と独立

---

## Parallel Execution Examples

### User Story 1

- 同時実行例: T013, T014, T015, T016, T020, T021, T022, T023, T024, T027

### User Story 2

- 同時実行例: T029, T030

### User Story 3

- 同時実行例: T033, T034

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1 (Setup) 完了
2. Phase 2 (Foundational) 完了
3. Phase 3 (US1) 完了
4. US1の独立テストを実施

### Incremental Delivery

1. US1完了後にUS2を追加
2. US2完了後にUS3を追加
3. 最後にPhase 6の横断改善を実施

---

## Test Status

- [x] pnpm run test (2026-02-12)
