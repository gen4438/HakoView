import { describe, it, expect } from 'vitest';
import { computeVoxelStatistics } from '../../utils/voxelStatistics';

describe('computeVoxelStatistics', () => {
  it('全て同一IDのデータを正しくカウントする', () => {
    // 全て ID=3 のデータ (10個)
    const data = new Uint8Array(10).fill(3);
    const stats = computeVoxelStatistics(data, 10);

    expect(stats.totalVoxels).toBe(10);
    expect(stats.nonEmptyVoxels).toBe(10);
    expect(stats.countByValue[3]).toBe(10);
    expect(stats.countByValue[0]).toBe(0);
    expect(stats.countByValue.length).toBe(16);
  });

  it('全て空のデータを正しく処理する', () => {
    const data = new Uint8Array(8); // 全て0
    const stats = computeVoxelStatistics(data, 8);

    expect(stats.totalVoxels).toBe(8);
    expect(stats.nonEmptyVoxels).toBe(0);
    expect(stats.countByValue[0]).toBe(8);
    for (let i = 1; i < 16; i++) {
      expect(stats.countByValue[i]).toBe(0);
    }
  });

  it('混合データを正しくカウントする', () => {
    // 0, 1, 2, 3, 0, 5, 0, 15
    const data = new Uint8Array([0, 1, 2, 3, 0, 5, 0, 15]);
    const stats = computeVoxelStatistics(data, 8);

    expect(stats.totalVoxels).toBe(8);
    expect(stats.nonEmptyVoxels).toBe(5);
    expect(stats.countByValue[0]).toBe(3);
    expect(stats.countByValue[1]).toBe(1);
    expect(stats.countByValue[2]).toBe(1);
    expect(stats.countByValue[3]).toBe(1);
    expect(stats.countByValue[5]).toBe(1);
    expect(stats.countByValue[15]).toBe(1);
  });

  it('値16以上を(value-1)%15+1で1-15にマッピングする', () => {
    // 16 → (16-1)%15+1 = 1
    // 17 → (17-1)%15+1 = 2
    // 30 → (30-1)%15+1 = 15
    // 31 → (31-1)%15+1 = 1
    // 255 → (255-1)%15+1 = 15
    const data = new Uint8Array([16, 17, 30, 31, 255]);
    const stats = computeVoxelStatistics(data, 5);

    expect(stats.totalVoxels).toBe(5);
    expect(stats.nonEmptyVoxels).toBe(5);
    expect(stats.countByValue[0]).toBe(0);
    expect(stats.countByValue[1]).toBe(2); // 16, 31
    expect(stats.countByValue[2]).toBe(1); // 17
    expect(stats.countByValue[15]).toBe(2); // 30, 255
  });

  it('countByValueの合計がtotalVoxelsと一致する', () => {
    const data = new Uint8Array([0, 1, 5, 10, 15, 20, 100, 255]);
    const stats = computeVoxelStatistics(data, 8);

    const sum = stats.countByValue.reduce((a, b) => a + b, 0);
    expect(sum).toBe(stats.totalVoxels);
    expect(stats.nonEmptyVoxels).toBe(stats.totalVoxels - stats.countByValue[0]);
  });
});
