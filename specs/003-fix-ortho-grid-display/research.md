# Research: 各IDのfraction表示とOrtho Viewエッジ表示修正

**Date**: 2026-03-03
**Branch**: `003-fix-ortho-grid-display`

## 1. Ortho Viewにおけるエッジハイライトの歯抜け問題

### 調査対象

- `webview/src/shaders/voxel.frag` のエッジ検出アルゴリズム（41-66行目）
- `webview/src/shaders/voxel.vert` のOrtho/Perspective切り替えロジック（21-32行目）
- `webview/src/VoxelRenderer.tsx` のuniform管理（920-943行目）

### 現状の仕組み

エッジハイライトは以下のアルゴリズムで動作する:

1. ワールド座標→オブジェクト座標に変換（`uModelMatrixInverse`使用）
2. `fract(objPos + hOdd)` でボクセルセル内の小数部を取得
3. `min(fractPos, 1.0 - fractPos)` でセル端への距離を計算
4. 表面法線に基づき2軸の距離を選択
5. 距離が `uEdgeThickness` 未満ならエッジ色を適用

Perspective Viewでは距離ベースフェード（`smoothstep`）が適用されるが、Ortho Viewでは `fade = 1.0` 固定でフェード処理がスキップされる。

### 根本原因の分析

Ortho Viewでの「歯抜け」の原因として以下が考えられる:

1. **レイマーチングの精度問題**: Orthoモードでは全レイが平行のため、ボクセルグリッドとの位置合わせによっては一部のボクセル境界で `fract()` の結果が不安定になる可能性がある
2. **スクリーンスペースとオブジェクトスペースの不一致**: `edgeThickness` はオブジェクト空間（セル幅の割合）で定義されているが、Orthoではズームレベルによってスクリーン上の太さが変化する。ズームアウト時にエッジが1ピクセル以下になると表示されない
3. **浮動小数点精度**: Ortho Viewではビューボリュームが広くなりがちで、レイの起点・方向のバリエーションが減少し、一部のボクセル境界でサブピクセル精度が不足する

### 決定: 修正アプローチ

- **Decision**: Ortho Viewではエッジの太さをスクリーンスペースに適応させる補正を導入する。具体的には、Ortho Viewのズームレベル（カメラのtop-bottom）に基づきオブジェクト空間での実効的な太さを調整する
- **Rationale**: オブジェクト空間のみでの太さ指定では、ズームレベルの変化に対応できず歯抜けが発生する。スクリーンスペース補正により、どのズームレベルでも一貫した太さを保証できる
- **Alternatives considered**:
  - a) フラグメントシェーダーで `dFdx`/`dFdy` を使ったスクリーンスペース計算 → WebGL2で利用可能だが計算コストが高い
  - b) Orthoカメラのfrustumサイズからuniformで補正値を渡す → シンプルで制御しやすい。**こちらを採用**
  - c) エッジ太さの固定値をOrtho用に別途設定 → ズーム変更時に追従しない

### 必要なuniform追加

- `uOrthoScale`: float - OrthographicカメラのfrustumHeight / canvasHeight から算出。Ortho View時のボクセル1単位あたりのスクリーンサイズを表す

## 2. 各IDのfraction（割合）表示

### 調査対象

- `webview/src/components/tabs/ColorsTab.tsx` の構造
- `webview/src/store/controlTypes.ts` の状態定義
- `webview/src/types/voxel.ts` のデータ型

### 現状

- ColorsTabは16色のカラースウォッチとvisibilityトグルを表示
- ボクセルデータの統計情報は一切表示されていない
- ボクセルデータはextensionからWebviewにUint8Arrayとして送信される（R8テクスチャデータ）
- controlStoreには統計情報用のフィールドがない

### 決定: 統計計算の実装箇所

- **Decision**: Webview側でボクセルデータ受信時に統計を計算し、controlStoreに保存する
- **Rationale**: Extension側でもWebview側でも計算可能だが、Webview側で行うことで:
  - メッセージングプロトコルの変更が不要
  - テクスチャデータの受信と同時に計算でき、追加通信なし
  - データは `Uint8Array` で各値が0-255の整数なので、カウントは単純なループ
- **Alternatives considered**:
  - Extension側で計算しpostMessageで送信 → メッセージングプロトコル変更が必要で複雑
  - GPU（コンピュートシェーダー）で計算 → WebGL2ではコンピュートシェーダー未対応、過剰
  - Web Worker → 200³（800万要素）程度であれば不要。1024³（約10億要素）でも単純カウントなら十分高速

### 決定: UIレイアウト

- **Decision**: 既存のColorControl各行にボクセル数と割合を追加表示する
- **Rationale**: 新しいセクションやタブを追加せず、既存の色情報と統計を並べて表示することでUIの一貫性を維持
- **Alternatives considered**:
  - 別セクション（サマリーパネル）を追加 → 情報が分散する
  - ツールチップでホバー時に表示 → 一覧性が低い
  - 新しいタブ → 仕様のAssumptionsで「新しいタブは追加しない」と明記

## 3. パフォーマンス考慮

### 統計計算のコスト

- 200³ = 8,000,000 要素のカウント: JavaScriptで数十ミリ秒以内
- 1024³ = 1,073,741,824 要素: 数秒かかる可能性があるが、これは初回ロード時のみ
- ボクセルデータのロード自体が律速のため、統計計算は相対的に無視できる

### エッジシェーダー修正のコスト

- uniform1つの追加とfloat乗算1回の追加のみ
- パフォーマンスへの影響は無視できる
