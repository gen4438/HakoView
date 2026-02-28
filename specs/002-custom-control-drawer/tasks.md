# Tasks: カスタムコントロールドロワー

**Input**: Design documents from `/specs/002-custom-control-drawer/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/

**Tests**: TDDアプローチが明示的に指定されているため、各フェーズにテストタスクを含む。

**Organization**: ユーザーストーリー単位でグループ化し、各ストーリーの独立した実装・テストを可能にする。

## Format: `[ID] [P?] [Story] Description`

- **[P]**: 並列実行可能（異なるファイル、依存関係なし）
- **[Story]**: 所属ユーザーストーリー（例: US1, US2, US3）
- 各タスクに正確なファイルパスを含む

## Path Conventions

- **Extension側**: `src/` (リポジトリルート)
- **Webview側**: `webview/src/` (独立したビルドパイプライン)
- **テスト**: `webview/src/__tests__/`
- **ストア**: `webview/src/store/`
- **コンポーネント**: `webview/src/components/`

---

## Phase 1: Setup (共有インフラ)

**Purpose**: 依存関係のインストール、テスト環境構築、基本ディレクトリ構造の作成

- [x] T001 webview/package.json に zustand@5 を追加し、vitest・@testing-library/react・@testing-library/jest-dom・jsdom を devDependencies に追加
- [x] T002 vitest設定ファイルを作成 webview/vitest.config.ts（jsdom環境、webview/src パス解決）
- [x] T003 [P] webview/package.json に test スクリプト（vitest run）と test:watch スクリプト（vitest）を追加

---

## Phase 2: Foundational (ブロッキング前提条件)

**Purpose**: Zustandストアと基本コントロール部品の作成。すべてのユーザーストーリーがこのフェーズの完了に依存する。

**⚠️ CRITICAL**: このフェーズが完了するまで、ユーザーストーリーの作業は開始できない

### ストア型定義・デフォルト値

- [x] T004 [P] コントロール状態の型定義を作成 webview/src/store/controlTypes.ts（ControlState, ControlActions, ControlStore, ClippingMode, SliceAxis, TabId, DrawerState の型を data-model.md に基づいて定義）
- [x] T005 [P] デフォルト値定数を作成 webview/src/store/controlDefaults.ts（DEFAULT_PALETTE, DEFAULT_VISIBILITY, DEFAULT_CONTROL_STATE を data-model.md に基づいて定義）

### ストアテスト・実装（TDD）

- [x] T006 Zustandストアのユニットテストを作成 webview/src/**tests**/store/controlStore.test.ts（set, reset, updateColor, updateVisibility, setSlicePosition, initDefaults の各アクションをテスト）
- [x] T007 Zustandストアを実装 webview/src/store/controlStore.ts（subscribeWithSelector ミドルウェア付き、store-api.md の契約に準拠）

### コントロール部品テスト・実装（TDD）

- [x] T008 [P] SliderControl のテストを作成 webview/src/**tests**/components/SliderControl.test.tsx（ラベル表示、range入力、数値直接入力、onChange発火、min/max/step バリデーション）
- [x] T009 [P] ToggleControl のテストを作成 webview/src/**tests**/components/ToggleControl.test.tsx（ラベル表示、チェック状態反映、クリックで切替、keyboard操作）
- [x] T010 [P] SliderControl を実装 webview/src/components/controls/SliderControl.tsx（input[type=range] + input[type=number] ハイブリッド、FR-009, FR-014 準拠、component-api.md の SliderControlProps に準拠）
- [x] T011 [P] ToggleControl を実装 webview/src/components/controls/ToggleControl.tsx（CSS カスタムトグルスイッチ、FR-010 準拠、component-api.md の ToggleControlProps に準拠）
- [x] T012 [P] ColorControl を実装 webview/src/components/controls/ColorControl.tsx（input[type=color] ネイティブ、FR-011 準拠、component-api.md の ColorControlProps に準拠）
- [x] T013 [P] SelectControl を実装 webview/src/components/controls/SelectControl.tsx（ネイティブ select 要素、FR-012 準拠、component-api.md の SelectControlProps に準拠）
- [x] T014 [P] ButtonControl を実装 webview/src/components/controls/ButtonControl.tsx（VSCodeボタンスタイル、FR-013 準拠、component-api.md の ButtonControlProps に準拠）
- [x] T015 [P] コントロール部品の共通スタイルを作成 webview/src/components/controls/controls.css（2カラムレイアウト、VSCode CSS変数によるテーマ対応、FR-021 準拠）

**Checkpoint**: ストアと全コントロール部品が利用可能 — ユーザーストーリーの実装を開始可能

---

## Phase 3: User Story 1 — ドロワーでコントロール操作 (Priority: P1) 🎯 MVP

**Goal**: 画面右側のドロワーを開閉し、基本コントロールで3Dビューをリアルタイム操作できるようにする

**Independent Test**: ドロワーを開き、任意のコントロール（例: アルファ値スライダー）を操作して、3Dビューがリアルタイムに更新されることを確認する

### Tests for User Story 1 ⚠️

> **NOTE: テストを先に書き、実装前に FAIL することを確認する**

- [x] T016 [P] [US1] Drawer コンポーネントのテストを作成 webview/src/**tests**/components/Drawer.test.tsx（開閉状態の切替、スライドインアニメーション用クラス付与、320px幅、FR-001〜FR-004 のシナリオ）
- [x] T017 [P] [US1] ストア→3Dビュー同期のテストを作成 webview/src/**tests**/integration/storeSync.test.ts（ストア値変更がgetState()経由で即座に参照可能であることを検証）

### Implementation for User Story 1

- [x] T018 [P] [US1] Drawer コンテナコンポーネントを実装 webview/src/components/drawer/Drawer.tsx（開閉トグルボタン、スライドイン/アウト、FR-001〜FR-004 準拠）
- [x] T019 [P] [US1] Drawer のスタイルを作成 webview/src/components/drawer/Drawer.css（transform: translateX アニメーション、320px固定幅、VSCode CSS変数、research.md のCSS設計に準拠）
- [x] T020 [US1] VoxelViewer.tsx にドロワーコンポーネントを配置し、ビューポートのリサイズロジックを追加 webview/src/VoxelViewer.tsx（ドロワー開閉時に3Dビュー幅をcalc(100% - 320px)に調整、FR-003 準拠）
- [x] T021 [US1] VoxelRenderer.tsx の leva useControls を Zustand ストアに移行（メインコントロール部分）webview/src/VoxelRenderer.tsx（useControls → useControlStore セレクタ、set() → useControlStore.setState()、leva の Leva コンポーネント削除）
- [x] T022 [US1] VoxelRenderer.tsx の useEffect uniform 更新を useFrame + getState() パターンに移行 webview/src/VoxelRenderer.tsx（store-api.md パターン3に準拠、毎フレームのgetState()でuniform値をGPUに反映）
- [x] T023 [US1] Drawer 内に表示設定コントロール（alpha, dpr, useOccupancy, showScaleBar, showBoundingBox, showGrid）を仮配置 webview/src/components/drawer/Drawer.tsx（Zustandストアとの双方向バインディング、FR-015 準拠）

**Checkpoint**: ドロワーの開閉と基本コントロールによる3Dビューの即時操作が可能。US1のAcceptance Scenarios 1〜4を検証可能

---

## Phase 4: User Story 2 — タブ・折りたたみによるグループ化 (Priority: P1)

**Goal**: ドロワー内のコントロールをタブ4カテゴリとアコーディオンで構造的にナビゲートできるようにする

**Independent Test**: ドロワーを開き、タブを切り替えて異なるカテゴリの設定グループにアクセスし、各グループ内のアコーディオンを展開・折りたたみできることを確認する

### Tests for User Story 2 ⚠️

> **NOTE: テストを先に書き、実装前に FAIL することを確認する**

- [x] T024 [P] [US2] TabBar コンポーネントのテストを作成 webview/src/**tests**/components/TabBar.test.tsx（タブ切替、アクティブタブのスタイル、4タブ表示）
- [x] T025 [P] [US2] Accordion コンポーネントのテストを作成 webview/src/**tests**/components/Accordion.test.tsx（展開/折りたたみ切替、子要素の表示/非表示、状態保持）

### Implementation for User Story 2

- [x] T026 [P] [US2] TabBar コンポーネントを実装 webview/src/components/drawer/TabBar.tsx（4タブ: display, camera, colors, clipping、component-api.md の TabBarProps に準拠）
- [x] T027 [P] [US2] TabBar のスタイルを作成 webview/src/components/drawer/TabBar.css（VSCode tab CSS変数、アクティブタブの下線表示）
- [x] T028 [P] [US2] Accordion コンポーネントを実装 webview/src/components/drawer/Accordion.tsx（展開/折りたたみアニメーション、max-height + overflow:hidden、FR-006, FR-008 準拠、component-api.md の AccordionProps に準拠）
- [x] T029 [P] [US2] Accordion のスタイルを作成 webview/src/components/drawer/Accordion.css（sideBarSectionHeader CSS変数、展開アニメーション）
- [x] T030 [US2] DisplayTab を実装 webview/src/components/tabs/DisplayTab.tsx（alpha, dpr, useOccupancy, showScaleBar, showBoundingBox, showGrid + Edge Highlight アコーディオン）
- [x] T031 [P] [US2] CameraTab を実装 webview/src/components/tabs/CameraTab.tsx（usePerspective, fov, far, lightIntensity, ambientIntensity）
- [x] T032 [US2] Drawer.tsx にTabBarとタブコンテンツを統合 webview/src/components/drawer/Drawer.tsx（display:none方式でタブ切替、DrawerState管理、FR-005, FR-007, FR-008 準拠）
- [x] T033 [US2] Phase 3 で仮配置したコントロールを DisplayTab/CameraTab に移設し、Drawer から Phase 3 の仮コントロールを削除

**Checkpoint**: タブ切り替えとアコーディオン折りたたみが動作。設定値がタブ切替後も保持される。US2のAcceptance Scenarios 1〜3を検証可能

---

## Phase 5: User Story 3 — キーボードショートカットとUI同期 (Priority: P1)

**Goal**: キーボードショートカットでの設定変更がドロワーUIに即座に反映され、双方向に一貫した状態を維持する

**Independent Test**: ドロワーを開いた状態で`p`キーを押し、ドロワー内の「パースペクティブ」トグルが即座に反映されることを確認する

### Tests for User Story 3 ⚠️

> **NOTE: テストを先に書き、実装前に FAIL することを確認する**

- [x] T034 [P] [US3] キーボード→ストア→UI同期のテストを作成 webview/src/**tests**/integration/keyboardSync.test.ts（keydown イベント発火 → ストア値変更 → UIコンポーネント反映を検証、SC-002 準拠）
- [x] T035 [P] [US3] フォーカス管理のテストを作成 webview/src/**tests**/integration/focusManagement.test.ts（input フォーカス時のショートカット抑制、Escape でのフォーカス解除、FR-022 準拠）

### Implementation for User Story 3

- [x] T036 [US3] VoxelRenderer.tsx のキーボードハンドラを Zustand getState()/setState() パターンに移行 webview/src/VoxelRenderer.tsx（既存の全ショートカット30種以上を維持、FR-017 準拠、store-api.md パターン2に準拠）
- [x] T037 [US3] フォーカス管理ユーティリティ isInputFocused() を実装し、キーボードハンドラに組み込み webview/src/VoxelRenderer.tsx（component-api.md のフォーカス管理契約に準拠、FR-022 準拠）
- [x] T038 [US3] ドロワー内全コントロールに tabIndex を付与し、Tab/Shift+Tab フォーカス遷移を確認 webview/src/components/controls/\*.tsx（FR-024 準拠）

**Checkpoint**: キーボードショートカットとドロワーUIが双方向同期。入力フォーカス時のショートカット抑制が動作。US3のAcceptance Scenarios 1〜4を検証可能

---

## Phase 6: User Story 4 — ボクセルカラー管理 (Priority: P2)

**Goal**: 各ボクセル値（0〜15）の色と表示/非表示をドロワー内で視覚的に管理できるようにする

**Independent Test**: ドロワーのカラータブでボクセル値3の色を赤に変更し、3Dビューで対応するボクセルが赤く表示されることを確認する

### Tests for User Story 4 ⚠️

- [x] T039 [P] [US4] ColorsTab のテストを作成 webview/src/**tests**/components/ColorsTab.test.tsx（16色表示、カラーピッカー変更、可視性チェックボックス切替、ストア反映）

### Implementation for User Story 4

- [x] T040 [US4] ColorsTab を実装 webview/src/components/tabs/ColorsTab.tsx（16個のColorControl + 可視性チェックボックス、updateColor/updateVisibility アクション使用）
- [x] T041 [US4] ColorsTab にアクションボタンを追加 webview/src/components/tabs/ColorsTab.tsx（色のコピー、設定に保存、設定を開く の3ボタン、既存の saveColorSettings/openSettings メッセージを再利用、FR-019 準拠）
- [x] T042 [US4] Drawer に ColorsTab を統合 webview/src/components/drawer/Drawer.tsx（colors タブのコンテンツとしてColorsTabを配置）

**Checkpoint**: カラータブでの色変更と可視性切替が3Dビューにリアルタイム反映。US4のAcceptance Scenarios 1〜4を検証可能

---

## Phase 7: User Story 5 — クリッピングコントロール (Priority: P2)

**Goal**: ドロワー内でクリッピング設定（Off/Slice/Custom）を操作でき、スライスモードでは直感的なスライダーで断面操作ができるようにする

**Independent Test**: ドロワーでクリッピングモードをSliceに変更し、Z軸のスライス位置スライダーを操作して、3Dビューのクリッピングが追従することを確認する

### Tests for User Story 5 ⚠️

- [x] T043 [P] [US5] ClippingTab のテストを作成 webview/src/**tests**/components/ClippingTab.test.tsx（モード切替で条件付きUI表示、スライス軸選択、スライスポジションスライダー操作）

### Implementation for User Story 5

- [x] T044 [US5] ClippingTab を実装 webview/src/components/tabs/ClippingTab.tsx（ClippingMode セレクト、SliceAxis セレクト、スライスポジションスライダー、Custom用パラメータ、条件付き表示、FR-018 準拠）
- [x] T045 [US5] VoxelRenderer.tsx の clipping 専用 leva ストア (useCreateStore/setClipping) を Zustand ストアに統合 webview/src/VoxelRenderer.tsx（clippingControls → useControlStore セレクタに移行）
- [x] T046 [US5] Drawer に ClippingTab を統合 webview/src/components/drawer/Drawer.tsx（clipping タブのコンテンツとしてClippingTabを配置）

**Checkpoint**: クリッピングモード切替とスライス操作が3Dビューにリアルタイム反映。US5のAcceptance Scenarios 1〜3を検証可能

---

## Phase 8: User Story 6 — 設定のリセット (Priority: P3)

**Goal**: ドロワー内のリセットボタンで全コントロール設定をデフォルト値に戻せるようにする

**Independent Test**: 複数の設定を変更した後、リセットボタンを押して全設定がデフォルト値に戻ることを確認する

### Tests for User Story 6 ⚠️

- [x] T047 [P] [US6] リセット機能のテストを作成 webview/src/**tests**/integration/reset.test.ts（複数値変更後にreset()で全フィールドがデフォルトに戻り、UI表示も更新されることを検証）

### Implementation for User Story 6

- [x] T048 [US6] DisplayTab にリセットボタンを追加 webview/src/components/tabs/DisplayTab.tsx（reset() アクション呼び出し、FR-019 準拠）

**Checkpoint**: リセットボタンで全設定がデフォルトに戻り、3Dビューも即座に更新される。US6のAcceptance Scenarios 1〜2を検証可能

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: leva完全除去、テーマ検証、パフォーマンス最適化、ドキュメント更新

- [x] T049 webview/package.json から leva 依存を削除し、VoxelRenderer.tsx から leva の全 import と Leva コンポーネント（メイン + Clipping 専用）を除去（FR-020, SC-007 準拠）
- [x] T050 [P] VSCode テーマ3パターン（ダーク/ライト/ハイコントラスト）でのドロワー表示を検証し、ハイコントラスト固有のCSS対応を追加 webview/src/components/drawer/Drawer.css および controls.css（SC-005 準拠）
- [x] T051 [P] パフォーマンス検証: コントロール操作→３Ｄビュー更新が100ms以内であることを手動計測（SC-001, SC-002 準拠）
- [x] T052 [P] 全キーボードショートカット（30種以上）の動作確認と回帰テスト実施（SC-003 準拠）
- [x] T053 [P] 全コントロール（40項目以上）がカスタムUIに移行されていることを確認（SC-004 準拠）
- [x] T054 quickstart.md の動作確認手順に従い、一連の統合テストを実施

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: 依存なし — 即座に開始可能
- **Foundational (Phase 2)**: Setup 完了に依存 — **全ユーザーストーリーをブロック**
- **User Stories (Phase 3〜8)**: Foundational フェーズ完了に依存
  - US1 (Phase 3) → US2 (Phase 4) は順序依存（US2はUS1のDrawerコンポーネントに依存）
  - US3 (Phase 5) はUS1完了後に開始可能（キーボードハンドラ移行がleva除去と連携）
  - US4 (Phase 6) はUS2完了後に開始可能（タブ構造が必要）
  - US5 (Phase 7) はUS2完了後に開始可能（タブ構造が必要）
  - US6 (Phase 8) はUS4・US5完了後に開始可能（リセット対象の全コントロールが配置されている必要あり）
- **Polish (Phase 9)**: US1〜US6 すべて完了後

### User Story Dependencies

```
Phase 1: Setup
    ↓
