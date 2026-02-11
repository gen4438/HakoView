# leS Format Specification

**Feature**: 001-les-voxel-viewer  
**最終更新**: 2026-02-12  
**原典**: GeoDict voxel data format

このドキュメントは、実装で扱う.leSファイル形式の仕様を定義します。

---

## 概要

**leS format**は、3Dボクセル構造を格納するためのテキストベースのボクセルデータ形式です。密な配列表現を使用し、空白区切りで値を記述します。

## ファイル拡張子

- `.leS` - 非圧縮テキストファイル
- `.leS.gz` - Gzip圧縮テキストファイル（Phase 2以降で対応）

---

## ファイル構造

### ヘッダー行

最初の行はメタデータを空白区切りで記述：

```
X Y Z [voxel_length]
```

**フィールド:**

- `X` (int): X方向のボクセル数
- `Y` (int): Y方向のボクセル数
- `Z` (int): Z方向のボクセル数
- `voxel_length` (float): 各ボクセルの物理サイズ（メートル単位、科学的記数法）**[オプション]**

**例:**

```
10 20 40 2.000000e-08
```

これは (10, 20, 40) の形状、ボクセルサイズ20ナノメートルを表します。

### データ本体（密配列形式）

ヘッダーに続いて、以下の構造でデータを記述：

- **行数合計**: `X * Y` 行
- **行ごとの値数**: `Z` 個（空白区切り）
- **データ型**: 整数のマテリアルID（0-255、uint8）

---

## メモリレイアウトとファイル構造

### 重要: 転置処理不要

leS形式では内部配列 `(X, Y, Z)` を直接 `(X*Y, Z)` の2次元形式で出力します。ファイル構造とメモリ配置が一致するため、転置処理が不要で効率的です。

```python
# 書き込み (3D → 2D): 転置不要
data_2d = data.reshape(X * Y, Z)

# 読み込み (2D → 3D): 転置不要
data = data_2d.reshape(X, Y, Z)
```

### 行の順序

各行は X×Y グリッド内の一つの `(x, y)` 位置に対応し、Z方向の全値を含みます。

**ファイル構造:**

```
X Y Z [voxel_length]  <- ヘッダー行
data[0,0,0] data[0,0,1] ... data[0,0,Z-1]  <- 行1 (x=0, y=0)
data[0,1,0] data[0,1,1] ... data[0,1,Z-1]  <- 行2 (x=0, y=1)
...
data[0,Y-1,0] data[0,Y-1,1] ... data[0,Y-1,Z-1]  <- 行Y (x=0, y=Y-1)
data[1,0,0] data[1,0,1] ... data[1,0,Z-1]  <- 行Y+1 (x=1, y=0)
...
data[X-1,Y-1,0] data[X-1,Y-1,1] ... data[X-1,Y-1,Z-1]  <- 行X*Y (x=X-1, y=Y-1)
```

**行インデックスのマッピング (FR-012):**

```
行 i (0 ≤ i < X*Y) → (x, y) = (i÷Y, i%Y)
```

- 行 0 → `(x=0, y=0)` → Z方向値: `data[0, 0, :]`
- 行 1 → `(x=0, y=1)` → Z方向値: `data[0, 1, :]`
- 行 Y → `(x=1, y=0)` → Z方向値: `data[1, 0, :]`

---

## 例

### 例1: 小規模ボクセル (2×3×4)

**ファイル:** `example.leS`

```
2 3 4 1.000000e-09
1 0 0 0
0 0 0 0
0 0 0 0
0 0 10 0
0 0 0 0
0 0 0 20
```

**解釈:**

- 形状: (2, 3, 4)
- ボクセル長: 1.0 nm
- データ行数: 2×3 = 6行
- 行ごとの値数: 4個

**データマッピング:**

- 行0 `(x=0, y=0)`: `[1, 0, 0, 0]` → `data[0, 0, 0]=1`
- 行1 `(x=0, y=1)`: `[0, 0, 0, 0]` → すべて0
- 行2 `(x=0, y=2)`: `[0, 0, 0, 0]` → すべて0
- 行3 `(x=1, y=0)`: `[0, 0, 10, 0]` → `data[1, 0, 2]=10`
- 行4 `(x=1, y=1)`: `[0, 0, 0, 0]` → すべて0
- 行5 `(x=1, y=2)`: `[0, 0, 0, 20]` → `data[1, 2, 3]=20`

### 例2: 実用サイズ (10×20×40)

**ファイル:** `structure.leS`

```
10 20 40 2.000000e-08
2 2 2 2 2 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
2 2 2 2 2 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1 1
...
(合計200行 = 10 × 20)
```

**解釈:**

- 形状: (10, 20, 40)
- ボクセル長: 20 nm (2×10⁻⁸ m)
- データ行数: 200行 (10×20)
- 行ごとの値数: 40個

---

## バリデーションルール

### ヘッダー検証 (FR-005)

1. ヘッダーは3個または4個のフィールドを持つ
2. X, Y, Zは正の整数
3. voxel_length（存在する場合）は正の浮動小数点数
4. 1 ≤ X, Y, Z ≤ 1000 (FR-008)

### データ検証 (FR-011)

1. データ行数は `X * Y` と一致しなければならない
2. 各行は正確に `Z` 個の値を持たなければならない
3. すべての値はuint8の範囲 [0, 255] の有効な整数

### 値の扱い (FR-006, FR-007)

- **値 0**: 空ボクセル（透明）
- **値 1-255**: `((value - 1) % 16) + 1` で1-16の色インデックスに循環マッピング

---

## 無効なファイルの例

### エラー1: 形状不一致

```
2 3 4 1e-9
1 0 0 0
0 0 0 0
```

❌ **エラー**: ヘッダーは形状 (2, 3, 4) を宣言 → 2×3=6行を期待するが、2行のみ提供

### エラー2: サイズ上限超過

```
1001 1000 1000 1e-9
...
```

❌ **エラー**: X=1001 が上限1000を超過 (FR-008)

### エラー3: 不正な値数

```
2 2 4 1e-9
1 0 0 0
0 0 0  ← 3個のみ（4個必要）
0 0 0 0
0 0 0 0
```

❌ **エラー**: 行2がZ=4個の値を持たない

---

## 実装ノート

### TypeScript型定義

```typescript
interface LesHeader {
  x: number;
  y: number;
  z: number;
  voxelLength?: number;
}

interface LesFile {
  header: LesHeader;
  values: Uint8Array;  // length = X * Y * Z
}
```

### パース処理

```typescript
function parseLes(content: string): LesFile {
  const lines = content.split('\n').filter(line => line.trim());
  
  // ヘッダーパース
  const headerParts = lines[0].split(/\s+/);
  const header: LesHeader = {
    x: parseInt(headerParts[0]),
    y: parseInt(headerParts[1]),
    z: parseInt(headerParts[2]),
    voxelLength: headerParts[3] ? parseFloat(headerParts[3]) : undefined
  };
  
  // データパース
  const values = new Uint8Array(header.x * header.y * header.z);
  let index = 0;
  
  for (let i = 1; i < lines.length; i++) {
    const rowValues = lines[i].split(/\s+/).map(v => parseInt(v));
    for (const val of rowValues) {
      values[index++] = val;
    }
  }
  
  return { header, values };
}
```

---

## 参考資料

- 原典: GeoDict software (www.geodict.com)
- 本プロジェクト: [data-model.md](./data-model.md)
- パーサー実装: `src/voxelParser/LesParser.ts`

---

この仕様は、spec.mdの要件（FR-005, FR-011, FR-012等）とdata-model.mdのVoxelDataset定義に基づいています。
