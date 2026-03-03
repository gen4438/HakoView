# Tasks: 各IDのfraction表示とOrtho Viewエッジ表示修正

**Input**: Design documents from `/specs/003-fix-ortho-grid-display/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: Constitution（II. テスト基準は必須）に基づき、統計計算のユニットテストを含む。

**Organization**: US1（Fraction表示）とUS2（エッジ修正）は独立して実装・テスト可能。両方P1のため順次実装する。

**Commit**: 各フェーズ完了時にコミットする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2)
- Include exact file paths in descriptions

## Phase 1: Setup (共有インフラ)

**Purpose**: 両ストーリーで共有する型定義の追加

- [x] T001 [P] VoxelStatistics型をwebview/src/store/controlTypes.tsに追加（interface定義、countByValue, totalVoxels, nonEmptyVoxels）
- [x] T002 [P] controlStoreにvoxelStatisticsフィールドとsetVoxelStatisticsアクションを追加: webview/src/store/controlDefaults.ts
- [ ] T003 コミット: 「feat: VoxelStatistics型とstore拡張を追加」

**Checkpoint**: 型定義が完了し、両ストーリーの実装に進める状態

---

## Phase 2: User Story 1 - 各ボクセルIDの占有割合（fraction）を確認する (Priority: P1) 🎯

**Goal**: カラータブに各ボクセルID（0-15）のボクセル数と割合（%）を表示する

**Independent Test**: .leSファイルを開き、カラータブに各IDの個数と割合が表示されることを確認する

### テスト

- [x] T004 [US1] 統計計算のユニットテストを作成: webview/src/**tests**/utils/voxelStatistics.test.ts（全ID同一、空データ、混合データ、値16以上のマッピング）

### 実装

- [x] T005 [US1] computeVoxelStatistics関数を実装: webview/src/utils/voxelStatistics.ts（Uint8Arrayから各ID 0-15のカウント、16以上は(value-1)%15+1でマッピング）
- [x] T006 [US1] テスト実行して全テストがパスすることを確認（pnpm run test）
- [x] T007 [US1] ボクセルデータ受信時にcomputeVoxelStatisticsを呼び出しsetVoxelStatisticsでstoreに保存するロジックを追加（VoxelRenderer.tsxのdataTexture useMemo内）
- [x] T008 [US1] ColorsTabにfraction表示UIを追加: webview/src/components/tabs/ColorsTab.tsx（各ColorControlの横にボクセル数と割合%を小数点1桁で表示、ID=0は全体に対する割合、ID=1-15は非空ボクセルに対する割合）
- [x] T009 [US1] 型チェックとLint実行（pnpm run check-types && pnpm run lint）
- [ ] T010 コミット: 「feat: カラータブに各ボクセルIDのfraction表示を追加」

**Checkpoint**: .leSファイルを開いてカラータブで各IDの個数と割合が確認できる状態

---

## Phase 3: User Story 2 - Ortho Viewでエッジハイライトが均等に表示される (Priority: P1)

**Goal**: Orthographic Viewでボクセル表面のエッジハイライトが等間隔で均一に表示されるよう修正する

**Independent Test**: .leSファイルを開き、PキーでorthoモードにしてEキーでエッジを有効化、エッジが等間隔で表示されることを確認

### 実装

- [x] T011 [P] [US2] voxel.fragにuniform float uOrthoScaleを追加し、applyEdgeHighlight関数内でOrtho View時にエッジ太さをuOrthoScaleで補正するロジックを実装: webview/src/shaders/voxel.frag
- [x] T012 [P] [US2] VoxelRenderer.tsxのShaderMaterial初期化にuOrthoScale: 0.0を追加し、useFrame内でOrthoカメラ時にfrustumHeight/canvasHeightを計算してuOrthoScaleに設定: webview/src/VoxelRenderer.tsx
- [ ] T013 [US2] Perspective Viewのエッジ動作が既存のまま維持されていることを確認（手動テスト: 距離ベースフェードが正常動作）
- [x] T014 [US2] 型チェックとLint実行（pnpm run check-types && pnpm run lint）
- [ ] T015 コミット: 「fix: Ortho Viewのエッジハイライト歯抜け問題を修正」

**Checkpoint**: Ortho Viewでエッジが等間隔で均一に表示され、Perspective Viewの動作に影響がない状態

---

## Phase 4: Polish & Cross-Cutting Concerns

**Purpose**: 全体の品質確認と最終調整

- [x] T016 プロダクションビルドが成功することを確認（pnpm run build:prod）
- [x] T017 全テスト実行（pnpm run test）
- [ ] T018 手動統合テスト: .leSファイルを開き、Fraction表示とエッジ修正の両方が正常動作することを確認
- [ ] T019 コミット: 「chore: ビルドとテストの最終確認」（変更がある場合のみ）

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies - 即開始可能
- **US1 (Phase 2)**: Setup完了後に開始
- **US2 (Phase 3)**: Setup完了後に開始（US1とは独立、並列実装可能）
- **Polish (Phase 4)**: US1とUS2の両方が完了後

### User Story Dependencies

- **User Story 1 (P1)**: Setup（Phase 1）完了後に開始可能。US2への依存なし
- **User Story 2 (P1)**: Setup（Phase 1）完了後に開始可能。US1への依存なし

### Within Each User Story

- US1: テスト作成 → 統計計算実装 → テスト実行 → store連携 → UI表示
- US2: シェーダー修正とuniform追加は並列可能 → 動作確認

### Parallel Opportunities

- T001, T002: Setup内で並列実行可能
- T011, T012: US2内で並列実行可能（異なるファイル）
- US1とUS2全体: Phase 1完了後に並列実装可能

---

## Parallel Example: User Story 2

```bash
# エッジ修正のシェーダーとRendererを並列で実装:
Task T011: "voxel.fragにuOrthoScale uniformとエッジ太さ補正を実装"
Task T012: "VoxelRenderer.tsxにuOrthoScale初期化と更新ロジックを実装"
```

---

## Implementation Strategy

### MVP First (User Story 1)

1. Phase 1: Setup完了 → コミット
2. Phase 2: US1（Fraction表示）完了 → コミット → 手動テストで確認
3. Phase 3: US2（エッジ修正）完了 → コミット → 手動テストで確認
4. Phase 4: Polish → 最終確認

### Incremental Delivery

1. Setup → 型定義の基盤整備
2. US1 → カラータブでFraction確認可能（独立MVP）
3. US2 → Ortho Viewのエッジ修正完了（独立修正）
4. Polish → 全体の品質保証

---

## Notes

- [P] tasks = 異なるファイルを対象、依存なし
- [Story] ラベルはUS1/US2にマッピング
- 各フェーズ完了時にコミットする（ユーザー要求）
- Constitution II（テスト基準）に基づきUS1にユニットテストを含む
- US2はシェーダーの修正であり自動テストが困難なため手動テストで確認