Phase 2: Foundational (Store + Control Components)
    ↓
Phase 3: US1 - ドロワー基本 (P1) 🎯 MVP
    ├──→ Phase 4: US2 - タブ・折りたたみ (P1)
    │       ├──→ Phase 6: US4 - カラー管理 (P2)
    │       └──→ Phase 7: US5 - クリッピング (P2) ← 並列可能
    └──→ Phase 5: US3 - キーボード同期 (P1)
                    ↓
            Phase 8: US6 - リセット (P3) ← US4, US5 完了後
                    ↓
            Phase 9: Polish
```

### Within Each User Story

- テストを先に書き、FAIL を確認してから実装
- コンポーネント → スタイル → 統合 の順序
- 各ストーリー完了後にチェックポイントで独立検証

### Parallel Opportunities

- Phase 2 の T004/T005（型定義/デフォルト値）は並列実行可能
- Phase 2 の T008〜T015（コントロール部品テスト/実装）は並列実行可能
- Phase 4 の T026〜T029（TabBar/Accordion）は並列実行可能
- Phase 6 の US4 と Phase 7 の US5 は並列実行可能（異なるタブ、異なるファイル）

---

## Parallel Example: Phase 2 (Foundational)

```bash
# まず型定義とデフォルト値を並列作成:
Task: T004 "コントロール状態の型定義を作成 webview/src/store/controlTypes.ts"
Task: T005 "デフォルト値定数を作成 webview/src/store/controlDefaults.ts"

