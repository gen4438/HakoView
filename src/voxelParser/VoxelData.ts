/**
 * ボクセルグリッドの3次元サイズ
 */
export interface Dimensions {
	readonly x: number;
	readonly y: number;
	readonly z: number;
}

/**
 * .leSファイルから読み込んだボクセルデータセット全体
 */
export interface VoxelDataset {
	/** ボクセル配列のサイズ (1 ≤ 各次元 ≤ 1024) */
	readonly dimensions: Dimensions;
	
	/** ボクセル間隔（メートル単位）。表示には非使用、メタデータのみ */
	readonly voxelLength: number;
	
	/** ボクセル値の1次元配列（X*Y*Z要素）。値範囲: 0-255 */
	readonly values: Uint8Array;
	
	/** 元ファイル名 */
	readonly fileName: string;
	
	/** ファイルパス（untitled時はundefined） */
	readonly filePath?: string;
}

/**
 * 3次元座標を1次元配列のインデックスに変換
 * @param x X座標 (0 ≤ x < dimensions.x)
 * @param y Y座標 (0 ≤ y < dimensions.y)
 * @param z Z座標 (0 ≤ z < dimensions.z)
 * @param dimensions グリッドサイズ
 * @returns 1次元配列のインデックス
 */
export function getVoxelIndex(x: number, y: number, z: number, dimensions: Dimensions): number {
	return (x * dimensions.y + y) * dimensions.z + z;
}

/**
 * 指定位置のボクセル値を取得
 * @param x X座標
 * @param y Y座標
 * @param z Z座標
 * @param dataset ボクセルデータセット
 * @returns ボクセル値 (0-255)
 */
export function getVoxelValue(x: number, y: number, z: number, dataset: VoxelDataset): number {
	const index = getVoxelIndex(x, y, z, dataset.dimensions);
	return dataset.values[index];
}

/**
 * 指定位置にボクセル値を設定
 * @param x X座標
 * @param y Y座標
 * @param z Z座標
 * @param value ボクセル値 (0-255)
 * @param dataset ボクセルデータセット
 */
export function setVoxelValue(x: number, y: number, z: number, value: number, dataset: VoxelDataset): void {
	const index = getVoxelIndex(x, y, z, dataset.dimensions);
	dataset.values[index] = value;
}

/**
 * ボクセルデータセットの総ボクセル数を計算
 */
export function getTotalVoxels(dimensions: Dimensions): number {
	return dimensions.x * dimensions.y * dimensions.z;
}

/**
 * Dimensionsが有効な範囲内かチェック
 */
export function isValidDimensions(dimensions: Dimensions): boolean {
	return (
		dimensions.x >= 1 && dimensions.x <= 1024 &&
		dimensions.y >= 1 && dimensions.y <= 1024 &&
		dimensions.z >= 1 && dimensions.z <= 1024
	);
}
