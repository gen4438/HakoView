# Occupancy Grid加速の試行と廃止の経緯

## 概要

2026年2月12日、疎なボクセルデータの描画性能を改善するため、**Occupancy Grid加速**を実装したが、クリッピング機能との相互作用で深刻な描画不具合が発生したため、同日中に廃止した。本ドキュメントでは、実装の詳細、発生した問題、廃止の判断基準を記録する。

## タイムライン

| 時刻                  | コミットID | 内容                                           |
| --------------------- | ---------- | ---------------------------------------------- |
| 2026-02-12 15:17      | `5a70f46`  | Occupancy Grid加速の実装                       |
| 2026-02-12 (時刻不明) | `912b8ca`  | クリッピング時の不具合修正を試行（不完全）     |
| 2026-02-12 16:20      | `7385301`  | Occupancy Grid加速を完全に廃止、元の実装に復元 |

## 実装内容（コミット `5a70f46`）

### 動機

疎なボクセルデータ（大部分が空のデータセット）において、DDAレイマーチングで空領域を1セルずつステップするのは非効率。空ブロックを一気にスキップすることで、レイマーチング速度を大幅に向上させる。

### 実装方針

**Occupancy Grid**（占有グリッド）を導入。元のボクセルデータを8×8×8の粗いブロックに分割し、各ブロックが「少なくとも1つの実体ボクセルを含むか」を事前計算。レイマーチング時に空ブロックを検出したら、ブロック境界まで一気にスキップする。

### 詳細な変更内容

#### 1. Occupancy Gridテクスチャの生成（VoxelRenderer.tsx）

```typescript
// 8×8×8ブロック単位の占有テクスチャを生成
const occupancyData = useMemo(() => {
  const { dimensions, values } = voxelData;
  const blockSize = 8;
  const occX = Math.ceil(dimensions.x / blockSize);
  const occY = Math.ceil(dimensions.y / blockSize);
  const occZ = Math.ceil(dimensions.z / blockSize);
  const occData = new Uint8Array(occX * occY * occZ);
  const uint8Array = values instanceof Uint8Array ? values : new Uint8Array(values);

  // 各ブロック内に1つでも実体ボクセルがあれば occupied = true
  for (let bx = 0; bx < occX; bx++) {
    const xStart = bx * blockSize;
    const xEnd = Math.min(xStart + blockSize, dimensions.x);
    for (let by = 0; by < occY; by++) {
      const yStart = by * blockSize;
      const yEnd = Math.min(yStart + blockSize, dimensions.y);
      for (let bz = 0; bz < occZ; bz++) {
        const zStart = bz * blockSize;
        const zEnd = Math.min(zStart + blockSize, dimensions.z);
        let occupied = false;
        for (let x = xStart; x < xEnd && !occupied; x++) {
          for (let y = yStart; y < yEnd && !occupied; y++) {
            const rowBase = (x * dimensions.y + y) * dimensions.z;
            for (let z = zStart; z < zEnd; z++) {
              if (uint8Array[rowBase + z] !== 0) {
                occupied = true;
                break;
              }
            }
          }
        }
        occData[bx + occX * (by + occY * bz)] = occupied ? 255 : 0;
      }
    }
  }

  const texture = new THREE.Data3DTexture(occData, occX, occY, occZ);
  texture.format = THREE.RedFormat;
  texture.type = THREE.UnsignedByteType;
  texture.minFilter = THREE.NearestFilter;
  texture.magFilter = THREE.NearestFilter;
  texture.unpackAlignment = 1;
  texture.needsUpdate = true;

  return { texture, dimensions: new THREE.Vector3(occX, occY, occZ) };
}, [voxelData]);
```

**計算量**: O(N³) — 元のボクセルデータ全体を1回走査するため、データサイズに比例。大規模データセットでは初期化コストが高い。

#### 2. シェーダーへのuniform追加（voxel.frag）

```glsl
uniform sampler3D uOccupancyTexture;  // 占有グリッドテクスチャ（R8、0=空/255=占有）
uniform vec3 uOccupancyDimensions;     // グリッドの次元（例: 64×64×64なら(64,64,64)）
uniform float uBlockSize;              // ブロックサイズ（固定値8）
```

#### 3. DDA最適化の同時実施

Occupancy Grid導入と同時に、以下の最適化も実施:

##### a) ブランチレスDDAステップ

**元の実装（スカラーif/else方式）**:

