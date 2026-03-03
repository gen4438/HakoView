# Data Model: 各IDのfraction表示とOrtho Viewエッジ表示修正

**Date**: 2026-03-03
**Branch**: `003-fix-ortho-grid-display`

## エンティティ

### VoxelStatistics（新規）

ボクセルデータの各ID別統計情報。データ受信時に一度計算し、controlStoreに保存する。

| フィールド       | 型         | 説明                                       |
| ---------------- | ---------- | ------------------------------------------ |
| `countByValue`   | `number[]` | 長さ16。各インデックス（0-15）のボクセル数 |
| `totalVoxels`    | `number`   | 全ボクセル数（X × Y × Z）                  |
| `nonEmptyVoxels` | `number`   | 非空ボクセル数（ID ≠ 0）                   |

#### 導出値（表示時に計算）

- `fractionOfTotal(id)`: `countByValue[id] / totalVoxels` （ID=0用）
- `fractionOfNonEmpty(id)`: `countByValue[id] / nonEmptyVoxels` （ID=1〜15用）

#### 制約

- `countByValue` の合計 = `totalVoxels`
- `nonEmptyVoxels` = `totalVoxels - countByValue[0]`
- 各要素は 0 以上
- ボクセル値が16以上の場合、`(value - 1) % 15 + 1` で1-15にマッピング（既存仕様通り）

### シェーダーUniform追加

| Uniform       | 型      | 説明                                                   |
| ------------- | ------- | ------------------------------------------------------ |
| `uOrthoScale` | `float` | Orthoカメラの1ボクセルあたりのスクリーンスケール補正値 |

#### uOrthoScale の計算

```
uOrthoScale = frustumHeight / canvasHeight
```

- `frustumHeight`: `camera.top - camera.bottom`（Orthoカメラのビュー高さ、ワールド単位）
- `canvasHeight`: キャンバスのピクセル高さ

Ortho Viewでのエッジ太さ = `uEdgeThickness * (uOrthoScale * targetScreenPixels)`

- `targetScreenPixels`: エッジの目標スクリーン太さ（ピクセル単位、定数）

## 状態遷移

### ControlStore 拡張

```
既存状態
├── colorProfile
├── customColors[16]
├── valueVisibility[16]
├── voxelDims
└── ...

追加状態
└── voxelStatistics: VoxelStatistics | null
    - 初期値: null
    - 設定タイミング: ボクセルデータ受信時に一度だけ計算・設定
    - 更新: なし（読み取り専用）
```

## データフロー

### Fraction表示

```
Extension                        Webview
────────                        ───────
1. .leSファイル読み込み
2. LesParserでパース
3. VoxelDataset作成
4. ──[postMessage]──────────>    5. textureData (Uint8Array) 受信
                                 6. textureDataからcountByValue[16]を計算
                                 7. controlStoreに保存
                                 8. ColorsTabで表示
```

### エッジハイライト修正

```
VoxelRenderer (useFrame)         Fragment Shader
────────────────────            ────────────────
1. カメラタイプ判定
2. Orthoなら:
   frustumHeight計算
   uOrthoScale設定           →  3. uOrthoScaleでedgeThickness補正
                                  4. 補正後の太さでエッジ検出
3. Perspectiveなら:
   uOrthoScale = 0.0          →  5. 既存のfade処理（変更なし）
```