# 次にストアテスト → 実装:
Task: T006 "Zustandストアのユニットテストを作成"
Task: T007 "Zustandストアを実装"

# コントロール部品を全て並列作成:
Task: T008 "SliderControl テスト"
Task: T009 "ToggleControl テスト"
Task: T010 "SliderControl 実装"
Task: T011 "ToggleControl 実装"
Task: T012 "ColorControl 実装"
Task: T013 "SelectControl 実装"
Task: T014 "ButtonControl 実装"
Task: T015 "共通スタイル作成"
```

## Parallel Example: User Story 4 + 5 (P2 並列)

```bash
# US4 と US5 は異なるタブ・異なるファイルのため並列実行可能:
# Developer A: US4
Task: T039 "ColorsTab テスト"
Task: T040 "ColorsTab 実装"
Task: T041 "アクションボタン追加"
Task: T042 "Drawer に ColorsTab 統合"

# Developer B: US5
Task: T043 "ClippingTab テスト"
Task: T044 "ClippingTab 実装"
Task: T045 "clipping leva → Zustand 移行"
Task: T046 "Drawer に ClippingTab 統合"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Phase 1: Setup 完了
2. Phase 2: Foundational 完了（**CRITICAL — 全ストーリーをブロック**）
3. Phase 3: User Story 1 完了
4. **STOP and VALIDATE**: ドロワー開閉と基本コントロール操作を独立検証
5. この時点でMVPとしてデモ可能