```glsl
// 最小のtMax軸を決定
int axis;
if (tMax.x <= tMax.y) {
    axis = (tMax.x <= tMax.z) ? 0 : 2;
} else {
    axis = (tMax.y <= tMax.z) ? 1 : 2;
}

// 一歩進む
if      (axis == 0) { position.x += stepVec.x; hitDistance = tMax.x; tMax.x += tDelta.x; hitNormal = vec3(-stepVec.x, 0.0, 0.0); }
else if (axis == 1) { position.y += stepVec.y; hitDistance = tMax.y; tMax.y += tDelta.y; hitNormal = vec3(0.0, -stepVec.y, 0.0); }
else                { position.z += stepVec.z; hitDistance = tMax.z; tMax.z += tDelta.z; hitNormal = vec3(0.0, 0.0, -stepVec.z); }
```

**新実装（ブランチレスベクトル演算）**:

```glsl
// 最小tMax軸を選択するマスクベクトルを生成（GPU並列性向上を狙う）
vec3 cmp = step(tMax.xyz, tMax.yzx) * step(tMax.xyz, tMax.zxy);
// タイブレーキング: x > y > z の優先度で1つだけ選択
cmp.y *= 1.0 - cmp.x;
cmp.z *= 1.0 - max(cmp.x, cmp.y);
// 数値的安全策: 1つも選ばれなければxを選択
if (dot(cmp, cmp) < 0.5) cmp.x = 1.0;

// ベクトル演算で一歩進む
position += stepVec * cmp;
hitDistance = dot(tMax, cmp);
tMax += tDelta * cmp;
hitNormal = -stepVec * cmp;
```

**理論的根拠**: GPUのSIMD命令セットでは、ベクトル演算がスカラー分岐より効率的な場合がある。ただし、最新のGPUコンパイラは分岐予測とベクトル化に優れているため、実効性能差は環境依存。

##### b) maxSteps の引き上げ

```glsl
// 変更前: カメラ距離に応じて適応的に調整（800〜200ステップ）
float near = 50.0, far = 500.0;
float distanceFactor = smoothstep(near, far, uCameraDistance);
int baseMaxSteps = int(min(length(uVoxelShape) * 2.0, 800.0));
int maxSteps = int(mix(float(baseMaxSteps), float(baseMaxSteps) * 0.25, distanceFactor));

// 変更後: 固定2000ステップ（Occupancy Gridで実効ステップ数が減るため上限を緩和）
int maxSteps = int(min(length(uVoxelShape) * 2.0, 2000.0));
```

**理由**: 空ブロックスキップにより、実効的なセルサンプリング回数が大幅減少するため、ループ上限を緩めても問題ないと判断。

#### 4. Occupancy Gridスキップロジック（voxel.frag）

DDAループ内に以下のロジックを追加:

```glsl
// Occupancy Gridによる空ブロックスキップ
if (useOccupancy) {
    vec3 sp = position + vec3(0.5);
    vec3 vidx = floor(sp + 0.5 * uVoxelShape);
    vec3 bidx = floor(vidx / uBlockSize);

    // ブロック範囲外チェック
    if (any(lessThan(bidx, vec3(0.0))) ||
        any(greaterThanEqual(bidx, uOccupancyDimensions))) {
        prevOccupied = false;
        continue;
    }

    vec3 tc = (bidx + 0.5) / uOccupancyDimensions;
    if (texture(uOccupancyTexture, tc).r < 0.5) {
        // 空ブロック: ブロック出口までレイを一気にスキップ
        vec3 farEdge = (bidx + step(vec3(0.0), stepVec)) * uBlockSize
                     - 0.5 * uVoxelShape;
        vec3 tBlockFar = (farEdge - origin) * invDir;
        float tSkip = min(min(tBlockFar.x, tBlockFar.y), tBlockFar.z);

        if (tSkip > tExit) break;

        // スキップ先でDDA状態を再初期化
        vec3 pNew = origin + (tSkip + 1e-4) * direction;
        position = floor(pNew + halfOdd + sgn * 1e-4) - halfOdd;
        vec3 nb = position + step(vec3(0.0), stepVec);
        tMax = (nb - origin) * invDir;
        prevOccupied = false;
        continue;
    }
}

// ボクセルサンプリング（占有ブロック内のみ実行）
samplePos = position + vec3(0.5);
voxel = sampleVoxel(samplePos);
bool currentOccupied = (voxel.a > 0.0);
```

