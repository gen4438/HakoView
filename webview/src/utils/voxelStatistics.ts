import type { VoxelStatistics } from '../store/controlTypes';

/**
 * ボクセルデータから各ID（0-15）の統計情報を計算する。
 * 値16以上は (value - 1) % 15 + 1 で1-15にマッピング（シェーダーと同一ロジック）。
 */
export function computeVoxelStatistics(
  textureData: Uint8Array,
  totalVoxels: number
): VoxelStatistics {
  const countByValue = new Array(16).fill(0);

  for (let i = 0; i < textureData.length; i++) {
    const raw = textureData[i];
    const mapped = raw === 0 ? 0 : raw <= 15 ? raw : ((raw - 1) % 15) + 1;
    countByValue[mapped]++;
  }

  const nonEmptyVoxels = totalVoxels - countByValue[0];

  return { countByValue, totalVoxels, nonEmptyVoxels };
}
