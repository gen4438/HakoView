# Contracts: コントロール部品API

**Feature**: 002-custom-control-drawer
**Date**: 2026-02-28

## コントロール部品一覧

以下のコントロール部品はすべてReactコンポーネントとして実装する。
各部品はZustandストアを`useControlStore`セレクタで個別購読し、細粒度の再レンダリングを実現する。

### 共通設計原則

- 各コントロールはラベルと値の2カラムレイアウト
- ラベルは左側、コントロール要素は右側
- VSCode CSS変数でテーマに適応
- `tabIndex` による Tab/Shift+Tab フォーカス遷移をサポート
- テキスト入力にフォーカスがある場合、グローバルキーボードショートカットを抑制

### SliderControl

数値範囲の連続値選択用コントロール。range入力と数値直接入力のハイブリッド。

```
┌──────────────────────────────────────────┐
│  Alpha          [═══════●═══]  [ 0.75 ] │
└──────────────────────────────────────────┘
```

- `input[type="range"]` でスライダードラッグ
- `input[type="number"]` で数値直接入力（FR-014）
- `onChange` はスライダードラッグ中も即座に発火（`onInput` イベント使用）
- 数値入力は min/max/step バリデーションあり

### ToggleControl

boolean値の切り替え用コントロール。

```
┌──────────────────────────────────────────┐
│  Perspective    [ ●━━━━ ] on            │
└──────────────────────────────────────────┘
```

- CSSカスタムトグルスイッチ（checkbox ベース）
- クリックおよびキーボード（Space/Enter）で切り替え

### ColorControl

色の選択用コントロール。ネイティブカラーピッカー使用。

```
┌──────────────────────────────────────────┐
│  Color 3        [■] #ff0000   [✓]      │
└──────────────────────────────────────────┘
```

- `input[type="color"]` でカラーピッカー
- 現在の色をプレビュースウォッチとして横に表示
- ボクセルカラー用には可視性チェックボックスを左に配置

### SelectControl

選択肢からの選択用コントロール。

```
┌──────────────────────────────────────────┐
│  Clipping Mode  [ Off       ▾]          │
└──────────────────────────────────────────┘
```

- ネイティブ `<select>` 要素
- VSCode CSS変数でスタイリング

### ButtonControl

アクション実行用コントロール。

```
┌──────────────────────────────────────────┐
│  [ Reset All Settings ]                  │
└──────────────────────────────────────────┘
```

- VSCodeボタンスタイル（`--vscode-button-*` CSS変数）

### Accordion

折りたたみセクション。

```
┌──────────────────────────────────────────┐
│  ▶ Edge Highlight                        │ ← 閉じ
│  ▼ Edge Highlight                        │ ← 開き
│    [子コントロール群]                     │
└──────────────────────────────────────────┘
```

- ヘッダークリックで展開/折りたたみ
- 展開/折りたたみ状態はドロワー開閉をまたいで保持（FR-008）
- CSS `max-height` + `overflow: hidden` によるアニメーション

## タブ構成

| タブID     | ラベル       | アイコン     | 含まれるコントロール                                                                           |
| ---------- | ------------ | ------------ | ---------------------------------------------------------------------------------------------- |
| `display`  | 表示         | `faEye`      | alpha, dpr, useOccupancy, showScaleBar, showBoundingBox, showGrid, エッジハイライト(Accordion) |
| `camera`   | カメラ       | `faCamera`   | usePerspective, fov, far, lightIntensity, ambientIntensity                                     |
| `colors`   | カラー       | `faPalette`  | visible0–15, color0–15, Copy Colors, Save to Settings, Open Settings                           |
| `clipping` | クリッピング | `faScissors` | clippingMode, sliceAxis, slicePositions, customNormal, customDistance                          |

## フォーカス管理の契約

```typescript
/**
 * 入力フィールドにフォーカスがあるかを検査する。
 * trueを返す場合、グローバルキーボードショートカットハンドラは処理をスキップする。
 */
function isInputFocused(): boolean {
  const el = document.activeElement;
  if (!el) return false;
  const tag = el.tagName.toLowerCase();
  return (
    tag === 'input' ||
    tag === 'textarea' ||
    tag === 'select' ||
    el.getAttribute('contenteditable') === 'true'
  );
}
```

この関数はキーボードハンドラの最初に呼び出し、`true` の場合は早期リターンする。
ただし `Escape` キーはフォーカスを解除する目的で常に処理する。