**処理フロー**:

1. 現在のDDA位置が属するブロックインデックスを計算
2. Occupancy Gridテクスチャをサンプリング
3. 空ブロック（値0.0）なら、ブロックの遠端（`farEdge`）までのt値を計算
4. レイ位置を`tSkip`までジャンプし、DDA状態（`position`, `tMax`）を再初期化
5. ボクセルサンプリングをスキップして次のループへ

#### 5. その他の最適化

- **エッジ強調のヘルパー関数化**: 重複コードを`applyEdgeHighlight()`関数に統合（コード量削減、可読性向上）
- **パレットα値によるVisibilityエンコード**: `uValueVisibility`配列参照を廃止し、パレットテクスチャのα値で可視性を表現（シェーダー分岐削減）

## 発生した問題（コミット `912b8ca` で修正を試行）

### 問題1: クリッピング時の不自然な穴

**症状**:

> "クリッピング時に、クリッピング面があった状態での空間スキップを行ってしまうためか、クリッピング後の構造に不自然な穴が開いてしまうことがあります。本来は塞がれるべき面が消えてしまう影響でしょう。"

**原因**:
クリッピング面でAABB範囲（`tEnter`/`tExit`）を調整した後、Occupancy Gridスキップが元の（調整前の）AABB境界を基準にブロック出口を計算していた。その結果、クリッピング面を超えてスキップしてしまい、表示されるべき境界面が欠落。

**修正試行（`912b8ca`）**:
スキップ先でボクセルをサンプリングし、実体が検出された場合は即座にヒット判定する処理を追加:

```glsl
// スキップ先のボクセルをサンプリング（ブロック境界の表面を見逃さないため）
samplePos = position + vec3(0.5);
vec4 skipVoxel = sampleVoxel(samplePos);
bool skipOccupied = (skipVoxel.a > 0.0);

if (skipOccupied) {
    // 空→実体の遷移をスキップ境界で検出
    voxel = skipVoxel;
    hitDistance = tSkip;
    // スキップで横切った面の法線を計算
    vec3 skipMask = vec3(0.0);
    if (tBlockFar.x <= tBlockFar.y && tBlockFar.x <= tBlockFar.z) {
        skipMask.x = 1.0;
    } else if (tBlockFar.y <= tBlockFar.z) {
        skipMask.y = 1.0;
    } else {
        skipMask.z = 1.0;
    }
    hitNormal = -stepVec * skipMask;
    hit = true;
    break;
}
```

### 問題2: 8ブロック単位の削られた構造

**症状**:

> "穴は開かなくなったが、先程まで穴の空いていた箇所で、8ブロック単位でボクセル構造が削られた部分が発生しています。元々はボクセルが存在する箇所が、一部表示されていないようです。クリッピング面がちょうどステップで通り過ぎるかどうかのラインでそのような事が起きるみたいです。"

**原因推測**:

1. **DDA再初期化の不整合**: スキップ後の`position`計算に微小な浮動小数点誤差が蓄積し、クリッピング面近傍で正しいグリッドセルにアライメントされない
2. **境界条件の不完全性**: ブロック境界とクリッピング面が一致する境界ケースで、`tSkip`と`tExit`の比較が正しく機能しない
3. **prevOccupiedの不正確な管理**: スキップ後に`prevOccupied = false`で強制リセットしているが、実際にはスキップ元のブロック終端セルが実体だった場合、境界判定が誤る

**根本的問題**:
Occupancy Gridスキップは、「連続したDDAステップ」という前提を破壊する。クリッピング処理は`tEnter`/`tExit`という**レイパラメータt空間**で動作するが、Occupancy Gridは**グリッド空間**でジャンプするため、両者の整合性を保つのが困難。

## 廃止の判断（コミット `7385301`）

### 判断理由

1. **クリッピング機能との相性が悪い**: 本プロジェクトでは2面スライスやカスタムクリッピングが重要機能であり、この不具合は致命的
2. **修正の複雑性**: 境界ケースを完全に処理するには、スキップロジックを大幅に複雑化させる必要がある（テスト負荷・保守性の悪化）
3. **性能改善の実効性**: 実測データなしで導入したため、実際にボトルネックだったかが不明（推測ベースの最適化）
4. **代替手法の存在**: より単純な最適化（早期終了判定の強化、LOD導入など）で対処可能

### 廃止内容（`7385301`の完全なrevert）

#### voxel.frag

