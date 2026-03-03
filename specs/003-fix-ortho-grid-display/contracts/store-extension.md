# Contract: ControlStore拡張

**Date**: 2026-03-03

## 追加インターフェース

### VoxelStatistics

```typescript
interface VoxelStatistics {
  /** 各ID（0-15）のボクセル数 */
  countByValue: number[];
  /** 全ボクセル数（X × Y × Z） */
  totalVoxels: number;
  /** 非空ボクセル数（ID ≠ 0） */
  nonEmptyVoxels: number;
}
```

### ControlState 追加フィールド

```typescript
// controlTypes.ts に追加
interface ControlState {
  // ... 既存フィールド
  voxelStatistics: VoxelStatistics | null;
  setVoxelStatistics: (stats: VoxelStatistics) => void;
}
```

## 統計計算関数

```typescript
function computeVoxelStatistics(textureData: Uint8Array, totalVoxels: number): VoxelStatistics {
  // 入力: textureData の各要素は 0-255
  // 16以上の値は (value - 1) % 15 + 1 で1-15にマッピング
  // 出力: countByValue[16], totalVoxels, nonEmptyVoxels
}
```

## シェーダーUniform追加

### voxel.frag

```glsl
uniform float uOrthoScale;  // 新規追加
```

### VoxelRenderer.tsx uniform初期化

```typescript
// ShaderMaterial初期化に追加
uOrthoScale: 0.0,
```

### VoxelRenderer.tsx useFrame更新

```typescript
// Orthoカメラの場合にuOrthoScaleを設定
if (camera.isOrthographicCamera) {
  const frustumHeight = camera.top - camera.bottom;
  uniforms.uOrthoScale.value = frustumHeight / gl.domElement.clientHeight;
} else {
  uniforms.uOrthoScale.value = 0.0;
}
```
