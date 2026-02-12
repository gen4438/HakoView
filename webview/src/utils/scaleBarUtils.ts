/**
 * スケールバーの長さと単位を計算するユーティリティ
 */

export interface ScaleBarInfo {
  /** スケールバーの長さ（ボクセル単位） */
  lengthInVoxels: number;
  /** スケールバーの長さ（実寸法） */
  lengthInMeters: number;
  /** 表示用のラベル（例: "100 μm", "1 mm"） */
  label: string;
  /** 使用する単位 */
  unit: string;
  /** 単位での値（例: 100, 1.5など） */
  value: number;
}

/** 利用可能な単位とそのメートルでの値 */
const UNITS = [
  { name: 'pm', label: 'pm', meters: 1e-12 },
  { name: 'nm', label: 'nm', meters: 1e-9 },
  { name: 'um', label: 'um', meters: 1e-6 },
  { name: 'mm', label: 'mm', meters: 1e-3 },
  { name: 'cm', label: 'cm', meters: 1e-2 },
  { name: 'm', label: 'm', meters: 1 },
  { name: 'km', label: 'km', meters: 1e3 },
];

/** キリの良い値（1-10の範囲） */
const NICE_NUMBERS = [1, 2, 5, 10];

/**
 * モデルサイズに基づいて適切なスケールバーの長さと単位を計算
 * @param modelSizeInVoxels モデルのサイズ（ボクセル単位）
 * @param voxelLength 1ボクセルの長さ（メートル）
 * @param targetRatio 目標とするモデルサイズに対する比率（デフォルト: 0.25 = 25%）
 * @returns スケールバー情報
 */
export function calculateScaleBar(
  modelSizeInVoxels: number,
  voxelLength: number,
  targetRatio: number = 0.25
): ScaleBarInfo {
  // モデルの実寸法（メートル）
  const modelSizeInMeters = modelSizeInVoxels * voxelLength;

  // 目標とするスケールバーの長さ（モデルの20-30%程度）
  const targetLengthInMeters = modelSizeInMeters * targetRatio;

  // 最適な単位を選択
  let bestUnit = UNITS[0];
  let bestScore = Infinity;

  for (const unit of UNITS) {
    const valueInUnit = targetLengthInMeters / unit.meters;
    // 1-100の範囲に収まる単位を優先
    const score = Math.abs(Math.log10(valueInUnit) - 1); // log10(10) = 1を目標
    if (score < bestScore) {
      bestScore = score;
      bestUnit = unit;
    }
  }

  // 選択した単位での値
  const valueInUnit = targetLengthInMeters / bestUnit.meters;

  // キリの良い値に丸める
  const magnitude = Math.pow(10, Math.floor(Math.log10(valueInUnit)));
  const normalized = valueInUnit / magnitude; // 1-10の範囲に正規化

  // 最も近いキリの良い値を選択
  let niceValue = NICE_NUMBERS[0];
  let minDiff = Infinity;
  for (const num of NICE_NUMBERS) {
    const diff = Math.abs(num - normalized);
    if (diff < minDiff) {
      minDiff = diff;
      niceValue = num;
    }
  }

  const finalValue = niceValue * magnitude;
  const finalLengthInMeters = finalValue * bestUnit.meters;
  const finalLengthInVoxels = finalLengthInMeters / voxelLength;

  // 整数値の場合は小数点なし、小数の場合は適切な精度で表示
  const displayValue = finalValue % 1 === 0 ? finalValue.toString() : finalValue.toFixed(1);

  return {
    lengthInVoxels: finalLengthInVoxels,
    lengthInMeters: finalLengthInMeters,
    label: `${displayValue} ${bestUnit.label}`,
    unit: bestUnit.name,
    value: finalValue,
  };
}

/**
 * xyz各軸のスケールバー情報を計算
 * @param dimensions ボクセルの次元
 * @param voxelLength 1ボクセルの長さ（メートル）
 * @returns 各軸のスケールバー情報
 */
export function calculateScaleBars(
  dimensions: { x: number; y: number; z: number },
  voxelLength: number
): { x: ScaleBarInfo; y: ScaleBarInfo; z: ScaleBarInfo } {
  // 各軸で独立してスケールバーを計算（軸ごとの寸法を使用）
  const xBar = calculateScaleBar(dimensions.x, voxelLength);
  const yBar = calculateScaleBar(dimensions.y, voxelLength);
  const zBar = calculateScaleBar(dimensions.z, voxelLength);

  return { x: xBar, y: yBar, z: zBar };
}

/**
 * 物理長さを適切な単位でフォーマット
 * @param lengthInMeters 長さ（メートル）
 * @returns フォーマットされた文字列（例: "200 nm", "1.5 mm"）
 */
export function formatPhysicalLength(lengthInMeters: number): string {
  if (lengthInMeters <= 0) {return '0';}

  // 最適な単位を選択（値が0.1〜9999の範囲に収まるもの）
  let bestUnit = UNITS[0];
  for (const unit of UNITS) {
    const value = lengthInMeters / unit.meters;
    if (value >= 0.1 && value < 10000) {
      bestUnit = unit;
      break;
    }
  }

  const value = lengthInMeters / bestUnit.meters;
  // 有効数字4桁でフォーマットし、末尾の0を除去
  const formatted = parseFloat(value.toPrecision(4)).toString();
  return `${formatted} ${bestUnit.label}`;
}