### Incremental Delivery

1. Setup + Foundational → ストアと部品が利用可能
2. US1 完了 → ドロワー基本動作 → 検証 → **MVP!**
3. US2 完了 → タブ・折りたたみ構造 → 検証
4. US3 完了 → キーボード同期 → 検証 → **P1コア機能完了**
5. US4 + US5 並列完了 → カラー管理 + クリッピング → 検証
6. US6 完了 → リセット機能 → 検証
7. Polish → leva完全除去、テーマ・パフォーマンス検証 → **リリース準備完了**

### Parallel Team Strategy

複数開発者がいる場合:

1. 全員で Setup + Foundational を完了
2. Foundational 完了後:
   - Developer A: US1 → US2 → US3（コア構造のシーケンシャル実装）
   - Developer B: US1完了を待ち、US4 と US5 を並列開始
3. US6 と Polish は全ストーリー完了後に実施

---

## Notes

- [P] タスク = 異なるファイル、依存関係なし
- [Story] ラベルはタスクと特定のユーザーストーリーの追跡可能性を提供
- 各ユーザーストーリーは独立して完了・テスト可能であるべき
- テストが FAIL することを確認してから実装に進む
- 各タスクまたは論理グループの完了後にコミット
- 任意のチェックポイントでストーリーを独立検証可能
- VoxelRenderer.tsx (2682行) の変更は段階的に実施し、一度に大量変更を避ける