- Occupancy Grid uniforms を削除 (`uOccupancyTexture`, `uOccupancyDimensions`, `uBlockSize`)
- Occupancy Grid スキップロジックを削除 — 空ブロックスキップ処理とそれに伴うDDA再初期化コードをすべて除去
- **ブランチレスDDAを元のスカラーDDAに戻した** — `step()`ベースの`cmp`ベクトル演算から、元の`if/else`による軸判定方式に復元
- **maxSteps を距離ベースの適応的制御に戻した** — 固定2000ステップから、カメラ距離に応じて800〜200に調整する元の方式に復元

#### VoxelRenderer.tsx

- Occupancy Grid テクスチャ生成を削除 (`occupancyData` useMemo ブロック)
- Occupancy テクスチャの破棄処理を削除
- Occupancy uniform の設定・初期値を削除

**維持した変更**（バグと無関係な改善）:

- `applyEdgeHighlight()` ヘルパー関数（リファクタリングのみ）
- パレットα値による Visibility エンコード
- テクスチャの `dispose()` 処理（GPUメモリリーク防止）
- デバッグログの削除

## 学んだ教訓

### 1. 最適化の前にプロファイリング

**問題**: 実測データなしで「疎なボクセルでは遅いだろう」という推測で実装
**改善**: GPU Profilerやフレームタイム計測で実際のボトルネックを特定してから最適化すべき

### 2. 複数の最適化を同時に実施しない

**問題**: Occupancy Grid + ブランチレスDDA + maxSteps変更を同時実施したため、どれが問題か切り分けが困難
**改善**: 1つずつ段階的に導入し、各段階でテストを実施

### 3. エッジケースのテストケース不足

**問題**: クリッピング面とブロック境界が一致するケースを考慮していなかった
**改善**: 境界条件を網羅するテストケース（ユニットテスト or 視覚的検証用データセット）を事前に用意

### 4. 異なる座標系の混在に注意

**問題**: レイパラメータt空間（クリッピング）とグリッド空間（Occupancy Grid）の不整合
**改善**: 座標変換の整合性を保証する設計（例: t空間で完結するスキップ手法）

## 将来の再実装に向けた提案

疎なボクセルへの対応が再度必要になった場合の代替手法:

### 1. Sparse Voxel Octree (SVO)

**概要**: ボクセルデータ自体を8分木構造で管理し、空領域はノードを作らない
**利点**: クリッピングとの統合が容易（レイトレーシングをツリー走査で実装）
**欠点**: データ構造の複雑化、GPU実装の困難さ

**参考**: [Efficient Sparse Voxel Octrees (Laine & Karras, 2010)](https://research.nvidia.com/publication/2010-02_efficient-sparse-voxel-octrees)

### 2. 階層的距離フィールド (Hierarchical Distance Field)

**概要**: 各ブロックに「最も近い実体ボクセルまでの距離」を事前計算
**利点**: スキップ距離を正確に決定できる（過剰スキップのリスクなし）
**欠点**: 前処理コストが高い、メモリ使用量増加

### 3. レイパラメータt空間での空セル判定

**概要**: Occupancy Gridを使わず、tMaxの更新タイミングで「次のN個のセルが全て空か」を先読みチェック
**利点**: DDA状態の整合性を保持、クリッピングとの競合なし
**欠点**: 先読み範囲が小さいと性能改善が限定的

### 4. 2パスレンダリング

**概要**: 1パス目で粗いグリッドで可視領域を特定、2パス目で細かくレンダリング
**利点**: クリッピング処理を1パス目で完結できる
**欠点**: 実装の複雑化、メモリ帯域の増加

## 参考資料

- コミット履歴:
  - `5a70f46`: 描画性能改善（Occupancy Grid導入）
  - `912b8ca`: 穴があかない用に修正（しかし問題あり）
  - `7385301`: 描画処理を一部元にに戻した（完全廃止）

- 関連ドキュメント:
  - `specs/001-les-voxel-viewer/`: 仕様ドキュメント
  - `webview/src/shaders/voxel.frag`: レイマーチングシェーダー
  - `webview/src/VoxelRenderer.tsx`: レンダラー実装

## 結論

Occupancy Grid加速は理論的には有効な手法だが、本プロジェクトの設計（特にクリッピング機能）との整合性が取れず、廃止した。今後、疎なボクセルへの対応が必要な場合は、より慎重な設計と段階的な実装を行うこと。
